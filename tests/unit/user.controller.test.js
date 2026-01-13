// 1) Make asyncHandler a passthrough so exported handlers are the real functions.
jest.mock("../../src/utils/asyncHandler.js", () => ({
  asyncHandler: (fn) => fn,
}));

// 2) Mock Supabase client (controller creates `supabase` at import time)
const mockSupabaseGetUser = jest.fn();
jest.mock("../../src/utils/supabase.js", () => ({
  __esModule: true,
  getSupabaseClient: () => ({
    auth: { getUser: (...args) => mockSupabaseGetUser(...args) },
  }),
}));

// 3) Mock auth utilities (bcrypt and password utilities)
const mockHashPassword = jest.fn();
const mockComparePassword = jest.fn();
const mockGenerateAccessToken = jest.fn();
const mockGenerateRefreshToken = jest.fn();

jest.mock("../../src/utils/auth.utils.js", () => ({
  hashPassword: (...args) => mockHashPassword(...args),
  comparePassword: (...args) => mockComparePassword(...args),
  generateAccessToken: (...args) => mockGenerateAccessToken(...args),
  generateRefreshToken: (...args) => mockGenerateRefreshToken(...args),
}));

// 4) Mock Prisma client methods used in controller
const mockPrismaUser = {
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
};

jest.mock("../../src/lib/prisma.js", () => ({
  __esModule: true,
  default: {
    user: mockPrismaUser,
  },
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

    mockPrismaUser.findFirst.mockResolvedValue({
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

    mockPrismaUser.findFirst.mockResolvedValue({
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

    mockPrismaUser.findFirst.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("hashedpass");
    mockPrismaUser.create.mockResolvedValue({
      id: "u1",
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

    mockPrismaUser.findFirst.mockRejectedValue({ message: undefined });

    await controller.register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload.message).toBe("Something went wrong");
  });

  // ---------------- getUsers ----------------
  test("getUsers: success -> 200 with users (function uncovered)", async () => {
    const req = {};
    const res = makeRes();

    mockPrismaUser.findMany.mockResolvedValue([{ id: "u1" }]);

    await controller.getUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  test("getUsers: catch -> 500", async () => {
    const req = {};
    const res = makeRes();

    mockPrismaUser.findMany.mockRejectedValue(new Error("DB fail"));

    await controller.getUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe("DB fail");
  });

  // ---------------- getSingleUser ----------------
  test("getSingleUser: success -> 200 with tokens and user data", async () => {
    const req = { params: { _id: "u-single-1" } };
    const res = makeRes();

    const baseUser = {
      id: "u-single-1",
      firstName: "Single",
      lastName: "User",
      email: "single@a.com",
      phoneNumber: "+222",
      profileId: null,
      profile_type: null,
      is_unregistered: false,
      account_created: false,
      is_onboarded: false,
      is_account_created_skipped: false,
      ban_is_banned: false,
    };

    mockPrismaUser.findUnique.mockResolvedValueOnce(baseUser); // First call in getSingleUser
    mockPrismaUser.findUnique.mockResolvedValueOnce(baseUser); // Second call in generateTokens
    mockGenerateAccessToken.mockReturnValue("ACCESS_TOKEN_SINGLE");
    mockGenerateRefreshToken.mockReturnValue("REFRESH_TOKEN_SINGLE");
    mockPrismaUser.update.mockResolvedValue(baseUser);

    await controller.getSingleUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Users fetched Successfully",
        data: expect.objectContaining({
          _id: "u-single-1",
          email: "single@a.com",
          accessToken: "ACCESS_TOKEN_SINGLE",
          refreshToken: "REFRESH_TOKEN_SINGLE",
        }),
      })
    );

    expect(mockPrismaUser.update).toHaveBeenCalled();
  });

  test("getSingleUser: user NOT found -> returns 200 with success:false (missing else branch)", async () => {
    const req = { params: { _id: "x" } };
    const res = makeRes();

    mockPrismaUser.findUnique.mockResolvedValue(null);

    await controller.getSingleUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "User Not Found" })
    );
  });

  test("getSingleUser: catch -> 500", async () => {
    const req = { params: { _id: "x" } };
    const res = makeRes();

    mockPrismaUser.findUnique.mockRejectedValue(new Error("boom"));

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

    mockPrismaUser.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@a.com",
      password: "hashed",
    });
    mockComparePassword.mockResolvedValue(false);

    await controller.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe("Invalid email or password");
  });

  test("login: catch -> 500", async () => {
    const req = { body: { email: "a@a.com", password: "x" } };
    const res = makeRes();

    mockPrismaUser.findUnique.mockRejectedValue(new Error("db crash"));

    await controller.login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe("db crash");
  });

  test("login: user not found -> 400 Invalid email or password", async () => {
    const req = { body: { email: "nouser@a.com", password: "pass" } };
    const res = makeRes();

    mockPrismaUser.findUnique.mockResolvedValue(null);

    await controller.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Invalid email or password",
      })
    );
  });

  test("login: success -> 200 with tokens", async () => {
    const req = { body: { email: "john@a.com", password: "Password123!" } };
    const res = makeRes();

    const userFromFindUnique = {
      id: "u-login-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@a.com",
      phoneNumber: "+111",
      password: "hashed",
      profileId: null,
      profile_type: null,
      is_unregistered: false,
      account_created: false,
      is_onboarded: false,
      is_account_created_skipped: false,
      ban_is_banned: false,
    };

    mockPrismaUser.findUnique.mockResolvedValue(userFromFindUnique);
    mockComparePassword.mockResolvedValue(true);
    mockGenerateAccessToken.mockReturnValue("ACCESS_TOKEN");
    mockGenerateRefreshToken.mockReturnValue("REFRESH_TOKEN");
    mockPrismaUser.update.mockResolvedValue(userFromFindUnique);

    await controller.login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "User logged in successfully",
        user: expect.objectContaining({
          email: "john@a.com",
          accessToken: "ACCESS_TOKEN",
          refreshToken: "REFRESH_TOKEN",
        }),
      })
    );

    expect(mockPrismaUser.update).toHaveBeenCalled();
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

    mockPrismaUser.findUnique.mockResolvedValue(null);

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("adminLogin: not admin -> 403", async () => {
    const req = { body: { email: "x@y.com", password: "p" } };
    const res = makeRes();

    mockPrismaUser.findUnique.mockResolvedValue({ role: "user" });

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("adminLogin: invalid password -> 400", async () => {
    const req = { body: { email: "x@y.com", password: "p" } };
    const res = makeRes();

    mockPrismaUser.findUnique.mockResolvedValue({
      id: "u1",
      role: "admin",
      password: "hashed",
      email: "x@y.com",
    });
    mockComparePassword.mockResolvedValue(false);

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("adminLogin: success -> 200", async () => {
    const req = { body: { email: "admin@y.com", password: "p" } };
    const res = makeRes();

    const adminUser = {
      id: "u1",
      role: "admin",
      password: "hashed",
      email: "admin@y.com",
    };

    mockPrismaUser.findUnique.mockResolvedValue(adminUser);
    mockComparePassword.mockResolvedValue(true);
    mockGenerateAccessToken.mockReturnValue("AT");
    mockGenerateRefreshToken.mockReturnValue("RT");
    mockPrismaUser.update.mockResolvedValue(adminUser);

    await controller.adminLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].user.accessToken).toBe("AT");
  });

  // ---------------- logout ----------------
  test("logout: success -> 200", async () => {
    const req = { user: { id: "u1" } };
    const res = makeRes();

    mockPrismaUser.update.mockResolvedValue(true);

    await controller.logout(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });

  test("logout: catch -> 500", async () => {
    const req = { user: { id: "u1" } };
    const res = makeRes();

    mockPrismaUser.update.mockRejectedValue(new Error("fail"));

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
      id: "u1",
      firstName: "Ex",
      lastName: "User",
      email: "ex@a.com",
      supabaseUserId: "sb1",
      profileId: null,
      profile_type: null,
      account_created: false,
      is_unregistered: false,
      is_onboarded: false,
      is_account_created_skipped: false,
      ban_is_banned: false,
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

    mockPrismaUser.findFirst.mockResolvedValueOnce(existing);
    mockGenerateAccessToken.mockReturnValue("AT");
    mockGenerateRefreshToken.mockReturnValue("RT");
    mockPrismaUser.update.mockResolvedValue({ ...existing, refreshToken: "RT" });

    await controller.handleSocialLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].user.accessToken).toBe("AT");
  });

  test("handleSocialLogin: fallback by email then updates supabaseUserId -> 200", async () => {
    const req = { body: { accessToken: "ok" } };
    const res = makeRes();

    const existingByEmail = {
      id: "u2",
      firstName: "Email",
      lastName: "User",
      email: "email@a.com",
      supabaseUserId: null,
      profileId: null,
      profile_type: null,
      account_created: false,
      is_unregistered: false,
      is_onboarded: false,
      is_account_created_skipped: false,
      ban_is_banned: false,
    };

    mockSupabaseGetUser.mockResolvedValue({
      data: {
        user: {
          id: "sb2",
          email: "email@a.com",
          app_metadata: {},
          user_metadata: { name: "Email User" },
        },
      },
      error: null,
    });

    mockPrismaUser.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingByEmail);
    mockGenerateAccessToken.mockReturnValue("AT2");
    mockGenerateRefreshToken.mockReturnValue("RT2");
    mockPrismaUser.update.mockResolvedValue({ ...existingByEmail, supabaseUserId: "sb2" });

    await controller.handleSocialLogin(req, res);

    expect(mockPrismaUser.update).toHaveBeenCalled();
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
          user_metadata: {},
        },
      },
      error: null,
    });

    mockPrismaUser.findUnique.mockResolvedValueOnce(null); // First call by supabaseUserId
    mockPrismaUser.findUnique.mockResolvedValueOnce(null); // Second call by email

    const created = {
      id: "u3",
      firstName: "new",
      lastName: "",
      email: "new@a.com",
      supabaseUserId: "sb3",
      profileId: null,
      profile_type: null,
      account_created: false,
      is_unregistered: false,
      is_onboarded: false,
      is_account_created_skipped: false,
      ban_is_banned: false,
    };

    mockPrismaUser.create.mockResolvedValue(created);
    mockGenerateAccessToken.mockReturnValue("AT3");
    mockGenerateRefreshToken.mockReturnValue("RT3");
    mockPrismaUser.update.mockResolvedValue({ ...created, refreshToken: "RT3" });

    await controller.handleSocialLogin(req, res);

    expect(mockPrismaUser.create).toHaveBeenCalled();
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

    mockPrismaUser.update.mockResolvedValue(true);

    await controller.completeOnboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("completeOnboarding: catch -> 500", async () => {
    const req = { body: { _id: "u1" } };
    const res = makeRes();

    mockPrismaUser.update.mockRejectedValue(new Error("fail"));

    await controller.completeOnboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- accountCreationChecked ----------------
  test("accountCreationChecked: success -> 200", async () => {
    const req = { body: { _id: "u1" } };
    const res = makeRes();

    mockPrismaUser.update.mockResolvedValue(true);

    await controller.accountCreationChecked(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("accountCreationChecked: catch -> 500", async () => {
    const req = { body: { _id: "u1" } };
    const res = makeRes();

    mockPrismaUser.update.mockRejectedValue(new Error("fail"));

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

    mockPrismaUser.findUnique.mockResolvedValue(null);

    await controller.banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("banUser: success -> 200", async () => {
    const req = { body: { userId: "u1", ban: { type: "temp", reason: "x" } } };
    const res = makeRes();

    const user = { id: "u1", ban_is_banned: false };
    mockPrismaUser.findUnique.mockResolvedValue(user);
    mockPrismaUser.update.mockResolvedValue(user);

    await controller.banUser(req, res);

    expect(mockPrismaUser.update).toHaveBeenCalled();
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

    mockPrismaUser.findUnique.mockResolvedValue(null);

    await controller.removeBan(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("removeBan: success -> 200", async () => {
    const req = { body: { userId: "u1" } };
    const res = makeRes();

    const user = { id: "u1", ban_is_banned: true };
    mockPrismaUser.findUnique.mockResolvedValue(user);
    mockPrismaUser.update.mockResolvedValue(user);

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

    mockPrismaUser.findUnique.mockResolvedValue(null);

    await controller.updateBan(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("updateBan: success -> 200", async () => {
    const req = { body: { userId: "u1", ban: { type: "temp", reason: "x" } } };
    const res = makeRes();

    const user = { id: "u1", ban_is_banned: true };
    mockPrismaUser.findUnique.mockResolvedValue(user);
    mockPrismaUser.update.mockResolvedValue(user);

    await controller.updateBan(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  // ---------------- deleteUser ----------------
  test("deleteUser: success -> 200", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockPrismaUser.delete.mockResolvedValue({ id: "u1" });

    await controller.deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("deleteUser: not found -> 404", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    const notFoundError = new Error("Record not found");
    notFoundError.code = "P2025";
    mockPrismaUser.delete.mockRejectedValue(notFoundError);

    await controller.deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("deleteUser: catch -> 500", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockPrismaUser.delete.mockRejectedValue(new Error("fail"));

    await controller.deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- registerAccount ----------------
  test("registerAccount: success -> 200", async () => {
    const req = { body: { userId: "u1" } };
    const res = makeRes();

    mockPrismaUser.update.mockResolvedValue({ id: "u1" });

    await controller.registerAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("registerAccount: not found -> 404", async () => {
    const req = { body: { userId: "u1" } };
    const res = makeRes();

    const notFoundError = new Error("Record not found");
    notFoundError.code = "P2025";
    mockPrismaUser.update.mockRejectedValue(notFoundError);

    await controller.registerAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("registerAccount: catch -> 500", async () => {
    const req = { body: { userId: "u1" } };
    const res = makeRes();

    mockPrismaUser.update.mockRejectedValue(new Error("fail"));

    await controller.registerAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- unregisterUser ----------------
  test("unregisterUser: success -> 200", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockPrismaUser.update.mockResolvedValue({ id: "u1" });

    await controller.unregisterUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("unregisterUser: not found -> 404", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    const notFoundError = new Error("Record not found");
    notFoundError.code = "P2025";
    mockPrismaUser.update.mockRejectedValue(notFoundError);

    await controller.unregisterUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("unregisterUser: catch -> 500", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockPrismaUser.update.mockRejectedValue(new Error("fail"));

    await controller.unregisterUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ---------------- cancelUnregister ----------------
  test("cancelUnregister: returns success json", async () => {
    const req = { params: { _id: "u1" } };
    const res = makeRes();

    mockPrismaUser.update.mockResolvedValue({ id: "u1" });

    await controller.cancelUnregister(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Unregistration canceled",
      })
    );
  });

  test("cancelUnregister: user not found -> 404", async () => {
    const req = { params: { _id: "u404" } };
    const res = makeRes();

    const notFoundError = new Error("Record not found");
    notFoundError.code = "P2025";
    mockPrismaUser.update.mockRejectedValue(notFoundError);

    await controller.cancelUnregister(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "User not found",
    });
  });
});
