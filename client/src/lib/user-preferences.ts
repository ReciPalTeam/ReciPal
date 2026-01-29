export interface UserPreferences {
  cookingComfort?: string;
  costPreference?: string;
  dietaryPreferences?: string[];
  allergies?: string[];
  isDiabetic?: boolean;
  maxCarbPercent?: number | null;
}
