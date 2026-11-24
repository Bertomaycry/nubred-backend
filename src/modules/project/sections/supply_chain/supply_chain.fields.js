import { field, group } from "../field-tree/index.js";

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const supplyChainFieldTree = {
  sectionKey: "supply_chain",
  contextFields: ["contract.parties"],
  children: [
    group({
      key: "company",
      label: "Company",
      repeatable: true,
      identity: ["company_name"],
      children: [
        field({ key: "company_name", label: "Company name", type: "string" }),
        field({
          key: "company_type",
          label: "Company type",
          type: "option",
          options: [
            "Company",
            "Cooperative or consortium",
            "University or research institute",
            "Public body",
            "Individual",
            "Other",
          ],
        }),
        field({ key: "tax_or_registration_number", label: "Tax or registration number", type: "string" }),
        field({ key: "registered_office", label: "Registered office", type: "string", combo: "address" }),
        field({ key: "country", label: "Country", type: "option", options: ["ISO3166"], combo: "address" }),
        field({
          key: "supply_chain_role",
          label: "Supply-chain role",
          type: "option_multi",
          options: ["Variety manager", "Breeder", "Nursery", "Grower", "Marketer", "Other"],
        }),
        group({
          key: "supply_chain_links",
          label: "Supply-chain links",
          repeatable: true,
          children: [
            field({
              key: "parent_entity",
              label: "Parent entity",
              type: "ref",
              ref: { section: "supply_chain", group: "company" },
            }),
            field({
              key: "relation_type",
              label: "Relation type",
              type: "option",
              options: ["Licensing", "Sublicensing", "Propagation", "Fruit sales", "Reporting"],
            }),
            field({ key: "contract", label: "Contract", type: "ref", ref: { section: "contract" } }),
          ],
        }),
      ],
    }),
  ],
};