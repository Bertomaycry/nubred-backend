import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";
import { sendProjectInvitation } from "../lib/resend.js";
import { workspaceUrl } from "../modules/client/slug.js";

const PROJECT_ROLES = [
  "VARIETY_MANAGER",
  "NURSERY",
  "GROWER",
  "PACKHOUSE_MARKETER",
  "FIELD_OBSERVER",
];

const ROLE_LABELS = {
  VARIETY_MANAGER: "Variety Manager",
  NURSERY: "Nursery",
  GROWER: "Grower",
  PACKHOUSE_MARKETER: "Packhouse / Marketer",
  FIELD_OBSERVER: "Field Observer",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serializeMember(member) {
  return {
    id: member.id,
    email: member.invitedEmail,
    userId: member.userId,
    role: member.role,
    isFieldObserver: member.isFieldObserver,
    state: member.state,
    invitedAt: member.invitedAt,
    acceptedAt: member.acceptedAt,
  };
}

function bad(res, message, status = 400) {
  return res.status(status).json({ success: false, message });
}

/**
 * True when removing/demoting `member` would leave the project with no ACTIVE VM.
 * (The creator always keeps Variety Manager access through projects.createdById.)
 */
async function isLastVarietyManager(req, member) {
  if (member.role !== "VARIETY_MANAGER" || member.state !== "ACTIVE") {
    return false;
  }
  const others = await req.db.projectMember.count({
    where: {
      projectId: req.project.id,
      role: "VARIETY_MANAGER",
      state: "ACTIVE",
      NOT: { id: member.id },
    },
  });
  return others === 0;
}

// @desc    List project members
// @route   GET /api/projects/:projectId/members
// @access  Private (VM)
export const listMembers = asyncHandler(async (req, res) => {
  const members = await req.db.projectMember.findMany({
    where: { projectId: req.project.id },
    orderBy: { invitedAt: "asc" },
  });
  res.status(200).json({
    success: true,
    count: members.length,
    members: members.map(serializeMember),
  });
});

// @desc    Invite a member (starts PENDING)
// @route   POST /api/projects/:projectId/members
// @access  Private (VM)
export const inviteMember = asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const role = req.body?.role;
  const isFieldObserver = req.body?.isFieldObserver === true;

  if (!EMAIL.test(email)) return bad(res, "A valid email is required.");
  if (!PROJECT_ROLES.includes(role)) {
    return bad(res, `role must be one of: ${PROJECT_ROLES.join(", ")}.`);
  }

  // Only people the admin already added to this client can be invited.
  const clientUser = await prisma.tenantUser.findUnique({
    where: { tenantId_email: { tenantId: req.tenant.id, email } },
  });
  if (!clientUser) {
    return bad(
      res,
      "Ask your NuBred admin to add this user to the client first."
    );
  }

  const existing = await req.db.projectMember.findUnique({
    where: {
      projectId_invitedEmail: { projectId: req.project.id, invitedEmail: email },
    },
  });
  if (existing) return bad(res, "This person is already invited.", 409);

  const member = await req.db.projectMember.create({
    data: {
      projectId: req.project.id,
      invitedEmail: email,
      role,
      isFieldObserver: role === "FIELD_OBSERVER" ? false : isFieldObserver,
      state: "PENDING",
      invitedById: req.user.id,
    },
  });

  let emailSent = true;
  try {
    await sendProjectInvitation({
      email,
      projectName: req.project.name,
      roleLabel: ROLE_LABELS[role],
      inviterName:
        `${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() ||
        req.user.email,
      workspaceUrl: workspaceUrl(req.tenant.slug),
    });
  } catch (error) {
    emailSent = false;
    console.warn(`Project invitation email to ${email} failed: ${error.message}`);
  }

  res.status(201).json({
    success: true,
    message: "Invitation created.",
    emailSent,
    member: serializeMember(member),
  });
});

// @desc    Change a member's role (history is never deleted)
// @route   PATCH /api/projects/:projectId/members/:memberId
// @access  Private (VM)
export const updateMember = asyncHandler(async (req, res) => {
  const member = await req.db.projectMember.findFirst({
    where: { id: req.params.memberId, projectId: req.project.id },
  });
  if (!member) return bad(res, "Member not found.", 404);

  const data = {};
  if (req.body?.role !== undefined) {
    if (!PROJECT_ROLES.includes(req.body.role)) {
      return bad(res, `role must be one of: ${PROJECT_ROLES.join(", ")}.`);
    }
    data.role = req.body.role;
  }
  if (req.body?.isFieldObserver !== undefined) {
    if (typeof req.body.isFieldObserver !== "boolean") {
      return bad(res, "isFieldObserver must be a boolean.");
    }
    data.isFieldObserver = req.body.isFieldObserver;
  }
  if (Object.keys(data).length === 0) {
    return bad(res, "Provide role and/or isFieldObserver.");
  }

  const nextRole = data.role ?? member.role;
  if (nextRole === "FIELD_OBSERVER") data.isFieldObserver = false;

  if (data.role && data.role !== "VARIETY_MANAGER" && (await isLastVarietyManager(req, member))) {
    return bad(res, "A project needs at least one Variety Manager.", 409);
  }

  const updated = await req.db.projectMember.update({
    where: { id: member.id },
    data,
  });

  res.status(200).json({
    success: true,
    message: "Member updated.",
    member: serializeMember(updated),
  });
});

// @desc    Remove a member
// @route   DELETE /api/projects/:projectId/members/:memberId
// @access  Private (VM)
export const removeMember = asyncHandler(async (req, res) => {
  const member = await req.db.projectMember.findFirst({
    where: { id: req.params.memberId, projectId: req.project.id },
  });
  if (!member) return bad(res, "Member not found.", 404);

  if (await isLastVarietyManager(req, member)) {
    return bad(res, "A project needs at least one Variety Manager.", 409);
  }

  await req.db.projectMember.delete({ where: { id: member.id } });
  res.status(200).json({ success: true, message: "Member removed." });
});

// @desc    Accept my own pending invitation (PENDING -> ACTIVE)
// @route   POST /api/projects/:projectId/members/accept
// @access  Private (invited user)
export const acceptInvitation = asyncHandler(async (req, res) => {
  const member = req.projectMembership;
  if (!member) return bad(res, "You have no invitation to this project.", 404);
  if (member.state === "ACTIVE") {
    return res.status(200).json({
      success: true,
      message: "Invitation already accepted.",
      member: serializeMember(member),
    });
  }

  const accepted = await req.db.projectMember.update({
    where: { id: member.id },
    data: {
      userId: req.user.id,
      state: "ACTIVE",
      acceptedAt: new Date(),
    },
  });

  res.status(200).json({
    success: true,
    message: "Invitation accepted.",
    member: serializeMember(accepted),
  });
});
