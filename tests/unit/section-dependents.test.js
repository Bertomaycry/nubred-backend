import {
  cascadeRootKey,
  cascadeScope,
  sectionDependents,
  upstreamKeys,
} from "../../src/modules/project/sections/dependents.js";

describe("section dependents", () => {
  test("upstream keys come from contextFields", () => {
    expect(upstreamKeys("observation").sort()).toEqual(["phase", "protocol"]);
    expect(upstreamKeys("contract")).toEqual([]);
  });

  test("each dependent comes after the sections it reads", () => {
    const order = sectionDependents("contract");
    expect(order).toContain("phase");
    expect(order.at(-1)).toBe("project_overview");
    for (const key of order) {
      for (const up of upstreamKeys(key)) {
        if (order.includes(up)) expect(order.indexOf(up)).toBeLessThan(order.indexOf(key));
      }
    }
  });

  test("protocol refreshes observation and overview only", () => {
    expect(sectionDependents("protocol")).toEqual(["observation", "project_overview"]);
  });

  test("disabled sections are left out", () => {
    const enabled = ["contract", "genotype", "phase", "project_overview"];
    expect(sectionDependents("contract", enabled)).toEqual(["genotype", "phase", "project_overview"]);
  });

  test("cascade scope round-trips", () => {
    expect(cascadeRootKey(cascadeScope("supply_chain"))).toBe("supply_chain");
    expect(cascadeRootKey("section:contract")).toBeNull();
    expect(cascadeRootKey("full")).toBeNull();
  });
});
