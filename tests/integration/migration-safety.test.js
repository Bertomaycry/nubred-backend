import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, jest } from "@jest/globals";
import { findDestructiveMigrations } from "../migration-safety/destructiveSql.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATIONS_DIR = path.join(ROOT, "prisma", "migrations");
const SCHEMA_PATH = path.join(ROOT, "prisma", "schema.prisma");
const PRISMA_CLI = path.join(ROOT, "node_modules", "prisma", "build", "index.js");

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL;
const shadowDatabaseUrl = process.env.MIGRATION_SHADOW_DATABASE_URL;
const upgradeDatabaseUrl = process.env.MIGRATION_UPGRADE_DATABASE_URL;
const baseSha = process.env.MIGRATION_BASE_SHA || "";
const databaseTestsEnabled = Boolean(
  migrationDatabaseUrl && shadowDatabaseUrl && upgradeDatabaseUrl,
);

const FIXTURES = [
  {
    table: "users",
    preferred: {
      id: "11111111-1111-4111-8111-111111111111",
      firstName: "Migration",
      lastName: "Safety",
      email: "migration-safety@example.com",
      phoneNumber: "+10000000001",
      password: "not-a-real-password",
    },
  },
  {
    table: "early_adopters",
    preferred: {
      id: "44444444-4444-4444-8444-444444444444",
      email: "migration-safety@example.com",
      app: "governance",
    },
  },
  {
    table: "blogs",
    preferred: {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Migration safety",
      content: "Existing row that deploy must keep",
      authorId: "11111111-1111-4111-8111-111111111111",
    },
  },
  {
    table: "inquiries",
    preferred: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Migration Safety",
      email: "migration-safety@example.com",
      contact: "+10000000001",
      message: "Existing inquiry that deploy must keep",
    },
  },
];

jest.setTimeout(180000);

function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing unexpected SQL identifier [${name}]`);
  }
  return `"${name}"`;
}

function runPrisma(args, databaseUrl) {
  return execFileSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}

function runPrismaAllowingFailure(args, databaseUrl) {
  try {
    const stdout = runPrisma(args, databaseUrl);
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? error.message,
    };
  }
}

function migrationNames() {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(MIGRATIONS_DIR, name, "migration.sql")))
    .sort();
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return value.toString("hex");
  return value;
}

function normalizeRow(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "updatedAt") continue;
    normalized[key] = normalizeValue(value);
  }
  return normalized;
}

async function resetPublicSchema(prisma) {
  await prisma.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await prisma.$executeRawUnsafe("CREATE SCHEMA public");
  await prisma.$executeRawUnsafe("GRANT ALL ON SCHEMA public TO CURRENT_USER");
  await prisma.$executeRawUnsafe("GRANT ALL ON SCHEMA public TO public");
}

async function tableExists(prisma, table) {
  const rows = await prisma.$queryRaw`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
  return rows.length > 0;
}

async function fallbackValue(prisma, column) {
  const dataType = column.data_type;
  if (dataType === "boolean") return false;
  if (dataType === "integer" || dataType === "bigint" || dataType === "smallint") return 0;
  if (dataType.includes("timestamp") || dataType === "date") return new Date();
  if (dataType === "json" || dataType === "jsonb") return {};
  if (dataType === "USER-DEFINED") {
    const rows = await prisma.$queryRaw`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = ${column.udt_name}
      ORDER BY e.enumsortorder
      LIMIT 1
    `;
    if (rows.length === 0) {
      throw new Error(`No enum label for [${column.udt_name}]`);
    }
    return rows[0].enumlabel;
  }
  return "migration-safety";
}

