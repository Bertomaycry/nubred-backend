import { z } from "zod";
import { evidenceArraySchema } from "../_shared/evidence.schema.js";

// ---------------------------------------------------------------------------
// Protocol section schema
// Source specs:
//   Doc C V4 — Protocol & Parameter Schema (canonical reference for all enums)
//   Doc K V3 — Protocols & Observations Module (entity fields and API contract)
//   Doc F V2  — Project Creation Flow
// ---------------------------------------------------------------------------

// Eight fixed parameter families — never change (DocC §"The 8 Parameter Families").
// F8 Agronomic Operations was added in DocC V4; every previous version that listed F1-F7
// only is now obsolete. Do not remove F8.
export const PARAMETER_FAMILIES = [
  "F1", // Plant Characteristics — vigour, phenology, growth habit
  "F2", // Fruit Quality — Brix, firmness, colour, weight, bloom, organoleptic
  "F3", // Production — kg/plant or kg/ha, pack-out %, calibre distribution
  "F4", // Phytosanitary — pests, diseases, cracking, physiological disorders
  "F5", // Post-Harvest — shelf life, freshness, % damaged/rotten, weight loss
  "F6", // Climate — temperature, humidity, wind, radiation (contextual, no threshold)
  "F7", // Commercial — 4-measurement forecast cycle, royalty flows (Launch/Scale only)
  "F8", // Agronomic Operations — irrigation, fertilization, treatments, pruning, soil
        //   Not an observation — an operational log required for GLP-compliant trial reports.
];

// Two mutually exclusive protocol types (DocC §"Two Protocol Types").
// A project switching from Pilot to Launch does NOT continue the same protocol — it
// switches type entirely. These use different parameter families, frequencies, and outputs.
export const PROTOCOL_TYPES = [
  "OBSERVATIONAL", // Active in Trial & Pilot — scientific evaluation → Promote/Repeat/Discard
  "COMMERCIAL",    // Active in Launch & Scale — production tracking and royalty calculation
];

// Three parameter levels (DocC §"Three Levels of Parameters").
// Level controls scope; eliminatory_level controls enforcement — they are independent.
export const PARAMETER_LEVELS = [
  "UNIVERSAL",        // Level 1 — valid for all species, all phases; cannot be removed
  "SPECIES_STANDARD", // Level 2 — NuBred Registry per species; VM can raise threshold, never lower
  "PROJECT_CUSTOM",   // Level 3 — VM-defined for project-specific needs; does not affect other projects
];

// Eight canonical input types (DocC §"Input Types — Complete Definition").
// CRITICAL: Scale is NO LONGER hardcoded to 1–5. Always use scale_min/scale_max/scale_polarity.
// CRITICAL: Distribution stores a histogram (% per size class summing to 100%) — not a scalar.
export const INPUT_TYPES = [
  "NUMBER",       // Single numeric value with unit (Brix 11.2°, Weight 18.4g, Temp 22.6°C)
  "SCALE",        // Ordinal scale — configurable min/max (NOT hardcoded 1–5). Requires scale_min, scale_max, scale_polarity.
  "OPTION",       // Predefined list (BBCH stage, UPOV growth habit descriptor, insolation)
  "DISTRIBUTION", // Histogram — % values per size class, must sum to 100% (calibre distribution)
  "DATE",         // Calendar date of an event (first flowering, first harvest, last harvest)
  "BOOLEAN",      // Yes / No — always eliminatory when used as a threshold
  "PHOTO",        // Camera capture stored in Cloudinary; linked to observation session and genotype
  "TEXT",         // Free text — incident notes, unclassified pest identification, observer comments
];

// Four frequency types (DocC §"Frequency Types").
// Calendar-fixed was the ONLY type in previous versions. Event-based and Phase-gate are new
// and are required for protocols like the ALSIA strawberry report.
export const FREQUENCY_TYPES = [
  "CALENDAR_FIXED", // Triggered on a fixed schedule: daily, weekly, bi-weekly, monthly
  "EVENT_BASED",    // Triggered by a biological or agronomic event (harvest, BBCH stage transition)
  "PHASE_GATE",     // Observation required before phase advancement; blocks Promote until complete
  "ON_DEMAND",      // Manually triggered by VM or Field Observer for anomalies / incidents
];

// Scale polarity — required when input_type is SCALE (DocC §"Input Types").
export const SCALE_POLARITIES = [
  "HIGHER_BETTER", // Higher value = better (e.g. Firmness, Vigour)
  "LOWER_BETTER",  // Lower value = better (e.g. Disease severity, Cracking %)
];

