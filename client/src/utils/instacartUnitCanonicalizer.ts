export interface CanonicalizeInput {
  quantity: number | string | null | undefined;
  unitDisplay: string | null | undefined;
  ingredientName?: string;
  sourceType?: string;
  correlationId?: string;
}

export interface CanonicalizeResult {
  instacartQuantity: number | null;
  instacartUnit: string;
  normalizedFromUnitDisplay: string;
  fallbackReason: string | null;
  confidence: "high" | "medium" | "low";
}

type InstacartUnit =
  | "cup" | "tablespoon" | "teaspoon"
  | "ounce" | "pound" | "gram" | "kilogram"
  | "milliliter" | "liter"
  | "pint" | "quart" | "gallon"
  | "fl oz can" | "fl oz container" | "fl oz jar" | "fl oz pouch" | "fl oz ounce"
  | "pt container"
  | "lb bag" | "lb can" | "lb container"
  | "oz bag" | "oz can" | "oz container"
  | "per lb"
  | "bunch" | "can" | "each" | "ears" | "head"
  | "large" | "medium" | "small"
  | "package" | "packet"
  | "small ears" | "small head";

const ALLOWED_UNITS = new Set<string>([
  "cup", "tablespoon", "teaspoon",
  "ounce", "pound", "gram", "kilogram",
  "milliliter", "liter",
  "pint", "quart", "gallon",
  "fl oz can", "fl oz container", "fl oz jar", "fl oz pouch", "fl oz ounce",
  "pt container",
  "lb bag", "lb can", "lb container",
  "oz bag", "oz can", "oz container",
  "per lb",
  "bunch", "can", "each", "ears", "head",
  "large", "medium", "small",
  "package", "packet",
  "small ears", "small head",
]);

const ALIAS_MAP: Record<string, InstacartUnit> = {
  "cup": "cup",
  "cups": "cup",
  "c": "cup",

  "tablespoon": "tablespoon",
  "tablespoons": "tablespoon",
  "tb": "tablespoon",
  "tbs": "tablespoon",
  "tbsp": "tablespoon",
  "tbsps": "tablespoon",

  "teaspoon": "teaspoon",
  "teaspoons": "teaspoon",
  "ts": "teaspoon",
  "tsp": "teaspoon",
  "tspn": "teaspoon",
  "tsps": "teaspoon",

  "ounce": "ounce",
  "ounces": "ounce",
  "oz": "ounce",

  "pound": "pound",
  "pounds": "pound",
  "lb": "pound",
  "lbs": "pound",

  "gram": "gram",
  "grams": "gram",
  "g": "gram",
  "gs": "gram",

  "kilogram": "kilogram",
  "kilograms": "kilogram",
  "kg": "kilogram",
  "kgs": "kilogram",

  "milliliter": "milliliter",
  "milliliters": "milliliter",
  "millilitre": "milliliter",
  "millilitres": "milliliter",
  "ml": "milliliter",
  "mls": "milliliter",

  "liter": "liter",
  "litre": "liter",
  "liters": "liter",
  "litres": "liter",
  "l": "liter",

  "pint": "pint",
  "pints": "pint",
  "pt": "pint",
  "pts": "pint",

  "quart": "quart",
  "quarts": "quart",
  "qt": "quart",
  "qts": "quart",

  "gallon": "gallon",
  "gallons": "gallon",
  "gal": "gallon",
  "gals": "gallon",

  "each": "each",

  "bunch": "bunch",
  "bunches": "bunch",

  "head": "head",
  "heads": "head",

  "can": "can",
  "cans": "can",

  "package": "package",
  "packages": "package",
  "pkg": "package",

  "packet": "packet",
  "packets": "packet",

  "ears": "ears",
  "ear": "ears",

  "small": "small",
  "sm": "small",

  "medium": "medium",
  "med": "medium",
  "md": "medium",

  "large": "large",
  "lg": "large",
  "lrg": "large",
  "lge": "large",

  "fl oz can": "fl oz can",
  "fl oz container": "fl oz container",
  "fl oz jar": "fl oz jar",
  "fl oz pouch": "fl oz pouch",
  "fl oz ounce": "fl oz ounce",
  "pt container": "pt container",
  "per lb": "per lb",
  "lb bag": "lb bag",
  "lb can": "lb can",
  "lb container": "lb container",
  "oz bag": "oz bag",
  "oz can": "oz can",
  "oz container": "oz container",
  "small ears": "small ears",
  "small head": "small head",
  "small heads": "small head",
};

const COUNTABLE_KEYWORDS = [
  "fruit", "whole", "lime", "lemon", "tomato", "tomatoes",
  "onion", "onions", "egg", "eggs", "apple", "apples",
  "banana", "bananas", "pepper", "peppers", "potato", "potatoes",
  "avocado", "avocados", "clove", "cloves", "garlic",
  "carrot", "carrots", "cucumber", "cucumbers", "orange", "oranges",
  "peach", "peaches", "pear", "pears", "mango", "mangoes",
  "zucchini", "eggplant", "stalk", "stalks", "rib", "ribs",
  "sprig", "sprigs", "leaf", "leaves", "slice", "slices",
  "fillet", "fillets", "breast", "breasts", "thigh", "thighs",
  "drumstick", "drumsticks", "wing", "wings",
];