async function insertFixtureRow(prisma, table, preferred) {
  const columns = await prisma.$queryRaw`
    SELECT column_name, is_nullable, column_default, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `;

  const names = [];
  const values = [];
  for (const column of columns) {
    let value = preferred[column.column_name];
    if (value === undefined) {
      if (column.is_nullable === "YES" || column.column_default) continue;
      value = await fallbackValue(prisma, column);
    }
    names.push(quoteIdent(column.column_name));
    values.push(value);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  await prisma.$executeRawUnsafe(
    `INSERT INTO ${quoteIdent(table)} (${names.join(", ")}) VALUES (${placeholders})`,
    ...values,
  );
}

async function readRow(prisma, table, id) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM ${quoteIdent(table)} WHERE ${quoteIdent("id")} = $1`,
    id,
  );
  return rows[0] ?? null;
}

async function seedExistingRows(prisma) {
  const seeded = [];
  for (const fixture of FIXTURES) {
    if (!(await tableExists(prisma, fixture.table))) continue;
    await insertFixtureRow(prisma, fixture.table, fixture.preferred);
    seeded.push({
      table: fixture.table,
      id: fixture.preferred.id,
      row: normalizeRow(await readRow(prisma, fixture.table, fixture.preferred.id)),
    });
  }
  if (seeded.length === 0) {
    throw new Error("No fixture tables existed after migrate deploy");
  }
  return seeded;
}

function expectRowsPreserved(beforeRows, afterRows) {
  expect(afterRows.map((row) => row.table)).toEqual(beforeRows.map((row) => row.table));
  for (let index = 0; index < beforeRows.length; index += 1) {
    const before = beforeRows[index];
    const after = afterRows[index];
    expect(after.row).not.toBeNull();
    for (const key of Object.keys(before.row)) {
      if (!(key in after.row)) continue;
      expect(after.row[key]).toEqual(before.row[key]);
    }
  }
}

async function openPrisma(databaseUrl) {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
}

function extractBaseMigrations(sha) {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "migration-base-"));
  const tarPath = path.join(dest, "migrations.tar");
  execFileSync(
    "git",
    ["archive", "--format=tar", "-o", tarPath, sha, "prisma/migrations", "prisma/schema.prisma"],
    { cwd: ROOT },
  );
  execFileSync("tar", ["-xf", tarPath, "-C", dest]);
  return dest;
}

describe("prisma migration safety", () => {
  it("rejects new destructive SQL unless the migration marks data loss as approved", () => {
    expect(findDestructiveMigrations(MIGRATIONS_DIR)).toEqual([]);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "destructive-sql-"));
    const blocked = path.join(tempDir, "20990101000000_drop_email");
    const approved = path.join(tempDir, "20990101000100_drop_email_approved");
    fs.mkdirSync(blocked);
    fs.mkdirSync(approved);
    fs.writeFileSync(
      path.join(blocked, "migration.sql"),
      'ALTER TABLE "users" DROP COLUMN "email";\n',
    );
    fs.writeFileSync(
      path.join(approved, "migration.sql"),
      '-- data-loss-approved: email moved to another store\nALTER TABLE "users" DROP COLUMN "email";\n',
    );

    expect(findDestructiveMigrations(tempDir)).toEqual([
      { migration: "20990101000000_drop_email", statements: ["DROP COLUMN"] },
    ]);
  });

  it("requires disposable database URLs in CI", () => {
    if (process.env.CI && !databaseTestsEnabled) {
      throw new Error(
        "MIGRATION_DATABASE_URL, MIGRATION_SHADOW_DATABASE_URL, and MIGRATION_UPGRADE_DATABASE_URL are required in CI",
      );
    }
    expect(databaseTestsEnabled || !process.env.CI).toBe(true);
  });

  (databaseTestsEnabled ? describe : describe.skip)("disposable postgres", () => {
    it("keeps prisma/migrations in sync with schema.prisma", () => {
      const result = runPrismaAllowingFailure(
        [
          "migrate",
          "diff",
          "--from-migrations",
          MIGRATIONS_DIR,
          "--to-schema-datamodel",
          SCHEMA_PATH,
          "--shadow-database-url",
          shadowDatabaseUrl,
          "--exit-code",
        ],
        shadowDatabaseUrl,
      );

      expect({
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
      }).toEqual({
        status: 0,
        stdout: expect.any(String),
        stderr: expect.any(String),
      });
    });

    it("deploys every migration onto an empty database", async () => {
      const prisma = await openPrisma(migrationDatabaseUrl);
      try {
        await resetPublicSchema(prisma);
        runPrisma(["migrate", "deploy", "--schema", SCHEMA_PATH], migrationDatabaseUrl);

        const applied = await prisma.$queryRaw`
          SELECT migration_name FROM _prisma_migrations ORDER BY migration_name
        `;
        expect(applied.map((row) => row.migration_name)).toEqual(migrationNames());
      } finally {
        await prisma.$disconnect();
      }
    });

    it("does not change existing rows when deploy runs again", async () => {
      const prisma = await openPrisma(migrationDatabaseUrl);
      try {
        await resetPublicSchema(prisma);
        runPrisma(["migrate", "deploy", "--schema", SCHEMA_PATH], migrationDatabaseUrl);
        const before = await seedExistingRows(prisma);

        runPrisma(["migrate", "deploy", "--schema", SCHEMA_PATH], migrationDatabaseUrl);

        const after = [];
        for (const row of before) {
          const current = await readRow(prisma, row.table, row.id);
          after.push({ table: row.table, row: current ? normalizeRow(current) : null });
        }
        expectRowsPreserved(before, after);
      } finally {
        await prisma.$disconnect();
      }
    });

    (baseSha ? it : it.skip)(
      "keeps rows that existed before the migrations added on this change",
      async () => {
        const baseRoot = extractBaseMigrations(baseSha);
        const prisma = await openPrisma(upgradeDatabaseUrl);
        try {
          await resetPublicSchema(prisma);
          runPrisma(
            ["migrate", "deploy", "--schema", path.join(baseRoot, "prisma", "schema.prisma")],
            upgradeDatabaseUrl,
          );
          const before = await seedExistingRows(prisma);

          runPrisma(["migrate", "deploy", "--schema", SCHEMA_PATH], upgradeDatabaseUrl);

          const after = [];
          for (const row of before) {
            if (!(await tableExists(prisma, row.table))) {
              after.push({ table: row.table, row: null });
              continue;
            }
            const current = await readRow(prisma, row.table, row.id);
            after.push({ table: row.table, row: current ? normalizeRow(current) : null });
          }
          expectRowsPreserved(before, after);
        } finally {
          await prisma.$disconnect();
          fs.rmSync(baseRoot, { recursive: true, force: true });
        }
      },
    );
  });
});
