import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { acceptInvitation } from "../controllers/invitation.controller.js";

const router = express.Router();

router.post("/accept", ...protect, acceptInvitation);

export default router;
