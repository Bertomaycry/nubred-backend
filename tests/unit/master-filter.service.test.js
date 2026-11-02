/* eslint-disable no-undef */
import {
  listSectionSummaries,
  getSectionDetail,
  getMasterFilterById,
  getUserFilterById,
  initMasterUpload,
  completeMasterUpload,
  updateMasterFilter,
  deleteMasterFilter,
  promoteUserFilter,
  listTenantSuggestions,
  withdrawSuggestion,
  completeUserUpload,
} from "../../src/modules/master-filter/service.js";

const now = new Date("2026-10-22T09:14:00.000Z");

function fakeStorage(seed = []) {
  const objects = new Map(
    seed.map(([k, body]) => [k, Buffer.isBuffer(body) ? body : Buffer.from(body)])
  );
  return {
    objects,
    deleted: [],
    getPresignedPutUrl: async ({ bucket, key, mimeType }) => ({
      url: `https://minio.test/${bucket}/${key}`,
      method: "PUT",
      headers: { "Content-Type": mimeType },
      expiresIn: 900,
    }),
    headObject: async (bucket, key) => {
      const body = objects.get(`${bucket}/${key}`);
      return body
        ? { exists: true, sizeBytes: body.length, etag: "e" }
        : { exists: false, sizeBytes: null, etag: null };
    },
    getObjectBuffer: async (bucket, key) => {
      const body = objects.get(`${bucket}/${key}`);
      if (!body) throw new Error("missing");
      return body;
    },
    putObject: async ({ bucket, key, body }) => {
      objects.set(
        `${bucket}/${key}`,
        Buffer.isBuffer(body) ? body : Buffer.from(body)
      );
    },
    deleteObject: async (bucket, key) => {
      objects.delete(`${bucket}/${key}`);
    },
    copyObject: async ({ sourceBucket, sourceKey, destBucket, destKey }) => {
      const body = objects.get(`${sourceBucket}/${sourceKey}`);
      if (!body) throw new Error("copy source missing");
      objects.set(`${destBucket}/${destKey}`, Buffer.from(body));
    },
  };
}

function wrapDelete(storage) {
  const deleted = [];
  const inner = storage.deleteObject;
  storage.deleteObject = async (bucket, key) => {
    deleted.push(`${bucket}/${key}`);
    await inner(bucket, key);
  };
  storage.deleted = deleted;
  return storage;
}

