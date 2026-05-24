import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";

// @desc    Create a new blog post
// @route   POST /api/blog/create
// @access  Private/Admin
export const createBlog = asyncHandler(async (req, res) => {
  const { title, content, img_url } = req.body;

  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: "Title and content are required fields.",
    });
  }

  const lastBlog = await prisma.blog.findFirst({
    orderBy: { order: 'desc' },
  });
  const newOrder = lastBlog ? lastBlog.order + 1 : 0;

  const blog = await prisma.blog.create({
    data: {
      title,
      content,
      img_url,
      order: newOrder,
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
    orderBy: { order: 'asc' },
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
  const { title, content, img_url } = req.body;

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
      content,
      img_url,
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

// @desc    Reorder blog posts
// @route   PUT /api/blog/reorder
// @access  Private/Admin
export const reorderBlogs = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body;

  if (!orderedIds || !Array.isArray(orderedIds)) {
    return res.status(400).json({
      success: false,
      message: "orderedIds array is required.",
    });
  }

  // Update all blogs in a single transaction
  const updates = orderedIds.map((id, index) => {
    return prisma.blog.update({
      where: { id },
      data: { order: index },
    });
  });

  await prisma.$transaction(updates);

  res.status(200).json({
    success: true,
    message: "Blog posts reordered successfully",
  });
});
