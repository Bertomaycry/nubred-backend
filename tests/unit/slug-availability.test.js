/* eslint-disable no-undef */
import { assertSlugAvailable, SLUG_TAKEN } from "../../src/modules/client/slug-availability.js";

function harness({ tenant = null, database = false, bucket = false } = {}) {
  return {
    prisma: {
      tenant: {
        findUnique: async () => tenant,
      },
    },
    databaseExists: async () => database,
    storage: async () => ({
      bucketExists: async () => bucket,
    }),
  };
}

describe("assertSlugAvailable", () => {
  test("an unused slug is available", async () => {
    await expect(assertSlugAvailable("agri-levante", harness())).resolves.toBeNull();
  });

  test("a ready client is taken", async () => {
    await expect(
      assertSlugAvailable(
        "agri-levante",
        harness({ tenant: { id: "1", provisioningStatus: "ready" } })
      )
    ).rejects.toMatchObject({ status: 409, message: SLUG_TAKEN });
  });

  test("a failed attempt with nothing left behind can be reused", async () => {
    const failed = { id: "1", provisioningStatus: "failed" };
    await expect(
      assertSlugAvailable("agri-levante", harness({ tenant: failed }))
    ).resolves.toEqual(failed);
  });

  test("a leftover database or bucket is taken", async () => {
    await expect(
      assertSlugAvailable("agri-levante", harness({ database: true }))
    ).rejects.toMatchObject({ status: 409, message: SLUG_TAKEN });
    await expect(
      assertSlugAvailable("agri-levante", harness({ bucket: true }))
    ).rejects.toMatchObject({ status: 409, message: SLUG_TAKEN });
  });
});
