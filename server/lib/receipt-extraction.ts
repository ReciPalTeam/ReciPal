import OpenAI from "openai";

// Reuse the same key resolution as recipe-extraction.ts.
function getOpenAIKey(): string {
  const k = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!k) throw new Error("No OpenAI API key set (AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY).");
  return k;
}
let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: getOpenAIKey() });
  return _client;
}

export interface ReceiptItem {
  name: string;       // normalized common product name
  quantity: number;   // count or weight
  unit: string;       // "each" | "lb" | "oz" | "g" | "kg" | "ml" | "l" | "pack" | …
  isProduct: boolean; // false for tax/subtotal/total/payment/savings/non-purchase lines
}
export interface ReceiptExtraction {
  storeName: string | null;
  confidence: "high" | "medium" | "low";
  items: ReceiptItem[];
}

const RECEIPT_SYSTEM_PROMPT = `You are a grocery-receipt OCR assistant. Read the photographed receipt and extract every PURCHASED LINE ITEM into a clean JSON list a user will review before saving to their kitchen pantry. The output must be precise — vague names are useless downstream.

Rules:
- name: the item's full, common English product name. EXPAND cryptic receipt abbreviations and drop SKU codes/price-look-up numbers:
    "GV WHL MLK" → "whole milk"
    "ORG BNLS CHKN BRST" → "organic boneless chicken breast"
    "BNANA" / "BANANAS" → "banana"
    "SHRP CHDR" → "sharp cheddar cheese"
  Use the singular common name where natural. Keep a meaningful brand only if it's part of how people refer to the product; otherwise drop it.
- quantity: a number. For counted items default to the printed count or 1. For WEIGHED items (e.g. "BANANAS 1.24 lb @ $0.59/lb" or "0.84 LB") set quantity to the weight number.
- unit: best-effort lowercase unit — "each" for counted items, or "lb" / "oz" / "g" / "kg" / "ml" / "l" / "pack" / "bunch" / "dozen" for weighed/measured items. Default "each" when unclear.
- isProduct: true for any purchased product (food OR household goods). Set FALSE for non-purchase lines: subtotal, total, tax, change/tender, cash/credit, savings/discounts/coupons, loyalty/points, store name/address/phone, date/time, cashier, and "BALANCE"/"DEBIT" lines.
- Combine an item split across two physical lines (name on one, qty/price on the next) into ONE item.
- Do NOT invent items you can't read. If the photo is blurry, cut off, or low quality, set confidence to "low" and only include items you can actually read.

storeName: the store/merchant name if visible, else null.
confidence: "high" if the receipt is crisp and fully captured, "medium" if mostly readable, "low" if blurry/partial.`;

const RECEIPT_JSON_SCHEMA = {
  name: "ReceiptExtraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      storeName: { type: ["string", "null"] },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            quantity: { type: "number" },
            unit: { type: "string", maxLength: 16 },
            isProduct: { type: "boolean" },
          },
          required: ["name", "quantity", "unit", "isProduct"],
        },
      },
    },
    required: ["storeName", "confidence", "items"],
  },
} as const;

/**
 * Extract grocery line items from a receipt photo via GPT-4o vision + Structured Outputs.
 * `imageDataUrl` is a base64 data URL ("data:image/jpeg;base64,…"); `detail: "high"` preserves the
 * small receipt text. The caller filters `isProduct` and never persists the image.
 */
export async function extractReceiptItems(imageDataUrl: string): Promise<ReceiptExtraction> {
  const completion = await client().chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    response_format: { type: "json_schema", json_schema: RECEIPT_JSON_SCHEMA as any },
    messages: [
      { role: "system", content: RECEIPT_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the purchased line items from this grocery receipt." },
          { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
        ] as any,
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as ReceiptExtraction;
  return {
    storeName: parsed.storeName ?? null,
    confidence: parsed.confidence ?? "low",
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}
