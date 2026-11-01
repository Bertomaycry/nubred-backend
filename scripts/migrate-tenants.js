/**
 * Apply pending tenant migrations (prisma/tenant/migrations) to every ready
 * client database. Run after `prisma migrate deploy` on each release:
 *   npm run migrate:tenants
 *
 * Continues past a failing client and exits 1 at the end if any failed.
 */
import "dotenv/config";
import prisma from "../src/lib/prisma.js";
import { migrateTenantDatabase } from "../src/lib/tenant-migrate.js";

const tenants = await prisma.tenant.findMany({
  where: { provisioningStatus: "ready" },
  select: { slug: true, databaseName: true },
  orderBy: { createdAt: "asc" },
});

let failed = 0;
for (const tenant of tenants) {
  try {
    await migrateTenantDatabase(tenant.databaseName);
    console.log(`ok     ${tenant.slug}`);
  } catch (error) {
    failed += 1;
    console.error(`FAILED ${tenant.slug}: ${error.message}`);
  }
}

console.log(`${tenants.length - failed}/${tenants.length} client databases migrated.`);
await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
