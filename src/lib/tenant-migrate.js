import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assertDatabaseName, tenantDatabaseUrl } from "./tenant-prisma.js";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PRISMA_CLI = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
const TENANT_SCHEMA = path.join(ROOT, "prisma", "tenant", "schema.prisma");

/**
 * Apply pending tenant migrations (prisma/tenant/migrations) to one client
 * database. Safe to repeat. Used by provisioning and scripts/migrate-tenants.js.
 *
 * @param {string} databaseName nubred_{slug}
 */
export async function migrateTenantDatabase(databaseName) {
  assertDatabaseName(databaseName);

  try {
    await execFileAsync(
      process.execPath,
      [PRISMA_CLI, "migrate", "deploy", "--schema", TENANT_SCHEMA],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          TENANT_DATABASE_URL: tenantDatabaseUrl(databaseName, {
            connectionLimit: 1,
          }),
        },
        maxBuffer: 4 * 1024 * 1024,
      }
    );
  } catch (error) {
    // Never echo the connection string.
    const detail = String(error.stderr || error.stdout || error.message)
      .replace(/postgres(ql)?:\/\/\S+/gi, "postgres://***")
      .trim();
    throw new Error(`Tenant migration failed for ${databaseName}: ${detail}`);
  }
}
