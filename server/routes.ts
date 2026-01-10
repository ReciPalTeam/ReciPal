import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { planMeals, planDays, recipes, weeklyPlans, userProfiles } from "@shared/schema";
import { eq } from "drizzle-orm";
import { recipeService } from "./recipe-service";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePassword(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Logic Helpers
function calculateMacros(profile: any) {
  // Mifflin-St Jeor
  let bmr = 10 * (profile.weight * 0.453592) + 6.25 * profile.height - 5 * profile.age;
  bmr += profile.sex === 'male' ? 5 : -161;

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very: 1.9
  };
  
  let tdee = bmr * (activityMultipliers[profile.activityLevel] || 1.2);
  
  // Goal Adjustment
  if (profile.goal === 'cut') tdee *= 0.80; // Slightly more aggressive cut
  if (profile.goal === 'bulk') tdee *= 1.15;
  
  const targetCalories = Math.round(tdee);
  
  // PROTEIN PRIORITIZED - Higher protein intake across all goals
  // Using 1g per lb bodyweight as minimum, higher for cutting/active
  let proteinFactor = 1.0; // Base: 1g per lb
  if (profile.goal === 'cut') proteinFactor = 1.2; // Higher to preserve muscle during cut
  if (profile.goal === 'bulk') proteinFactor = 1.1; // Slightly higher for muscle building
  if (profile.activityLevel === 'active' || profile.activityLevel === 'very') {
    proteinFactor += 0.1; // Active individuals need more protein
  }
  
  const targetProtein = Math.round(profile.weight * proteinFactor);
  const proteinCals = targetProtein * 4;
  
  // Fat (20% of cals - reduced to give more room for protein)
  const targetFat = Math.round((targetCalories * 0.20) / 9);
  const fatCals = targetFat * 9;
  
  // Carbs (remainder after protein and fat)
  const targetCarbs = Math.round((targetCalories - proteinCals - fatCals) / 4);
  
  return { targetCalories, targetProtein, targetCarbs, targetFat };
}

// Macro-target-aware meal selection
interface MealSlotTarget {
  mealType: string;
  targetCalories: number;
  targetProtein: number;
}

// Calculate per-meal targets based on meal type distribution
function calculateMealSlotTargets(
  totalCalories: number,
  totalProtein: number,
  mealSlots: string[]
): MealSlotTarget[] {
  // Distribution percentages by meal type
  const calorieDistribution: Record<string, number> = {
    breakfast: 0.25,
    lunch: 0.30,
    dinner: 0.35,
    snack: 0.10
  };
  
  const proteinDistribution: Record<string, number> = {
    breakfast: 0.20,
    lunch: 0.30,
    dinner: 0.35,
    snack: 0.15
  };
  
  // Count each meal type
  const typeCounts: Record<string, number> = {};
  for (const type of mealSlots) {
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }
  
  // Normalize distributions based on actual meal counts
  let totalCalPct = 0;
  let totalProtPct = 0;
  for (const type of mealSlots) {
    totalCalPct += calorieDistribution[type] || 0.20;
    totalProtPct += proteinDistribution[type] || 0.20;
  }
  
  return mealSlots.map(type => {
    const calPct = (calorieDistribution[type] || 0.20) / totalCalPct;
    const protPct = (proteinDistribution[type] || 0.20) / totalProtPct;
    return {
      mealType: type,
      targetCalories: Math.round(totalCalories * calPct),
      targetProtein: Math.round(totalProtein * protPct)
    };
  });
}

// Score a recipe based on how close it is to targets (lower is better)
function scoreRecipe(
  recipe: any,
  targetCalories: number,
  targetProtein: number
): number {
  // Heavily penalize being UNDER protein target, less penalty for over
  const proteinDiff = recipe.protein - targetProtein;
  const proteinPenalty = proteinDiff < 0 ? Math.abs(proteinDiff) * 3 : proteinDiff * 0.5;
  
  // Moderate penalty for calorie deviation
  const calorieDiff = Math.abs(recipe.calories - targetCalories);
  const caloriePenalty = calorieDiff / 50; // Every 50 cal off = 1 point
  
  return proteinPenalty + caloriePenalty;
}

// Select best recipe for a slot considering targets and favorites
function selectRecipeForSlot(
  candidates: any[],
  targetCalories: number,
  targetProtein: number,
  usedRecipeIds: Set<number>,
  dayUsedRecipeIds: Set<number>,
  favoriteRecipeIds: Set<number> = new Set()
): any {
  if (candidates.length === 0) return null;
  
  // Score all candidates
  const scored = candidates.map(recipe => ({
    recipe,
    score: scoreRecipe(recipe, targetCalories, targetProtein),
    isUsedToday: dayUsedRecipeIds.has(recipe.id),
    isUsedThisWeek: usedRecipeIds.has(recipe.id),
    isFavorite: favoriteRecipeIds.has(recipe.id)
  }));
  
  // Sort by: not used today > favorites > not used this week > best score
  scored.sort((a, b) => {
    if (a.isUsedToday !== b.isUsedToday) return a.isUsedToday ? 1 : -1;
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    if (a.isUsedThisWeek !== b.isUsedThisWeek) return a.isUsedThisWeek ? 1 : -1;
    return a.score - b.score;
  });
  
  return scored[0]?.recipe || candidates[0];
}

// Generate meals for a day that meet macro targets with multi-pass optimization
function generateDayMeals(
  allRecipes: any[],
  mealSlots: string[],
  targetCalories: number,
  targetProtein: number,
  weekUsedRecipeIds: Set<number>,
  tolerance: number = 0.10, // 10% tolerance
  favoriteRecipeIds: Set<number> = new Set()
): { selections: any[], totals: { calories: number, protein: number } } {
  const slotTargets = calculateMealSlotTargets(targetCalories, targetProtein, mealSlots);
  const selections: any[] = [];
  const dayUsedRecipeIds = new Set<number>();
  
  let remainingCalories = targetCalories;
  let remainingProtein = targetProtein;
  
  // First pass: select recipes for each slot
  for (let i = 0; i < mealSlots.length; i++) {
    const slotTarget = slotTargets[i];
    const candidates = allRecipes.filter(r => r.mealType === slotTarget.mealType);
    
    // Adjust target based on remaining needs if we're past first slot
    const isLastSlot = i === mealSlots.length - 1;
    const adjustedCalTarget = isLastSlot ? remainingCalories : slotTarget.targetCalories;
    const adjustedProtTarget = isLastSlot ? remainingProtein : slotTarget.targetProtein;
    
    const recipe = selectRecipeForSlot(
      candidates,
      adjustedCalTarget,
      adjustedProtTarget,
      weekUsedRecipeIds,
      dayUsedRecipeIds,
      favoriteRecipeIds
    );
    
    if (recipe) {
      selections.push({ slotIndex: i, mealType: slotTarget.mealType, recipe });
      dayUsedRecipeIds.add(recipe.id);
      remainingCalories -= recipe.calories;
      remainingProtein -= recipe.protein;
    }
  }
  
  // Calculate actual totals
  const totals = selections.reduce((acc, sel) => ({
    calories: acc.calories + sel.recipe.calories,
    protein: acc.protein + sel.recipe.protein
  }), { calories: 0, protein: 0 });
  
  // Multi-pass optimization: try swapping ALL slots to close protein gap
  const proteinTolerance = targetProtein * tolerance;
  const maxSwapPasses = 3;
  
  for (let pass = 0; pass < maxSwapPasses && totals.protein < targetProtein - proteinTolerance; pass++) {
    let bestSwapGain = 0;
    let bestSwapIdx = -1;
    let bestSwapRecipe: any = null;
    
    // Check EVERY slot for the best protein improvement
    for (let i = 0; i < selections.length; i++) {
      const current = selections[i];
      const currentRecipeId = current.recipe.id;
      
      // Find best higher-protein alternative for this slot
      const candidates = allRecipes
        .filter(r => r.mealType === current.mealType && r.id !== currentRecipeId && !dayUsedRecipeIds.has(r.id))
        .filter(r => r.protein > current.recipe.protein);
      
      for (const candidate of candidates) {
        const proteinGain = candidate.protein - current.recipe.protein;
        const calorieDelta = Math.abs(candidate.calories - current.recipe.calories);
        
        // Prefer swaps that add protein without massive calorie increase
        const score = proteinGain - (calorieDelta / 100);
        
        if (score > bestSwapGain) {
          bestSwapGain = score;
          bestSwapIdx = i;
          bestSwapRecipe = candidate;
        }
      }
    }
    
    // Apply the best swap found
    if (bestSwapIdx >= 0 && bestSwapRecipe) {
      const oldRecipe = selections[bestSwapIdx].recipe;
      dayUsedRecipeIds.delete(oldRecipe.id);
      dayUsedRecipeIds.add(bestSwapRecipe.id);
      selections[bestSwapIdx].recipe = bestSwapRecipe;
      totals.calories = totals.calories - oldRecipe.calories + bestSwapRecipe.calories;
      totals.protein = totals.protein - oldRecipe.protein + bestSwapRecipe.protein;
    }
  }
  
  return { selections, totals };
}

