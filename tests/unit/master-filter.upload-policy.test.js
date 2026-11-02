/* eslint-disable no-undef */
import {
  parseInitUpload,
  MAX_FILTER_BYTES,
  sanitizeDisplayName,
  masterFilterKey,
  userFilterKey,
  promotedMasterFilterKey,
} from "../../src/modules/master-filter/upload-policy.js";

describe("parseInitUpload", () => {
  const ok = (overrides = {}) => ({
    fileName: "MasterFilterContract_02.md",
    mimeType: "",
    size: 18234,
    ...overrides,
  });

  test("accepts .md with empty MIME and normalises to text/markdown", () => {
    const result = parseInitUpload(ok({ mimeType: "" }));
    expect(result).toEqual({
      ok: true,
      data: {
        fileName: "MasterFilterContract_02.md",
        mimeType: "text/markdown",
        size: 18234,
      },
    });
  });

  test("odd MIME still follows the extension", () => {
    expect(parseInitUpload(ok({ mimeType: "application/octet-stream" })).data.mimeType).toBe(
      "text/markdown"
    );
  });

  test.each([
    ["notes.txt", "text/plain"],
    ["doc.pdf", "application/pdf"],
    [
      "x.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  ])("%s → %s", (fileName, mimeType) => {
    expect(parseInitUpload(ok({ fileName })).data.mimeType).toBe(mimeType);
  });

  test("File name is required", () => {
    expect(parseInitUpload(ok({ fileName: "  " })).message).toBe(
      "File name is required."
    );
    expect(parseInitUpload({ size: 1 }).message).toBe("File name is required.");
  });

  test("rejects unknown extension", () => {
    expect(parseInitUpload(ok({ fileName: "x.doc" })).message).toBe(
      "Use a .md, .txt, .pdf, or .docx file."
    );
  });

  test("File size is required", () => {
    expect(parseInitUpload(ok({ size: 0 })).message).toBe("File size is required.");
    expect(parseInitUpload(ok({ size: -1 })).message).toBe("File size is required.");
    expect(parseInitUpload(ok({ size: 1.5 })).message).toBe("File size is required.");
    expect(parseInitUpload(ok({ size: "18234" })).message).toBe(
      "File size is required."
    );
  });

  test("rejects 5 MB + 1 byte", () => {
    expect(parseInitUpload(ok({ size: MAX_FILTER_BYTES + 1 })).message).toBe(
      "File is larger than 5 MB."
    );
  });

  test("accepts exactly 5 MB", () => {
    expect(parseInitUpload(ok({ size: MAX_FILTER_BYTES })).ok).toBe(true);
  });
});

describe("sanitizeDisplayName", () => {
  test("strips path and control chars, keeps casing, caps 255", () => {
    expect(sanitizeDisplayName("C:\\\\tmp\\\\Foo Bar.md")).toBe("Foo Bar.md");
    expect(sanitizeDisplayName("a".repeat(300)).length).toBe(255);
  });
});

describe("keys", () => {
  test("layout", () => {
    expect(
      masterFilterKey({
        sectionKey: "contract",
        uploadId: "u1",
        fileName: "A.md",
      })
    ).toBe("master-filters/contract/u1/A.md");
    expect(
      userFilterKey({
        sectionKey: "contract",
        uploadId: "u1",
        fileName: "A.md",
      })
    ).toBe("user-filters/contract/u1/A.md");
    expect(
      promotedMasterFilterKey({
        sectionKey: "contract",
        userFilterId: "uf1",
        fileName: "A.md",
      })
    ).toBe("master-filters/contract/promoted-uf1/A.md");
  });
});
