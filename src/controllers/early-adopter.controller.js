import prisma from "../lib/prisma.js";
import { sendEarlyAdopterConfirmation } from "../lib/resend.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const subscribeEarlyAdopter = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address",
    });
  }

  try {
    const existing = await prisma.earlyAdopter.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "You're already on the early adopter list",
      });
    }

    const earlyAdopter = await prisma.earlyAdopter.create({
      data: { email: normalizedEmail },
    });

    try {
      await sendEarlyAdopterConfirmation(normalizedEmail);
    } catch (emailError) {
      await prisma.earlyAdopter.delete({ where: { id: earlyAdopter.id } });
      throw emailError;
    }

    res.status(201).json({
      success: true,
      message: "Thanks for signing up! Check your inbox for a confirmation email.",
      data: { id: earlyAdopter.id, email: earlyAdopter.email },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to complete signup. Please try again later.",
      error: error.message,
    });
  }
};
