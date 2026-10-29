import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  attachTenant,
  requireSectionModule,
} from "../middlewares/tenant.middleware.js";
import {
  attachProject,
  requireActiveMember,
  requireProjectEditor,
  requireSectionAccess,
} from "../middlewares/project.middleware.js";
import {
  createProject,
  listProjects,
  getProject,
} from "../controllers/project.controller.js";
import {
  listMembers,
  inviteMember,
  updateMember,
  removeMember,
  acceptInvitation,
} from "../controllers/project-member.controller.js";
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

// Tenant comes from the login (tenant_users), never from the URL or body.
// Doc A: the Variety Manager runs the project (documents, extraction, edits,
// chat, members). Other roles read sections per the visibility matrix.
const withTenant = [...protect, attachTenant];
const withProject = [...withTenant, attachProject];
const withActiveMember = [...withProject, requireActiveMember];
const withProjectEdit = [...withProject, requireProjectEditor];
const withSection = [
  ...withProject,
  requireSectionAccess,
  requireSectionModule,
];
const withSectionEdit = [
  ...withProject,
  requireProjectEditor,
  requireSectionModule,
];

router.post("/", ...withTenant, createProject);
router.get("/", ...withTenant, listProjects);
router.get("/:projectId", ...withActiveMember, getProject);

// Members (VM invites, changes roles, removes; invitee accepts)
router.post("/:projectId/members/accept", ...withProject, acceptInvitation);
router.get("/:projectId/members", ...withProjectEdit, listMembers);
router.post("/:projectId/members", ...withProjectEdit, inviteMember);
router.patch("/:projectId/members/:memberId", ...withProjectEdit, updateMember);
router.delete("/:projectId/members/:memberId", ...withProjectEdit, removeMember);

router.post("/:projectId/extractions", ...withProjectEdit, startExtraction);
router.get("/:projectId/extractions", ...withProjectEdit, listExtractions);
router.get(
  "/:projectId/extractions/latest",
  ...withProjectEdit,
  getLatestExtraction
);
router.get(
  "/:projectId/extractions/:extractionRunId",
  ...withProjectEdit,
  getExtraction
);

router.post("/:projectId/documents/init-upload", ...withProjectEdit, initUpload);
router.post(
  "/:projectId/documents/:documentId/complete",
  ...withProjectEdit,
  completeUpload
);
router.get("/:projectId/documents", ...withProjectEdit, listDocuments);
router.get("/:projectId/documents/:documentId", ...withProjectEdit, getDocument);
router.get(
  "/:projectId/documents/:documentId/download",
  ...withProjectEdit,
  downloadDocument
);
router.delete("/:projectId/documents/:documentId", ...withProjectEdit, deleteDocument);

router.get("/:projectId/sections/:sectionKey", ...withSection, getSection);
router.patch(
  "/:projectId/sections/:sectionKey/fields",
  ...withSectionEdit,
  patchField
);
router.patch(
  "/:projectId/sections/:sectionKey/review-state",
  ...withSectionEdit,
  patchSectionReviewState
);
router.post(
  "/:projectId/sections/:sectionKey/confirm",
  ...withSectionEdit,
  confirmSectionHandler
);
router.post(
  "/:projectId/sections/:sectionKey/chat",
  ...withSectionEdit,
  postSectionChat
);
router.post(
  "/:projectId/sections/:sectionKey/chat/documents/init-upload",
  ...withSectionEdit,
  initUpload
);

export default router;
