import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInstacartShoppingListLink } from "../instacartMeasurement";

describe("createInstacartShoppingListLink", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, INSTACART_API_KEY: "test-key-123" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("throws if INSTACART_API_KEY is missing", async () => {
    delete process.env.INSTACART_API_KEY;
    await expect(
      createInstacartShoppingListLink({ title: "Test", lineItems: [{ name: "Milk" }] })
    ).rejects.toThrow("INSTACART_API_KEY not configured");
  });

  it("sends link_type=shopping_list and reads products_link_url from response", async () => {
    let capturedBody: any = null;
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    vi.stubGlobal("fetch", async (url: string, opts: any) => {
      capturedUrl = url;
      capturedBody = JSON.parse(opts.body);
      capturedHeaders = opts.headers;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ products_link_url: "https://instacart.com/store/checkout/abc123" }),
      };
    });

    const result = await createInstacartShoppingListLink({
      title: "ReciPal Grocery List",
      lineItems: [
        { name: "Shrimp", quantity: 4, unit: "ounce" },
        { name: "Cumin" },
      ],
    });

    expect(capturedUrl).toBe("https://connect.instacart.com/idp/v1/products/products_link");
    expect(capturedHeaders["Authorization"]).toBe("Bearer test-key-123");
    expect(capturedBody.link_type).toBe("shopping_list");
    expect(capturedBody.title).toBe("ReciPal Grocery List");
    expect(capturedBody.line_items).toHaveLength(2);

    expect(capturedBody.line_items[0]).toEqual({ name: "Shrimp", quantity: 4, unit: "ounce" });
    expect(capturedBody.line_items[1]).toEqual({ name: "Cumin", quantity: 1, unit: "each" });

    expect(result.products_link_url).toBe("https://instacart.com/store/checkout/abc123");
  });

  it("applies safety fallbacks: null qty→1, empty unit→each", async () => {
    let capturedBody: any = null;

    vi.stubGlobal("fetch", async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ products_link_url: "https://instacart.com/test" }),
      };
    });

    await createInstacartShoppingListLink({
      title: "Test",
      lineItems: [
        { name: "Salt", quantity: 0, unit: "" },
        { name: "Pepper", quantity: -1, unit: "   " },
        { name: "Oregano" },
      ],
    });

    expect(capturedBody.line_items[0]).toEqual({ name: "Salt", quantity: 1, unit: "each" });
    expect(capturedBody.line_items[1]).toEqual({ name: "Pepper", quantity: 1, unit: "each" });
    expect(capturedBody.line_items[2]).toEqual({ name: "Oregano", quantity: 1, unit: "each" });
  });

  it("includes display_text when provided", async () => {
    let capturedBody: any = null;

    vi.stubGlobal("fetch", async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ products_link_url: "https://instacart.com/test" }),
      };
    });

    await createInstacartShoppingListLink({
      title: "Test",
      lineItems: [
        { name: "Shrimp", quantity: 4, unit: "ounce", display_text: "Shrimp — 4 ounce" },
        { name: "Cumin", quantity: 1, unit: "each" },
      ],
    });

    expect(capturedBody.line_items[0].display_text).toBe("Shrimp — 4 ounce");
    expect(capturedBody.line_items[1].display_text).toBeUndefined();
  });

  it("throws on non-2xx response", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "Unauthorized" }),
    }));

    await expect(
      createInstacartShoppingListLink({ title: "Test", lineItems: [{ name: "Milk" }] })
    ).rejects.toThrow("Instacart API error (HTTP 401)");
  });

  it("throws when products_link_url is missing from response", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ some_other_field: "value" }),
    }));

    await expect(
      createInstacartShoppingListLink({ title: "Test", lineItems: [{ name: "Milk" }] })
    ).rejects.toThrow("Instacart products_link_url missing from response");
  });
});
