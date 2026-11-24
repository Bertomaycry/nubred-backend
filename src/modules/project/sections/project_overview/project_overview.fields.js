import { field, group } from "../field-tree/index.js";

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const projectOverviewFieldTree = {
  sectionKey: "project_overview",
  contextFields: ["*"],
  children: [
    field({ key: "project_name", label: "Project name", type: "string" }),
    field({ key: "commercial_objective", label: "Commercial objective", type: "text" }),
    field({
      key: "start_date",
      label: "Start date",
      type: "date",
      derive: { from: ["contract.term", "phase"], fn: "overviewStartDate" },
      combo: "period",
    }),
    field({
      key: "end_date",
      label: "End date",
      type: "date",
      derive: { from: ["contract.term", "phase"], fn: "overviewEndDate" },
      combo: "period",
    }),
    field({
      key: "species",
      label: "Species",
      type: "string",
      derive: { from: ["genotype.species"], fn: "overviewSpecies" },
    }),
    field({
      key: "candidate_genotypes",
      label: "Candidate genotypes",
      type: "int",
      derive: { from: ["genotype"], fn: "overviewCandidateCount" },
      combo: "genotype_counts",
    }),
    field({
      key: "reference_genotypes",
      label: "Reference genotypes",
      type: "int",
      derive: { from: ["genotype"], fn: "overviewReferenceCount" },
      combo: "genotype_counts",
    }),
    field({
      key: "signed_contracts",
      label: "Signed contracts",
      type: "int",
      derive: { from: ["contract"], fn: "overviewSignedContracts" },
      combo: "contract_counts",
    }),
    field({
      key: "unsigned_contracts",
      label: "Unsigned contracts",
      type: "int",
      derive: { from: ["contract"], fn: "overviewUnsignedContracts" },
      combo: "contract_counts",
    }),
    field({
      key: "test_countries",
      label: "Test countries",
      type: "option_multi",
      options: ["ISO3166"],
      derive: { from: ["phase.location"], fn: "overviewTestCountries" },
    }),
    field({
      key: "destination_countries",
      label: "Destination countries",
      type: "option_multi",
      options: ["ISO3166"],
      derive: { from: ["phase.location"], fn: "overviewDestinationCountries" },
    }),
    field({
      key: "current_phase",
      label: "Current phase",
      type: "ref",
      ref: { section: "phase" },
      derive: { from: ["phase"], fn: "overviewCurrentPhase" },
    }),
  ],
};