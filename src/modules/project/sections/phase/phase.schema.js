import { z } from "zod";
import { evidenceArraySchema } from "../_shared/evidence.schema.js";

// ---------------------------------------------------------------------------
// Phase section schema
// Source specs:
//   Doc B V1 — Project Structure & Phase Gates (gate logic, no mandatory start, Capitolato)
//   Doc F V2 — Project Creation Flow (phase definitions)
//   Doc K V3 — Protocols & Observations (phase gate entity fields)
// ---------------------------------------------------------------------------

export const PHASE_TYPES = [
  "TRIAL",   // Screen multiple Selections, no commercial activity
  "PILOT",   // Semi-commercial validation (~0.5–1 ha)
  "LAUNCH",  // First commercial season, royalties begin
  "SCALE",   // Expansion commercial phase
  "CUSTOM",  // Non-standard phase — NuBred service (not self-service UI), configure with NuBred team
];

// Phase category derived from Doc B — Experimental vs Commercial is the critical architectural
// distinction for protocol type, royalty logic, and gate rules. Must be explicit.
export const PHASE_CATEGORIES = [
  "EXPERIMENTAL", // Trial + Pilot — scientific evaluation, no royalties, Observational protocol
  "COMMERCIAL",   // Launch + Scale — royalties active, Commercial protocol, Capitolato applies
];

export const GENOTYPE_DECISIONS = [
  "PROMOTE",  // Advance to next phase
  "REPEAT",   // Continue current phase — more data needed
  "DISCARD",  // Remove from active development (archived, never deleted)
];

const genotypeDecisionSchema = z.object({
  genotype_name: z
    .string()
    .describe("Variety or selection name as it appears in the document."),
  decision: z
    .enum(GENOTYPE_DECISIONS)
    .describe("VM decision recorded in the document."),
  decision_date: z
    .string()
    .nullable()
    .describe("Date of the decision in ISO 8601 format. Null if only the season is stated."),
  notes: z
    .string()
    .nullable()
    .describe("Any conditions or context attached to the decision."),
});

const phaseEntrySchema = z.object({
  name: z
    .string()
    .nullable()
    .describe(
      "Phase name as stated in the contract or protocol. " +
        "Preserve the original name even if it maps to a NuBred standard phase. " +
        "Example: 'Evaluation Period', 'VCU Phase', 'Commercial Introduction'."
    ),

  type: z
    .enum(PHASE_TYPES)
    .nullable()
    .describe(
      "NuBred standard phase type this phase maps to. " +
        "Use the phase-framework mapping table to determine the correct type. " +
        "Use CUSTOM only for explicitly non-standard phases that cannot be mapped."
    ),

  phase_category: z
    .enum(PHASE_CATEGORIES)
    .nullable()
    .describe(
      "High-level category from Doc B. " +
        "EXPERIMENTAL for Trial and Pilot (no royalties, Observational protocol applies). " +
        "COMMERCIAL for Launch and Scale (royalties active, Commercial protocol applies, Capitolato mandatory). " +
        "Always derive from `type`: TRIAL/PILOT → EXPERIMENTAL; LAUNCH/SCALE → COMMERCIAL; CUSTOM → null."
    ),

  type_mapping_note: z
    .string()
    .nullable()
    .describe(
      "If the original name differs from the NuBred type, explain the mapping. " +
        "Example: 'Evaluation Period → TRIAL: no commercial activity, VCU objectives per Art. 3'."
    ),

  objective: z
    .string()
    .nullable()
    .describe(
      "Phase objective as described in the contract. " +
        "Use the contract's own language (translated to English if needed)."
    ),

  duration: z
    .string()
    .nullable()
    .describe(
      "Duration as stated — preserve the contract's unit. " +
        "Examples: '4 growing seasons', '2 calendar years', 'until Release Date + 24 months'."
    ),

  start_trigger: z
    .string()
    .nullable()
    .describe(
      "What triggers the start of this phase. " +
        "Example: 'Release Date notified by IVM', 'contract effective date', 'VM activation decision'. " +
        "Note: a project can start at any phase — there is no mandatory starting point (Doc B §Decided)."
    ),

  location: z
    .string()
    .nullable()
    .describe(
      "Geographic location where this phase takes place, if specified. " +
        "Keep the original wording (sites, regions, cities). Do not replace this with country codes."
    ),

  countries: z
    .array(z.string())
    .default([])
    .describe(
      "ISO 3166-1 alpha-2 country codes for every country where this phase takes place. " +
        "Derive from `location` and from the contract production territory when the phase " +
        "is clearly tied to that territory. Uppercase two-letter codes only " +
        "(e.g. ['ES','PT']). One phase may list several countries. " +
        "Empty array if no country can be determined. Never invent countries."
    ),

  plant_count: z
    .number()
    .int()
    .nullable()
    .describe("Number of plants for this phase, if specified."),

  hectares: z
    .number()
    .nullable()
    .describe("Area in hectares for this phase, if specified."),

  gate_criteria: z
    .array(z.string())
    .describe(
      "Gate conditions that must be met before the project can advance from this phase. " +
        "List both NuBred standard gate conditions (from the Phase Framework) and any project-specific " +
        "conditions stated in the contract. Each entry is one condition. " +
        "Standard gates by phase type (Doc B): " +
        "TRIAL→PILOT: all protocol observations completed + VM Promote/Repeat/Discard per genotype. " +
        "PILOT→LAUNCH: observations completed + production forecast validated + Capitolato (Quality Specification) defined — " +
          "Capitolato is a HARD gate, Launch is blocked until it is defined. " +
        "LAUNCH→SCALE: production forecast validated + royalty reporting complete + VM advance confirmation."
    ),

  capitolato_defined: z
    .boolean()
    .nullable()
    .describe(
      "Whether the Quality Specification (Capitolato) has been defined for this phase. " +
        "Only relevant for PILOT phase — it is a hard gate for PILOT→LAUNCH advancement (Doc B §Decided). " +
        "Null for TRIAL, LAUNCH, SCALE phases."
    ),

  genotype_decisions: z
    .array(genotypeDecisionSchema)
    .describe(
      "Promote / Repeat / Discard decisions for individual genotypes, " +
        "if documented in the contract or meeting notes."
    ),
});

export const phaseExtractionSchema = z.object({
  phases: z
    .array(phaseEntrySchema)
    .describe(
      "All phases identified across all uploaded documents for this project. " +
        "Order phases chronologically. " +
        "A project with no phases cannot be confirmed — at least one active phase is required."
    ),

  evidence: evidenceArraySchema,
});
