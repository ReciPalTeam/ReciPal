import { getSupabaseClient } from "../server/lib/supabaseServer";
import { matchIngredientByName } from "../server/lib/ingredient-helpers";

/**
 * One-shot, idempotent backfill for `public.recipe_ingredients` (Phase H.10):
 *
 *   1. ingredient_id — for every row with a NULL `ingredient_id`, fuzzy-match its `name`
 *      against the canonical `ingredients` catalog using the SAME matcher the app uses at
 *      read time (matchIngredientByName: exact ilike → canonical-contains-name shortest-wins).
 *      Writes the matched id. Classifies each match as EXACT or FUZZY and logs every FUZZY
 *      match so they're auditable. Rows that don't match are left NULL (honest — they need
 *      the RP2/FatSecret path).
 *
 *   2. display_text de-junk — for null-amount rows whose display_text has a spurious leading
 *      number (e.g. "1 butter", "1 about 1 cup ketchup"), strip the leading "N " prefix.
 *      Only touches null-amount rows, so legit "1 cup rice" (amount set) is never altered.
 *
 * Idempotent: re-running only touches rows still NULL / still junk.
 *
 * USAGE (after plan approval):
 *   node --env-file=.env --import tsx scripts/backfill-recipe-ingredient-ids.ts
 */

const CONCURRENCY = 5;
const LEADING_NUMBER = /^[0-9]+(\.[0-9]+)?\s+/;

// A leading number is JUNK only when the ingredient NAME follows it directly. When a UNIT
// follows (e.g. "1 teaspoon salt"), the number is a legitimate quantity and must be kept.
const UNIT_WORDS = new Set([
  "teaspoon", "teaspoons", "tsp", "tablespoon", "tablespoons", "tbsp", "cup", "cups",
  "ounce", "ounces", "oz", "pound", "pounds", "lb", "lbs", "gram", "grams", "g", "kg",
  "milliliter", "ml", "liter", "l", "pint", "quart", "gallon", "can", "cans", "spray",
  "sprays", "clove", "cloves", "slice", "slices", "stick", "sticks", "package", "packet",
  "bunch", "head", "pinch", "dash", "scoop", "stalk", "sprig",
]);

function isJunkLeadingNumber(displayText: string): boolean {
  if (!LEADING_NUMBER.test(displayText)) return false;
  const afterNumber = displayText.replace(LEADING_NUMBER, "");
  const firstWord = afterNumber.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  return !UNIT_WORDS.has(firstWord); // junk only when a unit does NOT follow the number
}

interface NullIdRow {
  line_id: string;
  name: string;
}

async function backfillIngredientIds(sb: ReturnType<typeof getSupabaseClient>) {
  const { data: rows, error } = await sb
    .from("recipe_ingredients")
    .select("line_id, name")
    .is("ingredient_id", null)
    .limit(5000);
  if (error) throw new Error(`Failed to load null-ingredient_id rows: ${error.message}`);

  const all = (rows ?? []) as NullIdRow[];
  console.log(`\n[ingredient_id] ${all.length} rows with NULL ingredient_id. Matching…\n`);

  // Only EXACT matches are auto-written — substring fuzzy matching produced dangerous false
  // positives (e.g. "salted butter" → "unsalted butter", "chopped cilantro" → a compound
  // garnish entry), so fuzzy candidates are LOGGED for human review instead of written.
  let exact = 0;
  let fuzzyCandidates = 0;
  let unmatched = 0;
  const fuzzyLog: string[] = [];
  const queue = [...all];

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, all.length || 1) }).map(async () => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) return;
        const match = await matchIngredientByName(row.name);
        if (!match) {
          unmatched++;
          continue;
        }
        const isExact =
          (match.canonical_name ?? "").trim().toLowerCase() === (row.name ?? "").trim().toLowerCase();
        if (!isExact) {
          // Do NOT auto-write fuzzy — log for manual review.
          fuzzyCandidates++;
          fuzzyLog.push(`  FUZZY?  "${row.name}"  →  "${match.canonical_name}"  (line ${row.line_id})`);
          continue;
        }
        const { error: upErr } = await sb
          .from("recipe_ingredients")
          .update({ ingredient_id: match.ingredient_id })
          .eq("line_id", row.line_id);
        if (upErr) {
          console.error(`  [${row.line_id}] update failed: ${upErr.message}`);
          unmatched++;
          continue;
        }
        exact++;
      }
    }),
  );

  if (fuzzyLog.length > 0) {
    console.log("--- Fuzzy candidates (NOT written — review + apply manually if correct) ---");
    fuzzyLog.forEach((l) => console.log(l));
    console.log("");
  }
  console.log(`[ingredient_id] exact_written=${exact}  fuzzy_candidates(logged)=${fuzzyCandidates}  unmatched=${unmatched}  (of ${all.length})`);
  return { exact, fuzzyCandidates, unmatched };
}

async function dejunkDisplayText(sb: ReturnType<typeof getSupabaseClient>) {
  // PostgREST can't regex-filter, so fetch null-amount rows and filter the prefix in JS.
  const { data: rows, error } = await sb
    .from("recipe_ingredients")
    .select("line_id, display_text")
    .is("amount", null)
    .limit(5000);
  if (error) throw new Error(`Failed to load null-amount rows: ${error.message}`);

  const junk = (rows ?? []).filter(
    (r: any) => typeof r.display_text === "string" && isJunkLeadingNumber(r.display_text),
  );
  console.log(`\n[display_text] ${junk.length} null-amount rows with a junk leading number. Stripping…`);

  let cleaned = 0;
  for (const r of junk as { line_id: string; display_text: string }[]) {
    const fixed = r.display_text.replace(LEADING_NUMBER, "").trim();
    if (fixed.length === 0 || fixed === r.display_text) continue; // never blank it / no-op
    const { error: upErr } = await sb
      .from("recipe_ingredients")
      .update({ display_text: fixed })
      .eq("line_id", r.line_id);
    if (upErr) {
      console.error(`  [${r.line_id}] update failed: ${upErr.message}`);
      continue;
    }
    console.log(`  "${r.display_text}"  →  "${fixed}"`);
    cleaned++;
  }
  console.log(`[display_text] cleaned=${cleaned}`);
  return { cleaned };
}

async function main() {
  const sb = getSupabaseClient();
  console.log("=== Phase H.10 backfill: recipe_ingredients ===");
  const ids = await backfillIngredientIds(sb);
  const dt = await dejunkDisplayText(sb);

  const { count: stillNull } = await sb
    .from("recipe_ingredients")
    .select("*", { count: "exact", head: true })
    .is("ingredient_id", null);

  console.log("\n=== Summary ===");
  console.log(`  ingredient_id linked (exact only): ${ids.exact}`);
  console.log(`  fuzzy candidates logged (not written): ${ids.fuzzyCandidates}`);
  console.log(`  ingredient_id still NULL: ${stillNull ?? "?"} (exact-unmatchable — fuzzy review or RP2/FatSecret pass)`);
  console.log(`  display_text de-junked: ${dt.cleaned}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
