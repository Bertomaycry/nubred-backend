import { loadTenantContext } from "../../../../lib/tenant-context.js";
import { loadMasterFiltersForSection } from "../../../master-filter/load-section.js";
import { loadEnabledModules } from "../../../../middlewares/tenant.middleware.js";
import { getUserFilterContent } from "../../filter/project-section-filter.js";
import { composeExtractionPrompt } from "../../prompt/compose.js";
import { getSectionPromptPrefix, modelForStep } from "../../llm/section-cache.js";
import { ensureProvider } from "../../llm/provider.js";
import { getSection } from "../../sections/registry.js";
import { buildUpstreamContext } from "../../extraction/upstream-context.js";
import { mergeExtractionIntoStore } from "../../extraction/merge.js";
import { contractOnlyDecision } from "../../extraction/plan-run.js";
import { advanceExtractionRun } from "../../extraction/chain.js";
import {
  MODEL_UNAVAILABLE_MESSAGE,
  UPSTREAM_FAILED_SKIP_REASON,
  userFacingStepError,
} from "../../extraction/failure-message.js";
import { enabledSectionKeys } from "../../access/section-modules.js";
import { cascadeRootKey } from "../../sections/dependents.js";
import {
  ensureSectionState,
} from "../../field-store/repository.js";

function formatDocumentText(document) {
  const pages = document.pages ?? [];
  return pages
    .map((p) => `\n[page ${p.pageNumber}]\n${p.text}`)
    .join("\n");
}

/**
 * @param {{ tenantId: string, projectId?: string, payload: { extractionRunId?: string, stepId?: string } }} job
 */
export async function handleExtractStep(job) {
  const { extractionRunId, stepId } = job.payload ?? {};
  if (!extractionRunId || !stepId) {
    throw new Error("EXTRACT_STEP payload missing extractionRunId or stepId.");
  }

  const { db } = await loadTenantContext(job.tenantId);
  const step = await db.extractionStep.findUnique({ where: { id: stepId } });
  if (!step || step.extractionRunId !== extractionRunId) return;
  if (step.status === "SUCCEEDED" || step.status === "SKIPPED") return;

  const section = getSection(step.sectionKey);
  if (section.kind === "deriver" || section.perDocument === false) {
    await db.extractionStep.update({
      where: { id: step.id },
      data: { status: "SKIPPED", skipReason: "code-only section" },
    });
    await bumpProgress(db, extractionRunId, job);
    return;
  }

  const upstreamFailure = await cascadeUpstreamFailure(db, extractionRunId, step);
  if (upstreamFailure) {
    await db.extractionStep.update({
      where: { id: step.id },
      data: {
        status: "SKIPPED",
        skipReason: UPSTREAM_FAILED_SKIP_REASON,
        error: upstreamFailure,
      },
    });
    await bumpProgress(db, extractionRunId, job);
    return;
  }

  const document = await db.document.findUnique({
    where: { id: step.documentId },
    include: { pages: { orderBy: { pageNumber: "asc" } } },
  });
  if (!document) {
    await db.extractionStep.update({
      where: { id: step.id },
      data: { status: "SKIPPED", skipReason: "document missing" },
    });
    await bumpProgress(db, extractionRunId, job);
    return;
  }

  const contractDecision = contractOnlyDecision(section, document);
  if (contractDecision === "skip") {
    await db.extractionStep.update({
      where: { id: step.id },
      data: { status: "SKIPPED", skipReason: "not a contract document" },
    });
    await bumpProgress(db, extractionRunId, job);
    return;
  }
  if (contractDecision === "unclassified") {
    await db.extractionStep.update({
      where: { id: step.id },
      data: {
        status: "FAILED",
        error: userFacingStepError(document.failureReason) ?? MODEL_UNAVAILABLE_MESSAGE,
      },
    });
    await bumpProgress(db, extractionRunId, job);
    return;
  }

  await db.extractionStep.update({
    where: { id: step.id },
    data: { status: "RUNNING", error: null },
  });

  const enabledModules = await loadEnabledModules(job.tenantId);
  const master = await loadMasterFiltersForSection(section.key);
  const userFilter = await getUserFilterContent(db, step.projectId, section.key);
  const prefix = getSectionPromptPrefix(section.key, master.content, master.hash);
  const prompt = composeExtractionPrompt({
    masterContent: prefix.content,
    masterHash: master.hash,
    userFilterText: userFilter.text,
  });

  const upstream = await buildUpstreamContext(
    db,
    step.projectId,
    section.key,
    enabledSectionKeys(enabledModules)
  );

  const existingRecords = await db.sectionRecord.findMany({
    where: { projectId: step.projectId, sectionKey: section.key, deletedAt: null },
    select: { id: true, groupPath: true },
    take: 200,
  });

  const schema =
    section.extractionSchemas?.[step.partIndex] ?? section.schema;

  const userContent = [
    `Extract section "${section.label}" from document: ${document.originalFilename}`,
    "### Upstream context (record ids + identity fields)",
    upstream || "(none)",
    "### Existing records in this section",
    JSON.stringify(existingRecords),
    "### Document",
    formatDocumentText(document),
  ].join("\n\n");

  const provider = await ensureProvider();
  const modelId =
    section.key === "contract" ? modelForStep("contract") : modelForStep("extract");

  const started = Date.now();
  const result = await provider.extract({
    systemPrompt: prompt.content,
    promptHash: prompt.hash,
    userContent,
    schema,
    modelId,
  });
  const durationMs = Date.now() - started;

  const parsed = schema.safeParse(result.data);
  const sectionState = await ensureSectionState(db, step.projectId, section.key);

  await db.$transaction(async (tx) => {
    const stored = parsed.success
      ? await mergeExtractionIntoStore(tx, {
          projectId: step.projectId,
          section,
          sectionState,
          document,
          parsed: parsed.data,
          runStepId: step.id,
        })
      : false;

    await tx.extractionStep.update({
      where: { id: step.id },
      data: {
        status: parsed.success ? "SUCCEEDED" : "FAILED",
        masterFilterIds: master.ids,
        masterHash: master.hash,
        userFilterVersion: userFilter.version,
        modelId: result.modelId,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        durationMs,
        error: parsed.success
          ? null
          : userFacingStepError(`Schema validation failed: ${parsed.error.message}`),
      },
    });

    await tx.sectionState.update({
      where: { projectId_sectionKey: { projectId: step.projectId, sectionKey: section.key } },
      data: {
        ...(parsed.success && stored
          ? { status: sectionState.status === "CONFIRMED" ? "TO_REVIEW" : "EXTRACTING" }
          : {}),
        lastRunId: extractionRunId,
      },
    });

  });

  await db.extractionRun.update({
    where: { id: extractionRunId },
    data: {
      inputTokens: { increment: result.usage?.inputTokens ?? 0 },
      outputTokens: { increment: result.usage?.outputTokens ?? 0 },
      modelId: result.modelId,
      promptHash: prompt.hash,
    },
  });

  await bumpProgress(db, extractionRunId, job);
}

