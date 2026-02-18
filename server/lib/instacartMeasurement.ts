export interface InstacartLineItem {
  name: string;
  quantity?: number;
  unit?: string;
  display_text?: string;
}

export interface CreateShoppingListParams {
  title?: string;
  lineItems: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    display_text?: string;
  }>;
  correlationId?: string;
  partnerLinkbackUrl?: string;
}

export interface InstacartShoppingListResult {
  products_link_url: string;
  raw: any;
}

export function resolveInstacartConfig(): { env: string; baseUrl: string; endpoint: string; hasKey: boolean } {
  const env = (process.env.INSTACART_API_ENV || "development").toLowerCase();
  const endpoint = "/idp/v1/products/products_link";

  let baseUrl: string;
  if (process.env.INSTACART_BASE_URL) {
    baseUrl = process.env.INSTACART_BASE_URL.replace(/\/+$/, "");
  } else if (env === "production") {
    baseUrl = "https://connect.instacart.com";
  } else {
    baseUrl = "https://connect.dev.instacart.tools";
  }

  return {
    env: env === "production" ? "production" : "development",
    baseUrl,
    endpoint,
    hasKey: !!process.env.INSTACART_API_KEY,
  };
}

export async function createInstacartShoppingListLink(
  params: CreateShoppingListParams
): Promise<InstacartShoppingListResult> {
  const apiKey = process.env.INSTACART_API_KEY;
  if (!apiKey) {
    throw new Error("INSTACART_API_KEY not configured");
  }

  const config = resolveInstacartConfig();
  const fullUrl = `${config.baseUrl}${config.endpoint}`;
  const keyPrefix = apiKey.substring(0, 6) + "...redacted";
  const title = params.title && params.title.trim() !== ""
    ? params.title
    : `ReciPal Shopping List - ${new Date().toISOString().split("T")[0]}`;

  const validItems = params.lineItems.filter(item => {
    if (!item.name || item.name.trim() === "") {
      console.log(`[Instacart] Skipping line item with blank name`);
      return false;
    }
    return true;
  });

  const payload: any = {
    title,
    link_type: "shopping_list",
    line_items: validItems.map(item => {
      const li: InstacartLineItem = { name: item.name.trim() };
      li.quantity = (item.quantity != null && item.quantity > 0) ? item.quantity : 1;
      li.unit = (item.unit && item.unit.trim() !== "") ? item.unit : "each";
      li.display_text = item.display_text || item.name.trim();
      return li;
    }),
  };

  if (params.partnerLinkbackUrl) {
    payload.landing_page_configuration = {
      partner_linkback_url: params.partnerLinkbackUrl,
      enable_pantry_items: false,
    };
  }

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.text();

  console.log(`[Instacart] API call: env=${config.env} baseUrl=${config.baseUrl} endpoint=${config.endpoint} keyPrefix=${keyPrefix} status=${response.status} correlationId=${params.correlationId || "none"} itemCount=${payload.line_items.length}`);

  let responseData: any;
  try {
    responseData = JSON.parse(responseBody);
  } catch {
    const truncated = responseBody.substring(0, 2000);
    console.error(`[Instacart] Non-JSON response (HTTP ${response.status}): ${truncated}`);
    throw new InstacartApiError(
      `Instacart API returned non-JSON response (HTTP ${response.status})`,
      response.status,
      truncated
    );
  }

  if (!response.ok) {
    const truncated = responseBody.substring(0, 2000);
    console.error(`[Instacart] API error (HTTP ${response.status}): ${truncated}`);
    throw new InstacartApiError(
      `Instacart API error (HTTP ${response.status}): ${truncated}`,
      response.status,
      truncated
    );
  }

  const productsLinkUrl = responseData?.products_link_url;
  if (!productsLinkUrl || typeof productsLinkUrl !== "string") {
    console.error(`[Instacart] products_link_url missing from response: ${responseBody.substring(0, 2000)}`);
    throw new InstacartApiError(
      "Shopping list URL missing from Instacart response",
      response.status,
      responseBody.substring(0, 2000)
    );
  }

  return { products_link_url: productsLinkUrl, raw: responseData };
}

export class InstacartApiError extends Error {
  status: number;
  details: string;
  constructor(message: string, status: number, details: string) {
    super(message);
    this.name = "InstacartApiError";
    this.status = status;
    this.details = details;
  }
}
