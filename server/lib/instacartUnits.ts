export type InstacartUnit =
  | "cup"
  | "fl oz can"
  | "fl oz container"
  | "fl oz jar"
  | "fl oz pouch"
  | "fl oz ounce"
  | "gallon"
  | "milliliter"
  | "liter"
  | "pint"
  | "pt container"
  | "quart"
  | "tablespoon"
  | "teaspoon"
  | "gram"
  | "kilogram"
  | "lb bag"
  | "lb can"
  | "lb container"
  | "per lb"
  | "ounce"
  | "oz bag"
  | "oz can"
  | "oz container"
  | "pound"
  | "bunch"
  | "can"
  | "each"
  | "ears"
  | "head"
  | "large"
  | "medium"
  | "package"
  | "packet"
  | "small"
  | "small ears"
  | "small head";

export type UnitType =
  | "weight"
  | "volume"
  | "count"
  | "package";

export interface NormalizedUnitResult {
  normalizedUnit: InstacartUnit | null;
  unitType: UnitType | null;
  confidence: "HIGH" | "MED" | "LOW";
  reason: string;
}

const UNIT_TYPE_MAP: Record<InstacartUnit, UnitType> = {
  "cup": "volume",
  "fl oz can": "package",
  "fl oz container": "package",
  "fl oz jar": "package",
  "fl oz pouch": "package",
  "fl oz ounce": "volume",
  "gallon": "volume",
  "milliliter": "volume",
  "liter": "volume",
  "pint": "volume",
  "pt container": "package",
  "quart": "volume",
  "tablespoon": "volume",
  "teaspoon": "volume",
  "gram": "weight",
  "kilogram": "weight",
  "lb bag": "package",
  "lb can": "package",
  "lb container": "package",
  "per lb": "weight",
  "ounce": "weight",
  "oz bag": "package",
  "oz can": "package",
  "oz container": "package",
  "pound": "weight",
  "bunch": "count",
  "can": "count",
  "each": "count",
  "ears": "count",
  "head": "count",
  "large": "count",
  "medium": "count",
  "package": "count",
  "packet": "count",
  "small": "count",
  "small ears": "count",
  "small head": "count",
};

const ALIAS_MAP: Record<string, InstacartUnit> = {
  "cup": "cup",
  "cups": "cup",
  "c": "cup",

  "gallon": "gallon",
  "gallons": "gallon",
  "gal": "gallon",
  "gals": "gallon",

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

  "tablespoon": "tablespoon",
  "tablespoons": "tablespoon",
  "tb": "tablespoon",
  "tbs": "tablespoon",

  "teaspoon": "teaspoon",
  "teaspoons": "teaspoon",
  "ts": "teaspoon",
  "tsp": "teaspoon",
  "tspn": "teaspoon",

  "fl oz can": "fl oz can",
  "fl oz container": "fl oz container",
  "fl oz jar": "fl oz jar",
  "fl oz pouch": "fl oz pouch",
  "fl oz ounce": "fl oz ounce",
  "pt container": "pt container",

  "gram": "gram",
  "grams": "gram",
  "g": "gram",
  "gs": "gram",

  "kilogram": "kilogram",
  "kilograms": "kilogram",
  "kg": "kilogram",
  "kgs": "kilogram",

  "ounce": "ounce",
  "ounces": "ounce",
  "oz": "ounce",

  "pound": "pound",
  "pounds": "pound",
  "lb": "pound",
  "lbs": "pound",

  "per lb": "per lb",

  "lb bag": "lb bag",
  "lb can": "lb can",
  "lb container": "lb container",
  "oz bag": "oz bag",
  "oz can": "oz can",
  "oz container": "oz container",

  "bunch": "bunch",
  "bunches": "bunch",

  "can": "can",
  "cans": "can",

  "each": "each",

  "ears": "ears",

  "head": "head",
  "heads": "head",

  "large": "large",
  "lrg": "large",
  "lge": "large",
  "lg": "large",

  "medium": "medium",
  "med": "medium",
  "md": "medium",

  "package": "package",
  "packages": "package",

  "packet": "packet",

  "small": "small",
  "sm": "small",

  "small ears": "small ears",

  "small head": "small head",
  "small heads": "small head",
};

