import type { Recipe } from './mock-data';

interface RecipeBase {
  title?: string;
  cookingStyle?: string;
}

export const CUISINE_KEYWORDS: Record<string, string[]> = {
  "American": [
    "american", "classic", "burger", "grill", "hot dog", "mac and cheese",
    "meatloaf", "pot roast", "baked potato", "club sandwich"
  ],
  "Southern / Comfort Food": [
    "southern", "comfort", "fried chicken", "gravy", "casserole", "cornbread",
    "collard greens", "shrimp and grits", "biscuits"
  ],
  "Soul Food": [
    "soul food", "chitlins", "collard greens", "black eyed peas", "sweet potato pie",
    "neck bones", "oxtail", "candied yams"
  ],
  "Barbecue (BBQ)": [
    "bbq", "barbecue", "brisket", "smoked", "pulled pork", "ribs",
    "burnt ends", "smoked sausage"
  ],
  "Cajun": [
    "cajun", "gumbo", "jambalaya", "crawfish", "andouille", "boudin",
    "etouffee", "dirty rice"
  ],
  "Creole": [
    "creole", "creole sauce", "shrimp creole", "creole seasoning",
    "red beans and rice"
  ],
  "Tex-Mex": [
    "tex-mex", "tex mex", "nachos", "queso", "chili con carne",
    "fajitas", "chimichanga"
  ],
  "Diner / Classic American": [
    "diner", "classic american", "grilled cheese", "milkshake",
    "pancakes", "club sandwich", "patty melt", "hash browns"
  ],
  "Hawaiian": [
    "hawaiian", "poke", "loco moco", "spam musubi", "kalua",
    "poi", "macaroni salad", "plate lunch"
  ],
  "Mexican": [
    "mexican", "taco", "tacos", "burrito", "enchilada", "quesadilla", "salsa",
    "tamales", "pozole", "mole", "carnitas", "carne asada", "al pastor", "elote"
  ],
  "Italian": [
    "italian", "pasta", "marinara", "alfredo", "parmesan", "risotto",
    "lasagna", "gnocchi", "bruschetta", "tiramisu", "carbonara"
  ],
  "Latin American": [
    "latin american", "latin", "empanada", "arepa", "ceviche",
    "plantain", "chimichurri"
  ],
  "Brazilian": [
    "brazilian", "churrasco", "feijoada", "pao de queijo", "brigadeiro",
    "picanha", "acai", "moqueca"
  ],
  "Puerto Rican": [
    "puerto rican", "mofongo", "pernil", "arroz con gandules",
    "tostones", "alcapurrias", "pasteles"
  ],
  "Peruvian": [
    "peruvian", "ceviche", "lomo saltado", "aji de gallina",
    "anticucho", "causa", "pollo a la brasa"
  ],
  "Cuban": [
    "cuban", "ropa vieja", "cuban sandwich", "vaca frita",
    "lechon", "yuca", "arroz con pollo"
  ],
  "Colombian": [
    "colombian", "bandeja paisa", "ajiaco", "empanada colombiana",
    "arepa", "sancocho"
  ],
  "Venezuelan": [
    "venezuelan", "arepa", "pabellon criollo", "tequeños",
    "cachapa", "hallaca"
  ],
  "Chilean": [
    "chilean", "empanada chilena", "pastel de choclo", "cazuela",
    "curanto", "sopaipilla"
  ],
  "Ecuadorian": [
    "ecuadorian", "llapingacho", "encebollado", "ceviche ecuadoriano",
    "locro de papa", "seco de pollo"
  ],
  "Bolivian": [
    "bolivian", "salteña", "silpancho", "pique macho",
    "sopa de mani", "llajwa"
  ],
  "Uruguayan": [
    "uruguayan", "chivito", "asado", "milanesa",
    "empanada uruguaya", "dulce de leche"
  ],
  "Asian": [
    "asian", "stir fry", "stir-fry", "soy", "teriyaki", "noodle", "ramen",
    "wok", "sesame"
  ],
  "Chinese": [
    "chinese", "kung pao", "fried rice", "lo mein", "dim sum", "wonton",
    "general tso", "sweet and sour", "mapo tofu", "chow mein"
  ],
  "Japanese": [
    "japanese", "sushi", "ramen", "tempura", "miso", "teriyaki",
    "udon", "tonkatsu", "onigiri", "gyoza"
  ],
  "Korean": [
    "korean", "bibimbap", "bulgogi", "kimchi", "japchae",
    "tteokbokki", "galbi", "gochujang"
  ],
  "Thai": [
    "thai", "pad thai", "green curry", "tom yum", "basil chicken",
    "massaman", "tom kha", "larb"
  ],
  "Vietnamese": [
    "vietnamese", "pho", "banh mi", "spring rolls", "bun",
    "vermicelli", "lemongrass", "nuoc cham"
  ],
  "Filipino": [
    "filipino", "adobo", "sinigang", "lumpia", "pancit",
    "lechon", "kare kare", "sisig"
  ],
  "Indonesian": [
    "indonesian", "nasi goreng", "satay", "rendang", "gado gado",
    "bakso", "soto", "tempeh"
  ],
  "Malaysian": [
    "malaysian", "nasi lemak", "laksa", "char kway teow",
    "roti canai", "satay", "rendang"
  ],
  "Pan-Asian": [
    "pan-asian", "pan asian", "asian fusion", "fusion bowl",
    "east meets west"
  ],
  "Asian Fusion": [
    "asian fusion", "fusion", "east west", "modern asian"
  ],
  "French": [
    "french", "coq au vin", "ratatouille", "bouillabaisse", "croissant",
    "quiche", "souffle", "bechamel", "gratin", "beurre blanc", "crepe"
  ],
  "Mediterranean": [
    "mediterranean", "greek", "tzatziki", "olive oil", "feta", "hummus",
    "moussaka", "tabbouleh", "souvlaki"
  ],
  "Indian": [
    "indian", "curry", "masala", "tikka", "dal", "naan",
    "biryani", "tandoori", "paneer", "samosa"
  ],
  "Middle Eastern": [
    "middle eastern", "shawarma", "falafel", "tahini", "kebab",
    "kibbeh", "labneh", "zaatar"
  ],
  "Caribbean": [
    "caribbean", "jerk", "plantain", "island",
    "rice and peas", "curry goat"
  ],
  "Jamaican": [
    "jamaican", "jerk chicken", "ackee", "saltfish", "oxtail",
    "patties", "escovitch", "festival"
  ],
  "Dominican": [
    "dominican", "mangu", "sancocho", "la bandera",
    "moro de habichuelas", "tostones"
  ],
  "Haitian": [
    "haitian", "griot", "diri kole", "pikliz",
    "legume", "soup joumou"
  ],
  "Trinidadian": [
    "trinidadian", "doubles", "roti", "callaloo",
    "pelau", "bake and shark"
  ],
  "Barbadian": [
    "barbadian", "bajan", "cou cou", "flying fish",
    "macaroni pie", "fish cakes"
  ],
  "Caribbean Fusion": [
    "caribbean fusion", "island fusion", "tropical fusion"
  ],
  "African": [
    "african", "jollof", "fufu", "injera", "suya",
    "tagine", "couscous"
  ],
  "Ethiopian": [
    "ethiopian", "injera", "doro wat", "kitfo",
    "tibs", "shiro", "berbere"
  ],
  "Moroccan": [
    "moroccan", "tagine", "couscous", "harira",
    "pastilla", "chermoula", "ras el hanout"
  ],
  "Nigerian": [
    "nigerian", "jollof rice", "suya", "egusi",
    "pounded yam", "pepper soup", "chin chin"
  ],
  "Senegalese": [
    "senegalese", "thieboudienne", "yassa", "mafe",
    "ceebu jen"
  ],
  "Egyptian": [
    "egyptian", "koshari", "ful medames", "molokhia",
    "shawarma", "ta'ameya", "basbousa"
  ],
  "African Fusion": [
    "african fusion", "afro fusion", "modern african"
  ],
};

