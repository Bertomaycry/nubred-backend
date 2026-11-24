import { field, group } from "../field-tree/index.js";

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const phaseFieldTree = {
  sectionKey: "phase",
  contextFields: ["contract", "genotype", "supply_chain"],
  children: [
    group({
      key: "phase",
      label: "Phase",
      repeatable: true,
      identity: ["phase_name", "phase_type"],
      children: [
        field({ key: "phase_name", label: "Phase name", type: "string" }),
        field({ key: "phase_type", label: "Phase type", type: "option", options: ["Trial", "Pilot", "Launch", "Scale"] }),
        field({ key: "objective", label: "Objective", type: "text" }),
        field({ key: "duration_harvest_years", label: "Duration (harvest years)", type: "int" }),
        field({ key: "plants_per_genotype", label: "Number of plants per genotype", type: "int" }),
        group({
          key: "location",
          label: "Location",
          repeatable: true,
          children: [
            field({ key: "contract", label: "Contract", type: "ref", ref: { section: "contract" } }),
            field({
              key: "responsible_company",
              label: "Responsible company",
              type: "ref",
              ref: { section: "supply_chain", group: "company" },
              derive: { from: ["contract"], fn: "phaseResponsibleCompany" },
            }),
            field({ key: "country", label: "Country", type: "option", options: ["ISO3166"], combo: "place" }),
            field({ key: "planting_site", label: "Planting site", type: "string", combo: "place" }),
          ],
        }),
        group({
          key: "batch",
          label: "Batch",
          repeatable: true,
          children: [
            field({
              key: "batch_number",
              label: "Batch number",
              type: "string",
              derive: { from: ["phase", "batch"], fn: "phaseBatchNumber" },
            }),
            field({ key: "genotypes_in_batch", label: "Genotypes in batch", type: "ref_multi", ref: { section: "genotype" } }),
            group({
              key: "start_per_location",
              label: "Start per location",
              repeatable: true,
              children: [
                field({
                  key: "location",
                  label: "Location",
                  type: "ref",
                  ref: { section: "phase", group: "location" },
                  derive: { from: ["location"], fn: "phaseBatchLocation" },
                }),
                field({ key: "start_date", label: "Start date", type: "date", combo: "period" }),
                field({
                  key: "end_date",
                  label: "End date",
                  type: "date",
                  derive: { from: ["start_date", "duration_harvest_years"], fn: "phaseBatchEnd" },
                  combo: "period",
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
};