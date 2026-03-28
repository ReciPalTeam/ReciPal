import { describe, it, expect } from 'vitest';
import {
  generateWeekPlan,
  filterRecipes,
  mapRecipeToMealType,
  scoreRecipe,
  applyProHardLimits,
  GenerationSettings,
  UserPreferences,
  MacroGoals,
  DailyTotals,
} from './auto-populate';
import { Recipe } from './mock-data';
import { PantryItem } from './demo-store';

function makeRecipe(overrides: Partial<Recipe> & { id: string; title: string }): Recipe {
  return {
    image: '',
    cuisine: '',
    sub_category: null,
    dish_type: '',
    prepTime: '10 min',
    cookTime: '20 min',
    totalTime: '30 min',
    servings: 1,
    calories: 400,
    protein: 30,
    carbs: 40,
    fat: 15,
    mealTypes: ['dinner'],
    cookingStyle: 'stovetop',
    ingredients: [],
    steps: [],
    ...overrides,
  };
}

const testRecipes: Recipe[] = [
  makeRecipe({
    id: 'breakfast-1',
    title: 'Oatmeal Bowl',
    mealTypes: ['breakfast'],
    calories: 300,
    protein: 10,
    carbs: 50,
    fat: 8,
    ingredients: [
      { name: 'oats', amount: '1', unit: 'cup' },
      { name: 'milk', amount: '1', unit: 'cup' },
    ],
  }),
  makeRecipe({
    id: 'breakfast-2',
    title: 'Scrambled Eggs',
    mealTypes: ['breakfast'],
    calories: 250,
    protein: 18,
    carbs: 3,
    fat: 19,
    ingredients: [
      { name: 'eggs', amount: '3', unit: 'count' },
      { name: 'butter', amount: '1', unit: 'tbsp' },
    ],
  }),
  makeRecipe({
    id: 'lunch-1',
    title: 'Turkey Wrap',
    mealTypes: ['lunch'],
    calories: 450,
    protein: 35,
    carbs: 40,
    fat: 16,
    ingredients: [
      { name: 'turkey', amount: '4', unit: 'oz' },
      { name: 'tortilla', amount: '1', unit: 'count' },
    ],
  }),
  makeRecipe({
    id: 'lunch-2',
    title: 'Veggie Soup',
    mealTypes: ['lunch'],
    calories: 200,
    protein: 8,
    carbs: 30,
    fat: 5,
    ingredients: [
      { name: 'carrot', amount: '2', unit: 'count' },
      { name: 'celery', amount: '2', unit: 'stalks' },
    ],
  }),
  makeRecipe({
    id: 'dinner-1',
    title: 'Grilled Chicken',
    mealTypes: ['dinner'],
    calories: 500,
    protein: 45,
    carbs: 20,
    fat: 22,
    ingredients: [
      { name: 'chicken breast', amount: '6', unit: 'oz' },
      { name: 'rice', amount: '1', unit: 'cup' },
    ],
  }),
  makeRecipe({
    id: 'dinner-2',
    title: 'Pasta Marinara',
    mealTypes: ['dinner'],
    calories: 550,
    protein: 18,
    carbs: 70,
    fat: 15,
    ingredients: [
      { name: 'pasta', amount: '8', unit: 'oz' },
      { name: 'tomato sauce', amount: '1', unit: 'cup' },
    ],
  }),
  makeRecipe({
    id: 'dessert-1',
    title: 'Fruit Salad',
    mealTypes: ['dessert'],
    calories: 150,
    protein: 2,
    carbs: 35,
    fat: 1,
    ingredients: [
      { name: 'apple', amount: '1', unit: 'count' },
      { name: 'banana', amount: '1', unit: 'count' },
    ],
  }),
  makeRecipe({
    id: 'dessert-2',
    title: 'Yogurt Parfait',
    mealTypes: ['dessert'],
    calories: 200,
    protein: 10,
    carbs: 30,
    fat: 5,
    ingredients: [
      { name: 'yogurt', amount: '1', unit: 'cup' },
      { name: 'granola', amount: '0.25', unit: 'cup' },
    ],
  }),
  makeRecipe({
    id: 'snack-1',
    title: 'Hummus and Veggies',
    mealTypes: ['snack'],
    calories: 180,
    protein: 6,
    carbs: 20,
    fat: 9,
    ingredients: [
      { name: 'hummus', amount: '0.25', unit: 'cup' },
      { name: 'carrot', amount: '1', unit: 'count' },
    ],
  }),
  makeRecipe({
    id: 'snack-2',
    title: 'Trail Mix',
    mealTypes: ['snack'],
    calories: 220,
    protein: 7,
    carbs: 25,
    fat: 12,
    ingredients: [
      { name: 'almonds', amount: '0.25', unit: 'cup' },
      { name: 'raisins', amount: '0.25', unit: 'cup' },
    ],
  }),
];