export function filterRecipesByCuisine<T extends RecipeBase>(
  recipes: T[],
  selectedCuisines: string[] | null
): T[] {
  if (!selectedCuisines || selectedCuisines.length === 0) {
    return recipes;
  }

  if (recipes.length === 0) {
    return recipes;
  }

  try {
    const allKeywords: string[] = [];
    for (const cuisine of selectedCuisines) {
      const keywords = CUISINE_KEYWORDS[cuisine];
      if (keywords) {
        allKeywords.push(...keywords);
      }
    }

    if (allKeywords.length === 0) {
      return recipes;
    }

    const filtered = recipes.filter((recipe) => {
      const title = recipe.title?.toLowerCase() || '';
      const cookingStyle = recipe.cookingStyle?.toLowerCase() || '';
      const searchableText = `${title} ${cookingStyle}`;

      return allKeywords.some((keyword) => searchableText.includes(keyword));
    });

    if (filtered.length === 0) {
      return recipes;
    }

    return filtered;
  } catch {
    return recipes;
  }
}

export interface UserPreferences {
  cookingComfort?: string;
  dietaryPreferences?: string[];
  allergies?: string[];
  missingTools?: string[];
  cuisinePreferences?: string[];
}

interface RankableRecipe extends RecipeBase {
  cuisine?: string;
  total_time_minutes?: number;
  servings?: number;
  min_servings?: number;
  dietary_restrictions?: string[];
  allergens?: string[];
  steps?: (string | { step?: number; time?: string; equipment?: string; instruction?: string })[];
}

