import { classifyIngredient, getIngredientNutritionEstimate, IngredientCategory } from './ingredient-classifier';
import { PantryItem } from './demo-store';

export interface SwapSuggestion {
  name: string;
  category: IngredientCategory;
  inPantry: boolean;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

const INGREDIENT_DATABASE: Record<IngredientCategory, string[]> = {
  Protein: [
    'Chicken Breast', 'Chicken Thigh', 'Ground Turkey', 'Ground Beef', 'Salmon Fillet',
    'Tuna Steak', 'Shrimp', 'Cod', 'Tilapia', 'Tofu', 'Tempeh', 'Eggs',
    'Black Beans', 'Chickpeas', 'Lentils', 'Greek Yogurt', 'Cottage Cheese',
    'Pork Tenderloin', 'Lamb Chops', 'Turkey Breast', 'Crab Meat', 'Scallops',
    'Duck Breast', 'Venison', 'Bison', 'Seitan', 'Edamame',
  ],
  Carb: [
    'White Rice', 'Brown Rice', 'Quinoa', 'Pasta', 'Whole Wheat Pasta',
    'Bread', 'Whole Wheat Bread', 'Tortillas', 'Potatoes', 'Sweet Potatoes',
    'Oats', 'Couscous', 'Barley', 'Farro', 'Bulgur', 'Pita Bread',
    'Rice Noodles', 'Egg Noodles', 'Sourdough Bread', 'Bagels', 'English Muffins',
    'Pancake Mix', 'Waffle Mix', 'Cornbread', 'Polenta',
  ],
  Veggie: [
    'Spinach', 'Kale', 'Broccoli', 'Cauliflower', 'Brussels Sprouts',
    'Carrots', 'Bell Peppers', 'Zucchini', 'Mushrooms', 'Onions',
    'Tomatoes', 'Cucumber', 'Celery', 'Asparagus', 'Green Beans',
    'Cabbage', 'Lettuce', 'Arugula', 'Eggplant', 'Squash',
    'Bok Choy', 'Fennel', 'Artichokes', 'Beets', 'Radishes',
  ],
  Fruit: [
    'Apples', 'Bananas', 'Oranges', 'Strawberries', 'Blueberries',
    'Raspberries', 'Mango', 'Pineapple', 'Peaches', 'Grapes',
    'Watermelon', 'Cantaloupe', 'Kiwi', 'Pears', 'Cherries',
    'Lemons', 'Limes', 'Grapefruit', 'Pomegranate', 'Figs',
  ],
  Dairy: [
    'Butter', 'Unsalted Butter', 'Ghee', 'Clarified Butter',
    'Milk', 'Whole Milk', 'Skim Milk', '2% Milk',
    'Heavy Cream', 'Half and Half', 'Sour Cream', 'Creme Fraiche',
    'Cream Cheese', 'Ricotta', 'Mascarpone',
    'Cheddar Cheese', 'Mozzarella', 'Parmesan', 'Feta', 'Gouda', 'Brie',
    'Goat Cheese', 'Blue Cheese', 'Swiss Cheese', 'Provolone',
    'Yogurt', 'Plain Yogurt', 'Buttermilk', 'Kefir',
  ],
  Seasonings: [
    'Salt', 'Sea Salt', 'Kosher Salt', 'Himalayan Salt',
    'Black Pepper', 'White Pepper', 'Cracked Pepper', 'Peppercorns',
    'Garlic Powder', 'Onion Powder', 'Chili Powder', 'Curry Powder',
    'Paprika', 'Smoked Paprika', 'Sweet Paprika',
    'Cumin', 'Ground Cumin', 'Coriander', 'Turmeric', 'Saffron',
    'Cinnamon', 'Ground Cinnamon', 'Nutmeg', 'Cloves', 'Allspice', 'Cardamom',
    'Cayenne', 'Red Pepper Flakes', 'Crushed Red Pepper', 'Chili Flakes',
    'Oregano', 'Dried Oregano', 'Basil', 'Dried Basil', 'Thyme', 'Dried Thyme',
    'Rosemary', 'Sage', 'Marjoram', 'Tarragon', 'Dill', 'Parsley',
    'Bay Leaves', 'Italian Seasoning', 'Herbes de Provence',
    'Garam Masala', 'Taco Seasoning', 'Cajun Seasoning', 'Old Bay',
    'Mustard Seed', 'Celery Seed', 'Fennel Seed', 'Caraway Seed',
    'Vanilla Extract', 'Almond Extract',
  ],
  Oils: [
    'Olive Oil', 'Extra Virgin Olive Oil', 'Light Olive Oil',
    'Avocado Oil', 'Vegetable Oil', 'Canola Oil', 'Coconut Oil',
    'Sesame Oil', 'Toasted Sesame Oil', 'Peanut Oil', 'Sunflower Oil',
    'Grapeseed Oil', 'Corn Oil', 'Safflower Oil', 'Walnut Oil',
    'Truffle Oil', 'Chili Oil', 'Garlic Oil',
    'Cooking Spray', 'Nonstick Spray',
    'Shortening', 'Lard', 'Duck Fat', 'Bacon Fat',
  ],
  'Sauces & Condiments': [
    'Soy Sauce', 'Tamari', 'Fish Sauce', 'Worcestershire Sauce',
    'Vinegar', 'Balsamic Vinegar', 'Rice Vinegar', 'Apple Cider Vinegar',
    'Honey', 'Maple Syrup', 'Agave', 'Molasses',
    'Hot Sauce', 'Sriracha', 'Tabasco',
    'Mayonnaise', 'Mustard', 'Dijon Mustard', 'Ketchup', 'BBQ Sauce',
    'Ranch Dressing', 'Italian Dressing', 'Caesar Dressing',
    'Tomato Paste', 'Tomato Sauce', 'Salsa', 'Pesto', 'Hoisin Sauce',
    'Teriyaki Sauce', 'Tahini', 'Hummus', 'Guacamole',
  ],
  'Nuts & Seeds': [
    'Almonds', 'Walnuts', 'Pecans', 'Cashews', 'Peanuts', 'Pistachios',
    'Sunflower Seeds', 'Chia Seeds', 'Pumpkin Seeds', 'Pine Nuts',
    'Hazelnuts', 'Macadamia Nuts', 'Brazil Nuts',
    'Peanut Butter', 'Almond Butter', 'Cashew Butter',
    'Sesame Seeds', 'Flaxseed', 'Hemp Seeds', 'Trail Mix',
  ],
  'Chocolate & Sweets': [
    'Dark Chocolate', 'Milk Chocolate', 'White Chocolate',
    'Cocoa Powder', 'Chocolate Chips', 'Marshmallows',
    'Caramel Sauce', 'Marzipan', 'Sprinkles', 'Fudge',
  ],
  'Pickled & Preserved': [
    'Dill Pickles', 'Kalamata Olives', 'Green Olives', 'Capers',
    'Kimchi', 'Sauerkraut', 'Sun-Dried Tomatoes', 'Pickled Jalapenos',
    'Cornichons', 'Pickled Ginger',
  ],
  'Baking & Thickeners': [
    'All-Purpose Flour', 'Whole Wheat Flour', 'Bread Flour',
    'Cornstarch', 'Baking Powder', 'Baking Soda',
    'Active Dry Yeast', 'Gelatin', 'Arrowroot', 'Tapioca Starch',
    'Cream of Tartar', 'Cornmeal', 'Cake Flour', 'Xanthan Gum',
    'Brown Sugar', 'Light Brown Sugar', 'Powdered Sugar',
    'Granulated Sugar', 'Coconut Sugar', 'Turbinado Sugar',
    'Demerara Sugar', 'Raw Sugar', 'Cane Sugar', 'Muscovado Sugar',
  ],
  'Broths & Stocks': [
    'Chicken Broth', 'Beef Broth', 'Vegetable Broth',
    'Chicken Stock', 'Beef Stock', 'Vegetable Stock',
    'Bone Broth', 'Dashi', 'Bouillon Cubes',
  ],
  Alcohol: [
    'Red Wine', 'White Wine', 'Beer', 'Bourbon', 'Rum',
    'Vodka', 'Sake', 'Sherry', 'Mirin', 'Brandy',
    'Champagne', 'Port Wine', 'Cognac', 'Tequila', 'Gin',
  ],
  'Non-Food & Equipment': [
    'Bamboo Skewers', 'Parchment Paper', 'Kitchen Twine',
    'Aluminum Foil', 'Plastic Wrap', 'Cheesecloth',
    'Toothpicks', 'Ice Cubes', 'Wax Paper',
  ],
  'Prepared Batters & Doughs': [
    'Puff Pastry', 'Phyllo Dough', 'Pie Crust', 'Pizza Dough',
    'Wonton Wrappers', 'Egg Roll Wrappers', 'Crescent Roll Dough',
    'Biscuit Dough', 'Pastry Sheets',
  ],
  'Beverages & Coffee': [
    'Coffee', 'Espresso', 'Green Tea', 'Matcha Powder',
    'Orange Juice', 'Apple Juice', 'Lemon Juice', 'Lime Juice',
    'Grapefruit Juice', 'Cranberry Juice', 'Grape Juice', 'Pineapple Juice',
    'Tomato Juice', 'Pomegranate Juice',
    'Coconut Milk', 'Almond Milk', 'Oat Milk', 'Soy Milk',
    'Coconut Water', 'Kombucha',
  ],
};

export interface SwapFilters {
  allergies: string[];
  dietaryRestrictions: string[];
  dislikedIngredients: string[];
  pantryItems: PantryItem[];
  favoriteRecipeIngredients?: string[];
  isPro?: boolean;
  targetMacros?: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

function matchesAllergy(ingredientName: string, allergies: string[]): boolean {
  const normalized = ingredientName.toLowerCase();

  for (const allergy of allergies) {
    const allergyNorm = allergy.toLowerCase();

    if (allergyNorm === 'dairy' || allergyNorm === 'lactose') {
      if (['milk', 'cheese', 'yogurt', 'butter', 'cream', 'cottage'].some(d => normalized.includes(d))) {
        return true;
      }
    }
    if (allergyNorm === 'gluten' || allergyNorm === 'wheat') {
      if (['bread', 'pasta', 'flour', 'wheat', 'barley', 'couscous', 'bagel', 'muffin', 'waffle', 'pancake'].some(g => normalized.includes(g))) {
        return true;
      }
    }
    if (allergyNorm === 'nuts' || allergyNorm === 'tree nuts') {
      if (['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia'].some(n => normalized.includes(n))) {
        return true;
      }
    }
    if (allergyNorm === 'shellfish') {
      if (['shrimp', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster'].some(s => normalized.includes(s))) {
        return true;
      }
    }
    if (allergyNorm === 'soy') {
      if (['tofu', 'tempeh', 'soy', 'edamame', 'miso'].some(s => normalized.includes(s))) {
        return true;
      }
    }
    if (allergyNorm === 'eggs' || allergyNorm === 'egg') {
      if (normalized.includes('egg')) {
        return true;
      }
    }
    if (allergyNorm === 'fish') {
      if (['salmon', 'tuna', 'cod', 'tilapia', 'fish', 'anchovy', 'sardine', 'mackerel', 'halibut', 'bass', 'trout'].some(f => normalized.includes(f))) {
        return true;
      }
    }

    if (normalized.includes(allergyNorm)) {
      return true;
    }
  }

  return false;
}

function matchesDietaryRestriction(ingredientName: string, restrictions: string[]): boolean {
  const normalized = ingredientName.toLowerCase();

  for (const restriction of restrictions) {
    const restrictNorm = restriction.toLowerCase();

    if (restrictNorm === 'vegetarian') {
      if (['chicken', 'beef', 'pork', 'turkey', 'lamb', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'bacon', 'ham', 'sausage', 'steak', 'veal', 'venison', 'bison'].some(m => normalized.includes(m))) {
        return true;
      }
    }
    if (restrictNorm === 'vegan') {
      if (['chicken', 'beef', 'pork', 'turkey', 'lamb', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'bacon', 'ham', 'sausage', 'steak', 'egg', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'honey'].some(a => normalized.includes(a))) {
        return true;
      }
    }
    if (restrictNorm === 'keto' || restrictNorm === 'low-carb') {
      if (['rice', 'pasta', 'bread', 'potato', 'oat', 'flour', 'sugar', 'honey', 'syrup', 'bagel', 'waffle', 'pancake', 'tortilla', 'corn'].some(c => normalized.includes(c))) {
        return true;
      }
    }
    if (restrictNorm === 'paleo') {
      if (['pasta', 'bread', 'rice', 'oat', 'bean', 'lentil', 'peanut', 'dairy', 'cheese', 'milk', 'yogurt', 'soy', 'tofu'].some(p => normalized.includes(p))) {
        return true;
      }
    }
  }

  return false;
}

function isDisliked(ingredientName: string, dislikes: string[]): boolean {
  const normalized = ingredientName.toLowerCase();
  return dislikes.some(d => normalized.includes(d.toLowerCase()));
}

function isInPantry(ingredientName: string, pantryItems: PantryItem[]): boolean {
  const normalized = ingredientName.toLowerCase().trim();
  return pantryItems.some(item =>
    item.state === 'have' &&
    item.normalizedName.toLowerCase().trim() === normalized
  );
}

export function generateSwapSuggestions(
  originalIngredient: string,
  filters: SwapFilters,
  count: number = 4
): SwapSuggestion[] {
  const originalCategory = classifyIngredient(originalIngredient);
  const normalizedOriginal = originalIngredient.toLowerCase();

  const candidates = INGREDIENT_DATABASE[originalCategory] || [];

  let filtered = candidates.filter(ingredient => {
    const normalized = ingredient.toLowerCase();

    if (normalized === normalizedOriginal || normalizedOriginal.includes(normalized) || normalized.includes(normalizedOriginal)) {
      return false;
    }

    const candidateCategory = classifyIngredient(ingredient);
    if (candidateCategory !== originalCategory) {
      return false;
    }

    if (matchesAllergy(ingredient, filters.allergies)) {
      return false;
    }

    if (matchesDietaryRestriction(ingredient, filters.dietaryRestrictions)) {
      return false;
    }

    if (isDisliked(ingredient, filters.dislikedIngredients)) {
      return false;
    }

    return true;
  });

  const seen = new Set<string>();
  filtered = filtered.filter(ingredient => {
    const normalized = ingredient.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  const scored = filtered.map(ingredient => {
    let score = 0;

    if (isInPantry(ingredient, filters.pantryItems)) {
      score += 100;
    }

    if (filters.favoriteRecipeIngredients?.some(fav =>
      ingredient.toLowerCase().includes(fav.toLowerCase()) ||
      fav.toLowerCase().includes(ingredient.toLowerCase())
    )) {
      score += 50;
    }

    if (filters.isPro && filters.targetMacros) {
      const nutrition = getIngredientNutritionEstimate(ingredient);
      if (filters.targetMacros.protein > 0 && nutrition.protein > 15) {
        score += 20;
      }
    }

    score += Math.random() * 10;

    return { ingredient, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map(({ ingredient }) => ({
    name: ingredient,
    category: classifyIngredient(ingredient),
    inPantry: isInPantry(ingredient, filters.pantryItems),
    nutrition: getIngredientNutritionEstimate(ingredient),
  }));
}

export function searchIngredients(
  query: string,
  filters: SwapFilters,
  maxResults: number = 10
): SwapSuggestion[] {
  const normalized = query.toLowerCase().trim();

  if (!normalized) {
    return [];
  }

  const allIngredients: string[] = [];
  Object.values(INGREDIENT_DATABASE).forEach(list => {
    allIngredients.push(...list);
  });

  const matches = allIngredients.filter(ingredient => {
    if (!ingredient.toLowerCase().includes(normalized)) {
      return false;
    }

    if (matchesAllergy(ingredient, filters.allergies)) {
      return false;
    }

    if (matchesDietaryRestriction(ingredient, filters.dietaryRestrictions)) {
      return false;
    }

    if (isDisliked(ingredient, filters.dislikedIngredients)) {
      return false;
    }

    return true;
  });

  return matches.slice(0, maxResults).map(ingredient => ({
    name: ingredient,
    category: classifyIngredient(ingredient),
    inPantry: isInPantry(ingredient, filters.pantryItems),
    nutrition: getIngredientNutritionEstimate(ingredient),
  }));
}

const BRAND_PREFIXES = [
  'McCormick', 'Great Value', 'Kraft', 'Heinz', 'Del Monte',
  'Old El Paso', "Stubb's", "Frank's", 'Hidden Valley', 'Barilla',
  'Kikkoman', "French's", "Hellmann's", 'Best Foods', "Hunt's",
  'Prego', 'Ragu', 'Classico', 'Bertolli', "Newman's Own",
  "Annie's", "Trader Joe's", 'Whole Foods', '365', 'Simply Organic',
  'Spice Islands', 'Morton', 'Diamond Crystal', "Land O'Lakes",
  'Philadelphia', 'Sargento', 'Tillamook', 'Cabot', 'Kerrygold',
  'Horizon', 'Organic Valley', 'Stonyfield', 'Chobani', 'Fage',
  'Oikos', 'Dannon', 'Yoplait', 'Kirkland', "Member's Mark",
  'Market Pantry', 'Good & Gather', 'Essential Everyday',
  'Signature Select', 'Open Nature', 'O Organics', 'Private Selection',
  'Kroger', 'Publix', 'Aldi', 'Lidl', 'Wegmans', 'HEB', 'Meijer',
  'Badia', "Tone's", 'Goya', 'La Preferida', 'Ortega', 'Pace',
  'Tostitos', "Lay's", 'Doritos', 'Pringles', 'Jif', 'Skippy',
  'Peter Pan', "Smucker's", "Welch's", 'Tropicana', 'Minute Maid',
  'Simply', 'Ocean Spray', 'V8', 'Pillsbury', 'Betty Crocker',
  'Duncan Hines', 'Bob\'s Red Mill', 'King Arthur', 'Gold Medal',
];

export function stripBrandName(fatSecretFoodName: string): string {
  let name = fatSecretFoodName.trim();

  const dashMatch = name.match(/^.+?\s*-\s*(.+)$/);
  if (dashMatch) {
    name = dashMatch[1].trim();
  } else {
    const lowerName = name.toLowerCase();
    const sortedBrands = [...BRAND_PREFIXES].sort((a, b) => b.length - a.length);

    for (const brand of sortedBrands) {
      const brandLower = brand.toLowerCase();
      if (lowerName.startsWith(brandLower + ' ')) {
        name = name.slice(brand.length).trim();
        break;
      }
      if (lowerName.startsWith(brandLower + "'s ")) {
        name = name.slice(brand.length + 2).trim();
        break;
      }
    }
  }

  if (name.length === 0) return fatSecretFoodName.trim();

  return name.charAt(0).toUpperCase() + name.slice(1);
}

const ALTERNATIVE_SEARCH_MAP: Partial<Record<IngredientCategory, Record<string, string[]>>> = {
  Protein: {
    chicken: ['turkey breast', 'pork loin', 'tofu'],
    turkey: ['chicken breast', 'pork tenderloin', 'tempeh'],
    beef: ['bison', 'lamb', 'turkey'],
    pork: ['chicken', 'turkey', 'tofu'],
    salmon: ['tilapia', 'cod', 'tuna'],
    tuna: ['salmon', 'halibut', 'swordfish'],
    shrimp: ['scallops', 'crab', 'lobster'],
    fish: ['salmon', 'tilapia', 'cod'],
    tofu: ['tempeh', 'seitan', 'edamame'],
    egg: ['tofu scramble', 'chickpea', 'cottage cheese'],
    bacon: ['turkey bacon', 'pancetta', 'prosciutto'],
    sausage: ['turkey sausage', 'chicken sausage', 'chorizo'],
    lamb: ['beef', 'bison', 'venison'],
  },
  Seasonings: {
    paprika: ['cayenne pepper', 'chili powder', 'ground ancho'],
    cumin: ['coriander', 'caraway', 'curry powder'],
    cinnamon: ['nutmeg', 'allspice', 'cardamom'],
    oregano: ['thyme', 'marjoram', 'basil'],
    basil: ['oregano', 'italian seasoning', 'parsley'],
    thyme: ['rosemary', 'sage', 'oregano'],
    salt: ['sea salt', 'kosher salt', 'himalayan salt'],
    pepper: ['white pepper', 'cayenne', 'red pepper flakes'],
    turmeric: ['saffron', 'curry powder', 'ground ginger'],
    cayenne: ['paprika', 'chili flakes', 'chipotle powder'],
    rosemary: ['thyme', 'sage', 'oregano'],
    dill: ['tarragon', 'fennel seed', 'parsley'],
    garlic: ['garlic powder', 'onion powder', 'shallot powder'],
  },
  Dairy: {
    cheese: ['swiss cheese', 'gouda', 'mozzarella'],
    cheddar: ['swiss cheese', 'gouda', 'provolone'],
    mozzarella: ['provolone', 'fontina', 'monterey jack'],
    parmesan: ['pecorino', 'asiago', 'romano'],
    feta: ['goat cheese', 'ricotta salata', 'queso fresco'],
    milk: ['buttermilk', 'cream', 'half and half'],
    butter: ['ghee', 'clarified butter', 'margarine'],
    cream: ['half and half', 'evaporated milk', 'coconut cream'],
    yogurt: ['sour cream', 'creme fraiche', 'kefir'],
  },
  'Sauces & Condiments': {
    soy: ['tamari', 'coconut aminos', 'fish sauce'],
    ketchup: ['tomato paste', 'bbq sauce', 'chili sauce'],
    mustard: ['dijon mustard', 'whole grain mustard', 'horseradish'],
    mayo: ['aioli', 'greek yogurt', 'sour cream'],
    salsa: ['pico de gallo', 'hot sauce', 'chimichurri'],
    vinegar: ['lemon juice', 'lime juice', 'rice vinegar'],
    honey: ['agave', 'maple syrup', 'molasses'],
    hot: ['sriracha', 'tabasco', 'chili garlic sauce'],
    bbq: ['teriyaki sauce', 'hoisin sauce', 'honey mustard'],
    pesto: ['chimichurri', 'salsa verde', 'herb sauce'],
  },
  Veggie: {
    broccoli: ['cauliflower', 'green beans', 'asparagus'],
    spinach: ['kale', 'swiss chard', 'arugula'],
    kale: ['spinach', 'collard greens', 'swiss chard'],
    carrot: ['parsnip', 'sweet potato', 'butternut squash'],
    tomato: ['roasted red pepper', 'sun-dried tomato', 'bell pepper'],
    onion: ['shallot', 'leek', 'scallion'],
    mushroom: ['zucchini', 'eggplant', 'portobello'],
    pepper: ['bell pepper', 'poblano', 'banana pepper'],
    zucchini: ['yellow squash', 'cucumber', 'eggplant'],
    potato: ['sweet potato', 'turnip', 'parsnip'],
    celery: ['fennel', 'jicama', 'cucumber'],
    cucumber: ['zucchini', 'celery', 'jicama'],
    corn: ['peas', 'edamame', 'green beans'],
    garlic: ['shallot', 'leek', 'chives'],
    cabbage: ['brussels sprouts', 'bok choy', 'napa cabbage'],
  },
  Carb: {
    rice: ['quinoa', 'couscous', 'bulgur'],
    pasta: ['rice noodles', 'egg noodles', 'soba noodles'],
    bread: ['pita', 'naan', 'tortilla'],
    potato: ['sweet potato', 'yam', 'cauliflower'],
    oat: ['quinoa flakes', 'buckwheat', 'millet'],
    tortilla: ['pita', 'naan', 'flatbread'],
    noodle: ['rice noodles', 'glass noodles', 'zucchini noodles'],
    quinoa: ['brown rice', 'farro', 'barley'],
    couscous: ['quinoa', 'bulgur', 'orzo'],
  },
  Fruit: {
    apple: ['pear', 'peach', 'nectarine'],
    banana: ['plantain', 'mango', 'papaya'],
    strawberry: ['blueberry', 'raspberry', 'blackberry'],
    blueberry: ['raspberry', 'blackberry', 'strawberry'],
    orange: ['tangerine', 'clementine', 'grapefruit'],
    lemon: ['lime', 'yuzu', 'grapefruit'],
    mango: ['papaya', 'pineapple', 'peach'],
    pineapple: ['mango', 'papaya', 'kiwi'],
    grape: ['cherry', 'blueberry', 'fig'],
    peach: ['nectarine', 'apricot', 'plum'],
    cherry: ['grape', 'cranberry', 'pomegranate'],
  },
  'Nuts & Seeds': {
    almond: ['walnut', 'pecan', 'cashew'],
    walnut: ['pecan', 'almond', 'hazelnut'],
    peanut: ['cashew', 'almond', 'sunflower seed'],
    cashew: ['pistachio', 'macadamia', 'almond'],
    pecan: ['walnut', 'almond', 'hazelnut'],
    sesame: ['sunflower seed', 'flaxseed', 'chia seed'],
    chia: ['flaxseed', 'hemp seed', 'sesame seed'],
    pine: ['almond', 'cashew', 'pistachio'],
  },
  Oils: {
    olive: ['avocado oil', 'grapeseed oil', 'walnut oil'],
    avocado: ['olive oil', 'grapeseed oil', 'sunflower oil'],
    vegetable: ['canola oil', 'sunflower oil', 'corn oil'],
    coconut: ['vegetable oil', 'avocado oil', 'butter'],
    sesame: ['peanut oil', 'chili oil', 'avocado oil'],
    canola: ['vegetable oil', 'sunflower oil', 'corn oil'],
    butter: ['ghee', 'coconut oil', 'olive oil'],
  },
  'Broths & Stocks': {
    chicken: ['vegetable broth', 'beef broth', 'bone broth'],
    beef: ['chicken broth', 'mushroom broth', 'vegetable broth'],
    vegetable: ['chicken broth', 'mushroom broth', 'dashi'],
    bone: ['chicken stock', 'beef stock', 'vegetable stock'],
  },
  Alcohol: {
    wine: ['cooking sherry', 'sake', 'vermouth'],
    beer: ['ale', 'stout', 'lager'],
    bourbon: ['whiskey', 'brandy', 'rum'],
    rum: ['brandy', 'bourbon', 'cognac'],
    vodka: ['gin', 'white rum', 'sake'],
    sake: ['mirin', 'rice wine', 'dry sherry'],
  },
  'Baking & Thickeners': {
    sugar: ['granulated sugar', 'coconut sugar', 'raw sugar'],
    'brown sugar': ['granulated sugar', 'coconut sugar', 'muscovado sugar'],
    'powdered sugar': ['granulated sugar', 'caster sugar', 'confectioners sugar'],
    flour: ['whole wheat flour', 'almond flour', 'coconut flour'],
    'all-purpose': ['bread flour', 'cake flour', 'whole wheat flour'],
    'whole wheat': ['all-purpose flour', 'spelt flour', 'oat flour'],
    cornstarch: ['arrowroot powder', 'tapioca starch', 'potato starch'],
    'baking powder': ['baking soda', 'cream of tartar', 'self-rising flour'],
    'baking soda': ['baking powder', 'cream of tartar', 'potassium bicarbonate'],
    yeast: ['baking powder', 'sourdough starter', 'baking soda'],
    gelatin: ['agar agar', 'pectin', 'arrowroot'],
    cornmeal: ['polenta', 'grits', 'masa harina'],
  },
  'Beverages & Coffee': {
    juice: ['orange juice', 'lime juice', 'grapefruit juice'],
    'lemon juice': ['lime juice', 'orange juice', 'grapefruit juice'],
    'lime juice': ['lemon juice', 'orange juice', 'grapefruit juice'],
    'orange juice': ['grapefruit juice', 'pineapple juice', 'tangerine juice'],
    'apple juice': ['pear juice', 'grape juice', 'white grape juice'],
    coffee: ['espresso', 'chicory coffee', 'instant coffee'],
    espresso: ['strong coffee', 'instant espresso', 'chicory coffee'],
    tea: ['green tea', 'herbal tea', 'chamomile tea'],
    matcha: ['green tea powder', 'hojicha powder', 'moringa powder'],
    'coconut milk': ['almond milk', 'oat milk', 'soy milk'],
    'almond milk': ['oat milk', 'soy milk', 'coconut milk'],
    'oat milk': ['almond milk', 'soy milk', 'rice milk'],
    kombucha: ['kefir water', 'ginger beer', 'sparkling cider'],
  },
  'Chocolate & Sweets': {
    chocolate: ['dark chocolate', 'milk chocolate', 'white chocolate'],
    'dark chocolate': ['bittersweet chocolate', 'semi-sweet chocolate', 'cacao nibs'],
    'milk chocolate': ['dark chocolate', 'white chocolate', 'chocolate chips'],
    'white chocolate': ['milk chocolate', 'vanilla chips', 'cocoa butter'],
    cocoa: ['cacao powder', 'carob powder', 'dutch process cocoa'],
    marshmallow: ['meringue', 'nougat', 'marshmallow fluff'],
    caramel: ['butterscotch', 'dulce de leche', 'toffee'],
    'chocolate chip': ['cacao nibs', 'carob chips', 'butterscotch chips'],
  },
  'Pickled & Preserved': {
    pickle: ['cornichons', 'pickled onions', 'pickled peppers'],
    olive: ['capers', 'green olives', 'kalamata olives'],
    caper: ['green olives', 'pickled onions', 'cornichons'],
    kimchi: ['sauerkraut', 'pickled cabbage', 'curtido'],
    sauerkraut: ['kimchi', 'pickled cabbage', 'coleslaw'],
    'sun-dried': ['roasted peppers', 'dried tomatoes', 'preserved lemons'],
  },
  'Prepared Batters & Doughs': {
    pastry: ['phyllo dough', 'puff pastry sheets', 'crescent roll dough'],
    phyllo: ['puff pastry', 'spring roll wrappers', 'strudel dough'],
    'pie crust': ['tart shell', 'graham cracker crust', 'puff pastry'],
    'pizza dough': ['flatbread dough', 'naan dough', 'focaccia dough'],
    wrapper: ['wonton wrappers', 'spring roll wrappers', 'rice paper'],
    'crescent roll': ['puff pastry', 'biscuit dough', 'croissant dough'],
  },
};

const CATEGORY_FALLBACK_QUERIES: Record<IngredientCategory, string[]> = {
  Protein: ['protein meat alternatives', 'lean protein', 'protein source'],
  Carb: ['grains cereals', 'whole grains', 'starchy foods'],
  Seasonings: ['ground spices seasonings', 'dried herbs', 'spice blend'],
  Veggie: ['fresh vegetables', 'green vegetables', 'cooking vegetables'],
  'Sauces & Condiments': ['sauces condiments', 'cooking sauce', 'dipping sauce'],
  Dairy: ['dairy products', 'cheese varieties', 'milk products'],
  Fruit: ['fresh fruit', 'fruit varieties', 'seasonal fruit'],
  'Nuts & Seeds': ['nuts seeds', 'tree nuts', 'seed varieties'],
  'Chocolate & Sweets': ['chocolate varieties', 'sweet confections', 'cocoa cacao'],
  'Pickled & Preserved': ['pickled foods', 'preserved vegetables', 'fermented foods'],
  'Baking & Thickeners': ['sugar sweetener', 'baking flour', 'baking thickener'],
  'Broths & Stocks': ['broth stock', 'cooking broth', 'soup base'],
  Alcohol: ['cooking wine', 'spirits cooking', 'cooking alcohol'],
  Oils: ['cooking oils', 'oil varieties', 'healthy oils'],
  'Non-Food & Equipment': ['kitchen supplies', 'cooking equipment', 'kitchen tools'],
  'Prepared Batters & Doughs': ['pastry dough', 'prepared dough', 'baking dough'],
  'Beverages & Coffee': ['fruit juice', 'coffee espresso', 'tea varieties'],
};

export function getAlternativeSearchQueries(ingredientName: string, category: IngredientCategory): string[] {
  const normalized = ingredientName.toLowerCase().trim();
  const categoryMap = ALTERNATIVE_SEARCH_MAP[category];

  if (categoryMap) {
    for (const [key, queries] of Object.entries(categoryMap)) {
      if (normalized.includes(key)) {
        const filtered = queries.filter(q => !normalized.includes(q.toLowerCase()));
        if (filtered.length >= 2) return filtered.slice(0, 3);
      }
    }
  }

  const fallbacks = CATEGORY_FALLBACK_QUERIES[category];
  return fallbacks || ['food alternatives', 'cooking ingredient'];
}