const COMPOUND_PACKAGING_PATTERNS: Array<{ regex: RegExp; unit: InstacartUnit }> = [
  { regex: /\bfl\s*oz\s+can\b/, unit: "fl oz can" },
  { regex: /\bfl\s*oz\s+container\b/, unit: "fl oz container" },
  { regex: /\bfl\s*oz\s+jar\b/, unit: "fl oz jar" },
  { regex: /\bfl\s*oz\s+pouch\b/, unit: "fl oz pouch" },
  { regex: /\boz\s+bag\b/, unit: "oz bag" },
  { regex: /\boz\s+can\b/, unit: "oz can" },
  { regex: /\boz\s+container\b/, unit: "oz container" },
  { regex: /\blb\s+bag\b/, unit: "lb bag" },
  { regex: /\blb\s+can\b/, unit: "lb can" },
  { regex: /\blb\s+container\b/, unit: "lb container" },
  { regex: /\bper\s+lb\b/, unit: "per lb" },
  { regex: /\bpt\s+container\b/, unit: "pt container" },
  { regex: /\bsmall\s+ears?\b/, unit: "small ears" },
  { regex: /\bsmall\s+heads?\b/, unit: "small head" },
];

const GARBAGE_INDICATORS = [
  "recipe", "piece", "pieces",
  "pinch", "dash", "handful", "to taste", "as needed",
  "sprinkle", "drizzle", "splash",
];

function parseQuantity(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return isFinite(raw) ? raw : null;
  }
  const str = String(raw).trim();
  if (!str) return null;

  const fractionMatch = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10);
    const den = parseInt(fractionMatch[2], 10);
    if (den !== 0) return num / den;
    return null;
  }

  const mixedMatch = str.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den !== 0) return whole + num / den;
    return null;
  }

  const cleaned = str.replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  if (isFinite(parsed)) return parsed;
  return null;
}

function extractBaseToken(unitDisplay: string): string {
  let text = unitDisplay.trim().toLowerCase();

  text = text.replace(/\s+/g, " ");

  const parenIdx = text.indexOf("(");
  if (parenIdx > 0) {
    text = text.substring(0, parenIdx).trim();
  }

  const commaIdx = text.indexOf(",");
  if (commaIdx > 0) {
    text = text.substring(0, commaIdx).trim();
  }

  text = text.replace(/[.,;:!?]+$/, "");

  return text;
}

function isCountableIngredient(ingredientName: string, unitDisplay: string): boolean {
  const combined = `${ingredientName} ${unitDisplay}`.toLowerCase();
  return COUNTABLE_KEYWORDS.some(kw => combined.includes(kw));
}

function isGarbageUnit(baseToken: string, fullDisplay: string): boolean {
  const lower = fullDisplay.toLowerCase();
  if (GARBAGE_INDICATORS.some(g => lower.includes(g))) return true;

  if (baseToken.length > 25) return true;

  if (/\d+["']\s*dia/.test(lower)) return true;
  if (/approx\s+\d/.test(lower)) return true;

  if (/^[a-z]+,\s*(unpeeled|peeled|raw|cooked|fresh|frozen|dried|diced|chopped|sliced|minced)/.test(lower)) {
    const firstWord = lower.split(/[,\s]/)[0];
    if (!ALIAS_MAP[firstWord]) return true;
  }

  return false;
}

export function canonicalizeForInstacart(input: CanonicalizeInput): CanonicalizeResult {
  const instacartQuantity = parseQuantity(input.quantity);
  const rawDisplay = input.unitDisplay ?? "";
  const ingredientName = input.ingredientName ?? "";

  if (!rawDisplay.trim()) {
    return {
      instacartQuantity,
      instacartUnit: "each",
      normalizedFromUnitDisplay: "",
      fallbackReason: "empty_unit_display",
      confidence: "low",
    };
  }

  const fullLower = rawDisplay.toLowerCase().replace(/\s+/g, " ").trim();

  for (const { regex, unit } of COMPOUND_PACKAGING_PATTERNS) {
    if (regex.test(fullLower)) {
      return {
        instacartQuantity,
        instacartUnit: unit,
        normalizedFromUnitDisplay: fullLower,
        fallbackReason: null,
        confidence: "high",
      };
    }
  }

  const baseToken = extractBaseToken(rawDisplay);

  if (baseToken === "serving" || baseToken === "servings") {
    return {
      instacartQuantity,
      instacartUnit: "each",
      normalizedFromUnitDisplay: baseToken,
      fallbackReason: "serving_unit",
      confidence: "low",
    };
  }

  if (isGarbageUnit(baseToken, rawDisplay)) {
    return {
      instacartQuantity,
      instacartUnit: "each",
      normalizedFromUnitDisplay: baseToken,
      fallbackReason: "unsupported_unit_display",
      confidence: "low",
    };
  }

  const directMatch = ALIAS_MAP[baseToken];
  if (directMatch) {
    return {
      instacartQuantity,
      instacartUnit: directMatch,
      normalizedFromUnitDisplay: baseToken,
      fallbackReason: null,
      confidence: "high",
    };
  }

  const words = baseToken.split(/\s+/);
  if (words.length > 1) {
    const firstWord = words[0];
    const wordMatch = ALIAS_MAP[firstWord];
    if (wordMatch) {
      return {
        instacartQuantity,
        instacartUnit: wordMatch,
        normalizedFromUnitDisplay: baseToken,
        fallbackReason: null,
        confidence: "medium",
      };
    }
  }

  if (isCountableIngredient(ingredientName, rawDisplay)) {
    return {
      instacartQuantity,
      instacartUnit: "each",
      normalizedFromUnitDisplay: baseToken,
      fallbackReason: "countable_ingredient_fallback",
      confidence: "medium",
    };
  }

  return {
    instacartQuantity,
    instacartUnit: "each",
    normalizedFromUnitDisplay: baseToken,
    fallbackReason: "no_matching_unit",
    confidence: "low",
  };
}

export function getAllowedInstacartUnits(): string[] {
  return Array.from(ALLOWED_UNITS);
}
