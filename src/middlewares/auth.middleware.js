import { requireAuth, getAuth, createClerkClient } from "@clerk/express";
import prisma from "../lib/prisma.js";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * Rejects unauthenticated requests using Clerk session verification.
 * Must be used together with attachUser to populate req.user.
 */
export const requireClerkAuth = requireAuth();

/**
 * Finds the DB user by clerkUserId. If no record exists yet (race between
 * webhook and first API call), it fetches the Clerk user profile and creates
 * a row on the fly (fallback safety as required by the spec).
 */
export const attachUser = async (req, res, next) => {
  try {
    const { userId: clerkUserId } = getAuth(req);

    if (!clerkUserId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    let user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        companyProfile: { select: { id: true } },
        consultantProfile: { select: { id: true } },
      },
    });

    if (!user) {
      // Fallback: webhook may not have arrived yet — fetch from Clerk and create
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress;

      // If a user with this email already exists (legacy account), link it
      const byEmail = email
        ? await prisma.user.findUnique({ where: { email } })
        : null;

      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { clerkUserId },
          include: {
            companyProfile: { select: { id: true } },
            consultantProfile: { select: { id: true } },
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            clerkUserId,
            firstName: clerkUser.firstName || "",
            lastName: clerkUser.lastName || "",
            email: email || `${clerkUserId}@clerk.local`,
          },
          include: {
            companyProfile: { select: { id: true } },
            consultantProfile: { select: { id: true } },
          },
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res
      .status(401)
      .json({ success: false, message: "Authentication failed" });
  }
};

/**
 * Convenience array — spread into any route that needs a verified DB user:
 *   router.get("/me", ...protect, handler)
 */
export const protect = [requireClerkAuth, attachUser];