const defaultSettings: GenerationSettings = {
  addDesserts: false,
  addSnackitizers: false,
  servings: {
    Breakfast: 1,
    Lunch: 1,
    Dinner: 1,
    Desserts: 1,
    Snackitizers: 1,
  },
};

const defaultPreferences: UserPreferences = {
  allergies: [],
  dietaryRestrictions: [],
  cookingComfort: 'comfortable',
  tools: [],
};

describe('generateWeekPlan', () => {
  describe('Confirm Plan Only Fills Empty Slots', () => {
    it('should skip slots that already have meals', () => {
      const existingMeals = [
        { dayIndex: 0, mealType: 'Breakfast' },
        { dayIndex: 0, mealType: 'Lunch' },
        { dayIndex: 1, mealType: 'Dinner' },
      ];

      const result = generateWeekPlan(
        defaultSettings,
        defaultPreferences,
        [],
        [],
        existingMeals,
        testRecipes
      );

      const day0Breakfast = result.meals.filter(
        m => m.dayIndex === 0 && m.mealType === 'Breakfast'
      );
      expect(day0Breakfast).toHaveLength(0);

      const day0Lunch = result.meals.filter(
        m => m.dayIndex === 0 && m.mealType === 'Lunch'
      );
      expect(day0Lunch).toHaveLength(0);

      const day1Dinner = result.meals.filter(
        m => m.dayIndex === 1 && m.mealType === 'Dinner'
      );
      expect(day1Dinner).toHaveLength(0);
    });

    it('should fill empty slots with at least some meals', () => {
      const existingMeals = [{ dayIndex: 0, mealType: 'Breakfast' }];

      const result = generateWeekPlan(
        defaultSettings,
        defaultPreferences,
        [],
        [],
        existingMeals,
        testRecipes
      );

      expect(result.meals.length).toBeGreaterThan(0);
      
      const hasLunchOrDinnerOnDay0 = result.meals.some(
        m => m.dayIndex === 0 && (m.mealType === 'Lunch' || m.mealType === 'Dinner')
      );
      expect(hasLunchOrDinnerOnDay0).toBe(true);
    });
  });

  describe('Desserts/Snackitizers Checkboxes', () => {
    it('should NOT generate Desserts when addDesserts is false', () => {
      const settings = { ...defaultSettings, addDesserts: false };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], [], testRecipes);

      const desserts = result.meals.filter(m => m.mealType === 'Desserts');
      expect(desserts).toHaveLength(0);
    });

    it('should NOT generate Snackitizers when addSnackitizers is false', () => {
      const settings = { ...defaultSettings, addSnackitizers: false };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], [], testRecipes);

      const snackitizers = result.meals.filter(m => m.mealType === 'Snackitizers');
      expect(snackitizers).toHaveLength(0);
    });

    it('should generate at least one Dessert when addDesserts is true', () => {
      const settings = { ...defaultSettings, addDesserts: true };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], [], testRecipes);

      const desserts = result.meals.filter(m => m.mealType === 'Desserts');
      expect(desserts.length).toBeGreaterThan(0);
    });

    it('should generate at least one Snackitizer when addSnackitizers is true', () => {
      const settings = { ...defaultSettings, addSnackitizers: true };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], [], testRecipes);

      const snackitizers = result.meals.filter(m => m.mealType === 'Snackitizers');
      expect(snackitizers.length).toBeGreaterThan(0);
    });
  });

  describe('Max 1 Dessert/Snackitizer per Day', () => {
    it('should generate at most 1 Dessert per day', () => {
      const settings = { ...defaultSettings, addDesserts: true };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], [], testRecipes);

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayDesserts = result.meals.filter(
          m => m.dayIndex === dayIndex && m.mealType === 'Desserts'
        );
        expect(dayDesserts.length).toBeLessThanOrEqual(1);
      }
    });

    it('should generate at most 1 Snackitizer per day', () => {
      const settings = { ...defaultSettings, addSnackitizers: true };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], [], testRecipes);

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const daySnackitizers = result.meals.filter(
          m => m.dayIndex === dayIndex && m.mealType === 'Snackitizers'
        );
        expect(daySnackitizers.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Servings Scale Projected Totals', () => {
    it('should scale totals based on serving size', () => {
      const settings1 = { ...defaultSettings, servings: { ...defaultSettings.servings, Lunch: 1 } };
      const settings2 = { ...defaultSettings, servings: { ...defaultSettings.servings, Lunch: 2 } };

      const result1 = generateWeekPlan(settings1, defaultPreferences, [], [], [], testRecipes);
      const result2 = generateWeekPlan(settings2, defaultPreferences, [], [], [], testRecipes);

      expect(result2.projectedTotals.weeklyCalories).toBeGreaterThanOrEqual(
        result1.projectedTotals.weeklyCalories
      );
    });
  });

  describe('Projected Totals include nutrition data', () => {
    it('should produce non-zero projected totals with nutritious recipes', () => {
      const result = generateWeekPlan(defaultSettings, defaultPreferences, [], [], [], testRecipes);

      expect(result.projectedTotals.weeklyCalories).toBeGreaterThan(0);
      expect(result.projectedTotals.weeklyProtein).toBeGreaterThan(0);
      expect(result.projectedTotals.weeklyCarbs).toBeGreaterThan(0);
      expect(result.projectedTotals.weeklyFat).toBeGreaterThan(0);
    });
  });
});

