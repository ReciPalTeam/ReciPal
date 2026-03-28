/**
 * Unified macro calculation engine.
 *
 * Approach: percentage-of-calories for ALL macros, not just fat.
 * This ensures balanced ratios regardless of calorie level.
 *
 * The engine picks a protein/fat/carb percentage split based on:
 *   - Goal (cut / maintain / bulk)
 *   - Training style (strength / mixed / endurance)
 *   - Priority (lean_gain / balanced / performance)
 *
 * Then enforces g/lb floors for protein and fat to ensure
 * minimum intake for muscle preservation and hormonal health.
 *
 * Sources:
 *   - ISSN Position Stand on protein (Jäger et al., 2017)
 *   - Helms et al., 2014 — protein during energy restriction
 *   - Schoenfeld & Aragon, 2018 — protein dose-response
 *   - ACSM/AND/DC Joint Position, 2016 — macro ranges
 *   - Morton et al., 2018 — meta-analysis on protein and muscle
 */

// ── Types ──────────────────────────────────────────────────────────────

export type MacroGoal = "cut" | "maintain" | "bulk";
export type MacroSex = "male" | "female";
export type MacroTrainingStyle = "strength" | "mixed" | "endurance";
export type MacroPriority = "lean_gain" | "balanced" | "performance";

export type MacroActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active"
  | "very"; // legacy server alias for very_active

export interface MacroInput {
  sex: MacroSex;
  weightLbs: number;
  heightCm: number;
  age: number;
  activityLevel: MacroActivityLevel;
  goal: MacroGoal;
  trainingStyle?: MacroTrainingStyle;  // defaults to "mixed"
  priority?: MacroPriority;            // defaults to "balanced"
}

export interface MacroResult {
  calories: number;
  protein: number;  // grams
  carbs: number;    // grams
  fat: number;      // grams
  tdee: number;
  bmr: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<MacroActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.725,
  very: 1.9,
};

const GOAL_CALORIE_FACTOR: Record<MacroGoal, number> = {
  cut: 0.80,
  maintain: 1.0,
  bulk: 1.15,
};

const CUT_ACTIVITY_DEFICIT_BONUS: Record<MacroActivityLevel, number> = {
  sedentary: 0,
  light: 0,
  moderate: 0,
  active: 0.03,
  very_active: 0.05,
  very: 0.05,
};

/**
 * Macro percentage splits: [protein%, fat%, carbs%]
 * Keyed by goal → training style → priority
 *
 * These are STARTING percentages. The engine then enforces
 * g/lb minimums for protein and fat, adjusting carbs as needed.
 *
 * Evidence basis for ranges:
 *   Protein: 25-40% (ISSN: 1.4-2.0 g/kg = ~0.64-0.9 g/lb for general;
 *            up to 1.4 g/lb during cuts per Helms et al.)
 *   Fat: 20-35% (ACSM/AND/DC joint position)
 *   Carbs: remainder (25-55%)
 */
interface MacroSplit { protein: number; fat: number; carbs: number; }

const MACRO_SPLITS: Record<MacroGoal, Record<MacroTrainingStyle, Record<MacroPriority, MacroSplit>>> = {
  cut: {
    strength: {
      lean_gain:   { protein: 0.40, fat: 0.25, carbs: 0.35 },
      balanced:    { protein: 0.38, fat: 0.27, carbs: 0.35 },
      performance: { protein: 0.35, fat: 0.25, carbs: 0.40 },
    },
    mixed: {
      lean_gain:   { protein: 0.38, fat: 0.25, carbs: 0.37 },
      balanced:    { protein: 0.35, fat: 0.27, carbs: 0.38 },
      performance: { protein: 0.32, fat: 0.25, carbs: 0.43 },
    },
    endurance: {
      lean_gain:   { protein: 0.33, fat: 0.25, carbs: 0.42 },
      balanced:    { protein: 0.30, fat: 0.27, carbs: 0.43 },
      performance: { protein: 0.28, fat: 0.25, carbs: 0.47 },
    },
  },
  maintain: {
    strength: {
      lean_gain:   { protein: 0.35, fat: 0.27, carbs: 0.38 },
      balanced:    { protein: 0.32, fat: 0.28, carbs: 0.40 },
      performance: { protein: 0.28, fat: 0.27, carbs: 0.45 },
    },
    mixed: {
      lean_gain:   { protein: 0.32, fat: 0.28, carbs: 0.40 },
      balanced:    { protein: 0.30, fat: 0.28, carbs: 0.42 },
      performance: { protein: 0.27, fat: 0.28, carbs: 0.45 },
    },
    endurance: {
      lean_gain:   { protein: 0.28, fat: 0.27, carbs: 0.45 },
      balanced:    { protein: 0.25, fat: 0.28, carbs: 0.47 },
      performance: { protein: 0.22, fat: 0.25, carbs: 0.53 },
    },
  },
  bulk: {
    strength: {
      lean_gain:   { protein: 0.32, fat: 0.27, carbs: 0.41 },
      balanced:    { protein: 0.28, fat: 0.28, carbs: 0.44 },
      performance: { protein: 0.25, fat: 0.27, carbs: 0.48 },
    },
    mixed: {
      lean_gain:   { protein: 0.28, fat: 0.28, carbs: 0.44 },
      balanced:    { protein: 0.25, fat: 0.28, carbs: 0.47 },
      performance: { protein: 0.23, fat: 0.27, carbs: 0.50 },
    },
    endurance: {
      lean_gain:   { protein: 0.25, fat: 0.27, carbs: 0.48 },
      balanced:    { protein: 0.22, fat: 0.28, carbs: 0.50 },
      performance: { protein: 0.20, fat: 0.27, carbs: 0.53 },
    },
  },
};

