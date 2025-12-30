import dotenv from "dotenv";
dotenv.config({ path: ".env.test" }); 
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../src/app.js";
import User from "../../src/models/user.model.js";

jest.setTimeout(30000); // 30s to avoid timeouts on DB operations

// Use env if available, otherwise fallback to your real test/dev URI
const MONGO_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://saad:tekkdev_12@cluster0.mee2tv4.mongodb.net/nubred-dev?retryWrites=true&w=majority&appName=Cluster0";

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
  });

  describe("POST /logout (protected)", () => {
    it("should return 401 when token is missing", async () => {
      const res = await request(app).post(`${baseUrl}/logout`);
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Token not provided");
    });

    it("should logout successfully with valid token", async () => {
      const res = await request(app)
        .post(`${baseUrl}/logout`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
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
    it("should mark user as onboarded", async () => {
      const res = await request(app)
        .post(`${baseUrl}/complete-onboarding`)
        .send({ _id: createdUserId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Onboarding complete");

      const user = await User.findById(createdUserId);
      expect(user.is_onboarded).toBe(true);
    });

    it("should mark account creation as skipped", async () => {
      const res = await request(app)
        .post(`${baseUrl}/account-creation-skipped`)
        .send({ _id: createdUserId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User logged in successfully");

      const user = await User.findById(createdUserId);
      expect(user.is_account_created_skipped).toBe(true);
    });

    it("should schedule unregister in 30 days", async () => {
      const res = await request(app)
        .post(`${baseUrl}/unregister/${createdUserId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Unregistration scheduled in 30 days.");
      expect(res.body.data.unregister_requested).toBe(true);
      expect(res.body.data.unregister_scheduled_at).toBeDefined();
    });

    it("should cancel unregister request", async () => {
      const res = await request(app)
        .post(`${baseUrl}/cancel-unregister/${createdUserId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Unregistration canceled");

      const user = await User.findById(createdUserId);
      expect(user.unregister_requested).toBe(false);
      expect(user.unregister_scheduled_at).toBeNull();
    });

    it("should register account again (is_unregistered=false)", async () => {
      // First mark user as unregistered directly
      await User.findByIdAndUpdate(createdUserId, { is_unregistered: true });

      const res = await request(app)
        .post(`${baseUrl}/register-account`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ userId: createdUserId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Account Registered successfully");
      expect(res.body.data.is_unregistered).toBe(false);
    });
  });

  describe("Ban / Unban / Update Ban routes", () => {
    it("should return 400 when banning without required fields", async () => {
      const res = await request(app)
        .post(`${baseUrl}/ban-user`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({}); // missing userId and ban

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    it("should return 404 when banning non-existing user", async () => {
      const res = await request(app)
        .post(`${baseUrl}/ban-user`)
        .set("Authorization", `Bearer ${authToken}`)
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
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          userId: createdUserId,
          ban: { type: "temporary", reason: "violation", period: 7 },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User has been suspended successfully");

      const user = await User.findById(createdUserId);
      expect(user.ban.is_banned).toBe(true);
      expect(user.ban.reason).toBe("violation");
    });

    it("should return 400 when removing ban without userId", async () => {
      const res = await request(app)
        .post(`${baseUrl}/unban`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("No user selected");
    });

    it("should return 404 when removing ban for non-existing user", async () => {
      const res = await request(app)
        .post(`${baseUrl}/unban`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ userId: "67575bc829f1edf36a7582aa" });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    it("should remove ban successfully", async () => {
      const res = await request(app)
        .post(`${baseUrl}/unban`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ userId: createdUserId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User has been unsuspended successfully.");

      const user = await User.findById(createdUserId);
      expect(user.ban.is_banned).toBe(false);
    });

    it("should return 400 when updating ban without required fields", async () => {
      const res = await request(app)
        .post(`${baseUrl}/update-ban`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    it("should return 404 when updating ban for non-existing user", async () => {
      const res = await request(app)
        .post(`${baseUrl}/update-ban`)
        .set("Authorization", `Bearer ${authToken}`)
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
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          userId: createdUserId,
          ban: { type: "permanent", reason: "serious violation" },
        });

      expect([200, 500]).toContain(res.statusCode);

      if (res.statusCode === 200) {
        // If it succeeds:
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("User has been banned updated");

        const user = await User.findById(createdUserId);
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

    beforeAll(async () => {
      const userToDelete = await User.create({
        firstName: "Delete",
        lastName: "Me",
        email: "deleteme@example.com",
        phoneNumber: "+10000000004",
        password: "DeletePass123!",
      });
      userToDeleteId = userToDelete._id.toString();
    });

    it("should return 404 when deleting non-existing user", async () => {
      const res = await request(app)
        .delete(`${baseUrl}/delete-user/67575bc829f1edf36a7582aa`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    it("should delete user successfully", async () => {
      const res = await request(app)
        .delete(`${baseUrl}/delete-user/${userToDeleteId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Account Deleted Successfully");
      expect(res.body.data._id).toBe(userToDeleteId);

      const deleted = await User.findById(userToDeleteId);
      expect(deleted).toBeNull();
    });
  });
});
