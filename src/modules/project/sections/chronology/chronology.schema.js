import { z } from "zod";
import { evidenceArraySchema } from "../_shared/evidence.schema.js";

// ---------------------------------------------------------------------------
// Chronology section schema
// Source spec: Doc F, Section — Chronology (Roadmap — data model active)
//
// IMPORTANT: Chronology is a DERIVER section, not an extractor.
// Chronology events are generated as a SIDE EFFECT of the other four sections'
// analysis — the AI does not run a separate extraction pass over the source
// documents for this section.
//
// The derive() function (step 9) aggregates dated events emitted by:
//   - Contract: effective_date, end_date, phase start triggers, option windows
//   - Genotype: IP filing dates, PBR grant dates
//   - Phase: phase advancement decisions, gate passage dates
//   - Protocol: observation milestone dates
//
// Plus a light metadata sweep is run on document metadata (file creation date,
// email headers) to pick up any dates not captured by the other sections.
// ---------------------------------------------------------------------------

export const EVENT_TYPES = [
  "CONTRACT_SIGNATURE",       // Contract effective date or date of signing
  "CONTRACT_AMENDMENT",       // Addendum or amendment execution date
  "PHASE_ADVANCEMENT",        // VM decision to advance a phase (Promote / Repeat / Discard)
  "PHASE_START",              // Phase officially begins
  "PHASE_GATE",               // Gate condition met or reviewed
  "IP_FILING",                // PBR, patent, or trademark application filed
  "IP_GRANT",                 // PBR, patent, or trademark granted
  "IP_EXPIRY",                // PBR or patent expiry (actual or projected)
  "QUARANTINE_START",         // Quarantine period begins
  "QUARANTINE_CERTIFICATION", // Quarantine certification received
  "HARVEST_DECLARATION",      // Harvest actual declared
  "OBSERVATION_MILESTONE",    // Key protocol observation completed
  "MEETING_DECISION",         // Decision made in a recorded meeting
  "EMAIL_EXCHANGE",           // Relevant email exchange (for Connected Sources)
  "ROYALTY_PAYMENT",          // Royalty payment made or due
  "OPTION_EXERCISE",          // Option exercised by IVM
  "OTHER",                    // Any other datable event not covered above
];

export const DATE_PRECISIONS = [
  "EXACT",      // Explicit date in a signed document
  "ESTIMATED",  // From email, meeting notes, or non-binding source
  "INFERRED",   // Calculated from relative references ('in the first year of Trial')
];

const chronologyEventSchema = z.object({
  event_type: z
    .enum(EVENT_TYPES)
    .describe("Category of the event."),
  description: z
    .string()
    .describe(
      "Plain-language description of what happened. " +
        "Concise but specific: who, what, which variety or phase where relevant. " +
        "Example: 'CIV and Agropro Ltd. executed the IVM Evaluation Agreement (F6) for 3 kiwifruit NPVs.'"
    ),
  date: z
    .string()
    .nullable()
    .describe(
      "Event date in ISO 8601. Use the most precise format available: " +
        "YYYY-MM-DD for exact dates, YYYY-MM for month-level, YYYY for year-level. " +
        "For INFERRED events with only a range, use the earliest plausible date and describe the range in `date_notes`."
    ),
  date_precision: z
    .enum(DATE_PRECISIONS)
    .describe(
      "EXACT: date stated explicitly in a signed document or official certificate. " +
        "ESTIMATED: from email, meeting notes, or non-binding source. " +
        "INFERRED: calculated from relative references — describe the basis in `date_notes`."
    ),
  date_notes: z
    .string()
    .nullable()
    .describe(
      "Additional context about the date precision. Required when `date_precision` is INFERRED. " +
        "Example: 'Inferred from contract start date + 4 growing seasons stated in Art. 3.2'."
    ),
  actor: z
    .string()
    .nullable()
    .describe(
      "The NuBred actor role primarily responsible for or involved in this event. " +
        "Use a role from the Glossary: 'IVM', 'Breeder', 'Licensed Grower', etc."
    ),
  source_section: z
    .string()
    .nullable()
    .describe(
      "Which section generated this event. One of: 'contract', 'genotype', 'phase', 'protocol', 'document_metadata'."
    ),
  linked_entity_type: z
    .string()
    .nullable()
    .describe(
      "Type of the primary related entity. Examples: 'contract', 'phase', 'ip_right', 'genotype'."
    ),
  linked_entity_ref: z
    .string()
    .nullable()
    .describe(
      "Human-readable reference to the linked entity. " +
        "Example: 'IVM Evaluation Agreement (F6)', 'Trial phase — Variety A', 'CPVO 44847'."
    ),
});

export const chronologyExtractionSchema = z.object({
  events: z
    .array(chronologyEventSchema)
    .describe(
      "All datable events aggregated across all other sections for this project. " +
        "Ordered chronologically (oldest first). " +
        "Events with the same date are ordered by event_type specificity: " +
        "CONTRACT_SIGNATURE before PHASE_START before IP_FILING."
    ),

  evidence: evidenceArraySchema,
});
