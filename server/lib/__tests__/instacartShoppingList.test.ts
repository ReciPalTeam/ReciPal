import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInstacartShoppingListLink, resolveInstacartConfig, InstacartApiError } from "../instacartMeasurement";

function mockFetch(response: { ok: boolean; status: number; body: any }) {
  vi.stubGlobal("fetch", async (_url: string, _opts: any) => ({
    ok: response.ok,
    status: response.status,
    text: async () => typeof response.body === "string" ? response.body : JSON.stringify(response.body),
  }));
}

describe("resolveInstacartConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.INSTACART_BASE_URL;
    delete process.env.INSTACART_API_ENV;
    delete process.env.INSTACART_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("defaults to development base URL when no env vars set", () => {
    const config = resolveInstacartConfig();
    expect(config.env).toBe("development");
    expect(config.baseUrl).toBe("https://connect.dev.instacart.tools");
    expect(config.endpoint).toBe("/idp/v1/products/products_link");
    expect(config.hasKey).toBe(false);
  });

  it("uses production base URL when INSTACART_API_ENV=production", () => {
    process.env.INSTACART_API_ENV = "production";
    const config = resolveInstacartConfig();
    expect(config.env).toBe("production");
    expect(config.baseUrl).toBe("https://connect.instacart.com");
  });

  it("uses INSTACART_BASE_URL override when set", () => {
    process.env.INSTACART_BASE_URL = "https://custom.instacart.test";
    process.env.INSTACART_API_ENV = "production";
    const config = resolveInstacartConfig();
    expect(config.baseUrl).toBe("https://custom.instacart.test");
  });

  it("strips trailing slashes from INSTACART_BASE_URL", () => {
    process.env.INSTACART_BASE_URL = "https://custom.instacart.test///";
    const config = resolveInstacartConfig();
    expect(config.baseUrl).toBe("https://custom.instacart.test");
  });

  it("reports hasKey correctly", () => {
    expect(resolveInstacartConfig().hasKey).toBe(false);
    process.env.INSTACART_API_KEY = "test-key";
    expect(resolveInstacartConfig().hasKey).toBe(true);
  });
});

