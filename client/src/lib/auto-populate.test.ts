import { describe, it, expect } from 'vitest';
import {
  generateWeekPlan,
  filterRecipes,
  mapRecipeToMealType,
  scoreRecipe,
  GenerationSettings,
  UserPreferences,
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
