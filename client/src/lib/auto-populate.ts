import { Recipe } from './mock-data';
import { PantryItem, MealType, normalizeIngredientName } from './demo-store';

export type AutoPopulateMealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Desserts' | 'Snackitizers' | 'Side';

export interface GenerationSettings {
  addDesserts: boolean;
  addSnackitizers: boolean;
  servings: {
    Breakfast: number;
    Lunch: number;
    Dinner: number;
    Desserts: number;
    Snackitizers: number;
  };
}

export interface PreviewMeal {
  id: string;
  recipeId: string;
  dayIndex: number;
  mealType: AutoPopulateMealType;
  servings: number;
  locked?: boolean;
  fromPlanner?: boolean;
  isLeftover?: boolean;
}

export interface MacroGoals {
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
}

export interface UserPreferences {
  allergies: string[];
  dietaryRestrictions: string[];
  cookingComfort: string;
  tools: string[];
  macroGoals?: MacroGoals;
  calorieGoal?: number;
  preferredServingSize?: number;
  allowLeftovers?: boolean;
  leftoverTolerance?: number;
  maxCookSessionsPerDay?: number;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface GeneratedWeek {
  meals: PreviewMeal[];
  projectedTotals: {
    dailyCalories: number[];
    weeklyCalories: number;
    dailyProtein: number[];
    dailyCarbs: number[];
    dailyFat: number[];
    weeklyProtein: number;
    weeklyCarbs: number;
    weeklyFat: number;
  };
}

export function mapRecipeToMealType(recipe: Recipe): AutoPopulateMealType[] {
  const types: AutoPopulateMealType[] = [];
  
  for (const type of recipe.mealTypes || []) {
    const normalized = type.toLowerCase();
    if (normalized === 'breakfast') types.push('Breakfast');
    else if (normalized === 'lunch') types.push('Lunch');
    else if (normalized === 'dinner') types.push('Dinner');
    else if (normalized === 'dessert') types.push('Desserts');
    else if (normalized === 'snack' || normalized === 'appetizer' || normalized === 'bite' || normalized === 'snack/appetizer') {
      types.push('Snackitizers');
    }
  }
  
  return types.length > 0 ? types : ['Dinner'];
}

export function getRecipesForMealType(mealType: AutoPopulateMealType, candidateRecipes: Recipe[]): Recipe[] {
  return candidateRecipes.filter(recipe => {
    const mappedTypes = mapRecipeToMealType(recipe);
    return mappedTypes.includes(mealType);
  });
}

export function filterRecipes(
  recipes: Recipe[],
  preferences: UserPreferences
): Recipe[] {
  return recipes.filter(recipe => {
    if (preferences.allergies?.length > 0) {
      const recipeIngredients = recipe.ingredients.map(i => 
        normalizeIngredientName(i.name)
      );
      for (const allergy of preferences.allergies) {
        const allergyNorm = normalizeIngredientName(allergy);
        if (recipeIngredients.some(ing => ing.includes(allergyNorm))) {
          return false;
        }
      }
    }
    
    if (preferences.dietaryRestrictions?.includes('vegetarian')) {
      const meatKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tuna', 'bacon', 'steak'];
      const hasNonVeg = recipe.ingredients.some(i => 
        meatKeywords.some(m => normalizeIngredientName(i.name).includes(m))
      );
      if (hasNonVeg) return false;
    }
    
    if (preferences.dietaryRestrictions?.includes('vegan')) {
      const animalKeywords = ['chicken', 'beef', 'pork', 'fish', 'egg', 'milk', 'cheese', 'butter', 'cream', 'yogurt'];
      const hasAnimal = recipe.ingredients.some(i => 
        animalKeywords.some(a => normalizeIngredientName(i.name).includes(a))
      );
      if (hasAnimal) return false;
    }
    
    if (preferences.preferredServingSize) {
      const minServ = recipe.min_servings || recipe.servings;
      if (minServ > preferences.preferredServingSize) return false;
    }
    
    return true;
  });
}

export function scoreRecipe(
  recipe: Recipe,
  pantryItems: PantryItem[],
  preferences: UserPreferences,
  favoriteIds: string[],
  usedRecipeIds: Set<string>,
  dailyTotals?: DailyTotals
): number {
  let score = 100;
  
  if (pantryItems.length > 0) {
    const pantryNames = pantryItems
      .filter(p => p.state === 'have' || p.state === 'might')
      .map(p => normalizeIngredientName(p.name));
    
    const recipeIngredients = recipe.ingredients.map(i => normalizeIngredientName(i.name));
    const matchCount = recipeIngredients.filter(ing => 
      pantryNames.some(p => p.includes(ing) || ing.includes(p))
    ).length;
    
    const overlapRatio = matchCount / recipeIngredients.length;
    score += overlapRatio * 50;
  }
  
  if (favoriteIds.includes(recipe.id)) {
    score += 30;
  }
  
  if (usedRecipeIds.has(recipe.id)) {
    score -= 40;
  }
  
  const servMult = preferences.preferredServingSize || 1;
  
  if (dailyTotals && preferences.macroGoals) {
    const goals = preferences.macroGoals;
    
    if (goals.targetCalories && goals.targetCalories > 0) {
      const projectedCalories = dailyTotals.calories + (recipe.calories || 0) * servMult;
      if (projectedCalories > goals.targetCalories) {
        const overshoot = (projectedCalories - goals.targetCalories) / goals.targetCalories;
        score -= overshoot * 80;
      }
    }
    
    if (goals.targetProtein && goals.targetProtein > 0) {
      const projectedProtein = dailyTotals.protein + (recipe.protein || 0) * servMult;
      if (projectedProtein > goals.targetProtein) {
        const overshoot = (projectedProtein - goals.targetProtein) / goals.targetProtein;
        score -= overshoot * 40;
      }
    }
    
    if (goals.targetCarbs && goals.targetCarbs > 0) {
      const projectedCarbs = dailyTotals.carbs + (recipe.carbs || 0) * servMult;
      if (projectedCarbs > goals.targetCarbs) {
        const overshoot = (projectedCarbs - goals.targetCarbs) / goals.targetCarbs;
        score -= overshoot * 40;
      }
    }
    
    if (goals.targetFat && goals.targetFat > 0) {
      const projectedFat = dailyTotals.fat + (recipe.fat || 0) * servMult;
      if (projectedFat > goals.targetFat) {
        const overshoot = (projectedFat - goals.targetFat) / goals.targetFat;
        score -= overshoot * 40;
      }
    }
  } else if (dailyTotals && preferences.calorieGoal && preferences.calorieGoal > 0) {
    const projectedCalories = dailyTotals.calories + (recipe.calories || 0) * servMult;
    if (projectedCalories > preferences.calorieGoal) {
      const overshoot = (projectedCalories - preferences.calorieGoal) / preferences.calorieGoal;
      score -= overshoot * 80;
    }
  }
  
  score += Math.random() * 10;
  
  return score;
}

interface LeftoverEntry {
  recipeId: string;
  remainingServings: number;
  mealType: AutoPopulateMealType;
  lastDayUsed: number;
}

export function generateWeekPlan(
  settings: GenerationSettings,
  preferences: UserPreferences,
  pantryItems: PantryItem[],
  favoriteIds: string[],
  existingMeals: { dayIndex: number; mealType: string; recipeId?: string; servings?: number }[],
  candidateRecipes: Recipe[]
): GeneratedWeek {
  const meals: PreviewMeal[] = [];
  const usedRecipeIds = new Set<string>();
  const recipeUsageCounts = new Map<string, number>();
  
  const recipeLookup = new Map<string, Recipe>();
  for (const r of candidateRecipes) {
    recipeLookup.set(r.id, r);
  }

  const runningDailyTotals: DailyTotals[] = Array.from({ length: 7 }, () => ({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  }));

  const cookSessionsPerDay: number[] = Array(7).fill(0);

  for (const locked of existingMeals) {
    if (locked.recipeId) {
      const lockedRecipe = recipeLookup.get(locked.recipeId);
      if (lockedRecipe) {
        const servings = locked.servings || 1;
        runningDailyTotals[locked.dayIndex].calories += (lockedRecipe.calories || 0) * servings;
        runningDailyTotals[locked.dayIndex].protein += (lockedRecipe.protein || 0) * servings;
        runningDailyTotals[locked.dayIndex].carbs += (lockedRecipe.carbs || 0) * servings;
        runningDailyTotals[locked.dayIndex].fat += (lockedRecipe.fat || 0) * servings;
      }
      usedRecipeIds.add(locked.recipeId);
      recipeUsageCounts.set(locked.recipeId, (recipeUsageCounts.get(locked.recipeId) || 0) + 1);
      cookSessionsPerDay[locked.dayIndex]++;
    }
  }
  
  const mealTypesToGenerate: AutoPopulateMealType[] = ['Breakfast', 'Lunch', 'Dinner'];
  if (settings.addDesserts) mealTypesToGenerate.push('Desserts');
  if (settings.addSnackitizers) mealTypesToGenerate.push('Snackitizers');

  const allowLeftovers = preferences.allowLeftovers === true;
  const leftoverTolerance = preferences.leftoverTolerance || 2;
  const maxCookSessions = preferences.maxCookSessionsPerDay || 99;
  const servMult = preferences.preferredServingSize || 1;

  const leftoverInventory: LeftoverEntry[] = [];
  
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    for (const mealType of mealTypesToGenerate) {
      const isLocked = existingMeals.some(m => 
        m.dayIndex === dayIndex && 
        (m.mealType === mealType)
      );
      
      if (isLocked) continue;

      if (allowLeftovers) {
        const leftoverIdx = leftoverInventory.findIndex(lo =>
          lo.mealType === mealType &&
          lo.remainingServings >= servMult &&
          lo.lastDayUsed !== dayIndex - 1 &&
          (recipeUsageCounts.get(lo.recipeId) || 0) < leftoverTolerance
        );

        if (leftoverIdx !== -1) {
          const lo = leftoverInventory[leftoverIdx];
          lo.remainingServings -= servMult;
          lo.lastDayUsed = dayIndex;
          const count = (recipeUsageCounts.get(lo.recipeId) || 0) + 1;
          recipeUsageCounts.set(lo.recipeId, count);

          const loRecipe = recipeLookup.get(lo.recipeId);
          if (loRecipe) {
            runningDailyTotals[dayIndex].calories += (loRecipe.calories || 0) * servMult;
            runningDailyTotals[dayIndex].protein += (loRecipe.protein || 0) * servMult;
            runningDailyTotals[dayIndex].carbs += (loRecipe.carbs || 0) * servMult;
            runningDailyTotals[dayIndex].fat += (loRecipe.fat || 0) * servMult;
          }

          meals.push({
            id: `preview-${dayIndex}-${mealType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            recipeId: lo.recipeId,
            dayIndex,
            mealType,
            servings: servMult,
            isLeftover: true,
          });

          if (lo.remainingServings < servMult) {
            leftoverInventory.splice(leftoverIdx, 1);
          }
          continue;
        }
      }

      if (cookSessionsPerDay[dayIndex] >= maxCookSessions) {
        continue;
      }
      
      let candidates = getRecipesForMealType(mealType, candidateRecipes);
      candidates = filterRecipes(candidates, preferences);

      if (!allowLeftovers) {
        candidates = candidates.filter(r => !usedRecipeIds.has(r.id));
      } else {
        candidates = candidates.filter(r =>
          (recipeUsageCounts.get(r.id) || 0) < leftoverTolerance
        );
      }
      
      if (candidates.length === 0) continue;
      
      const scoredCandidates = candidates.map(recipe => ({
        recipe,
        score: scoreRecipe(recipe, pantryItems, preferences, favoriteIds, usedRecipeIds, runningDailyTotals[dayIndex])
      }));
      
      scoredCandidates.sort((a, b) => b.score - a.score);
      
      const selectedRecipe = scoredCandidates[0].recipe;
      usedRecipeIds.add(selectedRecipe.id);
      const count = (recipeUsageCounts.get(selectedRecipe.id) || 0) + 1;
      recipeUsageCounts.set(selectedRecipe.id, count);
      cookSessionsPerDay[dayIndex]++;
      
      const servingMultiplier = settings.servings[mealType];
      runningDailyTotals[dayIndex].calories += (selectedRecipe.calories || 0) * servingMultiplier;
      runningDailyTotals[dayIndex].protein += (selectedRecipe.protein || 0) * servingMultiplier;
      runningDailyTotals[dayIndex].carbs += (selectedRecipe.carbs || 0) * servingMultiplier;
      runningDailyTotals[dayIndex].fat += (selectedRecipe.fat || 0) * servingMultiplier;

      if (allowLeftovers && selectedRecipe.servings > servMult) {
        const leftoverServings = selectedRecipe.servings - servMult;
        leftoverInventory.push({
          recipeId: selectedRecipe.id,
          remainingServings: leftoverServings,
          mealType,
          lastDayUsed: dayIndex,
        });
      }
      
      meals.push({
        id: `preview-${dayIndex}-${mealType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        recipeId: selectedRecipe.id,
        dayIndex,
        mealType,
        servings: settings.servings[mealType],
        isLeftover: false,
      });
    }
  }
  
  const projectedTotals = calculateProjectedTotals(meals, settings.servings, recipeLookup);
  
  return { meals, projectedTotals };
}

export function calculateProjectedTotals(
  meals: PreviewMeal[],
  servings: GenerationSettings['servings'],
  recipeLookup: Map<string, Recipe>
): GeneratedWeek['projectedTotals'] {
  const dailyCalories: number[] = Array(7).fill(0);
  const dailyProtein: number[] = Array(7).fill(0);
  const dailyCarbs: number[] = Array(7).fill(0);
  const dailyFat: number[] = Array(7).fill(0);
  
  for (const meal of meals) {
    const recipe = recipeLookup.get(meal.recipeId);
    if (!recipe) continue;
    
    const servingMultiplier = meal.servings;
    
    dailyCalories[meal.dayIndex] += (recipe.calories || 0) * servingMultiplier;
    dailyProtein[meal.dayIndex] += (recipe.protein || 0) * servingMultiplier;
    dailyCarbs[meal.dayIndex] += (recipe.carbs || 0) * servingMultiplier;
    dailyFat[meal.dayIndex] += (recipe.fat || 0) * servingMultiplier;
  }
  
  return {
    dailyCalories,
    weeklyCalories: dailyCalories.reduce((a, b) => a + b, 0),
    dailyProtein,
    dailyCarbs,
    dailyFat,
    weeklyProtein: dailyProtein.reduce((a, b) => a + b, 0),
    weeklyCarbs: dailyCarbs.reduce((a, b) => a + b, 0),
    weeklyFat: dailyFat.reduce((a, b) => a + b, 0)
  };
}

export function applyProHardLimits(recipes: Recipe[], macroGoals: MacroGoals): Recipe[] {
  return recipes.filter(recipe => {
    if (macroGoals.targetCalories && macroGoals.targetCalories > 0) {
      const perMealCap = macroGoals.targetCalories / 3;
      if ((recipe.calories || 0) > perMealCap) return false;
    }
    if (macroGoals.targetProtein && macroGoals.targetProtein > 0) {
      const perMealCap = macroGoals.targetProtein / 3;
      if ((recipe.protein || 0) > perMealCap) return false;
    }
    if (macroGoals.targetCarbs && macroGoals.targetCarbs > 0) {
      const perMealCap = macroGoals.targetCarbs / 3;
      if ((recipe.carbs || 0) > perMealCap) return false;
    }
    if (macroGoals.targetFat && macroGoals.targetFat > 0) {
      const perMealCap = macroGoals.targetFat / 3;
      if ((recipe.fat || 0) > perMealCap) return false;
    }
    return true;
  });
}

export function getSwapSuggestions(
  currentRecipeId: string,
  mealType: AutoPopulateMealType,
  preferences: UserPreferences,
  pantryItems: PantryItem[],
  favoriteIds: string[],
  usedRecipeIds: Set<string>,
  candidateRecipes: Recipe[],
  limit: number = 6
): Recipe[] {
  let candidates = getRecipesForMealType(mealType, candidateRecipes);
  candidates = filterRecipes(candidates, preferences);
  
  candidates = candidates.filter(r => r.id !== currentRecipeId);
  
  const scoredCandidates = candidates.map(recipe => ({
    recipe,
    score: scoreRecipe(recipe, pantryItems, preferences, favoriteIds, usedRecipeIds)
  }));
  
  scoredCandidates.sort((a, b) => b.score - a.score);
  
  return scoredCandidates.slice(0, limit).map(c => c.recipe);
}

export function searchRecipesForMealType(
  query: string,
  mealType: AutoPopulateMealType,
  preferences: UserPreferences,
  candidateRecipes: Recipe[],
  limit: number = 10
): Recipe[] {
  let candidates = getRecipesForMealType(mealType, candidateRecipes);
  candidates = filterRecipes(candidates, preferences);
  
  const queryLower = query.toLowerCase();
  const matches = candidates.filter(recipe => 
    recipe.title.toLowerCase().includes(queryLower) ||
    recipe.ingredients.some(i => i.name.toLowerCase().includes(queryLower))
  );
  
  return matches.slice(0, limit);
}
