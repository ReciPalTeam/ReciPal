import type { IngredientCategory } from './ingredient-categories';
export type { IngredientCategory } from './ingredient-categories';
export { INGREDIENT_CATEGORIES } from './ingredient-categories';

const NON_FOOD_KEYWORDS = [
  'skewer', 'parchment', 'twine', 'wood chip', 'charcoal', 'toothpick',
  'ice cube', 'banana leaf', 'foil', 'aluminum foil', 'plastic wrap',
  'cheesecloth', 'kitchen string', 'wax paper', 'paper towel',
];

const ALCOHOL_KEYWORDS = [
  'beer', 'wine', 'red wine', 'white wine', 'bourbon', 'whiskey', 'whisky',
  'rum', 'vodka', 'brandy', 'cognac', 'sake', 'sherry', 'liqueur',
  'pisco', 'kahlua', 'amaretto', 'mirin', 'champagne', 'port', 'vermouth',
  'tequila', 'absinthe', 'mezcal', 'grappa', 'kirsch',
];

const BROTHS_STOCKS_KEYWORDS = [
  'broth', 'stock', 'bouillon', 'dashi', 'bone broth',
];

const BAKING_THICKENERS_KEYWORDS = [
  'cornstarch', 'gelatin', 'baking powder', 'baking soda',
  'starch', 'pudding mix', 'cake mix', 'food coloring',
  'cream of tartar', 'yeast', 'flour', 'all-purpose flour',
  'whole wheat flour', 'bread flour', 'self-rising flour', 'cake flour',
  'cornmeal', 'arrowroot', 'tapioca', 'pectin', 'xanthan',
  'baking mix', 'baking cocoa',
  'sugar', 'brown sugar', 'light brown sugar', 'dark brown sugar',
  'powdered sugar', 'granulated sugar', 'caster sugar', 'demerara',
  'turbinado', 'raw sugar', 'cane sugar', 'coconut sugar', 'palm sugar',
  'muscovado', 'superfine sugar', 'confectioner',
];

const SAUCES_CONDIMENTS_KEYWORDS = [
  'sauce', 'dressing', 'ketchup', 'mustard', 'mayo', 'mayonnaise',
  'salsa', 'pesto', 'gravy', 'paste', 'syrup', 'honey',
  'jam', 'jelly', 'marmalade', 'marinade', 'glaze', 'chutney', 'relish',
  'hummus', 'tahini', 'miso', 'vinegar', 'balsamic',
  'soy sauce', 'tamari', 'fish sauce', 'worcestershire',
  'hot sauce', 'sriracha', 'tabasco', 'ranch', 'caesar',
  'bbq', 'barbecue', 'teriyaki', 'hoisin', 'aioli',
  'guacamole', 'tzatziki', 'chimichurri', 'molasses', 'agave',
  'maple syrup', 'ponzu', 'sambal', 'gochujang', 'harissa',
  'dijon', 'remoulade', 'chili garlic',
];

const DAIRY_KEYWORDS = [
  'butter', 'unsalted butter', 'salted butter', 'clarified butter', 'ghee',
  'milk', 'whole milk', 'skim milk', 'low-fat milk', '2% milk',
  'cream', 'heavy cream', 'whipping cream', 'half and half', 'half-and-half',
  'sour cream', 'creme fraiche', 'crème fraîche',
  'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'gouda', 'brie',
  'cream cheese', 'ricotta', 'mascarpone', 'goat cheese', 'blue cheese',
  'yogurt', 'plain yogurt', 'vanilla yogurt',
  'buttermilk', 'kefir', 'condensed milk', 'evaporated milk',
];

const OILS_KEYWORDS = [
  'oil', 'olive oil', 'extra virgin olive oil', 'evoo',
  'avocado oil', 'vegetable oil', 'canola oil', 'coconut oil',
  'sesame oil', 'peanut oil', 'sunflower oil', 'safflower oil',
  'grapeseed oil', 'corn oil', 'soybean oil', 'walnut oil',
  'flaxseed oil', 'hemp oil', 'macadamia oil', 'almond oil',
  'truffle oil', 'chili oil', 'garlic oil', 'infused oil',
  'cooking spray', 'nonstick spray', 'pan spray',
  'shortening', 'lard', 'duck fat', 'bacon fat', 'schmaltz',
];