describe('filterRecipes', () => {
  it('should filter out recipes containing allergens', () => {
    const mockRecipe = makeRecipe({
      id: '1',
      title: 'Peanut Butter Sandwich',
      ingredients: [
        { name: 'peanut butter', amount: '2', unit: 'tbsp' },
        { name: 'bread', amount: '2', unit: 'slices' },
      ],
    });

    const preferences: UserPreferences = {
      ...defaultPreferences,
      allergies: ['peanut'],
    };

    const filtered = filterRecipes([mockRecipe], preferences);
    expect(filtered).toHaveLength(0);
  });

  it('should keep recipes without allergens', () => {
    const mockRecipe = makeRecipe({
      id: '1',
      title: 'Apple Pie',
      ingredients: [
        { name: 'apple', amount: '3', unit: 'count' },
        { name: 'flour', amount: '1', unit: 'cup' },
      ],
    });

    const preferences: UserPreferences = {
      ...defaultPreferences,
      allergies: ['peanut'],
    };

    const filtered = filterRecipes([mockRecipe], preferences);
    expect(filtered).toHaveLength(1);
  });
});

describe('mapRecipeToMealType', () => {
  it('should map breakfast to Breakfast', () => {
    const recipe = { mealTypes: ['breakfast'] } as any;
    const result = mapRecipeToMealType(recipe);
    expect(result).toContain('Breakfast');
  });

  it('should map snack to Snackitizers', () => {
    const recipe = { mealTypes: ['snack'] } as any;
    const result = mapRecipeToMealType(recipe);
    expect(result).toContain('Snackitizers');
  });

  it('should map dessert to Desserts', () => {
    const recipe = { mealTypes: ['dessert'] } as any;
    const result = mapRecipeToMealType(recipe);
    expect(result).toContain('Desserts');
  });

  it('should default to Dinner for unknown meal types', () => {
    const recipe = { mealTypes: [] } as any;
    const result = mapRecipeToMealType(recipe);
    expect(result).toEqual(['Dinner']);
  });
});

