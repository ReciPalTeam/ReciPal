import { Recipe } from './mock-data';

export interface MacroRemaining {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Score a side recipe for pairing with a parent meal.
 * Higher score = better match.
 */
export function scoreSideForMeal(
  side: Recipe,
  parentRecipe: Recipe,
  dailyMacroRemaining: MacroRemaining
): number {
  let score = 50; // base

  // Cuisine match bonus
  if (side.cuisine && parentRecipe.cuisine && side.cuisine.toLowerCase() === parentRecipe.cuisine.toLowerCase()) {
    score += 30;
  }

  // Macro gap filling — reward sides that help close macro shortfalls
  if (dailyMacroRemaining.protein > 20 && side.protein > 0) {
    score += Math.min(20, side.protein * 0.5);
  }
  if (dailyMacroRemaining.carbs > 30 && side.carbs > 0) {
    score += Math.min(15, side.carbs * 0.3);
  }

  // Penalty for overshooting daily calories
  if (dailyMacroRemaining.calories < side.calories) {
    score -= 20;
  }

  // Small random jitter for variety
  score += Math.random() * 10;

  return score;
}

/**
 * Get recommended sides for a parent recipe, sorted by score.
 */
export function getRecommendedSides(
  parentRecipe: Recipe,
  allSideRecipes: Recipe[],
  dailyMacroRemaining: MacroRemaining,
  limit: number = 10
): Recipe[] {
  const scored = allSideRecipes
    .filter(s => s.id !== parentRecipe.id)
    .map(side => ({
      side,
      score: scoreSideForMeal(side, parentRecipe, dailyMacroRemaining),
    }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.side);
}

/**
 * Check if a recipe qualifies as a side dish.
 */
export function isSideRecipe(recipe: Recipe): boolean {
  const mealTypes = recipe.mealTypes || [];
  const hasSideMealType = mealTypes.some(t => t.toLowerCase() === 'side');
  const hasSideDishType = (recipe as any).dish_type?.toLowerCase() === 'side dish';
  return hasSideMealType || hasSideDishType;
}
