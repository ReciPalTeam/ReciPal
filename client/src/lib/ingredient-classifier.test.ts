import { describe, it, expect } from 'vitest';
import { classifyIngredient, IngredientCategory } from './ingredient-classifier';
import { generateSwapSuggestions } from './swap-suggestions';
import { getPantryGroup } from './ingredient-categories';

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

    it('classifies "mustard seed" as Seasonings (not Sauces)', () => {
      expect(classifyIngredient('mustard seed')).toBe('Seasonings');
    });

    it('classifies "vanilla extract" as Seasonings', () => {
      expect(classifyIngredient('vanilla extract')).toBe('Seasonings');
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

  describe('Dairy category', () => {
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

  describe('Sauces & Condiments category', () => {
    it('classifies "soy sauce" as Sauces & Condiments', () => {
      expect(classifyIngredient('soy sauce')).toBe('Sauces & Condiments');
    });

    it('classifies "ketchup" as Sauces & Condiments', () => {
      expect(classifyIngredient('ketchup')).toBe('Sauces & Condiments');
    });

    it('classifies "honey" as Sauces & Condiments', () => {
      expect(classifyIngredient('honey')).toBe('Sauces & Condiments');
    });

    it('classifies "maple syrup" as Sauces & Condiments', () => {
      expect(classifyIngredient('maple syrup')).toBe('Sauces & Condiments');
    });

    it('classifies "mayonnaise" as Sauces & Condiments', () => {
      expect(classifyIngredient('mayonnaise')).toBe('Sauces & Condiments');
    });

    it('classifies "dijon mustard" as Sauces & Condiments', () => {
      expect(classifyIngredient('dijon mustard')).toBe('Sauces & Condiments');
    });

    it('classifies "tahini" as Sauces & Condiments', () => {
      expect(classifyIngredient('tahini')).toBe('Sauces & Condiments');
    });

    it('classifies "balsamic vinegar" as Sauces & Condiments', () => {
      expect(classifyIngredient('balsamic vinegar')).toBe('Sauces & Condiments');
    });
  });

  describe('Nuts & Seeds category', () => {
    it('classifies "almonds" as Nuts & Seeds', () => {
      expect(classifyIngredient('almonds')).toBe('Nuts & Seeds');
    });

    it('classifies "peanut butter" as Nuts & Seeds', () => {
      expect(classifyIngredient('peanut butter')).toBe('Nuts & Seeds');
    });

    it('classifies "walnuts" as Nuts & Seeds', () => {
      expect(classifyIngredient('walnuts')).toBe('Nuts & Seeds');
    });

    it('classifies "chia seeds" as Nuts & Seeds', () => {
      expect(classifyIngredient('chia seeds')).toBe('Nuts & Seeds');
    });

    it('classifies "sunflower seeds" as Nuts & Seeds', () => {
      expect(classifyIngredient('sunflower seeds')).toBe('Nuts & Seeds');
    });
  });

  describe('Chocolate & Sweets category', () => {
    it('classifies "dark chocolate" as Chocolate & Sweets', () => {
      expect(classifyIngredient('dark chocolate')).toBe('Chocolate & Sweets');
    });

    it('classifies "cocoa powder" as Chocolate & Sweets', () => {
      expect(classifyIngredient('cocoa powder')).toBe('Chocolate & Sweets');
    });

    it('classifies "marshmallows" as Chocolate & Sweets', () => {
      expect(classifyIngredient('marshmallows')).toBe('Chocolate & Sweets');
    });
  });

  describe('Pickled & Preserved category', () => {
    it('classifies "kimchi" as Pickled & Preserved', () => {
      expect(classifyIngredient('kimchi')).toBe('Pickled & Preserved');
    });

    it('classifies "sun-dried tomato" as Pickled & Preserved', () => {
      expect(classifyIngredient('sun-dried tomato')).toBe('Pickled & Preserved');
    });

    it('classifies "capers" as Pickled & Preserved', () => {
      expect(classifyIngredient('capers')).toBe('Pickled & Preserved');
    });

    it('classifies "kalamata olives" as Pickled & Preserved', () => {
      expect(classifyIngredient('kalamata olives')).toBe('Pickled & Preserved');
    });

    it('classifies "sauerkraut" as Pickled & Preserved', () => {
      expect(classifyIngredient('sauerkraut')).toBe('Pickled & Preserved');
    });
  });

  describe('Baking & Thickeners category', () => {
    it('classifies "all-purpose flour" as Baking & Thickeners', () => {
      expect(classifyIngredient('all-purpose flour')).toBe('Baking & Thickeners');
    });

    it('classifies "cornstarch" as Baking & Thickeners', () => {
      expect(classifyIngredient('cornstarch')).toBe('Baking & Thickeners');
    });

    it('classifies "baking powder" as Baking & Thickeners', () => {
      expect(classifyIngredient('baking powder')).toBe('Baking & Thickeners');
    });

    it('classifies "active dry yeast" as Baking & Thickeners', () => {
      expect(classifyIngredient('active dry yeast')).toBe('Baking & Thickeners');
    });

    it('classifies "light brown sugar" as Baking & Thickeners (not Carb)', () => {
      expect(classifyIngredient('light brown sugar')).toBe('Baking & Thickeners');
    });

    it('classifies "brown sugar" as Baking & Thickeners (not Carb)', () => {
      expect(classifyIngredient('brown sugar')).toBe('Baking & Thickeners');
    });

    it('classifies "powdered sugar" as Baking & Thickeners', () => {
      expect(classifyIngredient('powdered sugar')).toBe('Baking & Thickeners');
    });

    it('classifies "granulated sugar" as Baking & Thickeners', () => {
      expect(classifyIngredient('granulated sugar')).toBe('Baking & Thickeners');
    });

    it('classifies "sugar" as Baking & Thickeners', () => {
      expect(classifyIngredient('sugar')).toBe('Baking & Thickeners');
    });

    it('classifies "coconut sugar" as Baking & Thickeners', () => {
      expect(classifyIngredient('coconut sugar')).toBe('Baking & Thickeners');
    });

    it('classifies "sugar snap peas" as Veggie (not Baking)', () => {
      expect(classifyIngredient('sugar snap peas')).toBe('Veggie');
    });
  });

  describe('Broths & Stocks category', () => {
    it('classifies "chicken broth" as Broths & Stocks', () => {
      expect(classifyIngredient('chicken broth')).toBe('Broths & Stocks');
    });

    it('classifies "vegetable stock" as Broths & Stocks', () => {
      expect(classifyIngredient('vegetable stock')).toBe('Broths & Stocks');
    });

    it('classifies "beef broth" as Broths & Stocks', () => {
      expect(classifyIngredient('beef broth')).toBe('Broths & Stocks');
    });

    it('classifies "dashi" as Broths & Stocks', () => {
      expect(classifyIngredient('dashi')).toBe('Broths & Stocks');
    });
  });

  describe('Alcohol category', () => {
    it('classifies "red wine" as Alcohol', () => {
      expect(classifyIngredient('red wine')).toBe('Alcohol');
    });

    it('classifies "bourbon" as Alcohol', () => {
      expect(classifyIngredient('bourbon')).toBe('Alcohol');
    });

    it('classifies "mirin" as Alcohol', () => {
      expect(classifyIngredient('mirin')).toBe('Alcohol');
    });
  });

  describe('Non-Food & Equipment category', () => {
    it('classifies "parchment paper" as Non-Food & Equipment', () => {
      expect(classifyIngredient('parchment paper')).toBe('Non-Food & Equipment');
    });

    it('classifies "bamboo skewers" as Non-Food & Equipment', () => {
      expect(classifyIngredient('bamboo skewers')).toBe('Non-Food & Equipment');
    });

    it('classifies "toothpicks" as Non-Food & Equipment', () => {
      expect(classifyIngredient('toothpicks')).toBe('Non-Food & Equipment');
    });
  });

  describe('Prepared Batters & Doughs category', () => {
    it('classifies "puff pastry" as Prepared Batters & Doughs', () => {
      expect(classifyIngredient('puff pastry')).toBe('Prepared Batters & Doughs');
    });

    it('classifies "pie crust" as Prepared Batters & Doughs', () => {
      expect(classifyIngredient('pie crust')).toBe('Prepared Batters & Doughs');
    });

    it('classifies "wonton wrappers" as Prepared Batters & Doughs', () => {
      expect(classifyIngredient('wonton wrappers')).toBe('Prepared Batters & Doughs');
    });
  });

  describe('Beverages & Coffee category', () => {
    it('classifies "espresso" as Beverages & Coffee', () => {
      expect(classifyIngredient('espresso')).toBe('Beverages & Coffee');
    });

    it('classifies "matcha" as Beverages & Coffee', () => {
      expect(classifyIngredient('matcha')).toBe('Beverages & Coffee');
    });

    it('classifies "orange juice" as Beverages & Coffee', () => {
      expect(classifyIngredient('orange juice')).toBe('Beverages & Coffee');
    });

    it('classifies "coconut milk" as Beverages & Coffee', () => {
      expect(classifyIngredient('coconut milk')).toBe('Beverages & Coffee');
    });

    it('classifies "almond milk" as Beverages & Coffee', () => {
      expect(classifyIngredient('almond milk')).toBe('Beverages & Coffee');
    });
  });

  describe('Category migration edge cases', () => {
    it('classifies "flour" as Baking & Thickeners (not Carb)', () => {
      expect(classifyIngredient('flour')).toBe('Baking & Thickeners');
    });

    it('classifies "cornmeal" as Baking & Thickeners (not Carb)', () => {
      expect(classifyIngredient('cornmeal')).toBe('Baking & Thickeners');
    });

    it('classifies "tortilla" as Carb (not Prepared Batters)', () => {
      expect(classifyIngredient('tortilla')).toBe('Carb');
    });

    it('classifies "biscuit" as Carb (not Prepared Batters)', () => {
      expect(classifyIngredient('biscuit')).toBe('Carb');
    });

    it('classifies "biscuit dough" as Prepared Batters & Doughs', () => {
      expect(classifyIngredient('biscuit dough')).toBe('Prepared Batters & Doughs');
    });

    it('never returns "Other"', () => {
      const testIngredients = ['xyz unknown', 'foobarbaz', 'magic dust'];
      testIngredients.forEach(name => {
        expect(classifyIngredient(name)).not.toBe('Other');
      });
    });

    it('falls back to "Seasonings" for unrecognized ingredients', () => {
      expect(classifyIngredient('xyz unknown ingredient')).toBe('Seasonings');
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

  it('swap suggestions for honey return Sauces & Condiments', () => {
    const suggestions = generateSwapSuggestions('honey', emptyFilters, 4);
    suggestions.forEach(s => {
      expect(s.category).toBe('Sauces & Condiments');
    });
  });

  it('swap suggestions for chicken broth return Broths & Stocks', () => {
    const suggestions = generateSwapSuggestions('chicken broth', emptyFilters, 4);
    suggestions.forEach(s => {
      expect(s.category).toBe('Broths & Stocks');
    });
  });
});

describe('getPantryGroup', () => {
  describe('Protein sub-classification', () => {
    it('maps "chicken breast" (Protein) → "Meat & Seafood"', () => {
      expect(getPantryGroup('chicken breast', 'Protein')).toBe('Meat & Seafood');
    });

    it('maps "salmon fillet" (Protein) → "Meat & Seafood"', () => {
      expect(getPantryGroup('salmon fillet', 'Protein')).toBe('Meat & Seafood');
    });

    it('maps "eggs" (Protein) → "Dairy & Eggs"', () => {
      expect(getPantryGroup('eggs', 'Protein')).toBe('Dairy & Eggs');
    });

    it('maps "egg" (Protein) → "Dairy & Eggs"', () => {
      expect(getPantryGroup('egg', 'Protein')).toBe('Dairy & Eggs');
    });

    it('maps "tofu" (Protein) → "Prepared Foods & Deli"', () => {
      expect(getPantryGroup('tofu', 'Protein')).toBe('Prepared Foods & Deli');
    });

    it('maps "tempeh" (Protein) → "Prepared Foods & Deli"', () => {
      expect(getPantryGroup('tempeh', 'Protein')).toBe('Prepared Foods & Deli');
    });
  });

  describe('Carb sub-classification', () => {
    it('maps "spaghetti" (Carb) → "Pasta, Rice & Grains"', () => {
      expect(getPantryGroup('spaghetti', 'Carb')).toBe('Pasta, Rice & Grains');
    });

    it('maps "jasmine rice" (Carb) → "Pasta, Rice & Grains"', () => {
      expect(getPantryGroup('jasmine rice', 'Carb')).toBe('Pasta, Rice & Grains');
    });

    it('maps "black beans" (Carb) → "Pasta, Rice & Grains"', () => {
      expect(getPantryGroup('black beans', 'Carb')).toBe('Pasta, Rice & Grains');
    });

    it('maps "tortilla" (Carb) → "Bread & Bakery"', () => {
      expect(getPantryGroup('tortilla', 'Carb')).toBe('Bread & Bakery');
    });

    it('maps "naan bread" (Carb) → "Bread & Bakery"', () => {
      expect(getPantryGroup('naan bread', 'Carb')).toBe('Bread & Bakery');
    });

    it('maps "panko breadcrumbs" (Carb) → "Bread & Bakery"', () => {
      expect(getPantryGroup('panko breadcrumbs', 'Carb')).toBe('Bread & Bakery');
    });
  });

  describe('Direct category mappings', () => {
    it('maps "paprika" (Seasonings) → "Spices & Seasonings"', () => {
      expect(getPantryGroup('paprika', 'Seasonings')).toBe('Spices & Seasonings');
    });

    it('maps "broccoli" (Veggie) → "Produce"', () => {
      expect(getPantryGroup('broccoli', 'Veggie')).toBe('Produce');
    });

    it('maps "lemon" (Fruit) → "Produce"', () => {
      expect(getPantryGroup('lemon', 'Fruit')).toBe('Produce');
    });

    it('maps "olive oil" (Oils) → "Oils, Sauces & Condiments"', () => {
      expect(getPantryGroup('olive oil', 'Oils')).toBe('Oils, Sauces & Condiments');
    });

    it('maps "barbecue sauce" (Sauces & Condiments) → "Oils, Sauces & Condiments"', () => {
      expect(getPantryGroup('barbecue sauce', 'Sauces & Condiments')).toBe('Oils, Sauces & Condiments');
    });

    it('maps "walnuts" (Nuts & Seeds) → "Snacks & Nuts"', () => {
      expect(getPantryGroup('walnuts', 'Nuts & Seeds')).toBe('Snacks & Nuts');
    });

    it('maps "dark chocolate" (Chocolate & Sweets) → "Baking & Sweets"', () => {
      expect(getPantryGroup('dark chocolate', 'Chocolate & Sweets')).toBe('Baking & Sweets');
    });

    it('maps "cornstarch" (Baking & Thickeners) → "Baking & Sweets"', () => {
      expect(getPantryGroup('cornstarch', 'Baking & Thickeners')).toBe('Baking & Sweets');
    });

    it('maps "chicken broth" (Broths & Stocks) → "Canned & Jarred"', () => {
      expect(getPantryGroup('chicken broth', 'Broths & Stocks')).toBe('Canned & Jarred');
    });

    it('maps "kalamata olives" (Pickled & Preserved) → "Canned & Jarred"', () => {
      expect(getPantryGroup('kalamata olives', 'Pickled & Preserved')).toBe('Canned & Jarred');
    });

    it('maps "bourbon" (Alcohol) → "Beverages & Alcohol"', () => {
      expect(getPantryGroup('bourbon', 'Alcohol')).toBe('Beverages & Alcohol');
    });

    it('maps "espresso" (Beverages & Coffee) → "Beverages & Alcohol"', () => {
      expect(getPantryGroup('espresso', 'Beverages & Coffee')).toBe('Beverages & Alcohol');
    });

    it('maps "bamboo skewers" (Non-Food & Equipment) → "Non-Food"', () => {
      expect(getPantryGroup('bamboo skewers', 'Non-Food & Equipment')).toBe('Non-Food');
    });
  });

  describe('Frozen heuristic', () => {
    it('maps "frozen puff pastry sheets" (Prepared Batters & Doughs) → "Frozen"', () => {
      expect(getPantryGroup('frozen puff pastry sheets', 'Prepared Batters & Doughs')).toBe('Frozen');
    });

    it('maps "frozen peas" (Veggie) → "Frozen"', () => {
      expect(getPantryGroup('frozen peas', 'Veggie')).toBe('Frozen');
    });

    it('maps "frozen mixed berries" (Fruit) → "Frozen"', () => {
      expect(getPantryGroup('frozen mixed berries', 'Fruit')).toBe('Frozen');
    });

    it('maps "frozen chicken breast" (Protein) → "Meat & Seafood" (NOT Frozen)', () => {
      expect(getPantryGroup('frozen chicken breast', 'Protein')).toBe('Meat & Seafood');
    });
  });

  describe('Edge cases', () => {
    it('maps "eggplant" (Veggie) → "Produce" (NOT Dairy & Eggs)', () => {
      expect(getPantryGroup('eggplant', 'Veggie')).toBe('Produce');
    });
  });
});
