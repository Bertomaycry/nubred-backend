import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import { getSupabaseClient } from "../utils/supabase.js";

const supabase = getSupabaseClient();

export const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password } = req.body;

  try {
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }],
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

    const user = await User.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
    });
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
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
    const users = await User.find({});
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
    const user = await User.findById(userId);
    if (user) {
      const { accessToken, refreshToken } = await generateTokens(user._id);

      res.status(200).json({
        success: true,
        message: "Users fetched Successfully",
        data: {
          _id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          accessToken: accessToken || null,
          refreshToken: refreshToken || null,
          profile: user.profile,
          profile_type: user.profile_type,
          is_unregistered: user.is_unregistered,
          account_created: user.account_created,
          is_onboarded: user.is_onboarded,
          is_account_created_skipped: user.is_account_created_skipped,
          ban: user.ban,
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

const generateTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new Error(
      "Something went wrong while generating token: " + error.message
    );
  }
};

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email && !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide email and password",
    });
  }
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);

    if (!isPasswordMatched) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const { accessToken, refreshToken } = await generateTokens(user._id);

    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      user: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        accessToken: accessToken || null,
        refreshToken: refreshToken || null,
        profile: user.profile,
        profile_type: user.profile_type,
        is_unregistered: user.is_unregistered,
        account_created: user.account_created,
        is_onboarded: user.is_onboarded,
        is_account_created_skipped: user.is_account_created_skipped,
        ban: user.ban,
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

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Access denied: not an admin" });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid password" });
  }

  const { accessToken, refreshToken } = await generateTokens(user._id);

  res.status(200).json({
    success: true,
    message: "Admin logged in successfully",
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      accessToken,
      refreshToken,
    },
  });
});

export const logout = asyncHandler(async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      refreshToken: undefined,
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
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(supabaseAccessToken);

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
    let user = await User.findOne({ supabaseUserId });

    if (!user) {
      // Fallback: check by email for existing users without Supabase ID
      user = await User.findOne({ email });

      if (user) {
        // Update existing user with Supabase ID
        user.supabaseUserId = supabaseUserId;
        await user.save();
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

      user = await User.create({
        firstName,
        lastName,
        email,
        supabaseUserId,
        password: randomPassword,
        phoneNumber: `+${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      });
    }

    // Generate JWT tokens for backend session
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Social login successful",
      user: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
        supabaseUserId: user.supabaseUserId,
        provider,
        accessToken,
        refreshToken,
        profile: user.profile,
        profile_type: user.profile_type,
        account_created: user.account_created,
        is_unregistered: user.is_unregistered,
        is_onboarded: user.is_onboarded,
        is_account_created_skipped: user.is_account_created_skipped,
        ban: user.ban,
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
    await User.findByIdAndUpdate(userId, { is_onboarded: true });
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
    await User.findByIdAndUpdate(userId, { is_account_created_skipped: true });
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

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const banData = {
    is_banned: true,
    type: ban.type,
    reason: ban.reason,
    period: ban.period,
  };

  user.ban = banData;

  await user.save();

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

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const banData = {
    is_banned: false,
  };

  user.ban = banData;

  await user.save();

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

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const banData = {
    is_banned: true,
    type: ban.type,
    reason: ban.reason,
    period: ban.type,
  };

  user.ban = banData;

  await user.save();

  res.status(200).json({
    success: true,
    message: `User has been banned updated`,
  });
};

export const deleteUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params._id;
    const user = await User.findByIdAndDelete(userId);
    if (user) {
      res.status(200).json({
        success: true,
        message: "Account Deleted Successfully",
        data: user,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "User not found",
        data: user,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

export const registerAccount = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { is_unregistered: false },
      { new: true }
    );
    if (user) {
      res.status(200).json({
        success: true,
        message: "Account Registered successfully",
        data: user,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});
export const unregisterUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params._id;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        unregister_requested: true,
        unregister_scheduled_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ),
      },
      { new: true }
    );

    if (user) {
      res.status(200).json({
        success: true,
        message: "Unregistration scheduled in 30 days.",
        data: user,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
});

export const cancelUnregister = asyncHandler(async (req, res) => {
  const userId = req.params._id;
  const user = await User.findByIdAndUpdate(
    userId,
    { unregister_requested: false, unregister_scheduled_at: null },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.json({ success: true, message: "Unregistration canceled", data: user });
});
