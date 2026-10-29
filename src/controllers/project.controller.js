import { asyncHandler } from "../utils/asyncHandler.js";
import { PROJECT_CREATOR_ROLES } from "../modules/client/roles.js";
import { buildSectionAccess } from "../modules/project/access/matrix.js";
import { projectRoleFor } from "../middlewares/project.middleware.js";

// @desc    Create a draft project in the current client workspace
// @route   POST /api/projects
// @access  Private (client owner / master project manager / project manager)
export const createProject = asyncHandler(async (req, res) => {
  if (!PROJECT_CREATOR_ROLES.includes(req.tenantUser.role)) {
    return res.status(403).json({
      success: false,
      message: "Your role cannot create projects.",
    });
  }

  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Project name is required.",
    });
  }

  const email = String(req.user.email ?? "").toLowerCase();

  const result = await req.db.$transaction(async (tx) => {
    // Serialise creates so two requests cannot both squeeze under the cap.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('nubred_project_create'))`;

    const count = await tx.project.count();
    if (count >= req.tenant.maxProjects) {
      return { limitReached: true };
    }

    const project = await tx.project.create({
      data: {
        name,
        status: "DRAFT",
        createdById: req.user.id,
        primarySpeciesCommon: req.body?.primarySpeciesCommon ?? null,
        primarySpeciesBotanical: req.body?.primarySpeciesBotanical ?? null,
      },
    });

    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: req.user.id,
        invitedEmail: email,
        role: "VARIETY_MANAGER",
        state: "ACTIVE",
        invitedById: req.user.id,
        acceptedAt: new Date(),
      },
    });

    return { project };
  });

  if (result.limitReached) {
    return res.status(409).json({
      success: false,
      message: `Your organisation has reached its limit of ${req.tenant.maxProjects} projects.`,
    });
  }

  res.status(201).json({
    success: true,
    message: "Project created",
    project: result.project,
  });
});

// @desc    List projects the user created, belongs to, or is invited to
// @route   GET /api/projects
// @access  Private
export const listProjects = asyncHandler(async (req, res) => {
  const email = String(req.user.email ?? "").toLowerCase();
  const mine = [{ userId: req.user.id }, { invitedEmail: email }];

  const rows = await req.db.project.findMany({
    where: {
      OR: [{ createdById: req.user.id }, { members: { some: { OR: mine } } }],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { documents: true } },
      members: { where: { OR: mine }, take: 1 },
    },
  });

  const projects = rows.map(({ members, ...project }) => {
    const membership = members[0] ?? null;
    const creator = project.createdById === req.user.id;
    return {
      ...project,
      myRole: creator ? "VARIETY_MANAGER" : membership?.role ?? null,
      isFieldObserver: membership?.isFieldObserver ?? false,
      // PENDING until the invitation is accepted (Doc A).
      myState: creator ? "ACTIVE" : membership?.state ?? null,
    };
  });

  res.status(200).json({
    success: true,
    count: projects.length,
    projects,
  });
});

// @desc    Get one project
// @route   GET /api/projects/:projectId
// @access  Private (creator / active member)
export const getProject = asyncHandler(async (req, res) => {
  const [documentCounts, phases] = await Promise.all([
    req.db.document.groupBy({
      by: ["status"],
      where: { projectId: req.project.id },
      _count: { _all: true },
    }),
    req.db.phase.findMany({
      where: { projectId: req.project.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        category: true,
        location: true,
        countries: true,
        sortOrder: true,
      },
    }),
  ]);

  const { role, isFieldObserver } = projectRoleFor(req);

  res.status(200).json({
    success: true,
    project: req.project,
    myRole: role,
    isFieldObserver,
    sectionAccess: buildSectionAccess(role, { isFieldObserver }),
    documentsByStatus: Object.fromEntries(
      documentCounts.map((row) => [row.status, row._count._all])
    ),
    phases: phases.map((phase) => ({
      ...phase,
      countries: Array.isArray(phase.countries) ? phase.countries : [],
    })),
  });
});