// Calculate serving multipliers to close macro gaps (must hit BOTH calorie and protein minimums)
function calculateServingMultipliers(
  selections: { slotIndex: number; mealType: string; recipe: any }[],
  targetCalories: number,
  targetProtein: number,
  tolerance: number
): { slotIndex: number; mealType: string; recipe: any; servingMultiplier: number }[] {
  if (selections.length === 0) return [];
  
  // Calculate current totals with 1x servings
  let currentCalories = selections.reduce((acc, s) => acc + s.recipe.calories, 0);
  let currentProtein = selections.reduce((acc, s) => acc + s.recipe.protein, 0);
  
  // Initialize all servings to 1.0
  const result = selections.map(s => ({ ...s, servingMultiplier: 1.0 }));
  
  const proteinMin = targetProtein * (1 - tolerance);
  const calorieMin = targetCalories * (1 - tolerance);
  const calorieMax = targetCalories * (1 + tolerance);
  const maxMultiplier = 2.0; // Cap at 2x serving size
  const stepSize = 0.25; // Increase in 0.25 increments
  
  // Check if we need to scale at all (must hit BOTH calorie and protein minimums)
  const needsMoreProtein = currentProtein < proteinMin;
  const needsMoreCalories = currentCalories < calorieMin;
  
  if (!needsMoreProtein && !needsMoreCalories) {
    return result;
  }
  
  // Sort meals by protein density (protein per calorie) - scale most efficient ones first
  const sortedByDensity = result
    .map((r, idx) => ({ idx, density: r.recipe.protein / r.recipe.calories }))
    .sort((a, b) => b.density - a.density);
  
  // Iteratively scale up meals until we hit BOTH targets or calorie max
  for (const { idx } of sortedByDensity) {
    const meal = result[idx];
    
    while (
      (currentProtein < proteinMin || currentCalories < calorieMin) &&
      currentCalories < calorieMax &&
      meal.servingMultiplier < maxMultiplier
    ) {
      // Calculate the effect of increasing this meal's serving
      const proteinGain = meal.recipe.protein * stepSize;
      const calorieGain = meal.recipe.calories * stepSize;
      
      // Check if we'd exceed calorie max
      if (currentCalories + calorieGain > calorieMax) {
        break;
      }
      
      // Apply the increase
      meal.servingMultiplier += stepSize;
      currentCalories += calorieGain;
      currentProtein += proteinGain;
    }
    
    // If we've hit BOTH targets, stop scaling
    if (currentProtein >= proteinMin && currentCalories >= calorieMin) {
      break;
    }
  }
  
  return result;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production" },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false);
        const isValid = await comparePassword(password, user.password);
        if (!isValid) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // API Routes

  // Auth
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      req.login(user, (err) => {
        if (err) throw err;
        res.status(201).json({ id: user.id, username: user.username });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    res.json({ id: (req.user as any).id, username: (req.user as any).username });
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.user) return res.json(null);
    res.json({ id: (req.user as any).id, username: (req.user as any).username });
  });

  // Profile
  app.get(api.profile.get.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const profile = await storage.getProfile((req.user as any).id);
    if (!profile) return res.sendStatus(404);
    res.json(profile);
  });

  app.post(api.profile.create.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      // Check if user explicitly opted for custom macros via the flag from onboarding
      const useCustomMacros = req.body.useCustomMacros === true;
      
      let finalMacros;
      if (useCustomMacros && 
          req.body.targetProtein !== undefined && 
          req.body.targetCarbs !== undefined && 
          req.body.targetFat !== undefined) {
        // Use user-provided macros and calculate calories from them
        const protein = Number(req.body.targetProtein);
        const carbs = Number(req.body.targetCarbs);
        const fat = Number(req.body.targetFat);
        finalMacros = {
          targetProtein: protein,
          targetCarbs: carbs,
          targetFat: fat,
          targetCalories: (protein * 4) + (carbs * 4) + (fat * 9),
        };
      } else {
        // Calculate macros based on user stats
        finalMacros = calculateMacros(req.body);
      }
      
      const input = api.profile.create.input.parse({ ...req.body, ...finalMacros });
      const profile = await storage.createProfile({ ...input, userId: (req.user as any).id });
      res.status(201).json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else throw err;
    }
  });

  app.patch(api.profile.update.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const existing = await storage.getProfile((req.user as any).id);
      if (!existing) return res.sendStatus(404);
      
      const input = api.profile.update.input.parse(req.body);
      
      // If macros are being updated, recalculate calories from them
      let finalInput = { ...input };
      if (input.targetProtein !== undefined || input.targetCarbs !== undefined || input.targetFat !== undefined) {
        const protein = input.targetProtein ?? existing.targetProtein;
        const carbs = input.targetCarbs ?? existing.targetCarbs;
        const fat = input.targetFat ?? existing.targetFat;
        finalInput.targetCalories = (protein * 4) + (carbs * 4) + (fat * 9);
      }
      
      const profile = await storage.updateProfile((req.user as any).id, finalInput);
      res.json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else throw err;
    }
  });

  // Plans
  app.get(api.plans.current.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const plan = await storage.getCurrentWeeklyPlan((req.user as any).id);
    if (!plan) return res.status(404).json({ message: "No plan found" });
    
    const days = await storage.getWeeklyPlanDays(plan.id);
    res.json({ ...plan, days });
  });

  app.post(api.plans.generate.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const profile = await storage.getProfile(userId);
    if (!profile) return res.status(400).json({ message: "Profile required" });

    // Delete existing plan first (for regeneration)
    const existingPlan = await storage.getCurrentWeeklyPlan(userId);
    if (existingPlan) {
      const existingDays = await storage.getWeeklyPlanDays(existingPlan.id);
      for (const day of existingDays) {
        await db.delete(planMeals).where(eq(planMeals.planDayId, day.id));
      }
      await db.delete(planDays).where(eq(planDays.weeklyPlanId, existingPlan.id));
      await db.delete(weeklyPlans).where(eq(weeklyPlans.id, existingPlan.id));
    }

    // Generate new plan
    const startDate = new Date().toISOString().split('T')[0];
    const plan = await storage.createWeeklyPlan(userId, startDate);
    
    const allRecipes = await storage.getRecipes();
    const days = await storage.getWeeklyPlanDays(plan.id);
    const usedRecipeIds = new Set<number>();
    
    // Get user's favorite recipes to prioritize them in plan generation
    const favoriteRecipeIds = new Set(await storage.getFavoriteRecipeIds(userId));

    const tolerance = 0.10; // 10% tolerance
    const maxRetries = 5; // Max retries per day to meet targets

    for (const day of days) {
      const mealSlots: string[] = [];
      const mealsPerDay = profile.mealsPerDay;
      const snacksPerDay = profile.snacksPerDay;

      // Distribute meal types
      for (let i = 0; i < mealsPerDay; i++) mealSlots.push('lunch');
      if (mealsPerDay >= 1) mealSlots[0] = 'breakfast';
      if (mealsPerDay >= 3) mealSlots[mealsPerDay - 1] = 'dinner';
      for (let i = 0; i < snacksPerDay; i++) mealSlots.push('snack');

      // Retry loop to ensure day meets macro targets
      let bestSelections: any[] = [];
      let bestTotals = { calories: 0, protein: 0 };
      let bestProteinGap = Infinity;
      const excludedRecipeIds = new Set<number>(); // Ban low performers between attempts
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Create a temporary copy of used recipes for this attempt
        // Include both week-used recipes and excluded recipes from failed attempts
        const attemptUsedIds = new Set(Array.from(usedRecipeIds).concat(Array.from(excludedRecipeIds)));
        
        // Filter recipes to exclude banned ones
        const availableRecipes = allRecipes.filter(r => !excludedRecipeIds.has(r.id));
        
        const { selections, totals } = generateDayMeals(
          availableRecipes,
          mealSlots,
          profile.targetCalories,
          profile.targetProtein,
          attemptUsedIds,
          tolerance,
          favoriteRecipeIds
        );
        
        // Check if this attempt meets tolerance
        const proteinMin = profile.targetProtein * (1 - tolerance);
        const proteinGap = proteinMin - totals.protein;
        
        // Track best attempt (closest to meeting protein target)
        if (proteinGap < bestProteinGap) {
          bestProteinGap = proteinGap;
          bestSelections = selections;
          bestTotals = totals;
        }
        
        // If within tolerance, accept this day
        if (totals.protein >= proteinMin) {
          break;
        }
        
        // Ban the lowest-protein recipe from this attempt for next retry
        // This introduces variation between attempts
        if (selections.length > 0) {
          const lowestProteinRecipe = selections.reduce((lowest, sel) => 
            sel.recipe.protein < lowest.recipe.protein ? sel : lowest
          );
          excludedRecipeIds.add(lowestProteinRecipe.recipe.id);
        }
      }
      
      // Calculate serving multipliers to hit macro targets
      const selectionsWithMultipliers = calculateServingMultipliers(
        bestSelections,
        profile.targetCalories,
        profile.targetProtein,
        tolerance
      );
      
      // Insert meals with serving multipliers
      for (const sel of selectionsWithMultipliers) {
        usedRecipeIds.add(sel.recipe.id);
        await db.insert(planMeals).values({
          planDayId: day.id,
          slotIndex: sel.slotIndex,
          mealType: sel.mealType,
          recipeId: sel.recipe.id,
          servingMultiplier: sel.servingMultiplier,
          locked: false
        });
      }
    }
    
    res.status(201).json({ id: plan.id, message: "Plan generated" });
  });

  app.patch(api.meals.refresh.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const mealId = parseInt(req.params.id);
    const meal = await storage.getPlanMeal(mealId);
    if (!meal || meal.locked) return res.status(400).json({ message: "Cannot refresh locked meal" });

    // Get user profile for macro targets
    const profile = await storage.getProfile((req.user as any).id);
    if (!profile) return res.status(400).json({ message: "Profile required" });

    // Get current day's other meals to calculate remaining macro budget
    const planDay = await db.select().from(planDays).where(eq(planDays.id, meal.planDayId)).then(r => r[0]);
    if (!planDay) return res.status(400).json({ message: "Day not found" });
    
    const dayMeals = await db.select()
      .from(planMeals)
      .leftJoin(recipes, eq(planMeals.recipeId, recipes.id))
      .where(eq(planMeals.planDayId, planDay.id));
    
    // Calculate current day totals excluding the meal being swapped
    const otherMealsTotals = dayMeals
      .filter(m => m.plan_meals.id !== mealId)
      .reduce((acc, m) => ({
        calories: acc.calories + (m.recipes?.calories || 0),
        protein: acc.protein + (m.recipes?.protein || 0)
      }), { calories: 0, protein: 0 });
    
    // Calculate what we need from the replacement meal
    const neededCalories = profile.targetCalories - otherMealsTotals.calories;
    const neededProtein = profile.targetProtein - otherMealsTotals.protein;

    const recipeOptions = await storage.getRecipesByMealType(meal.mealType);
    if (recipeOptions.length === 0) {
      return res.status(400).json({ message: "No alternative recipes available" });
    }
    
    // Select recipe that best fills the macro gap, excluding current recipe
    const currentRecipeId = new Set([meal.recipeId]);
    const newRecipe = selectRecipeForSlot(
      recipeOptions,
      neededCalories,
      neededProtein,
      currentRecipeId,
      new Set()
    ) || recipeOptions[0];
    
    await storage.updatePlanMeal(mealId, { recipeId: newRecipe.id });
    const fullMeal = await db.select().from(planMeals).where(eq(planMeals.id, mealId)).leftJoin(recipes, eq(planMeals.recipeId, recipes.id)).then(r => ({...r[0].plan_meals, recipe: r[0].recipes!}));
    
    res.json(fullMeal);
  });
  
  app.patch(api.meals.toggleLock.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const updated = await storage.updatePlanMeal(parseInt(req.params.id), { locked: req.body.locked });
    res.json(updated);
  });

  // Dashboard
  app.get(api.dashboard.get.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const profile = await storage.getProfile(userId);
    if (!profile) return res.status(400).json({ message: "Profile required" });

    const plan = await storage.getCurrentWeeklyPlan(userId);
    const lifetime = await storage.getLifetimeSavings(userId);

    // Get today's meals if plan exists
    let nextMeal = null;
    if (plan) {
      const days = await storage.getWeeklyPlanDays(plan.id);
      const today = new Date().toISOString().split('T')[0];
      const todayDay = days.find(d => d.date === today);
      if (todayDay && todayDay.meals.length > 0) {
        nextMeal = { ...todayDay.meals[0], recipe: todayDay.meals[0].recipe };
      }
    }

    res.json({
      dailyCalories: profile.targetCalories,
      weeklySavings: 0, // Would compute from deals matching
      lifetimeSavings: lifetime,
      nextMeal
    });
  });

  // Cart
  app.get(api.cart.get.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const plan = await storage.getCurrentWeeklyPlan((req.user as any).id);
    if (!plan) return res.json({ items: [], summary: { totalItems: 0, estimatedCost: 0, potentialSavings: 0 } });
    
    const days = await storage.getWeeklyPlanDays(plan.id);
    
    // Aggregate ingredients with serving multiplier
    const aggregated: Record<string, any> = {};
    
    days.forEach(day => {
      day.meals.forEach(meal => {
        const multiplier = (meal as any).servingMultiplier || 1.0;
        meal.recipe.ingredients.forEach((ing: any) => {
          const scaledAmount = ing.amount * multiplier;
          if (aggregated[ing.name]) {
            aggregated[ing.name].amount += scaledAmount;
          } else {
            aggregated[ing.name] = { ...ing, amount: scaledAmount, isStaple: false, haveInPantry: false };
          }
        });
      });
    });

    // Simple Deal Matching
    const deals = await storage.getDeals(1); // Default store
    const items = Object.values(aggregated).map(item => {
        const deal = deals.find(d => d.itemName.toLowerCase().includes(item.name.toLowerCase()));
        if (deal) {
            item.matchedDeal = {
                storeName: "Default Store",
                regularPrice: deal.regularPrice,
                salePrice: deal.salePrice,
                savings: deal.regularPrice - deal.salePrice
            };
        }
        return item;
    });

    res.json({
      items,
      summary: {
        totalItems: items.length,
        estimatedCost: 0, // Todo
        potentialSavings: items.reduce((acc, i) => acc + (i.matchedDeal?.savings || 0), 0)
      }
    });
  });

  // Favorites
  app.get(api.favorites.list.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const favorites = await storage.getFavorites((req.user as any).id);
    res.json(favorites);
  });

  app.get(api.favorites.ids.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const ids = await storage.getFavoriteRecipeIds((req.user as any).id);
    res.json(ids);
  });

  app.post(api.favorites.add.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const recipeId = parseInt(req.params.recipeId);
    if (isNaN(recipeId)) return res.status(400).json({ message: "Invalid recipe ID" });
    
    const recipe = await storage.getRecipe(recipeId);
    if (!recipe) return res.status(400).json({ message: "Recipe not found" });
    
    const favorite = await storage.addFavorite((req.user as any).id, recipeId);
    res.status(201).json(favorite);
  });

  app.delete(api.favorites.remove.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const recipeId = parseInt(req.params.recipeId);
    if (isNaN(recipeId)) return res.status(400).json({ message: "Invalid recipe ID" });
    
    await storage.removeFavorite((req.user as any).id, recipeId);
    res.json({ message: "Removed from favorites" });
  });

  // Pantry
  app.get("/api/pantry", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const items = await storage.getPantryItems((req.user as any).id);
    res.json(items);
  });

  app.post("/api/pantry", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const item = await storage.createPantryItem({
      ...req.body,
      userId: (req.user as any).id,
    });
    res.status(201).json(item);
  });

  app.patch("/api/pantry/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const item = await storage.updatePantryItem(parseInt(req.params.id), (req.user as any).id, req.body);
    res.json(item);
  });

  app.delete("/api/pantry/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    await storage.deletePantryItem(parseInt(req.params.id), (req.user as any).id);
    res.sendStatus(204);
  });

  app.get("/api/recipes", async (req, res) => {
    const recipes = await storage.getRecipes();
    res.json(recipes);
  });

  // Seeding - only run if database is empty to avoid duplicates
  const existingRecipes = await storage.getRecipes();
  if (existingRecipes.length === 0) {
    console.log("Seeding Database with recipes...");
    
    // Seed Recipes - 50+ diverse recipes with high-protein focus for macro targets
    const seedRecipes = [
      // BREAKFASTS (12) - More high-protein options
      { name: "Oatmeal & Berries", mealType: "breakfast", prepTimeMinutes: 10, calories: 350, protein: 12, carbs: 60, fat: 6, ingredients: [{name: "oats", amount: 50, unit: "g", category: "pantry"}, {name: "mixed berries", amount: 100, unit: "g", category: "produce"}, {name: "honey", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Boil water", "Add oats and cook 5 min", "Top with berries and honey"], tags: ["vegetarian", "quick"], allergens: [] },
      { name: "Scrambled Eggs & Avocado Toast", mealType: "breakfast", prepTimeMinutes: 12, calories: 450, protein: 22, carbs: 32, fat: 26, ingredients: [{name: "eggs", amount: 3, unit: "count", category: "dairy"}, {name: "whole wheat bread", amount: 2, unit: "slices", category: "bakery"}, {name: "avocado", amount: 0.5, unit: "count", category: "produce"}], instructions: ["Scramble eggs in pan", "Toast bread", "Mash avocado on toast", "Serve together"], tags: ["vegetarian", "high-protein"], allergens: ["eggs", "wheat"] },
      { name: "Protein Pancakes", mealType: "breakfast", prepTimeMinutes: 20, calories: 520, protein: 42, carbs: 52, fat: 14, ingredients: [{name: "protein powder", amount: 40, unit: "g", category: "pantry"}, {name: "oats", amount: 50, unit: "g", category: "pantry"}, {name: "egg whites", amount: 150, unit: "ml", category: "dairy"}, {name: "banana", amount: 1, unit: "count", category: "produce"}, {name: "greek yogurt", amount: 100, unit: "g", category: "dairy"}], instructions: ["Blend all ingredients", "Cook on griddle", "Top with yogurt"], tags: ["high-protein"], allergens: ["eggs", "dairy"] },
      { name: "Greek Yogurt Parfait", mealType: "breakfast", prepTimeMinutes: 5, calories: 450, protein: 35, carbs: 48, fat: 14, ingredients: [{name: "greek yogurt", amount: 300, unit: "g", category: "dairy"}, {name: "granola", amount: 50, unit: "g", category: "pantry"}, {name: "mixed berries", amount: 100, unit: "g", category: "produce"}, {name: "honey", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Layer yogurt in bowl", "Add granola", "Top with berries and honey"], tags: ["vegetarian", "quick", "high-protein"], allergens: ["dairy"] },
      { name: "Breakfast Burrito", mealType: "breakfast", prepTimeMinutes: 15, calories: 580, protein: 38, carbs: 48, fat: 26, ingredients: [{name: "eggs", amount: 4, unit: "count", category: "dairy"}, {name: "flour tortilla", amount: 1, unit: "large", category: "bakery"}, {name: "black beans", amount: 80, unit: "g", category: "pantry"}, {name: "cheese", amount: 40, unit: "g", category: "dairy"}, {name: "salsa", amount: 40, unit: "g", category: "pantry"}, {name: "chicken sausage", amount: 60, unit: "g", category: "meat"}], instructions: ["Scramble eggs with sausage", "Warm tortilla", "Add beans, eggs, cheese", "Roll and top with salsa"], tags: ["high-protein"], allergens: ["eggs", "wheat", "dairy"] },
      { name: "Smoothie Bowl", mealType: "breakfast", prepTimeMinutes: 8, calories: 420, protein: 32, carbs: 55, fat: 10, ingredients: [{name: "frozen banana", amount: 1, unit: "count", category: "produce"}, {name: "protein powder", amount: 35, unit: "g", category: "pantry"}, {name: "greek yogurt", amount: 150, unit: "g", category: "dairy"}, {name: "almond milk", amount: 100, unit: "ml", category: "dairy"}, {name: "chia seeds", amount: 15, unit: "g", category: "pantry"}], instructions: ["Blend banana, protein, yogurt, and milk until thick", "Pour into bowl", "Top with chia seeds"], tags: ["vegetarian", "quick", "high-protein"], allergens: ["dairy", "nuts"] },
      { name: "Veggie Egg Muffins", mealType: "breakfast", prepTimeMinutes: 25, calories: 380, protein: 32, carbs: 12, fat: 24, ingredients: [{name: "eggs", amount: 6, unit: "count", category: "dairy"}, {name: "spinach", amount: 80, unit: "g", category: "produce"}, {name: "bell pepper", amount: 60, unit: "g", category: "produce"}, {name: "feta cheese", amount: 50, unit: "g", category: "dairy"}, {name: "turkey bacon", amount: 40, unit: "g", category: "meat"}], instructions: ["Whisk eggs", "Add chopped veggies, bacon, and cheese", "Pour into muffin tin", "Bake at 350F for 20 min"], tags: ["high-protein", "meal-prep", "low-carb"], allergens: ["eggs", "dairy"] },
      { name: "Overnight Protein Oats", mealType: "breakfast", prepTimeMinutes: 5, calories: 480, protein: 35, carbs: 58, fat: 14, ingredients: [{name: "oats", amount: 60, unit: "g", category: "pantry"}, {name: "protein powder", amount: 30, unit: "g", category: "pantry"}, {name: "greek yogurt", amount: 150, unit: "g", category: "dairy"}, {name: "almond milk", amount: 100, unit: "ml", category: "dairy"}, {name: "peanut butter", amount: 20, unit: "g", category: "pantry"}], instructions: ["Mix all ingredients in jar", "Refrigerate overnight", "Eat cold or warm"], tags: ["vegetarian", "meal-prep", "high-protein"], allergens: ["dairy", "nuts"] },
      { name: "Steak and Eggs", mealType: "breakfast", prepTimeMinutes: 20, calories: 550, protein: 48, carbs: 8, fat: 38, ingredients: [{name: "sirloin steak", amount: 150, unit: "g", category: "meat"}, {name: "eggs", amount: 3, unit: "count", category: "dairy"}, {name: "butter", amount: 15, unit: "g", category: "dairy"}, {name: "spinach", amount: 60, unit: "g", category: "produce"}], instructions: ["Season and pan-sear steak", "Cook eggs in butter", "Saute spinach", "Serve together"], tags: ["high-protein", "keto", "low-carb"], allergens: ["eggs", "dairy"] },
      { name: "Cottage Cheese Pancakes", mealType: "breakfast", prepTimeMinutes: 15, calories: 440, protein: 38, carbs: 42, fat: 12, ingredients: [{name: "cottage cheese", amount: 200, unit: "g", category: "dairy"}, {name: "eggs", amount: 2, unit: "count", category: "dairy"}, {name: "oats", amount: 40, unit: "g", category: "pantry"}, {name: "banana", amount: 1, unit: "count", category: "produce"}], instructions: ["Blend all ingredients", "Cook on griddle until golden", "Serve with fruit"], tags: ["high-protein", "vegetarian"], allergens: ["eggs", "dairy"] },
      { name: "Salmon Breakfast Bowl", mealType: "breakfast", prepTimeMinutes: 15, calories: 520, protein: 42, carbs: 35, fat: 24, ingredients: [{name: "smoked salmon", amount: 120, unit: "g", category: "seafood"}, {name: "eggs", amount: 2, unit: "count", category: "dairy"}, {name: "avocado", amount: 0.5, unit: "count", category: "produce"}, {name: "whole grain toast", amount: 1, unit: "slice", category: "bakery"}, {name: "capers", amount: 10, unit: "g", category: "pantry"}], instructions: ["Poach or fry eggs", "Toast bread", "Arrange salmon, egg, and avocado", "Top with capers"], tags: ["high-protein"], allergens: ["eggs", "fish", "wheat"] },
      { name: "Turkey Sausage Scramble", mealType: "breakfast", prepTimeMinutes: 15, calories: 480, protein: 40, carbs: 18, fat: 28, ingredients: [{name: "turkey sausage", amount: 120, unit: "g", category: "meat"}, {name: "eggs", amount: 4, unit: "count", category: "dairy"}, {name: "bell pepper", amount: 80, unit: "g", category: "produce"}, {name: "onion", amount: 40, unit: "g", category: "produce"}, {name: "cheese", amount: 30, unit: "g", category: "dairy"}], instructions: ["Brown sausage", "Add peppers and onion", "Scramble in eggs", "Top with cheese"], tags: ["high-protein", "low-carb"], allergens: ["eggs", "dairy"] },
      { name: "Bodybuilder Breakfast", mealType: "breakfast", prepTimeMinutes: 20, calories: 650, protein: 58, carbs: 48, fat: 26, ingredients: [{name: "egg whites", amount: 200, unit: "ml", category: "dairy"}, {name: "eggs", amount: 2, unit: "count", category: "dairy"}, {name: "chicken breast", amount: 100, unit: "g", category: "meat"}, {name: "oats", amount: 60, unit: "g", category: "pantry"}, {name: "banana", amount: 1, unit: "count", category: "produce"}], instructions: ["Cook egg whites and whole eggs", "Grill chicken", "Prepare oats with banana", "Serve together"], tags: ["high-protein", "meal-prep"], allergens: ["eggs"] },
      { name: "Power Protein Plate", mealType: "breakfast", prepTimeMinutes: 18, calories: 620, protein: 55, carbs: 38, fat: 28, ingredients: [{name: "ground turkey", amount: 150, unit: "g", category: "meat"}, {name: "eggs", amount: 3, unit: "count", category: "dairy"}, {name: "sweet potato", amount: 120, unit: "g", category: "produce"}, {name: "spinach", amount: 60, unit: "g", category: "produce"}, {name: "olive oil", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Brown turkey", "Fry eggs", "Roast sweet potato cubes", "Saute spinach", "Plate together"], tags: ["high-protein"], allergens: ["eggs"] },
      { name: "Triple Egg Protein Bowl", mealType: "breakfast", prepTimeMinutes: 15, calories: 580, protein: 52, carbs: 32, fat: 28, ingredients: [{name: "eggs", amount: 5, unit: "count", category: "dairy"}, {name: "cottage cheese", amount: 150, unit: "g", category: "dairy"}, {name: "whole wheat toast", amount: 2, unit: "slices", category: "bakery"}, {name: "avocado", amount: 0.5, unit: "count", category: "produce"}], instructions: ["Scramble eggs", "Toast bread", "Serve eggs over toast with cottage cheese and avocado"], tags: ["high-protein", "vegetarian"], allergens: ["eggs", "dairy", "wheat"] },
      
      // LUNCHES (12) - More high-protein options
      { name: "Grilled Chicken Salad", mealType: "lunch", prepTimeMinutes: 15, calories: 520, protein: 50, carbs: 14, fat: 30, ingredients: [{name: "chicken breast", amount: 180, unit: "g", category: "meat"}, {name: "mixed greens", amount: 150, unit: "g", category: "produce"}, {name: "cherry tomatoes", amount: 80, unit: "g", category: "produce"}, {name: "olive oil", amount: 2, unit: "tbsp", category: "pantry"}, {name: "feta cheese", amount: 40, unit: "g", category: "dairy"}], instructions: ["Grill chicken breast", "Toss greens with tomatoes", "Slice chicken and add to salad", "Drizzle with olive oil"], tags: ["high-protein", "low-carb"], allergens: ["dairy"] },
      { name: "Turkey Wrap", mealType: "lunch", prepTimeMinutes: 10, calories: 480, protein: 42, carbs: 40, fat: 18, ingredients: [{name: "turkey breast", amount: 150, unit: "g", category: "meat"}, {name: "whole wheat wrap", amount: 1, unit: "large", category: "bakery"}, {name: "lettuce", amount: 50, unit: "g", category: "produce"}, {name: "tomato", amount: 50, unit: "g", category: "produce"}, {name: "cheese", amount: 30, unit: "g", category: "dairy"}, {name: "mustard", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Lay wrap flat", "Layer turkey, cheese, lettuce, tomato", "Add mustard", "Roll tightly"], tags: ["high-protein", "quick"], allergens: ["wheat", "dairy"] },
      { name: "Chicken & Quinoa Bowl", mealType: "lunch", prepTimeMinutes: 20, calories: 580, protein: 48, carbs: 55, fat: 18, ingredients: [{name: "chicken breast", amount: 160, unit: "g", category: "meat"}, {name: "quinoa", amount: 80, unit: "g", category: "pantry"}, {name: "chickpeas", amount: 80, unit: "g", category: "pantry"}, {name: "cucumber", amount: 80, unit: "g", category: "produce"}, {name: "tzatziki", amount: 60, unit: "g", category: "dairy"}], instructions: ["Cook quinoa", "Grill chicken", "Arrange all ingredients in bowl", "Top with tzatziki"], tags: ["high-protein"], allergens: ["dairy"] },
      { name: "Tuna Salad Sandwich", mealType: "lunch", prepTimeMinutes: 10, calories: 500, protein: 45, carbs: 38, fat: 20, ingredients: [{name: "canned tuna", amount: 150, unit: "g", category: "pantry"}, {name: "whole wheat bread", amount: 2, unit: "slices", category: "bakery"}, {name: "greek yogurt", amount: 40, unit: "g", category: "dairy"}, {name: "celery", amount: 30, unit: "g", category: "produce"}, {name: "lettuce", amount: 30, unit: "g", category: "produce"}], instructions: ["Drain tuna", "Mix with yogurt and diced celery", "Spread on bread with lettuce"], tags: ["high-protein", "quick"], allergens: ["fish", "wheat", "dairy"] },
      { name: "Chicken Stir-Fry Rice Bowl", mealType: "lunch", prepTimeMinutes: 20, calories: 600, protein: 48, carbs: 58, fat: 18, ingredients: [{name: "chicken breast", amount: 170, unit: "g", category: "meat"}, {name: "brown rice", amount: 100, unit: "g", category: "pantry"}, {name: "broccoli", amount: 120, unit: "g", category: "produce"}, {name: "soy sauce", amount: 2, unit: "tbsp", category: "pantry"}, {name: "sesame oil", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Cook rice", "Stir-fry chicken", "Add broccoli and soy sauce", "Serve over rice"], tags: ["high-protein"], allergens: ["soy"] },
      { name: "Mediterranean Chicken Bowl", mealType: "lunch", prepTimeMinutes: 15, calories: 550, protein: 45, carbs: 42, fat: 24, ingredients: [{name: "chicken breast", amount: 150, unit: "g", category: "meat"}, {name: "farro", amount: 80, unit: "g", category: "pantry"}, {name: "cucumber", amount: 80, unit: "g", category: "produce"}, {name: "cherry tomatoes", amount: 80, unit: "g", category: "produce"}, {name: "feta cheese", amount: 50, unit: "g", category: "dairy"}, {name: "olives", amount: 30, unit: "g", category: "pantry"}], instructions: ["Cook farro", "Grill chicken", "Combine all ingredients", "Drizzle with olive oil"], tags: ["high-protein"], allergens: ["wheat", "dairy"] },
      { name: "Beef Burrito Bowl", mealType: "lunch", prepTimeMinutes: 20, calories: 620, protein: 48, carbs: 52, fat: 26, ingredients: [{name: "lean ground beef", amount: 150, unit: "g", category: "meat"}, {name: "brown rice", amount: 80, unit: "g", category: "pantry"}, {name: "black beans", amount: 80, unit: "g", category: "pantry"}, {name: "avocado", amount: 0.5, unit: "count", category: "produce"}, {name: "salsa", amount: 60, unit: "g", category: "pantry"}, {name: "cheese", amount: 30, unit: "g", category: "dairy"}], instructions: ["Cook rice", "Brown beef with taco seasoning", "Assemble bowl", "Top with cheese and salsa"], tags: ["high-protein"], allergens: ["dairy"] },
      { name: "Shrimp Caesar Salad", mealType: "lunch", prepTimeMinutes: 15, calories: 480, protein: 42, carbs: 18, fat: 28, ingredients: [{name: "shrimp", amount: 170, unit: "g", category: "seafood"}, {name: "romaine lettuce", amount: 150, unit: "g", category: "produce"}, {name: "parmesan cheese", amount: 35, unit: "g", category: "dairy"}, {name: "caesar dressing", amount: 35, unit: "g", category: "pantry"}, {name: "croutons", amount: 20, unit: "g", category: "bakery"}], instructions: ["Grill shrimp", "Chop romaine", "Toss with dressing", "Top with shrimp and parmesan"], tags: ["high-protein"], allergens: ["shellfish", "dairy", "wheat"] },
      { name: "Salmon Poke Bowl", mealType: "lunch", prepTimeMinutes: 15, calories: 560, protein: 40, carbs: 52, fat: 22, ingredients: [{name: "salmon fillet", amount: 150, unit: "g", category: "seafood"}, {name: "sushi rice", amount: 100, unit: "g", category: "pantry"}, {name: "edamame", amount: 60, unit: "g", category: "produce"}, {name: "cucumber", amount: 60, unit: "g", category: "produce"}, {name: "soy sauce", amount: 2, unit: "tbsp", category: "pantry"}, {name: "sesame seeds", amount: 10, unit: "g", category: "pantry"}], instructions: ["Cook rice", "Cube salmon", "Arrange bowl with toppings", "Drizzle with soy sauce"], tags: ["high-protein"], allergens: ["fish", "soy"] },
      { name: "Chicken Gyro Bowl", mealType: "lunch", prepTimeMinutes: 20, calories: 580, protein: 46, carbs: 48, fat: 24, ingredients: [{name: "chicken thigh", amount: 160, unit: "g", category: "meat"}, {name: "pita bread", amount: 1, unit: "count", category: "bakery"}, {name: "cucumber", amount: 80, unit: "g", category: "produce"}, {name: "tomato", amount: 80, unit: "g", category: "produce"}, {name: "tzatziki", amount: 80, unit: "g", category: "dairy"}, {name: "red onion", amount: 30, unit: "g", category: "produce"}], instructions: ["Grill seasoned chicken", "Warm pita", "Arrange bowl", "Top with tzatziki"], tags: ["high-protein"], allergens: ["wheat", "dairy"] },
      { name: "High Protein Cobb Salad", mealType: "lunch", prepTimeMinutes: 15, calories: 620, protein: 52, carbs: 12, fat: 42, ingredients: [{name: "chicken breast", amount: 150, unit: "g", category: "meat"}, {name: "bacon", amount: 40, unit: "g", category: "meat"}, {name: "hard boiled eggs", amount: 2, unit: "count", category: "dairy"}, {name: "mixed greens", amount: 150, unit: "g", category: "produce"}, {name: "blue cheese", amount: 40, unit: "g", category: "dairy"}, {name: "avocado", amount: 0.5, unit: "count", category: "produce"}], instructions: ["Grill chicken", "Cook bacon crispy", "Boil eggs", "Arrange salad", "Top with cheese"], tags: ["high-protein", "keto"], allergens: ["eggs", "dairy"] },
      { name: "Turkey Meatball Sub", mealType: "lunch", prepTimeMinutes: 25, calories: 580, protein: 45, carbs: 52, fat: 22, ingredients: [{name: "ground turkey", amount: 150, unit: "g", category: "meat"}, {name: "sub roll", amount: 1, unit: "count", category: "bakery"}, {name: "marinara sauce", amount: 100, unit: "g", category: "pantry"}, {name: "mozzarella cheese", amount: 40, unit: "g", category: "dairy"}, {name: "parmesan", amount: 15, unit: "g", category: "dairy"}], instructions: ["Form meatballs and bake", "Warm sub roll", "Add meatballs and sauce", "Top with cheese and broil"], tags: ["high-protein"], allergens: ["wheat", "dairy"] },
      
      // DINNERS (12) - More high-protein options
      { name: "Grilled Salmon with Asparagus", mealType: "dinner", prepTimeMinutes: 25, calories: 580, protein: 48, carbs: 14, fat: 38, ingredients: [{name: "salmon fillet", amount: 200, unit: "g", category: "seafood"}, {name: "asparagus", amount: 180, unit: "g", category: "produce"}, {name: "lemon", amount: 1, unit: "count", category: "produce"}, {name: "olive oil", amount: 2, unit: "tbsp", category: "pantry"}, {name: "garlic", amount: 2, unit: "cloves", category: "produce"}], instructions: ["Season salmon with lemon and garlic", "Grill salmon 4-5 min per side", "Roast asparagus with olive oil", "Serve together"], tags: ["high-protein", "low-carb", "keto"], allergens: ["fish"] },
      { name: "Lean Beef Stir-Fry", mealType: "dinner", prepTimeMinutes: 25, calories: 640, protein: 52, carbs: 50, fat: 24, ingredients: [{name: "lean beef", amount: 200, unit: "g", category: "meat"}, {name: "brown rice", amount: 100, unit: "g", category: "pantry"}, {name: "bell peppers", amount: 120, unit: "g", category: "produce"}, {name: "snap peas", amount: 100, unit: "g", category: "produce"}, {name: "soy sauce", amount: 2, unit: "tbsp", category: "pantry"}], instructions: ["Cook rice", "Slice beef thinly", "Stir-fry beef and veggies", "Add soy sauce", "Serve over rice"], tags: ["high-protein"], allergens: ["soy"] },
      { name: "Baked Chicken Thighs", mealType: "dinner", prepTimeMinutes: 40, calories: 620, protein: 48, carbs: 38, fat: 30, ingredients: [{name: "chicken thighs", amount: 250, unit: "g", category: "meat"}, {name: "sweet potato", amount: 180, unit: "g", category: "produce"}, {name: "green beans", amount: 120, unit: "g", category: "produce"}, {name: "garlic", amount: 4, unit: "cloves", category: "produce"}, {name: "olive oil", amount: 2, unit: "tbsp", category: "pantry"}], instructions: ["Season chicken with garlic", "Cube sweet potato", "Bake everything at 400F for 35 min"], tags: ["high-protein", "meal-prep"], allergens: [] },
      { name: "Shrimp Pasta", mealType: "dinner", prepTimeMinutes: 25, calories: 680, protein: 46, carbs: 70, fat: 24, ingredients: [{name: "shrimp", amount: 200, unit: "g", category: "seafood"}, {name: "whole wheat pasta", amount: 120, unit: "g", category: "pantry"}, {name: "cherry tomatoes", amount: 120, unit: "g", category: "produce"}, {name: "garlic", amount: 4, unit: "cloves", category: "produce"}, {name: "olive oil", amount: 2, unit: "tbsp", category: "pantry"}, {name: "parmesan", amount: 25, unit: "g", category: "dairy"}], instructions: ["Cook pasta", "Saute garlic in olive oil", "Add shrimp and tomatoes", "Toss with pasta and parmesan"], tags: ["high-protein"], allergens: ["shellfish", "wheat", "dairy"] },
      { name: "Turkey Meatballs with Zucchini Noodles", mealType: "dinner", prepTimeMinutes: 30, calories: 540, protein: 48, carbs: 20, fat: 32, ingredients: [{name: "ground turkey", amount: 220, unit: "g", category: "meat"}, {name: "zucchini", amount: 250, unit: "g", category: "produce"}, {name: "marinara sauce", amount: 150, unit: "g", category: "pantry"}, {name: "parmesan cheese", amount: 30, unit: "g", category: "dairy"}], instructions: ["Form turkey into meatballs", "Bake at 400F for 20 min", "Spiralize zucchini", "Top with sauce and cheese"], tags: ["high-protein", "low-carb"], allergens: ["dairy"] },
      { name: "Grilled Chicken Breast", mealType: "dinner", prepTimeMinutes: 25, calories: 580, protein: 55, carbs: 35, fat: 24, ingredients: [{name: "chicken breast", amount: 220, unit: "g", category: "meat"}, {name: "quinoa", amount: 80, unit: "g", category: "pantry"}, {name: "broccoli", amount: 150, unit: "g", category: "produce"}, {name: "olive oil", amount: 2, unit: "tbsp", category: "pantry"}, {name: "lemon", amount: 0.5, unit: "count", category: "produce"}], instructions: ["Grill seasoned chicken", "Cook quinoa", "Steam broccoli", "Serve with lemon"], tags: ["high-protein", "meal-prep"], allergens: [] },
      { name: "Pork Tenderloin with Roasted Vegetables", mealType: "dinner", prepTimeMinutes: 40, calories: 580, protein: 50, carbs: 32, fat: 28, ingredients: [{name: "pork tenderloin", amount: 220, unit: "g", category: "meat"}, {name: "brussels sprouts", amount: 150, unit: "g", category: "produce"}, {name: "carrots", amount: 120, unit: "g", category: "produce"}, {name: "olive oil", amount: 2, unit: "tbsp", category: "pantry"}, {name: "rosemary", amount: 5, unit: "g", category: "produce"}], instructions: ["Season pork with rosemary", "Roast pork at 400F for 25 min", "Roast vegetables alongside", "Rest meat before slicing"], tags: ["high-protein"], allergens: [] },
      { name: "Stuffed Bell Peppers", mealType: "dinner", prepTimeMinutes: 45, calories: 560, protein: 42, carbs: 42, fat: 26, ingredients: [{name: "bell peppers", amount: 2, unit: "large", category: "produce"}, {name: "ground beef", amount: 180, unit: "g", category: "meat"}, {name: "brown rice", amount: 80, unit: "g", category: "pantry"}, {name: "tomato sauce", amount: 120, unit: "g", category: "pantry"}, {name: "cheese", amount: 50, unit: "g", category: "dairy"}], instructions: ["Cook rice and beef", "Mix with tomato sauce", "Stuff peppers", "Top with cheese", "Bake at 375F for 30 min"], tags: ["high-protein", "meal-prep"], allergens: ["dairy"] },
      { name: "Herb-Crusted Cod", mealType: "dinner", prepTimeMinutes: 25, calories: 520, protein: 48, carbs: 30, fat: 22, ingredients: [{name: "cod fillet", amount: 200, unit: "g", category: "seafood"}, {name: "panko breadcrumbs", amount: 30, unit: "g", category: "pantry"}, {name: "parsley", amount: 10, unit: "g", category: "produce"}, {name: "roasted potatoes", amount: 150, unit: "g", category: "produce"}, {name: "green beans", amount: 100, unit: "g", category: "produce"}], instructions: ["Coat cod in herb breadcrumbs", "Bake at 400F for 15 min", "Roast potatoes", "Steam beans"], tags: ["high-protein"], allergens: ["fish", "wheat"] },
      { name: "Chicken Fajitas", mealType: "dinner", prepTimeMinutes: 25, calories: 580, protein: 48, carbs: 42, fat: 26, ingredients: [{name: "chicken breast", amount: 200, unit: "g", category: "meat"}, {name: "bell peppers", amount: 150, unit: "g", category: "produce"}, {name: "onion", amount: 80, unit: "g", category: "produce"}, {name: "flour tortillas", amount: 2, unit: "count", category: "bakery"}, {name: "sour cream", amount: 40, unit: "g", category: "dairy"}, {name: "cheese", amount: 30, unit: "g", category: "dairy"}], instructions: ["Slice and season chicken", "Saute with peppers and onions", "Warm tortillas", "Serve with toppings"], tags: ["high-protein"], allergens: ["wheat", "dairy"] },
      { name: "Steak with Sweet Potato", mealType: "dinner", prepTimeMinutes: 30, calories: 680, protein: 52, carbs: 42, fat: 34, ingredients: [{name: "sirloin steak", amount: 200, unit: "g", category: "meat"}, {name: "sweet potato", amount: 200, unit: "g", category: "produce"}, {name: "asparagus", amount: 120, unit: "g", category: "produce"}, {name: "butter", amount: 20, unit: "g", category: "dairy"}, {name: "garlic", amount: 2, unit: "cloves", category: "produce"}], instructions: ["Season and grill steak", "Bake sweet potato", "Roast asparagus", "Top steak with garlic butter"], tags: ["high-protein"], allergens: ["dairy"] },
      { name: "Lemon Herb Tilapia", mealType: "dinner", prepTimeMinutes: 20, calories: 480, protein: 46, carbs: 28, fat: 20, ingredients: [{name: "tilapia fillet", amount: 200, unit: "g", category: "seafood"}, {name: "lemon", amount: 1, unit: "count", category: "produce"}, {name: "brown rice", amount: 80, unit: "g", category: "pantry"}, {name: "zucchini", amount: 120, unit: "g", category: "produce"}, {name: "olive oil", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Season tilapia with lemon and herbs", "Pan-sear fish", "Cook rice", "Saute zucchini"], tags: ["high-protein"], allergens: ["fish"] },
      
      // SNACKS (14) - Including high-protein 30g+ options for high-target profiles
      { name: "Greek Yogurt with Honey", mealType: "snack", prepTimeMinutes: 2, calories: 220, protein: 24, carbs: 24, fat: 4, ingredients: [{name: "greek yogurt", amount: 220, unit: "g", category: "dairy"}, {name: "honey", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Scoop yogurt into bowl", "Drizzle with honey"], tags: ["high-protein", "quick", "vegetarian"], allergens: ["dairy"] },
      { name: "Protein Shake", mealType: "snack", prepTimeMinutes: 3, calories: 280, protein: 38, carbs: 18, fat: 6, ingredients: [{name: "protein powder", amount: 40, unit: "g", category: "pantry"}, {name: "almond milk", amount: 300, unit: "ml", category: "dairy"}, {name: "banana", amount: 0.5, unit: "count", category: "produce"}], instructions: ["Add all ingredients to blender", "Blend until smooth"], tags: ["high-protein", "quick"], allergens: ["nuts"] },
      { name: "Cottage Cheese with Berries", mealType: "snack", prepTimeMinutes: 2, calories: 240, protein: 28, carbs: 22, fat: 5, ingredients: [{name: "cottage cheese", amount: 200, unit: "g", category: "dairy"}, {name: "mixed berries", amount: 100, unit: "g", category: "produce"}], instructions: ["Scoop cottage cheese", "Top with berries"], tags: ["high-protein", "quick", "vegetarian"], allergens: ["dairy"] },
      { name: "Hard Boiled Eggs", mealType: "snack", prepTimeMinutes: 12, calories: 180, protein: 18, carbs: 2, fat: 12, ingredients: [{name: "eggs", amount: 3, unit: "count", category: "dairy"}, {name: "salt", amount: 1, unit: "pinch", category: "pantry"}], instructions: ["Boil eggs for 10 minutes", "Cool in ice water", "Peel and season"], tags: ["high-protein", "keto", "meal-prep"], allergens: ["eggs"] },
      { name: "Turkey Roll-Ups", mealType: "snack", prepTimeMinutes: 5, calories: 200, protein: 28, carbs: 6, fat: 8, ingredients: [{name: "turkey breast", amount: 120, unit: "g", category: "meat"}, {name: "cheese slices", amount: 40, unit: "g", category: "dairy"}, {name: "cucumber", amount: 60, unit: "g", category: "produce"}], instructions: ["Lay turkey slices flat", "Add cheese and cucumber", "Roll up and enjoy"], tags: ["high-protein", "quick", "low-carb"], allergens: ["dairy"] },
      { name: "Edamame", mealType: "snack", prepTimeMinutes: 5, calories: 190, protein: 18, carbs: 14, fat: 8, ingredients: [{name: "edamame", amount: 150, unit: "g", category: "produce"}, {name: "sea salt", amount: 1, unit: "pinch", category: "pantry"}], instructions: ["Steam or microwave edamame", "Season with salt"], tags: ["vegan", "high-protein", "quick"], allergens: ["soy"] },
      { name: "Beef Jerky & Almonds", mealType: "snack", prepTimeMinutes: 1, calories: 250, protein: 24, carbs: 12, fat: 14, ingredients: [{name: "beef jerky", amount: 50, unit: "g", category: "meat"}, {name: "almonds", amount: 25, unit: "g", category: "pantry"}], instructions: ["Portion jerky and almonds", "Enjoy together"], tags: ["high-protein", "quick"], allergens: ["nuts"] },
      { name: "Tuna on Crackers", mealType: "snack", prepTimeMinutes: 5, calories: 220, protein: 26, carbs: 16, fat: 6, ingredients: [{name: "canned tuna", amount: 100, unit: "g", category: "pantry"}, {name: "whole grain crackers", amount: 30, unit: "g", category: "pantry"}, {name: "lemon juice", amount: 1, unit: "tsp", category: "pantry"}], instructions: ["Drain tuna", "Season with lemon", "Serve on crackers"], tags: ["high-protein", "quick"], allergens: ["fish", "wheat"] },
      { name: "Cheese & Apple Slices", mealType: "snack", prepTimeMinutes: 3, calories: 240, protein: 16, carbs: 22, fat: 12, ingredients: [{name: "cheddar cheese", amount: 60, unit: "g", category: "dairy"}, {name: "apple", amount: 1, unit: "medium", category: "produce"}], instructions: ["Slice cheese and apple", "Serve together"], tags: ["vegetarian", "quick"], allergens: ["dairy"] },
      { name: "Protein Energy Balls", mealType: "snack", prepTimeMinutes: 10, calories: 260, protein: 20, carbs: 28, fat: 10, ingredients: [{name: "protein powder", amount: 30, unit: "g", category: "pantry"}, {name: "oats", amount: 40, unit: "g", category: "pantry"}, {name: "peanut butter", amount: 30, unit: "g", category: "pantry"}, {name: "honey", amount: 20, unit: "g", category: "pantry"}], instructions: ["Mix all ingredients", "Roll into balls", "Refrigerate for 30 min"], tags: ["high-protein", "meal-prep"], allergens: ["nuts"] },
      { name: "Double Protein Shake", mealType: "snack", prepTimeMinutes: 3, calories: 380, protein: 52, carbs: 28, fat: 8, ingredients: [{name: "protein powder", amount: 60, unit: "g", category: "pantry"}, {name: "greek yogurt", amount: 100, unit: "g", category: "dairy"}, {name: "almond milk", amount: 300, unit: "ml", category: "dairy"}, {name: "banana", amount: 0.5, unit: "count", category: "produce"}], instructions: ["Add all ingredients to blender", "Blend until smooth"], tags: ["high-protein", "quick"], allergens: ["dairy", "nuts"] },
      { name: "Chicken Breast Strips", mealType: "snack", prepTimeMinutes: 10, calories: 280, protein: 42, carbs: 4, fat: 10, ingredients: [{name: "chicken breast", amount: 150, unit: "g", category: "meat"}, {name: "olive oil", amount: 1, unit: "tsp", category: "pantry"}, {name: "seasoning", amount: 1, unit: "tsp", category: "pantry"}], instructions: ["Slice chicken into strips", "Season and pan-fry until cooked", "Serve warm or cold"], tags: ["high-protein", "keto", "meal-prep"], allergens: [] },
      { name: "Tuna Cucumber Boats", mealType: "snack", prepTimeMinutes: 8, calories: 260, protein: 36, carbs: 8, fat: 10, ingredients: [{name: "canned tuna", amount: 140, unit: "g", category: "pantry"}, {name: "cucumber", amount: 1, unit: "large", category: "produce"}, {name: "greek yogurt", amount: 30, unit: "g", category: "dairy"}, {name: "dill", amount: 1, unit: "tsp", category: "produce"}], instructions: ["Halve cucumber and scoop out seeds", "Mix tuna with yogurt and dill", "Fill cucumber boats"], tags: ["high-protein", "low-carb"], allergens: ["fish", "dairy"] },
      { name: "Cottage Cheese Protein Bowl", mealType: "snack", prepTimeMinutes: 3, calories: 320, protein: 42, carbs: 24, fat: 6, ingredients: [{name: "cottage cheese", amount: 300, unit: "g", category: "dairy"}, {name: "protein powder", amount: 15, unit: "g", category: "pantry"}, {name: "cinnamon", amount: 1, unit: "tsp", category: "pantry"}, {name: "honey", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Mix cottage cheese with protein powder", "Top with cinnamon and honey"], tags: ["high-protein", "quick", "vegetarian"], allergens: ["dairy"] }
    ];
    
    for (const r of seedRecipes) {
      await storage.createRecipe(r);
    }
    
    // Seed Store and Deals
    const existingStores = await storage.getStores();
    if (existingStores.length === 0) {
      const store = await storage.createStore({ name: "FreshMart" });
      await storage.createStoreDeal({ storeId: store.id, itemName: "chicken breast", category: "meat", regularPrice: 8.99, salePrice: 6.99, weekStartDate: new Date().toISOString() });
      await storage.createStoreDeal({ storeId: store.id, itemName: "salmon fillet", category: "seafood", regularPrice: 12.99, salePrice: 9.99, weekStartDate: new Date().toISOString() });
      await storage.createStoreDeal({ storeId: store.id, itemName: "greek yogurt", category: "dairy", regularPrice: 5.99, salePrice: 4.49, weekStartDate: new Date().toISOString() });
      await storage.createStoreDeal({ storeId: store.id, itemName: "oats", category: "pantry", regularPrice: 3.99, salePrice: 2.99, weekStartDate: new Date().toISOString() });
      await storage.createStoreDeal({ storeId: store.id, itemName: "mixed berries", category: "produce", regularPrice: 6.99, salePrice: 4.99, weekStartDate: new Date().toISOString() });
    }
    
    console.log("Seeding Complete - 53 recipes added");
  }

  return httpServer;
}
