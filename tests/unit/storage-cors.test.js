import { storageCorsOrigins } from "../../src/modules/project/storage/s3.provider.js";

describe("storage CORS origins", () => {
  test("defaults allow prod and staging client hosts", () => {
    const origins = storageCorsOrigins("", "");
    expect(origins).toContain("https://*.gov.nubred.com");
    expect(origins).toContain("https://*.gov.preview.nubred.com");
    expect(origins).toContain("https://gov.preview.nubred.com");
  });

  test("an env list cannot drop the staging wildcard", () => {
    const origins = storageCorsOrigins("https://gov.nubred.com", "gov.nubred.com");
    expect(origins).toContain("https://gov.nubred.com");
    expect(origins).toContain("https://*.gov.nubred.com");
    expect(origins).toContain("https://*.gov.preview.nubred.com");
  });

  test("a configured host suffix is included", () => {
    const origins = storageCorsOrigins("", "clients.example.com");
    expect(origins).toContain("https://*.clients.example.com");
    expect(origins).toContain("https://*.gov.preview.nubred.com");
  });
});
