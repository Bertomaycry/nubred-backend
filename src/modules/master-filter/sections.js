import { ClientError } from "../client/provision.js";

/** Fixed catalog, in admin list order. Keys are also the URL path params. */
export const MASTER_FILTER_SECTIONS = [
  { key: "contract", title: "Contract" },
  { key: "genotype", title: "Genotype" },
  { key: "ip_right", title: "IP Right" },
  { key: "quarantine", title: "Quarantine" },
  { key: "supply_chain", title: "Supply Chain" },
  { key: "timeline", title: "Timeline" },
  { key: "todo", title: "To Do" },
  { key: "protocol", title: "Protocol" },
  { key: "observation", title: "Observation" },
  { key: "phase", title: "Phase" },
  { key: "project_overview", title: "Project Overview" },
];

const BY_KEY = new Map(MASTER_FILTER_SECTIONS.map((s) => [s.key, s]));

export const isMasterFilterSection = (key) => BY_KEY.has(key);

/** @returns {{ key: string, title: string }} or throws 400 */
export function sectionOrThrow(key) {
  const section = BY_KEY.get(key);
  if (!section) throw new ClientError(400, "Unknown section.");
  return section;
}
