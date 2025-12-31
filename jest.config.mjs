import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export default {
  testEnvironment: "node",
  clearMocks: true,
  maxWorkers: 1, // Run tests sequentially to avoid database connection conflicts
};