const NUTS_SEEDS_COMPOUND_KEYWORDS = [
  'peanut butter', 'almond butter', 'cashew butter', 'sunflower butter', 'nut butter',
  'coconut flake', 'shredded coconut', 'desiccated coconut',
  'trail mix', 'mixed nuts',
  'pine nut', 'brazil nut',
];

const NUTS_SEEDS_KEYWORDS = [
  'almond', 'walnut', 'pecan', 'cashew', 'peanut', 'pistachio',
  'hazelnut', 'macadamia', 'chestnut',
  'sesame seed', 'chia seed', 'sunflower seed', 'pumpkin seed',
  'flaxseed', 'hemp seed',
];

const CHOCOLATE_SWEETS_KEYWORDS = [
  'chocolate', 'cocoa', 'cacao', 'candy', 'marshmallow', 'sprinkles',
  'marzipan', 'cookie', 'wafer', 'caramel', 'ube', 'red bean paste',
  'fudge', 'ganache', 'brownie', 'toffee', 'nougat', 'praline',
  'chocolate chip', 'white chocolate', 'dark chocolate', 'milk chocolate',
];

const PICKLED_PRESERVED_KEYWORDS = [
  'pickle', 'olive', 'caper', 'kimchi', 'sauerkraut',
  'pickled', 'preserved', 'sun-dried', 'sundried',
  'anchovy paste', 'cornichon', 'giardiniera',
];

const BEVERAGES_COFFEE_KEYWORDS = [
  'coffee', 'espresso', 'tea leaves', 'matcha', 'juice',
  'coquito', 'latte', 'cappuccino', 'hot chocolate mix',
  'coconut milk', 'almond milk', 'oat milk', 'soy milk',
  'rice milk', 'coconut water', 'kombucha', 'coca cola',
  'green tea', 'black tea', 'herbal tea', 'iced tea', 'chai tea',
];

const PREPARED_BATTERS_KEYWORDS = [
  'puff pastry', 'phyllo', 'pie crust', 'pizza dough',
  'pastry sheet', 'casing', 'corn husk', 'crescent roll',
  'biscuit dough', 'wonton wrapper', 'egg roll wrapper',
  'pastry dough', 'filo', 'shortcrust',
];

const SEASONINGS_KEYWORDS = [
  'garlic powder', 'onion powder', 'chili powder', 'curry powder', 'ginger powder',
  'ground cumin', 'ground coriander', 'ground ginger', 'ground cinnamon', 'ground nutmeg',
  'ground cloves', 'ground allspice', 'ground cardamom', 'ground turmeric',
  'salt', 'sea salt', 'kosher salt', 'himalayan salt', 'table salt', 'rock salt',
  'fleur de sel', 'flaky salt', 'finishing salt',
  'black pepper', 'white pepper', 'ground pepper', 'cracked pepper',
  'peppercorn', 'peppercorns', 'pepper flakes', 'red pepper flakes', 'crushed red pepper',
  'paprika', 'smoked paprika', 'sweet paprika', 'hot paprika',
  'cumin', 'coriander', 'turmeric', 'saffron', 'sumac',
  'cinnamon', 'nutmeg', 'cloves', 'allspice', 'cardamom', 'star anise',
  'cayenne', 'chili flakes', 'chipotle powder',
  'mustard seed', 'celery seed', 'caraway seed', 'fennel seed', 'poppy seed',
  'oregano', 'basil', 'thyme', 'rosemary', 'sage', 'marjoram', 'tarragon',
  'dill', 'parsley', 'cilantro', 'bay leaf', 'bay leaves',
  'italian seasoning', 'herbs de provence', 'herbes de provence',
  'seasoning', 'spice', 'spices', 'spice blend', 'spice mix',
  'taco seasoning', 'cajun seasoning', 'creole seasoning', 'old bay',
  'garam masala', 'curry', 'ras el hanout', 'za\'atar', 'zaatar',
  'five spice', 'chinese five spice', 'everything bagel seasoning',
  'lemon pepper', 'garlic salt', 'onion salt', 'seasoned salt',
  'vanilla extract', 'almond extract', 'peppermint extract',
];

