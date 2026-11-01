/* eslint-disable no-undef */
import {
  LEVEL,
  buildSectionAccess,
  docASectionFor,
  sectionLevel,
} from "../../src/modules/project/access/matrix.js";

describe("Doc A section matrix", () => {
  test("Variety Manager has full access everywhere", () => {
    expect(Object.values(buildSectionAccess("VARIETY_MANAGER"))).toEqual(
      Array(7).fill("full")
    );
  });

  test("Nursery: overview/phases read, IP hidden, 'own' cells hidden for now", () => {
    expect(sectionLevel("NURSERY", "overview")).toBe(LEVEL.READ);
    expect(sectionLevel("NURSERY", "phases")).toBe(LEVEL.READ);
    expect(sectionLevel("NURSERY", "ip_rights")).toBe(LEVEL.HIDDEN);
    expect(sectionLevel("NURSERY", "contracts")).toBe(LEVEL.HIDDEN);
  });

  test("Field Observer sees nothing ('own assigned' phases not served yet)", () => {
    expect(Object.values(buildSectionAccess("FIELD_OBSERVER"))).toEqual(
      Array(7).fill("hidden")
    );
  });

  test("isFieldObserver flag is additive (union)", () => {
    expect(sectionLevel("PACKHOUSE_MARKETER", "phases")).toBe(LEVEL.HIDDEN);
    expect(
      sectionLevel("PACKHOUSE_MARKETER", "overview", { isFieldObserver: true })
    ).toBe(LEVEL.READ);
    // flag never lowers a level
    expect(sectionLevel("VARIETY_MANAGER", "todo", { isFieldObserver: true })).toBe(
      LEVEL.FULL
    );
  });

  test("no role / unknown role is hidden", () => {
    expect(sectionLevel(null, "overview")).toBe(LEVEL.HIDDEN);
    expect(sectionLevel("WHO", "overview")).toBe(LEVEL.HIDDEN);
  });

  test("API section keys map to Doc A sections; chronology is VM only", () => {
    expect(docASectionFor("protocol")).toBe("phases");
    expect(docASectionFor("contract")).toBe("contracts");
    expect(docASectionFor("nope")).toBeNull();
    expect(sectionLevel("GROWER", docASectionFor("chronology"))).toBe(LEVEL.HIDDEN);
    expect(sectionLevel("VARIETY_MANAGER", docASectionFor("chronology"))).toBe(
      LEVEL.FULL
    );
  });
});
