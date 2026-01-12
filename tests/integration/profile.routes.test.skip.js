import dotenv from "dotenv";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../src/app.js";
import User from "../../src/models/user.model.js";
import Company from "../../src/models/CompanyProfile.model.js";
import Consultant from "../../src/models/ConsultantProfile.model.js";

jest.setTimeout(30000);

const MONGO_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/nubred-test";

describe("Profile Routes - Integration", () => {
  const baseUrl = "/api/profile";

  let userCompany;
  let userConsultant;
  let tokenCompany;
  let tokenConsultant;

  beforeAll(async () => {
    if (!process.env.ACCESS_TOKEN_SECRET_KEY) {
      process.env.ACCESS_TOKEN_SECRET_KEY = "tekkdev_12_access";
    }

    await mongoose.connect(MONGO_URI);

    // Clean collections
    await Promise.all([
      User.deleteMany({}),
      Company.deleteMany({}),
      Consultant.deleteMany({}),
    ]);

    // Create users
    userCompany = await User.create({
      firstName: "Comp",
      lastName: "User",
      email: "comp.user@example.com",
      phoneNumber: "+10000001001",
      password: "Password123!",
    });

    userConsultant = await User.create({
      firstName: "Cons",
      lastName: "User",
      email: "cons.user@example.com",
      phoneNumber: "+10000001002",
      password: "Password123!",
    });

    // Tokens for jwtVerify middleware
    tokenCompany = jwt.sign(
      { id: userCompany._id.toString(), email: userCompany.email },
      process.env.ACCESS_TOKEN_SECRET_KEY,
      { expiresIn: "20m" }
    );

    tokenConsultant = jwt.sign(
      { id: userConsultant._id.toString(), email: userConsultant.email },
      process.env.ACCESS_TOKEN_SECRET_KEY,
      { expiresIn: "20m" }
    );
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({}),
      Company.deleteMany({}),
      Consultant.deleteMany({}),
    ]);
    await mongoose.connection.close();
  });

  describe("POST /create", () => {
    it("should return 400 for invalid profile type", async () => {
      const res = await request(app).post(`${baseUrl}/create`).send({
        _id: userCompany._id.toString(),
        profile_type: "invalidType",
        profile_data: {},
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid profile type.");
    });

    it("should return 404 when user does not exist", async () => {
      const fakeUserId = "67575bc829f1edf36a7582aa";

      const res = await request(app).post(`${baseUrl}/create`).send({
        _id: fakeUserId,
        profile_type: "company",
        profile_data: {
          legal_company_name: "Fake Co",
          country_of_incorporation: "AE",
          company_email: "fake@co.com",
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found.");
    });

    it("should create COMPANY profile successfully (201)", async () => {
      const res = await request(app).post(`${baseUrl}/create`).send({
        _id: userCompany._id.toString(),
        profile_type: "company",
        profile_data: {
          legal_company_name: "Test Company LLC",
          country_of_incorporation: "AE",
          company_email: "testcompany@example.com",
          description: "Company profile",
          location: { address: "Dubai", postal_code: "00000", country: "UAE" },
          legal_representative: {
            first_name: "Ali",
            last_name: "Khan",
            email: "ali@example.com",
            phone_number: "+971500000000",
            whatsapp_number: "+971500000000",
          },
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.profile_id).toBeDefined();
      expect(res.body.message).toBe("company profile created successfully.");

      const updatedUser = await User.findById(userCompany._id);
      expect(updatedUser.account_created).toBe(true);
      expect(updatedUser.profile_type).toBe("company");
      expect(updatedUser.profile).toBeDefined();
    });

    it("should return 400 when profile already exists for user", async () => {
      const res = await request(app).post(`${baseUrl}/create`).send({
        _id: userCompany._id.toString(),
        profile_type: "company",
        profile_data: {
          legal_company_name: "Another Company",
          country_of_incorporation: "AE",
          company_email: "another@example.com",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Profile already exists for this user.");
    });

    it("should create CONSULTANT profile successfully (201)", async () => {
      const res = await request(app).post(`${baseUrl}/create`).send({
        _id: userConsultant._id.toString(),
        profile_type: "consultant",
        profile_data: {
          consultant_name: "John Consultant",
          consultant_email: "john.consultant@example.com",
          description: "Consultant profile",
          location: { address: "Lahore", postal_code: "54000", country: "PK" },
          personal_info: {
            first_name: "John",
            last_name: "C",
            email: "john.consultant@example.com",
            phone_number: "+923000000000",
          },
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.profile_id).toBeDefined();
      expect(res.body.message).toBe("consultant profile created successfully.");

      const updatedUser = await User.findById(userConsultant._id);
      expect(updatedUser.account_created).toBe(true);
      expect(updatedUser.profile_type).toBe("consultant");
      expect(updatedUser.profile).toBeDefined();
    });
  });

  describe("PUT /update-profile (protected)", () => {
    it("should return 401 when token is missing", async () => {
      const res = await request(app).put(`${baseUrl}/update-profile`).send({
        profile_id: "anything",
        profile_type: "company",
        profile_data: { description: "x" },
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Token not provided");
    });

    it("should return 401 when token is invalid", async () => {
      const res = await request(app)
        .put(`${baseUrl}/update-profile`)
        .set("Authorization", `Bearer invalid.token.here`)
        .send({
          profile_id: "anything",
          profile_type: "company",
          profile_data: { description: "x" },
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Please login to access this resource");
    });

    it("should return 400 for invalid profile type", async () => {
      const res = await request(app)
        .put(`${baseUrl}/update-profile`)
        .set("Authorization", `Bearer ${tokenCompany}`)
        .send({
          profile_id: "anything",
          profile_type: "invalidType",
          profile_data: { description: "x" },
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid profile type.");
    });

    it("should return 404 when company profile not found", async () => {
      const res = await request(app)
        .put(`${baseUrl}/update-profile`)
        .set("Authorization", `Bearer ${tokenCompany}`)
        .send({
          profile_id: "67575bc829f1edf36a7582aa",
          profile_type: "company",
          profile_data: { description: "update" },
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("company profile not found.");
    });

    it("should return 404 when consultant profile not found", async () => {
      const res = await request(app)
        .put(`${baseUrl}/update-profile`)
        .set("Authorization", `Bearer ${tokenConsultant}`)
        .send({
          profile_id: "67575bc829f1edf36a7582aa",
          profile_type: "consultant",
          profile_data: { description: "update" },
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("consultant profile not found.");
    });

    it("should return 500 for invalid profile_id (CastError)", async () => {
      const res = await request(app)
        .put(`${baseUrl}/update-profile`)
        .set("Authorization", `Bearer ${tokenCompany}`)
        .send({
          profile_id: "not-a-valid-objectid",
          profile_type: "company",
          profile_data: { description: "update" },
        });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Server error while updating profile.");
    });

    it("should update COMPANY profile successfully (200)", async () => {
      const u = await User.findById(userCompany._id);
      const profileId = u.profile.toString();

      const res = await request(app)
        .put(`${baseUrl}/update-profile`)
        .set("Authorization", `Bearer ${tokenCompany}`)
        .send({
          profile_id: profileId,
          profile_type: "company",
          profile_data: { description: "Updated company description" },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("company profile updated successfully.");
      expect(res.body.data.description).toBe("Updated company description");
    });

    it("should update CONSULTANT profile successfully (200)", async () => {
      const u = await User.findById(userConsultant._id);
      const profileId = u.profile.toString();

      const res = await request(app)
        .put(`${baseUrl}/update-profile`)
        .set("Authorization", `Bearer ${tokenConsultant}`)
        .send({
          profile_id: profileId,
          profile_type: "consultant",
          profile_data: { description: "Updated consultant description" },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("consultant profile updated successfully.");
      expect(res.body.data.description).toBe("Updated consultant description");
    });
  });

  describe("GET /user-profile/:_id", () => {
    it("should return 404 when user not found", async () => {
      const res = await request(app).get(
        `${baseUrl}/user-profile/67575bc829f1edf36a7582aa`
      );

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found.");
    });

    it("should return 500 for invalid user id (CastError)", async () => {
      const res = await request(app).get(
        `${baseUrl}/user-profile/not-a-valid-objectid`
      );

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Server error while fetching profile.");
    });

    it("should return user profile successfully (200)", async () => {
      const res = await request(app).get(
        `${baseUrl}/user-profile/${userCompany._id.toString()}`
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user._id).toBe(userCompany._id.toString());
      expect(res.body.user.profile_type).toBe("company");
      expect(res.body.user.profile).toBeDefined(); // populated object
    });
  });

  describe("PUT /update-profile - Authorization Tests", () => {
    it("should return 403 when user tries to update another user's profile", async () => {
      // UserCompany tries to update UserConsultant's profile
      const consultantUser = await User.findById(userConsultant._id);
      const consultantProfileId = consultantUser.profile.toString();

      const res = await request(app)
        .put(`${baseUrl}/update-profile`)
        .set("Authorization", `Bearer ${tokenCompany}`)
        .send({
          profile_id: consultantProfileId,
          profile_type: "consultant",
          profile_data: { description: "Malicious update attempt" },
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Unauthorized");
    });

    it("should allow user to update their own company profile", async () => {
      const companyUser = await User.findById(userCompany._id);
      const companyProfileId = companyUser.profile.toString();

      const res = await request(app)
        .put(`${baseUrl}/update-profile`)
        .set("Authorization", `Bearer ${tokenCompany}`)
        .send({
          profile_id: companyProfileId,
          profile_type: "company",
          profile_data: { description: "Legitimate company update" },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe("Legitimate company update");
    });

    it("should allow user to update their own consultant profile", async () => {
      const consultantUser = await User.findById(userConsultant._id);
      const consultantProfileId = consultantUser.profile.toString();

      const res = await request(app)
        .put(`${baseUrl}/update-profile`)
        .set("Authorization", `Bearer ${tokenConsultant}`)
        .send({
          profile_id: consultantProfileId,
          profile_type: "consultant",
          profile_data: { description: "Legitimate consultant update" },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe("Legitimate consultant update");
    });
  });
});
