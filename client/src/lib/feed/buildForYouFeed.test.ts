import { describe, it, expect } from 'vitest';
import {
  buildForYouFeed,
  applyFilters,
  hasAllergyConflict,
  RecipeWithOverlap,
  UserProfile,
} from './buildForYouFeed';

/**
 * Generic recipe factory. Defaults to a "rest" recipe (4 Need, 0 Maybe) so it lands
 * in the between-slots stream unless an override moves it into ready/almost tiers.
 * Ids are zero-padded where order matters (byFit ties break on id.localeCompare).
 */
function createMockRecipe(
  id: string,
  overrides: Partial<RecipeWithOverlap> = {}
): RecipeWithOverlap {
  return {
    id,
    title: `Recipe ${id}`,
    mealTypes: ['Lunch'],
    cookingStyle: 'Balanced',
    servings: 2,
    prepTime: 15,
    cookTime: 30,
    ingredients: [
      { name: 'chicken', amount: '1', unit: 'lb' },
      { name: 'rice', amount: '1', unit: 'cup' },
    ],
    instructions: ['Step 1', 'Step 2'],
    imageUrl: '/test.jpg',
    macros: { calories: 500, protein: 30, carbs: 40, fat: 20 },
    overlap: { have: ['chicken'], missing: ['rice', 'beans', 'corn', 'peppers'], mightHave: [] },
    overlapScore: 0.25,
    pantryHaveCount: 1,
    pantryMissingCount: 4,
    pantryMaybeCount: 0,
    pantryMissingIsSmall: false,
    ...overrides,
  };
}

/** Ready to Cook: Need 0 AND Maybe 0 — heads the injection stream. */
function createReadyRecipe(id: string): RecipeWithOverlap {
  return createMockRecipe(id, {
    pantryMissingCount: 0,
    pantryMaybeCount: 0,
    pantryMissingIsSmall: false,
    pantryHaveCount: 2,
    overlapScore: 1,
    overlap: { have: ['chicken', 'rice'], missing: [], mightHave: [] },
  });
}

/** True Almost There: Need 1–3, Maybe 0. */
function createAlmostRecipe(id: string, missingCount: 1 | 2 | 3 = 2): RecipeWithOverlap {
  const missing = ['rice', 'beans', 'corn'].slice(0, missingCount);
  return createMockRecipe(id, {
    pantryMissingCount: missingCount,
    pantryMaybeCount: 0,
    pantryMissingIsSmall: true,
    pantryHaveCount: 1,
    overlapScore: 0.5,
    overlap: { have: ['chicken'], missing, mightHave: [] },
  });
}

/** Maybe-blocked: Need 0 but some Maybe — Almost There, AFTER true almost. */
function createMaybeBlockedRecipe(id: string, maybeCount = 2): RecipeWithOverlap {
  const mightHave = ['rice', 'beans', 'corn'].slice(0, maybeCount);
  return createMockRecipe(id, {
    pantryMissingCount: 0,
    pantryMaybeCount: maybeCount,
    pantryMissingIsSmall: true,
    pantryHaveCount: 1,
    overlapScore: 0.75,
    overlap: { have: ['chicken'], missing: [], mightHave },
  });
}

const defaultUserProfile: UserProfile = {
  allergies: [],
  dietaryPreferences: [],
  cookingComfort: 'comfortable',
};

