import type { FoodGroup } from './demo-store';
import { normalizeIngredientName } from './demo-store';

export interface UnitDef {
  min: number;
  step: number;
}

const UNIT_DEFS: Record<string, UnitDef> = {
  tsp: { min: 0.25, step: 0.25 },
  tbsp: { min: 0.5, step: 0.5 },
  cup: { min: 0.25, step: 0.25 },
  "fl oz": { min: 1, step: 1 },
  pint: { min: 0.5, step: 0.5 },
  quart: { min: 0.5, step: 0.5 },
  gallon: { min: 0.25, step: 0.25 },
  oz: { min: 1, step: 1 },
  lb: { min: 0.25, step: 0.25 },
  each: { min: 1, step: 1 },
  dozen: { min: 0.5, step: 0.5 },
  cloves: { min: 1, step: 1 },
  bunch: { min: 1, step: 1 },
  head: { min: 1, step: 1 },
  ear: { min: 1, step: 1 },
  slice: { min: 1, step: 1 },
  can: { min: 1, step: 1 },
  jar: { min: 1, step: 1 },
  bottle: { min: 1, step: 1 },
  bag: { min: 1, step: 1 },
  box: { min: 1, step: 1 },
  carton: { min: 1, step: 1 },
  container: { min: 1, step: 1 },
  package: { min: 1, step: 1 },
  loaf: { min: 1, step: 1 },
  stick: { min: 1, step: 1 },
  fillet: { min: 1, step: 1 },
  link: { min: 1, step: 1 },
  rack: { min: 1, step: 1 },
  block: { min: 1, step: 1 },
  tube: { min: 1, step: 1 },
};

