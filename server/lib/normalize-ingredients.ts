import { parseAmount, matchIngredientByName, type IngredientShape } from "./ingredient-helpers";
import { normalizeInstacartUnit } from "./instacartUnits";

/**
 * Post-extraction normalization for chef-recipe ingredients.
 *
 * The GPT extractor and (less often) manual entries produce free-form { name, amount, unit }
 * triples — "to taste", "a few", brand names, etc. The cart aggregator and Instacart payload
 * builder need numeric amounts and canonical InstacartUnit values. This module bridges the
 * gap by running every ingredient through three stages:
 *
 *   1. Amount cleanup: if the amount is non-numeric, match against VAGUE_AMOUNT_DEFAULTS
 *      and substitute a sensible quantity. Falls back to "1" if nothing matches.
 *   2. Unit normalization: normalizeInstacartUnit() maps idiomatic spellings ("lbs", "tsp")
 *      into the canonical InstacartUnit enum. Unknown units become "" (count-only).
 *   3. Name canonicalization: matchIngredientByName() looks up the 2,792-row
 *      public.ingredients catalog and substitutes the canonical name when found, so the
 *      cart can deduplicate across recipes.
 */

export interface NormalizedIngredient {
  name: string;
  amount: string;
  unit: string;
  /** ingredient_id from public.ingredients; null when no canonical match was found. */
  canonicalIngredientId: string | null;
  /** Telemetry signal: HIGH = both unit + name matched, LOW = either didn't. */
  normalizationConfidence: "HIGH" | "MED" | "LOW";
}

/**
 * Vague-phrase fallbacks. Aligned with the prompt instructions in recipe-extraction.ts so
 * post-process behavior matches what the model is asked to do. Order matters: more specific
 * patterns must come before more general ones.
 */
const VAGUE_AMOUNT_DEFAULTS: { match: RegExp; amount: string; unit: string }[] = [
  { match: /\b(pinch|dash|sprinkle)\b/i,  amount: "0.25", unit: "teaspoon" },
  { match: /\bto\s*taste\b/i,             amount: "1",    unit: "teaspoon" },
  { match: /\ba?\s*handful\b/i,           amount: "0.25", unit: "cup" },
  { match: /\b(several|a\s*few|few)\b/i,  amount: "3",    unit: "each" },
  { match: /\bsome\b/i,                   amount: "1",    unit: "tablespoon" },
  { match: /\blots?\s*of\b/i,             amount: "2",    unit: "tablespoon" },
];

export async function normalizeIngredient(raw: IngredientShape): Promise<NormalizedIngredient> {
  // ── 1. Amount cleanup ──────────────────────────────────────────────────────
  const rawAmountStr = String(raw.amount ?? "");
  let amount = rawAmountStr.trim();
  let unit = String(raw.unit ?? "").trim();

  const parsed = parseAmount(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    // Look for a known vague phrase in the original amount string.
    const hit = VAGUE_AMOUNT_DEFAULTS.find((d) => d.match.test(rawAmountStr));
    if (hit) {
      amount = hit.amount;
      // Only substitute the default unit when the original is empty — don't override
      // an explicit unit the chef provided (e.g. "to taste, cup" stays "cup").
      if (!unit) unit = hit.unit;
    } else {
      // Last-resort fallback so the cart can at least show "1 X" — better than nothing.
      amount = "1";
    }
  } else {
    // Normalize numeric formatting (round to 4 dp to avoid 0.3333333…).
    amount = String(Math.round(parsed * 10000) / 10000);
  }

  // ── 2. Unit normalization ──────────────────────────────────────────────────
  let normalizedUnit = "";
  let unitConfidence: "HIGH" | "MED" | "LOW" = "HIGH";
  if (unit) {
    const result = normalizeInstacartUnit(unit);
    if (result.normalizedUnit) {
      normalizedUnit = result.normalizedUnit;
      unitConfidence = result.confidence;
    } else {
      // Unknown unit string — drop to count-only ("" means "1 of X").
      unitConfidence = "LOW";
    }
  }

  // ── 3. Name canonicalization ───────────────────────────────────────────────
  const match = await matchIngredientByName(raw.name);
  const canonicalName = match?.canonical_name ?? (raw.name ?? "").trim().toLowerCase();
  const canonicalIngredientId = match?.ingredient_id ?? null;
  const nameMatched = match !== null;

  const confidence: "HIGH" | "MED" | "LOW" =
    !nameMatched || unitConfidence === "LOW" ? "LOW" :
    unitConfidence === "MED" ? "MED" : "HIGH";

  return {
    name: canonicalName,
    amount,
    unit: normalizedUnit,
    canonicalIngredientId,
    normalizationConfidence: confidence,
  };
}

/**
 * Normalize a list of ingredients with limited concurrency. Each call hits Supabase for the
 * name match; running them sequentially on a 12-ingredient recipe takes ~1.5s. Concurrency 5
 * brings that under 300ms while not blowing up the DB connection pool.
 */
export async function normalizeIngredients(raw: IngredientShape[]): Promise<NormalizedIngredient[]> {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const out: NormalizedIngredient[] = new Array(raw.length);
  let next = 0;
  const concurrency = Math.min(5, raw.length);

  await Promise.all(
    Array.from({ length: concurrency }).map(async () => {
      while (true) {
        const idx = next++;
        if (idx >= raw.length) return;
        out[idx] = await normalizeIngredient(raw[idx]);
      }
    }),
  );

  // Telemetry — pick up regressions where new chef slang slips past the prompt.
  const lowCount = out.filter((o) => o.normalizationConfidence === "LOW").length;
  if (lowCount > 0) {
    console.log("[normalize-ingredients]", JSON.stringify({
      total: raw.length,
      low: lowCount,
      low_samples: out
        .map((o, i) => ({ original: raw[i], normalized: o }))
        .filter((x) => x.normalized.normalizationConfidence === "LOW")
        .slice(0, 3),
    }));
  }

  return out;
}

/**
 * Strip the optional `canonicalIngredientId` + `normalizationConfidence` fields, returning
 * the bare `{ name, amount, unit }` shape that the chef_recipes JSONB column stores.
 *
 * The canonical fk isn't persisted in v1 — the cart re-resolves at query time via
 * matchIngredientByName, same as the nutrition pipeline. This keeps the JSONB shape
 * backward-compatible with existing rows and the chef recipe edit form.
 */
export function toStoredShape(n: NormalizedIngredient): IngredientShape {
  return { name: n.name, amount: n.amount, unit: n.unit };
}