describe('buildForYouFeed', () => {
  describe('1) Injection slots: combined Ready-then-Almost stream at cell 1 + every 4th', () => {
    it('fills 0-based slots 0, 4, 8, 12, 16 with ALL Ready first, THEN Almost', () => {
      const baseRecipes = Array.from({ length: 12 }, (_, i) =>
        createMockRecipe(`base-${String(i + 1).padStart(2, '0')}`)
      );
      const readyRecipes = [createReadyRecipe('ready-1'), createReadyRecipe('ready-2')];
      const almostRecipes = [
        createAlmostRecipe('almost-1', 1),
        createAlmostRecipe('almost-2', 2),
        createAlmostRecipe('almost-3', 3),
      ];

      const result = buildForYouFeed({
        recipes: [...baseRecipes, ...readyRecipes, ...almostRecipes],
        userProfile: defaultUserProfile,
      });

      const injectedPositions = result.feed
        .map((r, i) => (r.isInjected ? i : -1))
        .filter(i => i >= 0);
      expect(injectedPositions).toEqual([0, 4, 8, 12, 16]);

      // Ready first, then Almost (fewest Need first), in slot order.
      expect(result.feed[0].id).toBe('ready-1');
      expect(result.feed[4].id).toBe('ready-2');
      expect(result.feed[8].id).toBe('almost-1');
      expect(result.feed[12].id).toBe('almost-2');
      expect(result.feed[16].id).toBe('almost-3');
    });

    it('with no Ready recipes, Almost starts at the first cell + every 4th', () => {
      const baseRecipes = Array.from({ length: 10 }, (_, i) =>
        createMockRecipe(`base-${String(i + 1).padStart(2, '0')}`)
      );
      const almostRecipes = [
        createAlmostRecipe('almost-1', 1),
        createAlmostRecipe('almost-2', 3),
      ];

      const result = buildForYouFeed({
        recipes: [...baseRecipes, ...almostRecipes],
        userProfile: defaultUserProfile,
      });

      expect(result.feed[0].id).toBe('almost-1');
      expect(result.feed[0].isInjected).toBe(true);
      expect(result.feed[4].id).toBe('almost-2');
      expect(result.feed[4].isInjected).toBe(true);
      // Everything else is rest-tier, non-injected.
      result.feed.forEach((r, i) => {
        if (i !== 0 && i !== 4) expect(r.isInjected).toBeFalsy();
      });
    });

    it('cells between slots hold ONLY rest-tier recipes (Need ≥4)', () => {
      const baseRecipes = Array.from({ length: 12 }, (_, i) =>
        createMockRecipe(`base-${String(i + 1).padStart(2, '0')}`)
      );
      const recipes = [
        ...baseRecipes,
        createReadyRecipe('ready-1'),
        createAlmostRecipe('almost-1', 2),
        createMaybeBlockedRecipe('maybe-1'),
      ];

      const result = buildForYouFeed({ recipes, userProfile: defaultUserProfile });

      result.feed.forEach((r, i) => {
        if (i % 4 !== 0) {
          expect(r.isInjected).toBeFalsy();
          expect(r.pantryMissingCount).toBeGreaterThanOrEqual(4);
        }
      });
    });
  });

  describe('2) Tier predicates (the truth table)', () => {
    it('Ready requires Need 0 AND Maybe 0 — a Maybe item disqualifies Ready', () => {
      const recipes = [
        createReadyRecipe('ready-1'),
        createMaybeBlockedRecipe('maybe-1', 2), // Need 0, Maybe 2 → NOT ready
      ];

      const result = buildForYouFeed({ recipes, userProfile: defaultUserProfile });

      expect(result.readyList.map(r => r.id)).toEqual(['ready-1']);
      expect(result.almostList.map(r => r.id)).toContain('maybe-1');
    });

    it('Need=3 is Almost There; Need=4 is rest', () => {
      const recipes = [
        createAlmostRecipe('almost-3', 3),
        createMockRecipe('rest-4', { pantryMissingCount: 4 }),
      ];

      const result = buildForYouFeed({ recipes, userProfile: defaultUserProfile });

      expect(result.almostList.map(r => r.id)).toEqual(['almost-3']);
      expect(result.restList.map(r => r.id)).toEqual(['rest-4']);
    });

    it('Need 1–3 with Maybe present is still Almost There (lower-certainty half)', () => {
      const mixed = createMockRecipe('mixed-1', {
        pantryMissingCount: 1,
        pantryMaybeCount: 1,
        overlap: { have: ['chicken'], missing: ['rice'], mightHave: ['beans'] },
      });

      const result = buildForYouFeed({
        recipes: [mixed, createMockRecipe('rest-1')],
        userProfile: defaultUserProfile,
      });

      expect(result.almostList.map(r => r.id)).toEqual(['mixed-1']);
    });

    it('maybe-involved recipes sort AFTER all true Almost in the stream', () => {
      const recipes = [
        createMaybeBlockedRecipe('maybe-1', 1), // Need 0, Maybe 1
        createAlmostRecipe('almost-3', 3),      // Need 3, Maybe 0 — still before any maybe
        createAlmostRecipe('almost-1', 1),
        createMockRecipe('mixed-1', {
          pantryMissingCount: 2,
          pantryMaybeCount: 1,
          overlap: { have: ['chicken'], missing: ['rice', 'beans'], mightHave: ['corn'] },
        }),
      ];

      const result = buildForYouFeed({ recipes, userProfile: defaultUserProfile });

      // True almost (Maybe 0) by Need ASC, then maybe-involved by Need ASC.
      expect(result.almostList.map(r => r.id)).toEqual([
        'almost-1',
        'almost-3',
        'maybe-1',
        'mixed-1',
      ]);
    });
  });

  describe('3) No duplicates / completeness', () => {
    it('should not have duplicate recipe IDs in output', () => {
      const recipes = [
        ...Array.from({ length: 15 }, (_, i) => createMockRecipe(`base-${i + 1}`)),
        ...Array.from({ length: 4 }, (_, i) => createReadyRecipe(`ready-${i + 1}`)),
        ...Array.from({ length: 3 }, (_, i) => createAlmostRecipe(`almost-${i + 1}`)),
        createMaybeBlockedRecipe('maybe-1'),
      ];

      const result = buildForYouFeed({ recipes, userProfile: defaultUserProfile });

      const ids = result.feed.map(r => r.id);
      expect(ids.length).toBe(new Set(ids).size);
    });

    it('should emit every input recipe exactly once', () => {
      const recipes = [
        ...Array.from({ length: 10 }, (_, i) => createMockRecipe(`base-${i + 1}`)),
        ...Array.from({ length: 3 }, (_, i) => createReadyRecipe(`ready-${i + 1}`)),
        ...Array.from({ length: 2 }, (_, i) => createAlmostRecipe(`almost-${i + 1}`)),
        createMaybeBlockedRecipe('maybe-1'),
      ];

      const result = buildForYouFeed({ recipes, userProfile: defaultUserProfile });

      expect(result.feed.length).toBe(recipes.length);
      expect(new Set(result.feed.map(r => r.id))).toEqual(new Set(recipes.map(r => r.id)));
    });
  });

  describe('4) Stream shortage and drain', () => {
    it('injects until the stream is exhausted, then continues with rest only', () => {
      const baseRecipes = Array.from({ length: 20 }, (_, i) =>
        createMockRecipe(`base-${String(i + 1).padStart(2, '0')}`)
      );
      const result = buildForYouFeed({
        recipes: [...baseRecipes, createReadyRecipe('ready-1'), createAlmostRecipe('almost-1', 2)],
        userProfile: defaultUserProfile,
      });

      expect(result.feed[0].id).toBe('ready-1');
      expect(result.feed[4].id).toBe('almost-1');
      expect(result.feed.slice(5).every(r => !r.isInjected)).toBe(true);
      expect(result.feed.length).toBe(22);
    });

    it('drains leftover makeable recipes when rest is exhausted', () => {
      // 1 rest recipe, 5 ready: slot 0 = ready, cell 1 = the only rest,
      // then the remaining ready recipes drain consecutively.
      const recipes = [
        createMockRecipe('base-1'),
        ...Array.from({ length: 5 }, (_, i) => createReadyRecipe(`ready-${i + 1}`)),
      ];

      const result = buildForYouFeed({ recipes, userProfile: defaultUserProfile });

      expect(result.feed.length).toBe(6);
      expect(result.feed.filter(r => r.isInjected).length).toBe(5);
      expect(result.feed[0].pantryMissingCount).toBe(0);
    });

    it('should not crash when the stream has fewer items than slots', () => {
      const baseRecipes = Array.from({ length: 30 }, (_, i) =>
        createMockRecipe(`base-${i + 1}`)
      );

      expect(() => {
        const result = buildForYouFeed({
          recipes: [...baseRecipes, createReadyRecipe('ready-1')],
          userProfile: defaultUserProfile,
        });
        expect(result.feed.length).toBe(31);
        expect(result.feed[0].id).toBe('ready-1');
      }).not.toThrow();
    });
  });

  describe('5) Handles empty injection stream', () => {
    it('returns the ranked rest feed when nothing is makeable', () => {
      const baseRecipes = Array.from({ length: 10 }, (_, i) =>
        createMockRecipe(`base-${i + 1}`, { overlapScore: 0.25 + i * 0.01 })
      );

      const result = buildForYouFeed({
        recipes: baseRecipes,
        userProfile: defaultUserProfile,
      });

      expect(result.readyList.length).toBe(0);
      expect(result.almostList.length).toBe(0);
      expect(result.feed.length).toBe(10);
      result.feed.forEach(recipe => expect(recipe.isInjected).toBeFalsy());
    });
  });

  describe('6) Filters are applied before injection', () => {
    it('should hard-exclude recipes with allergy conflicts', () => {
      const safeRecipe = createReadyRecipe('safe-1');
      const allergyRecipe = createReadyRecipe('peanut-dish');
      allergyRecipe.ingredients = [
        { name: 'peanuts', amount: '1', unit: 'cup' },
        { name: 'chicken', amount: '1', unit: 'lb' },
      ];

      const result = buildForYouFeed({
        recipes: [safeRecipe, allergyRecipe],
        userProfile: { ...defaultUserProfile, allergies: ['peanuts'] },
      });

      const feedIds = result.feed.map(r => r.id);
      expect(feedIds).toContain('safe-1');
      expect(feedIds).not.toContain('peanut-dish');
    });

    it('should exclude recipes based on filter allergies', () => {
      const safeRecipe = createMockRecipe('safe-1');
      const dairyRecipe = createMockRecipe('dairy-dish', {
        ingredients: [{ name: 'milk', amount: '1', unit: 'cup' }],
      });

      const result = buildForYouFeed({
        recipes: [safeRecipe, dairyRecipe],
        userProfile: defaultUserProfile,
        filters: {
          mealTypes: [],
          cookingStyles: [],
          servingSize: 'all',
          kidFriendly: false,
          timeDifficulty: '',
          dietary: [],
          allergies: ['milk'],
        },
      });

      expect(result.feed.map(r => r.id)).not.toContain('dairy-dish');
    });

    it('excluded recipes should never appear in output', () => {
      const recipes = [
        createMockRecipe('safe-1'),
        createMockRecipe('safe-2'),
        createMockRecipe('egg-dish', {
          ingredients: [{ name: 'eggs', amount: '3', unit: 'pcs' }],
        }),
        createReadyRecipe('egg-ready'),
      ];
      recipes[3].ingredients = [{ name: 'eggs', amount: '2', unit: 'pcs' }];

      const result = buildForYouFeed({
        recipes,
        userProfile: { ...defaultUserProfile, allergies: ['eggs'] },
      });

      result.feed.forEach(recipe => {
        expect(hasAllergyConflict(recipe, ['eggs'])).toBe(false);
      });
    });
  });

  describe('7) Determinism', () => {
    it('same inputs should produce the same ordered list every run', () => {
      const recipes = [
        ...Array.from({ length: 15 }, (_, i) =>
          createMockRecipe(`base-${i + 1}`, { overlapScore: 0.25 })
        ),
        ...Array.from({ length: 4 }, (_, i) => createReadyRecipe(`ready-${i + 1}`)),
        ...Array.from({ length: 3 }, (_, i) => createAlmostRecipe(`almost-${i + 1}`)),
        createMaybeBlockedRecipe('maybe-1'),
      ];

      const frozen = JSON.parse(JSON.stringify(recipes));
      const run = () =>
        buildForYouFeed({
          recipes: JSON.parse(JSON.stringify(frozen)),
          userProfile: defaultUserProfile,
        }).feed.map(r => r.id);

      const ids1 = run();
      const ids2 = run();
      const ids3 = run();

      expect(ids1).toEqual(ids2);
      expect(ids2).toEqual(ids3);
    });

    it('should produce deterministic ordering for recipes with same scores', () => {
      const recipes = Array.from({ length: 10 }, (_, i) =>
        createMockRecipe(`recipe-${String.fromCharCode(65 + i)}`, {
          overlapScore: 0.25,
          cookingStyle: 'Balanced',
        })
      );

      const result1 = buildForYouFeed({ recipes, userProfile: defaultUserProfile });
      const result2 = buildForYouFeed({ recipes: [...recipes], userProfile: defaultUserProfile });

      expect(result1.feed.map(r => r.id)).toEqual(result2.feed.map(r => r.id));
    });
  });
});

