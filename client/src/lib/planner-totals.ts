import { MealState } from './demo-store';
import { Recipe } from './mock-data';
import { getIngredientNutritionEstimate } from './ingredient-classifier';

export interface PlannedMealInput {
  id: string;
  recipeId: string;
  dayIndex: number;
  mealType: string;
  mealState: MealState;
  date?: string;
  servings: number;
  ingredientOverrides?: IngredientOverrideInput[];
}

export interface IngredientOverrideInput {
  originalIngredientName: string;
  replacementName: string;
  replacementNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface ConsumptionLogInput {
  id: number;
  date: string;
  sourceType: 'checkout_logged_recipe' | 'cooknow_logged_recipe' | 'manual_custom_entry';
  recipeId?: number | null;
  name?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeLookup {
  [recipeId: string]: Recipe | undefined;
}

export interface PlannerSummary {
  todayCalories: number;
  todayMacros: MacroTotals;
  weekCalories: number;
  weekMacros: MacroTotals;
}

const nutritionCache = new Map<string, MacroTotals>();

function getSwapHash(overrides?: IngredientOverrideInput[]): string {
  if (!overrides || overrides.length === 0) return '';
  return overrides
    .map(o => `${o.originalIngredientName}:${o.replacementName}`)
    .sort()
    .join('|');
}

function getCacheKey(mealId: string, servings: number, swapHash: string): string {
  return `${mealId}:${servings}:${swapHash}`;
}

export function computeMealNutritionSnapshot(
  meal: PlannedMealInput,
  recipe: Recipe | undefined
): MacroTotals {
  if (!recipe) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  
  const swapHash = getSwapHash(meal.ingredientOverrides);
  const cacheKey = getCacheKey(meal.id, meal.servings, swapHash);
  
  const cached = nutritionCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  let baseCals = (recipe.calories || 0) * meal.servings;
  let baseProtein = (recipe.protein || 0) * meal.servings;
  let baseCarbs = (recipe.carbs || 0) * meal.servings;
  let baseFat = (recipe.fat || 0) * meal.servings;
  
  const overrides = meal.ingredientOverrides || [];
  overrides.forEach(override => {
    const originalNutrition = getIngredientNutritionEstimate(override.originalIngredientName);
    baseCals += (override.replacementNutrition.calories - originalNutrition.calories) * meal.servings;
    baseProtein += (override.replacementNutrition.protein - originalNutrition.protein) * meal.servings;
    baseCarbs += (override.replacementNutrition.carbs - originalNutrition.carbs) * meal.servings;
    baseFat += (override.replacementNutrition.fat - originalNutrition.fat) * meal.servings;
  });
  
  const result = {
    calories: Math.max(0, Math.round(baseCals)),
    protein: Math.max(0, Math.round(baseProtein)),
    carbs: Math.max(0, Math.round(baseCarbs)),
    fat: Math.max(0, Math.round(baseFat)),
  };
  
  nutritionCache.set(cacheKey, result);
  
  if (nutritionCache.size > 500) {
    const firstKey = nutritionCache.keys().next().value;
    if (firstKey) nutritionCache.delete(firstKey);
  }
  
  return result;
}

export function computeMealNutrition(
  meal: PlannedMealInput,
  recipe: Recipe | undefined
): MacroTotals {
  return computeMealNutritionSnapshot(meal, recipe);
}

export function computeDayTotalsFromMeals(
  meals: PlannedMealInput[],
  recipeLookup: RecipeLookup,
  countOnlyState: MealState[] = ['cooked', 'autoCounted']
): MacroTotals {
  return meals.reduce((acc, meal) => {
    if (!countOnlyState.includes(meal.mealState)) {
      return acc;
    }
    
    const recipe = recipeLookup[meal.recipeId];
    const mealNutrition = computeMealNutritionSnapshot(meal, recipe);
    
    return {
      calories: acc.calories + mealNutrition.calories,
      protein: acc.protein + mealNutrition.protein,
      carbs: acc.carbs + mealNutrition.carbs,
      fat: acc.fat + mealNutrition.fat,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

export function computeTotalsFromConsumptionLogs(
  logs: ConsumptionLogInput[]
): MacroTotals {
  return logs.reduce((acc, log) => ({
    calories: acc.calories + log.calories,
    protein: acc.protein + log.protein,
    carbs: acc.carbs + log.carbs,
    fat: acc.fat + log.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

export function computeDayTotals(
  dayMeals: PlannedMealInput[],
  dayLogs: ConsumptionLogInput[],
  recipeLookup: RecipeLookup
): MacroTotals {
  const mealTotals = computeDayTotalsFromMeals(dayMeals, recipeLookup);
  const logTotals = computeTotalsFromConsumptionLogs(dayLogs);
  
  return {
    calories: mealTotals.calories + logTotals.calories,
    protein: mealTotals.protein + logTotals.protein,
    carbs: mealTotals.carbs + logTotals.carbs,
    fat: mealTotals.fat + logTotals.fat,
  };
}

export function computeWeekTotals(
  allMeals: PlannedMealInput[],
  allLogs: ConsumptionLogInput[],
  recipeLookup: RecipeLookup,
  weekDates: string[]
): MacroTotals {
  const totals: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayDate = weekDates[dayIndex];
    
    const dayMeals = allMeals.filter(m => {
      if (m.date) {
        return m.date === dayDate;
      }
      return m.dayIndex === dayIndex;
    });
    
    const dayLogs = allLogs.filter(log => log.date === dayDate);
    
    const dayTotals = computeDayTotals(dayMeals, dayLogs, recipeLookup);
    totals.calories += dayTotals.calories;
    totals.protein += dayTotals.protein;
    totals.carbs += dayTotals.carbs;
    totals.fat += dayTotals.fat;
  }
  
  return totals;
}

export function getPlannerSummary(
  allMeals: PlannedMealInput[],
  allLogs: ConsumptionLogInput[],
  recipeLookup: RecipeLookup,
  todayDate: string,
  weekDates: string[]
): PlannerSummary {
  const todayMeals = allMeals.filter(m => {
    if (m.date) {
      return m.date === todayDate;
    }
    const todayIdx = weekDates.indexOf(todayDate);
    return todayIdx >= 0 && m.dayIndex === todayIdx;
  });
  const todayLogs = allLogs.filter(log => log.date === todayDate);
  const todayTotals = computeDayTotals(todayMeals, todayLogs, recipeLookup);
  
  const weekTotals = computeWeekTotals(allMeals, allLogs, recipeLookup, weekDates);
  
  return {
    todayCalories: todayTotals.calories,
    todayMacros: todayTotals,
    weekCalories: weekTotals.calories,
    weekMacros: weekTotals,
  };
}

export function filterMealsByDay(
  meals: PlannedMealInput[],
  dayIndex: number,
  dayDate?: string
): PlannedMealInput[] {
  return meals.filter(m => {
    if (dayDate && m.date) {
      return m.date === dayDate;
    }
    return m.dayIndex === dayIndex;
  });
}

export function filterLogsByDay(
  logs: ConsumptionLogInput[],
  dayDate: string
): ConsumptionLogInput[] {
  return logs.filter(log => log.date === dayDate);
}

export function clearNutritionCache(): void {
  nutritionCache.clear();
}
