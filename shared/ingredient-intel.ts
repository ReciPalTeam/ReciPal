/**
 * Canonical ingredient intelligence — the single source of truth for:
 *   - the 14-group pantry/grocery taxonomy (`PANTRY_FOOD_GROUPS`)
 *   - the name → food-group keyword classifier (`getIngredientFoodGroup`)
 *   - name normalization (`normalizeIngredientName`)
 *   - per-category default amounts for null/"to taste" ingredients (Phase H.9)
 *   - the seasoning set used for sub-linear scaling (Phase H.9)
 *
 * Imported by BOTH the client (recipe display, pantry, Instacart) and the server
 * (recipe read mapper, serving-scaling math) via `@shared/ingredient-intel`, so the
 * classification + defaulting logic can never drift between the two halves of the app.
 */

export const PANTRY_FOOD_GROUPS = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bread & Bakery",
  "Pasta, Rice & Grains",
  "Canned & Jarred",
  "Spices & Seasonings",
  "Oils, Sauces & Condiments",
  "Baking & Sweets",
  "Frozen",
  "Prepared Foods & Deli",
  "Snacks & Nuts",
  "Beverages & Alcohol",
  "Non-Food",
] as const;

export type PantryFoodGroup = typeof PANTRY_FOOD_GROUPS[number];
/** Alias used across the client codebase. */
export type FoodGroup = PantryFoodGroup;

/** Lowercase + singularize + de-hyphenate, for keyword matching and fuzzy compares. */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/s$/, "")
    .replace(/ies$/, "y")
    .replace(/es$/, "")
    .replace(/-/g, " ");
}

/**
 * Classify a raw ingredient name into one of the 14 pantry food groups via keyword match.
 * Order matters: more specific buckets (Non-Food, Prepared, Frozen) are checked before
 * broad ones. Falls back to "Spices & Seasonings" (the smallest-impact bucket) when nothing
 * matches. This is the same classifier the Instacart purchase-mapping relies on.
 */
