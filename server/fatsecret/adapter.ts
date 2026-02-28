import type { Recipe } from '../../client/src/lib/mock-data';

const BREAKFAST_KEYWORDS = ['breakfast', 'pancake', 'waffle', 'omelette', 'omelet', 'scramble', 'egg', 'bacon', 'sausage', 'toast', 'cereal', 'oatmeal', 'muffin', 'bagel', 'smoothie', 'brunch', 'morning'];
const LUNCH_KEYWORDS = ['lunch', 'sandwich', 'wrap', 'salad', 'soup', 'midday'];
const SNACK_KEYWORDS = ['snack', 'appetizer', 'dip', 'bite', 'chip', 'cracker', 'popcorn', 'nut', 'trail mix', 'energy bar', 'protein bar'];
const DESSERT_KEYWORDS = ['dessert', 'cake', 'cookie', 'brownie', 'pie', 'ice cream', 'pudding', 'custard', 'tart', 'sweet', 'chocolate', 'candy', 'fudge'];

const MEXICAN_KEYWORDS = ['mexican', 'taco', 'burrito', 'enchilada', 'quesadilla', 'salsa', 'guacamole', 'fajita', 'tortilla', 'nacho', 'chimichanga', 'carnitas', 'pozole', 'tamale'];
const ASIAN_KEYWORDS = ['asian', 'chinese', 'japanese', 'korean', 'thai', 'vietnamese', 'stir fry', 'soy sauce', 'teriyaki', 'sushi', 'ramen', 'pho', 'pad thai', 'wonton', 'dim sum', 'tofu', 'sesame', 'ginger soy', 'miso'];
const ITALIAN_KEYWORDS = ['italian', 'pasta', 'spaghetti', 'lasagna', 'risotto', 'gnocchi', 'ravioli', 'pesto', 'marinara', 'parmesan', 'mozzarella', 'alfredo', 'bolognese', 'carbonara', 'pizza', 'bruschetta', 'tiramisu'];
const MEDITERRANEAN_KEYWORDS = ['mediterranean', 'greek', 'hummus', 'falafel', 'tzatziki', 'olive oil', 'feta', 'pita', 'gyro', 'shawarma', 'tabbouleh', 'couscous', 'lamb'];
const INDIAN_KEYWORDS = ['indian', 'curry', 'tikka', 'masala', 'naan', 'tandoori', 'biryani', 'samosa', 'paneer', 'dal', 'chapati', 'korma', 'vindaloo', 'turmeric', 'garam masala', 'cumin'];
const AMERICAN_KEYWORDS = ['american', 'burger', 'hot dog', 'bbq', 'barbecue', 'grill', 'steak', 'fried chicken', 'mac and cheese', 'meatloaf', 'cornbread', 'ribs'];
const SOUTHERN_KEYWORDS = ['southern', 'cajun', 'creole', 'gumbo', 'jambalaya', 'fried', 'biscuit', 'gravy', 'collard', 'grits', 'po boy', 'crawfish', 'hush puppies'];
const FRENCH_KEYWORDS = ['french', 'coq au vin', 'ratatouille', 'bouillabaisse', 'croissant', 'quiche', 'souffle', 'bourguignon', 'crepe', 'gratin', 'beurre'];
const CARIBBEAN_KEYWORDS = ['caribbean', 'jerk', 'plantain', 'island', 'jamaican', 'ackee', 'oxtail', 'callaloo', 'patties'];
const MIDDLE_EASTERN_KEYWORDS = ['middle eastern', 'shawarma', 'falafel', 'tahini', 'kebab', 'kibbeh', 'labneh', 'zaatar', 'pita'];
const AFRICAN_KEYWORDS = ['african', 'ethiopian', 'moroccan', 'nigerian', 'jollof', 'injera', 'tagine', 'suya', 'fufu'];
const LATIN_AMERICAN_KEYWORDS = ['latin', 'brazilian', 'peruvian', 'cuban', 'colombian', 'venezuelan', 'empanada', 'arepa', 'ceviche', 'churrasco', 'feijoada'];

