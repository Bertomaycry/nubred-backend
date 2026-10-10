import "dotenv/config";
import connectDB from "./db/index.js";
import app from "./app.js";
import { scheduleUnregisterJob } from "./crons/unregisterJob.js";
import { initStorage } from "./modules/project/storage/provider.js";
import { initProvider } from "./modules/project/llm/provider.js";
import {
  isPrimaryProcess,
  startJobWorker,
} from "./modules/project/jobs/worker.js";

if (isPrimaryProcess()) {
  scheduleUnregisterJob();
}

connectDB()
  .then(async () => {
    try {
      await initStorage();
    } catch (error) {
      console.error(`❌ Object storage init failed: ${error.message}`);
      console.error(
        "   Document upload APIs will retry storage init on first request.",
      );
      console.error("   Ensure MinIO is running: npm run minio:up");
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });

    try {
      await initProvider();
    } catch (error) {
      console.error(`❌ LLM provider init failed: ${error.message}`);
      console.error(
        "   Set NUBRED_LLM_PROVIDER=mock without a Gemini key, or set GEMINI_API_KEY.",
      );
    }

    if (isPrimaryProcess()) {
      startJobWorker();
    }
  })
  .catch((error) => {
    console.error(`❌ Error connecting DB: ${error}`);
  });
