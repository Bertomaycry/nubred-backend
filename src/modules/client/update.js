import prismaDefault from "../../lib/prisma.js";
import { ClientError } from "./errors.js";
import { assertNotAdmins, inviteClientUser, moduleRows } from "./provision.js";
import {
  invitePendingUsers,
  planMembershipChanges,
  revokeClerkInvitation,
} from "./invites.js";

/**
 * Apply Changes. Never provisions: slug, database and bucket stay as created.
 *
 * `users` is the full desired set, including people who have not accepted.
 * A new email becomes a pending invite. An open pending invite is not emailed
 * again. A missing email revokes a pending invite or removes a member.
 *
 * @param {string} id tenant id
 * @param {{ companyName, maxProjects, uniqueUrl?, users, modules }} input validated
 * @param {object} [overrides] test doubles ({ prisma, inviteEmail, revokeInvitation })
 */
export async function updateClient(id, input, overrides = {}) {
  const prisma = overrides.prisma ?? prismaDefault;
  const revokeInvitation = overrides.revokeInvitation ?? revokeClerkInvitation;

  const tenant = await prisma.tenant.findFirst({
    where: { id, provisioningStatus: "ready" },
    include: { users: true, invites: true },
  });
  if (!tenant) throw new ClientError(404, "Client not found");

  if (input.uniqueUrl && input.uniqueUrl !== tenant.slug) {
    throw new ClientError(400, "The custom URL cannot be edited.");
  }

  const plan = planMembershipChanges({
    members: tenant.users,
    invites: tenant.invites,
    desired: input.users,
  });

  const addedEmails = plan.toInvite.map((user) => user.email);
  if (addedEmails.length > 0) {
    await assertNotAdmins(prisma, addedEmails);
  }

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id },
      data: { name: input.companyName, maxProjects: input.maxProjects },
    }),
    prisma.tenantUser.deleteMany({
      where: { id: { in: plan.removedMembers.map((user) => user.id) } },
    }),
    ...plan.changedMembers.map((user) =>
      prisma.tenantUser.update({
        where: { id: tenant.users.find((row) => row.email === user.email).id },
        data: { role: user.role },
      })
    ),
    ...plan.changedPending.map((user) =>
      prisma.tenantInvite.update({
        where: {
          id: tenant.invites.find((row) => row.email === user.email).id,
        },
        data: { role: user.role },
      })
    ),
    ...plan.removedPending.map((invite) =>
      prisma.tenantInvite.update({
        where: { id: invite.id },
        data: { status: "revoked" },
      })
    ),
    prisma.tenantModule.deleteMany({ where: { tenantId: id } }),
    prisma.tenantModule.createMany({ data: moduleRows(id, input.modules) }),
  ]);

  for (const invite of plan.removedPending) {
    if (!invite.clerkInvitationId) continue;
    await Promise.resolve(revokeInvitation(invite.clerkInvitationId)).catch((error) =>
      console.warn(
        `Could not revoke invitation ${invite.clerkInvitationId}: ${error.message}`
      )
    );
  }

  const inviteFailures = await invitePendingUsers({
    tenantId: tenant.id,
    slug: tenant.slug,
    companyName: input.companyName,
    users: plan.toInvite,
    deps: {
      prisma,
      inviteEmail: overrides.inviteEmail ?? inviteClientUser,
    },
  });

  return { tenant, inviteFailures };
}
