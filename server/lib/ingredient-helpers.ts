import { getSupabaseClient } from "./supabaseServer";

/**
 * Shared ingredient utilities used by:
 *   - chefRecipeNutrition.ts  (per-serving macro/micro computation)
 *   - normalize-ingredients.ts (post-extraction cleanup of GPT output)
 *
 * Keeping these in one place avoids the trap where the nutrition pipeline and the
 * cart/Instacart pipeline drift apart and lose data when ingredients are passed between
 * them.
 */

export interface IngredientShape {
  name: string;
  amount: string;
  unit: string;
}

// Grams per unit. Volume-based units (cup/tbsp/tsp/ml) treat 1 ml ≈ 1 g — accurate for
// water-based ingredients, off by ~10-20% for oils/honey/etc. Good enough for chef recipe
// macro estimates and shopping-list aggregation.
export const UNIT_TO_GRAMS: Record<string, number> = {
  "": 100,
  g: 1, grams: 1, gram: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  mg: 0.001,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000,
  cup: 240, cups: 240,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  pinch: 0.5, dash: 0.5,
  slice: 30, slices: 30,
  piece: 50, pieces: 50,
  clove: 5, cloves: 5,
  whole: 100,
};

/**
 * Parse a string amount into a number. Handles mixed fractions ("1 1/2"), simple
 * fractions ("1/2"), decimals ("0.5"), integers, and word forms ("one", "half").
 * Returns NaN when the string is empty, vague ("to taste"), or unparseable.
 */
export function parseAmount(raw: string): number {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return NaN;
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const w = parseInt(mixed[1], 10);
    const n = parseInt(mixed[2], 10);
    const d = parseInt(mixed[3], 10);
    return d > 0 ? w + n / d : w;
  }
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const n = parseInt(frac[1], 10);
    const d = parseInt(frac[2], 10);
    return d > 0 ? n / d : NaN;
  }
  const n = parseFloat(s);
  if (Number.isFinite(n)) return n;
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    half: 0.5, quarter: 0.25, third: 0.333,
  };
  return words[s] ?? NaN;
}

/** Normalize a unit string to lowercase, trimmed, no trailing period. */
export function parseUnit(raw: string): string {
  return (raw ?? "").trim().toLowerCase().replace(/\.$/, "");
}

/**
 * Convert an ingredient { amount, unit } pair into grams.
 * Returns null when the amount is unparseable or the unit isn't in UNIT_TO_GRAMS.
 */
export function ingredientToGrams(ing: IngredientShape): number | null {
  const amount = parseAmount(ing.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = parseUnit(ing.unit);
  const gramsPerUnit = UNIT_TO_GRAMS[unit];
  if (gramsPerUnit == null) return null;
  return amount * gramsPerUnit;
}

export interface IngredientMatch {
  ingredient_id: string;
  canonical_name: string;
}

/**
 * Fuzzy-match an ingredient name against the canonical `public.ingredients` catalog.
 * First tries exact case-insensitive match; falls back to substring with shortest-match-wins
 * (so "garlic" beats "roasted garlic spread" when matching "garlic").
 *
 * Returns null when no match is found.
 */
export async function matchIngredientByName(name: string): Promise<IngredientMatch | null> {
  const supabase = getSupabaseClient();
  const cleaned = (name ?? "").trim().toLowerCase();
  if (cleaned.length < 2) return null;

  const { data: exact } = await supabase
    .from("ingredients")
    .select("ingredient_id, canonical_name")
    .ilike("canonical_name", cleaned)
    .limit(1);
  if (exact && exact.length > 0) return exact[0] as IngredientMatch;

  const { data: like } = await supabase
    .from("ingredients")
    .select("ingredient_id, canonical_name")
    .ilike("canonical_name", `%${cleaned}%`)
    .limit(10);
  if (like && like.length > 0) {
    like.sort((a, b) => a.canonical_name.length - b.canonical_name.length);
    return like[0] as IngredientMatch;
  }
  return null;
}
