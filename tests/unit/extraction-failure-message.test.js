import {
  noticeForSection,
  runFailureSummary,
  userFacingStepError,
} from "../../src/modules/project/extraction/failure-message.js";
import { normalizeGeminiError } from "../../src/modules/project/llm/gemini.provider.js";

describe("extraction failure messages", () => {
  test("503 becomes a retryable user-facing error", () => {
    const error = normalizeGeminiError(
      new Error(
        "[503 Service Unavailable] This model is currently experiencing high demand."
      )
    );
    expect(error.code).toBe("RATE_LIMIT");
    expect(error.retryAfterMs).toBe(30_000);
    expect(error.message).toMatch(/temporarily unavailable/);
  });

  test("quota stays retryable and readable", () => {
    const error = normalizeGeminiError(new Error("429 Too Many Requests"));
    expect(error.code).toBe("RATE_LIMIT");
    expect(userFacingStepError(error.message)).toMatch(/quota was reached/);
  });

  test("run summary names how many sections failed", () => {
    const summary = runFailureSummary([
      { sectionKey: "contract", status: "FAILED", error: "503 Service Unavailable" },
      { sectionKey: "genotype", status: "FAILED", error: "503 Service Unavailable" },
      { sectionKey: "todo", status: "SUCCEEDED", error: null },
    ]);
    expect(summary).toMatch(/2 sections could not be extracted/);
    expect(summary).toMatch(/temporarily unavailable/);
  });

  test("a failed section message is shown and an empty success is explained", () => {
    const steps = [
      { sectionKey: "contract", status: "FAILED", error: "503 high demand" },
      { sectionKey: "genotype", status: "SUCCEEDED", error: null },
    ];
    expect(noticeForSection(steps, "contract", 0, "PARTIAL")).toMatch(/temporarily unavailable/);
    expect(noticeForSection(steps, "genotype", 0, "PARTIAL")).toMatch(/no fields were saved/);
    expect(noticeForSection(steps, "genotype", 4, "PARTIAL")).toBeNull();
    expect(noticeForSection(steps, "contract", 0, "RUNNING")).toBeNull();
  });

  test("overview explains an unfinished run when it has no steps", () => {
    expect(noticeForSection([], "project_overview", 0, "PARTIAL")).toMatch(/did not complete/);
    expect(noticeForSection([], "project_overview", 0, "SUCCEEDED")).toBeNull();
  });
});
