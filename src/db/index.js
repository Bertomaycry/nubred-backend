import prisma from "../lib/prisma.js";

const connectDB = async () => {
  try {
    // Test the connection
    await prisma.$connect();
    console.log(
      `✅ Connected to DB: ${process.env.DB_NAME} via Prisma`
    );
  } catch (error) {
    console.log(`❌ Error connecting DB: ${error}`);
    process.exit(1);
  }
};

export default connectDB;
