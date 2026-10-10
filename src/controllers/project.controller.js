import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";

/**
 * Auto-join the current user as a tenant member and VARIETY_MANAGER of the project.
 */
async function ensureCreatorMembership(tenantId, projectId, user) {
  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    update: {},
    create: { tenantId, userId: user.id },
  });

  await prisma.projectMember.upsert({
    where: {
      projectId_invitedEmail: {
        projectId,
        invitedEmail: user.email,
      },
    },
    update: {
      userId: user.id,
      role: "VARIETY_MANAGER",
      state: "ACTIVE",
      acceptedAt: new Date(),
    },
    create: {
      projectId,
      userId: user.id,
      invitedEmail: user.email,
      role: "VARIETY_MANAGER",
      state: "ACTIVE",
      invitedById: user.id,
      acceptedAt: new Date(),
    },
  });
}

// @desc    Create a draft project in the current tenant
// @route   POST /api/projects
// @access  Private
export const createProject = asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Project name is required.",
    });
  }

  if (!req.tenantMembership) {
    const existingMembers = await prisma.tenantMember.count({
      where: { tenantId: req.tenant.id },
    });
    if (existingMembers > 0) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this organisation.",
      });
    }
  }

  const project = await prisma.project.create({
    data: {
      tenantId: req.tenant.id,
      name,
      status: "DRAFT",
      createdById: req.user.id,
      primarySpeciesCommon: req.body?.primarySpeciesCommon ?? null,
      primarySpeciesBotanical: req.body?.primarySpeciesBotanical ?? null,
    },
  });

  await ensureCreatorMembership(req.tenant.id, project.id, req.user);

  res.status(201).json({
    success: true,
    message: "Project created",
    project,
  });
});

// @desc    List projects for the current tenant that the user can see
// @route   GET /api/projects
// @access  Private
export const listProjects = asyncHandler(async (req, res) => {
  const projects = await prisma.project.findMany({
    where: {
      tenantId: req.tenant.id,
      OR: [
        { createdById: req.user.id },
        { members: { some: { userId: req.user.id } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { documents: true } },
    },
  });

  res.status(200).json({
    success: true,
    count: projects.length,
    projects,
  });
});

// @desc    Get one project
// @route   GET /api/projects/:projectId
// @access  Private
export const getProject = asyncHandler(async (req, res) => {
  const [documentCounts, phases] = await Promise.all([
    prisma.document.groupBy({
      by: ["status"],
      where: { projectId: req.project.id },
      _count: { _all: true },
    }),
    prisma.phase.findMany({
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

  res.status(200).json({
    success: true,
    project: req.project,
    documentsByStatus: Object.fromEntries(
      documentCounts.map((row) => [row.status, row._count._all])
    ),
    phases: phases.map((phase) => ({
      ...phase,
      countries: Array.isArray(phase.countries) ? phase.countries : [],
    })),
  });
});
