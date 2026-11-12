import prisma from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ClientError } from "../modules/client/errors.js";
import {
  acceptClientInvite,
  JOINED_MESSAGE,
} from "../modules/client/invites.js";

// @desc    Turn a pending client invite into a membership
// @route   POST /api/invitations/accept
// @access  Private
export const acceptInvitation = asyncHandler(async (req, res) => {
  const slug = String(req.body?.slug ?? "").trim().toLowerCase();
  if (!slug) throw new ClientError(400, "Slug is required.");

  const data = await acceptClientInvite({
    prisma,
    email: req.user.email,
    slug,
  });

  res.status(200).json({
    success: true,
    message: JOINED_MESSAGE,
    data,
  });
});
