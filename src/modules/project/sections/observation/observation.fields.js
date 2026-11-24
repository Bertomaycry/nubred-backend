import { field, group } from "../field-tree/index.js";

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const observationFieldTree = {
  sectionKey: "observation",
  contextFields: ["phase", "protocol"],
  children: [
    group({
      key: "observation_location",
      label: "Observation location",
      repeatable: true,
      identity: ["batch_and_location"],
      children: [
        field({
          key: "batch_and_location",
          label: "Batch and location",
          type: "ref",
          ref: { section: "phase" },
          derive: { from: ["phase"], fn: "observationBatchLocation" },
        }),
        field({ key: "observer_name", label: "Observer name", type: "string" }),
        field({ key: "coordinates", label: "Coordinates", type: "string" }),
        field({ key: "surface_area_ha", label: "Surface area (ha)", type: "decimal" }),
        field({ key: "distance_between_rows_m", label: "Distance between rows (m)", type: "decimal", combo: "spacing" }),
        field({ key: "distance_between_trees_m", label: "Distance between trees (m)", type: "decimal", combo: "spacing" }),
        field({
          key: "total_tree",
          label: "Total tree",
          type: "int",
          derive: { from: ["surface_area_ha", "spacing"], fn: "observationTotalTrees" },
        }),
      ],
    }),
  ],
};