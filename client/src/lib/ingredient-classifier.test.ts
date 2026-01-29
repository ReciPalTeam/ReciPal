import { describe, it, expect } from 'vitest';
import { classifyIngredient, IngredientCategory } from './ingredient-classifier';
import { generateSwapSuggestions } from './swap-suggestions';

describe('Ingredient Classification', () => {
  describe('Seasonings category', () => {
    it('classifies "garlic powder" as Seasonings (not Veggie)', () => {
      expect(classifyIngredient('garlic powder')).toBe('Seasonings');
    });

    it('classifies "Garlic Powder" as Seasonings (case insensitive)', () => {
      expect(classifyIngredient('Garlic Powder')).toBe('Seasonings');
    });

    it('classifies "paprika" as Seasonings', () => {
      expect(classifyIngredient('paprika')).toBe('Seasonings');
    });

    it('classifies "smoked paprika" as Seasonings', () => {
      expect(classifyIngredient('smoked paprika')).toBe('Seasonings');
    });

    it('classifies "black pepper" as Seasonings', () => {
      expect(classifyIngredient('black pepper')).toBe('Seasonings');
    });

    it('classifies "onion powder" as Seasonings (not Veggie)', () => {
      expect(classifyIngredient('onion powder')).toBe('Seasonings');
    });

    it('classifies "salt" as Seasonings', () => {
      expect(classifyIngredient('salt')).toBe('Seasonings');
    });

    it('classifies "kosher salt" as Seasonings', () => {
      expect(classifyIngredient('kosher salt')).toBe('Seasonings');
    });

    it('classifies "cumin" as Seasonings', () => {
      expect(classifyIngredient('cumin')).toBe('Seasonings');
    });

    it('classifies "oregano" as Seasonings', () => {
      expect(classifyIngredient('oregano')).toBe('Seasonings');
    });

    it('classifies "italian seasoning" as Seasonings', () => {
      expect(classifyIngredient('italian seasoning')).toBe('Seasonings');
    });

    it('classifies "red pepper flakes" as Seasonings', () => {
      expect(classifyIngredient('red pepper flakes')).toBe('Seasonings');
    });
  });

  describe('Oils category', () => {
    it('classifies "avocado oil" as Oils (not Veggie)', () => {
      expect(classifyIngredient('avocado oil')).toBe('Oils');
    });

    it('classifies "Avocado Oil" as Oils (case insensitive)', () => {
      expect(classifyIngredient('Avocado Oil')).toBe('Oils');
    });

    it('classifies "olive oil" as Oils', () => {
      expect(classifyIngredient('olive oil')).toBe('Oils');
    });

    it('classifies "extra virgin olive oil" as Oils', () => {
      expect(classifyIngredient('extra virgin olive oil')).toBe('Oils');
    });

    it('classifies "vegetable oil" as Oils', () => {
      expect(classifyIngredient('vegetable oil')).toBe('Oils');
    });

    it('classifies "coconut oil" as Oils', () => {
      expect(classifyIngredient('coconut oil')).toBe('Oils');
    });

    it('classifies "sesame oil" as Oils', () => {
      expect(classifyIngredient('sesame oil')).toBe('Oils');
    });

    it('classifies "canola oil" as Oils', () => {
      expect(classifyIngredient('canola oil')).toBe('Oils');
    });
  });

  describe('Dairy category (butter rule)', () => {
    it('classifies "butter" as Dairy', () => {
      expect(classifyIngredient('butter')).toBe('Dairy');
    });

    it('classifies "unsalted butter" as Dairy', () => {
      expect(classifyIngredient('unsalted butter')).toBe('Dairy');
    });

    it('classifies "ghee" as Dairy', () => {
      expect(classifyIngredient('ghee')).toBe('Dairy');
    });

    it('classifies "milk" as Dairy', () => {
      expect(classifyIngredient('milk')).toBe('Dairy');
    });

    it('classifies "cheddar cheese" as Dairy', () => {
      expect(classifyIngredient('cheddar cheese')).toBe('Dairy');
    });
  });

  describe('Veggie still works for actual vegetables', () => {
    it('classifies "fresh garlic" as Veggie', () => {
      expect(classifyIngredient('fresh garlic')).toBe('Veggie');
    });

    it('classifies "onions" as Veggie', () => {
      expect(classifyIngredient('onions')).toBe('Veggie');
    });

    it('classifies "avocado" (without oil) as Veggie', () => {
      expect(classifyIngredient('avocado')).toBe('Veggie');
    });

    it('classifies "bell pepper" as Veggie', () => {
      expect(classifyIngredient('bell pepper')).toBe('Veggie');
    });

    it('classifies "broccoli" as Veggie', () => {
      expect(classifyIngredient('broccoli')).toBe('Veggie');
    });
  });
});

describe('Swap Suggestions - Same Category Only', () => {
  const emptyFilters = {
    allergies: [],
    dietaryRestrictions: [],
    dislikedIngredients: [],
    pantryItems: [],
  };

  it('swap suggestions for paprika only return Seasonings', () => {
    const suggestions = generateSwapSuggestions('paprika', emptyFilters, 4);
    suggestions.forEach(s => {
      expect(s.category).toBe('Seasonings');
    });
  });

  it('swap suggestions for avocado oil only return Oils', () => {
    const suggestions = generateSwapSuggestions('avocado oil', emptyFilters, 4);
    suggestions.forEach(s => {
      expect(s.category).toBe('Oils');
    });
  });

  it('swap suggestions for butter only return Dairy', () => {
    const suggestions = generateSwapSuggestions('butter', emptyFilters, 4);
    suggestions.forEach(s => {
      expect(s.category).toBe('Dairy');
    });
  });

  it('swap suggestions for chicken breast only return Protein', () => {
    const suggestions = generateSwapSuggestions('chicken breast', emptyFilters, 4);
    suggestions.forEach(s => {
      expect(s.category).toBe('Protein');
    });
  });

  it('swap suggestions do not include the original ingredient', () => {
    const suggestions = generateSwapSuggestions('Salt', emptyFilters, 10);
    const names = suggestions.map(s => s.name.toLowerCase());
    expect(names).not.toContain('salt');
  });
});