const TOOL_KEYWORDS = [
  'oven', 'microwave', 'blender', 'food processor', 'stand mixer',
  'slow cooker', 'instant pot', 'air fryer', 'grill',
];

function recipeRequiresTool(recipe: RankableRecipe, tool: string): boolean {
  const toolLower = tool.toLowerCase();
  if (recipe.title && recipe.title.toLowerCase().includes(toolLower)) return true;
  if (recipe.steps && Array.isArray(recipe.steps)) {
    for (const s of recipe.steps) {
      const text = typeof s === 'string'
        ? s
        : (s && typeof s === 'object' ? (s.instruction || (s as any).location || s.equipment || '') : '');
      if (text.toLowerCase().includes(toolLower)) return true;
    }
  }
  return false;
}

export function rankRecipes<T extends RankableRecipe>(
  recipes: T[],
  userPreferences: UserPreferences
): T[] {
  if (!recipes || recipes.length === 0) return [];

  const {
    cookingComfort,
    missingTools,
    cuisinePreferences,
  } = userPreferences;

  const cuisinesLower = (cuisinePreferences || []).map(c => c.toLowerCase());
  const toolsToCheck = (missingTools || []).filter(t =>
    TOOL_KEYWORDS.some(kw => t.toLowerCase().includes(kw))
  );

  const scored = recipes.map((recipe, index) => {
    let score = 0;

    if (recipe.cuisine && cuisinesLower.length > 0) {
      if (cuisinesLower.some(c => recipe.cuisine!.toLowerCase().includes(c) || c.includes(recipe.cuisine!.toLowerCase()))) {
        score += 3;
      }
    }

    if (recipe.total_time_minutes != null && cookingComfort) {
      const mins = recipe.total_time_minutes;
      if (
        (cookingComfort === 'quick' && mins <= 30) ||
        (cookingComfort === 'comfortable' && mins > 30 && mins <= 60) ||
        (cookingComfort === 'involved' && mins > 60)
      ) {
        score += 2;
      }
    }

    // Allergen and dietary restriction filtering now happens server-side
    // via ingredient name scanning in filterByIngredients() (server/lib/recipeDb.ts)

    if (toolsToCheck.length > 0) {
      for (const tool of toolsToCheck) {
        if (recipeRequiresTool(recipe, tool)) {
          score -= 2;
          break;
        }
      }
    }

    return { recipe, score, index };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored.map(s => s.recipe);
}
