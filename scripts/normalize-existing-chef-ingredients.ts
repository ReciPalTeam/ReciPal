import { db } from "../server/db";
import { chefRecipes } from "../shared/schema";
import { normalizeIngredients, toStoredShape } from "../server/lib/normalize-ingredients";
import { computeChefRecipeNutrition } from "../server/lib/chefRecipeNutrition";
import { eq } from "drizzle-orm";

/**
 * One-shot: walk every chef_recipes row, normalize each row's `ingredients` JSONB through
 * the same pipeline that POST/PUT /api/chef-recipes uses, and recompute `nutrition` from the
 * cleaned ingredients. Idempotent — re-running on already-clean rows produces no changes.
 *
 * NEW behavior shipped in Phase H.8:
 *   - Vague amounts ("to taste", "a few") → numeric defaults
 *   - Idiomatic units ("lbs", "tsp") → canonical InstacartUnit values
 *   - Non-canonical names ("Busy People™ minced garlic") → canonical_name from ingredients table
 *
 * USAGE (after explicit chat approval):
 *   npx tsx scripts/normalize-existing-chef-ingredients.ts
 *
 * For each row, prints the before/after diff so the human can spot-check.
 */
async function main() {
  const rows = await db.select().from(chefRecipes);
  console.log(`Found ${rows.length} chef_recipes row(s). Normalizing in place…\n`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const r of rows) {
    const before = r.ingredients ?? [];
    if (!Array.isArray(before) || before.length === 0) {
      console.log(`  [${r.id}] ${r.title} — empty ingredients, skipping`);
      unchanged++;
      continue;
    }

    let normalized;
    try {
      const result = await normalizeIngredients(before as any);
      normalized = result.map(toStoredShape);
    } catch (err: any) {
      console.error(`  [${r.id}] ${r.title} — normalization FAILED: ${err?.message ?? err}`);
      failed++;
      continue;
    }

    // Skip the write when nothing changed (idempotent).
    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(normalized);
    if (beforeJson === afterJson) {
      console.log(`  [${r.id}] ${r.title} — already canonical, no changes`);
      unchanged++;
      continue;
    }

    // Recompute nutrition from the normalized ingredients.
    const nutrition = await computeChefRecipeNutrition(normalized, r.servings ?? 1).catch(
      (err) => {
        console.error(`  [${r.id}] nutrition recompute failed (non-fatal): ${err?.message ?? err}`);
        return null;
      },
    );

    await db
      .update(chefRecipes)
      .set({ ingredients: normalized, nutrition, updatedAt: new Date() })
      .where(eq(chefRecipes.id, r.id));

    console.log(`\n  [${r.id}] ${r.title} — UPDATED`);
    console.log(`    BEFORE: ${beforeJson.slice(0, 200)}${beforeJson.length > 200 ? "…" : ""}`);
    console.log(`    AFTER : ${afterJson.slice(0, 200)}${afterJson.length > 200 ? "…" : ""}`);
    updated++;
  }

  console.log(`\nDone. ${updated} updated, ${unchanged} unchanged, ${failed} failed.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