export function getIngredientFoodGroup(name: string): FoodGroup {
  const normalized = normalizeIngredientName(name);

  const produceKeywords = [
    "lettuce", "tomato", "avocado", "onion", "garlic", "pepper", "broccoli", "spinach",
    "carrot", "celery", "mushroom", "lemon", "lime", "berry", "berrie", "banana", "apple", "orange",
    "cucumber", "zucchini", "squash", "potato", "green bean", "green onion", "basil", "cilantro", "parsley",
    "ginger", "peach", "mango", "pineapple", "grape", "melon", "watermelon", "cantaloupe",
    "kale", "arugula", "cabbage", "cauliflower", "asparagus", "fresh pea", "sugar pea", "radish",
    "beet", "turnip", "eggplant", "artichoke", "leek", "scallion", "shallot", "chive",
    "romaine", "iceberg", "chard", "collard", "endive", "fennel", "jalapen", "serrano",
    "habanero", "poblano", "bell", "sweet potato", "yam", "taro", "kiwi", "papaya",
    "plum", "nectarine", "apricot", "cherry", "pear", "fig", "date", "coconut",
    "pomegranate", "passion fruit", "starfruit", "dragonfruit", "lychee", "persimmon",
    "edamame", "sprout", "watercress", "bok choy", "snow pea", "snap pea", "bean sprout",
    "fresh herb", "mixed green", "salad mix", "salad kit",
  ];

  const meatKeywords = [
    "chicken", "beef", "pork", "turkey", "salmon", "fish", "shrimp", "tuna", "cod",
    "steak", "bacon", "sausage", "ground meat", "lamb", "veal", "duck", "goose",
    "tilapia", "halibut", "mahi", "trout", "catfish", "crab", "lobster", "scallop",
    "clam", "mussel", "oyster", "squid", "calamari", "octopus", "anchov", "sardine",
    "mackerel", "herring", "prosciutto", "pancetta", "chorizo", "pepperoni", "salami",
    "brisket", "rib", "tenderloin", "sirloin", "flank", "chuck", "wing", "thigh",
    "drumstick", "breast", "leg quarter", "mince", "cutlet", "chop", "roast",
    "filet", "loin", "venison", "bison", "rabbit", "quail", "pheasant",
  ];

  const preparedKeywords = [
    "rotisserie", "ready meal", "prepared", "pre made", "premade", "pre-made",
    "deli turkey", "deli chicken", "deli ham", "deli meat", "sliced turkey",
    "sliced ham", "lunch meat", "cold cut", "pastrami", "corned beef",
    "pre-cooked", "precooked", "ready to eat", "heat and serve", "meal kit",
    "takeout", "leftover", "pre-sliced", "pre-cut", "grab and go",
  ];

  const dairyKeywords = [
    "milk", "cheese", "yogurt", "butter", "cream", "egg", "mozzarella", "parmesan",
    "feta", "cottage", "ricotta", "brie", "camembert", "gouda", "cheddar", "swiss",
    "provolone", "gruyere", "blue cheese", "gorgonzola", "mascarpone", "queso",
    "sour cream", "creme fraiche", "half and half", "whipping cream", "heavy cream",
    "kefir", "buttermilk", "condensed milk", "evaporated milk", "whey", "curds",
    "ghee", "paneer", "halloumi", "colby", "monterey jack", "pepper jack",
    "cream cheese", "neufchatel", "custard", "eggnog",
  ];

  const breadKeywords = [
    "bread", "bagel", "roll", "bun", "croissant", "muffin", "tortilla", "pita",
    "naan", "focaccia", "ciabatta", "baguette", "sourdough", "brioche", "challah",
    "english muffin", "flatbread", "lavash", "roti", "chapati", "paratha",
    "pretzel bun", "hamburger bun", "hot dog bun", "dinner roll", "kaiser",
    "crescent roll", "biscuit", "scone", "cornbread", "pancake", "waffle",
    "crepe", "wrap", "taco shell", "puff pastry", "phyllo", "pie crust",
  ];

  const pastaGrainsKeywords = [
    "rice", "pasta", "oat", "quinoa", "noodle", "couscous", "barley", "grain", "cereal",
    "spaghetti", "penne", "rigatoni", "fettuccine", "linguine", "macaroni", "orzo",
    "fusilli", "rotini", "farfalle", "lasagna", "ravioli", "tortellini", "gnocchi",
    "ramen", "udon", "soba", "rice noodle", "vermicelli", "cellophane",
    "bulgur", "farro", "millet", "buckwheat", "polenta", "grits", "cornmeal",
    "wild rice", "jasmine rice", "basmati", "arborio", "sushi rice", "brown rice",
    "bread crumb", "panko", "crouton", "stuffing", "dry bean", "dried bean", "dry lentil", "dried lentil",
    "split pea", "pearl couscous", "wheat berrie", "amaranth", "teff", "spelt",
    "white rice", "long grain", "short grain", "instant rice",
  ];

  const cannedKeywords = [
    "canned", "can of", "tinned", "jarred", "preserved", "broth", "stock",
    "canned bean", "canned tomato", "tomato paste", "tomato sauce", "crushed tomato",
    "diced tomato", "stewed tomato", "sun dried tomato", "roasted pepper",
    "canned corn", "canned pea", "canned carrot", "canned green bean",
    "canned tuna", "canned salmon", "canned chicken", "canned sardine",
    "canned fruit", "fruit cocktail", "mandarin orange", "pineapple chunk",
    "coconut milk", "coconut cream", "evaporated", "condensed",
    "pickle", "olive", "caper", "artichoke heart", "heart of palm",
    "sauerkraut", "kimchi", "relish", "chutney", "jam", "jelly", "preserve",
    "marmalade", "apple sauce", "pumpkin puree", "chipotle in adobo",
    "black bean", "kidney bean", "pinto bean", "navy bean", "cannellini", "great northern",
    "chickpea", "garbanzo", "lentil", "water chestnut", "bamboo shoot", "refried bean",
  ];

  const spiceKeywords = [
    "salt", "cumin", "paprika", "oregano", "thyme", "cinnamon", "seasoning", "spice",
    "herb", "rosemary", "sage", "bay leaf", "dill", "tarragon", "marjoram",
    "nutmeg", "clove", "allspice", "cardamom", "coriander", "turmeric", "curry",
    "chili powder", "cayenne", "red pepper flake", "crushed red", "black pepper",
    "white pepper", "garlic powder", "onion powder", "mustard powder", "ginger powder",
    "five spice", "garam masala", "ras el hanout", "za atar", "herbes de provence",
    "italian seasoning", "cajun", "creole", "old bay", "taco seasoning", "ranch seasoning",
    "bouillon", "msg", "celery salt", "lemon pepper", "everything bagel seasoning",
    "dried basil", "dried parsley", "dried cilantro", "dried mint", "saffron", "sumac",
  ];

  const oilsSaucesKeywords = [
    "oil", "sauce", "vinegar", "dressing", "mayo", "mayonnaise", "mustard", "ketchup",
    "salsa", "soy sauce", "tamari", "teriyaki", "hoisin", "oyster sauce", "fish sauce",
    "worcestershire", "hot sauce", "sriracha", "tabasco", "buffalo sauce", "bbq sauce",
    "barbecue", "marinara", "alfredo", "pesto", "hummus", "tahini", "tzatziki",
    "guacamole", "aioli", "remoulade", "tartar sauce", "cocktail sauce",
    "olive oil", "vegetable oil", "canola", "coconut oil", "sesame oil", "avocado oil",
    "peanut oil", "grapeseed", "sunflower oil", "corn oil", "truffle oil",
    "balsamic", "red wine vinegar", "white wine vinegar", "apple cider vinegar",
    "rice vinegar", "sherry vinegar", "malt vinegar", "cooking spray", "pam",
    "wine", "cooking wine", "white wine", "red wine", "sherry", "mirin", "sake",
    "glaze", "marinade", "condiment", "spread", "dip",
  ];

  const bakingKeywords = [
    "sugar", "baking soda", "baking powder", "yeast", "chocolate", "vanilla", "cocoa",
    "flour", "honey", "syrup", "sweetener", "maple syrup", "molasses", "agave",
    "stevia", "splenda", "brown sugar", "powdered sugar", "confectioner", "icing sugar",
    "corn syrup", "golden syrup", "treacle", "date syrup",
    "all purpose flour", "bread flour", "cake flour", "pastry flour", "self rising",
    "whole wheat flour", "almond flour", "coconut flour", "oat flour", "rice flour",
    "tapioca", "cornstarch", "arrowroot", "xanthan gum", "gelatin", "pectin",
    "chocolate chip", "cocoa powder", "cacao", "baking chocolate", "white chocolate",
    "dark chocolate", "semi sweet", "unsweetened chocolate", "butterscotch chip",
    "sprinkle", "food coloring", "extract", "almond extract", "peppermint extract",
    "cream of tartar", "meringue powder", "fondant", "marzipan", "lemon curd",
  ];

  const beverageKeywords = [
    "coffee", "tea", "juice", "soda", "beer", "liquor", "bourbon", "vodka",
    "rum", "whiskey", "champagne", "cider", "energy drink", "sparkling water",
    "kombucha", "matcha", "espresso", "cocoa mix", "hot chocolate",
    "lemonade", "iced tea", "tonic", "seltzer", "club soda",
  ];

  const nonFoodKeywords = [
    "parchment", "foil", "aluminum foil", "plastic wrap", "skewer", "toothpick",
    "twine", "cheesecloth", "paper towel", "cupcake liner", "muffin liner",
    "wax paper", "cling wrap", "kitchen string", "butcher paper",
  ];

  const frozenKeywords = [
    "frozen", "ice cream", "gelato", "sorbet", "sherbet", "frozen yogurt", "popsicle",
    "ice pop", "frozen pizza", "frozen dinner", "frozen vegetable", "frozen fruit",
    "frozen berry", "frozen pea", "frozen corn", "frozen spinach", "frozen broccoli",
    "frozen fish", "frozen shrimp", "frozen chicken", "fish stick", "chicken nugget",
    "frozen waffle", "frozen pancake", "frozen bread", "frozen bagel",
    "frozen pie", "frozen cake", "frozen cookie dough", "ice cube",
  ];

  const snackKeywords = [
    "chip", "cracker", "nut", "granola", "almond", "peanut", "snack", "pretzel",
    "cashew", "walnut", "pecan", "pistachio", "macadamia", "hazelnut", "brazil nut",
    "mixed nut", "trail mix", "seed", "sunflower seed", "pumpkin seed", "chia seed",
    "flax seed", "hemp seed", "sesame seed", "peanut butter", "almond butter",
    "cashew butter", "sunflower butter", "nut butter", "nutella", "cookie butter",
    "popcorn", "corn nut", "rice cake", "rice crisp", "puffed rice", "cheese puff",
    "tortilla chip", "potato chip", "veggie chip", "pita chip", "banana chip",
    "fruit snack", "dried fruit", "raisin", "dried mango", "dried apricot", "craisin",
    "jerky", "beef jerky", "turkey jerky", "meat stick", "protein bar", "granola bar",
    "energy bar", "cereal bar", "fig bar", "cookie", "biscotti", "wafer",
    "protein powder", "whey protein", "casein", "protein shake", "supplement", "collagen",
  ];

  // Unambiguous seasonings checked FIRST — otherwise the broad produce keyword "pepper"
  // (meant for bell/jalapeño) wrongly captures "black pepper", "ground pepper", etc., and
  // names like "celery salt"/"garlic salt" get caught by produce "celery"/"garlic". These
  // are definitively spices for both defaulting (→ 0.5 tsp) and Instacart (→ 1 container).
  const definiteSpiceKeywords = [
    "black pepper", "white pepper", "ground pepper", "ground black pepper", "cracked pepper",
    "peppercorn", "cayenne", "red pepper flake", "crushed red pepper", "lemon pepper",
    "salt and pepper", "salt & pepper", "kosher salt", "sea salt", "table salt", "celery salt",
    "garlic salt", "onion salt", "seasoned salt", "seasoning salt", "flaky salt", "fine salt",
    "coarse salt", "rock salt", "pink salt", "himalayan salt", "iodized salt",
  ];
  if (definiteSpiceKeywords.some((k) => normalized.includes(k))) return "Spices & Seasonings";

  if (nonFoodKeywords.some((k) => normalized.includes(k))) return "Non-Food";
  if (preparedKeywords.some((k) => normalized.includes(k))) return "Prepared Foods & Deli";
  if (frozenKeywords.some((k) => normalized.includes(k))) return "Frozen";
  if (produceKeywords.some((k) => normalized.includes(k))) return "Produce";
  if (meatKeywords.some((k) => normalized.includes(k))) return "Meat & Seafood";
  if (dairyKeywords.some((k) => normalized.includes(k))) return "Dairy & Eggs";
  if (breadKeywords.some((k) => normalized.includes(k))) return "Bread & Bakery";
  if (pastaGrainsKeywords.some((k) => normalized.includes(k))) return "Pasta, Rice & Grains";
  if (cannedKeywords.some((k) => normalized.includes(k))) return "Canned & Jarred";
  if (spiceKeywords.some((k) => normalized.includes(k))) return "Spices & Seasonings";
  if (oilsSaucesKeywords.some((k) => normalized.includes(k))) return "Oils, Sauces & Condiments";
  if (bakingKeywords.some((k) => normalized.includes(k))) return "Baking & Sweets";
  if (beverageKeywords.some((k) => normalized.includes(k))) return "Beverages & Alcohol";
  if (snackKeywords.some((k) => normalized.includes(k))) return "Snacks & Nuts";

  return "Spices & Seasonings";
}

