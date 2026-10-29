/* eslint-disable no-undef */
import {
  creditsFor,
  heartbeatSeconds,
  secondsToHours,
  usageForUser,
  usageWindows,
} from "../../src/modules/client/usage.js";

describe("usage windows (UTC)", () => {
  test("Wednesday mid-month", () => {
    const w = usageWindows(new Date("2026-10-28T15:30:00Z"));
    expect(w.today.toISOString()).toBe("2026-10-28T00:00:00.000Z");
    expect(w.this_week.toISOString()).toBe("2026-10-26T00:00:00.000Z"); // Monday
    expect(w.this_month.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(w.all_time).toBeNull();
  });

  test("Monday is its own week start", () => {
    const w = usageWindows(new Date("2026-10-26T00:00:01Z"));
    expect(w.this_week.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  test("Sunday belongs to the week that started the previous Monday, across a month edge", () => {
    const w = usageWindows(new Date("2026-11-01T10:00:00Z")); // Sunday
    expect(w.this_week.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(w.this_month.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("hours", () => {
  test.each([
    [0, 0],
    [5400, 1.5],
    [3600, 1],
    [100, 0],
    [200, 0.1],
  ])("%p seconds -> %p h", (s, h) => {
    expect(secondsToHours(s)).toBe(h);
  });

  test("usageForUser fills zeros for users with no events", () => {
    const usage = { time: new Map(), tokens: new Map() };
    expect(usageForUser(usage, "u1")).toEqual({
      timeUsage: { today: 0, this_week: 0, this_month: 0, all_time: 0 },
      tokenUsage: { today: 0, this_week: 0, this_month: 0, all_time: 0 },
    });
  });
});

describe("heartbeat seconds", () => {
  const now = new Date("2026-10-28T10:00:00Z");
  const ago = (s) => new Date(now.getTime() - s * 1000);

  test("first heartbeat adds 30", () => expect(heartbeatSeconds(null, now)).toBe(30));
  test("30s or more since last adds 30", () => {
    expect(heartbeatSeconds(ago(30), now)).toBe(30);
    expect(heartbeatSeconds(ago(3600), now)).toBe(30);
  });
  test("under 30s adds only the elapsed seconds", () => {
    expect(heartbeatSeconds(ago(12), now)).toBe(12);
    expect(heartbeatSeconds(ago(0), now)).toBe(0);
  });
  test("a clock skew into the future never goes negative", () => {
    expect(heartbeatSeconds(ago(-5), now)).toBe(0);
  });
});

describe("AI credits", () => {
  test.each([
    [{ promptTokens: 0, completionTokens: 0 }, 1],
    [{ promptTokens: 400, completionTokens: 500 }, 1],
    [{ promptTokens: 1000, completionTokens: 1 }, 2],
    [{ promptTokens: 12000, completionTokens: 3000 }, 15],
    [{}, 1],
    [{ promptTokens: null, completionTokens: null }, 1],
  ])("%j -> %p", (tokens, credits) => {
    expect(creditsFor(tokens)).toBe(credits);
  });
});
