import prisma from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  buildPaginationMeta,
  parsePaginationQuery,
} from "../utils/pagination.js";
import {
  parseCreateClient,
  parseRestrictReason,
  parseUpdateClient,
} from "../modules/client/client.schema.js";
import { ClientError, provisionClient } from "../modules/client/provision.js";
import { updateClient } from "../modules/client/update.js";
import {
  serializeClientDetail,
  serializeClientListItem,
} from "../modules/client/serialize.js";
import { loadTenantUsage } from "../modules/client/usage.js";

const NOT_FOUND = "Client not found";
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 50;

const include = { users: true, modules: true };

const validationError = (message) => new ClientError(400, message);

// @desc    List clients (ready only)
// @route   GET /api/admin/clients
// @access  Private/Admin
export const listClients = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaginationQuery({
    page: req.query.page,
    limit: req.query.limit ?? DEFAULT_LIMIT,
  });
  const pageSize = Math.min(limit, MAX_LIMIT);

  const search = String(req.query.search ?? "").trim();
  const status = req.query.status;
  if (status && status !== "active" && status !== "inactive") {
    throw validationError("status must be active or inactive.");
  }

  const where = {
    provisioningStatus: "ready",
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            {
              users: {
                some: {
                  role: "owner",
                  email: { contains: search, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [total, tenants] = await Promise.all([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  res.status(200).json({
    success: true,
    data: tenants.map(serializeClientListItem),
    pagination: buildPaginationMeta({ page, limit: pageSize, total }),
  });
});

// @desc    Add a client (provisions database + bucket)
// @route   POST /api/admin/clients
// @access  Private/Admin
export const createClient = asyncHandler(async (req, res) => {
  const parsed = parseCreateClient(req.body);
  if (!parsed.ok) throw validationError(parsed.message);

  const { tenant, inviteFailures } = await provisionClient(parsed.data);

  res.status(201).json({
    success: true,
    message: `${tenant.name} has been added.`,
    data: { id: tenant.id },
    ...(inviteFailures.length > 0 ? { inviteFailures } : {}),
  });
});

async function loadReadyTenant(id) {
  const tenant = await prisma.tenant.findFirst({
    where: { id, provisioningStatus: "ready" },
    include,
  });
  if (!tenant) throw new ClientError(404, NOT_FOUND);
  return tenant;
}

// @desc    Client detail with usage for all four periods
// @route   GET /api/admin/clients/:id
// @access  Private/Admin
export const getClient = asyncHandler(async (req, res) => {
  const tenant = await loadReadyTenant(req.params.id);
  const usage = await loadTenantUsage(prisma, tenant.id);

  res.status(200).json({
    success: true,
    data: serializeClientDetail(tenant, usage),
  });
});

// @desc    Apply changes (never reprovisions)
// @route   PUT /api/admin/clients/:id
// @access  Private/Admin
export const putClient = asyncHandler(async (req, res) => {
  // 404 before validation so an unknown id never reads as a form error.
  await loadReadyTenant(req.params.id);

  const parsed = parseUpdateClient(req.body);
  if (!parsed.ok) throw validationError(parsed.message);

  const { inviteFailures } = await updateClient(req.params.id, parsed.data);

  res.status(200).json({
    success: true,
    message: `${parsed.data.companyName} has been updated.`,
    ...(inviteFailures.length > 0 ? { inviteFailures } : {}),
  });
});

// @desc    Restrict a client (all its users lose access on the next request)
// @route   POST /api/admin/clients/:id/restrict
// @access  Private/Admin
export const restrictClient = asyncHandler(async (req, res) => {
  const parsed = parseRestrictReason(req.body);
  if (!parsed.ok) throw validationError(parsed.message);

  const tenant = await loadReadyTenant(req.params.id);

  // Conditional update so two admins can't both "win".
  const changed = await prisma.tenant.updateMany({
    where: { id: tenant.id, status: "active" },
    data: { status: "inactive" },
  });
  if (changed.count === 0) {
    throw new ClientError(409, "This client is already restricted.");
  }

  await prisma.tenantRestriction.create({
    data: {
      tenantId: tenant.id,
      action: "restrict",
      reason: parsed.data.reason,
      actorUserId: req.user.id,
    },
  });

  res.status(200).json({
    success: true,
    message: `${tenant.name} has been restricted.`,
  });
});

// @desc    Reactivate a restricted client
// @route   POST /api/admin/clients/:id/reactivate
// @access  Private/Admin
export const reactivateClient = asyncHandler(async (req, res) => {
  const tenant = await loadReadyTenant(req.params.id);

  const changed = await prisma.tenant.updateMany({
    where: { id: tenant.id, status: "inactive" },
    data: { status: "active" },
  });
  if (changed.count === 0) {
    throw new ClientError(409, "This client is already active.");
  }

  await prisma.tenantRestriction.create({
    data: {
      tenantId: tenant.id,
      action: "reactivate",
      reason: null,
      actorUserId: req.user.id,
    },
  });

  res.status(200).json({
    success: true,
    message: `${tenant.name} has been reactivated.`,
  });
});
