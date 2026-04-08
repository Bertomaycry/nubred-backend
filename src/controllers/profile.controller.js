import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";

export const createUserProfile = async (req, res) => {
  try {
    // userId comes from the authenticated session; _id in body is accepted as
    // a legacy fallback so existing clients keep working during rollout.
    const userId = req.user?.id ?? req.body._id;
    const { profile_type, profile_data } = req.body;

    if (!["company", "consultant"].includes(profile_type)) {
      return res.status(400).json({ message: "Invalid profile type." });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const [existingCompany, existingConsultant] = await Promise.all([
      prisma.companyProfile.findUnique({ where: { userId } }),
      prisma.consultantProfile.findUnique({ where: { userId } }),
    ]);

    if (existingCompany && existingConsultant) {
      return res.status(409).json({
        success: false,
        message:
          "Inconsistent profile data for this user. Please contact support.",
      });
    }

    if (existingCompany && profile_type === "consultant") {
      return res.status(400).json({
        success: false,
        message: "A company profile already exists for this user.",
      });
    }

    if (existingConsultant && profile_type === "company") {
      return res.status(400).json({
        success: false,
        message: "A consultant profile already exists for this user.",
      });
    }

    if (profile_type === "company" && existingCompany) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          account_created: true,
          profile_type: "company",
        },
      });
      return res.status(200).json({
        success: true,
        message:
          "Company profile was already present; account linked successfully.",
        profile_id: existingCompany.id,
        data: existingCompany,
      });
    }

    if (profile_type === "consultant" && existingConsultant) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          account_created: true,
          profile_type: "consultant",
        },
      });
      return res.status(200).json({
        success: true,
        message:
          "Consultant profile was already present; account linked successfully.",
        profile_id: existingConsultant.id,
        data: existingConsultant,
      });
    }

    let createdProfile;

    if (profile_type === "company") {
      const companyData = {
        userId: userId,
        legal_company_name: profile_data.legal_company_name,
        country_of_incorporation: profile_data.country_of_incorporation,
        vat_number: profile_data.vat_number,
        company_email: profile_data.company_email,
        use_signup_email: profile_data.use_signup_email ?? false,
        description: profile_data.description,
        use_signup_info: profile_data.use_signup_info ?? false,
        use_signup_phone: profile_data.use_signup_phone ?? false,
        location_address: profile_data.location?.address,
        location_postal_code: profile_data.location?.postal_code,
        location_country: profile_data.location?.country,
        legal_rep_first_name: profile_data.legal_representative?.first_name,
        legal_rep_last_name: profile_data.legal_representative?.last_name,
        legal_rep_email: profile_data.legal_representative?.email,
        legal_rep_phone_number: profile_data.legal_representative?.phone_number,
        legal_rep_whatsapp_number:
          profile_data.legal_representative?.whatsapp_number,
      };

      createdProfile = await prisma.$transaction(async (tx) => {
        const cp = await tx.companyProfile.create({ data: companyData });
        await tx.user.update({
          where: { id: userId },
          data: {
            account_created: true,
            profile_type: profile_type,
          },
        });
        return cp;
      });
    } else {
      const consultantData = {
        userId: userId,
        consultant_name: profile_data.consultant_name,
        consultant_email: profile_data.consultant_email,
        use_signup_email: profile_data.use_signup_email ?? false,
        description: profile_data.description,
        use_signup_info: profile_data.use_signup_info ?? false,
        use_signup_phone: profile_data.use_signup_phone ?? false,
        location_address: profile_data.location?.address,
        location_postal_code: profile_data.location?.postal_code,
        location_country: profile_data.location?.country,
        personal_info_first_name: profile_data.personal_info?.first_name,
        personal_info_last_name: profile_data.personal_info?.last_name,
        personal_info_email: profile_data.personal_info?.email,
        personal_info_phone_number: profile_data.personal_info?.phone_number,
      };

      createdProfile = await prisma.$transaction(async (tx) => {
        const cp = await tx.consultantProfile.create({ data: consultantData });
        await tx.user.update({
          where: { id: userId },
          data: {
            account_created: true,
            profile_type: profile_type,
          },
        });
        return cp;
      });
    }

    res.status(201).json({
      success: true,
      message: `${profile_type} profile created successfully.`,
      profile_id: createdProfile.id,
      data: createdProfile,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "A profile for this user already exists.",
      });
    }
    console.error("Error creating profile:", err);
    res.status(500).json({ message: "Server error while creating profile." });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.params._id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        account_created: true,
        profile_type: true,
        unregister_requested: true,
        companyProfile: true,
        consultantProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Build the profile object based on profile_type
    let profile = null;
    if (user.profile_type === "company" && user.companyProfile) {
      // Transform flat structure back to nested for backward compatibility
      profile = {
        _id: user.companyProfile.id,
        user: user.companyProfile.userId,
        legal_company_name: user.companyProfile.legal_company_name,
        country_of_incorporation: user.companyProfile.country_of_incorporation,
        vat_number: user.companyProfile.vat_number,
        company_email: user.companyProfile.company_email,
        use_signup_email: user.companyProfile.use_signup_email,
        description: user.companyProfile.description,
        use_signup_info: user.companyProfile.use_signup_info,
        use_signup_phone: user.companyProfile.use_signup_phone,
        location: {
          address: user.companyProfile.location_address,
          postal_code: user.companyProfile.location_postal_code,
          country: user.companyProfile.location_country,
        },
        legal_representative: {
          first_name: user.companyProfile.legal_rep_first_name,
          last_name: user.companyProfile.legal_rep_last_name,
          email: user.companyProfile.legal_rep_email,
          phone_number: user.companyProfile.legal_rep_phone_number,
          whatsapp_number: user.companyProfile.legal_rep_whatsapp_number,
        },
        createdAt: user.companyProfile.createdAt,
        updatedAt: user.companyProfile.updatedAt,
      };
    } else if (user.profile_type === "consultant" && user.consultantProfile) {
      // Transform flat structure back to nested for backward compatibility
      profile = {
        _id: user.consultantProfile.id,
        user: user.consultantProfile.userId,
        consultant_name: user.consultantProfile.consultant_name,
        consultant_email: user.consultantProfile.consultant_email,
        use_signup_email: user.consultantProfile.use_signup_email,
        description: user.consultantProfile.description,
        use_signup_info: user.consultantProfile.use_signup_info,
        use_signup_phone: user.consultantProfile.use_signup_phone,
        location: {
          address: user.consultantProfile.location_address,
          postal_code: user.consultantProfile.location_postal_code,
          country: user.consultantProfile.location_country,
        },
        personal_info: {
          first_name: user.consultantProfile.personal_info_first_name,
          last_name: user.consultantProfile.personal_info_last_name,
          email: user.consultantProfile.personal_info_email,
          phone_number: user.consultantProfile.personal_info_phone_number,
        },
        createdAt: user.consultantProfile.createdAt,
        updatedAt: user.consultantProfile.updatedAt,
      };
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        account_created: user.account_created,
        profile_type: user.profile_type,
        profile: profile,
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
      profileDoc = await prisma.companyProfile.findUnique({
        where: { id: profile_id },
      });
    } else {
      profileDoc = await prisma.consultantProfile.findUnique({
        where: { id: profile_id },
      });
    }

    if (!profileDoc) {
      return res.status(404).json({
        success: false,
        message: `${profile_type} profile not found.`,
      });
    }

    // Verify ownership: user can only update their own profile
    if (profileDoc.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You can only update your own profile.",
      });
    }

    // Now proceed with update
    let updatedProfile;
    if (profile_type === "company") {
      // Transform nested objects to flat structure for Prisma
      const updateData = {
        legal_company_name: profile_data.legal_company_name,
        country_of_incorporation: profile_data.country_of_incorporation,
        vat_number: profile_data.vat_number,
        company_email: profile_data.company_email,
        use_signup_email: profile_data.use_signup_email,
        description: profile_data.description,
        use_signup_info: profile_data.use_signup_info,
        use_signup_phone: profile_data.use_signup_phone,
        // Flatten location object
        location_address: profile_data.location?.address,
        location_postal_code: profile_data.location?.postal_code,
        location_country: profile_data.location?.country,
        // Flatten legal_representative object
        legal_rep_first_name: profile_data.legal_representative?.first_name,
        legal_rep_last_name: profile_data.legal_representative?.last_name,
        legal_rep_email: profile_data.legal_representative?.email,
        legal_rep_phone_number: profile_data.legal_representative?.phone_number,
        legal_rep_whatsapp_number:
          profile_data.legal_representative?.whatsapp_number,
      };

      // Remove undefined values
      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key]
      );

      updatedProfile = await prisma.companyProfile.update({
        where: { id: profile_id },
        data: updateData,
      });
    } else {
      // Transform nested objects to flat structure for Prisma
      const updateData = {
        consultant_name: profile_data.consultant_name,
        consultant_email: profile_data.consultant_email,
        use_signup_email: profile_data.use_signup_email,
        description: profile_data.description,
        use_signup_info: profile_data.use_signup_info,
        use_signup_phone: profile_data.use_signup_phone,
        // Flatten location object
        location_address: profile_data.location?.address,
        location_postal_code: profile_data.location?.postal_code,
        location_country: profile_data.location?.country,
        // Flatten personal_info object
        personal_info_first_name: profile_data.personal_info?.first_name,
        personal_info_last_name: profile_data.personal_info?.last_name,
        personal_info_email: profile_data.personal_info?.email,
        personal_info_phone_number: profile_data.personal_info?.phone_number,
      };

      // Remove undefined values
      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key]
      );

      updatedProfile = await prisma.consultantProfile.update({
        where: { id: profile_id },
        data: updateData,
      });
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
