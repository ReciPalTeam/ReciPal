import { describe, it, expect } from 'vitest';
import {
  computeMealNutrition,
  computeDayTotalsFromMeals,
  computeTotalsFromConsumptionLogs,
  computeDayTotals,
  computeWeekTotals,
  PlannedMealInput,
  ConsumptionLogInput,
  RecipeLookup,
} from './planner-totals';
import { Recipe } from './mock-data';

function createMockRecipe(id: string, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    title: `Recipe ${id}`,
    image: '/test.jpg',
    cookTime: '30 mins',
    calories: 500,
    protein: 30,
    carbs: 40,
    fat: 20,
    servings: 2,
    mealTypes: ['Lunch'],
    cookingStyle: 'Balanced',
    difficulty: 'easy',
    ingredients: [{ name: 'chicken', amount: '1', unit: 'lb' }],
    instructions: ['Step 1'],
    ...overrides,
  } as Recipe;
}

function createMockMeal(
  id: string,
  recipeId: string,
  mealState: 'scheduled' | 'cooked' | 'autoCounted' = 'scheduled',
  overrides: Partial<PlannedMealInput> = {}
): PlannedMealInput {
  return {
    id,
    recipeId,
    dayIndex: 0,
    mealType: 'Lunch',
    mealState,
    servings: 1,
    ...overrides,
  };
}

function createMockLog(
  id: number,
  date: string,
  sourceType: 'checkout_logged_recipe' | 'cooknow_logged_recipe' | 'manual_custom_entry' = 'cooknow_logged_recipe',
  overrides: Partial<ConsumptionLogInput> = {}
): ConsumptionLogInput {
  return {
    id,
    date,
    sourceType,
    calories: 300,
    protein: 20,
    carbs: 25,
    fat: 15,
    ...overrides,
  };
}

