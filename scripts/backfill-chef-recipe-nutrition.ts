import { db } from "../server/db";
import { chefRecipes } from "../shared/schema";
import { computeChefRecipeNutrition } from "../server/lib/chefRecipeNutrition";
import { eq, isNull } from "drizzle-orm";

/**
 * One-shot: walk every chef_recipes row whose `nutrition` is NULL and compute it.
 * Safe to re-run — only touches rows where nutrition isn't already cached.
 */
async function main() {
  const rows = await db
    .select()
    .from(chefRecipes)
    .where(isNull(chefRecipes.nutrition));

  console.log(`Found ${rows.length} chef_recipes with NULL nutrition. Backfilling…\n`);

  let computed = 0;
  let unmatched = 0;
  for (const r of rows) {
    const n = await computeChefRecipeNutrition(r.ingredients ?? [], r.servings ?? 1);
    if (!n) {
      console.log(`  [${r.id}] ${r.title} — no matchable ingredients (skipping)`);
      unmatched++;
      continue;
    }
    await db
      .update(chefRecipes)
      .set({ nutrition: n, updatedAt: new Date() })
      .where(eq(chefRecipes.id, r.id));
    console.log(`  [${r.id}] ${r.title} — ${n.calories} cal, ${n.protein}g P, ${n.carbs}g C, ${n.fat}g F`);
    computed++;
  }

  console.log(`\nDone. ${computed} backfilled, ${unmatched} skipped (no ingredient matches).`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
