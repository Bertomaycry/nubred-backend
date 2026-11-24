import { field, group } from "../field-tree/index.js";

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const quarantineFieldTree = {
  sectionKey: "quarantine",
  contextFields: ["contract", "genotype"],
  children: [
    group({
      key: "quarantine",
      label: "Quarantine",
      repeatable: true,
      identity: ["country", "facility"],
      children: [
        field({ key: "country", label: "Country", type: "option", options: ["ISO3166"], combo: "place" }),
        field({ key: "facility", label: "Facility", type: "string", combo: "place" }),
        field({ key: "linked_genotypes", label: "Linked genotypes", type: "ref_multi", ref: { section: "genotype" } }),
        field({ key: "contract", label: "Contract", type: "ref", ref: { section: "contract" } }),
        field({ key: "type", label: "Type", type: "option", options: ["Public", "Private"] }),
        field({ key: "estimated_duration", label: "Estimated duration", type: "int", combo: "duration" }),
        field({ key: "duration_unit", label: "Duration unit", type: "option", options: ["Days", "Weeks", "Months", "Years", "Seasons"], combo: "duration" }),
        field({ key: "start_date", label: "Start date", type: "date", combo: "period" }),
        field({
          key: "expected_certification_date",
          label: "Expected certification date",
          type: "date",
          derive: { from: ["start_date", "estimated_duration", "duration_unit"], fn: "quarantineExpectedCert" },
          combo: "period",
        }),
        field({ key: "certification_date", label: "Certification date", type: "date", combo: "period" }),
        group({
          key: "document",
          label: "Document",
          repeatable: true,
          children: [
            field({
              key: "document_kind",
              label: "Document kind",
              type: "option",
              options: ["Import permit", "Phytosanitary certificate", "Plant passport", "Release notice", "Other"],
              combo: "document",
            }),
            field({ key: "document_number", label: "Document number", type: "string", combo: "document" }),
            field({
              key: "file_uploaded",
              label: "File uploaded",
              type: "boolean",
              derive: { from: ["document"], fn: "hasUploadedFile" },
            }),
            field({ key: "valid_until", label: "Valid until", type: "date" }),
          ],
        }),
      ],
    }),
  ],
};