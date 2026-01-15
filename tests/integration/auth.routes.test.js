import dotenv from "dotenv";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import { hashPassword } from "../../src/utils/auth.utils.js";
import { jest } from "@jest/globals";


jest.setTimeout(30000); // 30s to avoid timeouts on DB operations

// Use env if available, otherwise fallback to local test database
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "mongodb://127.0.0.1:27017/nubred-auth-test";

describe("Auth/User Routes - Integration (Prisma)", () => {
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
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL must be set in environment for tests");
    }

    // Connect to database via Prisma
    await prisma.$connect();

    // Ensure clean users collection before starting tests
    await prisma.user.deleteMany({});

    // Make sure token secrets exist (fallback for tests)
    process.env.ACCESS_TOKEN_SECRET_KEY =
      process.env.ACCESS_TOKEN_SECRET_KEY || "tekkdev_12_access";
    process.env.REFRESH_TOKEN_SECRET_KEY =
      process.env.REFRESH_TOKEN_SECRET_KEY || "tekkdev_12_refresh";
  });

  afterAll(async () => {
    // Clean up and close connection
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
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
      const hashedPw = await hashPassword("Password123!");
      await prisma.user.create({
        data: {
          firstName: "Phone",
          lastName: "Owner",
          email: "phoneowner@example.com",
          phoneNumber: "+19999999999",
          password: hashedPw,
        },
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
      const fakeId = "507f1f77bcf86cd799439011"; // Valid ObjectId format
      const res = await request(app).get(`${baseUrl}/user/${fakeId}`);

      expect(res.statusCode).toBe(200);
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
        const user = await prisma.user.findUnique({
          where: { id: createdUserId },
        });
        token = jwt.sign(
          { id: user.id, email: user.email },
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
      const hashedNormalPw = await hashPassword("NormalPass123!");
      const hashedAdminPw = await hashPassword(adminPassword);

      // Create a normal user (non-admin)
      await prisma.user.create({
        data: {
          firstName: "Normal",
          lastName: "User",
          email: "normaluser@example.com",
          phoneNumber: "+10000000002",
          password: hashedNormalPw,
          role: "user",
        },
      });

      // Create an admin user
      await prisma.user.create({
        data: {
          firstName: "Admin",
          lastName: "User",
          email: adminEmail,
          phoneNumber: "+10000000003",
          password: hashedAdminPw,
          role: "admin",
        },
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
      const hashedPw = await hashPassword("OnboardPass123!");
      const onboardingUser = await prisma.user.create({
        data: {
          firstName: "Onboard",
          lastName: "Test",
          email: "onboard@example.com",
          phoneNumber: "+10000001007",
          password: hashedPw,
        },
      });
      onboardingUserId = onboardingUser.id;
      onboardingToken = jwt.sign(
        { id: onboardingUserId, email: "onboard@example.com" },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );
    });

    const getFreshToken = () => onboardingToken;

    it("should mark user as onboarded", async () => {
      const res = await request(app)
        .post(`${baseUrl}/complete-onboarding`)
        .send({ _id: onboardingUserId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Onboarding complete");

      const user = await prisma.user.findUnique({
        where: { id: onboardingUserId },
      });
      expect(user.is_onboarded).toBe(true);
    });

    it("should mark account creation as skipped", async () => {
      const res = await request(app)
        .post(`${baseUrl}/account-creation-skipped`)
        .send({ _id: onboardingUserId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User logged in successfully");

      const user = await prisma.user.findUnique({
        where: { id: onboardingUserId },
      });
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

      const user = await prisma.user.findUnique({
        where: { id: onboardingUserId },
      });
      expect(user.unregister_requested).toBe(false);
      expect(user.unregister_scheduled_at).toBeNull();
    });

    it("should register account again (is_unregistered=false)", async () => {
      await prisma.user.update({
        where: { id: onboardingUserId },
        data: { is_unregistered: true },
      });

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
      const fakeId = "507f1f77bcf86cd799439011";

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
      const hashedAdminPw = await hashPassword("AdminPass123!");
      const hashedUserPw = await hashPassword("BanPass123!");

      const adminUser = await prisma.user.create({
        data: {
          firstName: "Admin",
          lastName: "Ban",
          email: "adminban@example.com",
          phoneNumber: "+10000001005",
          password: hashedAdminPw,
          role: "admin",
        },
      });
      adminUserId = adminUser.id;
      adminToken = jwt.sign(
        { id: adminUserId, email: "adminban@example.com" },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );

      const userToBan = await prisma.user.create({
        data: {
          firstName: "Ban",
          lastName: "Test",
          email: "bantest@example.com",
          phoneNumber: "+10000001008",
          password: hashedUserPw,
        },
      });
      userToBanId = userToBan.id;
    });

    const getFreshToken = () => adminToken;

    it("should return 400 when banning without required fields", async () => {
      const res = await request(app)
        .post(`${baseUrl}/ban-user`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    it("should return 404 when banning non-existing user", async () => {
      const res = await request(app)
        .post(`${baseUrl}/ban-user`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({
          userId: "507f1f77bcf86cd799439011",
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

      const user = await prisma.user.findUnique({
        where: { id: userToBanId },
      });
      expect(user.ban_is_banned).toBe(true);
      expect(user.ban_reason).toBe("violation");
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
        .send({ userId: "507f1f77bcf86cd799439011" });

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

      const user = await prisma.user.findUnique({
        where: { id: userToBanId },
      });
      expect(user.ban_is_banned).toBe(false);
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
          userId: "507f1f77bcf86cd799439011",
          ban: { type: "permanent", reason: "test" },
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("should update ban successfully", async () => {
      const res = await request(app)
        .post(`${baseUrl}/update-ban`)
        .set("Authorization", `Bearer ${getFreshToken()}`)
        .send({
          userId: userToBanId,
          ban: { type: "permanent", reason: "serious violation", period: 30 },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User has been banned updated");

      const user = await prisma.user.findUnique({
        where: { id: userToBanId },
      });
      expect(user.ban_is_banned).toBe(true);
      expect(user.ban_type).toBe("permanent");
      expect(user.ban_reason).toBe("serious violation");
    });
  });

  describe("DELETE /delete-user/:_id", () => {
    let userToDeleteId;
    let adminUserId;
    let adminToken;

    beforeAll(async () => {
      const hashedAdminPw = await hashPassword("AdminPass123!");
      const hashedUserPw = await hashPassword("DeletePass123!");

      const adminUser = await prisma.user.create({
        data: {
          firstName: "Admin",
          lastName: "Delete",
          email: "admindelete@example.com",
          phoneNumber: "+10000001006",
          password: hashedAdminPw,
          role: "admin",
        },
      });
      adminUserId = adminUser.id;
      adminToken = jwt.sign(
        { id: adminUserId, email: "admindelete@example.com" },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );

      const userToDelete = await prisma.user.create({
        data: {
          firstName: "Delete",
          lastName: "Me",
          email: "deleteme@example.com",
          phoneNumber: "+10000000004",
          password: hashedUserPw,
        },
      });
      userToDeleteId = userToDelete.id;
    });

    const getFreshToken = () => adminToken;

    it("should return 404 when deleting non-existing user", async () => {
      const res = await request(app)
        .delete(`${baseUrl}/delete-user/507f1f77bcf86cd799439011`)
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
      expect(res.body.data.id).toBe(userToDeleteId);

      const deleted = await prisma.user.findUnique({
        where: { id: userToDeleteId },
      });
      expect(deleted).toBeNull();
    });
  });

  describe("JWT Token Validation Tests", () => {
    let testUserId;

    beforeAll(async () => {
      const hashedPw = await hashPassword("Password123!");
      const testUser = await prisma.user.create({
        data: {
          firstName: "Token",
          lastName: "Test",
          email: "token.test@example.com",
          phoneNumber: "+10000009999",
          password: hashedPw,
        },
      });
      testUserId = testUser.id;
    });

    afterAll(async () => {
      await prisma.user.delete({ where: { id: testUserId } });
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
      const hashedPw = await hashPassword("Password123!");
      const tempUser = await prisma.user.create({
        data: {
          firstName: "Temp",
          lastName: "User",
          email: "temp.deleted@example.com",
          phoneNumber: "+10000008888",
          password: hashedPw,
        },
      });

      const validToken = jwt.sign(
        { id: tempUser.id, email: tempUser.email },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );

      await prisma.user.delete({ where: { id: tempUser.id } });

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
      const hashedPw = await hashPassword("Password123!");
      const admin = await prisma.user.create({
        data: {
          firstName: "Admin",
          lastName: "Cancel",
          email: "admin.cancel@example.com",
          phoneNumber: "+10000007777",
          password: hashedPw,
          role: "admin",
        },
      });
      adminUserId = admin.id;
      adminToken = jwt.sign(
        { id: adminUserId, email: admin.email },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "20m" }
      );
    });

    afterAll(async () => {
      await prisma.user.delete({ where: { id: adminUserId } });
    });

    it("should return 404 when canceling unregister for non-existent user", async () => {
      const fakeUserId = "507f1f77bcf86cd799439011";
      const res = await request(app)
        .post(`${baseUrl}/cancel-unregister/${fakeUserId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    it("should successfully cancel unregister for existing user", async () => {
      const hashedPw = await hashPassword("Password123!");
      const testUser = await prisma.user.create({
        data: {
          firstName: "Unregister",
          lastName: "Test",
          email: "unregister.test@example.com",
          phoneNumber: "+10000006666",
          password: hashedPw,
          unregister_requested: true,
          unregister_scheduled_at: new Date(),
        },
      });

      const res = await request(app)
        .post(`${baseUrl}/cancel-unregister/${testUser.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Unregistration canceled");
      expect(res.body.data.unregister_requested).toBe(false);
      expect(res.body.data.unregister_scheduled_at).toBeNull();

      await prisma.user.delete({ where: { id: testUser.id } });
    });
  });
});
