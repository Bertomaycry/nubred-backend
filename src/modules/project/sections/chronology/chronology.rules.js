/**
 * Confirmation rules for the Chronology section.
 * Source spec: Doc F, Section — Chronology: "What blocks implementation"
 *
 * Chronology is a DERIVER section — it does not run an LLM extraction pass
 * over the source documents directly. Events are aggregated from other
 * sections' output and document metadata.
 *
 * Doc F: "Nothing blocks the data model — chronology events are generated as
 * a side effect of all other section analyses. The UI tab is added when the
 * frontend is ready."
 */
export const chronologyRules = {
  blocking: [
    {
      id: "unresolved_conflicts",
      type: "NO_CONFLICTS",
      message: "All Conflicting event dates must be resolved before confirming.",
    },
  ],

  warnings: [
    {
      id: "all_events_inferred",
      type: "CUSTOM",
      message:
        "All chronology events have INFERRED date precision. " +
          "Upload dated documents (signed contracts, certificates) to improve timeline accuracy.",
      check({ extraction }) {
        const events = extraction?.events ?? [];
        if (events.length === 0) return false;
        return events.every((e) => e.date_precision === "INFERRED");
      },
    },
    {
      id: "no_events",
      type: "CUSTOM",
      message:
        "No chronology events have been generated. " +
          "Complete and confirm the Contract and Phase sections first — " +
          "events are derived from those sections' output.",
      check({ extraction }) {
        return (extraction?.events?.length ?? 0) === 0;
      },
    },
  ],

  reviewTabs: [
    { id: "timeline", label: "Timeline", order: 1 },
  ],
};
