import prisma from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { heartbeatSeconds } from "../modules/client/usage.js";

// @desc    Record active screen time (tenant app sends this every 30s while active)
// @route   POST /api/usage/heartbeat
// @access  Private (client user; admins without a membership are rejected by attachTenant)
export const postHeartbeat = asyncHandler(async (req, res) => {
  // User and tenant come from the login. Anything in the body is ignored.
  const { id: tenantUserId, tenantId } = req.tenantUser;

  await prisma.$transaction(async (tx) => {
    // Serialise this user's heartbeats so replays can't both read the same "previous".
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantUserId}, 0))`;

    const previous = await tx.timeUsageEvent.findFirst({
      where: { tenantId, tenantUserId },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true },
    });

    const now = new Date();
    const seconds = heartbeatSeconds(previous?.recordedAt ?? null, now);
    if (seconds > 0) {
      await tx.timeUsageEvent.create({
        data: { tenantId, tenantUserId, seconds, recordedAt: now },
      });
    }
  });

  res.status(204).end();
});
