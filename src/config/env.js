import { execSync } from "child_process";
import dotenv from "dotenv";

let currentBranch = "main";
try {
  currentBranch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
} catch (err) {
  console.error("Error determining git branch, defaulting to 'main':", err);
}

let envFile = ".env.dev";
if (currentBranch === "main") envFile = ".env.prod";
else if (currentBranch === "qa") envFile = ".env.qa";

dotenv.config({ path: envFile });

console.log(`📁 Loaded environment: ${envFile}`);
