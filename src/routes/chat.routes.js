import express from "express";
import { getAllChat, saveChatHistory } from "../controllers/chat-history.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/save-history", ...protect, saveChatHistory);
router.get("/get-chat", ...protect, getAllChat);

export default router;
