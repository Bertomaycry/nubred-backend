import Company from "../models/CompanyProfile.model.js";
import Consultant from "../models/ConsultantProfile.model.js";
import User from "../models/user.model.js";

export const createUserProfile = async (req, res) => {
  try {
    const userId = req.body._id;

    const { profile_type, profile_data } = req.body;

    if (!["company", "consultant"].includes(profile_type)) {
      return res.status(400).json({ message: "Invalid profile type." });
    }

    const existingUser = await User.findById(userId);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (existingUser.profile) {
      return res.status(400).json({
        success: false,
        message: "Profile already exists for this user.",
      });
    }

    let createdProfile;

    if (profile_type === "company") {
      createdProfile = await Company.create({
        user: userId,
        ...profile_data,
      });
    } else {
      createdProfile = await Consultant.create({
        user: userId,
        ...profile_data,
      });
    }

    existingUser.account_created = true;
    existingUser.profile_type = profile_type;
    existingUser.profile = createdProfile._id;
    await existingUser.save();

    res.status(201).json({
      success: true,
      message: `${profile_type} profile created successfully.`,
      profile_id: createdProfile._id,
      data: createdProfile,
    });
  } catch (err) {
    console.error("Error creating profile:", err);
    res.status(500).json({ message: "Server error while creating profile." });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.params._id;
    const user = await User.findById(userId)
      .select("-password -refreshToken")
      .populate("profile");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        account_created: user.account_created,
        profile_type: user.profile_type,
        profile: user.profile,
        unregister_requested: user.unregister_requested,
      },
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ message: "Server error while fetching profile." });
  }
};


export const updateUserProfile = async (req, res) => {
  try {
    const { profile_id, profile_type, profile_data } = req.body;
    if (!["company", "consultant"].includes(profile_type)) {
      return res.status(400).json({ message: "Invalid profile type." });
    }

    // First, fetch the profile to verify ownership
    let profileDoc;
    if (profile_type === "company") {
      profileDoc = await Company.findById(profile_id);
    } else {
      profileDoc = await Consultant.findById(profile_id);
    }

    if (!profileDoc) {
      return res.status(404).json({
        success: false,
        message: `${profile_type} profile not found.`,
      });
    }

    // Verify ownership: user can only update their own profile
    if (profileDoc.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You can only update your own profile.",
      });
    }

    // Now proceed with update
    let updatedProfile;
    if (profile_type === "company") {
      updatedProfile = await Company.findByIdAndUpdate(
        profile_id,
        { $set: profile_data },
        { new: true, runValidators: true }
      );
    } else {
      updatedProfile = await Consultant.findByIdAndUpdate(
        profile_id,
        { $set: profile_data },
        { new: true, runValidators: true }
      );
    }

    res.status(200).json({
      success: true,
      message: `${profile_type} profile updated successfully.`,
      data: updatedProfile,
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ message: "Server error while updating profile." });
  }
};
