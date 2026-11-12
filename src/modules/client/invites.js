import prismaDefault from "../../lib/prisma.js";
import { ClientError } from "./errors.js";

/** Clerk invitation lifetime. Whole days; 2 ≈ 48 hours. */
export const INVITE_EXPIRES_IN_DAYS = 2;

export const EXPIRED_INVITE =
  "This invitation link is invalid or has expired. Ask your administrator to add you again.";
export const INVITE_NOT_FOUND = "Invitation not found.";
export const JOINED_MESSAGE = "You have joined this client.";
const RESTRICTED = "This workspace has been restricted.";

export const inviteExpiresAt = (now = new Date()) =>
  new Date(now.getTime() + INVITE_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

export function activePendingInvites(invites, now = new Date()) {
  return (invites ?? []).filter(
    (invite) =>
      invite.status === "pending" && new Date(invite.expiresAt).getTime() > now.getTime()
  );
}

/**
 * Diff the admin form against members and still-open invites.
 * An open pending email is not invited again.
 */
export function planMembershipChanges({ members, invites, desired, now = new Date() }) {
  const pending = new Map(
    activePendingInvites(invites, now).map((invite) => [invite.email, invite])
  );
  const memberByEmail = new Map(members.map((user) => [user.email, user]));
  const desiredByEmail = new Map(desired.map((user) => [user.email, user]));

  return {
    removedMembers: members.filter((user) => !desiredByEmail.has(user.email)),
    removedPending: [...pending.values()].filter(
      (invite) => !desiredByEmail.has(invite.email)
    ),
    changedMembers: desired.filter(
      (user) =>
        memberByEmail.has(user.email) &&
        memberByEmail.get(user.email).role !== user.role
    ),
    changedPending: desired.filter(
      (user) =>
        pending.has(user.email) && pending.get(user.email).role !== user.role
    ),
    toInvite: desired.filter(
      (user) => !memberByEmail.has(user.email) && !pending.has(user.email)
    ),
  };
}

async function revokeSafely(invitationId, revoke) {
  if (!invitationId) return;
  try {
    await revoke(invitationId);
  } catch (error) {
    console.warn(`Could not revoke invitation ${invitationId}: ${error.message}`);
  }
}

export async function revokeClerkInvitation(invitationId) {
  if (!invitationId) return;
  const { clerkClient } = await import("../../middlewares/auth.middleware.js");
  await clerkClient.invitations.revokeInvitation(invitationId);
}

/**
 * Email every address and store a pending invite. Failures are reported.
 * The client is already saved. An existing open invite is not emailed again.
 *
 * @returns {Promise<Array<{ email: string, reason: string }>>}
 */
export async function invitePendingUsers({
  tenantId,
  slug,
  companyName,
  users,
  deps,
  now = new Date(),
}) {
  const failures = [];
  if (users.length === 0) return failures;

  const existing = await deps.prisma.user.findMany({
    where: {
      OR: users.map((user) => ({
        email: { equals: user.email, mode: "insensitive" },
      })),
    },
    select: { email: true },
  });
  const known = new Set(existing.map((user) => user.email.toLowerCase()));
  const open = new Map(
    activePendingInvites(
      await deps.prisma.tenantInvite.findMany({
        where: { tenantId, status: "pending" },
      }),
      now
    ).map((invite) => [invite.email, invite])
  );

  for (const user of users) {
    const current = open.get(user.email);
    if (current) {
      if (current.role !== user.role) {
        await deps.prisma.tenantInvite.update({
          where: { id: current.id },
          data: { role: user.role },
        });
      }
      continue;
    }

    try {
      const sent = await deps.inviteEmail({
        email: user.email,
        role: user.role,
        companyName,
        slug,
        tenantId,
        existing: known.has(user.email),
      });
      await deps.prisma.tenantInvite.upsert({
        where: { tenantId_email: { tenantId, email: user.email } },
        create: {
          tenantId,
          email: user.email,
          role: user.role,
          clerkInvitationId: sent?.invitationId ?? null,
          expiresAt: inviteExpiresAt(now),
          status: "pending",
        },
        update: {
          role: user.role,
          clerkInvitationId: sent?.invitationId ?? null,
          expiresAt: inviteExpiresAt(now),
          status: "pending",
        },
      });
    } catch (error) {
      console.warn(`Invitation for ${user.email} failed: ${error.message}`);
      failures.push({ email: user.email, reason: error.message });
    }
  }
  return failures;
}

/**
 * Create the membership for this email on this client. A second call is success.
 * @returns {Promise<{ slug: string, role: string }>}
 */
export async function acceptClientInvite({
  prisma = prismaDefault,
  email,
  slug,
  now = () => new Date(),
  revokeInvitation = revokeClerkInvitation,
}) {
  const normalized = String(email ?? "").trim().toLowerCase();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || tenant.provisioningStatus !== "ready" || !normalized) {
    throw new ClientError(404, INVITE_NOT_FOUND);
  }

  const member = await prisma.tenantUser.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: normalized } },
  });
  if (member) return { slug: tenant.slug, role: member.role };

  if (tenant.status !== "active") throw new ClientError(403, RESTRICTED);

  const invite = await prisma.tenantInvite.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: normalized } },
  });
  if (!invite || invite.status === "revoked" || invite.status === "accepted") {
    throw new ClientError(404, INVITE_NOT_FOUND);
  }
  if (invite.status === "expired" || new Date(invite.expiresAt).getTime() <= now().getTime()) {
    if (invite.status === "pending") {
      await prisma.tenantInvite.update({
        where: { id: invite.id },
        data: { status: "expired" },
      });
      await revokeSafely(invite.clerkInvitationId, revokeInvitation);
    }
    throw new ClientError(410, EXPIRED_INVITE);
  }

  try {
    await prisma.$transaction([
      prisma.tenantUser.create({
        data: { tenantId: tenant.id, email: normalized, role: invite.role },
      }),
      prisma.tenantInvite.update({
        where: { id: invite.id },
        data: { status: "accepted" },
      }),
    ]);
  } catch (error) {
    if (error.code !== "P2002") throw error;
    const again = await prisma.tenantUser.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: normalized } },
    });
    return { slug: tenant.slug, role: again?.role ?? invite.role };
  }

  return { slug: tenant.slug, role: invite.role };
}

/** Clerk `invitation.accepted`. Unknown ids are ignored so Clerk does not retry them. */
export async function acceptInviteFromWebhook({ prisma = prismaDefault, invitationId }) {
  if (!invitationId) return null;
  const invite = await prisma.tenantInvite.findFirst({
    where: { clerkInvitationId: invitationId },
    include: { tenant: true },
  });
  if (!invite) return null;
  return acceptClientInvite({
    prisma,
    email: invite.email,
    slug: invite.tenant.slug,
  });
}

export async function expireStaleTenantInvites(overrides = {}) {
  const prisma = overrides.prisma ?? prismaDefault;
  const now = overrides.now ?? (() => new Date());
  const revoke = overrides.revokeInvitation ?? revokeClerkInvitation;
  const stale = await prisma.tenantInvite.findMany({
    where: { status: "pending", expiresAt: { lte: now() } },
  });
  for (const invite of stale) {
    await prisma.tenantInvite.update({
      where: { id: invite.id },
      data: { status: "expired" },
    });
    await revokeSafely(invite.clerkInvitationId, revoke);
  }
  return stale.length;
}