// ---------------------------------------------------------------------------
// Parameter schema (maps to ProtocolParameter entity in DocK §"Backend Data Model")
// ---------------------------------------------------------------------------

const observationParameterSchema = z.object({
  name: z
    .string()
    .describe(
      "Parameter name exactly as stated in the protocol document. " +
        "If non-standard terminology is used, preserve the original name here " +
        "and record the NuBred mapping in `nubred_standard_name`."
    ),

  nubred_standard_name: z
    .string()
    .nullable()
    .describe(
      "The NuBred standard parameter name this maps to (Glossary / Parameter Family tables). " +
        "Example: 'Soluble solids content' → 'Brix'. Null if name is already NuBred standard."
    ),

  parameter_family: z
    .enum(PARAMETER_FAMILIES)
    .nullable()
    .describe(
      "Parameter Family code (F1–F8). Assign based on measurement focus: " +
        "F1 plant structure, F2 fruit quality, F3 production volume, " +
        "F4 disease/pest, F5 post-harvest storage, F6 climate, " +
        "F7 commercial metrics (Launch/Scale only), " +
        "F8 agronomic operations (irrigation, fertilization, pruning — operational log, not observation)."
    ),

  parameter_level: z
    .enum(PARAMETER_LEVELS)
    .nullable()
    .describe(
      "Scope level from DocC §Three Levels. " +
        "UNIVERSAL: L1, all species, cannot be removed. " +
        "SPECIES_STANDARD: L2, from NuBred Registry for this species; VM can raise threshold, never lower. " +
        "PROJECT_CUSTOM: L3, VM-defined for this project only; stored as project-specific, does not affect others. " +
        "Null if level is not determinable from the document."
    ),

  input_type: z
    .enum(INPUT_TYPES)
    .nullable()
    .describe(
      "Canonical input type from DocC §Input Types. " +
        "Use SCALE (not NUMBER) for ordinal scales — always populate scale_min, scale_max, scale_polarity. " +
        "Use DISTRIBUTION for calibre or any histogram where categories must sum to 100%. " +
        "Use OPTION for BBCH stages, UPOV descriptors, or any fixed list. " +
        "Use NUMBER for all single quantitative measurements with a unit."
    ),

  // Scale-specific fields — only populated when input_type === 'SCALE'
  scale_min: z
    .number()
    .nullable()
    .describe(
      "Minimum value for SCALE input type (e.g. 1 for a 1–3 scale). " +
        "Null for all other input types. Do NOT assume 1 if not stated — mark null."
    ),

  scale_max: z
    .number()
    .nullable()
    .describe(
      "Maximum value for SCALE input type (e.g. 5 for a 1–5 scale, 3 for a 1–3 scale). " +
        "Null for all other input types."
    ),

  scale_polarity: z
    .enum(SCALE_POLARITIES)
    .nullable()
    .describe(
      "Direction of quality for SCALE type. " +
        "HIGHER_BETTER: higher score is better (Firmness, Vigour). " +
        "LOWER_BETTER: lower score is better (Disease severity, Cracking). " +
        "Null when input_type is not SCALE."
    ),

  how_to_measure: z
    .string()
    .nullable()
    .describe(
      "Measurement method as described in the protocol. " +
        "Example: 'Refractometer on juice extracted from min 5 fruits', " +
        "'Penetrometer with 0.5cm² tip — min 10 fruits', " +
        "'Visual assessment on 30 plants per plot per UPOV TG/13/10 descriptor 16'."
    ),

  unit: z
    .string()
    .nullable()
    .describe(
      "Unit of the measurement. Example: '°Brix', 'kg/0.5cm²', 'mm', 'g', 'kg/ha', '%', '°C'. " +
        "Null for input types with no numeric unit (SCALE, OPTION, BOOLEAN, PHOTO, TEXT)."
    ),

  frequency_type: z
    .enum(FREQUENCY_TYPES)
    .nullable()
    .describe(
      "Canonical frequency type from DocC §Frequency Types. " +
        "CALENDAR_FIXED for daily/weekly/monthly. " +
        "EVENT_BASED for per-harvest or per-BBCH-stage measurements. " +
        "PHASE_GATE for observations that block Promote until completed. " +
        "ON_DEMAND for anomaly or incident documentation."
    ),

  frequency_value: z
    .string()
    .nullable()
    .describe(
      "Human-readable frequency description from the protocol. " +
        "Example: 'Weekly during active season', 'Per harvest event', " +
        "'3× per season: fruit set, 60 days pre-harvest, harvest', " +
        "'Daily — continuous weather station logging'."
    ),

  data_collection_window: z
    .string()
    .nullable()
    .describe(
      "Timing window for data collection. " +
        "Example: 'BBCH 71–89', 'Within 7 days of commercial harvest', " +
        "'At 4, 8, 12, 16 weeks in cold storage (0–1°C)'."
    ),

  sample_size: z
    .string()
    .nullable()
    .describe(
      "Number of plants, fruit, or plots per measurement. " +
        "Example: '30 fruit per plot', '10 plants per genotype', 'min 50 fruits per sample'."
    ),

  threshold: z
    .string()
    .nullable()
    .describe(
      "Minimum, maximum, or target value as stated in the protocol. " +
        "Include the threshold type in the string: " +
        "'Quantitative Absolute: ≥11.5°Brix', 'Quantitative Relative: ≥15% above Benchmark', " +
        "'UPOV Qualitative: class ≥5 for firmness', 'Boolean: No quarantine pathogen detected'."
    ),

  threshold_type: z
    .string()
    .nullable()
    .describe(
      "Classification of the threshold. Use the protocol's language if explicit, otherwise one of: " +
        "'Quantitative absolute', 'Quantitative relative vs benchmark', " +
        "'UPOV qualitative', 'Boolean eliminatory'. " +
        "Null if no threshold is defined."
    ),

  // eliminatory_level encodes both whether it is eliminatory AND its level.
  // null  → parameter is NOT eliminatory
  // 'L1'  → universal, NuBred fixed, no VM override possible (e.g. PSA for yellow kiwi)
  // 'L2'  → species-standard; VM can raise threshold, never lower
  // 'L3'  → project-custom, VM-defined
  eliminatory_level: z
    .enum(["L1", "L2", "L3"])
    .nullable()
    .describe(
      "Eliminatory level. Null means the parameter is NOT eliminatory. " +
        "L1 = Universal (NuBred fixed, no VM override — e.g. PSA for yellow kiwi). " +
        "L2 = Species-standard (NuBred proposes; VM can raise threshold, never lower). " +
        "L3 = Project-custom (VM-defined for this project only). " +
        "Set when the protocol states a fail condition, discard trigger, or mandatory threshold breach."
    ),
});