function memoryPrisma({
  admins = [{ id: "admin-1", firstName: "NuBred", lastName: "Admin", email: "a@x.com" }],
  tenants = [
    { id: "t1", name: "Agritech Corporation", slug: "test", bucketName: "nubred-test" },
  ],
} = {}) {
  const db = {
    masterFilters: [],
    userFilters: [],
    filterUploads: [],
    users: [...admins],
    tenants: [...tenants],
  };

  const match = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        if (v.in) return v.in.includes(row[k]);
        return true;
      }
      return row[k] === v;
    });

  const withTenant = (row) => ({
    ...row,
    tenant: db.tenants.find((t) => t.id === row.tenantId) ?? null,
  });

  const api = {
    masterFilter: {
      groupBy: async ({ by, _count }) => {
        const map = new Map();
        for (const row of db.masterFilters) {
          const key = row[by[0]];
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        return [...map.entries()].map(([sectionKey, n]) => ({
          sectionKey,
          _count: { _all: n },
        }));
      },
      findMany: async ({ where, orderBy }) => {
        let rows = db.masterFilters.filter((r) => match(r, where));
        if (orderBy?.createdAt === "asc") {
          rows = [...rows].sort((a, b) => a.createdAt - b.createdAt);
        }
        return rows.map((r) => ({ ...r }));
      },
      findUnique: async ({ where, select }) => {
        const row = db.masterFilters.find((r) => r.id === where.id);
        if (!row) return null;
        if (select) {
          return Object.fromEntries(
            Object.keys(select).map((k) => [k, row[k]])
          );
        }
        return { ...row };
      },
      create: async ({ data }) => {
        const row = {
          id: data.id ?? `mf-${db.masterFilters.length + 1}`,
          version: 1,
          sourceUserFilterId: null,
          updatedById: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        if (
          row.sourceUserFilterId &&
          db.masterFilters.some((m) => m.sourceUserFilterId === row.sourceUserFilterId)
        ) {
          const err = new Error("unique");
          err.code = "P2002";
          throw err;
        }
        db.masterFilters.push(row);
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        const rows = db.masterFilters.filter((r) => match(r, where));
        for (const row of rows) {
          if (data.version?.increment) row.version += data.version.increment;
          if (data.content !== undefined) row.content = data.content;
          if (data.updatedById !== undefined) row.updatedById = data.updatedById;
          row.updatedAt = now;
        }
        return { count: rows.length };
      },
      delete: async ({ where }) => {
        const i = db.masterFilters.findIndex((r) => r.id === where.id);
        if (i === -1) return null;
        const [row] = db.masterFilters.splice(i, 1);
        return row;
      },
    },
    userFilter: {
      groupBy: async ({ by, where }) => {
        const map = new Map();
        for (const row of db.userFilters) {
          if (where?.status && row.status !== where.status) continue;
          const key = row[by[0]];
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        return [...map.entries()].map(([sectionKey, n]) => ({
          sectionKey,
          _count: { _all: n },
        }));
      },
      findMany: async ({ where, orderBy }) => {
        let rows = db.userFilters.filter((r) => match(r, where));
        if (orderBy?.createdAt === "desc") {
          rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
        } else if (orderBy?.createdAt === "asc") {
          rows = [...rows].sort((a, b) => a.createdAt - b.createdAt);
        }
        return rows.map(withTenant);
      },
      findUnique: async ({ where }) => {
        const row = db.userFilters.find((r) => r.id === where.id);
        return row ? withTenant(row) : null;
      },
      findFirst: async ({ where }) => {
        const row = db.userFilters.find((r) => match(r, where));
        return row ? withTenant(row) : null;
      },
      create: async ({ data }) => {
        const row = {
          id: data.id ?? `uf-${db.userFilters.length + 1}`,
          status: "PENDING",
          promotedMasterFilterId: null,
          reviewedById: null,
          reviewedAt: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        db.userFilters.push(row);
        return withTenant(row);
      },
      createMany: async ({ data }) => {
        data.forEach((d) => db.userFilters.push({ ...d, createdAt: now, updatedAt: now }));
        return { count: data.length };
      },
      update: async ({ where, data }) => {
        const row = db.userFilters.find((r) => r.id === where.id);
        Object.assign(row, data, { updatedAt: now });
        return withTenant(row);
      },
      updateMany: async ({ where, data }) => {
        const rows = db.userFilters.filter((r) => match(r, where));
        for (const row of rows) Object.assign(row, data, { updatedAt: now });
        return { count: rows.length };
      },
      delete: async ({ where }) => {
        const i = db.userFilters.findIndex((r) => r.id === where.id);
        if (i >= 0) db.userFilters.splice(i, 1);
      },
    },
    filterUpload: {
      findUnique: async ({ where }) => {
        const row = db.filterUploads.find((r) => r.id === where.id);
        return row ? { ...row } : null;
      },
      findMany: async ({ where }) => {
        return db.filterUploads.filter((r) => {
          if (where.status && r.status !== where.status) return false;
          if (where.expiresAt?.lte && r.expiresAt > where.expiresAt.lte) return false;
          if (where.id?.in && !where.id.in.includes(r.id)) return false;
          return true;
        });
      },
      create: async ({ data }) => {
        const row = { ...data, createdAt: now };
        db.filterUploads.push(row);
        return { ...row };
      },
      update: async ({ where, data }) => {
        const row = db.filterUploads.find((r) => r.id === where.id);
        Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        const rows = db.filterUploads.filter((r) => match(r, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      },
    },
    user: {
      findMany: async ({ where }) => {
        const ids = where?.id?.in;
        return db.users.filter((u) => !ids || ids.includes(u.id));
      },
    },
    tenant: {
      findMany: async ({ where }) => {
        const ids = where?.id?.in;
        return db.tenants.filter((t) => !ids || ids.includes(t.id));
      },
    },
    $transaction: async (fn) => fn(api),
    _db: db,
  };
  return api;
}

function deps(prisma, storage) {
  return {
    prisma,
    storage: async () => storage,
    now: () => now,
  };
}

describe("listSectionSummaries", () => {
  test("always 11 sections in order, pending suggestions only", async () => {
    const prisma = memoryPrisma();
    prisma._db.masterFilters.push({
      id: "m1",
      sectionKey: "contract",
      createdById: "admin-1",
      createdAt: now,
      updatedAt: now,
      fileName: "a.md",
      mimeType: "text/markdown",
      sizeBytes: 1,
      storageKey: "k",
      content: "x",
      version: 1,
    });
    prisma._db.userFilters.push(
      {
        id: "u1",
        sectionKey: "contract",
        status: "PENDING",
        tenantId: "t1",
        submittedByUserId: "admin-1",
        createdAt: now,
        updatedAt: now,
        fileName: "u.md",
        mimeType: "text/markdown",
        sizeBytes: 1,
        storageKey: "k",
        content: "x",
      },
      {
        id: "u2",
        sectionKey: "contract",
        status: "ACCEPTED",
        tenantId: "t1",
        submittedByUserId: "admin-1",
        createdAt: now,
        updatedAt: now,
        fileName: "u2.md",
        mimeType: "text/markdown",
        sizeBytes: 1,
        storageKey: "k",
        content: "x",
      }
    );

    const data = await listSectionSummaries({ prisma });
    expect(data).toHaveLength(11);
    expect(data[0]).toEqual({
      key: "contract",
      title: "Contract",
      masterFilterCount: 1,
      suggestionCount: 1,
    });
    expect(data[1].masterFilterCount).toBe(0);
    expect(data[1].suggestionCount).toBe(0);
  });
});

describe("unknown section", () => {
  test("400 Unknown section.", async () => {
    await expect(getSectionDetail("nope", "admin-1", { prisma: memoryPrisma() }))
      .rejects.toMatchObject({ code: 400, message: "Unknown section." });
  });
});

describe("get one", () => {
  test("master 404", async () => {
    await expect(
      getMasterFilterById("missing", "admin-1", { prisma: memoryPrisma() })
    ).rejects.toMatchObject({ code: 404, message: "Master filter not found." });
  });

  test("suggestion 404", async () => {
    await expect(
      getUserFilterById("missing", "admin-1", { prisma: memoryPrisma() })
    ).rejects.toMatchObject({ code: 404, message: "Suggestion not found." });
  });
});

describe("init master upload", () => {
  test("returns presigned PUT with normalised MIME", async () => {
    const prisma = memoryPrisma();
    const storage = fakeStorage();
    const data = await initMasterUpload(
      {
        sectionKey: "contract",
        body: { fileName: "A.md", mimeType: "", size: 12 },
        userId: "admin-1",
      },
      deps(prisma, storage)
    );
    expect(data.upload.method).toBe("PUT");
    expect(data.upload.headers["Content-Type"]).toBe("text/markdown");
    expect(data.upload.url).toContain("master-filters/contract/");
    expect(prisma._db.filterUploads).toHaveLength(1);
    expect(prisma._db.filterUploads[0].kind).toBe("MASTER");
  });
});

describe("complete master upload", () => {
  function pending(overrides = {}) {
    return {
      id: "up1",
      kind: "MASTER",
      sectionKey: "contract",
      tenantId: null,
      createdById: "admin-1",
      fileName: "A.md",
      mimeType: "text/markdown",
      declaredSize: 5,
      storageKey: "master-filters/contract/up1/A.md",
      status: "PENDING_UPLOAD",
      expiresAt: new Date(now.getTime() + 60_000),
      ...overrides,
    };
  }

  test("missing upload", async () => {
    await expect(
      completeMasterUpload(
        { uploadId: "nope", userId: "admin-1" },
        deps(memoryPrisma(), fakeStorage())
      )
    ).rejects.toMatchObject({ code: 404, message: "Upload not found." });
  });

  test("already completed", async () => {
    const prisma = memoryPrisma();
    prisma._db.filterUploads.push(pending({ status: "COMPLETED" }));
    await expect(
      completeMasterUpload(
        { uploadId: "up1", userId: "admin-1" },
        deps(prisma, fakeStorage())
      )
    ).rejects.toMatchObject({
      code: 409,
      message: "This upload was already completed.",
    });
  });

  test("expired", async () => {
    const prisma = memoryPrisma();
    prisma._db.filterUploads.push(
      pending({ expiresAt: new Date(now.getTime() - 1000) })
    );
    await expect(
      completeMasterUpload(
        { uploadId: "up1", userId: "admin-1" },
        deps(prisma, fakeStorage())
      )
    ).rejects.toMatchObject({
      code: 410,
      message: "This upload expired. Please upload the file again.",
    });
  });

  test("object missing → FAILED + delete", async () => {
    const prisma = memoryPrisma();
    prisma._db.filterUploads.push(pending());
    const storage = wrapDelete(fakeStorage());
    await expect(
      completeMasterUpload(
        { uploadId: "up1", userId: "admin-1" },
        deps(prisma, storage)
      )
    ).rejects.toMatchObject({
      code: 400,
      message: "The file did not finish uploading. Please try again.",
    });
    expect(prisma._db.filterUploads[0].status).toBe("FAILED");
    expect(storage.deleted).toContain(
      "nubred-platform/master-filters/contract/up1/A.md"
    );
  });

  test("size mismatch", async () => {
    const prisma = memoryPrisma();
    prisma._db.filterUploads.push(pending({ declaredSize: 99 }));
    const storage = wrapDelete(
      fakeStorage([["nubred-platform/master-filters/contract/up1/A.md", "hello"]])
    );
    await expect(
      completeMasterUpload(
        { uploadId: "up1", userId: "admin-1" },
        deps(prisma, storage)
      )
    ).rejects.toMatchObject({
      code: 400,
      message: "The uploaded file does not match its declared size.",
    });
    expect(prisma._db.filterUploads[0].status).toBe("FAILED");
  });

  test("empty text", async () => {
    const prisma = memoryPrisma();
    const body = Buffer.from("   \n");
    prisma._db.filterUploads.push(pending({ declaredSize: body.length }));
    const storage = wrapDelete(
      fakeStorage([["nubred-platform/master-filters/contract/up1/A.md", body]])
    );
    await expect(
      completeMasterUpload(
        { uploadId: "up1", userId: "admin-1" },
        deps(prisma, storage)
      )
    ).rejects.toMatchObject({
      code: 422,
      message: "We could not read any text from this file.",
    });
    expect(prisma._db.filterUploads[0].status).toBe("FAILED");
  });

  test("success creates version 1 filter", async () => {
    const prisma = memoryPrisma();
    const body = Buffer.from("# hi");
    prisma._db.filterUploads.push(pending({ declaredSize: body.length }));
    const storage = fakeStorage([
      ["nubred-platform/master-filters/contract/up1/A.md", body],
    ]);
    const data = await completeMasterUpload(
      { uploadId: "up1", userId: "admin-1" },
      deps(prisma, storage)
    );
    expect(data.fileName).toBe("A.md");
    expect(data.content).toBe("# hi");
    expect(data.version).toBe(1);
    expect(data.uploadedBy.isCurrentUser).toBe(true);
    expect(prisma._db.filterUploads[0].status).toBe("COMPLETED");
  });
});

describe("PATCH master filter", () => {
  const row = {
    id: "mf1",
    sectionKey: "contract",
    fileName: "A.md",
    mimeType: "text/markdown",
    sizeBytes: 4,
    storageKey: "k",
    content: "# hi",
    version: 3,
    sourceUserFilterId: null,
    createdById: "admin-1",
    createdAt: now,
    updatedAt: now,
  };

  test("content required / empty / too long / version required", async () => {
    const prisma = memoryPrisma();
    prisma._db.masterFilters.push({ ...row });
    const d = { prisma };
    await expect(
      updateMasterFilter({ filterId: "mf1", body: {}, userId: "admin-1" }, d)
    ).rejects.toMatchObject({ code: 400, message: "Content is required." });
    await expect(
      updateMasterFilter(
        { filterId: "mf1", body: { content: "  ", version: 3 }, userId: "admin-1" },
        d
      )
    ).rejects.toMatchObject({ code: 400, message: "Content cannot be empty." });
    await expect(
      updateMasterFilter(
        {
          filterId: "mf1",
          body: { content: "x".repeat(1_000_001), version: 3 },
          userId: "admin-1",
        },
        d
      )
    ).rejects.toMatchObject({
      code: 400,
      message: "Content is too long. The limit is 1,000,000 characters.",
    });
    await expect(
      updateMasterFilter(
        { filterId: "mf1", body: { content: "ok" }, userId: "admin-1" },
        d
      )
    ).rejects.toMatchObject({ code: 400, message: "Version is required." });
  });

  test("stale version 409 does not change row", async () => {
    const prisma = memoryPrisma();
    prisma._db.masterFilters.push({ ...row });
    await expect(
      updateMasterFilter(
        { filterId: "mf1", body: { content: "new", version: 2 }, userId: "admin-1" },
        { prisma }
      )
    ).rejects.toMatchObject({
      code: 409,
      message: "This master filter was changed by someone else. Reload it and try again.",
    });
    expect(prisma._db.masterFilters[0].content).toBe("# hi");
    expect(prisma._db.masterFilters[0].version).toBe(3);
  });

  test("success bumps version", async () => {
    const prisma = memoryPrisma();
    prisma._db.masterFilters.push({ ...row });
    const data = await updateMasterFilter(
      { filterId: "mf1", body: { content: "new", version: 3 }, userId: "admin-1" },
      { prisma }
    );
    expect(data.version).toBe(4);
    expect(data.content).toBe("new");
  });

  test("missing filter 404", async () => {
    await expect(
      updateMasterFilter(
        { filterId: "nope", body: { content: "x", version: 1 }, userId: "admin-1" },
        { prisma: memoryPrisma() }
      )
    ).rejects.toMatchObject({ code: 404, message: "Master filter not found." });
  });
});

describe("DELETE master filter", () => {
  test("hard delete + best-effort object, second delete 404", async () => {
    const prisma = memoryPrisma();
    prisma._db.masterFilters.push({
      id: "mf1",
      sectionKey: "contract",
      fileName: "A.md",
      mimeType: "text/markdown",
      sizeBytes: 1,
      storageKey: "master-filters/contract/x/A.md",
      content: "x",
      version: 1,
      sourceUserFilterId: "uf1",
      createdById: "admin-1",
      createdAt: now,
      updatedAt: now,
    });
    prisma._db.userFilters.push({
      id: "uf1",
      status: "ACCEPTED",
      sectionKey: "contract",
      tenantId: "t1",
      submittedByUserId: "u",
      fileName: "A.md",
      mimeType: "text/markdown",
      sizeBytes: 1,
      storageKey: "k",
      content: "x",
      createdAt: now,
      updatedAt: now,
    });
    const storage = wrapDelete(fakeStorage());
    await deleteMasterFilter("mf1", deps(prisma, storage));
    expect(prisma._db.masterFilters).toHaveLength(0);
    expect(prisma._db.userFilters[0].status).toBe("ACCEPTED");
    expect(storage.deleted[0]).toContain("master-filters/contract/x/A.md");
    await expect(
      deleteMasterFilter("mf1", deps(prisma, storage))
    ).rejects.toMatchObject({ code: 404, message: "Master filter not found." });
  });
});

describe("promote", () => {
  function pendingSuggestion(prisma) {
    prisma._db.userFilters.push({
      id: "uf1",
      sectionKey: "contract",
      tenantId: "t1",
      submittedByUserId: "admin-1",
      fileName: "User.md",
      mimeType: "text/markdown",
      sizeBytes: 4,
      storageKey: "user-filters/contract/u/User.md",
      content: "# uf",
      status: "PENDING",
      promotedMasterFilterId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  test("copies object, creates master, marks ACCEPTED; second promote 409", async () => {
    const prisma = memoryPrisma();
    pendingSuggestion(prisma);
    const storage = wrapDelete(
      fakeStorage([["nubred-test/user-filters/contract/u/User.md", "# uf"]])
    );
    const data = await promoteUserFilter(
      { userFilterId: "uf1", userId: "admin-1" },
      deps(prisma, storage)
    );
    expect(data.masterFilter.content).toBe("# uf");
    expect(data.masterFilter.sourceUserFilterId).toBe("uf1");
    expect(data.userFilter.status).toBe("ACCEPTED");
    expect(
      storage.objects.has(
        "nubred-platform/master-filters/contract/promoted-uf1/User.md"
      )
    ).toBe(true);

    await expect(
      promoteUserFilter(
        { userFilterId: "uf1", userId: "admin-1" },
        deps(prisma, storage)
      )
    ).rejects.toMatchObject({
      code: 409,
      message: "This suggestion was already added to the master filter.",
    });
  });

  test("not found", async () => {
    await expect(
      promoteUserFilter(
        { userFilterId: "nope", userId: "admin-1" },
        deps(memoryPrisma(), fakeStorage())
      )
    ).rejects.toMatchObject({ code: 404, message: "Suggestion not found." });
  });
});

describe("tenant scope", () => {
  test("complete of another tenant's upload is 404", async () => {
    const prisma = memoryPrisma();
    prisma._db.filterUploads.push({
      id: "up1",
      kind: "USER",
      sectionKey: "contract",
      tenantId: "other",
      createdById: "u",
      fileName: "A.md",
      mimeType: "text/markdown",
      declaredSize: 1,
      storageKey: "k",
      status: "PENDING_UPLOAD",
      expiresAt: new Date(now.getTime() + 60_000),
    });
    await expect(
      completeUserUpload(
        {
          uploadId: "up1",
          userId: "u",
          tenant: { id: "t1", bucketName: "nubred-test", name: "Agritech Corporation" },
        },
        deps(prisma, fakeStorage())
      )
    ).rejects.toMatchObject({ code: 404, message: "Upload not found." });
  });

  test("withdraw other tenant 404; reviewed 409", async () => {
    const prisma = memoryPrisma();
    prisma._db.userFilters.push({
      id: "uf1",
      tenantId: "t1",
      status: "ACCEPTED",
      submittedByUserId: "u1",
      sectionKey: "contract",
      fileName: "A.md",
      mimeType: "text/markdown",
      sizeBytes: 1,
      storageKey: "k",
      content: "x",
      createdAt: now,
      updatedAt: now,
    });
    await expect(
      withdrawSuggestion(
        {
          userFilterId: "uf1",
          tenant: { id: "other", bucketName: "nubred-other" },
          userId: "u1",
          tenantRole: "owner",
        },
        { prisma }
      )
    ).rejects.toMatchObject({ code: 404, message: "Suggestion not found." });

    await expect(
      withdrawSuggestion(
        {
          userFilterId: "uf1",
          tenant: { id: "t1", bucketName: "nubred-test" },
          userId: "u1",
          tenantRole: "owner",
        },
        { prisma }
      )
    ).rejects.toMatchObject({
      code: 409,
      message: "This suggestion was already reviewed.",
    });
  });

  test("list tenant suggestions is scoped", async () => {
    const prisma = memoryPrisma();
    prisma._db.userFilters.push(
      {
        id: "mine",
        tenantId: "t1",
        status: "PENDING",
        submittedByUserId: "admin-1",
        sectionKey: "contract",
        fileName: "A.md",
        mimeType: "text/markdown",
        sizeBytes: 1,
        storageKey: "k",
        content: "x",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "theirs",
        tenantId: "other",
        status: "PENDING",
        submittedByUserId: "admin-1",
        sectionKey: "contract",
        fileName: "B.md",
        mimeType: "text/markdown",
        sizeBytes: 1,
        storageKey: "k",
        content: "x",
        createdAt: now,
        updatedAt: now,
      }
    );
    const data = await listTenantSuggestions(
      { tenant: { id: "t1" }, currentUserId: "admin-1" },
      { prisma }
    );
    expect(data.map((r) => r.id)).toEqual(["mine"]);
    expect(data[0].status).toBe("PENDING");
  });
});
