import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
} from "../controllers/profile.controller.js";

const router = express.Router();

router.post("/create", ...protect, createUserProfile);
router.put("/update-profile", ...protect, updateUserProfile);
router.get("/user-profile/:_id", getUserProfile);

export default router;
