import { Router } from "express";
import {
  getMe,
  getUsers,
  getSingleUser,
  completeOnboarding,
  accountCreationChecked,
  banUser,
  removeBan,
  updateBan,
  deleteUser,
  unregisterUser,
  registerAccount,
  cancelUnregister,
} from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

// Current authenticated user (used by frontend on every app load)
router.get("/me", ...protect, getMe);

// User lookups
router.get("/users", ...protect, getUsers);
router.get("/user/:_id", getSingleUser);

// Onboarding / account status
router.post("/complete-onboarding", ...protect, completeOnboarding);
router.post("/account-creation-skipped", ...protect, accountCreationChecked);

// Admin: ban management
router.post("/ban-user", ...protect, banUser);
router.post("/unban", ...protect, removeBan);
router.post("/update-ban", ...protect, updateBan);

// Account management
router.delete("/delete-user/:_id", ...protect, deleteUser);
router.post("/unregister/:_id", ...protect, unregisterUser);
router.post("/cancel-unregister/:_id", ...protect, cancelUnregister);
router.post("/register-account", ...protect, registerAccount);

export default router;
