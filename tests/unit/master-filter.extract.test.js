/* eslint-disable no-undef */
import { extractFilterText } from "../../src/modules/master-filter/extract.js";
import { MAX_CONTENT_CHARS } from "../../src/modules/master-filter/upload-policy.js";

describe("extractFilterText", () => {
  test("utf-8, BOM strip, CRLF → LF, trim", async () => {
    const text = await extractFilterText(
      Buffer.from("\uFEFF# Title\r\n\r\nbody  \r\n"),
      "text/markdown"
    );
    expect(text).toBe("# Title\n\nbody");
  });

  test("empty after trim → 422", async () => {
    await expect(extractFilterText(Buffer.from("  \n"), "text/plain")).rejects.toMatchObject({
      code: 422,
      message: "We could not read any text from this file.",
    });
  });

  test("over 1,000,000 chars → 422, does not truncate", async () => {
    const huge = "a".repeat(MAX_CONTENT_CHARS + 1);
    await expect(
      extractFilterText(Buffer.from(huge), "text/plain")
    ).rejects.toMatchObject({
      code: 422,
      message: "This file has too much text. The limit is 1,000,000 characters.",
    });
  });
});