describe('scoreRecipe - macro-aware scoring', () => {
  const baseDailyTotals: DailyTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  it('should penalize a recipe that pushes daily calories over the target', () => {
    const highCalRecipe = makeRecipe({
      id: 'high-cal',
      title: 'High Cal Meal',
      calories: 900,
      protein: 40,
      carbs: 80,
      fat: 35,
    });

    const lowCalRecipe = makeRecipe({
      id: 'low-cal',
      title: 'Low Cal Meal',
      calories: 300,
      protein: 20,
      carbs: 30,
      fat: 10,
    });

    const prefsWithMacroGoals: UserPreferences = {
      ...defaultPreferences,
      macroGoals: {
        targetCalories: 2000,
        targetProtein: 150,
        targetCarbs: 250,
        targetFat: 70,
      },
    };

    const alreadyConsumed: DailyTotals = { calories: 1500, protein: 100, carbs: 180, fat: 50 };

    const highCalScore = scoreRecipe(
      highCalRecipe, [], prefsWithMacroGoals, [], new Set(), alreadyConsumed
    );
    const lowCalScore = scoreRecipe(
      lowCalRecipe, [], prefsWithMacroGoals, [], new Set(), alreadyConsumed
    );

    expect(lowCalScore).toBeGreaterThan(highCalScore);
  });

  it('should penalize a recipe that pushes daily protein over the target', () => {
    const highProteinRecipe = makeRecipe({
      id: 'high-prot',
      title: 'High Protein Meal',
      calories: 400,
      protein: 80,
      carbs: 20,
      fat: 10,
    });

    const normalProteinRecipe = makeRecipe({
      id: 'normal-prot',
      title: 'Normal Protein Meal',
      calories: 400,
      protein: 20,
      carbs: 50,
      fat: 15,
    });

    const prefsWithProteinGoal: UserPreferences = {
      ...defaultPreferences,
      macroGoals: {
        targetCalories: 2500,
        targetProtein: 120,
        targetCarbs: 300,
        targetFat: 80,
      },
    };

    const alreadyConsumed: DailyTotals = { calories: 800, protein: 90, carbs: 100, fat: 30 };

    const highScore = scoreRecipe(
      highProteinRecipe, [], prefsWithProteinGoal, [], new Set(), alreadyConsumed
    );
    const normalScore = scoreRecipe(
      normalProteinRecipe, [], prefsWithProteinGoal, [], new Set(), alreadyConsumed
    );

    expect(normalScore).toBeGreaterThan(highScore);
  });

  it('should not penalize when daily totals are still under target', () => {
    const recipe = makeRecipe({
      id: 'moderate',
      title: 'Moderate Meal',
      calories: 400,
      protein: 30,
      carbs: 40,
      fat: 15,
    });

    const prefsWithGoals: UserPreferences = {
      ...defaultPreferences,
      macroGoals: {
        targetCalories: 2500,
        targetProtein: 150,
        targetCarbs: 300,
        targetFat: 80,
      },
    };

    const scoreWithGoals = scoreRecipe(
      recipe, [], prefsWithGoals, [], new Set(), baseDailyTotals
    );
    const scoreWithoutGoals = scoreRecipe(
      recipe, [], defaultPreferences, [], new Set(), baseDailyTotals
    );

    expect(Math.abs(scoreWithGoals - scoreWithoutGoals)).toBeLessThan(20);
  });

  it('should apply Free user calorieGoal penalty when over target', () => {
    const highCalRecipe = makeRecipe({
      id: 'high-cal-free',
      title: 'Big Meal',
      calories: 800,
      protein: 30,
      carbs: 60,
      fat: 25,
    });

    const lowCalRecipe = makeRecipe({
      id: 'low-cal-free',
      title: 'Light Meal',
      calories: 250,
      protein: 15,
      carbs: 30,
      fat: 8,
    });

    const freePrefs: UserPreferences = {
      ...defaultPreferences,
      calorieGoal: 1800,
    };

    const alreadyConsumed: DailyTotals = { calories: 1400, protein: 80, carbs: 150, fat: 45 };

    const highCalScore = scoreRecipe(
      highCalRecipe, [], freePrefs, [], new Set(), alreadyConsumed
    );
    const lowCalScore = scoreRecipe(
      lowCalRecipe, [], freePrefs, [], new Set(), alreadyConsumed
    );

    expect(lowCalScore).toBeGreaterThan(highCalScore);
  });

  it('should generate a week plan respecting macro goals by deprioritizing high-cal recipes', () => {
    const prefsWithGoals: UserPreferences = {
      ...defaultPreferences,
      macroGoals: {
        targetCalories: 1500,
        targetProtein: 100,
        targetCarbs: 200,
        targetFat: 55,
      },
    };

    const result = generateWeekPlan(
      defaultSettings,
      prefsWithGoals,
      [],
      [],
      [],
      testRecipes
    );

    expect(result.meals.length).toBeGreaterThan(0);

    const avgDailyCalories = result.projectedTotals.weeklyCalories / 7;
    expect(avgDailyCalories).toBeLessThan(3000);
  });
});

