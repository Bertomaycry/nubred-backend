/* eslint-disable no-undef */
import { jest } from "@jest/globals";

let mockCreateClient;
let supabaseModule;

describe("supabase.js - unit tests", () => {
  let originalEnv;

  beforeEach(async () => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };
    // Clear module cache and re-import the module so the unstable mock is applied
    jest.resetModules();
    // create a fresh mock and inject it into the supabase util before using
    mockCreateClient = jest.fn();
    supabaseModule = await import("../../src/utils/supabase.js");
    // inject the test createClient implementation
    supabaseModule.__setCreateClientForTests((...args) => mockCreateClient(...args));
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  test("resolveSupabaseConfig: missing SUPABASE_URL -> throws error", () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    expect(() => {
      supabaseModule.resolveSupabaseConfig();
    }).toThrow("SUPABASE_URL is missing in environment variables");
  });

  test("resolveSupabaseConfig: missing both keys -> throws error", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    expect(() => {
      supabaseModule.resolveSupabaseConfig();
    }).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set in environment variables"
    );
  });

  test("resolveSupabaseConfig: uses service role key when available", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.SUPABASE_ANON_KEY = "anon-key";

    const config = supabaseModule.resolveSupabaseConfig();

    expect(config.supabaseUrl).toBe("https://test.supabase.co");
    expect(config.key).toBe("service-key");
  });

  test("resolveSupabaseConfig: uses anon key when service role key not available", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_ANON_KEY = "anon-key";

    const config = supabaseModule.resolveSupabaseConfig();

    expect(config.supabaseUrl).toBe("https://test.supabase.co");
    expect(config.key).toBe("anon-key");
  });

  test("resolveSupabaseConfig: trims whitespace from keys", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "  service-key  ";
    process.env.SUPABASE_ANON_KEY = "  anon-key  ";

    const config = supabaseModule.resolveSupabaseConfig();

    expect(config.key).toBe("service-key");
  });

  test("getSupabaseClient: creates client with correct config", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    const mockClient = { auth: {} };
    mockCreateClient.mockReturnValue(mockClient);

    const client = supabaseModule.getSupabaseClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "service-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    expect(client).toBe(mockClient);
  });

  test("getSupabaseClient: returns same client instance on subsequent calls", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    const mockClient = { auth: {} };
    mockCreateClient.mockReturnValue(mockClient);

    const client1 = supabaseModule.getSupabaseClient();
    const client2 = supabaseModule.getSupabaseClient();
    const client3 = supabaseModule.getSupabaseClient();

    expect(client1).toBe(client2);
    expect(client2).toBe(client3);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });
});

