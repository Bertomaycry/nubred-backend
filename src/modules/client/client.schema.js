import { z } from "zod";
import { CLIENT_ROLES } from "./roles.js";
import { MODULE_IDS, isModuleId } from "./modules.js";
import { slugError } from "./slug.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INT = 2_147_483_647;

const companyName = z
  .string({ error: "Company name is required." })
  .trim()
  .min(1, "Company name is required.")
  .max(200, "Company name is too long.");

// The form keeps this as a string; accept a number as well.
const maxProjects = z
  .union([z.number(), z.string()], {
    error: "Maximum projects is required.",
  })
  .transform((value) => (typeof value === "string" ? value.trim() : value))
  .refine(
    (value) =>
      typeof value === "number"
        ? Number.isInteger(value) && value >= 1 && value <= MAX_INT
        : /^[1-9]\d*$/.test(value) && Number(value) <= MAX_INT,
    "Maximum projects must be a whole number of at least 1."
  )
  .transform(Number);

const user = z.object({
  email: z
    .string({ error: "Each user needs an email." })
    .trim()
    .toLowerCase()
    .regex(EMAIL, "Enter a valid email address."),
  role: z.enum(CLIENT_ROLES, { error: "Each user needs a valid role." }),
});

const users = z
  .array(user, { error: "At least one user is required." })
  .min(1, "At least one user is required.")
  .superRefine((list, ctx) => {
    const seen = new Set();
    for (const { email } of list) {
      if (seen.has(email)) {
        ctx.addIssue({
          code: "custom",
          message: `${email} is listed more than once.`,
        });
      }
      seen.add(email);
    }
    const owners = list.filter((u) => u.role === "owner").length;
    if (owners !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Exactly one owner is required.",
      });
    }
  });

const modules = z
  .record(z.string(), z.boolean({ error: "Each module must be true or false." }), {
    error: "Modules are required.",
  })
  .superRefine((map, ctx) => {
    for (const id of Object.keys(map)) {
      if (!isModuleId(id)) {
        ctx.addIssue({ code: "custom", message: `Unknown module "${id}".` });
      }
    }
    for (const id of MODULE_IDS) {
      if (typeof map[id] !== "boolean") {
        ctx.addIssue({ code: "custom", message: `Module "${id}" is missing.` });
      }
    }
  });

const uniqueUrlCreate = z
  .string({ error: "Unique URL is required." })
  .trim()
  .toLowerCase()
  .superRefine((slug, ctx) => {
    const message = slugError(slug);
    if (message) ctx.addIssue({ code: "custom", message });
  });

export const createClientSchema = z.object({
  companyName,
  maxProjects,
  uniqueUrl: uniqueUrlCreate,
  users,
  modules,
});

// uniqueUrl cannot change; the UI still sends it, so it is only compared.
export const updateClientSchema = z.object({
  companyName,
  maxProjects,
  uniqueUrl: z.string().trim().toLowerCase().optional(),
  users,
  modules,
});

function parseWith(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    message: result.error.issues[0]?.message ?? "Invalid request.",
  };
}

/** @returns {{ ok: true, data: object } | { ok: false, message: string }} */
export const parseCreateClient = (body) => parseWith(createClientSchema, body);
export const parseUpdateClient = (body) => parseWith(updateClientSchema, body);

export const RESTRICT_REASONS = ["security_violation", "client_stop_paying"];

export function parseRestrictReason(body) {
  const reason = body?.reason;
  if (!RESTRICT_REASONS.includes(reason)) {
    return {
      ok: false,
      message: `reason must be one of: ${RESTRICT_REASONS.join(", ")}.`,
    };
  }
  return { ok: true, data: { reason } };
}

/** The single owner of an already-validated user list. */
export const ownerOf = (list) => list.find((u) => u.role === "owner");
