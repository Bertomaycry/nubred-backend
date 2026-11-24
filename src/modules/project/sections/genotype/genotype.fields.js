import { field, group } from "../field-tree/index.js";

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const genotypeFieldTree = {
  sectionKey: "genotype",
  contextFields: ["contract.varieties"],
  children: [
    group({
      key: "species",
      label: "Species information",
      children: [
        field({ key: "species_name", label: "Species name", type: "string" }),
        field({ key: "latin_name", label: "Latin name", type: "string", combo: "species" }),
      ],
    }),
    group({
      key: "genotype",
      label: "Genotype",
      repeatable: true,
      identity: ["existing_genotype", "genotype_name"],
      children: [
        field({
          key: "existing_genotype",
          label: "Existing genotype",
          type: "ref",
          ref: { section: "genotype", group: "genotype" },
        }),
        field({
          key: "genotype_name",
          label: "Genotype name",
          type: "string",
          derive: { from: ["existing_genotype"], fn: "copyGenotypeName" },
          combo: "names",
        }),
        field({
          key: "other_names_or_codes",
          label: "Other names or codes",
          type: "list",
          derive: { from: ["existing_genotype"], fn: "copyGenotypeAliases" },
          combo: "names",
        }),
        field({
          key: "type",
          label: "Type",
          type: "option",
          options: ["Reference", "Candidate"],
        }),
      ],
    }),
  ],
};