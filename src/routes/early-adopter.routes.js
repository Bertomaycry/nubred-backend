import express from "express";
import { subscribeEarlyAdopter } from "../controllers/early-adopter.controller.js";

const router = express.Router();

router.post("/subscribe", subscribeEarlyAdopter);

export default router;
