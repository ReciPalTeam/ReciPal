export type IngredientCategory = 'Protein' | 'Carb' | 'Veggie' | 'Fruit' | 'Dairy' | 'Seasonings' | 'Oils' | 'Other';

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
  'sugar', 'honey', 'maple syrup', 'agave',
  'flour', 'cornmeal', 'cornstarch',
  'crackers', 'chips', 'pretzels',
  'bagel', 'croissant', 'muffin', 'biscuit', 'roll', 'bun',
  'pancake', 'waffle', 'french toast',
  'pizza dough', 'crust',
];

// IMPORTANT: Seasonings must be checked BEFORE Veggie to prevent 
// "garlic powder", "onion powder", "pepper" from matching veggie keywords
const SEASONINGS_KEYWORDS = [
  // Powders and ground spices (check these first - they're often misclassified)
  'garlic powder', 'onion powder', 'chili powder', 'curry powder', 'ginger powder',
  'ground cumin', 'ground coriander', 'ground ginger', 'ground cinnamon', 'ground nutmeg',
  'ground cloves', 'ground allspice', 'ground cardamom', 'ground turmeric',
  // Salt varieties
  'salt', 'sea salt', 'kosher salt', 'himalayan salt', 'table salt', 'rock salt',
  'fleur de sel', 'flaky salt', 'finishing salt',
  // Pepper varieties
  'black pepper', 'white pepper', 'ground pepper', 'cracked pepper',
  'peppercorn', 'peppercorns', 'pepper flakes', 'red pepper flakes', 'crushed red pepper',
  // Common spices
  'paprika', 'smoked paprika', 'sweet paprika', 'hot paprika',
  'cumin', 'coriander', 'turmeric', 'saffron', 'sumac',
  'cinnamon', 'nutmeg', 'cloves', 'allspice', 'cardamom', 'star anise',
  'cayenne', 'chili flakes', 'chipotle powder',
  'mustard seed', 'celery seed', 'caraway seed', 'fennel seed', 'poppy seed',
  // Dried herbs
  'oregano', 'basil', 'thyme', 'rosemary', 'sage', 'marjoram', 'tarragon',
  'dill', 'parsley', 'cilantro', 'bay leaf', 'bay leaves',
  'italian seasoning', 'herbs de provence', 'herbes de provence',
  // Spice blends
  'seasoning', 'spice', 'spices', 'spice blend', 'spice mix',
  'taco seasoning', 'cajun seasoning', 'creole seasoning', 'old bay',
  'garam masala', 'curry', 'ras el hanout', 'za\'atar', 'zaatar',
  'five spice', 'chinese five spice', 'everything bagel seasoning',
  'lemon pepper', 'garlic salt', 'onion salt', 'seasoned salt',
  // Extracts and flavorings
  'vanilla extract', 'almond extract', 'peppermint extract',
];

// IMPORTANT: Oils must be checked BEFORE Veggie to prevent 
// "avocado oil" from matching "avocado" in veggie keywords
const OILS_KEYWORDS = [
  // Cooking oils
  'oil', 'olive oil', 'extra virgin olive oil', 'evoo',
  'avocado oil', 'vegetable oil', 'canola oil', 'coconut oil',
  'sesame oil', 'peanut oil', 'sunflower oil', 'safflower oil',
  'grapeseed oil', 'corn oil', 'soybean oil', 'walnut oil',
  'flaxseed oil', 'hemp oil', 'macadamia oil', 'almond oil',
  'truffle oil', 'chili oil', 'garlic oil', 'infused oil',
  // Cooking sprays
  'cooking spray', 'nonstick spray', 'pan spray',
  // Shortening and lard
  'shortening', 'lard', 'duck fat', 'bacon fat', 'schmaltz',
];

// Dairy products including butter
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

const VEGGIE_KEYWORDS = [
  'spinach', 'kale', 'lettuce', 'arugula', 'romaine', 'cabbage', 'chard', 'collard', 'bok choy',
  'broccoli', 'cauliflower', 'brussels sprout',
  'carrot', 'carrots', 'celery', 'cucumber',
  'tomato', 'tomatoes', 'cherry tomato', 'sun-dried tomato',
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
  
  // IMPORTANT: Check Dairy FIRST to prevent "unsalted butter" -> Seasonings (due to "salt")
  // Dairy keywords like "butter" must match before "salt" in seasonings
  for (const keyword of DAIRY_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return 'Dairy';
    }
  }
  
  // IMPORTANT: Check Oils SECOND to prevent "avocado oil" -> Veggie
  // "oil" keyword must match before "avocado" in veggie
  for (const keyword of OILS_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return 'Oils';
    }
  }
  
  // Check Seasonings THIRD to prevent "garlic powder" -> Veggie
  // Seasonings keywords are more specific (e.g., "garlic powder" vs "garlic")
  for (const keyword of SEASONINGS_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return 'Seasonings';
    }
  }
  
  // Now check the original categories in order
  for (const keyword of PROTEIN_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return 'Protein';
    }
  }
  
  for (const keyword of CARB_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return 'Carb';
    }
  }
  
  for (const keyword of VEGGIE_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return 'Veggie';
    }
  }
  
  for (const keyword of FRUIT_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return 'Fruit';
    }
  }
  
  return 'Other';
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
    case 'Other':
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700';
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
    case 'Other':
    default:
      return { calories: 50, protein: 0, carbs: 2, fat: 5 };
  }
}
