import { describe, it, expect } from 'vitest';
import { 
  buildForYouFeed, 
  applyFilters,
  hasAllergyConflict,
  RecipeWithOverlap,
  UserProfile,
  Filters 
} from './buildForYouFeed';

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
    overlap: { have: ['chicken'], missing: ['rice'], mightHave: [] },
    overlapScore: 0.5,
    pantryHaveCount: 1,
    pantryMissingCount: 1,
    pantryMissingIsSmall: false,
    ...overrides,
  };
}

function createCloseListRecipe(id: string, missingCount: 2 | 3 = 2): RecipeWithOverlap {
  return createMockRecipe(id, {
    pantryMissingCount: missingCount,
    pantryMissingIsSmall: true,
    overlap: {
      have: ['chicken'],
      missing: missingCount === 2 ? ['rice', 'beans'] : ['rice', 'beans', 'corn'],
      mightHave: [],
    },
  });
}

const defaultUserProfile: UserProfile = {
  allergies: [],
  dietaryPreferences: [],
  cookingComfort: 'comfortable',
  costPreference: 'balanced',
};

describe('buildForYouFeed', () => {
  describe('1) Injection positions only', () => {
    it('should inject closeList items ONLY at positions 5, 10, 15, 20 (1-based)', () => {
      const baseRecipes = Array.from({ length: 20 }, (_, i) => 
        createMockRecipe(`base-${i + 1}`)
      );
      const closeRecipes = Array.from({ length: 5 }, (_, i) => 
        createCloseListRecipe(`close-${i + 1}`)
      );
      
      const recipes = [...baseRecipes, ...closeRecipes];
      
      const result = buildForYouFeed({
        recipes,
        userProfile: defaultUserProfile,
      });

      const injectedPositions: number[] = [];
      result.feed.forEach((recipe, index) => {
        if (recipe.isInjected) {
          injectedPositions.push(index + 1);
        }
      });

      expect(injectedPositions.every(pos => pos % 5 === 0)).toBe(true);
      
      result.feed.forEach((recipe, index) => {
        const position = index + 1;
        if (position % 5 !== 0) {
          expect(recipe.isInjected).toBeFalsy();
        }
      });
    });

    it('closeList items should NOT appear at non-5th positions', () => {
      const baseRecipes = Array.from({ length: 25 }, (_, i) => 
        createMockRecipe(`base-${i + 1}`)
      );
      const closeRecipes = Array.from({ length: 6 }, (_, i) => 
        createCloseListRecipe(`close-${i + 1}`)
      );
      
      const recipes = [...baseRecipes, ...closeRecipes];
      const result = buildForYouFeed({
        recipes,
        userProfile: defaultUserProfile,
      });

      const closeListIds = new Set(closeRecipes.map(r => r.id));
      
      result.feed.forEach((recipe, index) => {
        const position = index + 1;
        if (closeListIds.has(recipe.id) && position % 5 !== 0) {
          if (index < result.baseList.length + result.closeList.length) {
            expect(recipe.isInjected).toBe(true);
          }
        }
      });
    });
  });

  describe('2) No duplicates', () => {
    it('should not have duplicate recipe IDs in output', () => {
      const baseRecipes = Array.from({ length: 15 }, (_, i) => 
        createMockRecipe(`recipe-${i + 1}`)
      );
      const closeRecipes = Array.from({ length: 5 }, (_, i) => 
        createCloseListRecipe(`close-${i + 1}`)
      );
      
      const recipes = [...baseRecipes, ...closeRecipes];
      const result = buildForYouFeed({
        recipes,
        userProfile: defaultUserProfile,
      });

      const ids = result.feed.map(r => r.id);
      const uniqueIds = new Set(ids);
      
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should handle overlapping input lists without duplicates', () => {
      const sharedRecipe = createMockRecipe('shared-1', {
        pantryMissingCount: 2,
        pantryMissingIsSmall: true,
      });
      
      const recipes = [
        ...Array.from({ length: 10 }, (_, i) => createMockRecipe(`base-${i}`)),
        sharedRecipe,
        createCloseListRecipe('close-1'),
        createCloseListRecipe('close-2'),
      ];
      
      const result = buildForYouFeed({
        recipes,
        userProfile: defaultUserProfile,
      });

      const ids = result.feed.map(r => r.id);
      const uniqueIds = new Set(ids);
      
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('3) closeList excluded from baseList', () => {
    it('recipes qualifying for closeList should NOT appear in baseList positions', () => {
      const baseRecipes = Array.from({ length: 10 }, (_, i) => 
        createMockRecipe(`base-${i + 1}`)
      );
      const closeRecipes = Array.from({ length: 3 }, (_, i) => 
        createCloseListRecipe(`close-${i + 1}`)
      );
      
      const recipes = [...baseRecipes, ...closeRecipes];
      const result = buildForYouFeed({
        recipes,
        userProfile: defaultUserProfile,
      });

      const closeListIds = new Set(result.closeList.map(r => r.id));
      
      result.baseList.forEach(recipe => {
        expect(closeListIds.has(recipe.id)).toBe(false);
      });
    });

    it('recipes with 2-3 missing ingredients should be in closeList, not baseList', () => {
      const recipes = [
        createMockRecipe('base-1', { pantryMissingCount: 4, pantryMissingIsSmall: false }),
        createMockRecipe('base-2', { pantryMissingCount: 5, pantryMissingIsSmall: false }),
        createCloseListRecipe('close-1', 2),
        createCloseListRecipe('close-2', 3),
      ];
      
      const result = buildForYouFeed({
        recipes,
        userProfile: defaultUserProfile,
      });

      expect(result.baseList.map(r => r.id)).toEqual(['base-1', 'base-2']);
      expect(result.closeList.map(r => r.id)).toEqual(['close-1', 'close-2']);
    });
  });

  describe('4) Handles closeList shortage', () => {
    it('should inject closeList until exhausted, then continue with baseList', () => {
      const baseRecipes = Array.from({ length: 20 }, (_, i) => 
        createMockRecipe(`base-${i + 1}`)
      );
      const closeRecipes = [
        createCloseListRecipe('close-1'),
        createCloseListRecipe('close-2'),
      ];
      
      const recipes = [...baseRecipes, ...closeRecipes];
      const result = buildForYouFeed({
        recipes,
        userProfile: defaultUserProfile,
      });

      expect(result.feed[4].isInjected).toBe(true);
      expect(result.feed[4].id).toBe('close-1');
      
      expect(result.feed[9].isInjected).toBe(true);
      expect(result.feed[9].id).toBe('close-2');
      
      expect(result.feed.length).toBeGreaterThan(15);
      expect(result.feed.some(r => r.id.startsWith('base-'))).toBe(true);
    });

    it('should not crash when closeList has fewer items than injection slots', () => {
      const baseRecipes = Array.from({ length: 30 }, (_, i) => 
        createMockRecipe(`base-${i + 1}`)
      );
      const closeRecipes = [createCloseListRecipe('close-1')];
      
      const recipes = [...baseRecipes, ...closeRecipes];
      
      expect(() => {
        const result = buildForYouFeed({
          recipes,
          userProfile: defaultUserProfile,
        });
        expect(result.feed.length).toBeGreaterThan(0);
      }).not.toThrow();
    });
  });

  describe('5) Handles closeList empty', () => {
    it('should return ranked baseList when closeList is empty', () => {
      const baseRecipes = Array.from({ length: 10 }, (_, i) => 
        createMockRecipe(`base-${i + 1}`, {
          overlapScore: 0.5 + (i * 0.01),
        })
      );
      
      const result = buildForYouFeed({
        recipes: baseRecipes,
        userProfile: defaultUserProfile,
      });

      expect(result.closeList.length).toBe(0);
      expect(result.feed.length).toBe(10);
      
      result.feed.forEach(recipe => {
        expect(recipe.isInjected).toBeFalsy();
      });
    });

    it('should not have any gaps when closeList is empty', () => {
      const baseRecipes = Array.from({ length: 15 }, (_, i) => 
        createMockRecipe(`base-${i + 1}`)
      );
      
      const result = buildForYouFeed({
        recipes: baseRecipes,
        userProfile: defaultUserProfile,
      });

      expect(result.feed.length).toBe(15);
      expect(result.feed.every(r => r.id.startsWith('base-'))).toBe(true);
    });
  });

  describe('6) Filters are applied before injection', () => {
    it('should hard-exclude recipes with allergy conflicts', () => {
      const safeRecipe = createMockRecipe('safe-1', {
        ingredients: [{ name: 'chicken', amount: '1', unit: 'lb' }],
      });
      const allergyRecipe = createMockRecipe('peanut-dish', {
        ingredients: [
          { name: 'peanuts', amount: '1', unit: 'cup' },
          { name: 'chicken', amount: '1', unit: 'lb' },
        ],
      });
      
      const result = buildForYouFeed({
        recipes: [safeRecipe, allergyRecipe],
        userProfile: {
          ...defaultUserProfile,
          allergies: ['peanuts'],
        },
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
          costPreference: '',
          dietary: [],
          allergies: ['milk'],
        },
      });

      const feedIds = result.feed.map(r => r.id);
      expect(feedIds).not.toContain('dairy-dish');
    });

    it('excluded recipes should never appear in output', () => {
      const recipes = [
        createMockRecipe('safe-1'),
        createMockRecipe('safe-2'),
        createMockRecipe('egg-dish', {
          ingredients: [{ name: 'eggs', amount: '2', unit: 'pcs' }],
        }),
        createCloseListRecipe('close-eggs'),
      ];
      
      (recipes[3] as RecipeWithOverlap).ingredients = [
        { name: 'eggs', amount: '3', unit: 'pcs' },
      ];
      
      const result = buildForYouFeed({
        recipes,
        userProfile: {
          ...defaultUserProfile,
          allergies: ['eggs'],
        },
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
          createMockRecipe(`base-${i + 1}`, { overlapScore: Math.random() })
        ),
        ...Array.from({ length: 4 }, (_, i) => 
          createCloseListRecipe(`close-${i + 1}`)
        ),
      ];
      
      const frozenRecipes = JSON.parse(JSON.stringify(recipes));
      
      const result1 = buildForYouFeed({
        recipes: frozenRecipes,
        userProfile: defaultUserProfile,
      });
      
      const result2 = buildForYouFeed({
        recipes: JSON.parse(JSON.stringify(frozenRecipes)),
        userProfile: defaultUserProfile,
      });
      
      const result3 = buildForYouFeed({
        recipes: JSON.parse(JSON.stringify(frozenRecipes)),
        userProfile: defaultUserProfile,
      });

      const ids1 = result1.feed.map(r => r.id);
      const ids2 = result2.feed.map(r => r.id);
      const ids3 = result3.feed.map(r => r.id);

      expect(ids1).toEqual(ids2);
      expect(ids2).toEqual(ids3);
    });

    it('should produce deterministic ordering for recipes with same scores', () => {
      const recipes = Array.from({ length: 10 }, (_, i) => 
        createMockRecipe(`recipe-${String.fromCharCode(65 + i)}`, {
          overlapScore: 0.5,
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

  it('should filter by serving size', () => {
    const recipes = [
      createMockRecipe('single', { servings: 1 }),
      createMockRecipe('double', { servings: 2 }),
      createMockRecipe('family', { servings: 4 }),
    ];
    
    const result = applyFilters(recipes, { servingSize: '3–4' });
    
    expect(result.map(r => r.id)).toEqual(['family']);
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
      ingredients: [
        { name: 'peanut butter', amount: '2', unit: 'tbsp' },
      ],
    });
    
    expect(hasAllergyConflict(recipe, ['peanut'])).toBe(true);
  });

  it('should return false when no conflict', () => {
    const recipe = createMockRecipe('test', {
      ingredients: [
        { name: 'chicken breast', amount: '1', unit: 'lb' },
      ],
    });
    
    expect(hasAllergyConflict(recipe, ['peanut', 'dairy'])).toBe(false);
  });

  it('should return false when allergies array is empty', () => {
    const recipe = createMockRecipe('test');
    expect(hasAllergyConflict(recipe, [])).toBe(false);
  });
});
