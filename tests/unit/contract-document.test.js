import { contractOnlyDecision, isContractDocument } from "../../src/modules/project/extraction/plan-run.js";
import { MODEL_UNAVAILABLE_MESSAGE } from "../../src/modules/project/extraction/failure-message.js";

const contractSection = { contractOnly: true };
const otherSection = { contractOnly: false };
const classifiedAt = new Date("2026-11-24T00:00:00.000Z");

describe("isContractDocument", () => {
  test("a licence agreement is a contract", () => {
    expect(isContractDocument({ detectedType: "licence agreement", documentType: "OTHER" })).toBe(true);
    expect(isContractDocument({ detectedType: "Exclusive variety license", signed: false })).toBe(true);
  });

  test("an uploaded contract type still counts when triage used another label", () => {
    expect(
      isContractDocument({ detectedType: "OTHER", documentType: "SIGNED_CONTRACT", signed: false })
    ).toBe(true);
  });

  test("a signed protocol is still a protocol", () => {
    expect(isContractDocument({ detectedType: "PROTOCOL", signed: true })).toBe(false);
  });

  test("a classified protocol is skipped", () => {
    expect(isContractDocument({ detectedType: "protocol", documentType: "PROTOCOL_DOCUMENT" })).toBe(false);
    expect(
      contractOnlyDecision(contractSection, {
        detectedType: "protocol",
        documentType: "OTHER",
        triagedAt: classifiedAt,
      })
    ).toBe("skip");
  });

  test("a file triage never classified is not treated as a non-contract", () => {
    expect(
      contractOnlyDecision(contractSection, {
        detectedType: null,
        documentType: "OTHER",
        triagedAt: null,
        failureReason: MODEL_UNAVAILABLE_MESSAGE,
      })
    ).toBe("unclassified");
  });

  test("non-contract sections are never skipped by this check", () => {
    expect(contractOnlyDecision(otherSection, { detectedType: "protocol" })).toBe("run");
  });
});
