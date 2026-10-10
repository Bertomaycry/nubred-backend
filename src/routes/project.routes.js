import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  attachTenant,
  requireTenantMember,
} from "../middlewares/tenant.middleware.js";
import {
  attachProject,
  requireProjectViewer,
  requireProjectEditor,
} from "../middlewares/project.middleware.js";
import {
  createProject,
  listProjects,
  getProject,
} from "../controllers/project.controller.js";
import {
  initUpload,
  completeUpload,
  listDocuments,
  getDocument,
  downloadDocument,
  deleteDocument,
} from "../controllers/document.controller.js";
import {
  startExtraction,
  listExtractions,
  getLatestExtraction,
  getExtraction,
} from "../controllers/extraction.controller.js";
import {
  getSection,
  patchField,
  patchSectionReviewState,
  confirmSectionHandler,
} from "../controllers/review.controller.js";
import { postSectionChat } from "../controllers/section-chat.controller.js";

const router = express.Router();

const withTenant = [...protect, attachTenant];
const withProjectView = [...withTenant, requireTenantMember, attachProject, requireProjectViewer];
const withProjectEdit = [...withTenant, requireTenantMember, attachProject, requireProjectEditor];

router.post("/", ...withTenant, createProject);
router.get("/", ...withTenant, listProjects);
router.get("/:projectId", ...withProjectView, getProject);

router.post("/:projectId/extractions", ...withProjectEdit, startExtraction);
router.get("/:projectId/extractions", ...withProjectView, listExtractions);
router.get(
  "/:projectId/extractions/latest",
  ...withProjectView,
  getLatestExtraction
);
router.get(
  "/:projectId/extractions/:extractionRunId",
  ...withProjectView,
  getExtraction
);

router.post("/:projectId/documents/init-upload", ...withProjectEdit, initUpload);
router.post(
  "/:projectId/documents/:documentId/complete",
  ...withProjectEdit,
  completeUpload
);
router.get("/:projectId/documents", ...withProjectView, listDocuments);
router.get("/:projectId/documents/:documentId", ...withProjectView, getDocument);
router.get(
  "/:projectId/documents/:documentId/download",
  ...withProjectView,
  downloadDocument
);
router.delete("/:projectId/documents/:documentId", ...withProjectEdit, deleteDocument);

router.get("/:projectId/sections/:sectionKey", ...withProjectView, getSection);
router.patch("/:projectId/sections/:sectionKey/fields", ...withProjectEdit, patchField);
router.patch(
  "/:projectId/sections/:sectionKey/review-state",
  ...withProjectEdit,
  patchSectionReviewState
);
router.post(
  "/:projectId/sections/:sectionKey/confirm",
  ...withProjectEdit,
  confirmSectionHandler
);
router.post(
  "/:projectId/sections/:sectionKey/chat",
  ...withProjectEdit,
  postSectionChat
);
router.post(
  "/:projectId/sections/:sectionKey/chat/documents/init-upload",
  ...withProjectEdit,
  initUpload
);

export default router;
