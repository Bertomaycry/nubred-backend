import { asyncHandler } from "../utils/asyncHandler.js";
import {
  completeFilterUpload,
  deleteUserFilter,
  getLatestUserFilter,
  initFilterUpload,
  saveUserFilterText,
  serializeProjectFilter,
} from "../modules/project/filter/project-section-filter.js";
import { startExtractionRun } from "../modules/project/extraction/start.js";
import { loadEnabledModules } from "../middlewares/tenant.middleware.js";

export const getSectionFilter = asyncHandler(async (req, res) => {
  const row = await getLatestUserFilter(
    req.db,
    req.project.id,
    req.params.sectionKey
  );
  res.status(200).json({
    success: true,
    filter: serializeProjectFilter(row),
  });
});

export const putSectionFilter = asyncHandler(async (req, res) => {
  const row = await saveUserFilterText({
    db: req.db,
    projectId: req.project.id,
    sectionKey: req.params.sectionKey,
    content: req.body?.content ?? "",
    createdById: req.user.id,
  });

  if (req.body?.reextract) {
    await startExtractionRun({
      db: req.db,
      projectId: req.project.id,
      tenantId: req.tenant.id,
      enabledModules: await loadEnabledModules(req.tenant.id),
      scope: `section:${req.params.sectionKey}`,
      sectionKey: req.params.sectionKey,
    });
  }

  res.status(200).json({
    success: true,
    filter: serializeProjectFilter(row),
  });
});

export const initSectionFilterUpload = asyncHandler(async (req, res) => {
  const { filter, upload } = await initFilterUpload({
    db: req.db,
    bucket: req.bucket,
    projectId: req.project.id,
    sectionKey: req.params.sectionKey,
    body: req.body,
    createdById: req.user.id,
  });
  res.status(201).json({
    success: true,
    filter: serializeProjectFilter(filter),
    upload,
  });
});

export const completeSectionFilterUpload = asyncHandler(async (req, res) => {
  const row = await completeFilterUpload({
    db: req.db,
    bucket: req.bucket,
    projectId: req.project.id,
    sectionKey: req.params.sectionKey,
    filterId: req.params.filterId,
  });

  if (req.body?.reextract) {
    await startExtractionRun({
      db: req.db,
      projectId: req.project.id,
      tenantId: req.tenant.id,
      enabledModules: await loadEnabledModules(req.tenant.id),
      scope: `section:${req.params.sectionKey}`,
      sectionKey: req.params.sectionKey,
    });
  }

  res.status(200).json({ success: true, filter: serializeProjectFilter(row) });
});

export const deleteSectionFilter = asyncHandler(async (req, res) => {
  const row = await deleteUserFilter(
    req.db,
    req.project.id,
    req.params.sectionKey
  );
  res.status(200).json({ success: true, filter: serializeProjectFilter(row) });
});