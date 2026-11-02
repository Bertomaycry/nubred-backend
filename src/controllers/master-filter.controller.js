import { asyncHandler } from "../utils/asyncHandler.js";
import {
  initUserUpload,
  completeUserUpload,
  listTenantSuggestions,
  withdrawSuggestion,
} from "../modules/master-filter/service.js";

const COMPLETE_TIMEOUT_MS = 60_000;

function stretchTimeout(req, res) {
  req.socket?.setTimeout(COMPLETE_TIMEOUT_MS);
  res.setTimeout?.(COMPLETE_TIMEOUT_MS);
}

export const initSuggestionUpload = asyncHandler(async (req, res) => {
  const data = await initUserUpload({
    sectionKey: req.params.sectionKey,
    body: req.body,
    userId: req.user.id,
    tenant: req.tenant,
  });
  res.status(201).json({ success: true, data });
});

export const completeSuggestionUpload = asyncHandler(async (req, res) => {
  stretchTimeout(req, res);
  const data = await completeUserUpload({
    uploadId: req.params.uploadId,
    userId: req.user.id,
    tenant: req.tenant,
  });
  res.status(201).json({
    success: true,
    message: "Suggestion submitted.",
    data,
  });
});

export const listSuggestions = asyncHandler(async (req, res) => {
  const sectionKey =
    typeof req.query.sectionKey === "string" && req.query.sectionKey.trim()
      ? req.query.sectionKey.trim()
      : undefined;
  const data = await listTenantSuggestions({
    tenant: req.tenant,
    sectionKey,
    currentUserId: req.user.id,
  });
  res.status(200).json({ success: true, data });
});

export const withdraw = asyncHandler(async (req, res) => {
  await withdrawSuggestion({
    userFilterId: req.params.userFilterId,
    tenant: req.tenant,
    userId: req.user.id,
    tenantRole: req.tenantUser.role,
  });
  res.status(200).json({
    success: true,
    message: "Suggestion withdrawn.",
  });
});