const LB_PACKAGING_MAP: Record<string, InstacartUnit> = {
  "bag": "lb bag",
  "can": "lb can",
  "container": "lb container",
};

const OZ_PACKAGING_MAP: Record<string, InstacartUnit> = {
  "bag": "oz bag",
  "can": "oz can",
  "container": "oz container",
};

export function canonicalizeInputUnit(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/, "");
}

export function normalizeInstacartUnit(
  inputUnit: string,
  opts?: {
    packaging?: "bag" | "can" | "container" | null;
  }
): NormalizedUnitResult {
  const canonical = canonicalizeInputUnit(inputUnit);

  if (canonical === "lb" || canonical === "lbs") {
    if (opts?.packaging && LB_PACKAGING_MAP[opts.packaging]) {
      const unit = LB_PACKAGING_MAP[opts.packaging];
      return {
        normalizedUnit: unit,
        unitType: UNIT_TYPE_MAP[unit],
        confidence: "HIGH",
        reason: `Matched "lb" with packaging "${opts.packaging}" → "${unit}"`,
      };
    }
    return {
      normalizedUnit: "pound",
      unitType: "weight",
      confidence: "MED",
      reason: `Matched "lb" without packaging context → defaulted to "pound"`,
    };
  }

  if (canonical === "oz") {
    if (opts?.packaging && OZ_PACKAGING_MAP[opts.packaging]) {
      const unit = OZ_PACKAGING_MAP[opts.packaging];
      return {
        normalizedUnit: unit,
        unitType: UNIT_TYPE_MAP[unit],
        confidence: "HIGH",
        reason: `Matched "oz" with packaging "${opts.packaging}" → "${unit}"`,
      };
    }
    return {
      normalizedUnit: "ounce",
      unitType: "weight",
      confidence: "MED",
      reason: `Matched "oz" without packaging context → defaulted to "ounce"`,
    };
  }

  const matched = ALIAS_MAP[canonical];
  if (matched) {
    return {
      normalizedUnit: matched,
      unitType: UNIT_TYPE_MAP[matched],
      confidence: "HIGH",
      reason: `Direct alias match: "${canonical}" → "${matched}"`,
    };
  }

  console.warn(
    `[InstacartUnits] Unknown Instacart unit encountered | original: "${inputUnit}" | canonical: "${canonical}" | timestamp: ${new Date().toISOString()}`
  );

  return {
    normalizedUnit: null,
    unitType: null,
    confidence: "LOW",
    reason: `No matching Instacart unit found for "${inputUnit}"`,
  };
}

// ────────────────────────────────────────────────────────────
// USAGE EXAMPLE
// ────────────────────────────────────────────────────────────
//
// Recipe Builder calling normalizeInstacartUnit() before
// constructing an Instacart Measurement payload:
//
//   import { normalizeInstacartUnit } from "../lib/instacartUnits";
//
//   interface InstacartMeasurement {
//     unit: string;
//     quantity: number;
//   }
//
//   function buildInstacartPayload(
//     ingredientName: string,
//     quantity: number,
//     recipeUnit: string,
//     packaging?: "bag" | "can" | "container" | null
//   ): InstacartMeasurement | null {
//     const result = normalizeInstacartUnit(recipeUnit, { packaging });
//
//     if (!result.normalizedUnit) {
//       console.error(
//         `Cannot build Instacart payload for "${ingredientName}": ${result.reason}`
//       );
//       return null;
//     }
//
//     return {
//       unit: result.normalizedUnit,
//       quantity,
//     };
//   }
//
//   // Example call:
//   const measurement = buildInstacartPayload("Chicken Breast", 2, "lbs", "bag");
//   // → { unit: "lb bag", quantity: 2 }
//
//   const measurement2 = buildInstacartPayload("Salt", 1, "tspn");
//   // → { unit: "teaspoon", quantity: 1 }
//
//   const measurement3 = buildInstacartPayload("Mystery Spice", 1, "pinch");
//   // → null (logs warning for unknown unit)
//
