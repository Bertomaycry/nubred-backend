import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export default {
  testEnvironment: "node",
  clearMocks: true,
};
