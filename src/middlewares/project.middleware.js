import prisma from "../lib/prisma.js";

/**
 * Load the project scoped to the current tenant and attach membership.
 * Must run after attachUser + attachTenant.
 */
export const attachProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: req.tenant.id },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    const membership = await prisma.projectMember.findFirst({
      where: { projectId: project.id, userId: req.user.id },
    });

    req.project = project;
    req.projectMembership = membership;
    next();
  } catch (error) {
    console.error("Project middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load project",
    });
  }
};

function isCreator(req) {
  return req.project.createdById === req.user.id;
}

function isActiveMember(req) {
  return (
    req.projectMembership &&
    req.projectMembership.state === "ACTIVE"
  );
}

function isActiveVarietyManager(req) {
  return (
    isActiveMember(req) &&
    req.projectMembership.role === "VARIETY_MANAGER"
  );
}

/**
 * Any active project member or the creator may view documents.
 */
export const requireProjectViewer = (req, res, next) => {
  if (isCreator(req) || isActiveMember(req)) return next();
  return res.status(403).json({
    success: false,
    message: "You do not have access to this project.",
  });
};

/**
 * Only the Variety Manager (or creator) may upload, edit drafts, or confirm sections.
 */
export const requireProjectEditor = (req, res, next) => {
  if (isCreator(req) || isActiveVarietyManager(req)) return next();
  return res.status(403).json({
    success: false,
    message: "Only the Variety Manager can edit this project.",
  });
};