/**
 * In a cascade run, dependents do not run on data the requested section
 * failed to produce.
 * @returns {Promise<string | null>} user-facing reason, or null to run the step
 */
async function cascadeUpstreamFailure(db, extractionRunId, step) {
  const run = await db.extractionRun.findUnique({
    where: { id: extractionRunId },
    select: { scope: true },
  });
  const rootKey = cascadeRootKey(run?.scope);
  if (!rootKey || rootKey === step.sectionKey) return null;

  const failed = await db.extractionStep.count({
    where: { extractionRunId, sectionKey: rootKey, status: "FAILED" },
  });
  if (!failed) return null;
  return `Skipped because the ${getSection(rootKey).label} extract failed. Nothing was changed in this section.`;
}

async function bumpProgress(db, extractionRunId, job) {
  const done = await db.extractionStep.count({
    where: {
      extractionRunId,
      status: { in: ["SUCCEEDED", "SKIPPED", "FAILED"] },
    },
  });
  const total = await db.extractionStep.count({ where: { extractionRunId } });

  await db.extractionRun.update({
    where: { id: extractionRunId },
    data: { stepsDone: done, stepsTotal: total },
  });

  await advanceExtractionRun({
    db,
    tenantId: job.tenantId,
    projectId: job.projectId,
    extractionRunId,
  });
}

export async function onExtractStepDead(job, errorMessage) {
  const { stepId, extractionRunId } = job.payload ?? {};
  if (!stepId || !extractionRunId) return;
  const { db } = await loadTenantContext(job.tenantId);
  await db.extractionStep.update({
    where: { id: stepId },
    data: {
      status: "FAILED",
      error: userFacingStepError(errorMessage) ?? errorMessage?.slice(0, 4000),
    },
  });
  await bumpProgress(db, extractionRunId, job);
}