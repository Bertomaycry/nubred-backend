import cron from "node-cron";
import User from "../models/user.model.js";

export const scheduleUnregisterJob = () => {
    cron.schedule("0 0 * * *", async () => {

        const now = new Date();
        const usersToUnregister = await User.find({
            unregister_requested: true,
            unregister_scheduled_at: { $lte: now },
            is_unregistered: false,
        });

        for (const user of usersToUnregister) {
            user.is_unregistered = true;
            user.unregister_requested = false;
            await user.save();
        }
    });
};
