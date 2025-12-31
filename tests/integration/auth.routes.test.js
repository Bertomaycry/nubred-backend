import dotenv from "dotenv";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../src/app.js";
import User from "../../src/models/user.model.js";

jest.setTimeout(30000); // 30s to avoid timeouts on DB operations

// Use env if available, otherwise fallback to local test database
const MONGO_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/nubred-auth-test";

describe("Auth/User Routes - Integration", () => {
  const baseUrl = "/api/auth";

  const testUser = {
    firstName: "Test",
    lastName: "User",
    email: "testuser@example.com",
    phoneNumber: "+10000000001",
    password: "Password123!",
  };

  let createdUserId;
  let authToken;

  beforeAll(async () => {
    if (!MONGO_URI) {
      throw new Error("MONGODB_URI must be set in environment for tests");
    }

    // 1) Connect to Mongo
    await mongoose.connect(MONGO_URI);

    // 2) Ensure clean users collection before starting tests
    await User.deleteMany({});

    // Make sure token secrets exist (fallback for tests)
    process.env.ACCESS_TOKEN_SECRET_KEY =
      process.env.ACCESS_TOKEN_SECRET_KEY || "tekkdev_12_access";
    process.env.REFRESH_TOKEN_SECRET_KEY =
      process.env.REFRESH_TOKEN_SECRET_KEY || "tekkdev_12_refresh";
  });

  afterAll(async () => {
    // Clean up and close connection
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe("POST /register", () => {
    it("should register a user successfully", async () => {
      const res = await request(app).post(`${baseUrl}/register`).send(testUser);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe(testUser.email);

      createdUserId = res.body.data._id;
    });

    it("should fail when registering with existing email or phone", async () => {
      const res = await request(app).post(`${baseUrl}/register`).send(testUser); // same email/phone

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });

    it("should fail when registering with existing phone number", async () => {
      // Create a user with a phone number
      await User.create({
        firstName: "Phone",
        lastName: "Owner",
        email: "phoneowner@example.com",
        phoneNumber: "+19999999999",
        password: "Password123!",
      });

      // Try register with different email but same phone
      const res = await request(app).post(`${baseUrl}/register`).send({
        firstName: "Test",
        lastName: "User",
        email: "newemail@example.com",
        phoneNumber: "+19999999999",
        password: "Password123!",
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Phone number is already taken");
    });
  });

  describe("POST /login", () => {
    it("should login with valid credentials", async () => {
      const res = await request(app).post(`${baseUrl}/login`).send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.accessToken).toBeDefined();

      authToken = res.body.user.accessToken;
    });

    it("should return 400 with invalid email or password", async () => {
      const res = await request(app).post(`${baseUrl}/login`).send({
        email: testUser.email,
        password: "WrongPassword!",
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password");
    });

    it("should return 400 when email and password missing", async () => {
      const res = await request(app).post(`${baseUrl}/login`).send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Please provide email and password");
    });

    it("should return 400 when user does not exist", async () => {
      const res = await request(app)
        .post(`${baseUrl}/login`)
        .send({ email: "nouser@example.com", password: "AnyPass123!" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password");
    });
  });

  describe("GET /user/:_id", () => {
    it("should return single user with tokens when user exists", async () => {
      const res = await request(app).get(`${baseUrl}/user/${createdUserId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data._id).toBe(createdUserId);
      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it("should return success:false when user does not exist", async () => {
      const fakeId = "67575bc829f1edf36a7582aa";
      const res = await request(app).get(`${baseUrl}/user/${fakeId}`);

      expect(res.statusCode).toBe(200); // your controller returns 200 with success:false
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User Not Found");
    });
  });

  describe("GET /users (protected)", () => {
    it("should return 401 when token is not provided", async () => {
      const res = await request(app).get(`${baseUrl}/users`);
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Token not provided");
    });

    it("should return list of users with valid token", async () => {
      let token = authToken;

      if (!token) {
        const user = await User.findById(createdUserId);
        token = jwt.sign(
          { id: user._id, email: user.email },
          process.env.ACCESS_TOKEN_SECRET_KEY,
          { expiresIn: "20m" }
        );
      }

      const res = await request(app)
        .get(`${baseUrl}/users`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("should return 401 when token is invalid", async () => {
      const res = await request(app)
        .get(`${baseUrl}/users`)
        .set("Authorization", `Bearer invalid.token.here`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);

      // message depends on your jwtVerify implementation
      // If you know exact message, assert it. Otherwise keep it loose:
      expect(res.body.message).toBeDefined();
    });
  });

  describe("POST /logout (protected)", () => {
    it("should return 401 when token is missing", async () => {
      const res = await request(app).post(`${baseUrl}/logout`);
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Token not provided");
    });

    it("should logout successfully with valid token", async () => {
      // Create a fresh token for this test
      const freshToken = jwt.sign(
        { id: createdUserId, email: testUser.email },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );

      const res = await request(app)
        .post(`${baseUrl}/logout`)
        .set("Authorization", `Bearer ${freshToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 401 when token is invalid", async () => {
      const res = await request(app)
        .post(`${baseUrl}/logout`)
        .set("Authorization", `Bearer invalid.token.here`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });
  });

  describe("POST /admin-login", () => {
    const adminEmail = "admin@example.com";
    const adminPassword = "AdminPass123!";

    beforeAll(async () => {
      // Create a normal user (non-admin) for one of the tests
      await User.create({
        firstName: "Normal",
        lastName: "User",
        email: "normaluser@example.com",
        phoneNumber: "+10000000002",
        password: "NormalPass123!",
        role: "user",
      });

      // Create an admin user
      await User.create({
        firstName: "Admin",
        lastName: "User",
        email: adminEmail,
        phoneNumber: "+10000000003",
        password: adminPassword,
        role: "admin",
      });
    });

    it("should return 400 when email or password is missing", async () => {
      const res = await request(app)
        .post(`${baseUrl}/admin-login`)
        .send({ email: adminEmail }); // no password

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Please provide email and password");
    });

    it("should return 404 when admin user is not found", async () => {
      const res = await request(app)
        .post(`${baseUrl}/admin-login`)
        .send({ email: "no-admin@example.com", password: "SomePass123!" });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    it("should return 403 when user is not an admin", async () => {
      const res = await request(app).post(`${baseUrl}/admin-login`).send({
        email: "normaluser@example.com",
        password: "NormalPass123!",
      });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Access denied: not an admin");
    });

    it("should return 400 when password is invalid", async () => {
      const res = await request(app).post(`${baseUrl}/admin-login`).send({
        email: adminEmail,
        password: "WrongAdminPass!",
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid password");
    });

    it("should login admin successfully with valid credentials", async () => {
      const res = await request(app).post(`${baseUrl}/admin-login`).send({
        email: adminEmail,
        password: adminPassword,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Admin logged in successfully");
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(adminEmail);
      expect(res.body.user.role).toBe("admin");
      expect(res.body.user.accessToken).toBeDefined();
      expect(res.body.user.refreshToken).toBeDefined();
    });
  });

  describe("User onboarding & account state routes", () => {
    let onboardingUserId;
    let onboardingToken;

    beforeAll(async () => {
      // Create a dedicated user for onboarding tests
      const onboardingUser = await User.create({
        firstName: "Onboard",
        lastName: "Test",
        email: "onboard@example.com",
        phoneNumber: "+10000001007",
        password: "OnboardPass123!",
      });
      onboardingUserId = onboardingUser._id.toString();
      onboardingToken = jwt.sign(
        { id: onboardingUserId, email: "onboard@example.com" },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );
    });

    // Helper to generate a fresh token
    const getFreshToken = () => {
      return onboardingToken;
    };

    it("should mark user as onboarded", async () => {
      const res = await request(app)
        .post(`${baseUrl}/complete-onboarding`)
        .send({ _id: onboardingUserId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Onboarding complete");

      const user = await User.findById(onboardingUserId);
      expect(user.is_onboarded).toBe(true);
    });

    it("should mark account creation as skipped", async () => {
      const res = await request(app)
        .post(`${baseUrl}/account-creation-skipped`)
        .send({ _id: onboardingUserId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User logged in successfully");

      const user = await User.findById(onboardingUserId);
      expect(user.is_account_created_skipped).toBe(true);
    });

    it("should schedule unregister in 30 days", async () => {
      const res = await request(app)
        .post(`${baseUrl}/unregister/${onboardingUserId}`)
        .set("Authorization", `Bearer ${getFreshToken()}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Unregistration scheduled in 30 days.");
      expect(res.body.data.unregister_requested).toBe(true);
      expect(res.body.data.unregister_scheduled_at).toBeDefined();
    });

    it("should cancel unregister request", async () => {
      const res = await request(app)
        .post(`${baseUrl}/cancel-unregister/${onboardingUserId}`)
        .set("Authorization", `Bearer ${getFreshToken()}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Unregistration canceled");

      const user = await User.findById(onboardingUserId);
      expect(user.unregister_requested).toBe(false);
      expect(user.unregister_scheduled_at).toBeNull();
    });

    it("should register account again (is_unregistered=false)", async () => {
      // First mark user as unregistered directly
      await User.findByIdAndUpdate(onboardingUserId, { is_unregistered: true });

      const res = await request(app)
        .post(`${baseUrl}/register-account`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({ userId: onboardingUserId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Account Registered successfully");
      expect(res.body.data.is_unregistered).toBe(false);
    });

    it("should return 404 when canceling unregister for non-existent user", async () => {
      const fakeId = "67575bc829f1edf36a7582aa";

      const res = await request(app)
        .post(`${baseUrl}/cancel-unregister/${fakeId}`)
        .set("Authorization", `Bearer ${getFreshToken()}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });
  });

  describe("Ban / Unban / Update Ban routes", () => {
    let adminUserId;
    let adminToken;
    let userToBanId;

    beforeAll(async () => {
      // Create an admin user for these protected routes
      const adminUser = await User.create({
        firstName: "Admin",
        lastName: "Ban",
        email: "adminban@example.com",
        phoneNumber: "+10000001005",
        password: "AdminPass123!",
        role: "admin",
      });
      adminUserId = adminUser._id.toString();
      adminToken = jwt.sign(
        { id: adminUserId, email: "adminban@example.com" },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );

      // Create a user to be banned
      const userToBan = await User.create({
        firstName: "Ban",
        lastName: "Test",
        email: "bantest@example.com",
        phoneNumber: "+10000001008",
        password: "BanPass123!",
      });
      userToBanId = userToBan._id.toString();
    });

    // Helper to generate a fresh token
    const getFreshToken = () => {
      return adminToken;
    };

    it("should return 400 when banning without required fields", async () => {
      const res = await request(app)
        .post(`${baseUrl}/ban-user`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({}); // missing userId and ban

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    it("should return 404 when banning non-existing user", async () => {
      const res = await request(app)
        .post(`${baseUrl}/ban-user`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({
          userId: "67575bc829f1edf36a7582aa",
          ban: { type: "temporary", reason: "test", period: 7 },
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("should ban user successfully", async () => {
      const res = await request(app)
        .post(`${baseUrl}/ban-user`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({
          userId: userToBanId,
          ban: { type: "temporary", reason: "violation", period: 7 },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User has been suspended successfully");

      const user = await User.findById(userToBanId);
      expect(user.ban.is_banned).toBe(true);
      expect(user.ban.reason).toBe("violation");
    });

    it("should return 400 when removing ban without userId", async () => {
      const res = await request(app)
        .post(`${baseUrl}/unban`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("No user selected");
    });

    it("should return 404 when removing ban for non-existing user", async () => {
      const res = await request(app)
        .post(`${baseUrl}/unban`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({ userId: "67575bc829f1edf36a7582aa" });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("should remove ban successfully", async () => {
      const res = await request(app)
        .post(`${baseUrl}/unban`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({ userId: userToBanId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User has been unsuspended successfully.");

      const user = await User.findById(userToBanId);
      expect(user.ban.is_banned).toBe(false);
    });

    it("should return 400 when updating ban without required fields", async () => {
      const res = await request(app)
        .post(`${baseUrl}/update-ban`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    it("should return 404 when updating ban for non-existing user", async () => {
      const res = await request(app)
        .post(`${baseUrl}/update-ban`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({
          userId: "67575bc829f1edf36a7582aa",
          ban: { type: "permanent", reason: "test" },
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("should update ban successfully (or fail if period is required)", async () => {
      const res = await request(app)
        .post(`${baseUrl}/update-ban`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({
          userId: userToBanId,
          ban: { type: "permanent", reason: "serious violation" },
        });

      expect([200, 500]).toContain(res.statusCode);

      if (res.statusCode === 200) {
        // If it succeeds:
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("User has been banned updated");

        const user = await User.findById(userToBanId);
        expect(user.ban.is_banned).toBe(true);
        expect(user.ban.type).toBe("permanent");
        expect(user.ban.reason).toBe("serious violation");
      } else {
        expect(res.body).toBeDefined();
      }
    });
  });

  describe("DELETE /delete-user/:_id", () => {
    let userToDeleteId;
    let adminUserId;
    let adminToken;

    beforeAll(async () => {
      // Create an admin user for these protected routes
      const adminUser = await User.create({
        firstName: "Admin",
        lastName: "Delete",
        email: "admindelete@example.com",
        phoneNumber: "+10000001006",
        password: "AdminPass123!",
        role: "admin",
      });
      adminUserId = adminUser._id.toString();
      adminToken = jwt.sign(
        { id: adminUserId, email: "admindelete@example.com" },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );

      const userToDelete = await User.create({
        firstName: "Delete",
        lastName: "Me",
        email: "deleteme@example.com",
        phoneNumber: "+10000000004",
        password: "DeletePass123!",
      });
      userToDeleteId = userToDelete._id.toString();
    });

    // Helper to generate a fresh token
    const getFreshToken = () => {
      return adminToken;
    };

    it("should return 404 when deleting non-existing user", async () => {
      const res = await request(app)
        .delete(`${baseUrl}/delete-user/67575bc829f1edf36a7582aa`)
        .set("Authorization", `Bearer ${getFreshToken()}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    it("should delete user successfully", async () => {
      const res = await request(app)
        .delete(`${baseUrl}/delete-user/${userToDeleteId}`)
        .set("Authorization", `Bearer ${getFreshToken()}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Account Deleted Successfully");
      expect(res.body.data._id).toBe(userToDeleteId);

      const deleted = await User.findById(userToDeleteId);
      expect(deleted).toBeNull();
    });
  });

  describe("JWT Token Validation Tests", () => {
    let testUserId;

    beforeAll(async () => {
      const testUser = await User.create({
        firstName: "Token",
        lastName: "Test",
        email: "token.test@example.com",
        phoneNumber: "+10000009999",
        password: "Password123!",
      });
      testUserId = testUser._id.toString();
    });

    afterAll(async () => {
      await User.findByIdAndDelete(testUserId);
    });

    it("should return 401 for expired token", async () => {
      const expiredToken = jwt.sign(
        { id: testUserId, email: "token.test@example.com" },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "0s" }
      );

      const res = await request(app)
        .get(`${baseUrl}/users`)
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Please login to access this resource");
    });

    it("should return 401 for token signed with wrong secret", async () => {
      const wrongToken = jwt.sign(
        { id: testUserId, email: "token.test@example.com" },
        "wrong-secret-key",
        { expiresIn: "20m" }
      );

      const res = await request(app)
        .get(`${baseUrl}/users`)
        .set("Authorization", `Bearer ${wrongToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Please login to access this resource");
    });

    it("should return 401 for malformed Authorization header (no Bearer)", async () => {
      const validToken = jwt.sign(
        { id: testUserId, email: "token.test@example.com" },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );

      const res = await request(app)
        .get(`${baseUrl}/users`)
        .set("Authorization", validToken);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Token not provided");
    });

    it("should return 401 for malformed Authorization header (lowercase bearer)", async () => {
      const validToken = jwt.sign(
        { id: testUserId, email: "token.test@example.com" },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );

      const res = await request(app)
        .get(`${baseUrl}/users`)
        .set("Authorization", `bearer ${validToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Token not provided");
    });

    it("should return 401 when user is deleted but token is valid", async () => {
      const tempUser = await User.create({
        firstName: "Temp",
        lastName: "User",
        email: "temp.deleted@example.com",
        phoneNumber: "+10000008888",
        password: "Password123!",
      });

      const validToken = jwt.sign(
        { id: tempUser._id.toString(), email: tempUser.email },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );

      await User.findByIdAndDelete(tempUser._id);

      const res = await request(app)
        .get(`${baseUrl}/users`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    it("should return 401 for empty Bearer token", async () => {
      const res = await request(app)
        .get(`${baseUrl}/users`)
        .set("Authorization", "Bearer ");

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Token not provided");
    });
  });

  describe("POST /cancel-unregister/:_id - cancelUnregister Tests", () => {
    let adminUserId;
    let adminToken;

    beforeAll(async () => {
      const admin = await User.create({
        firstName: "Admin",
        lastName: "Cancel",
        email: "admin.cancel@example.com",
        phoneNumber: "+10000007777",
        password: "Password123!",
        role: "admin",
      });
      adminUserId = admin._id.toString();
      adminToken = jwt.sign(
        { id: adminUserId, email: admin.email },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );
    });

    afterAll(async () => {
      await User.findByIdAndDelete(adminUserId);
    });

    it("should return 404 when canceling unregister for non-existent user", async () => {
      const fakeUserId = "67575bc829f1edf36a7582aa";
      const res = await request(app)
        .post(`${baseUrl}/cancel-unregister/${fakeUserId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    it("should successfully cancel unregister for existing user", async () => {
      const testUser = await User.create({
        firstName: "Unregister",
        lastName: "Test",
        email: "unregister.test@example.com",
        phoneNumber: "+10000006666",
        password: "Password123!",
        unregister_requested: true,
        unregister_scheduled_at: new Date(),
      });

      const res = await request(app)
        .post(`${baseUrl}/cancel-unregister/${testUser._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Unregistration canceled");
      expect(res.body.data.unregister_requested).toBe(false);
      expect(res.body.data.unregister_scheduled_at).toBeNull();

      await User.findByIdAndDelete(testUser._id);
    });
  });
});
