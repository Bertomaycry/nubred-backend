/* eslint-disable no-undef */
import { expireStaleFilterUploads } from "../../src/modules/master-filter/cleanup.js";

describe("expireStaleFilterUploads", () => {
  test("marks PENDING_UPLOAD past expiresAt as EXPIRED and deletes objects", async () => {
    const now = new Date("2026-10-31T10:00:00.000Z");
    const stale = {
      id: "up1",
      kind: "MASTER",
      tenantId: null,
      storageKey: "master-filters/contract/up1/A.md",
      status: "PENDING_UPLOAD",
      expiresAt: new Date("2026-10-31T09:00:00.000Z"),
    };
    const fresh = {
      id: "up2",
      kind: "MASTER",
      tenantId: null,
      storageKey: "k2",
      status: "PENDING_UPLOAD",
      expiresAt: new Date("2026-10-31T11:00:00.000Z"),
    };
    const prisma = {
      filterUpload: {
        findMany: async () => [stale],
        updateMany: async ({ where, data }) => {
          expect(where.id.in).toEqual(["up1"]);
          expect(data.status).toBe("EXPIRED");
          stale.status = "EXPIRED";
          return { count: 1 };
        },
      },
      tenant: { findMany: async () => [] },
    };
    const deleted = [];
    const storage = {
      deleteObject: async (bucket, key) => {
        deleted.push(`${bucket}/${key}`);
      },
    };

    const count = await expireStaleFilterUploads({ prisma, storage, now });
    expect(count).toBe(1);
    expect(deleted).toEqual(["nubred-platform/master-filters/contract/up1/A.md"]);
    expect(fresh.status).toBe("PENDING_UPLOAD");
  });
});
