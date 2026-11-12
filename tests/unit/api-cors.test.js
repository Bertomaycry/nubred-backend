/* eslint-disable no-undef */
import { isAllowedApiOrigin } from "../../src/lib/api-cors.js";

describe("API CORS origins", () => {
  test("allows the governance hosts and a client workspace", () => {
    expect(isAllowedApiOrigin(undefined)).toBe(true);
    expect(isAllowedApiOrigin("https://gov.nubred.com")).toBe(true);
    expect(isAllowedApiOrigin("https://gov.preview.nubred.com")).toBe(true);
    expect(isAllowedApiOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedApiOrigin("https://test.gov.nubred.com")).toBe(true);
    expect(isAllowedApiOrigin("https://test.gov.preview.nubred.com")).toBe(true);
  });

  test("rejects other sites, nested hosts, and reserved labels", () => {
    expect(isAllowedApiOrigin("https://evil.example")).toBe(false);
    expect(isAllowedApiOrigin("https://a.b.gov.nubred.com")).toBe(false);
    expect(isAllowedApiOrigin("http://test.gov.nubred.com")).toBe(false);
    expect(isAllowedApiOrigin("https://api.gov.nubred.com")).toBe(false);
    expect(isAllowedApiOrigin("not a url")).toBe(false);
  });
});
