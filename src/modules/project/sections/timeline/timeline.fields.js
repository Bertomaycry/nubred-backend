import { field, group } from "../field-tree/index.js";

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const timelineFieldTree = {
  sectionKey: "timeline",
  contextFields: ["contract", "phase", "quarantine", "ip_right"],
  children: [
    group({
      key: "timeline_item",
      label: "Timeline item",
      repeatable: true,
      identity: ["title", "date"],
      children: [
        field({
          key: "title",
          label: "Title",
          type: "string",
          derive: { from: ["source_section"], fn: "timelineTitle" },
        }),
        field({
          key: "date",
          label: "Date",
          type: "date",
          derive: { from: ["source_section"], fn: "timelineDate" },
        }),
        field({
          key: "category",
          label: "Category",
          type: "option",
          options: ["Contract", "Phase", "Quarantine", "IP right"],
          derive: { from: ["source_section"], fn: "timelineCategory" },
        }),
        field({
          key: "phase",
          label: "Phase",
          type: "ref",
          ref: { section: "phase" },
          derive: { from: ["category"], fn: "timelinePhaseRef" },
        }),
        field({
          key: "linked_genotypes",
          label: "Linked genotypes",
          type: "ref_multi",
          ref: { section: "genotype" },
          derive: { from: ["category"], fn: "timelineGenotypes" },
        }),
      ],
    }),
  ],
};