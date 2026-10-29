import {
  LEVEL,
  docASectionFor,
  sectionLevel,
} from "../modules/project/access/matrix.js";

/**
 * Load the project from the caller's own tenant database and attach their
 * membership. Must run after attachUser + attachTenant.
 *
 * A project id from another client does not exist in this database, so it
 * is a plain 404.
 */
export const attachProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = await req.db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    const email = String(req.user.email ?? "").toLowerCase();
    const membership = await req.db.projectMember.findFirst({
      where: {
        projectId: project.id,
        OR: [{ userId: req.user.id }, { invitedEmail: email }],
      },
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
 * The caller's effective project role. The creator is the Variety Manager.
 * @returns {{ role: string | null, isFieldObserver: boolean }}
 */
export function projectRoleFor(req) {
  if (isCreator(req) || isActiveVarietyManager(req)) {
    return { role: "VARIETY_MANAGER", isFieldObserver: false };
  }
  if (isActiveMember(req)) {
    return {
      role: req.projectMembership.role,
      isFieldObserver: Boolean(req.projectMembership.isFieldObserver),
    };
  }
  return { role: null, isFieldObserver: false };
}

/**
 * Creator or ACTIVE member (any role). PENDING invitees get nothing here;
 * they can only accept their invitation.
 */
export const requireActiveMember = (req, res, next) => {
  if (isCreator(req) || isActiveMember(req)) return next();
  return res.status(403).json({
    success: false,
    message: "You do not have access to this project.",
  });
};

/**
 * Only the Variety Manager (or creator): uploads, documents, extractions,
 * chat, edits, confirmations and managing members.
 */
export const requireProjectEditor = (req, res, next) => {
  if (isCreator(req) || isActiveVarietyManager(req)) return next();
  return res.status(403).json({
    success: false,
    message: "Only the Variety Manager can do this in this project.",
  });
};

/**
 * Doc A visibility for the section in :sectionKey.
 *   hidden -> 403, read -> GET only, full -> everything.
 * Unknown section keys fall through so the handler can answer 400.
 */
export const requireSectionAccess = (req, res, next) => {
  if (!(isCreator(req) || isActiveMember(req))) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this project.",
    });
  }

  const docASection = docASectionFor(req.params.sectionKey);
  if (!docASection) return next();

  const { role, isFieldObserver } = projectRoleFor(req);
  const level = sectionLevel(role, docASection, { isFieldObserver });

  if (level === LEVEL.HIDDEN || (req.method !== "GET" && level < LEVEL.FULL)) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this section.",
    });
  }
  next();
};