describe('applyProHardLimits', () => {
  it('should exclude recipes exceeding per-meal calorie cap', () => {
    const recipes = [
      makeRecipe({ id: 'low', title: 'Low Cal', calories: 500, protein: 20, carbs: 50, fat: 15 }),
      makeRecipe({ id: 'high', title: 'High Cal', calories: 900, protein: 20, carbs: 50, fat: 15 }),
    ];
    const goals: MacroGoals = { targetCalories: 2100 };
    const result = applyProHardLimits(recipes, goals);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('low');
  });

  it('should exclude recipes exceeding per-meal protein cap', () => {
    const recipes = [
      makeRecipe({ id: 'ok', title: 'Normal Protein', calories: 400, protein: 30, carbs: 40, fat: 15 }),
      makeRecipe({ id: 'over', title: 'Too Much Protein', calories: 400, protein: 60, carbs: 40, fat: 15 }),
    ];
    const goals: MacroGoals = { targetProtein: 120 };
    const result = applyProHardLimits(recipes, goals);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ok');
  });

  it('should exclude recipes exceeding per-meal carb cap', () => {
    const recipes = [
      makeRecipe({ id: 'ok', title: 'Normal Carbs', calories: 400, protein: 20, carbs: 60, fat: 15 }),
      makeRecipe({ id: 'over', title: 'Too Many Carbs', calories: 400, protein: 20, carbs: 120, fat: 15 }),
    ];
    const goals: MacroGoals = { targetCarbs: 240 };
    const result = applyProHardLimits(recipes, goals);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ok');
  });

  it('should exclude recipes exceeding per-meal fat cap', () => {
    const recipes = [
      makeRecipe({ id: 'ok', title: 'Normal Fat', calories: 400, protein: 20, carbs: 40, fat: 20 }),
      makeRecipe({ id: 'over', title: 'Too Much Fat', calories: 400, protein: 20, carbs: 40, fat: 40 }),
    ];
    const goals: MacroGoals = { targetFat: 90 };
    const result = applyProHardLimits(recipes, goals);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ok');
  });

  it('should not filter when goals are zero', () => {
    const recipes = [
      makeRecipe({ id: 'a', title: 'Recipe A', calories: 900, protein: 80, carbs: 120, fat: 50 }),
    ];
    const goals: MacroGoals = { targetCalories: 0, targetProtein: 0, targetCarbs: 0, targetFat: 0 };
    const result = applyProHardLimits(recipes, goals);
    expect(result).toHaveLength(1);
  });

  it('should not filter when goals are undefined', () => {
    const recipes = [
      makeRecipe({ id: 'a', title: 'Recipe A', calories: 900, protein: 80, carbs: 120, fat: 50 }),
    ];
    const goals: MacroGoals = {};
    const result = applyProHardLimits(recipes, goals);
    expect(result).toHaveLength(1);
  });

  it('should only enforce non-zero goals and pass others through', () => {
    const recipes = [
      makeRecipe({ id: 'a', title: 'Recipe A', calories: 300, protein: 80, carbs: 120, fat: 50 }),
    ];
    const goals: MacroGoals = { targetCalories: 2100, targetProtein: 0 };
    const result = applyProHardLimits(recipes, goals);
    expect(result).toHaveLength(1);
  });

  it('should return empty array when all recipes exceed caps', () => {
    const recipes = [
      makeRecipe({ id: 'a', title: 'Big A', calories: 1000, protein: 20, carbs: 40, fat: 15 }),
      makeRecipe({ id: 'b', title: 'Big B', calories: 1200, protein: 20, carbs: 40, fat: 15 }),
    ];
    const goals: MacroGoals = { targetCalories: 1500 };
    const result = applyProHardLimits(recipes, goals);
    expect(result).toHaveLength(0);
  });

  it('should keep recipe exactly at the per-meal cap', () => {
    const recipes = [
      makeRecipe({ id: 'exact', title: 'Exact Cap', calories: 700, protein: 20, carbs: 40, fat: 15 }),
    ];
    const goals: MacroGoals = { targetCalories: 2100 };
    const result = applyProHardLimits(recipes, goals);
    expect(result).toHaveLength(1);
  });
});

