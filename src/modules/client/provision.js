import prismaDefault from "../../lib/prisma.js";
import {
  assertDatabaseName,
  evictTenantDb,
} from "../../lib/tenant-prisma.js";
import { migrateTenantDatabase } from "../../lib/tenant-migrate.js";
import { ensureStorage } from "../project/storage/provider.js";
import { MODULE_IDS } from "./modules.js";
import { bucketNameFor, databaseNameFor, workspaceUrl } from "./slug.js";

/** An error asyncHandler answers with as-is (it reads `code` as the HTTP status). */
export class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.code = status;
  }
}

const SLUG_TAKEN = "This unique URL is already in use.";

// ---------------------------------------------------------------------------
// Real side effects, replaceable in tests.
// ---------------------------------------------------------------------------

function defaultDeps(prisma) {
  return {
    prisma,
    storage: ensureStorage,
    migrate: migrateTenantDatabase,

    async databaseExists(name) {
      const rows = await prisma.$queryRaw`
        SELECT 1 AS ok FROM pg_database WHERE datname = ${name}
      `;
      return rows.length > 0;
    },
    async createDatabase(name) {
      assertDatabaseName(name);
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    },
    async dropDatabase(name) {
      assertDatabaseName(name);
      await evictTenantDb(name);
      await prisma.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`
      );
    },

    inviteEmail: inviteViaClerk,
  };
}

/** Clerk invitation email. Imported lazily so tests need no Clerk key. */
export async function inviteViaClerk(emailAddress, redirectUrl) {
  const { clerkClient } = await import("../../middlewares/auth.middleware.js");
  await clerkClient.invitations.createInvitation({
    emailAddress,
    redirectUrl,
    ignoreExisting: true,
  });
}

// ---------------------------------------------------------------------------
// Shared helpers (create + edit)
// ---------------------------------------------------------------------------

/** Admins can't be client users. */
export async function assertNotAdmins(prisma, emails) {
  if (emails.length === 0) return;
  const admins = await prisma.user.findMany({
    where: {
      role: "admin",
      OR: emails.map((email) => ({
        email: { equals: email, mode: "insensitive" },
      })),
    },
    select: { email: true },
  });
  if (admins.length > 0) {
    throw new ClientError(
      400,
      `${admins[0].email} is a NuBred admin and cannot be added as a client user.`
    );
  }
}

/**
 * Invite people who don't have a NuBred login yet. Existing accounts just
 * sign in. Failures are reported, never thrown: the client is already saved.
 *
 * @returns {Promise<Array<{ email: string, reason: string }>>}
 */
export async function inviteNewUsers({ slug, emails, deps }) {
  const failures = [];
  if (emails.length === 0) return failures;

  const existing = await deps.prisma.user.findMany({
    where: {
      OR: emails.map((email) => ({
        email: { equals: email, mode: "insensitive" },
      })),
    },
    select: { email: true },
  });
  const known = new Set(existing.map((u) => u.email.toLowerCase()));

  for (const email of emails) {
    if (known.has(email)) continue;
    try {
      await deps.inviteEmail(email, workspaceUrl(slug));
    } catch (error) {
      console.warn(`Clerk invitation for ${email} failed: ${error.message}`);
      failures.push({ email, reason: error.message });
    }
  }
  return failures;
}

export const moduleRows = (tenantId, modules) =>
  MODULE_IDS.map((moduleId) => ({
    tenantId,
    moduleId,
    enabled: modules[moduleId] === true,
  }));

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Provision a client: tenant row, database, migrations, bucket, users,
 * module flags, invitations. On failure everything this attempt created is
 * removed and the tenant row is left `failed` (never listed).
 *
 * @param {{ companyName, maxProjects, uniqueUrl, users, modules }} input validated
 * @param {object} [overrides] test doubles for deps
 * @returns {Promise<{ tenant: object, inviteFailures: Array }>}
 */
export async function provisionClient(input, overrides = {}) {
  const deps = { ...defaultDeps(overrides.prisma ?? prismaDefault), ...overrides };
  const { prisma } = deps;

  const slug = input.uniqueUrl;
  const databaseName = databaseNameFor(slug);
  const bucketName = bucketNameFor(slug);
  const emails = input.users.map((u) => u.email);

  await assertNotAdmins(prisma, emails);

  const storage = await deps.storage();

  // A failed earlier attempt may be retried only if it left nothing behind.
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    if (existing.provisioningStatus !== "failed") {
      throw new ClientError(409, SLUG_TAKEN);
    }
    await prisma.tenant.delete({ where: { id: existing.id } });
  }
  if (
    (await deps.databaseExists(databaseName)) ||
    (await storage.bucketExists(bucketName))
  ) {
    throw new ClientError(409, SLUG_TAKEN);
  }

  let tenant;
  try {
    tenant = await prisma.tenant.create({
      data: {
        name: input.companyName,
        slug,
        databaseName,
        bucketName,
        maxProjects: input.maxProjects,
        status: "active",
        provisioningStatus: "provisioning",
      },
    });
  } catch (error) {
    if (error.code === "P2002") throw new ClientError(409, SLUG_TAKEN);
    throw error;
  }

  let createdDatabase = false;
  let createdBucket = false;

  try {
    await deps.createDatabase(databaseName);
    createdDatabase = true;

    await deps.migrate(databaseName);

    await storage.createBucket(bucketName);
    createdBucket = true;

    await prisma.$transaction([
      prisma.tenantUser.createMany({
        data: input.users.map((u) => ({
          tenantId: tenant.id,
          email: u.email,
          role: u.role,
        })),
      }),
      prisma.tenantModule.createMany({
        data: moduleRows(tenant.id, input.modules),
      }),
    ]);

    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { provisioningStatus: "ready" },
    });
  } catch (error) {
    console.error(`Provisioning ${slug} failed:`, error);

    if (createdBucket) {
      await storage.deleteBucketIfEmpty(bucketName).catch((e) =>
        console.error(`Cleanup: bucket ${bucketName}:`, e.message)
      );
    }
    if (createdDatabase) {
      await deps.dropDatabase(databaseName).catch((e) =>
        console.error(`Cleanup: database ${databaseName}:`, e.message)
      );
    }
    await prisma.tenantUser
      .deleteMany({ where: { tenantId: tenant.id } })
      .catch((e) => console.error(`Cleanup: users ${slug}:`, e.message));
    await prisma.tenant
      .update({
        where: { id: tenant.id },
        data: { provisioningStatus: "failed" },
      })
      .catch((e) => console.error(`Cleanup: tenant row ${slug}:`, e.message));

    throw new ClientError(500, "Could not set up this client. Try again.");
  }

  // Saved. Invitations are best effort.
  const inviteFailures = await inviteNewUsers({ slug, emails, deps });

  return { tenant, inviteFailures };
}
