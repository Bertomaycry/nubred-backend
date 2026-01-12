import prisma from "../lib/prisma.js";

export const saveChatHistory = async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id; // Assuming this comes from auth middleware

  // Fixed bug: Changed from "if (message)" to "if (!message)"
  if (!message) {
    return res.status(400).json({
      success: false,
      message: "Message is Required",
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  try {
    const chat = await prisma.chatHistory.create({
      data: {
        userId: userId,
        message: message,
      },
    });

    res.status(201).json({
      success: true,
      message: "History saved successfully",
      data: chat,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getAllChat = async (req, res) => {
  const userId = req.user.id; // From auth middleware

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Not Authorized",
    });
  }

  try {
    // Fixed bug: Changed from findById to findMany with where clause
    const chat = await prisma.chatHistory.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    res.status(200).json({
      success: true,
      message: "History Fetched successfully",
      data: chat,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
