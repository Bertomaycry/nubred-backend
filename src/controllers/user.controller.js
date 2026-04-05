import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";
import { getSupabaseClient } from "../utils/supabase.js";
import {
  hashPassword,
  comparePassword as _comparePassword,
  generateAccessToken,
  generateRefreshToken,
} from "../utils/auth.utils.js";

// Allow tests to override comparePassword implementation
let comparePassword = _comparePassword;
export function __setComparePasswordForTests(fn) {
  comparePassword = fn;
}
export function __resetComparePasswordForTests() {
  comparePassword = _comparePassword;
}

let supabase = null;

// Test helper: allow tests to inject a supabase client
export function __setSupabaseForTests(client) {
  supabase = client;
}

export const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password } = req.body;

  try {
    // Check for existing user by email or phone number
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phoneNumber }],
      },
    });

    if (existingUser) {
      let message = "User already exists";
      if (existingUser.email === email) {
        message = "Email is already taken";
      } else if (existingUser.phoneNumber === phoneNumber) {
        message = "Phone number is already taken";
      }
      return res.status(400).json({
        success: false,
        message,
      });
    }

    // Hash password before creating user
    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phoneNumber,
        password: hashedPassword,
      },
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        _id: user.id,
        name: `${user.firstName} ${user.lastName || ""}`.trim(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        account_created: user.account_created,
        is_onboarded: user.is_onboarded,
        is_account_created_skipped: user.is_account_created_skipped,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

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

    if (user) {
      const { accessToken, refreshToken } = await generateTokens(user.id);

      // Build ban object for backward compatibility
      const ban = {
        is_banned: user.ban_is_banned,
        type: user.ban_type,
        reason: user.ban_reason,
        period: user.ban_period,
      };

      res.status(200).json({
        success: true,
        message: "Users fetched Successfully",
        data: {
          _id: user.id,
          name: `${user.firstName} ${user.lastName || ""}`.trim(),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          accessToken: accessToken || null,
          refreshToken: refreshToken || null,
          profile:
            user.companyProfile?.id ?? user.consultantProfile?.id ?? null,
          profile_type: user.profile_type,
          is_unregistered: user.is_unregistered,
          account_created: user.account_created,
          is_onboarded: user.is_onboarded,
          is_account_created_skipped: user.is_account_created_skipped,
          ban: ban,
        },
      });
    } else {
      res.status(200).json({
        success: false,
        message: "User Not Found",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

export const generateTokens = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    // Update user with new refresh token
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new Error(
      "Something went wrong while generating token: " + error.message
    );
  }
};

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  console.log("DEBUG login called", { emailPresent: !!email, passwordPresent: !!password });

  if (!email && !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide email and password",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        companyProfile: { select: { id: true } },
        consultantProfile: { select: { id: true } },
      },
    });

    console.log("DEBUG login found user", { user: !!user });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordMatched = await comparePassword(password, user.password);

    console.log("DEBUG compare result", { isPasswordMatched });

    if (!isPasswordMatched) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const { accessToken, refreshToken } = await generateTokens(user.id);

    // Build ban object for backward compatibility
    const ban = {
      is_banned: user.ban_is_banned,
      type: user.ban_type,
      reason: user.ban_reason,
      period: user.ban_period,
    };

    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      user: {
        _id: user.id,
        name: `${user.firstName} ${user.lastName || ""}`.trim(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        accessToken: accessToken || null,
        refreshToken: refreshToken || null,
        profile:
          user.companyProfile?.id ?? user.consultantProfile?.id ?? null,
        profile_type: user.profile_type,
        is_unregistered: user.is_unregistered,
        account_created: user.account_created,
        is_onboarded: user.is_onboarded,
        is_account_created_skipped: user.is_account_created_skipped,
        ban: ban,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide email and password" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Access denied: not an admin" });
  }

  const isMatch = await comparePassword(password, user.password);

  if (!isMatch) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid password" });
  }

  const { accessToken, refreshToken } = await generateTokens(user.id);

  res.status(200).json({
    success: true,
    message: "Admin logged in successfully",
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      accessToken,
      refreshToken,
    },
  });
});

export const logout = asyncHandler(async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null },
    });

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

