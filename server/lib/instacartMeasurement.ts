export interface InstacartLineItem {
  name: string;
  quantity?: number;
  unit?: string;
  display_text?: string;
}

export interface CreateShoppingListParams {
  title: string;
  lineItems: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    display_text?: string;
  }>;
}

export async function createInstacartShoppingListLink(
  params: CreateShoppingListParams
): Promise<{ products_link_url: string }> {
  const apiKey = process.env.INSTACART_API_KEY;
  if (!apiKey) {
    throw new Error("INSTACART_API_KEY not configured");
  }

  const payload = {
    title: params.title,
    link_type: "shopping_list",
    line_items: params.lineItems.map(item => {
      const li: InstacartLineItem = { name: item.name };
      li.quantity = (item.quantity != null && item.quantity > 0) ? item.quantity : 1;
      li.unit = (item.unit && item.unit.trim() !== "") ? item.unit : "each";
      if (item.display_text) {
        li.display_text = item.display_text;
      }
      return li;
    }),
  };

  const response = await fetch("https://connect.instacart.com/idp/v1/products/products_link", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.text();
  let responseData: any;
  try {
    responseData = JSON.parse(responseBody);
  } catch {
    throw new Error(`Instacart API returned non-JSON response (HTTP ${response.status}): ${responseBody.substring(0, 500)}`);
  }

  if (!response.ok) {
    throw new Error(`Instacart API error (HTTP ${response.status}): ${responseBody.substring(0, 1000)}`);
  }

  const productsLinkUrl = responseData?.products_link_url;
  if (!productsLinkUrl || typeof productsLinkUrl !== "string") {
    throw new Error(`Instacart products_link_url missing from response: ${responseBody.substring(0, 1000)}`);
  }

  return { products_link_url: productsLinkUrl };
}
