/* eslint-disable no-undef */
import {
  parseCreateClient,
  parseUpdateClient,
  parseRestrictReason,
} from "../../src/modules/client/client.schema.js";
import { MODULE_IDS } from "../../src/modules/client/modules.js";
import { slugError, databaseNameFor, bucketNameFor } from "../../src/modules/client/slug.js";

const modules = (overrides = {}) => ({
  ...Object.fromEntries(MODULE_IDS.map((id) => [id, false])),
  ...overrides,
});

const valid = (overrides = {}) => ({
  companyName: "  Agri Levante SRL ",
  maxProjects: "5",
  uniqueUrl: "Agri-Levante",
  users: [
    { email: "Owner@AgriLevante.com", role: "owner" },
    { email: "pm@agrilevante.com", role: "project_manager" },
  ],
  modules: modules({ contract: true }),
  ...overrides,
});

describe("client schema", () => {
  test("normalises a valid create body", () => {
    const result = parseCreateClient(valid());
    expect(result.ok).toBe(true);
    expect(result.data.companyName).toBe("Agri Levante SRL");
    expect(result.data.maxProjects).toBe(5);
    expect(result.data.uniqueUrl).toBe("agri-levante");
    expect(result.data.users[0].email).toBe("owner@agrilevante.com");
  });

  test.each([["5", 5], [5, 5], [" 12 ", 12]])("maxProjects %p -> %p", (input, out) => {
    expect(parseCreateClient(valid({ maxProjects: input })).data.maxProjects).toBe(out);
  });

  test.each(["0", "-1", "1.5", "abc", "", 0, 2.5])("rejects maxProjects %p", (input) => {
    expect(parseCreateClient(valid({ maxProjects: input })).ok).toBe(false);
  });

  test("requires company name", () => {
    expect(parseCreateClient(valid({ companyName: "   " })).ok).toBe(false);
  });

  test("needs exactly one owner", () => {
    const none = valid({ users: [{ email: "a@x.com", role: "viewer" }] });
    const two = valid({
      users: [
        { email: "a@x.com", role: "owner" },
        { email: "b@x.com", role: "owner" },
      ],
    });
    expect(parseCreateClient(none).message).toMatch(/owner/i);
    expect(parseCreateClient(two).message).toMatch(/owner/i);
  });

  test("rejects duplicate emails after lowercasing, bad emails, bad roles, no users", () => {
    expect(
      parseCreateClient(
        valid({
          users: [
            { email: "a@x.com", role: "owner" },
            { email: "A@X.com", role: "viewer" },
          ],
        })
      ).ok
    ).toBe(false);
    expect(parseCreateClient(valid({ users: [{ email: "nope", role: "owner" }] })).ok).toBe(false);
    expect(parseCreateClient(valid({ users: [{ email: "a@x.com", role: "boss" }] })).ok).toBe(false);
    expect(parseCreateClient(valid({ users: [] })).ok).toBe(false);
  });

  test("modules: all 13 booleans required, unknown ids rejected, all false is valid", () => {
    expect(parseCreateClient(valid({ modules: modules() })).ok).toBe(true);

    const missing = modules();
    delete missing.todo;
    expect(parseCreateClient(valid({ modules: missing })).ok).toBe(false);
    expect(parseCreateClient(valid({ modules: { ...modules(), bogus: true } })).ok).toBe(false);
    expect(parseCreateClient(valid({ modules: modules({ todo: "yes" }) })).ok).toBe(false);
  });

  test("update ignores a matching uniqueUrl and does not require it", () => {
    const body = valid();
    expect(parseUpdateClient(body).ok).toBe(true);
    delete body.uniqueUrl;
    expect(parseUpdateClient(body).ok).toBe(true);
  });

  test("restrict reason is required and constrained", () => {
    expect(parseRestrictReason({}).ok).toBe(false);
    expect(parseRestrictReason({ reason: "nope" }).ok).toBe(false);
    expect(parseRestrictReason({ reason: "client_stop_paying" }).ok).toBe(true);
  });
});

describe("slug", () => {
  test.each(["agri-levante", "a", "a1", "x-y-z"])("accepts %s", (slug) => {
    expect(slugError(slug)).toBeNull();
  });

  test.each(["-a", "a-", "a_b", "a b", "", "www", "admin", "a".repeat(49)])(
    "rejects %p",
    (slug) => {
      expect(slugError(slug)).not.toBeNull();
    }
  );

  test("maps to database and bucket names", () => {
    expect(databaseNameFor("agri-levante")).toBe("nubred_agri_levante");
    expect(bucketNameFor("agri-levante")).toBe("nubred-agri-levante");
  });
});