export const handleSocialLogin = asyncHandler(async (req, res) => {
  const { accessToken: supabaseAccessToken } = req.body;

  if (!supabaseAccessToken) {
    return res.status(400).json({
      success: false,
      message: "Access token is required",
    });
  }

  try {
    // Verify Supabase token and get user using SERVICE_ROLE_KEY
    const supabaseClient = supabase || getSupabaseClient();
    const {
      data: { user: supabaseUser },
      error,
    } = await supabaseClient.auth.getUser(supabaseAccessToken);

    if (error || !supabaseUser) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // Extract user details from Supabase user
    const supabaseUserId = supabaseUser.id;
    const email = supabaseUser.email;
    const provider = supabaseUser.app_metadata?.provider || "google";
    const name =
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      email?.split("@")[0] ||
      "";

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email not found in token",
      });
    }

    // Look up user by Supabase ID first (primary identifier), then fallback to email
    let user = await prisma.user.findUnique({
      where: { supabaseUserId },
    });

    if (!user) {
      // Fallback: check by email for existing users without Supabase ID
      user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Update existing user with Supabase ID
        user = await prisma.user.update({
          where: { id: user.id },
          data: { supabaseUserId },
        });
      }
    }

    // Create new user if doesn't exist
    if (!user) {
      let firstName = "";
      let lastName = "";
      if (name) {
        const nameParts = name.split(" ");
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ") || "";
      }

      // Generate random password for OAuth users (not used for login)
      const randomPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-8);

      const hashedPassword = await hashPassword(randomPassword);

      user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          supabaseUserId,
          password: hashedPassword,
          phoneNumber: `+${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        },
      });
    }

    // Generate JWT tokens for backend session
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    user = await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
      include: {
        companyProfile: { select: { id: true } },
        consultantProfile: { select: { id: true } },
      },
    });

    // Build ban object for backward compatibility
    const ban = {
      is_banned: user.ban_is_banned,
      type: user.ban_type,
      reason: user.ban_reason,
      period: user.ban_period,
    };

    res.status(200).json({
      success: true,
      message: "Social login successful",
      user: {
        _id: user.id,
        name: `${user.firstName} ${user.lastName || ""}`.trim(),
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
        supabaseUserId: user.supabaseUserId,
        provider,
        accessToken,
        refreshToken,
        profile:
          user.companyProfile?.id ?? user.consultantProfile?.id ?? null,
        profile_type: user.profile_type,
        account_created: user.account_created,
        is_unregistered: user.is_unregistered,
        is_onboarded: user.is_onboarded,
        is_account_created_skipped: user.is_account_created_skipped,
        ban: ban,
      },
    });
  } catch (error) {
    console.error("Social login failed:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Authentication failed",
    });
  }
});

export const completeOnboarding = asyncHandler(async (req, res) => {
  const userId = req.body._id;
  try {
    await prisma.user.update({
      where: { id: userId },
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

export const accountCreationChecked = asyncHandler(async (req, res) => {
  const userId = req.body._id;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { is_account_created_skipped: true },
    });
    res.status(200).json({
      success: true,
      message: "User logged in successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

export const banUser = async (req, res) => {
  const { userId, ban } = req.body;

  if (!userId || !ban || !ban.type || !ban.reason) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

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
    message: `User has been suspended successfully`,
  });
};

export const removeBan = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "No user selected" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

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
    message: `User has been unsuspended successfully.`,
  });
};

export const updateBan = async (req, res) => {
  const { userId, ban } = req.body;

  if (!userId || !ban || !ban.type || !ban.reason) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ban_is_banned: true,
      ban_type: ban.type,
      ban_reason: ban.reason,
      ban_period: ban.period, // Note: This was ban.type in original code, which seems like a bug. Using ban.period as it should be.
    },
  });

  res.status(200).json({
    success: true,
    message: `User has been banned updated`,
  });
};

export const deleteUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params._id;
    const user = await prisma.user.delete({
      where: { id: userId },
    });

    if (user) {
      res.status(200).json({
        success: true,
        message: "Account Deleted Successfully",
        data: user,
      });
    }
  } catch (error) {
    if (error.code === "P2025") {
      // Prisma error code for record not found
      res.status(404).json({
        success: false,
        message: "User not found",
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message ?? "Something went wrong",
      });
    }
  }
});

export const registerAccount = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { is_unregistered: false },
    });

    if (user) {
      res.status(200).json({
        success: true,
        message: "Account Registered successfully",
        data: user,
      });
    }
  } catch (error) {
    if (error.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message ?? "Something went wrong",
      });
    }
  }
});

export const unregisterUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params._id;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        unregister_requested: true,
        unregister_scheduled_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ),
      },
    });

    if (user) {
      res.status(200).json({
        success: true,
        message: "Unregistration scheduled in 30 days.",
        data: user,
      });
    }
  } catch (error) {
    if (error.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message ?? "Something went wrong",
      });
    }
  }
});

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
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    throw error;
  }
});
