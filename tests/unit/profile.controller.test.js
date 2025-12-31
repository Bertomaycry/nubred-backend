/* eslint-disable no-undef */

jest.mock("../../src/models/user.model.js", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/CompanyProfile.model.js", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock("../../src/models/ConsultantProfile.model.js", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

// import controller AFTER mocks
const {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
} = require("../../src/controllers/profile.controller.js");

// access mocked modules
const User = jest.requireMock("../../src/models/user.model.js").default;
const Company = jest.requireMock("../../src/models/CompanyProfile.model.js").default;
const Consultant = jest.requireMock("../../src/models/ConsultantProfile.model.js").default;

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

    User.findById.mockResolvedValue({ _id: "u1", profile: "p1" });

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
      _id: "u1",
      profile: null,
      account_created: false,
      profile_type: null,
      save: jest.fn().mockResolvedValue(true),
    };

    User.findById.mockResolvedValue(existingUser);

    Company.create.mockResolvedValue({
      _id: "companyProfile1",
      user: "u1",
      legal_company_name: "X",
    });

    await createUserProfile(req, res);

    expect(Company.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: "u1" })
    );

    expect(existingUser.account_created).toBe(true);
    expect(existingUser.profile_type).toBe("company");
    expect(existingUser.profile).toBe("companyProfile1");
    expect(existingUser.save).toHaveBeenCalledTimes(1);

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
      _id: "u2",
      profile: null,
      account_created: false,
      profile_type: null,
      save: jest.fn().mockResolvedValue(true),
    };

    User.findById.mockResolvedValue(existingUser);

    Consultant.create.mockResolvedValue({
      _id: "consultantProfile1",
      user: "u2",
      consultant_name: "Y",
    });

    await createUserProfile(req, res);

    expect(Consultant.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: "u2" })
    );

    expect(existingUser.account_created).toBe(true);
    expect(existingUser.profile_type).toBe("consultant");
    expect(existingUser.profile).toBe("consultantProfile1");
    expect(existingUser.save).toHaveBeenCalledTimes(1);

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

    User.findById.mockRejectedValue(new Error("db fail"));

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

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      }),
    });

    await getUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found." });
  });

  test("getUserProfile: success -> 200", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    const userDoc = {
      _id: "u1",
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      phoneNumber: "+1",
      account_created: true,
      profile_type: "company",
      profile: { _id: "p1" },
      unregister_requested: false,
    };

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(userDoc),
      }),
    });

    await getUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: {
        _id: userDoc._id,
        firstName: userDoc.firstName,
        lastName: userDoc.lastName,
        email: userDoc.email,
        phoneNumber: userDoc.phoneNumber,
        account_created: userDoc.account_created,
        profile_type: userDoc.profile_type,
        profile: userDoc.profile,
        unregister_requested: userDoc.unregister_requested,
      },
    });
  });

  test("getUserProfile: catch -> 500", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    User.findById.mockImplementation(() => {
      throw new Error("boom");
    });

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
      user: { _id: "user1" },
    };
    const res = makeRes();

    Company.findById.mockResolvedValue(null);

    await updateUserProfile(req, res);

    expect(Company.findById).toHaveBeenCalledWith("p404");
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
      user: { _id: "user1" },
    };
    const res = makeRes();

    Consultant.findById.mockResolvedValue(null);

    await updateUserProfile(req, res);

    expect(Consultant.findById).toHaveBeenCalledWith("p404");
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
      user: { _id: "user1" },
    };
    const res = makeRes();

    const mockProfile = {
      _id: "p1",
      user: { toString: () => "user1" },
      description: "updated",
    };

    Company.findById.mockResolvedValue(mockProfile);
    Company.findByIdAndUpdate.mockResolvedValue({
      _id: "p1",
      description: "updated",
    });

    await updateUserProfile(req, res);

    expect(Company.findById).toHaveBeenCalledWith("p1");
    expect(Company.findByIdAndUpdate).toHaveBeenCalledWith(
      "p1",
      { $set: { description: "updated" } },
      { new: true, runValidators: true }
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "company profile updated successfully.",
      data: { _id: "p1", description: "updated" },
    });
  });

  test("updateUserProfile: updates consultant profile -> 200", async () => {
    const req = {
      body: {
        profile_id: "p2",
        profile_type: "consultant",
        profile_data: { description: "updated" },
      },
      user: { _id: "user2" },
    };
    const res = makeRes();

    const mockProfile = {
      _id: "p2",
      user: { toString: () => "user2" },
      description: "updated",
    };

    Consultant.findById.mockResolvedValue(mockProfile);
    Consultant.findByIdAndUpdate.mockResolvedValue({
      _id: "p2",
      description: "updated",
    });

    await updateUserProfile(req, res);

    expect(Consultant.findById).toHaveBeenCalledWith("p2");
    expect(Consultant.findByIdAndUpdate).toHaveBeenCalledWith(
      "p2",
      { $set: { description: "updated" } },
      { new: true, runValidators: true }
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "consultant profile updated successfully.",
      data: { _id: "p2", description: "updated" },
    });
  });

  test("updateUserProfile: unauthorized access (different user) -> 403", async () => {
    const req = {
      body: {
        profile_id: "p1",
        profile_type: "company",
        profile_data: { description: "unauthorized update" },
      },
      user: { _id: "user1" },
    };
    const res = makeRes();

    const mockProfile = {
      _id: "p1",
      user: { toString: () => "user2" }, // Different user
    };

    Company.findById.mockResolvedValue(mockProfile);

    await updateUserProfile(req, res);

    expect(Company.findById).toHaveBeenCalledWith("p1");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized: You can only update your own profile.",
    });
    expect(Company.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("updateUserProfile: catch -> 500", async () => {
    const req = {
      body: {
        profile_id: "p1",
        profile_type: "company",
        profile_data: {},
      },
      user: { _id: "user1" },
    };
    const res = makeRes();

    const mockProfile = {
      _id: "p1",
      user: { toString: () => "user1" },
    };

    Company.findById.mockResolvedValue(mockProfile);
    Company.findByIdAndUpdate.mockRejectedValue(new Error("fail"));

    await updateUserProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Server error while updating profile.",
    });
  });
});
