import prismaDefault from "../../lib/prisma.js";
import {
  ClientError,
  assertNotAdmins,
  inviteNewUsers,
  inviteViaClerk,
  moduleRows,
} from "./provision.js";

/**
 * Apply Changes. Never provisions: slug, database and bucket stay as created.
 *
 * `users` is the full desired set. New email -> access + invitation.
 * Missing email -> access revoked (tenant_users row deleted; usage rows stay).
 * Same email, other role -> role updated.
 *
 * @param {string} id tenant id
 * @param {{ companyName, maxProjects, uniqueUrl?, users, modules }} input validated
 * @param {object} [overrides] test doubles ({ prisma, inviteEmail })
 */
export async function updateClient(id, input, overrides = {}) {
  const prisma = overrides.prisma ?? prismaDefault;

  const tenant = await prisma.tenant.findFirst({
    where: { id, provisioningStatus: "ready" },
    include: { users: true },
  });
  if (!tenant) throw new ClientError(404, "Client not found");

  if (input.uniqueUrl && input.uniqueUrl !== tenant.slug) {
    throw new ClientError(400, "The custom URL cannot be edited.");
  }

  const current = new Map(tenant.users.map((u) => [u.email, u]));
  const desired = new Map(input.users.map((u) => [u.email, u]));

  const removed = tenant.users.filter((u) => !desired.has(u.email));
  const added = input.users.filter((u) => !current.has(u.email));
  const changed = input.users.filter(
    (u) => current.has(u.email) && current.get(u.email).role !== u.role
  );

  await assertNotAdmins(
    prisma,
    added.map((u) => u.email)
  );

  // Order matters only for the owner swap: free the old owner role first.
  await prisma.$transaction([
    prisma.tenant.update({
      where: { id },
      data: { name: input.companyName, maxProjects: input.maxProjects },
    }),
    prisma.tenantUser.deleteMany({
      where: { id: { in: removed.map((u) => u.id) } },
    }),
    ...changed.map((u) =>
      prisma.tenantUser.update({
        where: { id: current.get(u.email).id },
        data: { role: u.role },
      })
    ),
    prisma.tenantUser.createMany({
      data: added.map((u) => ({
        tenantId: id,
        email: u.email,
        role: u.role,
      })),
    }),
    prisma.tenantModule.deleteMany({ where: { tenantId: id } }),
    prisma.tenantModule.createMany({ data: moduleRows(id, input.modules) }),
  ]);

  const inviteFailures = await inviteNewUsers({
    slug: tenant.slug,
    emails: added.map((u) => u.email),
    deps: {
      prisma,
      inviteEmail: overrides.inviteEmail ?? inviteViaClerk,
    },
  });

  return { tenant, inviteFailures };
}
