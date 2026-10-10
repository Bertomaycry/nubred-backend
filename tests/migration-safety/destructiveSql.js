import fs from "node:fs";
import path from "node:path";

export const APPROVAL_MARKER = /--\s*data-loss-approved\b/i;

// Already applied on existing databases. New migrations are not exempt.
export const HISTORICAL_DESTRUCTIVE_MIGRATIONS = new Set([
  "20260405120000_clerk_auth_migration",
]);

const DESTRUCTIVE_PATTERNS = [
  { name: "DROP TABLE", pattern: /\bDROP\s+TABLE\b/i },
  { name: "DROP COLUMN", pattern: /\bDROP\s+COLUMN\b/i },
  { name: "TRUNCATE", pattern: /\bTRUNCATE\b/i },
  { name: "DELETE FROM", pattern: /\bDELETE\s+FROM\b/i },
];

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
}

export function findDestructiveMigrations(migrationsDir) {
  const findings = [];

  for (const entry of fs.readdirSync(migrationsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (HISTORICAL_DESTRUCTIVE_MIGRATIONS.has(entry.name)) continue;

    const sqlPath = path.join(migrationsDir, entry.name, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;

    const sql = fs.readFileSync(sqlPath, "utf8");
    if (APPROVAL_MARKER.test(sql)) continue;

    const statements = DESTRUCTIVE_PATTERNS.filter((item) =>
      item.pattern.test(stripComments(sql)),
    ).map((item) => item.name);

    if (statements.length > 0) {
      findings.push({ migration: entry.name, statements });
    }
  }

  return findings;
}
