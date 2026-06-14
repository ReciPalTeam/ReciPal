/**
 * Phase M / WS-B — pure, unit-testable feed personalization helpers.
 *
 * - filterByExcludedTerms: hard-excludes recipes containing the user's
 *   dislikedFoods / excludedIngredients (ingredient-name scan, title fallback).
 * - rankByMacroFit (Pro): orders recipes by closeness of their per-serving
 *   macros to the user's per-meal targets, goal-aware, using the ONE shared
 *   tolerance band. Stable — ties keep the incoming (variety) order.
 * - rankByCalorieGoal (Free): calorie-only version for users with a calorieGoal.
 *
 * These run server-side in getForYouFeed AFTER the variety fetch (so which
 * recipes come back still varies per refresh) and BEFORE the slice to `limit`
 * (so the best-fitting of the over-fetched pool survive).
 */
import type { Recipe } from '../../client/src/lib/mock-data';
import { normalizeIngredientName } from '@shared/ingredient-intel';
import { MACRO_TOLERANCE_BAND } from '@shared/nutrition-constants';

/** True when the recipe contains any of the given terms. Scans BOTH normalized
 *  ingredient names (same matching the allergen legacy path uses) AND the
 *  title — the title catches dishes whose ingredient strings use a synonym
 *  (e.g. "Beef Tostadas" listing only "skirt steak"). Over-exclusion is the
 *  safe direction for dislikes. */
export function recipeContainsAnyTerm(recipe: Recipe, normalizedTerms: string[]): boolean {
  if (normalizedTerms.length === 0) return false;
  const title = (recipe.title || '').toLowerCase();
  if (normalizedTerms.some(term => title.includes(term))) return true;
  const names = (recipe.ingredients ?? []).map(i => normalizeIngredientName(i.name));
  return normalizedTerms.some(term => names.some(n => n.includes(term)));
}

/** Hard-exclude recipes containing any disliked/excluded term. */
export function filterByExcludedTerms(recipes: Recipe[], terms: string[] | undefined): Recipe[] {
  const normalized = (terms ?? [])
    .map(t => normalizeIngredientName(String(t)))
    .filter(t => t.length > 1); // ignore empty/1-char noise
  if (normalized.length === 0) return recipes;
  return recipes.filter(r => !recipeContainsAnyTerm(r, normalized));
}

export interface MacroFitOptions {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  /** cut | maintain | bulk (anything else treated as maintain) */
  goal?: string | null;
  /** Daily targets are divided by this to get per-meal targets. Default 3. */
  mealsPerDay?: number;
  /** Deviations inside the band count as a perfect fit. Default = shared 5%. */
  tolerance?: number;
}

/** Deviation of `value` from `target` as a fraction of target, with the
 *  tolerance band zeroed out. Optionally weight overshoot ≠ undershoot. */
function bandedDeviation(
  value: number,
  target: number,
  tolerance: number,
  overshootWeight = 1,
  undershootWeight = 1,
): number {
  if (target <= 0) return 0;
  const dev = (value - target) / target;
  if (Math.abs(dev) <= tolerance) return 0;
  return dev > 0 ? dev * overshootWeight : -dev * undershootWeight;
}

/** Recipes with no nutrition data sink below every scored recipe. */
const NO_DATA_SCORE = 99;

/** Goal-aware macro-fit score — LOWER is better, 0 = on target for everything. */
export function macroFitScore(recipe: Recipe, opts: MacroFitOptions): number {
  const meals = Math.max(opts.mealsPerDay ?? 3, 1);
  const tolerance = opts.tolerance ?? MACRO_TOLERANCE_BAND;
  const calories = recipe.calories ?? 0;
  if (calories <= 0) return NO_DATA_SCORE;

  const perMeal = {
    calories: opts.targetCalories / meals,
    protein: opts.targetProtein / meals,
    carbs: opts.targetCarbs / meals,
    fat: opts.targetFat / meals,
  };

  // Goal-aware asymmetry: cutting punishes calorie overshoot, bulking punishes
  // undershoot; protein closeness matters more when cutting.
  const goal = opts.goal === 'cut' || opts.goal === 'bulk' ? opts.goal : 'maintain';
  const calOver = goal === 'cut' ? 1.5 : 1;
  const calUnder = goal === 'bulk' ? 1.5 : 1;
  const proteinWeight = goal === 'cut' ? 1.25 : 1;

  return (
    bandedDeviation(calories, perMeal.calories, tolerance, calOver, calUnder) * 1.0 +
    bandedDeviation(recipe.protein ?? 0, perMeal.protein, tolerance) * proteinWeight +
    bandedDeviation(recipe.carbs ?? 0, perMeal.carbs, tolerance) * 0.5 +
    bandedDeviation(recipe.fat ?? 0, perMeal.fat, tolerance) * 0.5
  );
}

/** Stable macro-fit ordering (Pro): best fit first; ties keep incoming order. */
export function rankByMacroFit(recipes: Recipe[], opts: MacroFitOptions): Recipe[] {
  return recipes
    .map((recipe, idx) => ({ recipe, idx, score: macroFitScore(recipe, opts) }))
    .sort((a, b) => a.score - b.score || a.idx - b.idx)
    .map(s => s.recipe);
}

/** Stable calorie-goal ordering (Free): closeness to calorieGoal/mealsPerDay. */
export function rankByCalorieGoal(
  recipes: Recipe[],
  calorieGoal: number,
  mealsPerDay = 3,
  tolerance = MACRO_TOLERANCE_BAND,
): Recipe[] {
  const perMeal = calorieGoal / Math.max(mealsPerDay, 1);
  if (perMeal <= 0) return recipes;
  return recipes
    .map((recipe, idx) => {
      const calories = recipe.calories ?? 0;
      const score = calories <= 0 ? NO_DATA_SCORE : bandedDeviation(calories, perMeal, tolerance);
      return { recipe, idx, score };
    })
    .sort((a, b) => a.score - b.score || a.idx - b.idx)
    .map(s => s.recipe);
}