const DISH_TYPE_KW: Record<string, string[]> = {
  "Pasta": ["pasta", "spaghetti", "penne", "linguine", "fettuccine", "macaroni", "lasagna", "carbonara", "bolognese", "alfredo"],
  "Soup": ["soup", "broth", "bisque", "chowder", "minestrone", "pho"],
  "Salad": ["salad", "slaw"],
  "Stew": ["stew", "goulash", "tagine", "bourguignon"],
  "Curry": ["curry", "tikka masala", "korma", "vindaloo"],
  "Stir-Fry": ["stir fry", "stir-fry", "stirfry"],
  "Pizza": ["pizza"],
  "Burger": ["burger", "hamburger", "cheeseburger"],
  "Sandwich": ["sandwich", "panini"],
  "Tacos/Wraps": ["taco", "burrito", "wrap", "quesadilla", "enchilada", "fajita"],
  "Sushi/Rolls": ["sushi", "maki", "nigiri"],
  "Rice Dish": ["rice", "risotto", "biryani", "paella", "pilaf"],
  "Fried Rice": ["fried rice"],
  "Noodles": ["noodle", "ramen", "udon", "soba", "pad thai", "lo mein"],
  "Grilled Meat": ["grilled chicken", "grilled steak", "grilled pork", "bbq", "barbecue"],
  "Steak": ["steak", "ribeye", "sirloin"],
  "Roast": ["roast", "roasted"],
  "Seafood": ["shrimp", "salmon", "tuna", "cod", "tilapia", "crab", "lobster", "fish"],
  "Casserole": ["casserole"],
  "Skillet": ["skillet"],
  "Cake": ["cake", "cheesecake"],
  "Cookies": ["cookie", "cookies"],
  "Pie/Tart": ["pie", "tart"],
  "Muffins": ["muffin"],
  "Bread": ["bread", "loaf", "baguette"],
  "Pancakes/Crepes": ["pancake", "crepe", "waffle"],
  "Smoothie/Bowl": ["smoothie", "bowl"],
  "Eggs": ["egg", "omelette", "omelet", "frittata", "scramble"],
  "Dumplings": ["dumpling", "gyoza", "wonton"],
  "Kebab": ["kebab", "skewer", "satay"],
  "Meatballs": ["meatball"],
  "Appetizer": ["appetizer"],
  "Snack/Appetizer": ["snack", "dip", "hummus", "guacamole"],
  "Dip/Spread": ["dip", "spread", "salsa", "pesto"],
  "Drink": ["drink", "cocktail", "juice", "lemonade"],
  "Porridge": ["porridge", "oatmeal"],
  "Quiche": ["quiche"],
  "Flatbread": ["flatbread", "naan", "pita"],
  "Toast": ["toast"],
  "Biscuits": ["biscuit"],
  "Frozen Dessert": ["ice cream", "sorbet", "gelato"],
  "Custard/Pudding": ["custard", "pudding", "mousse"],
  "Side Dish": ["side dish"],
};

function classifyDishType(text: string): string {
  const lower = text.toLowerCase();
  for (const [dt, kws] of Object.entries(DISH_TYPE_KW)) {
    if (kws.some(k => lower.includes(k))) return dt;
  }
  return "Other";
}

function classifyMealTypes(text: string): string[] {
  const lower = text.toLowerCase();
  const types: string[] = [];

  if (BREAKFAST_KEYWORDS.some(k => lower.includes(k))) types.push('Breakfast');
  if (LUNCH_KEYWORDS.some(k => lower.includes(k))) types.push('Lunch');
  if (SNACK_KEYWORDS.some(k => lower.includes(k))) types.push('Snack');
  if (DESSERT_KEYWORDS.some(k => lower.includes(k))) types.push('Dessert');

  if (types.length === 0) {
    types.push('Dinner');
  }

  return types;
}

function classifyCookingStyle(text: string): string {
  const lower = text.toLowerCase();

  if (MEXICAN_KEYWORDS.some(k => lower.includes(k))) return 'Mexican';
  if (ASIAN_KEYWORDS.some(k => lower.includes(k))) return 'Asian';
  if (ITALIAN_KEYWORDS.some(k => lower.includes(k))) return 'Italian';
  if (MEDITERRANEAN_KEYWORDS.some(k => lower.includes(k))) return 'Mediterranean';
  if (INDIAN_KEYWORDS.some(k => lower.includes(k))) return 'Indian';
  if (SOUTHERN_KEYWORDS.some(k => lower.includes(k))) return 'Southern / Comfort Food';
  if (AMERICAN_KEYWORDS.some(k => lower.includes(k))) return 'American';
  if (FRENCH_KEYWORDS.some(k => lower.includes(k))) return 'French';
  if (CARIBBEAN_KEYWORDS.some(k => lower.includes(k))) return 'Caribbean';
  if (MIDDLE_EASTERN_KEYWORDS.some(k => lower.includes(k))) return 'Middle Eastern';
  if (AFRICAN_KEYWORDS.some(k => lower.includes(k))) return 'African';
  if (LATIN_AMERICAN_KEYWORDS.some(k => lower.includes(k))) return 'Latin American';

  return 'American';
}

