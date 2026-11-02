import cron from "node-cron";
import { expireStaleFilterUploads } from "../modules/master-filter/cleanup.js";

export const scheduleExpireFilterUploads = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const count = await expireStaleFilterUploads();
      if (count > 0) {
        console.log(`Expired ${count} stale filter upload(s)`);
      }
    } catch (error) {
      console.error("Error in expire filter uploads job:", error);
    }
  });
};
