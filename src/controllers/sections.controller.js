import { asyncHandler } from "../utils/asyncHandler.js";
import { getEnabledSections, getSection } from "../modules/project/sections/registry.js";
import { isSectionEnabled } from "../modules/project/access/section-modules.js";
import { loadEnabledModules } from "../middlewares/tenant.middleware.js";
import { serializeSectionList } from "../modules/project/field-store/serialize.js";
import { computeChipCounts } from "../modules/project/field-store/chip-counts.js";
import { listSectionRecords } from "../modules/project/field-store/repository.js";
import { badgeForField } from "../modules/project/field-store/status.js";
import { fieldKeysForGroup } from "../modules/project/sections/field-tree/traverse.js";
import { startExtractionRun } from "../modules/project/extraction/start.js";
import { noticeForSection } from "../modules/project/extraction/failure-message.js";
import { cascadeScope, sectionDependents } from "../modules/project/sections/dependents.js";

export const listSections = asyncHandler(async (req, res) => {
  const enabledModules = await loadEnabledModules(req.tenant.id);
  const sections = getEnabledSections().filter((s) =>
    isSectionEnabled(s.key, enabledModules)
  );

  const states = await req.db.sectionState.findMany({
    where: { projectId: req.project.id },
  });

  const countBySection = {};
  for (const section of sections) {
    const records = await listSectionRecords(req.db, req.project.id, section.key);
    const keysByGroup = new Map();
    const onGroup = (groupPath, fieldKey) => {
      const path = groupPath || "";
      if (!keysByGroup.has(path)) {
        keysByGroup.set(path, fieldKeysForGroup(section.fieldTree.children, path));
      }
      return keysByGroup.get(path).has(fieldKey);
    };
    const flat = [];
    for (const record of records) {
      for (const fv of record.fieldValues) {
        if (!onGroup(record.groupPath, fv.fieldKey)) continue;
        const open = fv.candidates?.filter((c) => c.state === "OPEN")?.length ?? 0;
        flat.push({
          fieldKey: fv.fieldKey,
          badge: badgeForField(fv, open),
          required: false,
        });
      }
    }
    countBySection[section.key] = computeChipCounts(section, flat);
  }

  const latest = await req.db.extractionRun.findFirst({
    where: { projectId: req.project.id },
    orderBy: { createdAt: "desc" },
    include: {
      steps: { select: { sectionKey: true, status: true, error: true } },
    },
  });
  const messages = {};
  for (const section of sections) {
    messages[section.key] = noticeForSection(
      latest?.steps ?? [],
      section.key,
      countBySection[section.key]?.chipCounts?.all ?? 0,
      latest?.status
    );
  }

  const enabledKeys = sections.map((s) => s.key);
  const dependents = Object.fromEntries(
    sections.map((s) => [s.key, sectionDependents(s.key, enabledKeys)])
  );

  res.status(200).json({
    success: true,
    sections: serializeSectionList(sections, states, countBySection, messages, dependents),
  });
});

export const getSectionDefinition = asyncHandler(async (req, res) => {
  const section = getSection(req.params.sectionKey);
  res.status(200).json({
    success: true,
    sectionKey: section.key,
    label: section.label,
    definition: section.definition,
    extractionPartCount: section.extractionPartCount,
  });
});

export const reextractSection = asyncHandler(async (req, res) => {
  const sectionKey = req.params.sectionKey;
  const cascade = req.body?.cascade === true;
  try {
    const run = await startExtractionRun({
      db: req.db,
      projectId: req.project.id,
      tenantId: req.tenant.id,
      enabledModules: await loadEnabledModules(req.tenant.id),
      scope: cascade ? cascadeScope(sectionKey) : `section:${sectionKey}`,
      sectionKey,
      cascade,
    });
    res.status(202).json({
      success: true,
      message: "Section re-extraction queued.",
      extraction: run,
    });
  } catch (error) {
    if (error.code === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    if (error.code === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    throw error;
  }
});