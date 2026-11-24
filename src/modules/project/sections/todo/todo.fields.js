import { field, group } from "../field-tree/index.js";

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const todoFieldTree = {
  sectionKey: "todo",
  contextFields: ["contract.obligations", "supply_chain.company"],
  children: [
    group({
      key: "todo",
      label: "To-Do",
      repeatable: true,
      identity: ["title", "responsible_party"],
      children: [
        field({ key: "title", label: "Title", type: "string" }),
        field({
          key: "category",
          label: "Category",
          type: "option",
          options: [
            "Report",
            "Payment",
            "Notification",
            "Approval",
            "Supply",
            "Quality",
            "Access and inspection",
            "Insurance",
            "Service",
            "Document",
            "Observation",
            "Other",
          ],
        }),
        field({ key: "description", label: "Description", type: "text" }),
        field({ key: "responsible_party", label: "Responsible party", type: "ref", ref: { section: "supply_chain", group: "company" } }),
        field({ key: "due_type", label: "Due type", type: "option", options: ["On a date", "After an event", "Repeats"] }),
        field({
          key: "due_date",
          label: "Due date",
          type: "date",
          derive: { from: ["due_type", "anchor_event", "offset"], fn: "todoDueDate" },
        }),
        field({
          key: "anchor_event",
          label: "Anchor event",
          type: "option",
          options: ["Contract signature", "Effective date", "Batch start", "Batch end", "Quarantine certification", "Other"],
          showIf: { field: "due_type", equals: "After an event" },
          combo: "relative_due",
        }),
        field({ key: "offset", label: "Offset", type: "int", showIf: { field: "due_type", equals: "After an event" }, combo: "relative_due" }),
        field({ key: "offset_unit", label: "Offset unit", type: "option", options: ["Days", "Weeks", "Months", "Years"], showIf: { field: "due_type", equals: "After an event" }, combo: "relative_due" }),
        field({ key: "before_or_after", label: "Before or after", type: "option", options: ["Before", "After"], showIf: { field: "due_type", equals: "After an event" }, combo: "relative_due" }),
        field({ key: "frequency", label: "Frequency", type: "option", options: ["Monthly", "Quarterly", "Semester", "Annual"], showIf: { field: "due_type", equals: "Repeats" }, combo: "recurrence" }),
        field({ key: "due_on", label: "Due on", type: "date_dm", showIf: { field: "due_type", equals: "Repeats" }, combo: "recurrence" }),
      ],
    }),
  ],
};