describe("createInstacartShoppingListLink", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, INSTACART_API_KEY: "test-key-123456", INSTACART_API_ENV: "development" };
    delete process.env.INSTACART_BASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("throws if INSTACART_API_KEY is missing", async () => {
    delete process.env.INSTACART_API_KEY;
    await expect(
      createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] })
    ).rejects.toThrow("INSTACART_API_KEY not configured");
  });

  it("uses development base URL by default", async () => {
    let capturedUrl = "";
    vi.stubGlobal("fetch", async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ products_link_url: "https://test.url" }) };
    });

    await createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] });
    expect(capturedUrl).toBe("https://connect.dev.instacart.tools/idp/v1/products/products_link");
  });

  it("uses production base URL when INSTACART_API_ENV=production", async () => {
    process.env.INSTACART_API_ENV = "production";
    let capturedUrl = "";
    vi.stubGlobal("fetch", async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ products_link_url: "https://test.url" }) };
    });

    await createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] });
    expect(capturedUrl).toBe("https://connect.instacart.com/idp/v1/products/products_link");
  });

  it("uses INSTACART_BASE_URL override over env selection", async () => {
    process.env.INSTACART_BASE_URL = "https://custom.host";
    let capturedUrl = "";
    vi.stubGlobal("fetch", async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ products_link_url: "https://test.url" }) };
    });

    await createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] });
    expect(capturedUrl).toBe("https://custom.host/idp/v1/products/products_link");
  });

  it("sends link_type=shopping_list and reads products_link_url", async () => {
    let capturedBody: any = null;
    let capturedHeaders: Record<string, string> = {};

    vi.stubGlobal("fetch", async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, text: async () => JSON.stringify({ products_link_url: "https://instacart.com/store/abc" }) };
    });

    const result = await createInstacartShoppingListLink({
      title: "Test List",
      lineItems: [{ name: "Shrimp", quantity: 4, unit: "ounce" }],
    });

    expect(capturedHeaders["Authorization"]).toBe("Bearer test-key-123456");
    expect(capturedBody.link_type).toBe("shopping_list");
    expect(capturedBody.title).toBe("Test List");
    expect(result.products_link_url).toBe("https://instacart.com/store/abc");
    expect(result.raw).toBeDefined();
  });

  it("generates fallback title when not provided", async () => {
    let capturedBody: any = null;
    vi.stubGlobal("fetch", async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ products_link_url: "https://test.url" }) };
    });

    await createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] });
    expect(capturedBody.title).toMatch(/^ReciPal Shopping List - \d{4}-\d{2}-\d{2}$/);
  });

  it("skips items with blank names", async () => {
    let capturedBody: any = null;
    vi.stubGlobal("fetch", async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ products_link_url: "https://test.url" }) };
    });

    await createInstacartShoppingListLink({
      lineItems: [
        { name: "Milk" },
        { name: "" },
        { name: "   " },
        { name: "Eggs" },
      ],
    });
    expect(capturedBody.line_items).toHaveLength(2);
    expect(capturedBody.line_items[0].name).toBe("Milk");
    expect(capturedBody.line_items[1].name).toBe("Eggs");
  });

  it("applies safety fallbacks: null qty→1, empty unit→each", async () => {
    let capturedBody: any = null;
    vi.stubGlobal("fetch", async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ products_link_url: "https://test.url" }) };
    });

    await createInstacartShoppingListLink({
      lineItems: [
        { name: "Salt", quantity: 0, unit: "" },
        { name: "Pepper", quantity: -1, unit: "   " },
        { name: "Oregano" },
      ],
    });

    expect(capturedBody.line_items[0]).toEqual({ name: "Salt", quantity: 1, unit: "each", display_text: "Salt" });
    expect(capturedBody.line_items[1]).toEqual({ name: "Pepper", quantity: 1, unit: "each", display_text: "Pepper" });
    expect(capturedBody.line_items[2]).toEqual({ name: "Oregano", quantity: 1, unit: "each", display_text: "Oregano" });
  });

  it("uses display_text from input, falls back to name", async () => {
    let capturedBody: any = null;
    vi.stubGlobal("fetch", async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ products_link_url: "https://test.url" }) };
    });

    await createInstacartShoppingListLink({
      lineItems: [
        { name: "Shrimp", quantity: 4, unit: "ounce", display_text: "Shrimp — 4 ounce" },
        { name: "Cumin", quantity: 1, unit: "each" },
      ],
    });

    expect(capturedBody.line_items[0].display_text).toBe("Shrimp — 4 ounce");
    expect(capturedBody.line_items[1].display_text).toBe("Cumin");
  });

  it("includes landing_page_configuration when partnerLinkbackUrl provided", async () => {
    let capturedBody: any = null;
    vi.stubGlobal("fetch", async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ products_link_url: "https://test.url" }) };
    });

    await createInstacartShoppingListLink({
      lineItems: [{ name: "Milk" }],
      partnerLinkbackUrl: "https://recipal.com/cart",
    });

    expect(capturedBody.landing_page_configuration).toEqual({
      partner_linkback_url: "https://recipal.com/cart",
      enable_pantry_items: false,
    });
  });

  it("omits landing_page_configuration when no linkback URL", async () => {
    let capturedBody: any = null;
    vi.stubGlobal("fetch", async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ products_link_url: "https://test.url" }) };
    });

    await createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] });
    expect(capturedBody.landing_page_configuration).toBeUndefined();
  });

  it("throws InstacartApiError on non-2xx response", async () => {
    mockFetch({ ok: false, status: 401, body: { error: "Unauthorized" } });

    try {
      await createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InstacartApiError);
      const apiErr = err as InstacartApiError;
      expect(apiErr.message).toContain("Instacart API error (HTTP 401)");
      expect(apiErr.status).toBe(401);
      expect(apiErr.details).toBeDefined();
    }
  });

  it("throws with exact message when products_link_url missing from 2xx response", async () => {
    mockFetch({ ok: true, status: 200, body: { some_other_field: "value" } });

    await expect(
      createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] })
    ).rejects.toThrow("Shopping list URL missing from Instacart response");
  });

  it("throws on non-JSON response", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 503,
      text: async () => "<html>Service Unavailable</html>",
    }));

    await expect(
      createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] })
    ).rejects.toThrow("non-JSON response");
  });
});

describe("route response shape contract", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, INSTACART_API_KEY: "test-key-123456", INSTACART_API_ENV: "development" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("success result maps to both redirectUrl and productsLinkUrl", async () => {
    mockFetch({ ok: true, status: 200, body: { products_link_url: "https://instacart.com/list/abc" } });

    const result = await createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] });

    const routeResponse = {
      success: true,
      redirectUrl: result.products_link_url,
      productsLinkUrl: result.products_link_url,
    };

    expect(routeResponse.success).toBe(true);
    expect(routeResponse.redirectUrl).toBe("https://instacart.com/list/abc");
    expect(routeResponse.productsLinkUrl).toBe("https://instacart.com/list/abc");
    expect(routeResponse.redirectUrl).toBe(routeResponse.productsLinkUrl);
  });

  it("error result maps to { success:false, error, status, details }", async () => {
    mockFetch({ ok: false, status: 401, body: { error: "Unauthorized" } });

    try {
      await createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] });
      expect.fail("Should have thrown");
    } catch (err: any) {
      const routeResponse = {
        success: false,
        error: err.message,
        status: err.status || undefined,
        details: err.details || undefined,
      };

      expect(routeResponse.success).toBe(false);
      expect(routeResponse.error).toContain("Instacart API error (HTTP 401)");
      expect(routeResponse.status).toBe(401);
      expect(routeResponse.details).toBeDefined();
    }
  });

  it("missing URL error maps to exact error message", async () => {
    mockFetch({ ok: true, status: 200, body: { other_field: "value" } });

    try {
      await createInstacartShoppingListLink({ lineItems: [{ name: "Milk" }] });
      expect.fail("Should have thrown");
    } catch (err: any) {
      const routeResponse = {
        success: false,
        error: err.message,
      };

      expect(routeResponse.error).toBe("Shopping list URL missing from Instacart response");
    }
  });
});
