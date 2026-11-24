import { field, group } from "../field-tree/index.js";

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const ipRightFieldTree = {
  sectionKey: "ip_right",
  contextFields: ["contract.parties", "genotype.genotype_name"],
  children: [
    group({
      key: "ip_right",
      label: "IP right",
      repeatable: true,
      identity: ["ip_right_name", "type"],
      children: [
        field({
          key: "type",
          label: "Type",
          type: "option",
          options: ["Plant Breeder Right", "Patent", "Trademark"],
        }),
        field({ key: "ip_right_name", label: "IP right name", type: "string" }),
        field({
          key: "linked_genotypes",
          label: "Linked genotypes",
          type: "ref_multi",
          ref: { section: "genotype", group: "genotype" },
        }),
        field({ key: "office", label: "Office", type: "option", options: ["CPVO", "EUIPO", "EPO", "WIPO", "USPTO", "Other"], combo: "jurisdiction" }),
        field({ key: "territorial_scope", label: "Territorial scope", type: "option_multi", options: ["ISO3166"], combo: "jurisdiction" }),
        field({
          key: "status",
          label: "Status",
          type: "option",
          options: [
            "Application in process",
            "Granted and in force",
            "Ended after grant",
            "Ended before grant",
          ],
        }),
        field({ key: "filing_company", label: "Filing company", type: "ref", ref: { section: "supply_chain", group: "company" } }),
        field({ key: "holder", label: "Holder", type: "ref", ref: { section: "supply_chain", group: "company" } }),
        field({ key: "filing_application_number", label: "Filing application number", type: "string", combo: "filing" }),
        field({ key: "filing_date", label: "Filing date", type: "date", combo: "filing" }),
        field({
          key: "grant_number",
          label: "Grant or registration number",
          type: "string",
          showIf: { field: "status", in: ["Granted and in force", "Ended after grant"] },
          combo: "grant",
        }),
        field({
          key: "grant_date",
          label: "Grant or registration date",
          type: "date",
          showIf: { field: "status", in: ["Granted and in force", "Ended after grant"] },
          combo: "grant",
        }),
        field({ key: "expiry_date", label: "Expiry date", type: "date" }),
      ],
    }),
  ],
};