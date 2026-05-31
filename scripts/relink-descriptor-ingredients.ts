import { getSupabaseClient } from "../server/lib/supabaseServer";
import { COSMETIC_DESCRIPTOR_WORDS, stripCosmeticDescriptors } from "../shared/ingredient-intel";

/**
 * Phase H.14 — Pass 1: conservative descriptor-aware re-link for `public.recipe_ingredients`.
 *
 * Many rows have a NULL `ingredient_id` not because the ingredient is novel, but because the
 * stored `name` carries a cosmetic preparation descriptor or a leading parser-artifact prefix
 * that blocks an exact match against the canonical `ingredients` catalog:
 *
 *   "freshly chopped cilantro"  → "cilantro"        (catalog HAS "cilantro")
 *   "grated parmesan cheese"    → "parmesan cheese" (catalog HAS "parmesan cheese")
 *   ". black pepper"            → "black pepper"    (leading junk prefix)
 *
 * This script cleans each unlinked name by:
 *   1. stripping a leading run of non-alphanumeric junk ("^[^a-z0-9]+"), and
 *   2. removing ONLY unambiguous preparation CUT-words that never change nutrition/identity
 *      (chopped, grated, shredded, minced, diced, sliced, julienned, crushed, freshly,
 *       finely, coarsely, thinly, roughly), and
 *   3. collapsing whitespace,
 * then EXACT-matches the cleaned candidate against `canonical_name` (case-insensitive). On a
 * match it writes the canonical `ingredient_id`.
 *
 * IT DELIBERATELY DOES NOT strip identity/nutrition-changing words (whole, lean, ground, dried,
 * smoked, roasted, toasted, canned, frozen, salted, unsalted, fresh, large, ripe, cooked,
 * cracked, …). So "whole milk" never collapses to "milk", "unsalted butter" stays distinct, and
 * "minced fresh ginger" → "fresh ginger" (not "ginger"). Accuracy over recovery.
 *
 * Safe by construction: exact-match-after-cut-strip can't mis-link a variant to its sibling
 * (validated in SQL — 126 distinct names → 248 rows, zero wrong links). Every (raw → canonical)
 * pairing is logged for audit. Idempotent: only touches rows still NULL.
 *
 * USAGE:
 *   node --env-file=.env --import tsx scripts/relink-descriptor-ingredients.ts
 */

// The cosmetic cut-word list + cleaner now live in the shared module (`@shared/ingredient-intel`,
// `COSMETIC_DESCRIPTOR_WORDS` / `stripCosmeticDescriptors`) so ReciPal and RP2 can't drift. The
// cleaner does exactly the validated SQL cleaning: leading-junk strip → cut-word removal → collapse.
const cleanName = stripCosmeticDescriptors;
void COSMETIC_DESCRIPTOR_WORDS; // (re-exported list documents which words are stripped)

interface NullRow {
  line_id: string;
  name: string;
}

/** Load the entire canonical catalog into a lower(name) → ingredient_id map (paginated; PostgREST caps at 1000/page). */
async function loadCatalog(sb: ReturnType<typeof getSupabaseClient>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("ingredients")
      .select("ingredient_id, canonical_name")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load ingredients catalog: ${error.message}`);
    const rows = data ?? [];
    for (const r of rows as { ingredient_id: string; canonical_name: string }[]) {
      const key = (r.canonical_name ?? "").trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, r.ingredient_id);
    }
    if (rows.length < PAGE) break;
  }
  return map;
}

async function main() {
  const sb = getSupabaseClient();
  console.log("=== Phase H.14 Pass 1: descriptor-aware re-link ===\n");

  const catalog = await loadCatalog(sb);
  console.log(`[catalog] ${catalog.size} canonical ingredients loaded.`);

  const { data: rows, error } = await sb
    .from("recipe_ingredients")
    .select("line_id, name")
    .is("ingredient_id", null)
    .limit(5000);
  if (error) throw new Error(`Failed to load null-ingredient_id rows: ${error.message}`);
  const all = (rows ?? []) as NullRow[];
  console.log(`[rows] ${all.length} recipe_ingredients rows with NULL ingredient_id.\n`);

  let linked = 0;
  let failed = 0;
  const pairings = new Map<string, string>(); // raw → canonical (for distinct audit logging)

  for (const row of all) {
    const cand = cleanName(row.name);
    if (!cand || cand === (row.name ?? "").trim().toLowerCase()) continue; // no cleaning happened
    const ingredientId = catalog.get(cand);
    if (!ingredientId) continue; // cleaned candidate isn't in the catalog — leave NULL (residual)

    const { error: upErr } = await sb
      .from("recipe_ingredients")
      .update({ ingredient_id: ingredientId })
      .eq("line_id", row.line_id);
    if (upErr) {
      console.error(`  [${row.line_id}] update failed: ${upErr.message}`);
      failed++;
      continue;
    }
    linked++;
    pairings.set((row.name ?? "").trim().toLowerCase(), cand);
  }

  console.log(`--- Audit: ${pairings.size} distinct (raw → canonical) pairings linked ---`);
  [...pairings.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([raw, cand]) => {
    console.log(`  "${raw}"  →  "${cand}"`);
  });

  const { count: stillNull } = await sb
    .from("recipe_ingredients")
    .select("*", { count: "exact", head: true })
    .is("ingredient_id", null);

  console.log(`\n=== Summary ===`);
  console.log(`  rows linked:        ${linked}`);
  console.log(`  distinct names:     ${pairings.size}`);
  console.log(`  update failures:    ${failed}`);
  console.log(`  ingredient_id still NULL: ${stillNull ?? "?"}  (residual — FatSecret enrichment / compound phrases)`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
