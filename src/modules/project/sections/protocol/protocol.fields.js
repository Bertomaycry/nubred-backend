import { field, group } from "../field-tree/index.js";

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const protocolFieldTree = {
  sectionKey: "protocol",
  contextFields: ["contract", "phase", "genotype"],
  children: [
    group({
      key: "protocol",
      label: "Protocol",
      repeatable: true,
      identity: ["protocol_name"],
      children: [
        field({ key: "protocol_name", label: "Protocol name", type: "string" }),
        field({ key: "applied_to_phase", label: "Applied to phase", type: "ref_multi", ref: { section: "phase" } }),
        field({
          key: "data_collection_start",
          label: "Data collection start",
          type: "date_dm",
          derive: { from: ["applied_to_phase"], fn: "protocolCollectionStart" },
          combo: "collection_period",
        }),
        field({
          key: "data_collection_end",
          label: "Data collection end",
          type: "date_dm",
          derive: { from: ["applied_to_phase"], fn: "protocolCollectionEnd" },
          combo: "collection_period",
        }),
        group({
          key: "parameter",
          label: "Parameter",
          repeatable: true,
          identity: ["parameter_name", "parameter_family"],
          children: [
            field({
              key: "parameter_family",
              label: "Parameter family",
              type: "option",
              options: ["Plant", "Fruit quality", "Production", "Phytosanitary", "Post-harvest", "Climate", "Commercial"],
            }),
            field({ key: "parameter_name", label: "Parameter name", type: "option", options: ["NuBred parameter list"] }),
            field({
              key: "input_type",
              label: "Input type",
              type: "option",
              options: ["Number", "Scale", "Option", "Distribution", "Yes / no", "Photo", "Date", "BBCH"],
              derive: { from: ["parameter_name"], fn: "parameterInputType" },
              combo: "measurement_scale",
            }),
            field({
              key: "unit",
              label: "Unit",
              type: "option",
              options: ["mm", "cm", "m", "g", "kg", "t", "Brix", "%", "days", "count", "Other"],
              derive: { from: ["parameter_name"], fn: "parameterUnit" },
              combo: "measurement_scale",
            }),
            field({ key: "measurement_method", label: "Measurement method", type: "text" }),
            group({
              key: "observation_schedule",
              label: "Observation schedule",
              repeatable: true,
              children: [
                field({ key: "type", label: "Type", type: "option", options: ["On field", "On lab"] }),
                field({ key: "window_start", label: "Window start", type: "date_dm", combo: "window" }),
                field({ key: "window_end", label: "Window end", type: "date_dm", combo: "window" }),
                field({ key: "repeat", label: "Repeat", type: "option", options: ["Once", "Every x"], combo: "recurrence" }),
                field({ key: "repeat_every", label: "Repeat every", type: "int", showIf: { field: "repeat", equals: "Every x" }, combo: "recurrence" }),
                field({ key: "repeat_unit", label: "Repeat unit", type: "option", options: ["Days", "Weeks", "Months"], showIf: { field: "repeat", equals: "Every x" }, combo: "recurrence" }),
                field({ key: "timing_as_written", label: "Timing as written", type: "string" }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
};