// ---------------------------------------------------------------------------
// Protocol entry schema (maps to Protocol entity in DocK §"Backend Data Model")
// ---------------------------------------------------------------------------

const protocolEntrySchema = z.object({
  name: z
    .string()
    .nullable()
    .describe(
      "Protocol name as stated in the document. " +
        "Example: 'VCU Evaluation Protocol — Kiwifruit', 'Pilot Phase Observation Schedule'."
    ),

  objective: z
    .string()
    .nullable()
    .describe("Protocol objective in one or two sentences."),

  protocol_type: z
    .enum(PROTOCOL_TYPES)
    .nullable()
    .describe(
      "OBSERVATIONAL for Trial and Pilot phases — scientific evaluation, outputs Promote/Repeat/Discard decision and trial report. " +
        "COMMERCIAL for Launch and Scale phases — production tracking and royalty calculation, uses F7 4-measurement forecast cycle. " +
        "A project does NOT continue the Observational protocol into Launch — it switches to Commercial entirely. " +
        "If the document spans both phases, extract two separate protocol entries."
    ),

  linked_phase: z
    .string()
    .nullable()
    .describe(
      "NuBred phase type this protocol governs (TRIAL, PILOT, LAUNCH, SCALE, CUSTOM). " +
        "Must be consistent with protocol_type: OBSERVATIONAL → TRIAL or PILOT; COMMERCIAL → LAUNCH or SCALE."
    ),

  source_document: z
    .string()
    .nullable()
    .describe(
      "Name of the document this protocol was extracted from. " +
        "Example: 'Trial Agreement — Annex 7', 'VCU Protocol v2.1', 'Kiwi Protocol Schedule B'."
    ),

  parameters: z
    .array(observationParameterSchema)
    .describe(
      "All observation parameters in this protocol. " +
        "At least one parameter is required for a protocol to be confirmable. " +
        "For F8 parameters, extract as separate entries with parameter_family='F8' and input_type=TEXT or NUMBER. " +
        "Include both Observational and F8 parameters in OBSERVATIONAL protocol entries."
    ),
});

// ---------------------------------------------------------------------------
// Root extraction schema
// ---------------------------------------------------------------------------

export const protocolExtractionSchema = z.object({
  protocols: z
    .array(protocolEntrySchema)
    .describe(
      "All protocols identified across all uploaded documents. " +
        "Split OBSERVATIONAL and COMMERCIAL protocols into separate entries even if the source document combines them. " +
        "A protocol must have at least one parameter to be valid."
    ),

  evidence: evidenceArraySchema,
});
