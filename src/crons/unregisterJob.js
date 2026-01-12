import cron from "node-cron";
import prisma from "../lib/prisma.js";

export const scheduleUnregisterJob = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();

      // Find all users who need to be unregistered
      const usersToUnregister = await prisma.user.findMany({
        where: {
          unregister_requested: true,
          unregister_scheduled_at: { lte: now },
          is_unregistered: false,
        },
      });

      // Update all users in bulk
      if (usersToUnregister.length > 0) {
        const userIds = usersToUnregister.map((user) => user.id);

        await prisma.user.updateMany({
          where: {
            id: { in: userIds },
          },
          data: {
            is_unregistered: true,
            unregister_requested: false,
          },
        });

        console.log(
          `Unregistered ${usersToUnregister.length} users at ${now.toISOString()}`
        );
      }
    } catch (error) {
      console.error("Error in unregister job:", error);
    }
  });
};