// ── Phase H.9: defaulting + seasoning-scaling intelligence ───────────────────

/**
 * Categories whose amounts scale SUB-LINEARLY when servings change. Research-backed
 * (Escoffier, food-science scaling guides): salt/spices/acid don't scale linearly because
 * flavor perception compounds. Fresh herbs are classified as "Produce", so they scale
 * linearly here — also per best practice.
 */
export const SEASONING_CATEGORIES = new Set<FoodGroup>(["Spices & Seasonings"]);

export function isSeasoning(name: string): boolean {
  return SEASONING_CATEGORIES.has(getIngredientFoodGroup(name));
}

/**
 * Per-category fallback amount+unit for ingredients that arrive with a NULL/blank amount
 * (e.g. "to taste" salt, "for garnish" cilantro). Every recipe ingredient must carry a real
 * amount+unit so it can reach Instacart — nothing is ever left "to taste". Salt/pepper get
 * 0.5 tsp (≈ a pinch). Units are chosen so the downstream Instacart category mapping accepts
 * them. The decimal `amount` is the canonical value; the fraction shown to users is formatted
 * from it at display time.
 */
export const DEFAULT_AMOUNT_BY_CATEGORY: Record<FoodGroup, { amount: number; unit: string }> = {
  "Spices & Seasonings": { amount: 0.5, unit: "teaspoon" },
  "Oils, Sauces & Condiments": { amount: 1, unit: "tablespoon" },
  "Produce": { amount: 1, unit: "each" },
  "Dairy & Eggs": { amount: 1, unit: "tablespoon" },
  "Meat & Seafood": { amount: 1, unit: "each" },
  "Bread & Bakery": { amount: 1, unit: "each" },
  "Pasta, Rice & Grains": { amount: 1, unit: "cup" },
  "Canned & Jarred": { amount: 1, unit: "can" },
  "Baking & Sweets": { amount: 1, unit: "tablespoon" },
  "Frozen": { amount: 1, unit: "cup" },
  "Prepared Foods & Deli": { amount: 1, unit: "each" },
  "Snacks & Nuts": { amount: 0.25, unit: "cup" },
  "Beverages & Alcohol": { amount: 1, unit: "cup" },
  "Non-Food": { amount: 1, unit: "each" },
};

