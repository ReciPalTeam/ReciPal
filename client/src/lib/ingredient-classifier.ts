export type IngredientCategory = 'Protein' | 'Carb' | 'Veggie' | 'Fruit' | 'Other';

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

const VEGGIE_KEYWORDS = [
  'spinach', 'kale', 'lettuce', 'arugula', 'romaine', 'cabbage', 'chard', 'collard', 'bok choy',
  'broccoli', 'cauliflower', 'brussels sprout',
  'carrot', 'carrots', 'celery', 'cucumber',
  'tomato', 'tomatoes', 'cherry tomato', 'sun-dried tomato',
  'onion', 'onions', 'shallot', 'leek', 'scallion', 'green onion', 'chive',
  'garlic', 'ginger',
  'pepper', 'peppers', 'bell pepper', 'jalapeno', 'serrano', 'poblano', 'habanero', 'cayenne',
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
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800';
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
    case 'Other':
    default:
      return { calories: 50, protein: 0, carbs: 2, fat: 5 };
  }
}