const PROTEIN_KEYWORDS = [
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'veal',
  'salmon', 'tuna', 'shrimp', 'fish', 'cod', 'tilapia', 'halibut', 'trout', 'bass', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'anchovy', 'sardine', 'mackerel',
  'egg', 'eggs',
  'tofu', 'tempeh', 'seitan', 'edamame',
  'beans', 'lentils', 'chickpeas', 'black beans', 'kidney beans', 'pinto beans', 'navy beans', 'cannellini',
  'greek yogurt', 'cottage cheese',
  'protein powder', 'whey', 'casein',
  'bacon', 'ham', 'sausage', 'prosciutto', 'pancetta',
  'steak', 'ground beef', 'ground turkey', 'ground chicken', 'meatball',
  'breast', 'thigh', 'wing', 'drumstick',
];

const CARB_KEYWORDS = [
  'bread', 'toast', 'baguette', 'ciabatta', 'sourdough', 'pita', 'naan', 'focaccia',
  'rice', 'brown rice', 'white rice', 'basmati', 'jasmine', 'wild rice', 'arborio',
  'pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'macaroni', 'rigatoni', 'fusilli', 'orzo', 'lasagna', 'noodle', 'ramen', 'udon', 'soba',
  'potato', 'potatoes', 'sweet potato', 'yam', 'fries', 'mashed',
  'oats', 'oatmeal', 'granola', 'cereal',
  'tortilla', 'wrap', 'taco shell', 'corn tortilla', 'flour tortilla',
  'quinoa', 'couscous', 'bulgur', 'farro', 'barley', 'millet',
  'crackers', 'chips', 'pretzels',
  'bagel', 'croissant', 'muffin', 'biscuit', 'roll', 'bun',
  'pancake', 'waffle', 'french toast',
  'pizza dough', 'crust',
];

const VEGGIE_KEYWORDS = [
  'spinach', 'kale', 'lettuce', 'arugula', 'romaine', 'cabbage', 'chard', 'collard', 'bok choy',
  'broccoli', 'cauliflower', 'brussels sprout',
  'carrot', 'carrots', 'celery', 'cucumber',
  'tomato', 'tomatoes', 'cherry tomato',
  'onion', 'onions', 'shallot', 'leek', 'scallion', 'green onion', 'chive',
  'garlic', 'ginger',
  'pepper', 'peppers', 'bell pepper', 'jalapeno', 'serrano', 'poblano', 'habanero',
  'mushroom', 'mushrooms', 'portobello', 'cremini', 'shiitake', 'oyster mushroom',
  'zucchini', 'squash', 'butternut', 'acorn squash', 'spaghetti squash', 'pumpkin',
  'eggplant', 'aubergine',
  'asparagus', 'artichoke',
  'corn', 'peas', 'green beans', 'snap peas', 'snow peas',
  'beet', 'beets', 'radish', 'turnip', 'parsnip', 'rutabaga',
  'avocado',
  'fennel', 'endive', 'radicchio',
  'watercress', 'microgreens', 'sprouts',
];

const FRUIT_KEYWORDS = [
  'apple', 'apples', 'banana', 'bananas', 'orange', 'oranges',
  'strawberry', 'strawberries', 'blueberry', 'blueberries', 'raspberry', 'raspberries', 'blackberry', 'blackberries', 'cranberry', 'cranberries',
  'grape', 'grapes', 'raisin', 'raisins',
  'mango', 'mangoes', 'papaya', 'pineapple', 'coconut',
  'peach', 'peaches', 'nectarine', 'plum', 'plums', 'apricot', 'cherry', 'cherries',
  'melon', 'watermelon', 'cantaloupe', 'honeydew',
  'kiwi', 'fig', 'figs', 'date', 'dates', 'prune', 'prunes',
  'lemon', 'lime', 'grapefruit', 'tangerine', 'clementine', 'citrus',
  'pear', 'pears', 'pomegranate',
  'passion fruit', 'dragon fruit', 'lychee', 'guava', 'starfruit',
  'mixed berries', 'fruit salad', 'fruit mix',
];

