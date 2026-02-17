export interface MeasurementLineItem {
  ingredientName: string;
  pantryCategory: string;
  recipeQty: number;
  recipeUnit: string;
  originalUnitDisplay: string;
  confidence: "high" | "medium" | "low";
}

export interface MeasurementDecision {
  includeMeasurement: boolean;
  qty?: number;
  unit?: string;
  roundingApplied?: boolean;
  omittedReason?: string;
}

const SAFE_UNITS_FOR_LOW_CONFIDENCE = new Set([
  "each", "ounce", "pound", "gram", "kilogram", "ml", "liter", "fl_oz",
]);

const GROCERY_WEIGHT_VOLUME_UNITS = new Set([
  "ounce", "pound", "gram", "kilogram", "ml", "liter", "fl_oz",
]);

export function decideInstacartMeasurement(item: MeasurementLineItem): MeasurementDecision {
  const unitLower = item.recipeUnit.toLowerCase().trim();
  const displayLower = (item.originalUnitDisplay || "").toLowerCase();

  if (item.pantryCategory === "Spices & Seasonings") {
    return { includeMeasurement: false, omittedReason: "spice_container" };
  }

  if (item.pantryCategory === "Produce" && (unitLower === "cup" || displayLower.includes("cup"))) {
    return { includeMeasurement: false, omittedReason: "produce_recipe_volume" };
  }

  if (unitLower === "serving" || displayLower.includes("serving")) {
    return { includeMeasurement: false, omittedReason: "serving_unit" };
  }

  if (displayLower.includes("(") || displayLower.includes(")") || /juice\s+of/i.test(displayLower)) {
    return { includeMeasurement: false, omittedReason: "unsupported_unit_display" };
  }

  if (item.confidence === "low" && !SAFE_UNITS_FOR_LOW_CONFIDENCE.has(unitLower)) {
    return { includeMeasurement: false, omittedReason: "low_confidence_unit" };
  }

  if (unitLower === "each") {
    const qty = item.recipeQty;
    if (!Number.isInteger(qty)) {
      return { includeMeasurement: true, qty: Math.ceil(qty), unit: "each", roundingApplied: true };
    }
    return { includeMeasurement: true, qty, unit: "each", roundingApplied: false };
  }

  if (GROCERY_WEIGHT_VOLUME_UNITS.has(unitLower)) {
    return { includeMeasurement: true, qty: item.recipeQty, unit: item.recipeUnit, roundingApplied: false };
  }

  return { includeMeasurement: false, omittedReason: "other_recipe_unit" };
}
