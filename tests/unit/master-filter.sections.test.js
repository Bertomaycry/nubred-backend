/* eslint-disable no-undef */
import {
  MASTER_FILTER_SECTIONS,
  isMasterFilterSection,
  sectionOrThrow,
} from "../../src/modules/master-filter/sections.js";

describe("master filter sections", () => {
  test("catalog has 11 keys in UI order", () => {
    expect(MASTER_FILTER_SECTIONS.map((s) => s.key)).toEqual([
      "contract",
      "genotype",
      "ip_right",
      "quarantine",
      "supply_chain",
      "timeline",
      "todo",
      "protocol",
      "observation",
      "phase",
      "project_overview",
    ]);
  });

  test("unknown key throws 400 Unknown section.", () => {
    expect(isMasterFilterSection("chronology")).toBe(false);
    try {
      sectionOrThrow("chronology");
      throw new Error("expected throw");
    } catch (error) {
      expect(error.code).toBe(400);
      expect(error.message).toBe("Unknown section.");
    }
  });
});
