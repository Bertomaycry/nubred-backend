/* eslint-disable no-undef */
import { jest } from "@jest/globals";
import prisma from "../../src/lib/prisma.js";
import * as controller from "../../src/controllers/profile.controller.js";

const createUserProfile = controller.createUserProfile;
const getUserProfile = controller.getUserProfile;
const updateUserProfile = controller.updateUserProfile;

// Replace prisma client tables with mock functions so controller uses them
prisma.user = { findUnique: jest.fn(), update: jest.fn() };
prisma.companyProfile = {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};
prisma.consultantProfile = {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("profile.controller.js - unit tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------- createUserProfile ----------------
  test("createUserProfile: invalid profile type -> 400", async () => {
    const req = {
      body: { _id: "u1", profile_type: "invalid", profile_data: {} },
    };
    const res = makeRes();

    await createUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid profile type." });
  });

  test("createUserProfile: profile already exists -> 400", async () => {
    const req = {
      body: { _id: "u1", profile_type: "company", profile_data: {} },
    };
    const res = makeRes();

    prisma.user.findUnique.mockResolvedValue({ id: "u1", profileId: "p1" });

    await createUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Profile already exists for this user.",
    });
  });

  test("createUserProfile: creates COMPANY profile -> 201", async () => {
    const req = {
      body: {
        _id: "u1",
        profile_type: "company",
        profile_data: {
          legal_company_name: "X",
          country_of_incorporation: "AE",
          company_email: "x@x.com",
        },
      },
    };
    const res = makeRes();

    const existingUser = {
      id: "u1",
      profileId: null,
      account_created: false,
      profile_type: null,
    };

    prisma.user.findUnique.mockResolvedValue(existingUser);

    prisma.companyProfile.create.mockResolvedValue({
      id: "companyProfile1",
      userId: "u1",
      legal_company_name: "X",
    });

    prisma.user.update.mockResolvedValue({
      ...existingUser,
      account_created: true,
      profile_type: "company",
      profileId: "companyProfile1",
    });

    await createUserProfile(req, res);

    expect(prisma.companyProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u1" }),
      })
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        account_created: true,
        profile_type: "company",
        profileId: "companyProfile1",
      },
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "company profile created successfully.",
        profile_id: "companyProfile1",
      })
    );
  });

  test("createUserProfile: creates CONSULTANT profile -> 201", async () => {
    const req = {
      body: {
        _id: "u2",
        profile_type: "consultant",
        profile_data: {
          consultant_name: "Y",
          consultant_email: "y@y.com",
        },
      },
    };
    const res = makeRes();

    const existingUser = {
      id: "u2",
      profileId: null,
      account_created: false,
      profile_type: null,
    };

    prisma.user.findUnique.mockResolvedValue(existingUser);

    prisma.consultantProfile.create.mockResolvedValue({
      id: "consultantProfile1",
      userId: "u2",
      consultant_name: "Y",
    });

    prisma.user.update.mockResolvedValue({
      ...existingUser,
      account_created: true,
      profile_type: "consultant",
      profileId: "consultantProfile1",
    });

    await createUserProfile(req, res);

    expect(prisma.consultantProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u2" }),
      })
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: {
        account_created: true,
        profile_type: "consultant",
        profileId: "consultantProfile1",
      },
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "consultant profile created successfully.",
        profile_id: "consultantProfile1",
      })
    );
  });

  test("createUserProfile: catch -> 500", async () => {
    const req = {
      body: { _id: "u1", profile_type: "company", profile_data: {} },
    };
    const res = makeRes();

    prisma.user.findUnique.mockRejectedValue(new Error("db fail"));

    await createUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Server error while creating profile.",
    });
  });

  // ---------------- getUserProfile ----------------
  test("getUserProfile: user not found -> 404", async () => {
    const req = { params: { _id: "u404" } };
    const res = makeRes();

    prisma.user.findUnique.mockResolvedValue(null);

    await getUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found." });
  });

  test("getUserProfile: success -> 200", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    const userDoc = {
      id: "u1",
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      phoneNumber: "+1",
      account_created: true,
      profile_type: "company",
      profileId: "p1",
      companyProfile: {
        id: "p1",
        userId: "u1",
        legal_company_name: "Test Company",
        country_of_incorporation: "US",
        company_email: "test@company.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      unregister_requested: false,
    };

    prisma.user.findUnique.mockResolvedValue(userDoc);

    await getUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: expect.objectContaining({
        _id: userDoc.id,
        firstName: userDoc.firstName,
        lastName: userDoc.lastName,
        email: userDoc.email,
        phoneNumber: userDoc.phoneNumber,
        account_created: userDoc.account_created,
        profile_type: userDoc.profile_type,
        profile: expect.objectContaining({
          _id: "p1",
          user: "u1",
        }),
      }),
    });
  });

  test("getUserProfile: catch -> 500", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    prisma.user.findUnique.mockRejectedValue(new Error("boom"));

    await getUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Server error while fetching profile.",
    });
  });

  // ---------------- updateUserProfile ----------------
  test("updateUserProfile: invalid profile type -> 400", async () => {
    const req = {
      body: { profile_id: "p1", profile_type: "invalid", profile_data: {} },
    };
    const res = makeRes();

    await updateUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid profile type." });
  });

  test("updateUserProfile: company profile not found -> 404", async () => {
    const req = {
      body: {
        profile_id: "p404",
        profile_type: "company",
        profile_data: { description: "x" },
      },
      user: { id: "user1" },
    };
    const res = makeRes();

    prisma.companyProfile.findUnique.mockResolvedValue(null);

    await updateUserProfile(req, res);

    expect(prisma.companyProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "p404" },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "company profile not found.",
    });
  });

  test("updateUserProfile: consultant profile not found -> 404", async () => {
    const req = {
      body: {
        profile_id: "p404",
        profile_type: "consultant",
        profile_data: { description: "x" },
      },
      user: { id: "user1" },
    };
    const res = makeRes();

    prisma.consultantProfile.findUnique.mockResolvedValue(null);

    await updateUserProfile(req, res);

    expect(prisma.consultantProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "p404" },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "consultant profile not found.",
    });
  });

  test("updateUserProfile: updates company profile -> 200", async () => {
    const req = {
      body: {
        profile_id: "p1",
        profile_type: "company",
        profile_data: { description: "updated" },
      },
      user: { id: "user1" },
    };
    const res = makeRes();

    const mockProfile = {
      id: "p1",
      userId: "user1",
      description: "old",
    };

    prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
    prisma.companyProfile.update.mockResolvedValue({
      id: "p1",
      description: "updated",
    });

    await updateUserProfile(req, res);

    expect(prisma.companyProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "p1" },
    });
    expect(prisma.companyProfile.update).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "company profile updated successfully.",
      data: expect.objectContaining({ id: "p1", description: "updated" }),
    });
  });

  test("updateUserProfile: updates consultant profile -> 200", async () => {
    const req = {
      body: {
        profile_id: "p2",
        profile_type: "consultant",
        profile_data: { description: "updated" },
      },
      user: { id: "user2" },
    };
    const res = makeRes();

    const mockProfile = {
      id: "p2",
      userId: "user2",
      description: "old",
    };

    prisma.consultantProfile.findUnique.mockResolvedValue(mockProfile);
    prisma.consultantProfile.update.mockResolvedValue({
      id: "p2",
      description: "updated",
    });

    await updateUserProfile(req, res);

    expect(prisma.consultantProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "p2" },
    });
    expect(prisma.consultantProfile.update).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "consultant profile updated successfully.",
      data: expect.objectContaining({ id: "p2", description: "updated" }),
    });
  });

  test("updateUserProfile: unauthorized access (different user) -> 403", async () => {
    const req = {
      body: {
        profile_id: "p1",
        profile_type: "company",
        profile_data: { description: "unauthorized update" },
      },
      user: { id: "user1" },
    };
    const res = makeRes();

    const mockProfile = {
      id: "p1",
      userId: "user2", // Different user
    };

    prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);

    await updateUserProfile(req, res);

    expect(prisma.companyProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "p1" },
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized: You can only update your own profile.",
    });
    expect(prisma.companyProfile.update).not.toHaveBeenCalled();
  });

  test("updateUserProfile: catch -> 500", async () => {
    const req = {
      body: {
        profile_id: "p1",
        profile_type: "company",
        profile_data: {},
      },
      user: { id: "user1" },
    };
    const res = makeRes();

    const mockProfile = {
      id: "p1",
      userId: "user1",
    };

    prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);
    prisma.companyProfile.update.mockRejectedValue(new Error("fail"));

    await updateUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Server error while updating profile.",
    });
  });
});
