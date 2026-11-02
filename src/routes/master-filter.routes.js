import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { attachTenant } from "../middlewares/tenant.middleware.js";
import { canSubmitFilters } from "../modules/master-filter/access.js";
import {
  initSuggestionUpload,
  completeSuggestionUpload,
  listSuggestions,
  withdraw,
} from "../controllers/master-filter.controller.js";

const router = express.Router();

const withTenant = [...protect, attachTenant];

const requireSubmitter = (req, res, next) => {
  if (canSubmitFilters(req.tenantUser.role)) return next();
  return res.status(403).json({
    success: false,
    message: "You do not have permission to submit filters.",
  });
};

router.post(
  "/sections/:sectionKey/suggestions/uploads",
  ...withTenant,
  requireSubmitter,
  initSuggestionUpload
);
router.post(
  "/suggestions/uploads/:uploadId/complete",
  ...withTenant,
  requireSubmitter,
  completeSuggestionUpload
);
router.get("/suggestions", ...withTenant, listSuggestions);
router.delete("/suggestions/:userFilterId", ...withTenant, withdraw);

export default router;
