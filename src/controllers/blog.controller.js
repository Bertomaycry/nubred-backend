import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";

// @desc    Create a new blog post
// @route   POST /api/blog/create
// @access  Private/Admin
export const createBlog = asyncHandler(async (req, res) => {
  const { title, excerpt, content, category } = req.body;

  if (!title || !content || !category) {
    return res.status(400).json({
      success: false,
      message: "Title, content, and category are required fields.",
    });
  }

  const blog = await prisma.blog.create({
    data: {
      title,
      excerpt,
      content,
      category,
      authorId: req.user.id,
    },
  });

  res.status(201).json({
    success: true,
    message: "Blog post created successfully",
    blog,
  });
});

// @desc    Get all blog posts
// @route   GET /api/blog
// @access  Public
export const getAllBlogs = asyncHandler(async (req, res) => {
  const blogs = await prisma.blog.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  res.status(200).json({
    success: true,
    count: blogs.length,
    blogs,
  });
});

// @desc    Get a single blog post by ID
// @route   GET /api/blog/:id
// @access  Public
export const getBlogById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const blog = await prisma.blog.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog post not found",
    });
  }

  res.status(200).json({
    success: true,
    blog,
  });
});

// @desc    Update a blog post
// @route   PUT /api/blog/:id
// @access  Private/Admin
export const updateBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, excerpt, content, category } = req.body;

  const blogExists = await prisma.blog.findUnique({
    where: { id },
  });

  if (!blogExists) {
    return res.status(404).json({
      success: false,
      message: "Blog post not found",
    });
  }

  const updatedBlog = await prisma.blog.update({
    where: { id },
    data: {
      title,
      excerpt,
      content,
      category,
    },
  });

  res.status(200).json({
    success: true,
    message: "Blog post updated successfully",
    blog: updatedBlog,
  });
});

// @desc    Delete a blog post
// @route   DELETE /api/blog/:id
// @access  Private/Admin
export const deleteBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const blogExists = await prisma.blog.findUnique({
    where: { id },
  });

  if (!blogExists) {
    return res.status(404).json({
      success: false,
      message: "Blog post not found",
    });
  }

  await prisma.blog.delete({
    where: { id },
  });

  res.status(200).json({
    success: true,
    message: "Blog post deleted successfully",
  });
});