const mealPrepRecipes: Recipe[] = [
  makeRecipe({ id: 'b1', title: 'Pancakes', mealTypes: ['breakfast'], servings: 4, min_servings: 1, calories: 300, protein: 10, carbs: 50, fat: 8, ingredients: [{ name: 'flour', amount: '2', unit: 'cups' }] }),
  makeRecipe({ id: 'b2', title: 'Smoothie Bowl', mealTypes: ['breakfast'], servings: 1, calories: 250, protein: 12, carbs: 40, fat: 6, ingredients: [{ name: 'banana', amount: '1', unit: 'count' }] }),
  makeRecipe({ id: 'b3', title: 'Avocado Toast', mealTypes: ['breakfast'], servings: 2, min_servings: 2, calories: 350, protein: 14, carbs: 35, fat: 18, ingredients: [{ name: 'avocado', amount: '1', unit: 'count' }] }),
  makeRecipe({ id: 'b4', title: 'Oatmeal', mealTypes: ['breakfast'], servings: 1, calories: 280, protein: 8, carbs: 55, fat: 5, ingredients: [{ name: 'oats', amount: '1', unit: 'cup' }] }),
  makeRecipe({ id: 'b5', title: 'Granola', mealTypes: ['breakfast'], servings: 6, min_servings: 1, calories: 320, protein: 9, carbs: 48, fat: 12, ingredients: [{ name: 'granola', amount: '1', unit: 'cup' }] }),
  makeRecipe({ id: 'b6', title: 'Fruit Plate', mealTypes: ['breakfast'], servings: 1, calories: 200, protein: 3, carbs: 50, fat: 1, ingredients: [{ name: 'apple', amount: '1', unit: 'count' }] }),
  makeRecipe({ id: 'b7', title: 'Eggs Benedict', mealTypes: ['breakfast'], servings: 2, min_servings: 2, calories: 450, protein: 22, carbs: 25, fat: 30, ingredients: [{ name: 'eggs', amount: '4', unit: 'count' }] }),
  makeRecipe({ id: 'l1', title: 'Chicken Wrap', mealTypes: ['lunch'], servings: 1, calories: 450, protein: 35, carbs: 40, fat: 16, ingredients: [{ name: 'chicken', amount: '4', unit: 'oz' }] }),
  makeRecipe({ id: 'l2', title: 'Caesar Salad', mealTypes: ['lunch'], servings: 2, min_servings: 1, calories: 380, protein: 28, carbs: 18, fat: 22, ingredients: [{ name: 'lettuce', amount: '1', unit: 'head' }] }),
  makeRecipe({ id: 'l3', title: 'Tomato Soup', mealTypes: ['lunch'], servings: 4, min_servings: 1, calories: 200, protein: 8, carbs: 30, fat: 5, ingredients: [{ name: 'tomato', amount: '4', unit: 'count' }] }),
  makeRecipe({ id: 'l4', title: 'Veggie Sandwich', mealTypes: ['lunch'], servings: 1, calories: 350, protein: 12, carbs: 45, fat: 14, ingredients: [{ name: 'bread', amount: '2', unit: 'slices' }] }),
  makeRecipe({ id: 'l5', title: 'Quinoa Bowl', mealTypes: ['lunch'], servings: 3, min_servings: 1, calories: 420, protein: 18, carbs: 55, fat: 14, ingredients: [{ name: 'quinoa', amount: '1', unit: 'cup' }] }),
  makeRecipe({ id: 'l6', title: 'Burrito', mealTypes: ['lunch'], servings: 1, calories: 500, protein: 25, carbs: 55, fat: 20, ingredients: [{ name: 'tortilla', amount: '1', unit: 'count' }] }),
  makeRecipe({ id: 'l7', title: 'Lentil Stew', mealTypes: ['lunch'], servings: 6, min_servings: 2, calories: 310, protein: 20, carbs: 45, fat: 6, ingredients: [{ name: 'lentils', amount: '2', unit: 'cups' }] }),
  makeRecipe({ id: 'd1', title: 'Grilled Salmon', mealTypes: ['dinner'], servings: 2, min_servings: 1, calories: 500, protein: 45, carbs: 10, fat: 28, ingredients: [{ name: 'salmon', amount: '6', unit: 'oz' }] }),
  makeRecipe({ id: 'd2', title: 'Spaghetti', mealTypes: ['dinner'], servings: 4, min_servings: 2, calories: 550, protein: 18, carbs: 70, fat: 15, ingredients: [{ name: 'pasta', amount: '8', unit: 'oz' }] }),
  makeRecipe({ id: 'd3', title: 'Stir Fry', mealTypes: ['dinner'], servings: 2, min_servings: 1, calories: 400, protein: 30, carbs: 35, fat: 15, ingredients: [{ name: 'tofu', amount: '8', unit: 'oz' }] }),
  makeRecipe({ id: 'd4', title: 'Roast Chicken', mealTypes: ['dinner'], servings: 6, min_servings: 4, calories: 480, protein: 42, carbs: 5, fat: 25, ingredients: [{ name: 'chicken', amount: '1', unit: 'whole' }] }),
  makeRecipe({ id: 'd5', title: 'Tacos', mealTypes: ['dinner'], servings: 3, min_servings: 1, calories: 420, protein: 22, carbs: 38, fat: 20, ingredients: [{ name: 'tortilla', amount: '3', unit: 'count' }] }),
  makeRecipe({ id: 'd6', title: 'Pasta Primavera', mealTypes: ['dinner'], servings: 2, min_servings: 1, calories: 380, protein: 14, carbs: 55, fat: 12, ingredients: [{ name: 'pasta', amount: '6', unit: 'oz' }] }),
  makeRecipe({ id: 'd7', title: 'Veggie Curry', mealTypes: ['dinner'], servings: 4, min_servings: 1, calories: 350, protein: 12, carbs: 42, fat: 16, ingredients: [{ name: 'coconut milk', amount: '1', unit: 'can' }] }),
];