export function classifyIngredient(ingredientName: string): IngredientCategory {
  const normalized = ingredientName.toLowerCase().trim();

  for (const keyword of NON_FOOD_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Non-Food & Equipment';
  }

  for (const keyword of BROTHS_STOCKS_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Broths & Stocks';
  }

  const sugarSnapExclusions = ['sugar snap', 'sugar pea'];
  for (const keyword of BAKING_THICKENERS_KEYWORDS) {
    if (normalized.includes(keyword)) {
      if (keyword === 'sugar' && sugarSnapExclusions.some(ex => normalized.includes(ex))) continue;
      return 'Baking & Thickeners';
    }
  }

  for (const keyword of BEVERAGES_COFFEE_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Beverages & Coffee';
  }

  for (const keyword of NUTS_SEEDS_COMPOUND_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Nuts & Seeds';
  }

  for (const keyword of PREPARED_BATTERS_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Prepared Batters & Doughs';
  }

  for (const keyword of DAIRY_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Dairy';
  }

  for (const keyword of OILS_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Oils';
  }

  for (const keyword of SEASONINGS_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Seasonings';
  }

  for (const keyword of SAUCES_CONDIMENTS_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Sauces & Condiments';
  }

  for (const keyword of NUTS_SEEDS_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Nuts & Seeds';
  }

  for (const keyword of ALCOHOL_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Alcohol';
  }

  for (const keyword of CHOCOLATE_SWEETS_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Chocolate & Sweets';
  }

  for (const keyword of PICKLED_PRESERVED_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Pickled & Preserved';
  }

  for (const keyword of PROTEIN_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Protein';
  }

  for (const keyword of CARB_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Carb';
  }

  for (const keyword of VEGGIE_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Veggie';
  }

  for (const keyword of FRUIT_KEYWORDS) {
    if (normalized.includes(keyword)) return 'Fruit';
  }

  return 'Seasonings';
}

export function getCategoryColor(category: IngredientCategory): string {
  switch (category) {
    case 'Protein':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    case 'Carb':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
    case 'Veggie':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    case 'Fruit':
      return 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800';
    case 'Dairy':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
    case 'Seasonings':
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800';
    case 'Oils':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
    case 'Sauces & Condiments':
      return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
    case 'Nuts & Seeds':
      return 'bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-900/20 dark:text-lime-400 dark:border-lime-800';
    case 'Chocolate & Sweets':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800';
    case 'Pickled & Preserved':
      return 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800';
    case 'Baking & Thickeners':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800';
    case 'Broths & Stocks':
      return 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800';
    case 'Alcohol':
      return 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800';
    case 'Non-Food & Equipment':
      return 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-900/20 dark:text-neutral-400 dark:border-neutral-800';
    case 'Prepared Batters & Doughs':
      return 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/20 dark:text-stone-400 dark:border-stone-800';
    case 'Beverages & Coffee':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
    default:
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800';
  }
}

export function getIngredientNutritionEstimate(ingredientName: string): { calories: number; protein: number; carbs: number; fat: number } {
  const category = classifyIngredient(ingredientName);

  switch (category) {
    case 'Protein':
      return { calories: 150, protein: 25, carbs: 2, fat: 5 };
    case 'Carb':
      return { calories: 200, protein: 4, carbs: 40, fat: 2 };
    case 'Veggie':
      return { calories: 30, protein: 2, carbs: 6, fat: 0 };
    case 'Fruit':
      return { calories: 60, protein: 1, carbs: 15, fat: 0 };
    case 'Dairy':
      return { calories: 100, protein: 5, carbs: 5, fat: 7 };
    case 'Seasonings':
      return { calories: 5, protein: 0, carbs: 1, fat: 0 };
    case 'Oils':
      return { calories: 120, protein: 0, carbs: 0, fat: 14 };
    case 'Sauces & Condiments':
      return { calories: 30, protein: 0, carbs: 7, fat: 0 };
    case 'Nuts & Seeds':
      return { calories: 170, protein: 6, carbs: 6, fat: 15 };
    case 'Chocolate & Sweets':
      return { calories: 150, protein: 2, carbs: 20, fat: 8 };
    case 'Pickled & Preserved':
      return { calories: 15, protein: 0, carbs: 3, fat: 0 };
    case 'Baking & Thickeners':
      return { calories: 30, protein: 1, carbs: 7, fat: 0 };
    case 'Broths & Stocks':
      return { calories: 10, protein: 1, carbs: 1, fat: 0 };
    case 'Alcohol':
      return { calories: 100, protein: 0, carbs: 4, fat: 0 };
    case 'Non-Food & Equipment':
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    case 'Prepared Batters & Doughs':
      return { calories: 180, protein: 3, carbs: 24, fat: 8 };
    case 'Beverages & Coffee':
      return { calories: 5, protein: 0, carbs: 1, fat: 0 };
    default:
      return { calories: 5, protein: 0, carbs: 1, fat: 0 };
  }
}
