import { z } from "zod";
import { evidenceArraySchema } from "../_shared/evidence.schema.js";

// ---------------------------------------------------------------------------
// Genotype section schema
// Source spec: Doc F, Section 2 — Genotype
// ---------------------------------------------------------------------------

export const DEVELOPMENT_STATUSES = [
  "SELECTION", // No IP protection. May become a Variety.
  "VARIETY",   // Plant variety protection granted (PBR/CPVR/equivalent).
  "UNKNOWN",   // Status not determinable from available documents — flag for VM
];

const genotypeEntrySchema = z.object({
  name: z
    .string()
    .nullable()
    .describe(
      "Variety or selection name exactly as stated in the contract or protocol. " +
        "Use the most complete form found — commercial name preferred over breeder code if both exist."
    ),
  breeder_code: z
    .string()
    .nullable()
    .describe(
      "Internal breeder code if distinct from the commercial name. " +
        "Example: 'CIV/08', 'CVRI-14A'. Null if only one identifier is used."
    ),
  species_botanical: z
    .string()
    .nullable()
    .describe(
      "Botanical name of the species this genotype belongs to. " +
        "Example: 'Actinidia chinensis', 'Prunus avium', 'Fragaria × ananassa'."
    ),
  species_common: z
    .string()
    .nullable()
    .describe("Common name of the species. Example: 'kiwifruit', 'sweet cherry', 'strawberry'."),
  development_status: z
    .enum(DEVELOPMENT_STATUSES)
    .nullable()
    .describe(
      "SELECTION if no IP protection has been granted. " +
        "VARIETY if plant variety protection (PBR, CPVR, or equivalent national right) exists. " +
        "Confirmed from PBR certificate if uploaded; otherwise inferred from contract language."
    ),
  number_of_plants: z
    .number()
    .int()
    .nullable()
    .describe(
      "Total number of plants of this genotype declared in the planting plan or contract. " +
        "Null if not specified."
    ),
  linked_phases: z
    .array(z.string())
    .describe(
      "Phase names (using NuBred standard phase types: TRIAL, PILOT, LAUNCH, SCALE) " +
        "that this genotype participates in, as stated in the contract or protocol."
    ),
  ip_reference: z
    .string()
    .nullable()
    .describe(
      "PBR grant number, application number, or patent reference if found in the documents. " +
        "Example: 'CPVO 44847'. Null if IP details are not present for this genotype."
    ),
  notes: z
    .string()
    .nullable()
    .describe(
      "Any additional context specific to this genotype that does not fit the other fields. " +
        "Example: 'Listed in Annex 5 — full details in IP schedule', 'EDV relationship noted in Art. 7'."
    ),
});

export const genotypeExtractionSchema = z.object({
  /**
   * Top-level species context — applies when all or most genotypes in this
   * contract share the same species. If genotypes span multiple species,
   * set these to null and use the per-genotype species fields.
   */
  primary_species_botanical: z
    .string()
    .nullable()
    .describe(
      "Botanical name of the primary species covered by this project. " +
        "Set at the top level when all genotypes share the same species."
    ),
  primary_species_common: z
    .string()
    .nullable()
    .describe("Common name of the primary species."),

  genotypes: z
    .array(genotypeEntrySchema)
    .describe(
      "All genotypes (varieties and selections) identified across all uploaded documents. " +
        "Each genotype appears once — merge duplicates that refer to the same genetic identity " +
        "(e.g. same variety referred to by breeder code in one document and commercial name in another). " +
        "When merging, cite both name forms in `notes` and list both documents in `evidence`."
    ),

  evidence: evidenceArraySchema,
});
