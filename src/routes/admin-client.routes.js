import express from "express";
import { protect, isAdmin } from "../middlewares/auth.middleware.js";
import {
  listClients,
  checkClientSlug,
  createClient,
  getClient,
  putClient,
  restrictClient,
  reactivateClient,
} from "../controllers/admin-client.controller.js";

const router = express.Router();

router.use(...protect, isAdmin);

router.get("/", listClients);
router.get("/slug-available", checkClientSlug);
router.post("/", createClient);
router.get("/:id", getClient);
router.put("/:id", putClient);
router.post("/:id/restrict", restrictClient);
router.post("/:id/reactivate", reactivateClient);

export default router;