describe('computeMealNutrition', () => {
  it('should return zero for missing recipe', () => {
    const meal = createMockMeal('1', 'missing-recipe');
    const result = computeMealNutrition(meal, undefined);
    expect(result).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('should compute base nutrition from recipe', () => {
    const meal = createMockMeal('1', 'recipe-1');
    const recipe = createMockRecipe('recipe-1', { calories: 400, protein: 25, carbs: 30, fat: 15 });
    const result = computeMealNutrition(meal, recipe);
    expect(result).toEqual({ calories: 400, protein: 25, carbs: 30, fat: 15 });
  });

  it('should multiply nutrition by servings', () => {
    const meal = createMockMeal('1', 'recipe-1', 'scheduled', { servings: 2 });
    const recipe = createMockRecipe('recipe-1', { calories: 400, protein: 25, carbs: 30, fat: 15 });
    const result = computeMealNutrition(meal, recipe);
    expect(result).toEqual({ calories: 800, protein: 50, carbs: 60, fat: 30 });
  });

  it('should adjust nutrition for ingredient swaps', () => {
    const meal = createMockMeal('1', 'recipe-1', 'scheduled', {
      ingredientOverrides: [{
        originalIngredientName: 'chicken',
        replacementName: 'tofu',
        replacementNutrition: { calories: 30, protein: 8, carbs: 5, fat: 3 },
      }],
    });
    const recipe = createMockRecipe('recipe-1', { calories: 400, protein: 25, carbs: 30, fat: 15 });
    const result = computeMealNutrition(meal, recipe);
    expect(result.calories).toBe(400 + 30 - 50);
    expect(result.protein).toBe(25 + 8 - 5);
    expect(result.carbs).toBe(30 + 5 - 10);
    expect(result.fat).toBe(15 + 3 - 2);
  });
});

describe('computeDayTotalsFromMeals', () => {
  const recipeLookup: RecipeLookup = {
    'recipe-1': createMockRecipe('recipe-1', { calories: 400, protein: 25, carbs: 30, fat: 15 }),
    'recipe-2': createMockRecipe('recipe-2', { calories: 600, protein: 35, carbs: 50, fat: 25 }),
  };

  it('should only count cooked meals', () => {
    const meals = [
      createMockMeal('1', 'recipe-1', 'cooked'),
      createMockMeal('2', 'recipe-2', 'scheduled'),
    ];
    const result = computeDayTotalsFromMeals(meals, recipeLookup);
    expect(result.calories).toBe(400);
  });

  it('should count autoCounted meals', () => {
    const meals = [
      createMockMeal('1', 'recipe-1', 'autoCounted'),
      createMockMeal('2', 'recipe-2', 'scheduled'),
    ];
    const result = computeDayTotalsFromMeals(meals, recipeLookup);
    expect(result.calories).toBe(400);
  });

  it('should count both cooked and autoCounted meals', () => {
    const meals = [
      createMockMeal('1', 'recipe-1', 'cooked'),
      createMockMeal('2', 'recipe-2', 'autoCounted'),
    ];
    const result = computeDayTotalsFromMeals(meals, recipeLookup);
    expect(result.calories).toBe(1000);
    expect(result.protein).toBe(60);
  });

  it('should not count scheduled meals', () => {
    const meals = [
      createMockMeal('1', 'recipe-1', 'scheduled'),
      createMockMeal('2', 'recipe-2', 'scheduled'),
    ];
    const result = computeDayTotalsFromMeals(meals, recipeLookup);
    expect(result.calories).toBe(0);
  });
});

describe('computeTotalsFromConsumptionLogs', () => {
  it('should sum all logs', () => {
    const logs = [
      createMockLog(1, '2025-01-20', 'cooknow_logged_recipe', { calories: 300, protein: 20, carbs: 25, fat: 15 }),
      createMockLog(2, '2025-01-20', 'checkout_logged_recipe', { calories: 400, protein: 25, carbs: 30, fat: 20 }),
      createMockLog(3, '2025-01-20', 'manual_custom_entry', { calories: 200, protein: 10, carbs: 20, fat: 8 }),
    ];
    const result = computeTotalsFromConsumptionLogs(logs);
    expect(result.calories).toBe(900);
    expect(result.protein).toBe(55);
    expect(result.carbs).toBe(75);
    expect(result.fat).toBe(43);
  });

  it('should return zeros for empty logs', () => {
    const result = computeTotalsFromConsumptionLogs([]);
    expect(result).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('computeDayTotals', () => {
  const recipeLookup: RecipeLookup = {
    'recipe-1': createMockRecipe('recipe-1', { calories: 400, protein: 25, carbs: 30, fat: 15 }),
  };

  it('should combine meals and logs', () => {
    const meals = [createMockMeal('1', 'recipe-1', 'cooked')];
    const logs = [createMockLog(1, '2025-01-20', 'cooknow_logged_recipe', { calories: 300, protein: 20, carbs: 25, fat: 15 })];
    
    const result = computeDayTotals(meals, logs, recipeLookup);
    expect(result.calories).toBe(700);
    expect(result.protein).toBe(45);
  });

  it('should work with only logs (no planner meals)', () => {
    const logs = [createMockLog(1, '2025-01-20', 'manual_custom_entry', { calories: 500, protein: 30, carbs: 40, fat: 20 })];
    
    const result = computeDayTotals([], logs, recipeLookup);
    expect(result.calories).toBe(500);
  });
});

describe('computeWeekTotals', () => {
  const recipeLookup: RecipeLookup = {
    'recipe-1': createMockRecipe('recipe-1', { calories: 400, protein: 25, carbs: 30, fat: 15 }),
  };

  it('should aggregate across week days', () => {
    const meals = [
      createMockMeal('1', 'recipe-1', 'cooked', { dayIndex: 0, date: '2025-01-20' }),
      createMockMeal('2', 'recipe-1', 'cooked', { dayIndex: 1, date: '2025-01-21' }),
    ];
    const logs = [
      createMockLog(1, '2025-01-20', 'manual_custom_entry', { calories: 200, protein: 10, carbs: 15, fat: 8 }),
      createMockLog(2, '2025-01-22', 'cooknow_logged_recipe', { calories: 300, protein: 18, carbs: 25, fat: 12 }),
    ];
    
    const weekDates = ['2025-01-20', '2025-01-21', '2025-01-22', '2025-01-23', '2025-01-24', '2025-01-25', '2025-01-26'];
    
    const result = computeWeekTotals(meals, logs, recipeLookup, weekDates);
    expect(result.calories).toBe(400 + 400 + 200 + 300);
    expect(result.protein).toBe(25 + 25 + 10 + 18);
  });
});
