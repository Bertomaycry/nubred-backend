/* eslint-disable no-undef */
import request from "supertest";
import app from "../../src/app.js";

describe("JSON body limit for master filter PATCH", () => {
  test("PATCH /api/admin/master-filters/:id accepts a 1,000,000-char body (not 413)", async () => {
    const content = "a".repeat(1_000_000);
    const res = await request(app)
      .patch("/api/admin/master-filters/00000000-0000-0000-0000-000000000001")
      .set("Content-Type", "application/json")
      .send({ content, version: 1 });

    expect(res.status).not.toBe(413);
  });

  test("other JSON routes still reject ~100 KB bodies", async () => {
    const res = await request(app)
      .post("/api/admin/clients")
      .set("Content-Type", "application/json")
      .send({ companyName: "x".repeat(80_000) });

    expect(res.status).toBe(413);
  });
});