/**
 * Guarantee a non-null { amount, unit } for an ingredient. If the amount is already a
 * positive number, it's returned untouched (preserving any explicit unit). Otherwise the
 * category default fills it in. An explicit unit on the input is preserved even when the
 * amount is defaulted.
 */
export function applyIngredientDefault(ing: {
  name: string;
  amount: number | null | undefined;
  unit: string | null | undefined;
}): { amount: number; unit: string } {
  if (ing.amount != null && Number.isFinite(ing.amount) && ing.amount > 0) {
    return { amount: ing.amount, unit: (ing.unit ?? "").trim() };
  }
  const group = getIngredientFoodGroup(ing.name);
  const def = DEFAULT_AMOUNT_BY_CATEGORY[group];
  const explicitUnit = (ing.unit ?? "").trim();
  return { amount: def.amount, unit: explicitUnit.length > 0 ? explicitUnit : def.unit };
}

/**
 * The serving-scale multiplier for one ingredient. Bulk ingredients scale linearly;
 * "Spices & Seasonings" scale via the linear blend `0.5 + 0.5*ratio` (1.5x at double,
 * 2x at triple, identity at ratio 1) so doubling a recipe adds ~50% more salt, not 100%.
 */
export function scaleMultiplierForIngredient(name: string, ratio: number): number {
  if (isSeasoning(name)) return 0.5 + 0.5 * ratio;
  return ratio;
}
