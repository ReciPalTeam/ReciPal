import { describe, it, expect } from 'vitest';
import {
  generateWeekPlan,
  filterRecipes,
  mapRecipeToMealType,
  GenerationSettings,
  UserPreferences,
} from './auto-populate';
import { PantryItem } from './demo-store';

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
        existingMeals
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
        existingMeals
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

      const result = generateWeekPlan(settings, defaultPreferences, [], [], []);

      const desserts = result.meals.filter(m => m.mealType === 'Desserts');
      expect(desserts).toHaveLength(0);
    });

    it('should NOT generate Snackitizers when addSnackitizers is false', () => {
      const settings = { ...defaultSettings, addSnackitizers: false };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], []);

      const snackitizers = result.meals.filter(m => m.mealType === 'Snackitizers');
      expect(snackitizers).toHaveLength(0);
    });

    it('should generate at least one Dessert when addDesserts is true', () => {
      const settings = { ...defaultSettings, addDesserts: true };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], []);

      const desserts = result.meals.filter(m => m.mealType === 'Desserts');
      expect(desserts.length).toBeGreaterThan(0);
    });

    it('should generate at least one Snackitizer when addSnackitizers is true', () => {
      const settings = { ...defaultSettings, addSnackitizers: true };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], []);

      const snackitizers = result.meals.filter(m => m.mealType === 'Snackitizers');
      expect(snackitizers.length).toBeGreaterThan(0);
    });
  });

  describe('Max 1 Dessert/Snackitizer per Day', () => {
    it('should generate at most 1 Dessert per day', () => {
      const settings = { ...defaultSettings, addDesserts: true };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], []);

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayDesserts = result.meals.filter(
          m => m.dayIndex === dayIndex && m.mealType === 'Desserts'
        );
        expect(dayDesserts.length).toBeLessThanOrEqual(1);
      }
    });

    it('should generate at most 1 Snackitizer per day', () => {
      const settings = { ...defaultSettings, addSnackitizers: true };

      const result = generateWeekPlan(settings, defaultPreferences, [], [], []);

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

      const result1 = generateWeekPlan(settings1, defaultPreferences, [], [], []);
      const result2 = generateWeekPlan(settings2, defaultPreferences, [], [], []);

      expect(result2.projectedTotals.weeklyCalories).toBeGreaterThanOrEqual(
        result1.projectedTotals.weeklyCalories
      );
    });
  });
});

describe('filterRecipes', () => {
  it('should filter out recipes containing allergens', () => {
    const mockRecipe = {
      id: '1',
      title: 'Peanut Butter Sandwich',
      ingredients: [
        { name: 'peanut butter', amount: '2', unit: 'tbsp' },
        { name: 'bread', amount: '2', unit: 'slices' },
      ],
    } as any;

    const preferences: UserPreferences = {
      ...defaultPreferences,
      allergies: ['peanut'],
    };

    const filtered = filterRecipes([mockRecipe], preferences);
    expect(filtered).toHaveLength(0);
  });

  it('should keep recipes without allergens', () => {
    const mockRecipe = {
      id: '1',
      title: 'Apple Pie',
      ingredients: [
        { name: 'apple', amount: '3', unit: 'count' },
        { name: 'flour', amount: '1', unit: 'cup' },
      ],
    } as any;

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
