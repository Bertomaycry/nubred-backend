import express from "express";
import { handleClerkWebhook } from "../controllers/webhook.controller.js";

const router = express.Router();

// Raw body parsing required for Clerk webhook signature verification.
// This route must be mounted BEFORE app.use(express.json()) in app.js.
router.post("/clerk", express.raw({ type: "application/json" }), handleClerkWebhook);

export default router;
