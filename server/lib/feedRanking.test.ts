import { describe, it, expect } from 'vitest';
import {
  filterByExcludedTerms,
  recipeContainsAnyTerm,
  rankByMacroFit,
  rankByCalorieGoal,
  macroFitScore,
} from './feedRanking';
import type { Recipe } from '../../client/src/lib/mock-data';

function mockRecipe(id: string, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    title: `Recipe ${id}`,
    image: '/test.jpg',
    cuisine: 'American',
    dish_type: '',
    sub_category: null,
    prepTime: '15m',
    cookTime: '30m',
    totalTime: '45m',
    servings: 2,
    calories: 500,
    protein: 30,
    carbs: 40,
    fat: 20,
    mealTypes: ['Lunch'],
    cookingStyle: 'Balanced',
    ingredients: [
      { name: 'chicken breast', amount: 1, unit: 'lb' },
      { name: 'white rice', amount: 1, unit: 'cup' },
    ],
    steps: [],
    ...overrides,
  } as Recipe;
}

describe('filterByExcludedTerms (dislikedFoods + excludedIngredients)', () => {
  it('excludes recipes whose ingredients contain a disliked term', () => {
    const recipes = [
      mockRecipe('keep'),
      mockRecipe('drop', {
        ingredients: [
          { name: 'mushrooms', amount: 1, unit: 'cup' },
          { name: 'white rice', amount: 1, unit: 'cup' },
        ],
      } as any),
    ];

    const result = filterByExcludedTerms(recipes, ['Mushrooms']);
    expect(result.map(r => r.id)).toEqual(['keep']);
  });

  it('matches descriptor-bearing ingredient names (substring on normalized names)', () => {
    const recipe = mockRecipe('r1', {
      ingredients: [{ name: 'freshly chopped cilantro', amount: 1, unit: 'bunch' }],
    } as any);

    expect(recipeContainsAnyTerm(recipe, ['cilantro'])).toBe(true);
  });

  it('always scans the title too — catches dishes whose ingredients use a synonym', () => {
    // "Beef Tostadas" listing only "skirt steak" must still be excluded for "beef"
    const synonymDish = mockRecipe('synonym', {
      title: 'Beef Tostadas',
      ingredients: [
        { name: 'skirt steak', amount: 1, unit: 'lb' },
        { name: 'corn tostadas', amount: 6, unit: 'each' },
      ],
    } as any);
    expect(filterByExcludedTerms([synonymDish], ['beef'])).toEqual([]);

    // No-ingredient-data recipes are caught by title as well
    const noData = mockRecipe('no-data', { title: 'Creamy Mushroom Risotto', ingredients: [] } as any);
    expect(filterByExcludedTerms([noData], ['mushroom'])).toEqual([]);
  });

  it('is a no-op for empty/undefined terms and ignores 1-char noise', () => {
    const recipes = [mockRecipe('a'), mockRecipe('b')];
    expect(filterByExcludedTerms(recipes, undefined).length).toBe(2);
    expect(filterByExcludedTerms(recipes, []).length).toBe(2);
    expect(filterByExcludedTerms(recipes, ['', 'x']).length).toBe(2);
  });
});

describe('rankByMacroFit (Pro)', () => {
  // Daily 2100/150/210/63 at 3 meals/day → per-meal 700 cal / 50 P / 70 C / 21 F.
  const targets = {
    targetCalories: 2100,
    targetProtein: 150,
    targetCarbs: 210,
    targetFat: 63,
    mealsPerDay: 3,
  };

  it('orders best macro fit first', () => {
    const onTarget = mockRecipe('on-target', { calories: 700, protein: 50, carbs: 70, fat: 21 });
    const wayOff = mockRecipe('way-off', { calories: 1400, protein: 10, carbs: 180, fat: 60 });
    const close = mockRecipe('close', { calories: 760, protein: 45, carbs: 80, fat: 25 });

    const ranked = rankByMacroFit([wayOff, close, onTarget], targets);
    expect(ranked.map(r => r.id)).toEqual(['on-target', 'close', 'way-off']);
  });

  it('treats deviations inside the ±5% band as a perfect fit (score 0)', () => {
    const within = mockRecipe('within', { calories: 715, protein: 51, carbs: 68, fat: 21.5 });
    expect(macroFitScore(within, targets)).toBe(0);
  });

  it('is stable: equal scores keep the incoming (variety) order', () => {
    const a = mockRecipe('a', { calories: 700, protein: 50, carbs: 70, fat: 21 });
    const b = mockRecipe('b', { calories: 705, protein: 50, carbs: 70, fat: 21 });
    const ranked = rankByMacroFit([b, a], targets);
    expect(ranked.map(r => r.id)).toEqual(['b', 'a']); // both score 0 → incoming order kept
  });

  it('cut goal punishes calorie overshoot harder than undershoot', () => {
    const over = mockRecipe('over', { calories: 900, protein: 50, carbs: 70, fat: 21 });
    const under = mockRecipe('under', { calories: 500, protein: 50, carbs: 70, fat: 21 });

    const cut = rankByMacroFit([over, under], { ...targets, goal: 'cut' });
    expect(cut[0].id).toBe('under');

    const bulk = rankByMacroFit([over, under], { ...targets, goal: 'bulk' });
    expect(bulk[0].id).toBe('over');
  });

  it('recipes with no nutrition data sink below scored recipes', () => {
    const noData = mockRecipe('no-data', { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const off = mockRecipe('off', { calories: 1200, protein: 20, carbs: 150, fat: 40 });

    const ranked = rankByMacroFit([noData, off], targets);
    expect(ranked.map(r => r.id)).toEqual(['off', 'no-data']);
  });
});

describe('rankByCalorieGoal (Free)', () => {
  it('orders by closeness of calories to calorieGoal / mealsPerDay', () => {
    // 1800/3 = 600 per meal; 700 is outside the ±5% band, 1100 way outside
    const close = mockRecipe('close', { calories: 700 });
    const far = mockRecipe('far', { calories: 1100 });
    const exact = mockRecipe('exact', { calories: 600 });

    const ranked = rankByCalorieGoal([far, close, exact], 1800, 3);
    expect(ranked.map(r => r.id)).toEqual(['exact', 'close', 'far']);
  });

  it('calories within the ±5% band tie with exact and keep incoming order', () => {
    const banded = mockRecipe('banded', { calories: 620 }); // 3.3% off 600 → in band
    const exact = mockRecipe('exact', { calories: 600 });

    const ranked = rankByCalorieGoal([banded, exact], 1800, 3);
    expect(ranked.map(r => r.id)).toEqual(['banded', 'exact']); // both 0 → stable
  });

  it('returns recipes unchanged for a non-positive goal', () => {
    const recipes = [mockRecipe('a', { calories: 900 }), mockRecipe('b', { calories: 100 })];
    expect(rankByCalorieGoal(recipes, 0, 3).map(r => r.id)).toEqual(['a', 'b']);
  });
});
