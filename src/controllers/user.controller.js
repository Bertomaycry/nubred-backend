import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildUserResponse = (user) => {
  const ban = {
    is_banned: user.ban_is_banned,
    type: user.ban_type,
    reason: user.ban_reason,
    period: user.ban_period,
  };

  return {
    _id: user.id,
    name: `${user.firstName} ${user.lastName || ""}`.trim(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phoneNumber: user.phoneNumber ?? null,
    clerkUserId: user.clerkUserId ?? null,
    role: user.role,
    profile: user.companyProfile?.id ?? user.consultantProfile?.id ?? null,
    profile_type: user.profile_type,
    is_unregistered: user.is_unregistered,
    account_created: user.account_created,
    is_onboarded: user.is_onboarded,
    is_account_created_skipped: user.is_account_created_skipped,
    ban,
  };
};

// ---------------------------------------------------------------------------
// GET /api/auth/me  — current authenticated user
// ---------------------------------------------------------------------------

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: buildUserResponse(req.user),
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/users  — admin: list all users
// ---------------------------------------------------------------------------

export const getUsers = asyncHandler(async (req, res) => {
  try {
    const users = await prisma.user.findMany({});
    res.status(200).json({
      success: true,
      message: "Users fetched Successfully",
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/user/:_id  — public single-user lookup
// ---------------------------------------------------------------------------

export const getSingleUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params._id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companyProfile: { select: { id: true } },
        consultantProfile: { select: { id: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User Not Found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: buildUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/complete-onboarding
// ---------------------------------------------------------------------------

export const completeOnboarding = asyncHandler(async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { is_onboarded: true },
    });
    res.status(200).json({
      success: true,
      message: "Onboarding complete",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/account-creation-skipped
// ---------------------------------------------------------------------------

export const accountCreationChecked = asyncHandler(async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { is_account_created_skipped: true },
    });
    res.status(200).json({
      success: true,
      message: "Account creation skipped",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/ban-user  (admin)
// ---------------------------------------------------------------------------

export const banUser = async (req, res) => {
  const { userId, ban } = req.body;

  if (!userId || !ban || !ban.type || !ban.reason) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ban_is_banned: true,
      ban_type: ban.type,
      ban_reason: ban.reason,
      ban_period: ban.period,
    },
  });

  res.status(200).json({
    success: true,
    message: "User has been suspended successfully",
  });
};

// ---------------------------------------------------------------------------
// POST /api/auth/unban  (admin)
// ---------------------------------------------------------------------------

export const removeBan = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "No user selected" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ban_is_banned: false,
      ban_type: null,
      ban_reason: null,
      ban_period: null,
    },
  });

  res.status(200).json({
    success: true,
    message: "User has been unsuspended successfully.",
  });
};

// ---------------------------------------------------------------------------
// POST /api/auth/update-ban  (admin)
// ---------------------------------------------------------------------------

export const updateBan = async (req, res) => {
  const { userId, ban } = req.body;

  if (!userId || !ban || !ban.type || !ban.reason) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ban_is_banned: true,
      ban_type: ban.type,
      ban_reason: ban.reason,
      ban_period: ban.period,
    },
  });

  res.status(200).json({
    success: true,
    message: "User ban updated",
  });
};

// ---------------------------------------------------------------------------
// DELETE /api/auth/delete-user/:_id  (admin)
// ---------------------------------------------------------------------------

export const deleteUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params._id;
    const user = await prisma.user.delete({ where: { id: userId } });

    res.status(200).json({
      success: true,
      message: "Account Deleted Successfully",
      data: user,
    });
  } catch (error) {
    if (error.code === "P2025") {
      res.status(404).json({ success: false, message: "User not found" });
    } else {
      res.status(500).json({
        success: false,
        message: error.message ?? "Something went wrong",
      });
    }
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/register-account
// ---------------------------------------------------------------------------

export const registerAccount = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { is_unregistered: false },
    });

    res.status(200).json({
      success: true,
      message: "Account Registered successfully",
      data: user,
    });
  } catch (error) {
    if (error.code === "P2025") {
      res.status(404).json({ success: false, message: "User not found" });
    } else {
      res.status(500).json({
        success: false,
        message: error.message ?? "Something went wrong",
      });
    }
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/unregister/:_id
// ---------------------------------------------------------------------------

export const unregisterUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params._id;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        unregister_requested: true,
        unregister_scheduled_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(200).json({
      success: true,
      message: "Unregistration scheduled in 30 days.",
      data: user,
    });
  } catch (error) {
    if (error.code === "P2025") {
      res.status(404).json({ success: false, message: "User not found" });
    } else {
      res.status(500).json({
        success: false,
        message: error.message ?? "Something went wrong",
      });
    }
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/cancel-unregister/:_id
// ---------------------------------------------------------------------------

export const cancelUnregister = asyncHandler(async (req, res) => {
  try {
    const userId = req.params._id;
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        unregister_requested: false,
        unregister_scheduled_at: null,
      },
    });

    res.json({
      success: true,
      message: "Unregistration canceled",
      data: user,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    throw error;
  }
});
