import dotenv from "dotenv";
import prisma from "../lib/prisma.js";

dotenv.config();

const SAMPLE_CONTENT = `# Master Filter — Contract — v0.10

## 1. Purpose
Extract parties, obligations, dates, and governing law from the contract corpus.

## 2. Rules
- Quote the source. Do not invent clauses.
- Prefer signed instruments over drafts.
`;

async function seed() {
  const admin = await prisma.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    console.error("No admin user. Run seedAdmin.js first.");
    process.exit(1);
  }

  const tenant =
    (await prisma.tenant.findFirst({
      where: { slug: "test", provisioningStatus: "ready" },
    })) ??
    (await prisma.tenant.findFirst({
      where: { provisioningStatus: "ready" },
      orderBy: { createdAt: "asc" },
    }));
  if (!tenant) {
    console.error("No ready tenant. Create a client first.");
    process.exit(1);
  }

  const existing = await prisma.masterFilter.findFirst({
    where: { fileName: "MasterFilterContract_01.md", sectionKey: "contract" },
  });
  if (existing) {
    console.log("Master filter seed already present. Skipping.");
    await prisma.$disconnect();
    return;
  }

  const submitter =
    (await prisma.tenantUser.findFirst({
      where: { tenantId: tenant.id, role: "owner" },
    })) ??
    (await prisma.tenantUser.findFirst({ where: { tenantId: tenant.id } }));

  const submittedByUserId =
    (submitter?.email
      ? (await prisma.user.findFirst({
          where: { email: { equals: submitter.email, mode: "insensitive" } },
        }))?.id
      : null) ?? admin.id;

  await prisma.masterFilter.create({
    data: {
      sectionKey: "contract",
      fileName: "MasterFilterContract_01.md",
      mimeType: "text/markdown",
      sizeBytes: Buffer.byteLength(SAMPLE_CONTENT),
      storageKey: "master-filters/contract/seed/MasterFilterContract_01.md",
      content: SAMPLE_CONTENT,
      version: 1,
      createdById: admin.id,
    },
  });

  await prisma.userFilter.createMany({
    data: Array.from({ length: 10 }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      const content = `## User suggestion ${n}\n\nSample filter text for contract.`;
      return {
        sectionKey: "contract",
        tenantId: tenant.id,
        submittedByUserId,
        fileName: `UserFilterContract_${n}.md`,
        mimeType: "text/markdown",
        sizeBytes: Buffer.byteLength(content),
        storageKey: `user-filters/contract/seed/UserFilterContract_${n}.md`,
        content,
        status: "PENDING",
      };
    }),
  });

  console.log(
    `Seeded 1 master filter + 10 suggestions (tenant ${tenant.slug}, admin ${admin.email}).`
  );
  await prisma.$disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
