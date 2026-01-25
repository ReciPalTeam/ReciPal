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

  return 'Healthy / Light';
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

  return {
    id: String(recipe.recipe_id),
    title,
    image: extractImageUrl(recipe),
    cookTime: totalTime > 0 ? `${totalTime} min` : '—',
    servings,
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    mealTypes: classifyMealTypes(classificationText),
    cookingStyle: classifyCookingStyle(classificationText),
    ingredients,
    steps: parseSteps(recipe),
  };
}
