

import connectDB from "./db/index.js";
import app from "./app.js";
import { scheduleUnregisterJob } from "./crons/unregisterJob.js";

scheduleUnregisterJob()

connectDB()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`❌ Error connecting DB: ${error}`);
  });
