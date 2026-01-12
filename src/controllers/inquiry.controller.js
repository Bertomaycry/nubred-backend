import prisma from "../lib/prisma.js";

export const createInquiry = async (req, res) => {
  const { name, email, contact, message } = req.body;

  if (!name || !email || !contact || !message) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    const inquiry = await prisma.inquiry.create({
      data: {
        name,
        email,
        contact,
        message,
      },
    });

    res.status(201).json({
      success: true,
      message: "Inquiry created successfully",
      data: inquiry,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
