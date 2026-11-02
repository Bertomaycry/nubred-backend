import express from "express";
import { protect, isAdmin } from "../middlewares/auth.middleware.js";
import {
  listSections,
  getSection,
  getMasterFilter,
  getUserFilter,
  initUpload,
  completeUpload,
  patchMasterFilter,
  removeMasterFilter,
  promote,
  dismiss,
} from "../controllers/admin-master-filter.controller.js";

const router = express.Router();

router.use(...protect, isAdmin);

router.get("/sections", listSections);
router.get("/sections/:sectionKey", getSection);
router.post("/sections/:sectionKey/uploads", initUpload);
router.post("/uploads/:uploadId/complete", completeUpload);

router.get("/user-filters/:userFilterId", getUserFilter);
router.post("/user-filters/:userFilterId/promote", promote);
router.post("/user-filters/:userFilterId/dismiss", dismiss);

router.get("/:filterId", getMasterFilter);
router.patch("/:filterId", patchMasterFilter);
router.delete("/:filterId", removeMasterFilter);

export default router;