const KEYWORD_UNIT_MAP: [string[], string][] = [
  [['condensed milk', 'evaporated milk', 'coconut milk', 'coconut cream'], 'can'],
  [['almond milk', 'oat milk', 'soy milk', 'rice milk', 'cashew milk'], 'carton'],
  [['buttermilk'], 'quart'],
  [['milk', 'half and half', 'heavy cream', 'whipping cream'], 'gallon'],
  [['eggplant'], 'each'],
  [['egg'], 'dozen'],
  [['olive oil', 'avocado oil', 'sesame oil', 'vegetable oil', 'canola oil', 'coconut oil', 'peanut oil', 'grapeseed oil', 'sunflower oil', 'truffle oil', 'corn oil'], 'bottle'],
  [['oil', 'vinegar', 'soy sauce', 'hot sauce', 'sriracha', 'worcestershire', 'fish sauce', 'ketchup', 'bbq sauce', 'teriyaki', 'hoisin', 'maple syrup', 'honey'], 'bottle'],
  [['cream cheese', 'ricotta', 'mascarpone'], 'block'],
  [['cheddar', 'mozzarella', 'parmesan', 'feta', 'gouda', 'swiss', 'provolone', 'gruyere', 'colby', 'monterey', 'pepper jack', 'brie', 'camembert', 'gorgonzola', 'halloumi', 'paneer', 'cheese'], 'block'],
  [['butter', 'margarine'], 'stick'],
  [['yogurt', 'sour cream', 'kefir'], 'container'],
  [['chicken', 'beef', 'pork', 'lamb', 'turkey', 'steak', 'ground meat', 'ground beef', 'ground turkey', 'ground pork', 'veal', 'bison', 'venison'], 'lb'],
  [['bacon', 'prosciutto', 'pancetta'], 'package'],
  [['sausage', 'chorizo', 'hot dog', 'bratwurst'], 'link'],
  [['salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout', 'catfish', 'mahi', 'fish', 'fillet'], 'fillet'],
  [['shrimp', 'scallop', 'crab', 'lobster', 'clam', 'mussel', 'oyster'], 'lb'],
  [['garlic powder', 'onion powder'], 'jar'],
  [['garlic'], 'head'],
  [['corn on the cob', 'corn cob', 'ear of corn'], 'ear'],
  [['banana', 'apple', 'orange', 'lemon', 'lime', 'avocado', 'peach', 'pear', 'mango', 'kiwi', 'plum', 'nectarine', 'onion', 'potato', 'sweet potato', 'tomato', 'cucumber', 'zucchini', 'bell pepper'], 'each'],
  [['cilantro', 'parsley', 'basil', 'dill', 'mint', 'green onion', 'scallion', 'chive', 'watercress', 'arugula'], 'bunch'],
  [['lettuce', 'cabbage', 'cauliflower', 'broccoli', 'celery'], 'head'],
  [['spinach', 'kale', 'mixed green', 'salad mix', 'berrie', 'berry', 'grape', 'cherry tomato'], 'bag'],
  [['bread', 'sourdough', 'brioche'], 'loaf'],
  [['tortilla', 'pita', 'naan', 'flatbread', 'english muffin', 'bagel', 'bun', 'roll'], 'package'],
  [['pasta', 'spaghetti', 'penne', 'rigatoni', 'fettuccine', 'linguine', 'macaroni', 'fusilli', 'rotini', 'farfalle', 'orzo', 'noodle', 'ramen', 'udon', 'rice noodle'], 'box'],
  [['rice', 'quinoa', 'oat', 'barley', 'couscous', 'bulgur', 'farro', 'millet', 'polenta', 'grits'], 'bag'],
  [['cereal', 'granola'], 'box'],
  [['canned', 'broth', 'stock', 'tomato paste', 'tomato sauce', 'crushed tomato', 'diced tomato', 'chickpea', 'black bean', 'kidney bean', 'pinto bean', 'lentil', 'refried bean'], 'can'],
  [['peanut butter', 'almond butter', 'nutella'], 'jar'],
  [['pickle', 'olive', 'caper', 'jam', 'jelly', 'preserve', 'marmalade', 'salsa', 'pesto'], 'jar'],
  [['mustard', 'mayo', 'mayonnaise'], 'jar'],
  [['flour', 'sugar', 'brown sugar', 'powdered sugar'], 'bag'],
  [['baking soda', 'baking powder', 'yeast', 'cornstarch'], 'container'],
  [['vanilla', 'extract', 'food coloring'], 'bottle'],
  [['chocolate chip', 'sprinkle'], 'bag'],
  [['cocoa powder', 'cacao'], 'container'],
  [['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'nutmeg', 'chili powder', 'cayenne', 'turmeric', 'curry', 'seasoning', 'spice'], 'jar'],
  [['chip', 'pretzel', 'popcorn', 'cracker', 'trail mix', 'dried fruit', 'jerky'], 'bag'],
  [['nut', 'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'peanut', 'mixed nut', 'seed', 'sunflower seed', 'pumpkin seed'], 'bag'],
  [['protein powder', 'whey protein', 'collagen'], 'container'],
  [['coffee', 'tea'], 'bag'],
  [['juice', 'soda', 'lemonade', 'iced tea', 'kombucha'], 'bottle'],
  [['beer', 'wine', 'liquor', 'bourbon', 'vodka', 'rum', 'whiskey'], 'bottle'],
  [['ice cream', 'gelato', 'sorbet'], 'container'],
  [['frozen pizza', 'frozen dinner', 'meal kit'], 'package'],
  [['frozen vegetable', 'frozen fruit', 'frozen berry', 'frozen pea', 'frozen corn', 'frozen spinach', 'frozen broccoli'], 'bag'],
  [['tofu', 'tempeh'], 'package'],
];

const FOOD_GROUP_FALLBACKS: Record<string, string> = {
  'Produce': 'each',
  'Meat & Seafood': 'lb',
  'Dairy & Eggs': 'each',
  'Bread & Bakery': 'loaf',
  'Pasta, Rice & Grains': 'box',
  'Canned & Jarred': 'can',
  'Spices & Seasonings': 'jar',
  'Oils, Sauces & Condiments': 'bottle',
  'Baking & Sweets': 'bag',
  'Frozen': 'bag',
  'Prepared Foods & Deli': 'package',
  'Snacks & Nuts': 'bag',
  'Beverages & Alcohol': 'bottle',
  'Non-Food': 'each',
};

const FOOD_GROUP_ALTERNATES: Record<string, string[]> = {
  'Produce': ['each', 'bunch', 'head', 'ear', 'lb', 'bag', 'container'],
  'Meat & Seafood': ['lb', 'oz', 'fillet', 'link', 'package', 'each'],
  'Dairy & Eggs': ['gallon', 'quart', 'pint', 'container', 'stick', 'dozen', 'block', 'oz', 'can', 'each'],
  'Bread & Bakery': ['loaf', 'package', 'each', 'bag'],
  'Pasta, Rice & Grains': ['box', 'bag', 'lb', 'oz', 'each'],
  'Canned & Jarred': ['can', 'jar', 'each'],
  'Spices & Seasonings': ['jar', 'container', 'bag', 'bottle', 'each'],
  'Oils, Sauces & Condiments': ['bottle', 'jar', 'can', 'tube', 'each'],
  'Baking & Sweets': ['bag', 'box', 'lb', 'bottle', 'container', 'each'],
  'Frozen': ['bag', 'box', 'package', 'container', 'each'],
  'Prepared Foods & Deli': ['package', 'container', 'lb', 'each'],
  'Snacks & Nuts': ['bag', 'box', 'jar', 'container', 'each'],
  'Beverages & Alcohol': ['bottle', 'can', 'carton', 'box', 'bag', 'each'],
  'Non-Food': ['each', 'package', 'box'],
};

export function getUnitDef(unit: string): UnitDef {
  return UNIT_DEFS[unit] || { min: 1, step: 1 };
}

export function getDefaultPantryUnit(name: string, foodGroup: string): { unit: string; step: number; min: number } {
  const normalized = normalizeIngredientName(name);
  for (const [keywords, unit] of KEYWORD_UNIT_MAP) {
    if (keywords.some(k => normalized.includes(k))) {
      const def = getUnitDef(unit);
      return { unit, step: def.step, min: def.min };
    }
  }
  const fallbackUnit = FOOD_GROUP_FALLBACKS[foodGroup] || 'each';
  const def = getUnitDef(fallbackUnit);
  return { unit: fallbackUnit, step: def.step, min: def.min };
}

export function getAlternateUnits(foodGroup: string): string[] {
  return FOOD_GROUP_ALTERNATES[foodGroup] || ['each'];
}
