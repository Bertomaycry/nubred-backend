/**
 * Confirmation blocking rules for the Contract section.
 *
 * Each rule is a descriptor that the review API (step 7) evaluates.
 * Rules are checked server-side — the frontend must never be the only gate.
 *
 * Rule types:
 *   REQUIRED_NON_EMPTY  — a specified array field must have at least one element
 *   NO_CONFLICTS        — no field in this section may have confidence = CONFLICTING
 *   REVIEW_STATE        — a named boolean in the section's review state must be true
 *   CUSTOM              — the api implements the check by calling the `check` function
 *
 * Blocking rules prevent calling `POST /api/projects/:id/sections/contract/confirm`.
 * Warning rules allow confirmation but log the acknowledgement.
 */

export const contractRules = {
  /**
   * Rules that BLOCK confirmation until resolved.
   * Conflicting fields always block — this is enforced globally for every section
   * by the review API; it does not need to be repeated per section.
   */
  blocking: [
    {
      id: "no_parties",
      type: "REQUIRED_NON_EMPTY",
      fieldPath: "parties",
      message:
        "At least one party must be identified before the Contract section can be confirmed.",
    },
    {
      id: "gaps_tab_not_viewed",
      type: "REVIEW_STATE",
      key: "gapsTabViewed",
      message:
        "The Gaps tab must be viewed before confirming. " +
          "Open the Gaps tab to review all ABSENCE, ANOMALY, and IMBALANCE findings.",
    },
    {
      id: "missing_required_extraction_fields",
      type: "CUSTOM",
      message:
        "Required contract fields are missing and must be filled manually before confirming.",
      /**
       * @param {{ extraction: import('./contract.schema.js').ContractExtraction }} context
       * @returns {boolean} true if this rule BLOCKS confirmation
       */
      check({ extraction }) {
        if (!extraction) return true; // no extraction at all — block
        // Parties with UNKNOWN role must be resolved
        const hasUnknownParty = extraction.parties?.some(
          (p) => p.role === "UNKNOWN"
        );
        return !!hasUnknownParty;
      },
    },
  ],

  /**
   * Rules that produce WARNINGS but do not block confirmation.
   * VM can confirm over a warning — the acknowledgement is logged.
   */
  warnings: [
    {
      id: "high_risk_flags",
      type: "CUSTOM",
      message:
        "This contract has HIGH severity findings. Review them before confirming.",
      check({ extraction }) {
        return extraction?.flags?.some((f) => f.severity === "HIGH") ?? false;
      },
    },
    {
      id: "low_confidence_classification",
      type: "CUSTOM",
      message:
        "Contract family classification confidence is below 0.7. " +
          "Verify the contract type is correct.",
      check({ extraction }) {
        return (extraction?.confidence_score ?? 1) < 0.7;
      },
    },
    {
      id: "provisional_financial_terms",
      type: "CUSTOM",
      message:
        "Financial terms (royalty rate or entry fee) are sourced from a non-binding document. " +
          "Upload the signed contract to confirm these values.",
      check({ fieldConfidences }) {
        const financialPaths = [
          "financial_terms.royalty_structure",
          "financial_terms.entry_fee",
        ];
        return financialPaths.some(
          (p) => fieldConfidences?.[p] === "PROVISIONAL"
        );
      },
    },
  ],

  /**
   * The three-tab review structure for this section (Doc F spec).
   * Tab 3 (Gaps) must be marked as viewed before `gapsTabViewed` becomes true.
   */
  reviewTabs: [
    { id: "actors", label: "Actors", order: 1 },
    { id: "clause_analysis", label: "Clause Analysis", order: 2 },
    { id: "gaps", label: "Gaps", order: 3, mustViewBeforeConfirm: true },
  ],
};
