import { asyncHandler } from "../utils/asyncHandler.js";
import {
  listSectionSummaries,
  getSectionDetail,
  getMasterFilterById,
  getUserFilterById,
  initMasterUpload,
  completeMasterUpload,
  updateMasterFilter,
  deleteMasterFilter,
  promoteUserFilter,
  dismissUserFilter,
} from "../modules/master-filter/service.js";

const COMPLETE_TIMEOUT_MS = 60_000;

function stretchTimeout(req, res) {
  req.socket?.setTimeout(COMPLETE_TIMEOUT_MS);
  res.setTimeout?.(COMPLETE_TIMEOUT_MS);
}

export const listSections = asyncHandler(async (req, res) => {
  const data = await listSectionSummaries();
  res.status(200).json({ success: true, data });
});

export const getSection = asyncHandler(async (req, res) => {
  const data = await getSectionDetail(req.params.sectionKey, req.user.id);
  res.status(200).json({ success: true, data });
});

export const getMasterFilter = asyncHandler(async (req, res) => {
  const data = await getMasterFilterById(req.params.filterId, req.user.id);
  res.status(200).json({ success: true, data });
});

export const getUserFilter = asyncHandler(async (req, res) => {
  const data = await getUserFilterById(req.params.userFilterId, req.user.id);
  res.status(200).json({ success: true, data });
});

export const initUpload = asyncHandler(async (req, res) => {
  const data = await initMasterUpload({
    sectionKey: req.params.sectionKey,
    body: req.body,
    userId: req.user.id,
  });
  res.status(201).json({ success: true, data });
});

export const completeUpload = asyncHandler(async (req, res) => {
  stretchTimeout(req, res);
  const data = await completeMasterUpload({
    uploadId: req.params.uploadId,
    userId: req.user.id,
  });
  res.status(201).json({
    success: true,
    message: "Master filter added.",
    data,
  });
});

export const patchMasterFilter = asyncHandler(async (req, res) => {
  const data = await updateMasterFilter({
    filterId: req.params.filterId,
    body: req.body,
    userId: req.user.id,
  });
  res.status(200).json({
    success: true,
    message: "Master filter updated.",
    data,
  });
});

export const removeMasterFilter = asyncHandler(async (req, res) => {
  await deleteMasterFilter(req.params.filterId);
  res.status(200).json({
    success: true,
    message: "Master filter deleted.",
  });
});

export const promote = asyncHandler(async (req, res) => {
  stretchTimeout(req, res);
  const data = await promoteUserFilter({
    userFilterId: req.params.userFilterId,
    userId: req.user.id,
  });
  res.status(201).json({
    success: true,
    message: "This suggestion has been added to master filter",
    data,
  });
});

export const dismiss = asyncHandler(async (req, res) => {
  const data = await dismissUserFilter({
    userFilterId: req.params.userFilterId,
    userId: req.user.id,
  });
  res.status(200).json({
    success: true,
    message: "Suggestion dismissed.",
    data,
  });
});