describe('applyFilters', () => {
  it('should filter by meal types', () => {
    const recipes = [
      createMockRecipe('breakfast', { mealTypes: ['Breakfast'] }),
      createMockRecipe('lunch', { mealTypes: ['Lunch'] }),
      createMockRecipe('dinner', { mealTypes: ['Dinner'] }),
    ];

    const result = applyFilters(recipes, { mealTypes: ['Breakfast', 'Lunch'] });

    expect(result.map(r => r.id)).toEqual(['breakfast', 'lunch']);
  });

  it('should filter by cooking styles', () => {
    const recipes = [
      createMockRecipe('quick', { cookingStyle: 'Quick & Easy' }),
      createMockRecipe('gourmet', { cookingStyle: 'Healthy Gourmet' }),
    ];

    const result = applyFilters(recipes, { cookingStyles: ['Quick & Easy'] });

    expect(result.map(r => r.id)).toEqual(['quick']);
  });

  it('should filter by serving size using min_servings', () => {
    const recipes = [
      createMockRecipe('single', { servings: 1 }),
      createMockRecipe('double', { servings: 2 }),
      createMockRecipe('family', { servings: 4 }),
      createMockRecipe('big-batch', { servings: 8, min_servings: 6 } as any),
    ];

    const result = applyFilters(recipes, { servingSize: '3–4' });

    expect(result.map(r => r.id)).toEqual(['single', 'double', 'family']);
  });

  it('should filter by search query', () => {
    const recipes = [
      createMockRecipe('chicken-1', { title: 'Grilled Chicken' }),
      createMockRecipe('beef-1', { title: 'Beef Stew' }),
    ];

    const result = applyFilters(recipes, {}, 'chicken');

    expect(result.map(r => r.id)).toEqual(['chicken-1']);
  });
});

describe('hasAllergyConflict', () => {
  it('should detect allergy in ingredients', () => {
    const recipe = createMockRecipe('test', {
      ingredients: [{ name: 'peanut butter', amount: '2', unit: 'tbsp' }],
    });

    expect(hasAllergyConflict(recipe, ['peanut'])).toBe(true);
  });

  it('should return false when no conflict', () => {
    const recipe = createMockRecipe('test', {
      ingredients: [{ name: 'chicken breast', amount: '1', unit: 'lb' }],
    });

    expect(hasAllergyConflict(recipe, ['peanut', 'dairy'])).toBe(false);
  });

  it('should return false when allergies array is empty', () => {
    const recipe = createMockRecipe('test');
    expect(hasAllergyConflict(recipe, [])).toBe(false);
  });
});
