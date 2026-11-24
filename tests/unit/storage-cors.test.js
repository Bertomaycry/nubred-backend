import { storageCorsOrigins } from "../../src/modules/project/storage/s3.provider.js";

describe("storage CORS origins", () => {
  test("defaults are exact origins", () => {
    const origins = storageCorsOrigins("", "");
    expect(origins).toContain("https://gov.nubred.com");
    expect(origins).toContain("https://gov.preview.nubred.com");
    expect(origins.some((origin) => origin.includes("*"))).toBe(false);
  });

  test("an env wildcard is dropped and the staging host stays", () => {
    const origins = storageCorsOrigins(
      "https://*.gov.preview.nubred.com,https://gov.nubred.com",
      "gov.nubred.com"
    );
    expect(origins).toContain("https://gov.nubred.com");
    expect(origins).toContain("https://gov.preview.nubred.com");
    expect(origins.some((origin) => origin.includes("*"))).toBe(false);
  });

  test("a configured host suffix is included without a wildcard", () => {
    const origins = storageCorsOrigins("", "clients.example.com");
    expect(origins).toContain("https://clients.example.com");
    expect(origins).not.toContain("https://*.clients.example.com");
  });

  test("a client bucket allows that client's exact workspace origins", () => {
    const origins = storageCorsOrigins("", "", "nubred-stag");
    expect(origins).toContain("https://stag.gov.preview.nubred.com");
    expect(origins).toContain("https://stag.gov.nubred.com");
  });

  test("the platform bucket does not get a workspace origin", () => {
    const origins = storageCorsOrigins("", "", "nubred-platform");
    expect(origins).not.toContain("https://platform.gov.preview.nubred.com");
  });
});