/** Absolute minimum protein in g/lb — below this, muscle loss risk increases */
const PROTEIN_FLOOR_G_PER_LB: Record<MacroGoal, number> = {
  cut: 1.0,       // ISSN minimum during deficit
  maintain: 0.8,  // general active population
  bulk: 0.8,      // surplus is protective
};

/** Absolute minimum fat in g/lb — hormonal health floor */
const FAT_FLOOR_G_PER_LB = 0.25;

// ── Calculation ────────────────────────────────────────────────────────

export function calculateMacros(input: MacroInput): MacroResult {
  const {
    sex, weightLbs, heightCm, age, activityLevel, goal,
    trainingStyle = "mixed",
    priority = "balanced",
  } = input;

  const weightKg = weightLbs * 0.453592;

  // Step 1: BMR (Mifflin-St Jeor)
  const bmr =
    10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);

  // Step 2: TDEE
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2;
  const tdee = bmr * multiplier;

  // Step 3: Goal-adjusted calories
  let calFactor = GOAL_CALORIE_FACTOR[goal];
  if (goal === "cut") {
    calFactor -= CUT_ACTIVITY_DEFICIT_BONUS[activityLevel] ?? 0;
  }
  const rawCal = Math.round(tdee * calFactor);
  const minCal = sex === "female" ? 1200 : 1500;
  const calories = Math.max(rawCal, minCal);

  // Step 4: Look up percentage split based on goal + training + priority
  const split = MACRO_SPLITS[goal]?.[trainingStyle]?.[priority]
    ?? MACRO_SPLITS[goal]?.mixed?.balanced
    ?? { protein: 0.30, fat: 0.28, carbs: 0.42 };

  // Step 5: Calculate grams from percentages
  let protein = Math.round((calories * split.protein) / 4);
  let fat = Math.round((calories * split.fat) / 9);
  let carbs = Math.round((calories * split.carbs) / 4);

  // Step 6: Enforce g/lb floors
  const proteinFloor = Math.round(weightLbs * PROTEIN_FLOOR_G_PER_LB[goal]);
  if (protein < proteinFloor) {
    protein = proteinFloor;
  }

  const fatFloor = Math.round(weightLbs * FAT_FLOOR_G_PER_LB);
  if (fat < fatFloor) {
    fat = fatFloor;
  }

  // Step 7: Recalculate carbs as remainder (protein and fat take priority)
  const carbCals = calories - protein * 4 - fat * 9;
  carbs = Math.max(0, Math.round(carbCals / 4));

  // Step 8: Rebalance for cutting — protein should be >= carbs in grams
  if (goal === "cut" && carbs > protein) {
    const maxProtein = Math.round(weightLbs * 1.45);
    while (carbs > protein && protein < maxProtein) {
      protein += 5;
      const newCarbCals = calories - protein * 4 - fat * 9;
      carbs = Math.max(0, Math.round(newCarbCals / 4));
    }
    if (protein > maxProtein) {
      protein = maxProtein;
      const newCarbCals = calories - protein * 4 - fat * 9;
      carbs = Math.max(0, Math.round(newCarbCals / 4));
    }
  }

  // Safety: if protein + fat exceed calories, reduce fat then protein
  if (carbs <= 0) {
    fat = Math.round(weightLbs * 0.22);
    const newCarbCals = calories - protein * 4 - fat * 9;
    carbs = Math.max(0, Math.round(newCarbCals / 4));
  }
  if (carbs <= 0) {
    protein = Math.round(weightLbs * 0.8);
    const newCarbCals = calories - protein * 4 - fat * 9;
    carbs = Math.max(0, Math.round(newCarbCals / 4));
  }

  return { calories, protein, carbs, fat, tdee: Math.round(tdee), bmr: Math.round(bmr) };
}

// ── Wizard goal mapping ────────────────────────────────────────────────

export type WizardGoal = "lose_fat" | "maintain" | "build_muscle" | "performance";

export function wizardGoalToMacroGoal(wg: WizardGoal): MacroGoal {
  switch (wg) {
    case "lose_fat": return "cut";
    case "build_muscle": return "bulk";
    case "performance": return "maintain";
    case "maintain":
    default: return "maintain";
  }
}

export type WizardActivityLevel = "light" | "moderate" | "very_active";

export function wizardActivityToMacroActivity(wa: WizardActivityLevel): MacroActivityLevel {
  return wa;
}