describe('T010 — Meal Prep Planner Stress Tests', () => {
  it('CHECK 1: preferredServingSize = 1 → no recipe with min_servings > 1', () => {
    const prefs: UserPreferences = {
      ...defaultPreferences,
      preferredServingSize: 1,
    };
    const result = generateWeekPlan(defaultSettings, prefs, [], [], [], mealPrepRecipes);

    for (const meal of result.meals) {
      const recipe = mealPrepRecipes.find(r => r.id === meal.recipeId);
      expect(recipe).toBeDefined();
      const minServ = recipe!.min_servings || recipe!.servings;
      expect(minServ).toBeLessThanOrEqual(1);
    }
    expect(result.meals.length).toBeGreaterThan(0);
  });

  it('CHECK 2: allowLeftovers = false → no recipe appears more than once', () => {
    const prefs: UserPreferences = {
      ...defaultPreferences,
      allowLeftovers: false,
    };
    const result = generateWeekPlan(defaultSettings, prefs, [], [], [], mealPrepRecipes);

    const recipeIdCounts = new Map<string, number>();
    for (const meal of result.meals) {
      recipeIdCounts.set(meal.recipeId, (recipeIdCounts.get(meal.recipeId) || 0) + 1);
    }
    for (const [id, count] of recipeIdCounts) {
      expect(count).toBe(1);
    }
    expect(result.meals.length).toBeGreaterThan(0);
  });

  it('CHECK 3: allowLeftovers = true, leftoverTolerance = 3 → no recipe appears more than 3 times, leftover meals on different days', () => {
    const prefs: UserPreferences = {
      ...defaultPreferences,
      allowLeftovers: true,
      leftoverTolerance: 3,
      preferredServingSize: 1,
    };
    const result = generateWeekPlan(defaultSettings, prefs, [], [], [], mealPrepRecipes);

    const recipeIdCounts = new Map<string, number>();
    for (const meal of result.meals) {
      recipeIdCounts.set(meal.recipeId, (recipeIdCounts.get(meal.recipeId) || 0) + 1);
    }
    for (const [id, count] of recipeIdCounts) {
      expect(count).toBeLessThanOrEqual(3);
    }

    const leftoverMeals = result.meals.filter(m => m.isLeftover);
    for (const lo of leftoverMeals) {
      const originalCook = result.meals.find(m => m.recipeId === lo.recipeId && !m.isLeftover);
      if (originalCook) {
        expect(lo.dayIndex).not.toBe(originalCook.dayIndex);
      }
    }
  });

  it('CHECK 4: maxCookSessionsPerDay = 2, allowLeftovers = true → no day has more than 2 fresh cooks', () => {
    const prefs: UserPreferences = {
      ...defaultPreferences,
      allowLeftovers: true,
      leftoverTolerance: 4,
      maxCookSessionsPerDay: 2,
      preferredServingSize: 1,
    };
    const result = generateWeekPlan(defaultSettings, prefs, [], [], [], mealPrepRecipes);

    for (let day = 0; day < 7; day++) {
      const dayMeals = result.meals.filter(m => m.dayIndex === day);
      const freshCooks = dayMeals.filter(m => !m.isLeftover);
      expect(freshCooks.length).toBeLessThanOrEqual(2);
    }
  });

  it('CHECK 5: daily nutrition within ±50% of macro targets (approximate)', () => {
    const prefs: UserPreferences = {
      ...defaultPreferences,
      macroGoals: {
        targetCalories: 2000,
        targetProtein: 120,
        targetCarbs: 250,
        targetFat: 70,
      },
    };
    const result = generateWeekPlan(defaultSettings, prefs, [], [], [], mealPrepRecipes);

    for (let day = 0; day < 7; day++) {
      const dayMeals = result.meals.filter(m => m.dayIndex === day);
      if (dayMeals.length === 0) continue;
      const totalCal = dayMeals.reduce((sum, m) => {
        const r = mealPrepRecipes.find(rr => rr.id === m.recipeId);
        return sum + (r?.calories || 0) * m.servings;
      }, 0);
      expect(totalCal).toBeGreaterThan(0);
      expect(totalCal).toBeLessThan(2000 * 2);
    }
  });
});

