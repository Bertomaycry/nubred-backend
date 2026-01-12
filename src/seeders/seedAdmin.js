import dotenv from "dotenv";
import prisma from "../lib/prisma.js";
import { hashPassword } from "../utils/auth.utils.js";

dotenv.config();

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

    const hashedPassword = await hashPassword("Nubred@12");

    await prisma.user.create({
      data: {
        firstName: "Admin",
        lastName: "User",
        email: "admin@nubred.com",
        password: hashedPassword,
        phoneNumber: "+1234567890", // Required field
        role: "admin",
      },
    });

    console.log("🎉 Admin created successfully!");
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createAdmin();
