export const INGREDIENT_CATEGORIES = [
  "Protein",
  "Carb",
  "Seasonings",
  "Veggie",
  "Sauces & Condiments",
  "Dairy",
  "Fruit",
  "Nuts & Seeds",
  "Chocolate & Sweets",
  "Pickled & Preserved",
  "Baking & Thickeners",
  "Broths & Stocks",
  "Alcohol",
  "Oils",
  "Non-Food & Equipment",
  "Prepared Batters & Doughs",
  "Beverages & Coffee",
] as const;

export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];
