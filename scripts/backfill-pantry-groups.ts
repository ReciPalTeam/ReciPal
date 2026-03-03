import { createClient } from '@supabase/supabase-js';

const INGREDIENT_CATEGORIES = [
  "Protein", "Carb", "Seasonings", "Veggie", "Sauces & Condiments",
  "Dairy", "Fruit", "Nuts & Seeds", "Chocolate & Sweets",
  "Pickled & Preserved", "Baking & Thickeners", "Broths & Stocks",
  "Alcohol", "Oils", "Non-Food & Equipment", "Prepared Batters & Doughs",
  "Beverages & Coffee",
] as const;

type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

type PantryFoodGroup =
  | "Produce" | "Meat & Seafood" | "Dairy & Eggs" | "Bread & Bakery"
  | "Pasta, Rice & Grains" | "Canned & Jarred" | "Spices & Seasonings"
  | "Oils, Sauces & Condiments" | "Baking & Sweets" | "Frozen"
  | "Prepared Foods & Deli" | "Snacks & Nuts" | "Beverages & Alcohol" | "Non-Food";

const NON_FOOD_KEYWORDS = ['skewer', 'parchment', 'twine', 'wood chip', 'charcoal', 'toothpick', 'ice cube', 'banana leaf', 'foil', 'plastic wrap', 'cheesecloth', 'kitchen string'];
const BROTHS_STOCKS_KEYWORDS = ['broth', 'stock', 'bouillon', 'dashi', 'bone broth'];
const BAKING_THICKENERS_KEYWORDS = ['cornstarch', 'gelatin', 'baking powder', 'baking soda', 'starch', 'pudding mix', 'cake mix', 'food coloring', 'cream of tartar', 'yeast', 'flour', 'cornmeal', 'arrowroot', 'tapioca', 'pectin', 'xanthan'];
const BEVERAGES_COFFEE_KEYWORDS = ['coffee', 'espresso', 'tea', 'matcha', 'cola', 'juice', 'coquito', 'latte', 'cappuccino', 'hot chocolate mix', 'coconut milk', 'almond milk', 'oat milk', 'soy milk'];
const NUTS_SEEDS_COMPOUND_KEYWORDS = ['peanut butter', 'almond butter', 'cashew butter', 'sunflower butter', 'hazelnut spread', 'tahini paste', 'sesame paste'];
const PREPARED_BATTERS_KEYWORDS = ['puff pastry', 'phyllo', 'pie crust', 'wonton wrapper', 'egg roll wrapper', 'pizza dough', 'pastry sheet', 'casing', 'corn husk', 'crescent roll', 'biscuit dough'];
const DAIRY_KEYWORDS = ['butter', 'cream', 'milk', 'cheese', 'yogurt', 'ghee', 'whey', 'casein', 'custard', 'eggnog', 'creme fraiche', 'sour cream', 'half and half', 'kefir', 'ricotta', 'mascarpone', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'brie', 'camembert', 'gouda', 'provolone', 'gruyere', 'cottage cheese', 'cream cheese'];
const OILS_KEYWORDS = ['oil', 'cooking spray'];
const SEASONINGS_KEYWORDS = ['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'nutmeg', 'clove', 'allspice', 'cardamom', 'coriander', 'turmeric', 'curry', 'chili powder', 'cayenne', 'garlic powder', 'onion powder', 'ginger powder', 'bay leaf', 'rosemary', 'sage', 'dill', 'basil', 'parsley', 'mint', 'tarragon', 'marjoram', 'fennel seed', 'celery seed', 'mustard seed', 'poppy seed', 'vanilla extract', 'almond extract', 'seasoning', 'spice', 'herb', 'saffron', 'sumac'];
const SAUCES_CONDIMENTS_KEYWORDS = ['sauce', 'dressing', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'salsa', 'pesto', 'gravy', 'paste', 'syrup', 'honey', 'jam', 'marinade', 'glaze', 'chutney', 'relish', 'hummus', 'tahini', 'miso', 'vinegar', 'soy sauce', 'tamari', 'fish sauce', 'worcestershire', 'hot sauce', 'sriracha', 'tabasco', 'barbecue', 'teriyaki', 'hoisin', 'aioli', 'molasses', 'agave', 'maple syrup'];
const NUTS_SEEDS_KEYWORDS = ['almond', 'walnut', 'pecan', 'cashew', 'peanut', 'pistachio', 'hazelnut', 'pine nut', 'sesame seed', 'chia seed', 'sunflower seed', 'coconut flake', 'shredded coconut', 'macadamia', 'trail mix', 'mixed nuts'];
const ALCOHOL_KEYWORDS = ['beer', 'wine', 'bourbon', 'whiskey', 'rum', 'vodka', 'brandy', 'cognac', 'sake', 'sherry', 'liqueur', 'mirin', 'champagne', 'port', 'vermouth', 'amaretto'];
const CHOCOLATE_SWEETS_KEYWORDS = ['chocolate', 'cocoa', 'candy', 'marshmallow', 'sprinkles', 'marzipan', 'cookie', 'wafer', 'caramel', 'fudge', 'ganache', 'brownie'];
const PICKLED_PRESERVED_KEYWORDS = ['pickle', 'olive', 'caper', 'kimchi', 'sauerkraut', 'pickled', 'preserved', 'sun-dried', 'sundried', 'anchovy paste'];
const PROTEIN_KEYWORDS = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'veal', 'bison', 'venison', 'rabbit', 'goat', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'halibut', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'squid', 'octopus', 'sardine', 'anchovy', 'mackerel', 'trout', 'mahi', 'swordfish', 'bacon', 'ham', 'sausage', 'steak', 'prosciutto', 'pancetta', 'pepperoni', 'salami', 'chorizo', 'tofu', 'tempeh', 'seitan', 'egg', 'greek yogurt', 'cottage cheese'];
const CARB_KEYWORDS = ['rice', 'pasta', 'bread', 'noodle', 'tortilla', 'oat', 'quinoa', 'barley', 'couscous', 'potato', 'sweet potato', 'yam', 'corn', 'bean', 'lentil', 'chickpea', 'spaghetti', 'penne', 'fettuccine', 'macaroni', 'orzo', 'ramen', 'udon', 'soba', 'pita', 'naan', 'bagel', 'muffin', 'biscuit', 'cracker', 'cereal', 'granola', 'pancake', 'waffle'];
const VEGGIE_KEYWORDS = ['lettuce', 'tomato', 'onion', 'garlic', 'pepper', 'broccoli', 'spinach', 'carrot', 'celery', 'mushroom', 'cucumber', 'zucchini', 'squash', 'kale', 'cabbage', 'cauliflower', 'asparagus', 'radish', 'beet', 'turnip', 'eggplant', 'artichoke', 'leek', 'scallion', 'shallot', 'green bean', 'pea', 'corn', 'avocado', 'bok choy', 'sprout'];
const FRUIT_KEYWORDS = ['apple', 'banana', 'orange', 'berry', 'grape', 'melon', 'peach', 'mango', 'pineapple', 'pear', 'plum', 'cherry', 'lemon', 'lime', 'grapefruit', 'kiwi', 'papaya', 'coconut', 'fig', 'date', 'pomegranate', 'watermelon', 'cantaloupe', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry', 'apricot', 'nectarine'];

function classifyIngredient(name: string): IngredientCategory {
  const n = name.toLowerCase().trim();
  if (NON_FOOD_KEYWORDS.some(k => n.includes(k))) return 'Non-Food & Equipment';
  if (BROTHS_STOCKS_KEYWORDS.some(k => n.includes(k))) return 'Broths & Stocks';
  if (BAKING_THICKENERS_KEYWORDS.some(k => n.includes(k))) return 'Baking & Thickeners';
  if (BEVERAGES_COFFEE_KEYWORDS.some(k => n.includes(k))) return 'Beverages & Coffee';
  if (NUTS_SEEDS_COMPOUND_KEYWORDS.some(k => n.includes(k))) return 'Nuts & Seeds';
  if (PREPARED_BATTERS_KEYWORDS.some(k => n.includes(k))) return 'Prepared Batters & Doughs';
  if (DAIRY_KEYWORDS.some(k => n.includes(k))) return 'Dairy';
  if (OILS_KEYWORDS.some(k => n.includes(k))) return 'Oils';
  if (SEASONINGS_KEYWORDS.some(k => n.includes(k))) return 'Seasonings';
  if (SAUCES_CONDIMENTS_KEYWORDS.some(k => n.includes(k))) return 'Sauces & Condiments';
  if (NUTS_SEEDS_KEYWORDS.some(k => n.includes(k))) return 'Nuts & Seeds';
  if (ALCOHOL_KEYWORDS.some(k => n.includes(k))) return 'Alcohol';
  if (CHOCOLATE_SWEETS_KEYWORDS.some(k => n.includes(k))) return 'Chocolate & Sweets';
  if (PICKLED_PRESERVED_KEYWORDS.some(k => n.includes(k))) return 'Pickled & Preserved';
  if (PROTEIN_KEYWORDS.some(k => n.includes(k))) return 'Protein';
  if (CARB_KEYWORDS.some(k => n.includes(k))) return 'Carb';
  if (VEGGIE_KEYWORDS.some(k => n.includes(k))) return 'Veggie';
  if (FRUIT_KEYWORDS.some(k => n.includes(k))) return 'Fruit';
  return 'Seasonings';
}

const CATEGORY_TO_PANTRY_GROUP: Record<string, PantryFoodGroup> = {
  "Seasonings": "Spices & Seasonings",
  "Veggie": "Produce",
  "Fruit": "Produce",
  "Dairy": "Dairy & Eggs",
  "Oils": "Oils, Sauces & Condiments",
  "Sauces & Condiments": "Oils, Sauces & Condiments",
  "Nuts & Seeds": "Snacks & Nuts",
  "Chocolate & Sweets": "Baking & Sweets",
  "Baking & Thickeners": "Baking & Sweets",
  "Pickled & Preserved": "Canned & Jarred",
  "Broths & Stocks": "Canned & Jarred",
  "Alcohol": "Beverages & Alcohol",
  "Beverages & Coffee": "Beverages & Alcohol",
  "Non-Food & Equipment": "Non-Food",
  "Prepared Batters & Doughs": "Bread & Bakery",
};

const PROTEIN_EGG_KEYWORDS = ['egg', 'eggs'];
const PROTEIN_PREPARED_KW = ['tofu', 'tempeh', 'seitan', 'paneer', 'beyond', 'impossible', 'plant-based', 'veggie burger', 'veggie patty', 'deli', 'lunch meat', 'hot dog', 'frankfurter', 'protein powder'];
const CARB_BREAD_KW = ['bread', 'tortilla', 'pita', 'naan', 'roti', 'bun', 'roll', 'bagel', 'croissant', 'biscuit', 'muffin', 'wrap', 'flatbread', 'focaccia', 'ciabatta', 'brioche', 'sourdough', 'cornbread', 'crouton', 'breadcrumb', 'panko', 'waffle', 'pancake mix', 'pizza dough', 'pie crust', 'taco shell', 'dumpling wrapper', 'wonton wrapper', 'spring roll wrapper', 'phyllo', 'puff pastry'];

function matchesWord(text: string, word: string): boolean {
  const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return pattern.test(text);
}

function getPantryGroup(ingredientName: string, category: IngredientCategory): PantryFoodGroup {
  const normalized = ingredientName.toLowerCase().trim();
  const frozenCategories = ['Veggie', 'Fruit', 'Prepared Batters & Doughs'];
  if (matchesWord(normalized, 'frozen') && frozenCategories.includes(category)) return 'Frozen';
  const directMapping = CATEGORY_TO_PANTRY_GROUP[category];
  if (directMapping) return directMapping;
  if (category === 'Protein') {
    for (const kw of PROTEIN_EGG_KEYWORDS) { if (matchesWord(normalized, kw)) return 'Dairy & Eggs'; }
    for (const kw of PROTEIN_PREPARED_KW) { if (normalized.includes(kw)) return 'Prepared Foods & Deli'; }
    return 'Meat & Seafood';
  }
  if (category === 'Carb') {
    for (const kw of CARB_BREAD_KW) { if (normalized.includes(kw)) return 'Bread & Bakery'; }
    return 'Pasta, Rice & Grains';
  }
  return 'Spices & Seasonings';
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('Adding pantry_group column if not exists...');
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS pantry_group TEXT;'
  }).single();
  if (alterError) {
    console.warn('Could not add column via RPC (may need manual ALTER TABLE):', alterError.message);
  }

  console.log('Fetching ingredients...');
  let allIngredients: { ingredient_id: number; canonical_name: string }[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('ingredients')
      .select('ingredient_id, canonical_name')
      .range(offset, offset + batchSize - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allIngredients = allIngredients.concat(data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`Found ${allIngredients.length} ingredients to process.`);

  const distribution: Record<string, number> = {};
  let processed = 0;
  let errors = 0;

  for (const ingredient of allIngredients) {
    const category = classifyIngredient(ingredient.canonical_name);
    const pantryGroup = getPantryGroup(ingredient.canonical_name, category);
    distribution[pantryGroup] = (distribution[pantryGroup] || 0) + 1;

    const { error: updateError } = await supabase
      .from('ingredients')
      .update({ pantry_group: pantryGroup })
      .eq('ingredient_id', ingredient.ingredient_id);

    processed++;
    if (updateError) {
      errors++;
      if (errors <= 5) console.error(`Error updating ${ingredient.canonical_name}:`, updateError.message);
    }

    if (processed % 100 === 0 || processed === allIngredients.length) {
      console.log(`[${processed}/${allIngredients.length}] '${ingredient.canonical_name}' (${category}) → ${pantryGroup}`);
    }
  }

  console.log('\n=== Distribution Summary ===');
  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  for (const [group, count] of sorted) {
    console.log(`  ${group}: ${count}`);
  }
  console.log(`\nTotal: ${processed} processed, ${errors} errors`);
}

main().catch(console.error);
