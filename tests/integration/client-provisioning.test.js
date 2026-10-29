/* eslint-disable no-undef */
/**
 * Provisions a throwaway client against a real Postgres (CREATE DATABASE +
 * prisma/tenant migrations). Storage and Clerk are faked.
 *
 * Needs a platform database that already has prisma/migrations applied, and a
 * role allowed to CREATE DATABASE:
 *   NUBRED_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/nubred_test npm test -- client-provisioning
 */
import { jest } from "@jest/globals";

const url = process.env.NUBRED_TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const MODULES = [
  "contract", "genotype", "phase", "protocol", "field_observation", "timeline",
  "model_supply_chain", "todo", "ip_right", "quarantine",
  "predictive_genotype_analysis", "ai_protocol_generation", "contract_risk_analysis",
];

const fakeStorage = () => {
  const buckets = new Set();
  return {
    buckets,
    bucketExists: async (b) => buckets.has(b),
    createBucket: async (b) => {
      if (buckets.has(b)) throw new Error("exists");
      buckets.add(b);
    },
    deleteBucketIfEmpty: async (b) => buckets.delete(b),
  };
};

run("client provisioning (real Postgres)", () => {
  jest.setTimeout(180_000);

  const slug = `it-${Date.now().toString(36)}`;
  const databaseName = `nubred_${slug.replace(/-/g, "_")}`;
  let prisma;
  let provisionClient;
  let updateClient;
  let getTenantDb;
  let evictTenantDb;
  let storage;
  let invites;

  const input = () => ({
    companyName: "Integration Co",
    maxProjects: 3,
    uniqueUrl: slug,
    users: [
      { email: `owner-${slug}@example.com`, role: "owner" },
      { email: `pm-${slug}@example.com`, role: "project_manager" },
    ],
    modules: Object.fromEntries(MODULES.map((id) => [id, id === "contract"])),
  });

  const deps = () => ({
    prisma,
    storage: async () => storage,
    inviteEmail: async (email) => invites.push(email),
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.NUBRED_TENANT_DATABASE_URL = url;
    ({ default: prisma } = await import("../../src/lib/prisma.js"));
    ({ provisionClient } = await import("../../src/modules/client/provision.js"));
    ({ updateClient } = await import("../../src/modules/client/update.js"));
    ({ getTenantDb, evictTenantDb } = await import("../../src/lib/tenant-prisma.js"));
  });

  beforeEach(() => {
    storage = fakeStorage();
    invites = [];
  });

  afterAll(async () => {
    await evictTenantDb(databaseName);
    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await prisma.tenant.deleteMany({ where: { slug } });
    await prisma.$disconnect();
  });

  test("a failed attempt cleans up, then a retry succeeds", async () => {
    await expect(
      provisionClient(input(), {
        ...deps(),
        migrate: async () => {
          throw new Error("boom");
        },
      })
    ).rejects.toMatchObject({ status: 500 });

    const failed = await prisma.tenant.findUnique({ where: { slug } });
    expect(failed.provisioningStatus).toBe("failed");
    const dbs = await prisma.$queryRaw`SELECT 1 FROM pg_database WHERE datname = ${databaseName}`;
    expect(dbs).toHaveLength(0);
    expect(storage.buckets.size).toBe(0);

    const { tenant, inviteFailures } = await provisionClient(input(), deps());
    expect(tenant.provisioningStatus).toBe("ready");
    expect(inviteFailures).toEqual([]);
    expect(invites).toHaveLength(2);
    expect(storage.buckets.has(`nubred-${slug}`)).toBe(true);
  });

  test("tenant database has the project tables", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    const db = getTenantDb(tenant);
    expect(await db.project.count()).toBe(0);
    expect(await db.projectMember.count()).toBe(0);
  });

  test("users and 13 module flags are stored", async () => {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: { users: true, modules: true },
    });
    expect(tenant.users.map((u) => u.role).sort()).toEqual(["owner", "project_manager"]);
    expect(tenant.modules).toHaveLength(13);
    expect(tenant.modules.filter((m) => m.enabled).map((m) => m.moduleId)).toEqual(["contract"]);
  });

  test("same slug again is a 409", async () => {
    await expect(provisionClient(input(), deps())).rejects.toMatchObject({
      status: 409,
      message: "This unique URL is already in use.",
    });
  });

  test("edit diffs users, replaces flags and never changes the slug", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });

    await expect(
      updateClient(tenant.id, { ...input(), uniqueUrl: "other" }, deps())
    ).rejects.toMatchObject({ status: 400, message: "The custom URL cannot be edited." });

    const next = input();
    next.companyName = "Renamed Co";
    next.users = [
      { email: `owner-${slug}@example.com`, role: "owner" },
      { email: `viewer-${slug}@example.com`, role: "viewer" },
    ];
    next.modules = Object.fromEntries(MODULES.map((id) => [id, id === "todo"]));

    await updateClient(tenant.id, next, deps());

    const after = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      include: { users: true, modules: true },
    });
    expect(after.name).toBe("Renamed Co");
    expect(after.slug).toBe(slug);
    expect(after.databaseName).toBe(databaseName);
    expect(after.users.map((u) => u.email).sort()).toEqual([
      `owner-${slug}@example.com`,
      `viewer-${slug}@example.com`,
    ]);
    expect(after.modules.filter((m) => m.enabled).map((m) => m.moduleId)).toEqual(["todo"]);
  });
});