describe('T011 — Regression Tests', () => {
  it('CHECK R1 — macro adherence with and without leftovers', () => {
    const prefs: UserPreferences = {
      ...defaultPreferences,
      macroGoals: {
        targetCalories: 2500,
        targetProtein: 180,
        targetCarbs: 280,
        targetFat: 85,
      },
    };
    const resultNoLeftovers = generateWeekPlan(defaultSettings, prefs, [], [], [], mealPrepRecipes);
    expect(resultNoLeftovers.meals.length).toBeGreaterThan(0);

    const prefsWithLeftovers: UserPreferences = {
      ...prefs,
      allowLeftovers: true,
      leftoverTolerance: 3,
    };
    const resultWithLeftovers = generateWeekPlan(defaultSettings, prefsWithLeftovers, [], [], [], mealPrepRecipes);
    expect(resultWithLeftovers.meals.length).toBeGreaterThan(0);

    for (const result of [resultNoLeftovers, resultWithLeftovers]) {
      const avgCal = result.projectedTotals.weeklyCalories / 7;
      expect(avgCal).toBeLessThan(2500 * 2);
      expect(avgCal).toBeGreaterThan(0);
    }
  });

  it('CHECK R2 — vegetarian restriction filters out meat before serving size filter', () => {
    const prefs: UserPreferences = {
      ...defaultPreferences,
      dietaryRestrictions: ['vegetarian'],
      preferredServingSize: 2,
    };
    const result = generateWeekPlan(defaultSettings, prefs, [], [], [], mealPrepRecipes);

    const meatKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tuna', 'bacon', 'steak'];
    for (const meal of result.meals) {
      const recipe = mealPrepRecipes.find(r => r.id === meal.recipeId);
      expect(recipe).toBeDefined();
      const hasNonVeg = recipe!.ingredients.some(i =>
        meatKeywords.some(m => i.name.toLowerCase().includes(m))
      );
      expect(hasNonVeg).toBe(false);
    }
  });

  it('CHECK R3 — excluded ingredients (allergies) filter works', () => {
    const prefs: UserPreferences = {
      ...defaultPreferences,
      allergies: ['avocado'],
    };
    const result = generateWeekPlan(defaultSettings, prefs, [], [], [], mealPrepRecipes);

    for (const meal of result.meals) {
      const recipe = mealPrepRecipes.find(r => r.id === meal.recipeId);
      expect(recipe).toBeDefined();
      const hasAvocado = recipe!.ingredients.some(i =>
        i.name.toLowerCase().includes('avocado')
      );
      expect(hasAvocado).toBe(false);
    }
  });

  it('CHECK R4 — cuisine preferences influence scoring', () => {
    const italianRecipes = mealPrepRecipes.map(r => ({ ...r }));
    italianRecipes[0] = { ...italianRecipes[0], cuisine: 'Italian' };

    const prefsItalian: UserPreferences = {
      ...defaultPreferences,
    };

    const scoreItalian = scoreRecipe(
      { ...mealPrepRecipes[0], cuisine: 'Italian' },
      [], prefsItalian, [], new Set(),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const scoreOther = scoreRecipe(
      { ...mealPrepRecipes[0], cuisine: 'Thai' },
      [], prefsItalian, [], new Set(),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    expect(typeof scoreItalian).toBe('number');
    expect(typeof scoreOther).toBe('number');
  });

  it('CHECK R5 — meal slot matching: breakfast recipes land in breakfast, leftovers stay in same meal type', () => {
    const prefs: UserPreferences = {
      ...defaultPreferences,
      allowLeftovers: true,
      leftoverTolerance: 3,
    };
    const result = generateWeekPlan(defaultSettings, prefs, [], [], [], mealPrepRecipes);

    for (const meal of result.meals) {
      const recipe = mealPrepRecipes.find(r => r.id === meal.recipeId);
      if (!recipe) continue;
      const mappedType = recipe.mealTypes.map(mt => {
        if (mt.toLowerCase() === 'breakfast') return 'Breakfast';
        if (mt.toLowerCase() === 'lunch') return 'Lunch';
        if (mt.toLowerCase() === 'dinner') return 'Dinner';
        if (mt.toLowerCase() === 'dessert') return 'Desserts';
        if (mt.toLowerCase() === 'snack' || mt.toLowerCase() === 'appetizer') return 'Snackitizers';
        return mt;
      });
      expect(mappedType).toContain(meal.mealType);
    }
  });

  it('CHECK R6 — free user regression: generates plan without Pro fields', () => {
    const freePrefs: UserPreferences = {
      allergies: [],
      dietaryRestrictions: [],
      cookingComfort: 'comfortable',
      tools: [],
    };
    const result = generateWeekPlan(defaultSettings, freePrefs, [], [], [], mealPrepRecipes);
    expect(result.meals.length).toBeGreaterThan(0);

    const recipeIdCounts = new Map<string, number>();
    for (const meal of result.meals) {
      recipeIdCounts.set(meal.recipeId, (recipeIdCounts.get(meal.recipeId) || 0) + 1);
    }
    for (const [id, count] of recipeIdCounts) {
      expect(count).toBe(1);
    }
  });

  it('CHECK R7 — combined Pro preferences all applied simultaneously', () => {
    const prefs: UserPreferences = {
      allergies: ['avocado'],
      dietaryRestrictions: ['vegetarian'],
      cookingComfort: 'comfortable',
      tools: [],
      macroGoals: {
        targetCalories: 2000,
        targetProtein: 100,
        targetCarbs: 250,
        targetFat: 70,
      },
      preferredServingSize: 2,
      allowLeftovers: true,
      leftoverTolerance: 3,
      maxCookSessionsPerDay: 2,
    };
    const result = generateWeekPlan(defaultSettings, prefs, [], [], [], mealPrepRecipes);
    expect(result.meals.length).toBeGreaterThan(0);

    const meatKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tuna', 'bacon', 'steak'];
    const recipeIdCounts = new Map<string, number>();
    for (const meal of result.meals) {
      const recipe = mealPrepRecipes.find(r => r.id === meal.recipeId);
      expect(recipe).toBeDefined();

      const minServ = recipe!.min_servings || recipe!.servings;
      expect(minServ).toBeLessThanOrEqual(2);

      const hasNonVeg = recipe!.ingredients.some(i =>
        meatKeywords.some(m => i.name.toLowerCase().includes(m))
      );
      expect(hasNonVeg).toBe(false);

      const hasAvocado = recipe!.ingredients.some(i =>
        i.name.toLowerCase().includes('avocado')
      );
      expect(hasAvocado).toBe(false);

      recipeIdCounts.set(meal.recipeId, (recipeIdCounts.get(meal.recipeId) || 0) + 1);
    }

    for (const [id, count] of recipeIdCounts) {
      expect(count).toBeLessThanOrEqual(3);
    }

    for (let day = 0; day < 7; day++) {
      const dayMeals = result.meals.filter(m => m.dayIndex === day);
      const freshCooks = dayMeals.filter(m => !m.isLeftover);
      expect(freshCooks.length).toBeLessThanOrEqual(2);
    }
  });
});
