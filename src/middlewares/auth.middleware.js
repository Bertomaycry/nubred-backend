import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

export const jwtVerify = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Token not provided",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token not provided",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: decoded?.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        supabaseUserId: true,
        role: true,
        refreshToken: true,
        accessToken: true,
        ban_is_banned: true,
        ban_type: true,
        ban_reason: true,
        ban_period: true,
        account_created: true,
        is_unregistered: true,
        unregister_requested: true,
        unregister_scheduled_at: true,
        is_account_created_skipped: true,
        is_onboarded: true,
        profile_type: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log(error);

    return res.status(401).json({
      success: false,
      message: "Please login to access this resource",
    });
  }
});
