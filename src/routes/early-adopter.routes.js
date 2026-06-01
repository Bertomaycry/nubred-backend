import express from "express";
import { protect, isAdmin } from "../middlewares/auth.middleware.js";
import {
  subscribeEarlyAdopter,
  getEarlyAdopters,
  deleteEarlyAdopter,
} from "../controllers/early-adopter.controller.js";

const router = express.Router();

router.get("/", ...protect, isAdmin, getEarlyAdopters);
router.delete("/:id", ...protect, isAdmin, deleteEarlyAdopter);
router.post("/subscribe", subscribeEarlyAdopter);

export default router;
