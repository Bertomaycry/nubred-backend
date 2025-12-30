// 1) Make asyncHandler a passthrough so exported handlers are the real functions.
jest.mock("../../src/utils/asyncHandler.js", () => ({
  asyncHandler: (fn) => fn,
}));

// 2) Mock bcrypt (keep name prefixed with "mock" to avoid out-of-scope restriction)
const mockBcryptCompare = jest.fn();
jest.mock("bcrypt", () => ({
  __esModule: true,
  default: { compare: (...args) => mockBcryptCompare(...args) },
}));

// 3) Mock Supabase client (controller creates `supabase` at import time)
const mockSupabaseGetUser = jest.fn();
jest.mock("../../src/utils/supabase.js", () => ({
  __esModule: true,
  getSupabaseClient: () => ({
    auth: { getUser: (...args) => mockSupabaseGetUser(...args) },
  }),
}));

// 4) Mock User model methods used in controller
const mockUserModel = {
  findOne: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),

  // these 2 are used explicitly
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),

  // logout uses this
  findByIdAndUpdate: jest.fn(),
};

jest.mock("../../src/models/user.model.js", () => ({
  __esModule: true,
  default: mockUserModel,
}));

// NOW import controller after mocks
const controller = require("../../src/controllers/user.controller.js");

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("user.controller.js - full unit coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------- register ----------------
  test("register: existing user email matches -> 'Email is already taken' (missing branch)", async () => {
    const req = {
      body: {
        firstName: "A",
        lastName: "B",
        email: "same@example.com",
        phoneNumber: "+111",
        password: "pass",
      },
    };
    const res = makeRes();

    mockUserModel.findOne.mockResolvedValue({
      email: "same@example.com",
      phoneNumber: "+999",
    });

    await controller.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Email is already taken",
      })
    );
  });

  test("register: existing user phone matches -> 'Phone number is already taken' (already in report)", async () => {
    const req = {
      body: {
        firstName: "A",
        lastName: "B",
        email: "new@example.com",
        phoneNumber: "+111",
        password: "pass",
      },
    };
    const res = makeRes();

    mockUserModel.findOne.mockResolvedValue({
      email: "other@example.com",
      phoneNumber: "+111",
    });

    await controller.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Phone number is already taken" })
    );
  });

  test("register: success -> 201 response (red lines in report)", async () => {
    const req = {
      body: {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phoneNumber: "+222",
        password: "pass",
      },
    };
    const res = makeRes();

    mockUserModel.findOne.mockResolvedValue(null);
    mockUserModel.create.mockResolvedValue({
      _id: "u1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phoneNumber: "+222",
      account_created: false,
      is_onboarded: false,
      is_account_created_skipped: false,
    });

    await controller.register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "User registered successfully",
      })
    );
  });

  test("register: catch -> uses fallback 'Something went wrong' branch when error.message is nullish", async () => {
    const req = { body: { email: "x@y.com", phoneNumber: "+1" } };
    const res = makeRes();

    mockUserModel.findOne.mockRejectedValue({ message: undefined });

    await controller.register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload.message).toBe("Something went wrong");
  });

  // ---------------- getUsers ----------------
  test("getUsers: success -> 200 with users (function uncovered)", async () => {
    const req = {};
    const res = makeRes();

    mockUserModel.find.mockResolvedValue([{ _id: "u1" }]);

    await controller.getUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  test("getUsers: catch -> 500", async () => {
    const req = {};
    const res = makeRes();

    mockUserModel.find.mockRejectedValue(new Error("DB fail"));

    await controller.getUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe("DB fail");
  });

  // ---------------- getSingleUser ----------------
  test("getSingleUser: user NOT found -> returns 200 with success:false (missing else branch)", async () => {
    const req = { params: { _id: "x" } };
    const res = makeRes();

    mockUserModel.findById.mockResolvedValue(null);

    await controller.getSingleUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "User Not Found" })
    );
  });

  test("getSingleUser: catch -> 500", async () => {
    const req = { params: { _id: "x" } };
    const res = makeRes();

    mockUserModel.findById.mockRejectedValue(new Error("boom"));

    await controller.getSingleUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe("boom");
  });

  // ---------------- login ----------------
  test("login: missing email AND password -> 400 (missing branch)", async () => {
    const req = { body: {} };
    const res = makeRes();

    await controller.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe(
      "Please provide email and password"
    );
  });

  test("login: wrong password -> 400 Invalid email or password (missing branch)", async () => {
    const req = { body: { email: "a@a.com", password: "bad" } };
    const res = makeRes();

    mockUserModel.findOne.mockResolvedValue({
      _id: "u1",
      email: "a@a.com",
      password: "hashed",
    });
    mockBcryptCompare.mockResolvedValue(false);

    await controller.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe("Invalid email or password");
  });

  test("login: catch -> 500", async () => {
    const req = { body: { email: "a@a.com", password: "x" } };
    const res = makeRes();

    mockUserModel.findOne.mockRejectedValue(new Error("db crash"));

    await controller.login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe("db crash");
  });

  // ---------------- adminLogin ----------------
  test("adminLogin: missing email/password -> 400", async () => {
    const req = { body: {} };
    const res = makeRes();

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("adminLogin: user not found -> 404", async () => {
    const req = { body: { email: "x@y.com", password: "p" } };
    const res = makeRes();

    mockUserModel.findOne.mockResolvedValue(null);

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("adminLogin: not admin -> 403", async () => {
    const req = { body: { email: "x@y.com", password: "p" } };
    const res = makeRes();

    mockUserModel.findOne.mockResolvedValue({ role: "user" });

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("adminLogin: invalid password -> 400", async () => {
    const req = { body: { email: "x@y.com", password: "p" } };
    const res = makeRes();

    mockUserModel.findOne.mockResolvedValue({
      _id: "u1",
      role: "admin",
      password: "hashed",
      email: "x@y.com",
      generateAccessToken: () => "AT",
      generateRefreshToken: () => "RT",
      save: jest.fn(),
    });
    mockBcryptCompare.mockResolvedValue(false);

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("adminLogin: success -> 200", async () => {
    const req = { body: { email: "admin@y.com", password: "p" } };
    const res = makeRes();

    const adminUser = {
      _id: "u1",
      role: "admin",
      password: "hashed",
      email: "admin@y.com",
      generateAccessToken: () => "AT",
      generateRefreshToken: () => "RT",
      save: jest.fn().mockResolvedValue(true),
    };

    mockUserModel.findOne.mockResolvedValue(adminUser);
    mockBcryptCompare.mockResolvedValue(true);

    // generateTokens uses User.findById internally
    mockUserModel.findById.mockResolvedValue(adminUser);

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].user.accessToken).toBe("AT");
  });

  // ---------------- logout ----------------
  test("logout: success -> 200", async () => {
    const req = { user: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockResolvedValue(true);

    await controller.logout(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });

  test("logout: catch -> 500", async () => {
    const req = { user: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockRejectedValue(new Error("fail"));

    await controller.logout(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- handleSocialLogin (success branches) ----------------
  test("handleSocialLogin: email missing -> 400 (red block)", async () => {
    const req = { body: { accessToken: "ok" } };
    const res = makeRes();

    mockSupabaseGetUser.mockResolvedValue({
      data: {
        user: {
          id: "sb1",
          email: null,
          app_metadata: { provider: "google" },
          user_metadata: { full_name: "Test User" },
        },
      },
      error: null,
    });

    await controller.handleSocialLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe("Email not found in token");
  });

  test("handleSocialLogin: existing user by supabaseUserId -> 200", async () => {
    const req = { body: { accessToken: "ok" } };
    const res = makeRes();

    const existing = {
      _id: "u1",
      firstName: "Ex",
      lastName: "User",
      email: "ex@a.com",
      supabaseUserId: "sb1",
      generateAccessToken: () => "AT",
      generateRefreshToken: () => "RT",
      save: jest.fn().mockResolvedValue(true),
      profile: null,
      profile_type: null,
      account_created: false,
      is_unregistered: false,
      is_onboarded: false,
      is_account_created_skipped: false,
      ban: { is_banned: false },
    };

    mockSupabaseGetUser.mockResolvedValue({
      data: {
        user: {
          id: "sb1",
          email: "ex@a.com",
          app_metadata: { provider: "google" },
          user_metadata: { full_name: "Ex User" },
        },
      },
      error: null,
    });

    mockUserModel.findOne.mockResolvedValueOnce(existing); // findOne({supabaseUserId})

    await controller.handleSocialLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].user.accessToken).toBe("AT");
  });

  test("handleSocialLogin: fallback by email then updates supabaseUserId -> 200", async () => {
    const req = { body: { accessToken: "ok" } };
    const res = makeRes();

    const existingByEmail = {
      _id: "u2",
      firstName: "Email",
      lastName: "User",
      email: "email@a.com",
      supabaseUserId: null,
      generateAccessToken: () => "AT2",
      generateRefreshToken: () => "RT2",
      save: jest.fn().mockResolvedValue(true),
      profile: null,
      profile_type: null,
      account_created: false,
      is_unregistered: false,
      is_onboarded: false,
      is_account_created_skipped: false,
      ban: { is_banned: false },
    };

    mockSupabaseGetUser.mockResolvedValue({
      data: {
        user: {
          id: "sb2",
          email: "email@a.com",
          app_metadata: {}, // provider fallback
          user_metadata: { name: "Email User" }, // name fallback branch
        },
      },
      error: null,
    });

    mockUserModel.findOne
      .mockResolvedValueOnce(null) // by supabaseUserId
      .mockResolvedValueOnce(existingByEmail); // by email

    await controller.handleSocialLogin(req, res);

    expect(existingByEmail.supabaseUserId).toBe("sb2");
    expect(existingByEmail.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("handleSocialLogin: creates new user when none exists -> 200", async () => {
    const req = { body: { accessToken: "ok" } };
    const res = makeRes();

    mockSupabaseGetUser.mockResolvedValue({
      data: {
        user: {
          id: "sb3",
          email: "new@a.com",
          app_metadata: { provider: "google" },
          user_metadata: {}, // forces name to use email prefix fallback
        },
      },
      error: null,
    });

    mockUserModel.findOne.mockResolvedValue(null);

    const created = {
      _id: "u3",
      firstName: "new",
      lastName: "",
      email: "new@a.com",
      supabaseUserId: "sb3",
      generateAccessToken: () => "AT3",
      generateRefreshToken: () => "RT3",
      save: jest.fn().mockResolvedValue(true),
      profile: null,
      profile_type: null,
      account_created: false,
      is_unregistered: false,
      is_onboarded: false,
      is_account_created_skipped: false,
      ban: { is_banned: false },
    };

    mockUserModel.create.mockResolvedValue(created);

    await controller.handleSocialLogin(req, res);

    expect(mockUserModel.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("handleSocialLogin: catch -> 500", async () => {
    const req = { body: { accessToken: "ok" } };
    const res = makeRes();

    mockSupabaseGetUser.mockRejectedValue(new Error("supabase down"));

    await controller.handleSocialLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- completeOnboarding ----------------
  test("completeOnboarding: success -> 200", async () => {
    const req = { body: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockResolvedValue(true);

    await controller.completeOnboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("completeOnboarding: catch -> 500", async () => {
    const req = { body: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockRejectedValue(new Error("fail"));

    await controller.completeOnboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- accountCreationChecked ----------------
  test("accountCreationChecked: success -> 200", async () => {
    const req = { body: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockResolvedValue(true);

    await controller.accountCreationChecked(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("accountCreationChecked: catch -> 500", async () => {
    const req = { body: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockRejectedValue(new Error("fail"));

    await controller.accountCreationChecked(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- banUser / removeBan / updateBan ----------------
  test("banUser: missing required fields -> 400", async () => {
    const req = { body: {} };
    const res = makeRes();

    await controller.banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("banUser: user not found -> 404", async () => {
    const req = { body: { userId: "u1", ban: { type: "temp", reason: "x" } } };
    const res = makeRes();

    mockUserModel.findById.mockResolvedValue(null);

    await controller.banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("banUser: success -> 200", async () => {
    const req = { body: { userId: "u1", ban: { type: "temp", reason: "x" } } };
    const res = makeRes();

    const user = { ban: {}, save: jest.fn().mockResolvedValue(true) };
    mockUserModel.findById.mockResolvedValue(user);

    await controller.banUser(req, res);

    expect(user.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("removeBan: no user selected -> 400", async () => {
    const req = { body: {} };
    const res = makeRes();

    await controller.removeBan(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("removeBan: user not found -> 404", async () => {
    const req = { body: { userId: "u1" } };
    const res = makeRes();

    mockUserModel.findById.mockResolvedValue(null);

    await controller.removeBan(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("removeBan: success -> 200", async () => {
    const req = { body: { userId: "u1" } };
    const res = makeRes();

    const user = { ban: {}, save: jest.fn().mockResolvedValue(true) };
    mockUserModel.findById.mockResolvedValue(user);

    await controller.removeBan(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("updateBan: missing required fields -> 400", async () => {
    const req = { body: {} };
    const res = makeRes();

    await controller.updateBan(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("updateBan: user not found -> 404", async () => {
    const req = { body: { userId: "u1", ban: { type: "temp", reason: "x" } } };
    const res = makeRes();

    mockUserModel.findById.mockResolvedValue(null);

    await controller.updateBan(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("updateBan: success -> 200", async () => {
    const req = { body: { userId: "u1", ban: { type: "temp", reason: "x" } } };
    const res = makeRes();

    const user = { ban: {}, save: jest.fn().mockResolvedValue(true) };
    mockUserModel.findById.mockResolvedValue(user);

    await controller.updateBan(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  // ---------------- deleteUser ----------------
  test("deleteUser: success -> 200", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndDelete.mockResolvedValue({ _id: "u1" });

    await controller.deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("deleteUser: not found -> 404", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndDelete.mockResolvedValue(null);

    await controller.deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("deleteUser: catch -> 500", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndDelete.mockRejectedValue(new Error("fail"));

    await controller.deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- registerAccount ----------------
  test("registerAccount: success -> 200", async () => {
    const req = { body: { userId: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockResolvedValue({ _id: "u1" });

    await controller.registerAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("registerAccount: not found -> 404", async () => {
    const req = { body: { userId: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockResolvedValue(null);

    await controller.registerAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("registerAccount: catch -> 500", async () => {
    const req = { body: { userId: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockRejectedValue(new Error("fail"));

    await controller.registerAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- unregisterUser ----------------
  test("unregisterUser: success -> 200", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockResolvedValue({ _id: "u1" });

    await controller.unregisterUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("unregisterUser: not found -> 404", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockResolvedValue(null);

    await controller.unregisterUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("unregisterUser: catch -> 500", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockRejectedValue(new Error("fail"));

    await controller.unregisterUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- cancelUnregister ----------------
  test("cancelUnregister: returns success json", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockUserModel.findByIdAndUpdate.mockResolvedValue({ _id: "u1" });

    await controller.cancelUnregister(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Unregistration canceled" })
    );
  });
});
