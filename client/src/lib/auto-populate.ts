import { Recipe } from './mock-data';
import { PantryItem, MealType, normalizeIngredientName } from './demo-store';

export type AutoPopulateMealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Desserts' | 'Snackitizers' | 'Side';

export interface GenerationSettings {
  addDesserts: boolean;
  addSnackitizers: boolean;
  addSides: boolean;
  sidesMealTypes: {
    Breakfast: boolean;
    Lunch: boolean;
    Dinner: boolean;
  };
  servings: {
    Breakfast: number;
    Lunch: number;
    Dinner: number;
    Desserts: number;
    Snackitizers: number;
    Side: number;
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
  parentMealId?: string; // For sides: references the parent meal's preview id
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
    else if (normalized === 'side') types.push('Side');
    else if (normalized === 'snack' || normalized === 'appetizer' || normalized === 'bite' || normalized === 'snack/appetizer') {
      types.push('Snackitizers');
    }
  }

  // Also check dish_type for "Side Dish" classification
  if ((recipe as any).dish_type?.toLowerCase() === 'side dish' && !types.includes('Side')) {
    types.push('Side');
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
  
  const servMult = 1;
  
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

export function generateWeekPlan(
  settings: GenerationSettings,
  preferences: UserPreferences,
  pantryItems: PantryItem[],
  favoriteIds: string[],
  existingMeals: { dayIndex: number; mealType: string; recipeId?: string; servings?: number }[],
  candidateRecipes: Recipe[],
  lockedMealKeys?: Set<string>
): GeneratedWeek {
  const meals: PreviewMeal[] = [];
  const usedRecipeIds = new Set<string>();
  
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
    }
  }
  
  const mealTypesToGenerate: AutoPopulateMealType[] = ['Breakfast', 'Lunch', 'Dinner'];
  if (settings.addDesserts) mealTypesToGenerate.push('Desserts');
  if (settings.addSnackitizers) mealTypesToGenerate.push('Snackitizers');

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    for (const mealType of mealTypesToGenerate) {
      const isLocked = existingMeals.some(m => 
        m.dayIndex === dayIndex && 
        (m.mealType === mealType)
      );
      
      if (isLocked) continue;

      let candidates = getRecipesForMealType(mealType, candidateRecipes);
      candidates = filterRecipes(candidates, preferences);
      candidates = candidates.filter(r => !usedRecipeIds.has(r.id));
      
      if (candidates.length === 0) continue;
      
      const scoredCandidates = candidates.map(recipe => ({
        recipe,
        score: scoreRecipe(recipe, pantryItems, preferences, favoriteIds, usedRecipeIds, runningDailyTotals[dayIndex])
      }));
      
      scoredCandidates.sort((a, b) => b.score - a.score);
      
      const selectedRecipe = scoredCandidates[0].recipe;
      usedRecipeIds.add(selectedRecipe.id);

      const servingMultiplier = settings.servings[mealType];
      runningDailyTotals[dayIndex].calories += (selectedRecipe.calories || 0) * servingMultiplier;
      runningDailyTotals[dayIndex].protein += (selectedRecipe.protein || 0) * servingMultiplier;
      runningDailyTotals[dayIndex].carbs += (selectedRecipe.carbs || 0) * servingMultiplier;
      runningDailyTotals[dayIndex].fat += (selectedRecipe.fat || 0) * servingMultiplier;

      const parentMealId = `preview-${dayIndex}-${mealType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      meals.push({
        id: parentMealId,
        recipeId: selectedRecipe.id,
        dayIndex,
        mealType,
        servings: settings.servings[mealType],
        isLeftover: false,
      });

      // Auto-suggest sides for this meal if enabled for this meal type
      const sideEnabledForType = settings.addSides && settings.sidesMealTypes[mealType as keyof typeof settings.sidesMealTypes];
      if (sideEnabledForType && mealType !== 'Desserts' && mealType !== 'Snackitizers' && mealType !== 'Side') {
        let sideCandidates = getRecipesForMealType('Side', candidateRecipes);
        sideCandidates = filterRecipes(sideCandidates, preferences);
        sideCandidates = sideCandidates.filter(r => r.id !== selectedRecipe.id);

        if (sideCandidates.length > 0) {
          const scoredSides = sideCandidates.map(recipe => ({
            recipe,
            score: scoreRecipe(recipe, pantryItems, preferences, favoriteIds, usedRecipeIds, runningDailyTotals[dayIndex])
          }));
          scoredSides.sort((a, b) => b.score - a.score);

          const selectedSide = scoredSides[0].recipe;
          const sideServings = settings.servings.Side || 1;

          runningDailyTotals[dayIndex].calories += (selectedSide.calories || 0) * sideServings;
          runningDailyTotals[dayIndex].protein += (selectedSide.protein || 0) * sideServings;
          runningDailyTotals[dayIndex].carbs += (selectedSide.carbs || 0) * sideServings;
          runningDailyTotals[dayIndex].fat += (selectedSide.fat || 0) * sideServings;

          meals.push({
            id: `preview-${dayIndex}-Side-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            recipeId: selectedSide.id,
            dayIndex,
            mealType: 'Side',
            servings: sideServings,
            isLeftover: false,
            parentMealId,
          });
        }
      }
    }
  }

  // Second pass: generate sides for existing (non-locked) meals that don't already have a side
  if (settings.addSides) {
    for (const existing of existingMeals) {
      // Only B/L/D are eligible for sides
      if (existing.mealType !== 'Breakfast' && existing.mealType !== 'Lunch' && existing.mealType !== 'Dinner') continue;
      if (!settings.sidesMealTypes[existing.mealType]) continue;
      if (!existing.recipeId) continue;

      // Skip user-locked meals — they should not get sides added
      const mealKey = `${existing.dayIndex}-${existing.mealType}`;
      if (lockedMealKeys?.has(mealKey)) continue;

      // Check if a side already exists for this specific parent (day+mealType), not just any side on this day
      const parentRef = `locked-${existing.dayIndex}-${existing.mealType}`;
      const alreadyHasSide = meals.some(m => m.mealType === 'Side' && m.parentMealId === parentRef);
      if (alreadyHasSide) continue;

      let sideCandidates = getRecipesForMealType('Side', candidateRecipes);
      sideCandidates = filterRecipes(sideCandidates, preferences);
      sideCandidates = sideCandidates.filter(r => r.id !== existing.recipeId);

      if (sideCandidates.length > 0) {
        const scoredSides = sideCandidates.map(recipe => ({
          recipe,
          score: scoreRecipe(recipe, pantryItems, preferences, favoriteIds, usedRecipeIds, runningDailyTotals[existing.dayIndex])
        }));
        scoredSides.sort((a, b) => b.score - a.score);

        const selectedSide = scoredSides[0].recipe;
        const sideServings = settings.servings.Side || 1;

        runningDailyTotals[existing.dayIndex].calories += (selectedSide.calories || 0) * sideServings;
        runningDailyTotals[existing.dayIndex].protein += (selectedSide.protein || 0) * sideServings;
        runningDailyTotals[existing.dayIndex].carbs += (selectedSide.carbs || 0) * sideServings;
        runningDailyTotals[existing.dayIndex].fat += (selectedSide.fat || 0) * sideServings;

        meals.push({
          id: `preview-${existing.dayIndex}-Side-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          recipeId: selectedSide.id,
          dayIndex: existing.dayIndex,
          mealType: 'Side',
          servings: sideServings,
          isLeftover: false,
          parentMealId: parentRef,
        });
      }
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
