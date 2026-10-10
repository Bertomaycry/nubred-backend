/**
 * Postgres job worker.
 *
 * Why this exists:
 *   PM2 runs the API in cluster mode (N Node processes). If each HTTP handler
 *   did heavy work (PDF parse now, LLM calls later) inline, every worker would
 *   compete, crash recovery would lose in-flight work, and we could not cap
 *   LLM rate globally. Jobs live in Postgres; exactly one process claims each
 *   row via `FOR UPDATE SKIP LOCKED`.
 *
 * Who runs it:
 *   Only the primary PM2 instance (`NODE_APP_INSTANCE === "0"`, or any
 *   `npm run dev` process). API workers only enqueue.
 */
import os from "node:os";
import prisma from "../../../lib/prisma.js";
import { getHandler } from "./handlers/registry.js";

const DEFAULT_POLL_MS = 1000;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_LOCK_TIMEOUT_SECONDS = 600;

function envInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * True for `npm run dev` and for PM2 cluster instance 0.
 */
export function isPrimaryProcess() {
  return !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === "0";
}

function makeWorkerId() {
  const instance = process.env.NODE_APP_INSTANCE ?? "dev";
  return `${os.hostname()}:${process.pid}:i${instance}`;
}

function backoffMs(attempts) {
  const seconds = Math.min(60, 2 ** Math.max(1, attempts));
  return seconds * 1000;
}

/**
 * Claim one PENDING job that is due. SKIP LOCKED means another worker
 * (or a concurrent slot in this process) simply takes the next row
 * instead of waiting on this one.
 *
 * @param {string} workerId
 * @returns {Promise<object | null>}
 */
export async function claimNextJob(workerId) {
  const rows = await prisma.$queryRaw`
    UPDATE "jobs" AS j
    SET
      "status" = 'RUNNING'::"JobStatus",
      "lockedAt" = NOW(),
      "lockedBy" = ${workerId},
      "attempts" = j."attempts" + 1,
      "updatedAt" = NOW()
    WHERE j.id = (
      SELECT id
      FROM "jobs"
      WHERE "status" = 'PENDING'::"JobStatus"
        AND "availableAt" <= NOW()
      ORDER BY "availableAt" ASC, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;

  return rows[0]
    ? {
        ...rows[0],
        attempts: Number(rows[0].attempts),
        maxAttempts: Number(rows[0].maxAttempts),
        payload:
          typeof rows[0].payload === "string"
            ? JSON.parse(rows[0].payload)
            : rows[0].payload,
      }
    : null;
}

/**
 * If a worker dies mid-job, the row stays RUNNING forever. Reclaim those
 * whose lock is older than NUBRED_JOB_LOCK_TIMEOUT_SECONDS.
 */
export async function reclaimStuckJobs() {
  const timeoutSeconds = envInt(
    "NUBRED_JOB_LOCK_TIMEOUT_SECONDS",
    DEFAULT_LOCK_TIMEOUT_SECONDS
  );

  const result = await prisma.$executeRaw`
    UPDATE "jobs"
    SET
      "status" = 'PENDING'::"JobStatus",
      "lockedAt" = NULL,
      "lockedBy" = NULL,
      "availableAt" = NOW(),
      "updatedAt" = NOW(),
      "lastError" = 'Reclaimed after lock timeout'
    WHERE "status" = 'RUNNING'::"JobStatus"
      AND "lockedAt" IS NOT NULL
      AND "lockedAt" < NOW() - make_interval(secs => ${timeoutSeconds})
  `;

  if (typeof result === "number" && result > 0) {
    console.warn(`🧰 Reclaimed ${result} stuck job(s) after lock timeout.`);
  }
}

async function markCompleted(jobId) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      lockedAt: null,
      lastError: null,
    },
  });
}

async function markRetryOrDead(job, errorMessage, delayMs) {
  const exhausted = job.attempts >= job.maxAttempts;
  const nextStatus = exhausted ? "DEAD" : "PENDING";
  const wait = delayMs ?? backoffMs(job.attempts);

  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: nextStatus,
      lastError: errorMessage.slice(0, 4000),
      lockedAt: null,
      lockedBy: null,
      availableAt: exhausted
        ? job.availableAt
        : new Date(Date.now() + wait),
      completedAt: exhausted ? new Date() : null,
    },
  });

  if (exhausted) {
    const handler = getHandler(job.type);
    if (handler?.onDead) {
      await handler.onDead(job, errorMessage);
    }
  }
}

export async function runJob(job) {
  const handler = getHandler(job.type);
  if (!handler) {
    await markRetryOrDead(
      { ...job, attempts: job.maxAttempts },
      `No handler registered for job type "${job.type}".`
    );
    return;
  }

  try {
    await handler.run(job);
    await markCompleted(job.id);
  } catch (error) {
    const message = error?.message || String(error);
    console.error(
      `🧰 Job ${job.id} (${job.type}) failed attempt ${job.attempts}/${job.maxAttempts}: ${message}`
    );
    const delayMs =
      error?.code === "RATE_LIMIT" && Number.isFinite(error.retryAfterMs)
        ? error.retryAfterMs
        : undefined;
    await markRetryOrDead(job, message, delayMs);
  }
}

/**
 * Start the poll loop. Returns a stop function.
 */
export function startJobWorker() {
  const workerId = makeWorkerId();
  const pollMs = envInt("NUBRED_JOB_POLL_MS", DEFAULT_POLL_MS);
  const concurrency = envInt("NUBRED_JOB_CONCURRENCY", DEFAULT_CONCURRENCY);
  const inFlight = new Set();
  let stopped = false;
  let filling = false;

  console.log(
    `🧰 Job worker started (${workerId}, concurrency=${concurrency}, poll=${pollMs}ms)`
  );

  async function fill() {
    if (stopped || filling) return;
    filling = true;
    try {
      while (!stopped && inFlight.size < concurrency) {
        const job = await claimNextJob(workerId);
        if (!job) break;
        const run = runJob(job)
          .catch((error) => {
            console.error(`🧰 Unhandled job error (${job.id}):`, error);
          })
          .finally(() => {
            inFlight.delete(run);
            fill();
          });
        inFlight.add(run);
      }
    } catch (error) {
      console.error("🧰 Job claim failed:", error);
    } finally {
      filling = false;
    }
  }

  reclaimStuckJobs().catch((error) =>
    console.error("🧰 Stuck-job reclaim failed:", error)
  );
  fill();

  const timer = setInterval(() => {
    reclaimStuckJobs().catch((error) =>
      console.error("🧰 Stuck-job reclaim failed:", error)
    );
    fill();
  }, pollMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
