import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { attachTenant } from "../middlewares/tenant.middleware.js";
import { postHeartbeat } from "../controllers/usage.controller.js";

const router = express.Router();

router.post("/heartbeat", ...protect, attachTenant, postHeartbeat);

export default router;
