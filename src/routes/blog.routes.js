import express from "express";
import { protect, isAdmin } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  reorderBlogs,
} from "../controllers/blog.controller.js";

const router = express.Router();

// Public routes
router.get("/", getAllBlogs);
router.get("/:id", getBlogById);

// Protected Admin routes
router.post("/create", ...protect, isAdmin, upload.single("image"), createBlog);
router.put("/reorder", ...protect, isAdmin, reorderBlogs);
router.put("/:id", ...protect, isAdmin, upload.single("image"), updateBlog);
router.delete("/:id", ...protect, isAdmin, deleteBlog);

export default router;
