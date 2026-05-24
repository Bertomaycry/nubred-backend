import express from "express";
import { jwtVerify, isAdmin } from "../middlewares/auth.middleware.js";
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
router.post("/create", jwtVerify, isAdmin, upload.single("image"), createBlog);
router.put("/reorder", jwtVerify, isAdmin, reorderBlogs);
router.put("/:id", jwtVerify, isAdmin, upload.single("image"), updateBlog);
router.delete("/:id", jwtVerify, isAdmin, deleteBlog);

export default router;
