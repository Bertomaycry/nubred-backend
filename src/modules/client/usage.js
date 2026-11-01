import { Prisma } from "@prisma/client";

/** Period keys the admin usage cards switch between. */
export const PERIODS = ["today", "this_week", "this_month", "all_time"];

/**
 * Start of each UTC window (all_time has none).
 * Week starts Monday 00:00:00Z (ISO).
 * @param {Date} [now]
 */
export function usageWindows(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;

  return {
    today: new Date(Date.UTC(y, m, d)),
    this_week: new Date(Date.UTC(y, m, d - daysSinceMonday)),
    this_month: new Date(Date.UTC(y, m, 1)),
    all_time: null,
  };
}

/** Seconds -> hours, one decimal. 0 stays 0. */
export const secondsToHours = (seconds) =>
  Math.round((Number(seconds) / 3600) * 10) / 10;

const zeroPeriods = () => ({
  today: 0,
  this_week: 0,
  this_month: 0,
  all_time: 0,
});

/**
 * Sum one usage table per user for the four windows, for one tenant.
 * Single query per table; never touches client databases.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {Date} [now]
 * @returns {Promise<{ time: Map<string, object>, tokens: Map<string, object> }>}
 *   time = seconds, tokens = credits, keyed by tenant user id
 */
export async function loadTenantUsage(prisma, tenantId, now = new Date()) {
  const w = usageWindows(now);

  const aggregate = (table, column) =>
    prisma.$queryRaw(Prisma.sql`
      SELECT
        "tenantUserId",
        COALESCE(SUM(${Prisma.raw(`"${column}"`)}) FILTER (WHERE "recordedAt" >= ${w.today}), 0)::bigint AS today,
        COALESCE(SUM(${Prisma.raw(`"${column}"`)}) FILTER (WHERE "recordedAt" >= ${w.this_week}), 0)::bigint AS this_week,
        COALESCE(SUM(${Prisma.raw(`"${column}"`)}) FILTER (WHERE "recordedAt" >= ${w.this_month}), 0)::bigint AS this_month,
        COALESCE(SUM(${Prisma.raw(`"${column}"`)}), 0)::bigint AS all_time
      FROM ${Prisma.raw(`"${table}"`)}
      WHERE "tenantId" = ${tenantId}
      GROUP BY "tenantUserId"
    `);

  const [timeRows, tokenRows] = await Promise.all([
    aggregate("time_usage_events", "seconds"),
    aggregate("ai_usage_events", "credits"),
  ]);

  const toMap = (rows) =>
    new Map(
      rows.map((row) => [
        row.tenantUserId,
        {
          today: Number(row.today),
          this_week: Number(row.this_week),
          this_month: Number(row.this_month),
          all_time: Number(row.all_time),
        },
      ])
    );

  return { time: toMap(timeRows), tokens: toMap(tokenRows) };
}

/**
 * API shape for one user: hours for time, integer credits for tokens.
 * @param {{ time: Map, tokens: Map }} usage
 * @param {string} tenantUserId
 */
export function usageForUser(usage, tenantUserId) {
  const seconds = usage.time.get(tenantUserId) ?? zeroPeriods();
  const credits = usage.tokens.get(tenantUserId) ?? zeroPeriods();

  const timeUsage = {};
  const tokenUsage = {};
  for (const period of PERIODS) {
    timeUsage[period] = secondsToHours(seconds[period]);
    tokenUsage[period] = Math.trunc(credits[period]);
  }
  return { timeUsage, tokenUsage };
}

/**
 * Credits for one successful AI call.
 * max(1, ceil(tokens / 1000)); 1 when the provider reported no token counts.
 */
export function creditsFor({ promptTokens, completionTokens } = {}) {
  const hasCounts =
    Number.isFinite(promptTokens) || Number.isFinite(completionTokens);
  if (!hasCounts) return 1;
  const total = (promptTokens ?? 0) + (completionTokens ?? 0);
  return Math.max(1, Math.ceil(total / 1000));
}

/**
 * Seconds a heartbeat adds: 30, or the elapsed time since the previous
 * accepted heartbeat if that was under 30s ago. Never more than 30.
 * @param {Date | null} previousAt
 * @param {Date} now
 */
export function heartbeatSeconds(previousAt, now = new Date()) {
  const SLICE = 30;
  if (!previousAt) return SLICE;
  const elapsed = Math.floor((now.getTime() - previousAt.getTime()) / 1000);
  if (elapsed >= SLICE) return SLICE;
  return Math.max(0, elapsed);
}
