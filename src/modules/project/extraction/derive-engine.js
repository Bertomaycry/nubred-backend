import { getDeriverSections, getSection } from "../sections/registry.js";
import { listSectionRecords, ensureSectionState } from "../field-store/repository.js";

/**
 * Code-derived sections (timeline projection, project overview counts).
 * LLM milestone pass for timeline is optional via env.
 */
export async function runDeriveSections(db, projectId) {
  const derivers = getDeriverSections();
  for (const section of derivers) {
    await ensureSectionState(db, projectId, section.key);
    if (section.key === "project_overview") {
      await deriveProjectOverview(db, projectId);
    }
    if (section.key === "timeline") {
      await deriveTimelineProjection(db, projectId);
    }
  }
}

async function deriveProjectOverview(db, projectId) {
  const genotype = await listSectionRecords(db, projectId, "genotype");
  const phase = await listSectionRecords(db, projectId, "phase");
  const contract = await listSectionRecords(db, projectId, "contract");

  const root = await db.sectionRecord.findFirst({
    where: { projectId, sectionKey: "project_overview", groupPath: "", deletedAt: null },
  });
  if (!root) {
    await db.sectionRecord.create({
      data: { projectId, sectionKey: "project_overview", groupPath: "", origin: "AI" },
    });
  }

  const record =
    root ??
    (await db.sectionRecord.findFirst({
      where: { projectId, sectionKey: "project_overview", groupPath: "" },
    }));

  if (!record) return;

  const counts = {
    genotypes: genotype.filter((r) => r.groupPath).length,
    phases: phase.filter((r) => r.groupPath).length,
    contracts: contract.filter((r) => r.groupPath).length,
  };

  await upsertDerivedField(db, record.id, "genotype_count", counts.genotypes);
  await upsertDerivedField(db, record.id, "phase_count", counts.phases);
  await upsertDerivedField(db, record.id, "contract_count", counts.contracts);

  await db.sectionState.update({
    where: { projectId_sectionKey: { projectId, sectionKey: "project_overview" } },
    data: { status: "TO_REVIEW" },
  });
}

async function deriveTimelineProjection(db, projectId) {
  const section = getSection("timeline");
  let root = await db.sectionRecord.findFirst({
    where: { projectId, sectionKey: "timeline", groupPath: "", deletedAt: null },
  });
  if (!root) {
    root = await db.sectionRecord.create({
      data: { projectId, sectionKey: "timeline", groupPath: "", origin: "AI" },
    });
  }

  const contracts = await listSectionRecords(db, projectId, "contract");
  let itemIndex = 0;
  for (const record of contracts) {
    if (!record.groupPath) continue;
    const title = record.fieldValues.find((f) => f.fieldKey === "title")?.value;
    const signatureDate = record.fieldValues.find(
      (f) => f.fieldKey === "signature_date"
    )?.value;
    if (!signatureDate) continue;

    const existing = await db.sectionRecord.findFirst({
      where: {
        projectId,
        sectionKey: "timeline",
        groupPath: "items",
        sortOrder: itemIndex,
      },
    });
    const target =
      existing ??
      (await db.sectionRecord.create({
        data: {
          projectId,
          sectionKey: "timeline",
          groupPath: "items",
          sortOrder: itemIndex,
          origin: "AI",
        },
      }));

    await upsertDerivedField(db, target.id, "title", title ?? "Contract signature");
    await upsertDerivedField(db, target.id, "date", signatureDate);
    await upsertDerivedField(db, target.id, "source", "contract");
    itemIndex += 1;
  }

  await db.sectionState.update({
    where: { projectId_sectionKey: { projectId, sectionKey: "timeline" } },
    data: { status: "TO_REVIEW" },
  });
}

async function upsertDerivedField(db, recordId, fieldKey, value) {
  await db.fieldValue.upsert({
    where: { recordId_fieldKey: { recordId, fieldKey } },
    create: {
      recordId,
      fieldKey,
      value,
      status: "FOUND",
      confidence: "CONFIRMED",
      review: "ACCEPTED",
    },
    update: { value, status: "FOUND" },
  });
}

export async function markUpstreamChanged(db, projectId, sectionKey) {
  const downstream = ["phase", "protocol", "observation", "project_overview"];
  for (const key of downstream) {
    if (key === sectionKey) continue;
    await db.sectionState.updateMany({
      where: { projectId, sectionKey: key },
      data: { upstreamChangedAt: new Date() },
    });
  }
}