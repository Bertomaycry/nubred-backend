import dotenv from "dotenv";
import prisma from "../lib/prisma.js";

dotenv.config();

/**
 * Seeds a placeholder admin user record in the DB.
 * Authentication is handled entirely by Clerk — link the real Clerk user ID
 * by setting ADMIN_CLERK_USER_ID in .env before running this script, or update
 * the record manually after creating the admin in the Clerk dashboard.
 */
async function createAdmin() {
  try {
    console.log("✅ Connected to database via Prisma");

    const existingAdmin = await prisma.user.findUnique({
      where: { email: "admin@nubred.com" },
    });

    if (existingAdmin) {
      console.log("⚠️ Admin already exists.");
      await prisma.$disconnect();
      return process.exit(0);
    }

    await prisma.user.create({
      data: {
        clerkUserId: process.env.ADMIN_CLERK_USER_ID || null,
        firstName: "Admin",
        lastName: "User",
        email: "admin@nubred.com",
        role: "admin",
      },
    });

    console.log("🎉 Admin created successfully!");
    if (!process.env.ADMIN_CLERK_USER_ID) {
      console.log(
        "⚠️  ADMIN_CLERK_USER_ID was not set. Update the admin record with the " +
          "Clerk user ID after creating the admin account in the Clerk dashboard."
      );
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createAdmin();
