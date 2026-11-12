import cron from "node-cron";
import { expireStaleTenantInvites } from "../modules/client/invites.js";

export const scheduleExpireTenantInvites = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const count = await expireStaleTenantInvites();
      if (count > 0) {
        console.log(`Expired ${count} client invitation(s)`);
      }
    } catch (error) {
      console.error("Error in expire client invitations job:", error);
    }
  });
};