function extractImageUrl(fsRecipe: any): string {
  if (fsRecipe.recipe_images?.recipe_image) {
    const images = fsRecipe.recipe_images.recipe_image;
    if (Array.isArray(images) && images.length > 0) {
      return images[0] || '';
    }
    if (typeof images === 'string') {
      return images;
    }
  }
  if (fsRecipe.recipe_image) {
    return fsRecipe.recipe_image;
  }
  return '';
}

function parseIngredients(fsRecipe: any): { name: string; amount: string; unit: string }[] {
  const ingredients: { name: string; amount: string; unit: string }[] = [];
  
  if (fsRecipe.ingredients?.ingredient) {
    const ingList = Array.isArray(fsRecipe.ingredients.ingredient) 
      ? fsRecipe.ingredients.ingredient 
      : [fsRecipe.ingredients.ingredient];
    
    for (const ing of ingList) {
      ingredients.push({
        name: ing.food_name || ing.ingredient_description || 'Unknown ingredient',
        amount: String(ing.number_of_units ?? ing.quantity ?? '1'),
        unit: ing.measurement_description || ing.unit || '',
      });
    }
  }

  return ingredients;
}

function parseSteps(fsRecipe: any): string[] {
  const steps: string[] = [];
  
  if (fsRecipe.directions?.direction) {
    const dirList = Array.isArray(fsRecipe.directions.direction)
      ? fsRecipe.directions.direction
      : [fsRecipe.directions.direction];
    
    const sorted = dirList.sort((a: any, b: any) => 
      (a.direction_number || 0) - (b.direction_number || 0)
    );
    
    for (const dir of sorted) {
      if (dir.direction_description) {
        steps.push(dir.direction_description);
      }
    }
  }

  return steps;
}

function parseNutrition(fsRecipe: any): { calories: number; protein: number; carbs: number; fat: number } {
  const servings = Number(fsRecipe.number_of_servings) || 1;
  
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  if (fsRecipe.serving_sizes?.serving) {
    const servingData = Array.isArray(fsRecipe.serving_sizes.serving)
      ? fsRecipe.serving_sizes.serving[0]
      : fsRecipe.serving_sizes.serving;
    
    if (servingData) {
      totalCalories = parseFloat(servingData.calories) || 0;
      totalProtein = parseFloat(servingData.protein) || 0;
      totalCarbs = parseFloat(servingData.carbohydrate) || 0;
      totalFat = parseFloat(servingData.fat) || 0;
    }
  }

  return {
    calories: Math.round(totalCalories),
    protein: Math.round(totalProtein),
    carbs: Math.round(totalCarbs),
    fat: Math.round(totalFat),
  };
}

export function fatsecretRecipeToCanonical(fsRecipe: any): Recipe {
  const recipe = fsRecipe.recipe || fsRecipe;
  
  const servings = Number(recipe.number_of_servings) || 1;
  const prepTime = Number(recipe.preparation_time_min) || 0;
  const cookTime = Number(recipe.cooking_time_min) || 0;
  const totalTime = prepTime + cookTime;

  const title = recipe.recipe_name || 'Untitled Recipe';
  const description = recipe.recipe_description || '';
  const ingredients = parseIngredients(recipe);
  
  const classificationText = [
    title,
    description,
    ...ingredients.map(i => i.name)
  ].join(' ');

  const nutrition = parseNutrition(recipe);

  const cookingStyle = classifyCookingStyle(classificationText);

  return {
    id: String(recipe.recipe_id),
    title,
    image: extractImageUrl(recipe),
    cuisine: cookingStyle,
    sub_category: null,
    dish_type: classifyDishType(classificationText),
    prepTime: prepTime > 0 ? `${prepTime} min` : '—',
    cookTime: cookTime > 0 ? `${cookTime} min` : '—',
    totalTime: totalTime > 0 ? `${totalTime} min` : '—',
    servings,
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    mealTypes: classifyMealTypes(classificationText),
    cookingStyle,
    ingredients,
    steps: parseSteps(recipe),
  };
}
