import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { computeInsights } from "./insights";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { planMeals, planDays, recipes, weeklyPlans, userProfiles, userFavoriteRecipes, customRecipes, recipeRatings, chefProfiles, chefApplications, insertChefApplicationSchema, reels, musicTracks, reelLikes, reelSaves, reelShares, reelComments, users, hashtags, reelHashtags, notifications, chefRecipes, chefFollowers, reelViews } from "@shared/schema";
import { transcribeAudio, extractRecipeFromTranscript } from "./lib/recipe-extraction";
import { sql } from "drizzle-orm";
import { persistReelHashtags, reconcileReelHashtags } from "./lib/hashtags";
import { ilike, or, lt, inArray } from "drizzle-orm";
import { extractAudio } from "./lib/fingerprint/extract-audio";
import { getFingerprintProvider, FINGERPRINT_MATCH_THRESHOLD } from "./lib/fingerprint";
import { uploadToCloudflareStream } from "./lib/cfstream";
import { pollUntilReady } from "./lib/cfstreamStatusPoll";
import { computeChefRecipeNutrition } from "./lib/chefRecipeNutrition";
import { normalizeIngredients, toStoredShape } from "./lib/normalize-ingredients";
import multer from "multer";
import { eq, and, desc } from "drizzle-orm";
import {
  reelUploadLimiter,
  extractRecipeLimiter,
  loginLimiter,
  registerLimiter,
} from "./middleware/rateLimits";
import { recipeService } from "./recipe-service";
import { calculateMacros as calcMacrosShared, type MacroGoal, type MacroSex, type MacroActivityLevel } from "@shared/macros";
import connectPg from "connect-pg-simple";
import { searchRecipes, getRecipeById, searchFoods, getFoodById, fatsecretCall, fatsecretBarcodeLookup, fatsecretRecipeToCanonical, recipeCache, searchCache, getSearchCacheKey } from "./fatsecret";
import { getForYouFeed, getSomethingNewFeed, getRecipeByIdFromSupabase, searchRecipesInSupabase, getPlannerCandidates } from "./lib/recipeDb";
import { getAverageRatings, upsertRating } from "./lib/ratingsDb";
import { getDetailedNutrition } from "./lib/nutritionDb";
import { reconcileDisplayText } from "./reconcileDisplayText";
import { getScaledSteps } from "./scaledSteps";
import { getSupabaseClient } from "./lib/supabaseServer";
import { batchProcess } from "./lib/batchProcess";
import OpenAI from "openai";

const foodSearchCache = new Map<string, { data: any; timestamp: number }>();
const FOOD_SEARCH_CACHE_TTL = 10 * 60 * 1000;

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

// Logic Helpers — delegates to shared/macros.ts for consistent calculations
function calculateMacros(profile: any) {
  const result = calcMacrosShared({
    sex: profile.sex as MacroSex,
    weightLbs: profile.weight,
    heightCm: profile.height,
    age: profile.age,
    activityLevel: (profile.activityLevel || "moderate") as MacroActivityLevel,
    goal: (profile.goal || "maintain") as MacroGoal,
    trainingStyle: profile.trainingStyle || "mixed",
    priority: profile.priority || "balanced",
  });

  return {
    targetCalories: result.calories,
    targetProtein: result.protein,
    targetCarbs: result.carbs,
    targetFat: result.fat,
  };
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
  // Session setup (PostgreSQL-backed)
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const PgStore = connectPg(session);
  const sessionStore = new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  app.set("trust proxy", 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "recipal-dev-secret",
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: sessionTtl,
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // Local email/password authentication
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Admin bypass login
        if (username.toLowerCase() === "sellwithdealmate@gmail.com" && password === "admin123") {
          let user = await storage.getUserByUsername(username.toLowerCase());
          if (!user) {
            const hashedPassword = await hashPassword(password);
            user = await storage.createUser({
              username: "sellwithdealmate@gmail.com",
              password: hashedPassword,
              isPro: true,
              onboardingComplete: true,
            });
          }
          // Ensure admin profile always has Pro subscription tier
          const profile = await storage.getProfile(user.id);
          if (profile && profile.subscriptionTier !== 'pro') {
            await storage.updateProfile(user.id, { subscriptionTier: 'pro' });
          }
          return done(null, user);
        }

        // Free test account
        if (username.toLowerCase() === "free@recipal.com" && password === "free123") {
          let user = await storage.getUserByUsername(username.toLowerCase());
          if (!user) {
            const hashedPassword = await hashPassword(password);
            user = await storage.createUser({
              username: "free@recipal.com",
              password: hashedPassword,
              isPro: false,
              onboardingComplete: true,
            });
          }
          return done(null, user);
        }

        const user = await storage.getUserByUsername(username.toLowerCase());
        if (!user) return done(null, false);
        const isValid = await comparePassword(password, user.password);
        if (!isValid) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, { id: user.id });
  });

  passport.deserializeUser(async (data: any, done) => {
    try {
      const user = await storage.getUser(data.id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // API Routes

  // Auth
  app.post(api.auth.register.path, registerLimiter, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Pro membership and onboarding status for specific users
      let isPro = false;
      let onboardingComplete = false;
      
      // Automatic Pro for master admin
      if (input.username === "sellwithdealmate@gmail.com") {
        isPro = true;
        onboardingComplete = true;
      }
      
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ 
        ...input, 
        password: hashedPassword,
        isPro,
        onboardingComplete
      });
      req.login(user, (err) => {
        if (err) throw err;
        res.status(201).json({ id: user.id, username: user.username, isPro: user.isPro || false });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.post(api.auth.login.path, loginLimiter, passport.authenticate("local"), (req, res) => {
    res.json({ id: (req.user as any).id, username: (req.user as any).username, isPro: (req.user as any).isPro || false });
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.user) return res.json(null);
    res.json({ id: (req.user as any).id, username: (req.user as any).username, isPro: (req.user as any).isPro || false });
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
      
      let finalMacros: Record<string, number> = {};
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
      } else if (req.body.goal && req.body.sex && req.body.age && req.body.weight && req.body.height) {
        // Only calculate macros if user has provided stats (Pro flow)
        finalMacros = calculateMacros(req.body);
      }
      // Free onboarding: no macro calculation — fields stay null

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
        const protein = input.targetProtein ?? existing.targetProtein ?? 0;
        const carbs = input.targetCarbs ?? existing.targetCarbs ?? 0;
        const fat = input.targetFat ?? existing.targetFat ?? 0;
        finalInput.targetCalories = (protein * 4) + (carbs * 4) + (fat * 9);
      }
      
      const profile = await storage.updateProfile((req.user as any).id, finalInput);
      res.json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else throw err;
    }
  });

  // Macro Targets
  app.get("/api/macro-targets", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const targets = await storage.getMacroTargets((req.user as any).id);
    if (!targets) return res.status(404).json({ message: "No targets found" });
    res.json(targets);
  });

  app.post("/api/macro-targets", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const schema = z.object({
        calories: z.number().min(1000).max(10000),
        protein: z.number().min(0).max(500),
        carbs: z.number().min(0).max(1000),
        fat: z.number().min(0).max(500),
      });
      const targets = schema.parse(req.body);
      await storage.setMacroTargets((req.user as any).id, targets);
      res.json({ success: true, ...targets, isSet: true });
    } catch (err) {
      if (err instanceof z.ZodError) res.status(400).json({ message: err.errors[0].message });
      else throw err;
    }
  });

  app.delete("/api/macro-targets", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    await storage.clearMacroTargets((req.user as any).id);
    res.json({ success: true });
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
    // Plan generation needs meal counts and macro targets; bail with a clear error
    // rather than crashing later with NaN math.
    if (
      profile.mealsPerDay == null ||
      profile.snacksPerDay == null ||
      profile.targetCalories == null ||
      profile.targetProtein == null
    ) {
      return res.status(400).json({ message: "Set meals/snacks per day and macro targets before generating a plan." });
    }
    const mealsPerDay = profile.mealsPerDay;
    const snacksPerDay = profile.snacksPerDay;
    const targetCalories = profile.targetCalories;
    const targetProtein = profile.targetProtein;

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
          targetCalories,
          targetProtein,
          attemptUsedIds,
          tolerance,
          favoriteRecipeIds
        );

        // Check if this attempt meets tolerance
        const proteinMin = targetProtein * (1 - tolerance);
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
        targetCalories,
        targetProtein,
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
    if (profile.targetCalories == null || profile.targetProtein == null) {
      return res.status(400).json({ message: "Set macro targets before refreshing meals." });
    }

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
        calories: acc.calories + (m.app_recipes?.calories || 0),
        protein: acc.protein + (m.app_recipes?.protein || 0)
      }), { calories: 0, protein: 0 });

    // Calculate what we need from the replacement meal
    const neededCalories = profile.targetCalories - otherMealsTotals.calories;
    const neededProtein = profile.targetProtein - otherMealsTotals.protein;

    const recipeOptions = await storage.getRecipesByMealType(meal.mealType);
    if (recipeOptions.length === 0) {
      return res.status(400).json({ message: "No alternative recipes available" });
    }
    
    // Select recipe that best fills the macro gap, excluding current recipe
    // Filter out nulls — plan_meals.recipe_id can now be null (when chef_recipe_id is set instead).
    const currentRecipeId = new Set([meal.recipeId].filter((id): id is number => id != null));
    const newRecipe = selectRecipeForSlot(
      recipeOptions,
      neededCalories,
      neededProtein,
      currentRecipeId,
      new Set()
    ) || recipeOptions[0];
    
    await storage.updatePlanMeal(mealId, { recipeId: newRecipe.id });
    const fullMeal = await db.select().from(planMeals).where(eq(planMeals.id, mealId)).leftJoin(recipes, eq(planMeals.recipeId, recipes.id)).then(r => ({...r[0].plan_meals, recipe: r[0].app_recipes!}));
    
    res.json(fullMeal);
  });
  
  app.patch(api.meals.toggleLock.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const updated = await storage.updatePlanMeal(parseInt(req.params.id), { locked: req.body.locked });
    res.json(updated);
  });

  // Add recipe to plan
  app.post("/api/plan/add-recipe", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const { recipeId, chefRecipeId, dayIndex, mealType } = req.body;

    // Accept EITHER recipeId (app_recipes int id) OR chefRecipeId (chef_recipes int id).
    // The DB has a check constraint enforcing at least one is set.
    const hasRecipe = recipeId != null && Number.isFinite(Number(recipeId));
    const hasChefRecipe = chefRecipeId != null && Number.isFinite(Number(chefRecipeId));
    if ((!hasRecipe && !hasChefRecipe) || dayIndex === undefined || !mealType) {
      return res.status(400).json({ message: "recipeId or chefRecipeId required, plus dayIndex and mealType." });
    }

    let plan = await storage.getCurrentWeeklyPlan(userId);

    // Create plan if it doesn't exist
    if (!plan) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - dayOfWeek);
      const weekStartDate = weekStart.toISOString().split('T')[0];

      [plan] = await db.insert(weeklyPlans).values({ userId, weekStartDate }).returning();

      // Create 7 days
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + i);
        await db.insert(planDays).values({
          weeklyPlanId: plan.id,
          date: dayDate.toISOString().split('T')[0],
          dayOfWeek: i
        });
      }
    }

    const days = await storage.getWeeklyPlanDays(plan.id);
    const targetDay = days[dayIndex];

    if (!targetDay) {
      return res.status(400).json({ message: "Invalid day index" });
    }

    // Get current max slot index for this day
    const existingMeals = targetDay.meals || [];
    const maxSlot = existingMeals.length > 0
      ? Math.max(...existingMeals.map((m: any) => m.slotIndex || 0)) + 1
      : 0;

    const [newMeal] = await db.insert(planMeals).values({
      planDayId: targetDay.id,
      slotIndex: maxSlot,
      mealType,
      recipeId: hasRecipe ? Number(recipeId) : null,
      chefRecipeId: hasChefRecipe ? Number(chefRecipeId) : null,
      servingMultiplier: 1.0,
      locked: false,
      eaten: false
    }).returning();

    // Return the linked recipe payload — pick the one that's set.
    let recipeOut: any = null;
    if (hasRecipe) {
      recipeOut = await storage.getRecipe(Number(recipeId));
    } else if (hasChefRecipe) {
      const [cr] = await db.select().from(chefRecipes).where(eq(chefRecipes.id, Number(chefRecipeId))).limit(1);
      recipeOut = cr ?? null;
    }
    res.status(201).json({ ...newMeal, recipe: recipeOut });
  });

  // Remove meal from plan
  app.delete("/api/plan/meal/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const mealId = parseInt(req.params.id);
    await db.delete(planMeals).where(eq(planMeals.id, mealId));
    res.sendStatus(204);
  });

  // Mark meal as cooked (accelerates pantry decay)
  app.post("/api/plan/meal/:id/cooked", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const mealId = parseInt(req.params.id);
    
    const meal = await storage.getPlanMeal(mealId);
    if (!meal) return res.status(404).json({ message: "Meal not found" });
    // Mark-cooked currently only handles app_recipes-backed meals (the pantry decay logic
    // below joins ingredients out of recipes.ingredients). Chef-recipe meals: skip pantry
    // decay for now — they can still be marked cooked via /updateMealState below, but the
    // pantry side-effect requires expanding the ingredient join. Out of scope for H.4.
    if (meal.recipeId == null) {
      await storage.updateMealState(mealId, 'cooked');
      return res.sendStatus(204);
    }
    const recipe = await storage.getRecipe(meal.recipeId);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });

    // Mark meal as cooked with new mealState (handles double-count prevention)
    // If already autoCounted, changing to cooked doesn't re-count
    await storage.updateMealState(mealId, 'cooked');

    // Accelerate decay for matching pantry items
    const pantryItems = await storage.getPantryItems(userId);
    
    // Normalize for matching: lowercase, trim, remove plurals
    const normalize = (s: string) => s.toLowerCase().trim().replace(/s$/, '');
    
    for (const ingredient of recipe.ingredients) {
      const ingNorm = normalize(ingredient.name);
      // Require close match: either exact or pantry name starts with ingredient
      const pantryMatch = pantryItems.find((p: any) => {
        const pNorm = normalize(p.name);
        return pNorm === ingNorm || pNorm.startsWith(ingNorm + " ") || ingNorm.startsWith(pNorm + " ");
      });
      
      if (pantryMatch) {
        // Accelerate decay by reducing lastConfirmedAt by half the decay period
        const acceleratedDate = new Date(pantryMatch.lastConfirmedAt);
        acceleratedDate.setDate(acceleratedDate.getDate() - Math.floor(pantryMatch.estimatedDecayDays / 2));
        await storage.updatePantryItem(pantryMatch.id, userId, { 
          lastConfirmedAt: acceleratedDate 
        });
      }
    }

    res.json({ message: "Meal marked as cooked, pantry decay accelerated", mealState: 'cooked' });
  });

  // Consumption Logs - Get logs for date range (path params)
  app.get("/api/consumption-logs/:startDate/:endDate", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const { startDate, endDate } = req.params;
    const logs = await storage.getConsumptionLogs(userId, startDate, endDate);
    res.json(logs);
  });

  // Consumption Logs - Get logs for date range (query params)
  app.get("/api/consumption-logs", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate required" });
    }
    
    const logs = await storage.getConsumptionLogs(userId, startDate as string, endDate as string);
    res.json(logs);
  });

  // Consumption Logs - Create manual entry (Pro only)
  app.post("/api/consumption-logs", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    if (!userId) {
      return res.status(400).json({ message: "User ID not found in session" });
    }
    const { date, name, calories, protein, carbs, fat, sourceType, recipeId } = req.body;
    
    if (!date || !calories) {
      return res.status(400).json({ message: "date and calories required" });
    }
    
    let validRecipeId: number | null = null;
    if (recipeId) {
      const recipe = await storage.getRecipe(parseInt(recipeId));
      if (recipe) {
        validRecipeId = recipe.id;
      }
    }

    try {
      const log = await storage.createConsumptionLog({
        userId,
        date,
        name: name || null,
        calories: parseInt(calories),
        protein: parseInt(protein) || 0,
        carbs: parseInt(carbs) || 0,
        fat: parseInt(fat) || 0,
        sourceType: sourceType || 'manual_custom_entry',
        recipeId: validRecipeId
      });
      
      res.status(201).json(log);
    } catch (err: any) {
      console.error("Error creating consumption log:", err.message);
      res.status(500).json({ message: "Failed to create consumption log" });
    }
  });

  // Consumption Logs - Delete
  app.delete("/api/consumption-logs/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const logId = parseInt(req.params.id);
    
    await storage.deleteConsumptionLog(logId, userId);
    res.sendStatus(204);
  });

  // Insights - Compute real-time insights from consumption data (Pro only)
  app.get("/api/insights", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;

    const profile = await storage.getProfile(userId);
    if (!profile || profile.subscriptionTier !== 'pro') {
      return res.status(403).json({ message: "Pro subscription required" });
    }

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const [consumptionLogs, cookedMeals] = await Promise.all([
      storage.getConsumptionLogs(userId, startDate, endDate),
      storage.getCookedMealsForDateRange(userId, startDate, endDate),
    ]);

    const cookedAsLogs = cookedMeals.map((m, idx) => ({
      id: -(idx + 1),
      userId,
      date: m.date,
      sourceType: 'cooknow_logged_recipe' as const,
      recipeId: m.recipeId,
      name: m.recipeName,
      calories: Math.round(m.calories * m.servingMultiplier),
      protein: Math.round(m.protein * m.servingMultiplier),
      carbs: Math.round(m.carbs * m.servingMultiplier),
      fat: Math.round(m.fat * m.servingMultiplier),
      createdAt: null,
    }));

    const existingLogKeys = new Set(
      consumptionLogs.map(l => `${l.date}|${l.recipeId || ''}|${l.calories}|${l.protein}|${l.carbs}|${l.fat}`)
    );
    const uniqueCookedLogs = cookedAsLogs.filter(
      cl => !existingLogKeys.has(`${cl.date}|${cl.recipeId || ''}|${cl.calories}|${cl.protein}|${cl.carbs}|${cl.fat}`)
    );

    const allLogs = [...consumptionLogs, ...uniqueCookedLogs];

    const targets = {
      calories: profile.targetCalories || 2000,
      protein: profile.targetProtein || 150,
      carbs: profile.targetCarbs || 250,
      fat: profile.targetFat || 65,
    };

    const profileData = {
      goal: profile.goal || 'maintain',
      weight: profile.weight || 150,
    };

    const insights = computeInsights(allLogs, targets, profileData);
    res.json(insights);
  });

  // Planner Rollover - Process midnight auto-count
  app.post("/api/planner/rollover", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    
    const today = new Date().toISOString().split('T')[0];
    const rolloverState = await storage.getRolloverState(userId);
    const lastRolloverDate = rolloverState?.lastRolloverDate || '';
    
    if (lastRolloverDate >= today) {
      return res.json({ message: "Already rolled over today", processed: 0 });
    }
    
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Get all scheduled meals from yesterday
    const scheduledMeals = await storage.getScheduledMealsForDate(userId, yesterdayStr);
    
    // Auto-count them
    for (const meal of scheduledMeals) {
      await storage.updateMealState(meal.id, 'autoCounted');
    }
    
    // Update rollover state
    await storage.setRolloverState(userId, today);
    
    res.json({ 
      message: "Rollover complete", 
      processed: scheduledMeals.length,
      date: yesterdayStr
    });
  });

  // Recipe Share (public - no auth required)
  app.get("/api/recipe/:id/share", async (req, res) => {
    const recipeId = parseInt(req.params.id);
    if (isNaN(recipeId)) return res.status(400).json({ message: "Invalid recipe ID" });
    
    const recipe = await storage.getRecipe(recipeId);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });
    
    res.json({
      recipe,
      shareUrl: `/share/recipe/${recipeId}`,
      generatedAt: new Date().toISOString()
    });
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

  // Cart / Grocery List
  app.get(api.cart.get.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const plan = await storage.getCurrentWeeklyPlan(userId);
    if (!plan) return res.json({ items: [], have: [], mightHave: [], need: [], summary: { totalItems: 0, estimatedCost: 0, potentialSavings: 0 } });
    
    const days = await storage.getWeeklyPlanDays(plan.id);
    const pantryItems = await storage.getPantryItems(userId);
    
    // Aggregate ingredients with serving multiplier
    const aggregated: Record<string, any> = {};
    
    days.forEach(day => {
      day.meals.forEach(meal => {
        const multiplier = (meal as any).servingMultiplier || 1.0;
        // Source ingredients from whichever recipe is attached to this plan_meals row.
        // app_recipes uses { name, amount: number, ... }; chef_recipes stores
        // { name, amount: string, unit }. Coerce amount to a number where possible.
        const ingredientsSource = meal.recipe?.ingredients ?? (meal as any).chefRecipe?.ingredients ?? [];
        ingredientsSource.forEach((ing: any) => {
          const rawAmount = typeof ing.amount === "string" ? parseFloat(ing.amount) : ing.amount;
          const amountNum = Number.isFinite(rawAmount) ? rawAmount : 1;
          const scaledAmount = amountNum * multiplier;
          if (aggregated[ing.name]) {
            aggregated[ing.name].amount += scaledAmount;
          } else {
            aggregated[ing.name] = { ...ing, amount: scaledAmount, isStaple: false };
          }
        });
      });
    });

    // Check pantry status for each ingredient
    const items = Object.values(aggregated).map(item => {
      const pantryMatch = pantryItems.find((p: any) => 
        p.name.toLowerCase().includes(item.name.toLowerCase()) || 
        item.name.toLowerCase().includes(p.name.toLowerCase())
      );
      if (pantryMatch) {
        item.pantryStatus = pantryMatch.status; // likely_have, might_run_out, probably_gone
        item.haveInPantry = pantryMatch.status === 'likely_have';
      } else {
        item.pantryStatus = 'need';
        item.haveInPantry = false;
      }
      return item;
    });

    // Categorize by pantry status
    const have = items.filter(i => i.pantryStatus === 'likely_have');
    const mightHave = items.filter(i => i.pantryStatus === 'might_run_out');
    const need = items.filter(i => i.pantryStatus === 'need' || i.pantryStatus === 'probably_gone');

    // Simple Deal Matching
    const deals = await storage.getDeals(1);
    items.forEach(item => {
      const deal = deals.find(d => d.itemName.toLowerCase().includes(item.name.toLowerCase()));
      if (deal) {
        item.matchedDeal = {
          storeName: "Default Store",
          regularPrice: deal.regularPrice,
          salePrice: deal.salePrice,
          savings: deal.regularPrice - deal.salePrice
        };
      }
    });

    res.json({
      items,
      have,
      mightHave,
      need,
      summary: {
        totalItems: items.length,
        haveCount: have.length,
        mightHaveCount: mightHave.length,
        needCount: need.length,
        estimatedCost: 0,
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

  // === Recipe Ratings ===

  app.get("/api/recipes/ratings", async (req, res) => {
    try {
      const idsParam = req.query.ids as string;
      if (!idsParam) return res.json({});
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) return res.json({});
      const ratings = await getAverageRatings(ids);
      res.json(ratings);
    } catch (err: any) {
      console.error("[GET /api/recipes/ratings] error:", err?.message);
      res.status(500).json({ error: "Failed to fetch ratings" });
    }
  });

  app.post("/api/recipes/:recipeId/rate", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { recipeId } = req.params;
      const { rating } = req.body;
      if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
      }
      const userId = (req.user as any).id;
      const result = await upsertRating(userId, recipeId, rating);
      res.json(result);
    } catch (err: any) {
      console.error("[POST /api/recipes/:recipeId/rate] error:", err?.message);
      res.status(500).json({ error: "Failed to save rating" });
    }
  });

  app.get("/api/recipes/feed/for-you", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 0;
      const cuisine = (req.query.cuisine as string) || undefined;
      const sub_category = (req.query.sub_category as string) || undefined;
      const dish_type = (req.query.dish_type as string) || undefined;
      const mealType = (req.query.mealType as string) || undefined;
      const seed = req.query.varietyIndex ? parseInt(req.query.varietyIndex as string) : 0;
      const allergens = req.query.allergens ? JSON.parse(req.query.allergens as string) : undefined;
      const dietaryRestrictions = req.query.dietaryRestrictions ? JSON.parse(req.query.dietaryRestrictions as string) : undefined;
      const result = await getForYouFeed({ limit, page, cuisine, sub_category, dish_type, mealType, seed, allergens, dietaryRestrictions });
      res.json(result);
    } catch (err: any) {
      console.error('[for-you] error:', err);
      res.status(500).json({ error: 'Failed to load recipes', detail: err?.message });
    }
  });

  app.get("/api/recipes/feed/something-new", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 0;
      const cuisine = (req.query.cuisine as string) || undefined;
      const sub_category = (req.query.sub_category as string) || undefined;
      const mealType = (req.query.mealType as string) || undefined;
      const seed = req.query.varietyIndex ? parseInt(req.query.varietyIndex as string) : 0;
      const allergens = req.query.allergens ? JSON.parse(req.query.allergens as string) : undefined;
      const dietaryRestrictions = req.query.dietaryRestrictions ? JSON.parse(req.query.dietaryRestrictions as string) : undefined;
      const result = await getSomethingNewFeed({ limit, page, cuisine, sub_category, mealType, seed, allergens, dietaryRestrictions });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load recipes' });
    }
  });

  app.get("/api/recipes/feed/planner", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const meal_type = req.query.meal_type as string | undefined;
      if (!meal_type) {
        return res.status(400).json({ error: 'meal_type query parameter is required' });
      }
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 7;
      const excludeParam = (req.query.exclude as string) || '';
      const exclude = excludeParam ? excludeParam.split(',').filter(Boolean) : [];
      const allergens = req.query.allergens ? JSON.parse(req.query.allergens as string) : undefined;
      const dietaryRestrictions = req.query.dietaryRestrictions ? JSON.parse(req.query.dietaryRestrictions as string) : undefined;
      const result = await getPlannerCandidates({ meal_type, offset, limit, exclude, allergens, dietaryRestrictions });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load planner recipes' });
    }
  });

  app.get("/api/recipes/search", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const q = (req.query.q as string) || '';
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 0;
      const allergens = req.query.allergens ? JSON.parse(req.query.allergens as string) : undefined;
      const dietaryRestrictions = req.query.dietaryRestrictions ? JSON.parse(req.query.dietaryRestrictions as string) : undefined;
      const result = await searchRecipesInSupabase(q, { limit, page, allergens, dietaryRestrictions });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to search recipes' });
    }
  });

  app.get("/api/recipes/shared/:recipeId", async (req, res) => {
    try {
      const recipeId = req.params.recipeId;
      if (!recipeId || recipeId.trim() === '') {
        return res.status(400).json({ error: 'Invalid recipe ID' });
      }
      const recipe = await getRecipeByIdFromSupabase(recipeId);
      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      res.json({ recipe });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load recipe' });
    }
  });

  app.get("/api/recipes/:recipeId/nutrition", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { recipeId } = req.params;
      const nutrition = await getDetailedNutrition(recipeId);
      if (!nutrition) {
        return res.status(404).json({ error: 'Nutrition data not found' });
      }
      res.json(nutrition);
    } catch (err: any) {
      console.error("[GET /api/recipes/:recipeId/nutrition] error:", err?.message);
      res.status(500).json({ error: 'Failed to load nutrition data' });
    }
  });

  app.get("/api/recipes/:recipeId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const recipeId = req.params.recipeId;
      if (!recipeId || recipeId.trim() === '') {
        return res.status(400).json({ error: 'Invalid recipe ID' });
      }
      const recipe = await getRecipeByIdFromSupabase(recipeId);
      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      res.json({ recipe });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load recipe' });
    }
  });

  app.get("/api/fatsecret/recipes/search", async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 0;
      const requestType = (req.query.type as 'FEED' | 'SEARCH') || 'FEED';
      const seedOffset = parseInt(req.query.seedOffset as string) || 0;
      
      // Parse new filter params
      const mealType = (req.query.mealType as string) || undefined;
      const timeDifficulty = (req.query.timeDifficulty as string) || undefined;
      const isDiabetic = req.query.isDiabetic === 'true';
      const maxCarbPercent = req.query.maxCarbPercent ? parseInt(req.query.maxCarbPercent as string) : undefined;
      const cuisine = (req.query.cuisine as string) || undefined;
      const varietyIndex = req.query.varietyIndex ? parseInt(req.query.varietyIndex as string) : undefined;
      const feedType = (req.query.feedType as 'forYou' | 'somethingNew') || undefined;
      
      // Build filters object
      const filters = {
        mealType,
        timeDifficulty,
        isDiabetic,
        maxCarbPercent,
        cuisine,
        varietyIndex,
        feedType,
      };

      // Include filters in cache key to properly differentiate cached results
      const filterKey = `${mealType || ''}:${timeDifficulty || ''}:${isDiabetic}:${maxCarbPercent ?? ''}:${cuisine || ''}:${varietyIndex ?? ''}`;
      const cacheKey = getSearchCacheKey(`${q}:${requestType}:${seedOffset}:${filterKey}`, limit, page);
      const cachedResult = searchCache.get(cacheKey);
      if (cachedResult) {
        console.log('[FatSecret] Search cache hit:', cacheKey);
        return res.json(cachedResult);
      }

      console.log('[FatSecret] Searching recipes:', { q, limit, page, requestType, seedOffset, filters });
      const searchResult = await searchRecipes(q, limit, page, requestType, seedOffset, filters);

      if (searchResult.error) {
        console.error('[FatSecret] API error:', searchResult.error.message || searchResult.error);
        return res.status(503).json({ 
          error: 'Recipe service temporarily unavailable', 
          details: searchResult.error.message 
        });
      }

      if (!searchResult.recipes?.recipe) {
        return res.json({ recipes: [], page, limit });
      }

      const recipeList = Array.isArray(searchResult.recipes.recipe)
        ? searchResult.recipes.recipe
        : [searchResult.recipes.recipe];

      const hydratedRecipes = await Promise.all(
        recipeList.map(async (r: any) => {
          const recipeId = String(r.recipe_id);
          
          const cachedRecipe = recipeCache.get(recipeId);
          if (cachedRecipe) {
            return cachedRecipe;
          }

          try {
            const fullRecipe = await getRecipeById(recipeId);
            const canonical = fatsecretRecipeToCanonical(fullRecipe);
            recipeCache.set(recipeId, canonical);
            return canonical;
          } catch (err) {
            console.error('[FatSecret] Failed to hydrate recipe:', recipeId, err);
            return null;
          }
        })
      );

      const validRecipes = hydratedRecipes.filter(r => r !== null);
      const result = { recipes: validRecipes, page, limit };
      searchCache.set(cacheKey, result);

      res.json(result);
    } catch (err) {
      console.error('[FatSecret] Search error:', err);
      res.status(500).json({ error: 'Failed to search recipes' });
    }
  });

  app.get("/api/fatsecret/recipes/:id", async (req, res) => {
    try {
      const recipeId = req.params.id;

      const cachedRecipe = recipeCache.get(recipeId);
      if (cachedRecipe) {
        console.log('[FatSecret] Recipe cache hit:', recipeId);
        return res.json({ recipe: cachedRecipe });
      }

      console.log('[FatSecret] Fetching recipe:', recipeId);
      const fullRecipe = await getRecipeById(recipeId);
      
      if (fullRecipe.error) {
        console.error('[FatSecret] API error:', fullRecipe.error.message || fullRecipe.error);
        return res.status(503).json({
          error: 'Recipe service temporarily unavailable',
          details: fullRecipe.error.message
        });
      }
      
      const canonical = fatsecretRecipeToCanonical(fullRecipe);
      recipeCache.set(recipeId, canonical);

      res.json({ recipe: canonical });
    } catch (err) {
      console.error('[FatSecret] Recipe fetch error:', err);
      res.status(503).json({ error: 'Recipe service temporarily unavailable' });
    }
  });

  app.get("/api/fatsecret/foods/search", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    try {
      const query = req.query.query as string;
      if (!query) {
        return res.status(400).json({ error: "query parameter is required" });
      }
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const maxResults = req.query.max_results ? parseInt(req.query.max_results as string) : undefined;

      const cacheKey = `${query}:${page}:${maxResults}`;
      const cached = foodSearchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < FOOD_SEARCH_CACHE_TTL) {
        return res.json(cached.data);
      }

      const result = await searchFoods(query, page, maxResults);
      foodSearchCache.set(cacheKey, { data: result, timestamp: Date.now() });
      res.json(result);
    } catch (err) {
      console.error('[FatSecret] Food search error:', err);
      res.status(500).json({ error: 'Failed to search foods' });
    }
  });

  app.get("/api/fatsecret/foods/:foodId", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    try {
      const result = await getFoodById(req.params.foodId);
      res.json(result);
    } catch (err) {
      console.error('[FatSecret] Food fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch food details' });
    }
  });

  // Ingredient search (Supabase ingredients table) for onboarding disliked foods
  app.get("/api/ingredients/search", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    try {
      const query = req.query.query as string;
      if (!query || query.length < 2) {
        return res.json({ ingredients: [] });
      }
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("ingredients")
        .select("ingredient_id, canonical_name, category")
        .ilike("canonical_name", `%${query}%`)
        .limit(20);
      if (error) throw error;
      res.json({ ingredients: data || [] });
    } catch (err) {
      console.error('[Ingredients] Search error:', err);
      res.status(500).json({ error: 'Failed to search ingredients' });
    }
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

  // ===== USER FAVORITE RECIPES (FatSecret) =====
  
  app.get("/api/user-favorites", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const userId = (req.user as any).id;
      const favorites = await db.select()
        .from(userFavoriteRecipes)
        .where(eq(userFavoriteRecipes.userId, userId));
      
      const recipes = favorites.map(f => f.recipePayload);
      res.json({ favorites: recipes });
    } catch (err) {
      console.error('[Favorites] Failed to get favorites:', err);
      res.status(500).json({ error: 'Failed to get favorites' });
    }
  });
  
  app.post("/api/user-favorites/:recipeId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const userId = (req.user as any).id;
      const recipeId = req.params.recipeId;
      const recipePayload = req.body.recipe;
      
      if (!recipePayload) {
        return res.status(400).json({ error: "Recipe payload required" });
      }
      
      const existing = await db.select()
        .from(userFavoriteRecipes)
        .where(and(
          eq(userFavoriteRecipes.userId, userId),
          eq(userFavoriteRecipes.recipeId, recipeId)
        ));
      
      if (existing.length > 0) {
        return res.json({ success: true, message: 'Already favorited' });
      }
      
      await db.insert(userFavoriteRecipes).values({
        userId,
        recipeId,
        recipePayload,
      });
      
      res.json({ success: true });
    } catch (err) {
      console.error('[Favorites] Failed to add favorite:', err);
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  });
  
  app.delete("/api/user-favorites/:recipeId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const userId = (req.user as any).id;
      const recipeId = req.params.recipeId;
      
      await db.delete(userFavoriteRecipes)
        .where(and(
          eq(userFavoriteRecipes.userId, userId),
          eq(userFavoriteRecipes.recipeId, recipeId)
        ));
      
      res.json({ success: true });
    } catch (err) {
      console.error('[Favorites] Failed to remove favorite:', err);
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  });
  
  app.get("/api/user-favorites/ids", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const userId = (req.user as any).id;
      const favorites = await db.select({ recipeId: userFavoriteRecipes.recipeId })
        .from(userFavoriteRecipes)
        .where(eq(userFavoriteRecipes.userId, userId));
      
      const ids = favorites.map(f => f.recipeId);
      res.json({ ids });
    } catch (err) {
      console.error('[Favorites] Failed to get favorite ids:', err);
      res.status(500).json({ error: 'Failed to get favorite ids' });
    }
  });

  // Custom Recipes CRUD
  app.get("/api/custom-recipes", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const results = await db.select().from(customRecipes)
        .where(eq(customRecipes.userId, userId))
        .orderBy(desc(customRecipes.createdAt));
      res.json(results);
    } catch (err) {
      console.error('[CustomRecipes] Failed to get custom recipes:', err);
      res.status(500).json({ error: "Failed to get custom recipes" });
    }
  });

  app.post("/api/custom-recipes", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const { name, ingredients, calories, protein, carbs, fat } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }
      const inserted = await db.insert(customRecipes).values({
        userId,
        name: name.trim(),
        ingredients: ingredients || [],
        calories: calories || 0,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
      }).returning();
      res.status(201).json(inserted[0]);
    } catch (err) {
      console.error('[CustomRecipes] Failed to create custom recipe:', err);
      res.status(500).json({ error: "Failed to create custom recipe" });
    }
  });

  app.put("/api/custom-recipes/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const recipeId = parseInt(req.params.id);
      const existing = await db.select().from(customRecipes)
        .where(and(eq(customRecipes.id, recipeId), eq(customRecipes.userId, userId)));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      const { name, ingredients, calories, protein, carbs, fat } = req.body;
      const updated = await db.update(customRecipes)
        .set({
          name,
          ingredients,
          calories,
          protein,
          carbs,
          fat,
          updatedAt: new Date(),
        })
        .where(and(eq(customRecipes.id, recipeId), eq(customRecipes.userId, userId)))
        .returning();
      res.json(updated[0]);
    } catch (err) {
      console.error('[CustomRecipes] Failed to update custom recipe:', err);
      res.status(500).json({ error: "Failed to update custom recipe" });
    }
  });

  app.delete("/api/custom-recipes/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const recipeId = parseInt(req.params.id);
      const existing = await db.select().from(customRecipes)
        .where(and(eq(customRecipes.id, recipeId), eq(customRecipes.userId, userId)));
      if (existing.length === 0) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      await db.delete(customRecipes)
        .where(and(eq(customRecipes.id, recipeId), eq(customRecipes.userId, userId)));
      res.json({ success: true });
    } catch (err) {
      console.error('[CustomRecipes] Failed to delete custom recipe:', err);
      res.status(500).json({ error: "Failed to delete custom recipe" });
    }
  });

  app.get("/api/instacart/health", async (_req, res) => {
    const { resolveInstacartConfig } = await import("./lib/instacartMeasurement");
    const config = resolveInstacartConfig();
    return res.json({
      hasKey: config.hasKey,
      env: config.env,
      baseUrl: config.baseUrl,
      endpoint: config.endpoint,
    });
  });

  app.post("/api/instacart/diagnostic", async (_req, res) => {
    try {
      const { createInstacartShoppingListLink } = await import("./lib/instacartMeasurement");
      const result = await createInstacartShoppingListLink({
        title: "ReciPal Diagnostic",
        lineItems: [{ name: "Banana", quantity: 1, unit: "each", display_text: "Banana" }],
        correlationId: "diagnostic",
      });
      return res.json({
        success: true,
        redirectUrl: result.products_link_url,
        productsLinkUrl: result.products_link_url,
      });
    } catch (err: any) {
      return res.status(err.status && typeof err.status === "number" ? err.status : 500).json({
        success: false,
        error: err.message || "Diagnostic call failed",
        status: err.status || 500,
        details: err.details || undefined,
      });
    }
  });

  app.post("/api/instacart/shopping-list", async (req, res) => {
    const correlationId = "aggregate";
    try {
      const { title, lineItems, correlationIds } = req.body;

      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No line items provided",
        });
      }

      const { createInstacartShoppingListLink, InstacartApiError } = await import("./lib/instacartMeasurement");

      const mappedLineItems = lineItems
        .filter((item: any) => {
          if (!item.name || String(item.name).trim() === "") {
            console.log(`[Instacart] Skipping line item with blank name in route handler`);
            return false;
          }
          return true;
        })
        .map((item: any) => ({
          name: String(item.name).trim(),
          quantity: (item.qty != null && item.qty > 0) ? item.qty : 1,
          unit: (item.unit && String(item.unit).trim() !== "") ? String(item.unit).trim() : "each",
          display_text: item.displayText || String(item.name).trim(),
        }));

      if (mappedLineItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: "All line items had blank names",
        });
      }

      console.log("[Instacart] instacart_shopping_list_request_built", JSON.stringify({
        correlationId,
        title: title || "ReciPal Shopping List",
        totalItems: mappedLineItems.length,
        lineItems: mappedLineItems.map((li: any) => ({ name: li.name, quantity: li.quantity, unit: li.unit, hasDisplayText: !!li.display_text })),
      }));

      const result = await createInstacartShoppingListLink({
        title: title || undefined,
        lineItems: mappedLineItems,
        correlationId,
      });

      console.log("[Instacart] instacart_api_response", JSON.stringify({
        correlationId,
        success: true,
        redirectUrlGenerated: true,
        productsLinkUrl: result.products_link_url,
      }));

      return res.json({
        success: true,
        redirectUrl: result.products_link_url,
        productsLinkUrl: result.products_link_url,
        correlationId,
        correlationIds: correlationIds || [],
      });
    } catch (err: any) {
      const errorMessage = err.message || "Failed to create Instacart shopping list";
      console.error("[Instacart] Failed to create shopping list:", errorMessage);

      console.log("[Instacart] instacart_api_response", JSON.stringify({
        correlationId,
        success: false,
        redirectUrlGenerated: false,
        errorMessage,
      }));

      const statusCode = err.status && typeof err.status === "number" ? err.status : 500;
      return res.status(statusCode >= 400 ? statusCode : 500).json({
        success: false,
        error: errorMessage,
        status: err.status || undefined,
        details: err.details || undefined,
      });
    }
  });

  app.get("/api/fatsecret/barcode", async (req, res) => {
    try {
      const barcode = String(req.query.barcode || '').trim();
      const region = String(req.query.region || 'US');
      const language = String(req.query.language || 'en');

      if (!barcode) {
        return res.status(400).json({ error: "Barcode is required" });
      }

      let normalizedBarcode = barcode.replace(/\D/g, '');
      if (normalizedBarcode.length < 8 || normalizedBarcode.length > 14) {
        return res.status(400).json({ error: "Invalid barcode length. Expected 8-14 digits." });
      }
      while (normalizedBarcode.length < 13) {
        normalizedBarcode = '0' + normalizedBarcode;
      }

      const data = await fatsecretBarcodeLookup(normalizedBarcode);

      if (data?.error === 'FATSECRET_SCOPE_NOT_ENABLED') {
        return res.status(403).json({ error: data.message });
      }
      if (data?.error) {
        console.error('[FatSecret Barcode] API error:', data.error);
        return res.status(400).json({ error: data.error.message || 'Barcode lookup failed', details: data.error });
      }

      res.json(data);
    } catch (err: any) {
      console.error('[FatSecret Barcode] Error:', err);
      res.status(500).json({ error: err.message || "Barcode lookup failed" });
    }
  });

  // --- Scaled Steps API ---
  app.post("/api/scaled-steps", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const schema = z.object({
        recipe_id: z.string(),
        desired_servings: z.number().int().min(1).max(48),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }
      const { recipe_id, desired_servings } = parsed.data;
      const result = await getScaledSteps(recipe_id, desired_servings);
      res.json(result);
    } catch (err: any) {
      console.error("[scaled-steps] Error:", err);
      res.status(500).json({ error: err.message || "Failed to scale steps" });
    }
  });

  // --- Classify Cook Time Scale Type ---
  app.post("/api/classify-cook-time-scale", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const classifyOpenai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
      });
      const supabase = getSupabaseClient();
      let classified = 0;
      let skipped = 0;
      let errors = 0;
      let offset = 0;
      const batchSize = 50;

      while (true) {
        const { data: batch, error: fetchError } = await supabase
          .from("recipes")
          .select("recipe_id, title, steps")
          .is("cook_time_scale_type", null)
          .range(offset, offset + batchSize - 1);

        if (fetchError) {
          console.error("[classify] Fetch error:", fetchError);
          break;
        }
        if (!batch || batch.length === 0) break;

        const results = await batchProcess(
          batch,
          async (recipe) => {
            try {
              const completion = await classifyOpenai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  {
                    role: "system",
                    content:
                      "Classify this recipe's cook time scaling behavior into exactly one of these four categories: invariant (total cook time does not meaningfully change with serving count — soups, stews, braises, curries, sauces), linear_batch (more servings requires more batches at the same time per batch — pan-fried items, stir-fry, tacos, cookies, pancakes), weight_based (cook time scales with total ingredient weight — roasts, whole birds, whole fish), surface_area (cook time increases modestly with volume but not linearly — baked casseroles, gratins, lasagna, cakes). Respond with exactly one word: invariant, linear_batch, weight_based, or surface_area.",
                  },
                  {
                    role: "user",
                    content: `Recipe title: ${recipe.title}\nSteps: ${JSON.stringify(recipe.steps)}`,
                  },
                ],
                temperature: 0.1,
              });

              const raw = (completion.choices[0]?.message?.content || "").trim().toLowerCase();
              const valid = ["invariant", "linear_batch", "weight_based", "surface_area"];
              const scaleType = valid.includes(raw) ? raw : "invariant";

              const { error: updateError } = await supabase
                .from("recipes")
                .update({ cook_time_scale_type: scaleType })
                .eq("recipe_id", recipe.recipe_id);

              if (updateError) {
                console.error(`[classify] Update error for ${recipe.recipe_id}:`, updateError);
                return "error";
              }
              return "classified";
            } catch (e) {
              console.error(`[classify] Error for ${recipe.recipe_id}:`, e);
              return "error";
            }
          },
          { concurrency: 3, retries: 5 }
        );

        for (const r of results) {
          if (r === "classified") classified++;
          else if (r === "error") errors++;
          else skipped++;
        }

        if (batch.length < batchSize) break;
        offset += batchSize;
      }

      res.json({ classified, skipped, errors });
    } catch (err: any) {
      console.error("[classify-cook-time-scale] Error:", err);
      res.status(500).json({ error: err.message || "Classification failed" });
    }
  });

  app.post("/api/reconcile-display-text", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const result = await reconcileDisplayText();
      res.json(result);
    } catch (err: any) {
      console.error("[reconcile-display-text] Error:", err);
      res.status(500).json({ error: err.message || "Reconciliation failed" });
    }
  });

  // ===== SIDES ENDPOINTS =====

  // Add side to a meal
  app.post("/api/plan/meal/:id/sides", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const parentMealId = parseInt(req.params.id, 10);
      const { recipeId, servings } = req.body;
      if (!recipeId) return res.status(400).json({ error: "recipeId required" });

      // Sides inherit planDayId + slotIndex from their parent meal so they group correctly.
      const parent = await storage.getPlanMeal(parentMealId);
      if (!parent) return res.status(404).json({ error: "parent meal not found" });

      const [side] = await db.insert(planMeals).values({
        planDayId: parent.planDayId,
        slotIndex: parent.slotIndex,
        recipeId,
        mealType: 'Side',
        servingMultiplier: typeof servings === "number" && servings > 0 ? servings : 1,
        parentMealId,
      }).returning();
      res.json(side);
    } catch (err: any) {
      console.error("[add-side] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Remove side from a meal
  app.delete("/api/plan/meal/:id/sides/:sideId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const sideId = parseInt(req.params.sideId, 10);
      await db.delete(planMeals).where(eq(planMeals.id, sideId));
      res.json({ success: true });
    } catch (err: any) {
      console.error("[remove-side] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Search side recipes from Supabase
  // GET /api/recipes/sides/search?q=rice&limit=20
  // Without q, returns top 50 side recipes for recommendations
  app.get("/api/recipes/sides/search", async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const q = (req.query.q as string || '').trim();
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      let query = supabase
        .from('recipes')
        .select(`
          *,
          recipe_nutrition_totals (*),
          recipe_ingredients (name, amount, unit, sort_order)
        `)
        .or('meal_type.eq.Side,dish_type.eq.Side Dish');

      if (q) {
        query = query.ilike('title', `%${q}%`);
      }

      const { data, error } = await query.limit(limit);
      if (error) throw error;

      // Map to canonical Recipe format using same pattern as other endpoints
      const recipes = (data || []).map((row: any) => {
        const nutrition = Array.isArray(row.recipe_nutrition_totals)
          ? row.recipe_nutrition_totals[0]
          : row.recipe_nutrition_totals;
        return {
          id: row.recipe_id,
          title: row.title || '',
          image: row.image_url || '',
          calories: Math.round(nutrition?.calories_per_serving || 0),
          protein: Math.round(nutrition?.protein_per_serving || 0),
          carbs: Math.round(nutrition?.carbs_per_serving || 0),
          fat: Math.round(nutrition?.fat_per_serving || 0),
          prepTime: row.prep_time || '',
          cookTime: row.cook_time || '',
          servings: row.servings || 1,
          cuisine: row.cuisine || '',
          dish_type: row.dish_type || '',
          meal_type: row.meal_type || '',
          ingredients: (row.recipe_ingredients || []).map((i: any) => ({
            name: i.name,
            amount: i.amount,
            unit: i.unit,
            sort_order: i.sort_order,
          })),
          steps: [],
        };
      });

      res.json(recipes);
    } catch (err: any) {
      console.error("[side-search] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== RECIPE RATINGS =====

  // Upsert rating for user+recipe
  app.post("/api/recipes/:id/rating", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const userId = (req.user as any).id;
      const recipeId = req.params.id;
      const { rating } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be 1-5" });

      // Check if rating exists
      const existing = await db.select().from(recipeRatings)
        .where(and(eq(recipeRatings.userId, userId), eq(recipeRatings.recipeId, recipeId)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(recipeRatings)
          .set({ rating, updatedAt: new Date() })
          .where(eq(recipeRatings.id, existing[0].id));
      } else {
        await db.insert(recipeRatings).values({ userId, recipeId, rating });
      }
      res.json({ success: true, rating });
    } catch (err: any) {
      console.error("[recipe-rating] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get current user's rating for a recipe
  app.get("/api/recipes/:id/rating", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const userId = (req.user as any).id;
      const recipeId = req.params.id;
      const existing = await db.select().from(recipeRatings)
        .where(and(eq(recipeRatings.userId, userId), eq(recipeRatings.recipeId, recipeId)))
        .limit(1);
      res.json({ rating: existing[0]?.rating || null });
    } catch (err: any) {
      console.error("[get-rating] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== MEAL PHOTOS =====

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post("/api/meal-photos", upload.single('photo'), async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const userId = (req.user as any).id;
      const recipeId = req.body.recipeId;
      const file = req.file;
      if (!file || !recipeId) return res.status(400).json({ error: "photo and recipeId required" });

      const supabase = getSupabaseClient();
      const fileName = `meal-photos/${userId}/${Date.now()}-${file.originalname}`;

      const { error: uploadError } = await supabase.storage
        .from('meal-photos')
        .upload(fileName, file.buffer, { contentType: file.mimetype });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('meal-photos')
        .getPublicUrl(fileName);

      // Insert into meal_photos table in Supabase
      const { error: insertError } = await supabase
        .from('meal_photos')
        .insert({
          user_id: userId,
          recipe_id: recipeId,
          photo_url: urlData.publicUrl,
          status: 'pending',
        });
      if (insertError) throw insertError;

      res.json({ success: true, url: urlData.publicUrl });
    } catch (err: any) {
      console.error("[meal-photo-upload] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== CHEF CREATOR =====
  // Combined endpoint: returns the user's chef profile (if approved) and pending application (if any).
  app.get("/api/chef/me", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const [profile] = await db
        .select()
        .from(chefProfiles)
        .where(eq(chefProfiles.userId, userId))
        .limit(1);
      const [pendingApplication] = await db
        .select()
        .from(chefApplications)
        .where(and(eq(chefApplications.userId, userId), eq(chefApplications.status, "pending")))
        .orderBy(desc(chefApplications.submittedAt))
        .limit(1);
      res.json({
        profile: profile || null,
        pendingApplication: pendingApplication || null,
      });
    } catch (err: any) {
      console.error("[chef-me] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Reels: video upload with inline audio-fingerprint check.
  // multipart/form-data — fields: video (file, <=50MB), title?, description?
  const reelUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });
  app.post("/api/reels/upload", reelUploadLimiter, reelUpload.single("video"), async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing 'video' file." });

    try {
      // 1. Confirm the user is an approved chef.
      const [chef] = await db
        .select()
        .from(chefProfiles)
        .where(eq(chefProfiles.userId, userId))
        .limit(1);
      if (!chef || !chef.isApproved) {
        return res.status(403).json({ error: "Only approved Chef Creators can upload reels." });
      }

      // 2. Extract audio from the video buffer.
      const audioBuffer = await extractAudio(file.buffer);

      // 3. Run fingerprint check.
      const provider = getFingerprintProvider();
      const fp = await provider.identify(audioBuffer);

      if (fp.matched && fp.confidence > FINGERPRINT_MATCH_THRESHOLD) {
        // Flagged — video is discarded, nothing persists.
        return res.status(422).json({
          status: "flagged",
          reason: "copyrighted_music",
          track: fp.track,
          artist: fp.artist,
          confidence: fp.confidence,
          provider: fp.provider,
        });
      }

      // 4. Clean → upload to Cloudflare Stream.
      const cfResult = await uploadToCloudflareStream(file.buffer, {
        fileName: file.originalname || "reel.mp4",
        metadata: { chef_id: String(chef.id), uploaded_by: String(userId) },
      });

      // 5. Insert reels row. Caller may attach a recipe link via either:
      //    chef_recipe_id (chef-authored recipe in chef_recipes) — preferred
      //    recipe_id      (system recipe UUID in public.recipes)
      // At most one is set; if both come in we prefer chef_recipe_id and ignore recipe_id.
      const title = typeof req.body.title === "string" ? req.body.title.slice(0, 200) : null;
      const description =
        typeof req.body.description === "string" ? req.body.description.slice(0, 2000) : null;
      const chefRecipeIdRaw = Number(req.body.chefRecipeId ?? req.body.chef_recipe_id);
      const chefRecipeId = Number.isFinite(chefRecipeIdRaw) && chefRecipeIdRaw > 0 ? chefRecipeIdRaw : null;
      const recipeIdRaw = req.body.recipeId ?? req.body.recipe_id;
      const recipeId = !chefRecipeId && typeof recipeIdRaw === "string" && recipeIdRaw.length > 0
        ? recipeIdRaw.slice(0, 64)
        : null;

      const [reel] = await db
        .insert(reels)
        .values({
          chefId: chef.id,
          cfStreamUid: cfResult.uid,
          playbackUrl: cfResult.playbackHls,
          thumbnailUrl: cfResult.thumbnail || null,
          title,
          description,
          recipeId,
          chefRecipeId,
          durationS: cfResult.duration ? Math.round(cfResult.duration) : null,
          status: cfResult.status === "ready" ? "published" : "processing",
          fingerprintStatus: "clean",
          fingerprintProvider: provider.name,
        })
        .returning();

      // CF Stream's POST returns synchronously with state usually still "queued" or
      // "inprogress". Poll until ready, then flip the reel row to "published" so it
      // surfaces in the feed + on the chef profile.
      if (reel.status === "processing") {
        pollUntilReady(reel.id, reel.cfStreamUid);
      }

      // 6. Parse + persist hashtags from the description. Non-fatal if this fails —
      // the reel is already saved and CF Stream has the video.
      try {
        await persistReelHashtags(reel.id, description);
      } catch (hashtagErr) {
        console.error("[reels-upload] Hashtag persistence failed (non-fatal):", hashtagErr);
      }

      return res.status(201).json({
        status: "published",
        reel,
        playbackUrl: cfResult.playbackHls,
        cfStreamUid: cfResult.uid,
      });
    } catch (err: any) {
      console.error("[reels-upload] Error:", err);
      // Distinguish credential / setup errors from generic failures so the client
      // can surface a useful message.
      const msg = err?.message ?? "Upload failed";
      const isConfigError = /ACOUSTID_API_KEY|FPCALC|CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_STREAM_API_TOKEN|ACRCLOUD_/.test(msg);
      return res.status(isConfigError ? 503 : 500).json({
        error: msg,
        configError: isConfigError,
      });
    }
  });

  // ===== REELS FEED =====
  // Vertical-scroll feed source. Returns published, clean reels with chef metadata joined.
  // Cursor-paginated by id (DESC).
  app.get("/api/reels/feed", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;
      const cursorRaw = Number(req.query.cursor);
      const cursor = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;

      const whereConditions = [
        eq(reels.status, "published"),
        eq(reels.fingerprintStatus, "clean"),
      ];
      if (cursor) whereConditions.push(lt(reels.id, cursor));
      // "Following" feed: only reels from chefs the current user follows. Default = "Discover" (all).
      if (req.query.feed === "following") {
        whereConditions.push(
          inArray(
            reels.chefId,
            db.select({ id: chefFollowers.chefId }).from(chefFollowers).where(eq(chefFollowers.userId, userId)),
          ),
        );
      }

      const rows = await db
        .select({
          id: reels.id,
          chefId: reels.chefId,
          cfStreamUid: reels.cfStreamUid,
          playbackUrl: reels.playbackUrl,
          thumbnailUrl: reels.thumbnailUrl,
          title: reels.title,
          description: reels.description,
          recipeId: reels.recipeId,
          chefRecipeId: reels.chefRecipeId,
          durationS: reels.durationS,
          status: reels.status,
          likeCount: reels.likeCount,
          saveCount: reels.saveCount,
          shareCount: reels.shareCount,
          commentCount: reels.commentCount,
          viewCount: reels.viewCount,
          createdAt: reels.createdAt,
          chefHandle: chefProfiles.handle,
          chefDisplayName: chefProfiles.displayName,
          chefAvatarUrl: chefProfiles.avatarUrl,
          liked: sql<boolean>`(${reelLikes.userId} IS NOT NULL)`,
          saved: sql<boolean>`(${reelSaves.userId} IS NOT NULL)`,
        })
        .from(reels)
        .innerJoin(chefProfiles, eq(chefProfiles.id, reels.chefId))
        .leftJoin(reelLikes, and(eq(reelLikes.reelId, reels.id), eq(reelLikes.userId, userId)))
        .leftJoin(reelSaves, and(eq(reelSaves.reelId, reels.id), eq(reelSaves.userId, userId)))
        .where(and(...whereConditions))
        .orderBy(desc(reels.id))
        .limit(limit + 1); // fetch one extra to compute nextCursor

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].id : null;

      res.json({ reels: items, nextCursor });
    } catch (err: any) {
      console.error("[reels-feed] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Record a view (Phase H.19.1). UNIQUE per (user, reel): the first view by a user increments
  // reels.view_count; re-watches never double-count. A creator viewing their own reel is not counted.
  app.post("/api/reels/:id/view", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const reelId = Number(req.params.id);
    if (!Number.isFinite(reelId)) return res.status(400).json({ error: "Invalid reel id" });
    try {
      const [row] = await db
        .select({ viewCount: reels.viewCount, chefUserId: chefProfiles.userId })
        .from(reels)
        .innerJoin(chefProfiles, eq(chefProfiles.id, reels.chefId))
        .where(eq(reels.id, reelId))
        .limit(1);
      if (!row) return res.status(404).json({ error: "Reel not found" });
      if (row.chefUserId === userId) return res.json({ viewCount: row.viewCount }); // skip self-view

      const viewCount = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(reelViews).values({ userId, reelId }).onConflictDoNothing()
          .returning({ userId: reelViews.userId });
        if (inserted.length === 0) return row.viewCount; // already viewed by this user
        const [updated] = await tx
          .update(reels).set({ viewCount: sql`${reels.viewCount} + 1` })
          .where(eq(reels.id, reelId)).returning({ viewCount: reels.viewCount });
        return updated.viewCount;
      });
      res.json({ viewCount });
    } catch (err: any) {
      console.error("[reels-view] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== SEARCH + HASHTAGS (Phase F) =====

  // Combined search across chefs, hashtags, and reels. Each section limited to `perSection`.
  app.get("/api/search", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const q = (typeof req.query.q === "string" ? req.query.q : "").trim();
      const perSectionRaw = Number(req.query.perSection);
      const perSection = Number.isFinite(perSectionRaw) && perSectionRaw > 0
        ? Math.min(perSectionRaw, 20)
        : 5;

      if (q.length === 0) {
        return res.json({ q, chefs: [], hashtags: [], reels: [] });
      }
      const pattern = `%${q}%`;
      const prefix = `${q.toLowerCase()}%`;

      const [chefsRows, hashtagsRows, reelsRows] = await Promise.all([
        db
          .select({
            id: chefProfiles.id,
            handle: chefProfiles.handle,
            displayName: chefProfiles.displayName,
            bio: chefProfiles.bio,
            avatarUrl: chefProfiles.avatarUrl,
          })
          .from(chefProfiles)
          .where(
            and(
              eq(chefProfiles.isApproved, true),
              or(ilike(chefProfiles.handle, pattern), ilike(chefProfiles.displayName, pattern)),
            )
          )
          .orderBy(chefProfiles.handle)
          .limit(perSection),

        db
          .select({ tag: hashtags.tag, usageCount: hashtags.usageCount })
          .from(hashtags)
          .where(ilike(hashtags.tag, prefix))
          .orderBy(desc(hashtags.usageCount))
          .limit(perSection),

        db
          .select({
            id: reels.id,
            chefId: reels.chefId,
            playbackUrl: reels.playbackUrl,
            thumbnailUrl: reels.thumbnailUrl,
            title: reels.title,
            description: reels.description,
            recipeId: reels.recipeId,
          chefRecipeId: reels.chefRecipeId,
            durationS: reels.durationS,
            likeCount: reels.likeCount,
            viewCount: reels.viewCount,
            createdAt: reels.createdAt,
            chefHandle: chefProfiles.handle,
            chefDisplayName: chefProfiles.displayName,
            chefAvatarUrl: chefProfiles.avatarUrl,
          })
          .from(reels)
          .innerJoin(chefProfiles, eq(chefProfiles.id, reels.chefId))
          .where(
            and(
              eq(reels.status, "published"),
              eq(reels.fingerprintStatus, "clean"),
              or(ilike(reels.title, pattern), ilike(reels.description, pattern)),
            )
          )
          .orderBy(desc(reels.id))
          .limit(perSection),
      ]);

      // userId is captured but unused in MVP; future ranking can boost reels the user has
      // engaged with or chefs they follow.
      void userId;

      res.json({ q, chefs: chefsRows, hashtags: hashtagsRows, reels: reelsRows });
    } catch (err: any) {
      console.error("[search] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Hashtag detail — usage_count + paginated reels tagged with it.
  app.get("/api/hashtags/:tag", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const tag = String(req.params.tag).toLowerCase();
    try {
      const [row] = await db.select().from(hashtags).where(eq(hashtags.tag, tag)).limit(1);
      if (!row) return res.status(404).json({ error: "Hashtag not found" });
      res.json({ hashtag: row });
    } catch (err: any) {
      console.error("[hashtag-get] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Reels tagged with a hashtag. Cursor-paginated by reel id DESC.
  app.get("/api/hashtags/:tag/reels", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const tag = String(req.params.tag).toLowerCase();
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 12;
      const cursorRaw = Number(req.query.cursor);
      const cursor = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;

      const whereConditions = [
        eq(reelHashtags.tag, tag),
        eq(reels.status, "published"),
        eq(reels.fingerprintStatus, "clean"),
      ];
      if (cursor) whereConditions.push(lt(reels.id, cursor));

      const rows = await db
        .select({
          id: reels.id,
          chefId: reels.chefId,
          cfStreamUid: reels.cfStreamUid,
          playbackUrl: reels.playbackUrl,
          thumbnailUrl: reels.thumbnailUrl,
          title: reels.title,
          description: reels.description,
          recipeId: reels.recipeId,
          chefRecipeId: reels.chefRecipeId,
          durationS: reels.durationS,
          status: reels.status,
          likeCount: reels.likeCount,
          saveCount: reels.saveCount,
          shareCount: reels.shareCount,
          commentCount: reels.commentCount,
          viewCount: reels.viewCount,
          createdAt: reels.createdAt,
          chefHandle: chefProfiles.handle,
          chefDisplayName: chefProfiles.displayName,
          chefAvatarUrl: chefProfiles.avatarUrl,
          liked: sql<boolean>`(${reelLikes.userId} IS NOT NULL)`,
          saved: sql<boolean>`(${reelSaves.userId} IS NOT NULL)`,
        })
        .from(reelHashtags)
        .innerJoin(reels, eq(reels.id, reelHashtags.reelId))
        .innerJoin(chefProfiles, eq(chefProfiles.id, reels.chefId))
        .leftJoin(reelLikes, and(eq(reelLikes.reelId, reels.id), eq(reelLikes.userId, userId)))
        .leftJoin(reelSaves, and(eq(reelSaves.reelId, reels.id), eq(reelSaves.userId, userId)))
        .where(and(...whereConditions))
        .orderBy(desc(reels.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ reels: items, nextCursor: hasMore ? items[items.length - 1].id : null });
    } catch (err: any) {
      console.error("[hashtag-reels] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== NOTIFICATIONS (Phase G) =====
  // Inbox for the current user: like / favorite / save / comment notifications generated
  // by engagement on the user's reels. Excludes self-events (enforced at insert time).
  app.get("/api/notifications", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 30;
      const cursorRaw = Number(req.query.cursor);
      const cursor = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;

      const conditions = [eq(notifications.recipientUserId, userId)];
      if (cursor) conditions.push(lt(notifications.id, cursor));

      const rows = await db
        .select({
          id: notifications.id,
          type: notifications.type,
          reelId: notifications.reelId,
          commentId: notifications.commentId,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
          actorUserId: notifications.actorUserId,
          actorUsername: users.username,
          actorDisplayName: userProfiles.displayName,
          actorAvatarUrl: userProfiles.profileImageUrl,
          reelTitle: reels.title,
          reelThumbnail: reels.thumbnailUrl,
          commentBody: reelComments.body,
        })
        .from(notifications)
        .innerJoin(users, eq(users.id, notifications.actorUserId))
        .leftJoin(userProfiles, eq(userProfiles.userId, notifications.actorUserId))
        .leftJoin(reels, eq(reels.id, notifications.reelId))
        .leftJoin(reelComments, eq(reelComments.id, notifications.commentId))
        .where(and(...conditions))
        .orderBy(desc(notifications.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ notifications: items, nextCursor: hasMore ? items[items.length - 1].id : null });
    } catch (err: any) {
      console.error("[notifications-get] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Cheap dedicated endpoint for the bell badge — count only.
  app.get("/api/notifications/unread-count", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const result = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(notifications)
        .where(and(
          eq(notifications.recipientUserId, userId),
          sql`${notifications.readAt} IS NULL`,
        ));
      res.json({ count: result[0]?.count ?? 0 });
    } catch (err: any) {
      console.error("[notifications-unread-count] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Mark all unread notifications as read (called when the user opens the inbox).
  app.post("/api/notifications/mark-read", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(
          eq(notifications.recipientUserId, userId),
          sql`${notifications.readAt} IS NULL`,
        ));
      res.json({ marked: true });
    } catch (err: any) {
      console.error("[notifications-mark-read] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== CHEF ANALYTICS (Phase G) =====
  // Aggregated dashboard for the currently signed-in chef.
  // Counters are already denormalized on `reels`, so this is a single GROUP BY + a top-5 fetch.
  app.get("/api/chef/analytics", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const [chef] = await db
        .select()
        .from(chefProfiles)
        .where(eq(chefProfiles.userId, userId))
        .limit(1);
      if (!chef || !chef.isApproved) {
        return res.status(403).json({ error: "Only approved Chef Creators have analytics." });
      }

      const [totals] = await db
        .select({
          reelCount: sql<number>`COUNT(*)::int`,
          totalViews: sql<number>`COALESCE(SUM(${reels.viewCount}), 0)::int`,
          totalLikes: sql<number>`COALESCE(SUM(${reels.likeCount}), 0)::int`,
          totalSaves: sql<number>`COALESCE(SUM(${reels.saveCount}), 0)::int`,
          totalShares: sql<number>`COALESCE(SUM(${reels.shareCount}), 0)::int`,
          totalComments: sql<number>`COALESCE(SUM(${reels.commentCount}), 0)::int`,
        })
        .from(reels)
        .where(and(eq(reels.chefId, chef.id), eq(reels.status, "published")));

      // Full per-reel breakdown (all published reels), each with an engagement rate (%).
      const reelRows = await db
        .select({
          id: reels.id,
          title: reels.title,
          thumbnailUrl: reels.thumbnailUrl,
          createdAt: reels.createdAt,
          viewCount: reels.viewCount,
          likeCount: reels.likeCount,
          saveCount: reels.saveCount,
          shareCount: reels.shareCount,
          commentCount: reels.commentCount,
        })
        .from(reels)
        .where(and(eq(reels.chefId, chef.id), eq(reels.status, "published")))
        .orderBy(desc(reels.viewCount));
      const rate = (l: number, s: number, sh: number, c: number, v: number) =>
        Math.round(((l + s + sh + c) / Math.max(v, 1)) * 1000) / 10;
      const reelsWithRate = reelRows.map((r) => ({
        ...r,
        engagementRate: rate(r.likeCount, r.saveCount, r.shareCount, r.commentCount, r.viewCount),
      }));

      const t = totals ?? { reelCount: 0, totalViews: 0, totalLikes: 0, totalSaves: 0, totalShares: 0, totalComments: 0 };
      const engagementRate = rate(t.totalLikes, t.totalSaves, t.totalShares, t.totalComments, t.totalViews);

      // Last 8 ISO weeks (Mondays, UTC) for zero-filled growth series — matches Postgres date_trunc('week').
      const weekKeys: string[] = (() => {
        const now = new Date();
        const day = now.getUTCDay();
        const toMon = day === 0 ? -6 : 1 - day;
        const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + toMon));
        return Array.from({ length: 8 }, (_, i) => {
          const d = new Date(monday);
          d.setUTCDate(monday.getUTCDate() - (7 - i) * 7);
          return d.toISOString().slice(0, 10);
        });
      })();
      const toSeries = (rows: { wk: string; count: number }[]) => {
        const m = new Map(rows.map((x) => [x.wk, Number(x.count)]));
        return weekKeys.map((wk) => ({ week: wk, count: m.get(wk) ?? 0 }));
      };
      const wkExpr = (col: any) => sql<string>`to_char(date_trunc('week', ${col}), 'YYYY-MM-DD')`;

      // Follower growth — new followers per week.
      const fgRows = await db
        .select({ wk: wkExpr(chefFollowers.createdAt), count: sql<number>`count(*)::int` })
        .from(chefFollowers)
        .where(and(eq(chefFollowers.chefId, chef.id), sql`${chefFollowers.createdAt} >= now() - interval '8 weeks'`))
        .groupBy(sql`date_trunc('week', ${chefFollowers.createdAt})`);

      // Engagement growth — likes + saves + shares + comments per week (joined to this chef's reels).
      const likeW = await db
        .select({ wk: wkExpr(reelLikes.createdAt), count: sql<number>`count(*)::int` })
        .from(reelLikes).innerJoin(reels, eq(reels.id, reelLikes.reelId))
        .where(and(eq(reels.chefId, chef.id), sql`${reelLikes.createdAt} >= now() - interval '8 weeks'`))
        .groupBy(sql`date_trunc('week', ${reelLikes.createdAt})`);
      const saveW = await db
        .select({ wk: wkExpr(reelSaves.createdAt), count: sql<number>`count(*)::int` })
        .from(reelSaves).innerJoin(reels, eq(reels.id, reelSaves.reelId))
        .where(and(eq(reels.chefId, chef.id), sql`${reelSaves.createdAt} >= now() - interval '8 weeks'`))
        .groupBy(sql`date_trunc('week', ${reelSaves.createdAt})`);
      const shareW = await db
        .select({ wk: wkExpr(reelShares.createdAt), count: sql<number>`count(*)::int` })
        .from(reelShares).innerJoin(reels, eq(reels.id, reelShares.reelId))
        .where(and(eq(reels.chefId, chef.id), sql`${reelShares.createdAt} >= now() - interval '8 weeks'`))
        .groupBy(sql`date_trunc('week', ${reelShares.createdAt})`);
      const commentW = await db
        .select({ wk: wkExpr(reelComments.createdAt), count: sql<number>`count(*)::int` })
        .from(reelComments).innerJoin(reels, eq(reels.id, reelComments.reelId))
        .where(and(eq(reels.chefId, chef.id), sql`${reelComments.deletedAt} is null`, sql`${reelComments.createdAt} >= now() - interval '8 weeks'`))
        .groupBy(sql`date_trunc('week', ${reelComments.createdAt})`);
      const engMap = new Map<string, number>();
      for (const rows of [likeW, saveW, shareW, commentW]) {
        for (const x of rows as { wk: string; count: number }[]) engMap.set(x.wk, (engMap.get(x.wk) ?? 0) + Number(x.count));
      }
      const engagementGrowth = weekKeys.map((wk) => ({ week: wk, count: engMap.get(wk) ?? 0 }));

      res.json({
        chef: { id: chef.id, handle: chef.handle, displayName: chef.displayName },
        totals: t,
        followerCount: chef.followerCount ?? 0,
        engagementRate,
        followerGrowth: toSeries(fgRows as { wk: string; count: number }[]),
        engagementGrowth,
        reels: reelsWithRate,
        topReels: reelsWithRate.slice(0, 5),
      });
    } catch (err: any) {
      console.error("[chef-analytics] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== MUSIC LIBRARY =====
  // Curated royalty-free music tracks (Pixabay Music seeded by admin).
  app.get("/api/music/search", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const vibe = typeof req.query.vibe === "string" ? req.query.vibe.trim() : "";
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

      const conditions = [];
      if (q.length > 0) {
        conditions.push(or(ilike(musicTracks.title, `%${q}%`), ilike(musicTracks.artist, `%${q}%`)));
      }
      if (vibe.length > 0) {
        // Cast: vibe column is a narrow union; the API accepts any string and filters at DB level.
        conditions.push(eq(musicTracks.vibe, vibe as any));
      }

      const rows = await db
        .select()
        .from(musicTracks)
        .where(conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(musicTracks.createdAt))
        .limit(limit);

      res.json({ tracks: rows });
    } catch (err: any) {
      console.error("[music-search] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== REEL ENGAGEMENTS (Phase E) =====
  // Generic toggle helper: insert-or-delete a (user_id, reel_id) row and bump/unbump the
  // denormalized counter on reels in the same transaction.
  type EngagementTable = typeof reelLikes | typeof reelSaves;
  type CounterColumn = "likeCount" | "saveCount";
  type NotificationType = "like" | "save";

  async function toggleEngagement(
    table: EngagementTable,
    counterColumn: CounterColumn,
    notificationType: NotificationType,
    userId: number,
    reelId: number,
  ): Promise<{ active: boolean; count: number }> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(table)
        .where(and(eq(table.userId, userId), eq(table.reelId, reelId)))
        .limit(1);

      // Look up the reel's chef user_id and linked recipe id once.
      // chef_user_id drives the notification side-effect; recipe_id drives the
      // Save → user_favorite_recipes sync.
      const [reelInfo] = await tx
        .select({ chefUserId: chefProfiles.userId, recipeId: reels.recipeId })
        .from(reels)
        .innerJoin(chefProfiles, eq(chefProfiles.id, reels.chefId))
        .where(eq(reels.id, reelId))
        .limit(1);

      if (existing) {
        // Toggle OFF.
        await tx.delete(table).where(and(eq(table.userId, userId), eq(table.reelId, reelId)));
        const counterSql = counterColumn === "likeCount"
          ? sql`GREATEST(${reels.likeCount} - 1, 0)`
          : sql`GREATEST(${reels.saveCount} - 1, 0)`;
        const [updated] = await tx
          .update(reels)
          .set({ [counterColumn]: counterSql })
          .where(eq(reels.id, reelId))
          .returning({
            likeCount: reels.likeCount,
            saveCount: reels.saveCount,
          });
        // Remove the matching notification so the chef's inbox stays clean.
        if (reelInfo && reelInfo.chefUserId !== userId) {
          await tx.delete(notifications).where(and(
            eq(notifications.recipientUserId, reelInfo.chefUserId),
            eq(notifications.actorUserId, userId),
            eq(notifications.reelId, reelId),
            eq(notifications.type, notificationType),
          ));
        }
        // Save-specific: also un-favorite the linked recipe so My Meals reflects the toggle.
        if (notificationType === "save" && reelInfo?.recipeId) {
          await tx.delete(userFavoriteRecipes).where(and(
            eq(userFavoriteRecipes.userId, userId),
            eq(userFavoriteRecipes.recipeId, reelInfo.recipeId),
          ));
        }
        return { active: false, count: (updated as any)?.[counterColumn] ?? 0 };
      }

      // Toggle ON.
      await tx.insert(table).values({ userId, reelId });
      const counterSql = counterColumn === "likeCount"
        ? sql`${reels.likeCount} + 1`
        : sql`${reels.saveCount} + 1`;
      const [updated] = await tx
        .update(reels)
        .set({ [counterColumn]: counterSql })
        .where(eq(reels.id, reelId))
        .returning({
          likeCount: reels.likeCount,
          saveCount: reels.saveCount,
        });
      // Insert a notification if the actor isn't the chef themselves.
      if (reelInfo && reelInfo.chefUserId !== userId) {
        await tx.insert(notifications).values({
          recipientUserId: reelInfo.chefUserId,
          actorUserId: userId,
          type: notificationType,
          reelId,
        }).onConflictDoNothing();
      }
      // Save-specific: add the linked recipe to user_favorite_recipes (the "My Meals" list)
      // unless it's already there. No unique constraint on (user_id, recipe_id), so we dedupe manually.
      if (notificationType === "save" && reelInfo?.recipeId) {
        const [existingFav] = await tx
          .select({ id: userFavoriteRecipes.id })
          .from(userFavoriteRecipes)
          .where(and(
            eq(userFavoriteRecipes.userId, userId),
            eq(userFavoriteRecipes.recipeId, reelInfo.recipeId),
          ))
          .limit(1);
        if (!existingFav) {
          // recipe_payload is required (notNull). Fetch the recipe from Supabase so
          // the My Meals row stays self-contained even if the source recipe changes later.
          const recipe = await getRecipeByIdFromSupabase(reelInfo.recipeId);
          if (recipe) {
            await tx.insert(userFavoriteRecipes).values({
              userId,
              recipeId: reelInfo.recipeId,
              recipePayload: {
                id: recipe.id,
                title: recipe.title,
                image: recipe.image,
                cookTime: recipe.cookTime,
                servings: recipe.servings,
                calories: recipe.calories,
                protein: recipe.protein,
                carbs: recipe.carbs,
                fat: recipe.fat,
                mealTypes: recipe.mealTypes,
                cookingStyle: recipe.cookingStyle,
                ingredients: recipe.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit })),
              },
            });
          }
        }
      }
      return { active: true, count: (updated as any)?.[counterColumn] ?? 0 };
    });
  }

  const engagementTargets = [
    { path: "like", table: reelLikes, counter: "likeCount" as const, type: "like" as const },
    { path: "save", table: reelSaves, counter: "saveCount" as const, type: "save" as const },
  ];
  for (const { path, table, counter, type } of engagementTargets) {
    app.post(`/api/reels/:id/${path}`, async (req, res) => {
      if (!req.user) return res.sendStatus(401);
      const userId = (req.user as any).id;
      const reelId = Number(req.params.id);
      if (!Number.isFinite(reelId)) return res.status(400).json({ error: "Invalid reel id" });
      try {
        const result = await toggleEngagement(table, counter, type, userId, reelId);
        res.json(result);
      } catch (err: any) {
        console.error(`[reel-${path}-toggle] Error:`, err);
        res.status(500).json({ error: err.message });
      }
    });
  }

  // Share tracking — not a toggle. Every tap is an event.
  app.post("/api/reels/:id/share", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const reelId = Number(req.params.id);
    if (!Number.isFinite(reelId)) return res.status(400).json({ error: "Invalid reel id" });
    const method = typeof req.body.method === "string" ? req.body.method.slice(0, 32) : null;
    try {
      const result = await db.transaction(async (tx) => {
        await tx.insert(reelShares).values({ userId, reelId, shareMethod: method });
        const [updated] = await tx
          .update(reels)
          .set({ shareCount: sql`${reels.shareCount} + 1` })
          .where(eq(reels.id, reelId))
          .returning({ shareCount: reels.shareCount });
        return { count: updated?.shareCount ?? 0 };
      });
      res.json(result);
    } catch (err: any) {
      console.error("[reel-share] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Owner-only hard delete. All reel_* FK columns are ON DELETE CASCADE, so engagements
  // and notifications drop automatically. Best-effort cleanup on Cloudflare Stream so
  // the chef's stored-minutes quota is freed.
  app.delete("/api/reels/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid reel id" });
    try {
      const [row] = await db
        .select({ reel: reels, chefUserId: chefProfiles.userId })
        .from(reels)
        .innerJoin(chefProfiles, eq(chefProfiles.id, reels.chefId))
        .where(eq(reels.id, id))
        .limit(1);
      if (!row) return res.status(404).json({ error: "Reel not found" });
      if (row.chefUserId !== userId) return res.status(403).json({ error: "Not yours to delete." });

      // Best-effort Cloudflare Stream cleanup. Non-fatal if it fails — the DB row goes
      // either way; orphaned CF Stream objects can be reaped later.
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
      if (accountId && apiToken && row.reel.cfStreamUid) {
        try {
          await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${row.reel.cfStreamUid}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${apiToken}` } },
          );
        } catch (err) {
          console.error("[reels-delete] CF Stream cleanup failed (non-fatal):", err);
        }
      }

      await db.delete(reels).where(eq(reels.id, id));
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("[reels-delete] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Edit a reel's METADATA (Phase H.20) — title / description / linked recipe. Owner-only (mirror
  // DELETE). Video-bound fields (trim/audio/CF Stream) are NOT editable here. Re-extracts hashtags.
  app.put("/api/reels/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid reel id" });
    try {
      const [row] = await db
        .select({ chefUserId: chefProfiles.userId })
        .from(reels)
        .innerJoin(chefProfiles, eq(chefProfiles.id, reels.chefId))
        .where(eq(reels.id, id))
        .limit(1);
      if (!row) return res.status(404).json({ error: "Reel not found" });
      if (row.chefUserId !== userId) return res.status(403).json({ error: "Not yours to edit." });

      const b = req.body ?? {};
      const update: Record<string, any> = { updatedAt: new Date() };
      if (typeof b.title === "string") update.title = b.title.trim().slice(0, 200) || null;
      let descChanged = false;
      if (typeof b.description === "string") {
        update.description = b.description.trim().slice(0, 2000) || null;
        descChanged = true;
      }
      // Linked recipe is public (recipeId, string) XOR chef (chefRecipeId, int). Either can be cleared.
      if ("recipeId" in b) update.recipeId = b.recipeId ? String(b.recipeId) : null;
      if ("chefRecipeId" in b) update.chefRecipeId = b.chefRecipeId != null ? Number(b.chefRecipeId) : null;
      if (update.recipeId) update.chefRecipeId = null;
      else if (update.chefRecipeId) update.recipeId = null;

      const [updated] = await db.update(reels).set(update).where(eq(reels.id, id)).returning();
      if (descChanged) {
        try {
          await reconcileReelHashtags(id, update.description);
        } catch (e) {
          console.error("[reels-edit] hashtag reconcile failed (non-fatal):", e);
        }
      }
      res.json({ reel: updated });
    } catch (err: any) {
      console.error("[reels-edit] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // List comments for a reel. Excludes soft-deleted. Cursor-paginated by id DESC.
  app.get("/api/reels/:id/comments", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const reelId = Number(req.params.id);
    if (!Number.isFinite(reelId)) return res.status(400).json({ error: "Invalid reel id" });
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;
      const cursorRaw = Number(req.query.cursor);
      const cursor = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;

      const conditions = [eq(reelComments.reelId, reelId), sql`${reelComments.deletedAt} IS NULL`];
      if (cursor) conditions.push(lt(reelComments.id, cursor));

      const rows = await db
        .select({
          id: reelComments.id,
          reelId: reelComments.reelId,
          userId: reelComments.userId,
          body: reelComments.body,
          createdAt: reelComments.createdAt,
          username: users.username,
          displayName: userProfiles.displayName,
          avatarUrl: userProfiles.profileImageUrl,
        })
        .from(reelComments)
        .innerJoin(users, eq(users.id, reelComments.userId))
        .leftJoin(userProfiles, eq(userProfiles.userId, reelComments.userId))
        .where(and(...conditions))
        .orderBy(desc(reelComments.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ comments: items, nextCursor: hasMore ? items[items.length - 1].id : null });
    } catch (err: any) {
      console.error("[reel-comments-get] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create a comment.
  app.post("/api/reels/:id/comments", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const reelId = Number(req.params.id);
    if (!Number.isFinite(reelId)) return res.status(400).json({ error: "Invalid reel id" });
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    if (body.length === 0) return res.status(400).json({ error: "Comment can't be empty." });
    if (body.length > 1000) return res.status(400).json({ error: "Comment too long (max 1000 chars)." });

    try {
      const result = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(reelComments)
          .values({ reelId, userId, body })
          .returning();
        await tx
          .update(reels)
          .set({ commentCount: sql`${reels.commentCount} + 1` })
          .where(eq(reels.id, reelId));
        // Notify the chef who owns the reel (unless they're commenting on their own reel).
        const [reelOwner] = await tx
          .select({ chefUserId: chefProfiles.userId })
          .from(reels)
          .innerJoin(chefProfiles, eq(chefProfiles.id, reels.chefId))
          .where(eq(reels.id, reelId))
          .limit(1);
        if (reelOwner && reelOwner.chefUserId !== userId) {
          await tx.insert(notifications).values({
            recipientUserId: reelOwner.chefUserId,
            actorUserId: userId,
            type: "comment",
            reelId,
            commentId: inserted.id,
          });
        }
        return inserted;
      });

      // Enrich with user metadata to match the GET shape.
      const [enriched] = await db
        .select({
          id: reelComments.id,
          reelId: reelComments.reelId,
          userId: reelComments.userId,
          body: reelComments.body,
          createdAt: reelComments.createdAt,
          username: users.username,
          displayName: userProfiles.displayName,
          avatarUrl: userProfiles.profileImageUrl,
        })
        .from(reelComments)
        .innerJoin(users, eq(users.id, reelComments.userId))
        .leftJoin(userProfiles, eq(userProfiles.userId, reelComments.userId))
        .where(eq(reelComments.id, result.id))
        .limit(1);

      res.status(201).json({ comment: enriched });
    } catch (err: any) {
      console.error("[reel-comments-post] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a comment. Author OR the chef who owns the reel can delete (soft).
  app.delete("/api/comments/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const commentId = Number(req.params.id);
    if (!Number.isFinite(commentId)) return res.status(400).json({ error: "Invalid comment id" });
    try {
      const [comment] = await db
        .select({
          id: reelComments.id,
          reelId: reelComments.reelId,
          userId: reelComments.userId,
          deletedAt: reelComments.deletedAt,
          chefUserId: chefProfiles.userId,
        })
        .from(reelComments)
        .innerJoin(reels, eq(reels.id, reelComments.reelId))
        .innerJoin(chefProfiles, eq(chefProfiles.id, reels.chefId))
        .where(eq(reelComments.id, commentId))
        .limit(1);
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      if (comment.deletedAt) return res.status(409).json({ error: "Already deleted" });

      const canDelete = comment.userId === userId || comment.chefUserId === userId;
      if (!canDelete) return res.status(403).json({ error: "Not allowed to delete this comment." });

      await db.transaction(async (tx) => {
        await tx
          .update(reelComments)
          .set({ deletedAt: new Date() })
          .where(eq(reelComments.id, commentId));
        await tx
          .update(reels)
          .set({ commentCount: sql`GREATEST(${reels.commentCount} - 1, 0)` })
          .where(eq(reels.id, comment.reelId));
        // Remove the originating notification so the chef's inbox stays accurate.
        await tx.delete(notifications).where(eq(notifications.commentId, commentId));
      });

      res.json({ deleted: true });
    } catch (err: any) {
      console.error("[reel-comment-delete] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== CHEF RECIPES (Phase H) =====
  // The chef's own recipe library. Each chef can author recipes manually OR have one
  // auto-generated from a video upload (Whisper transcript + GPT extraction).

  // List the signed-in chef's own recipes (used by the picker + the chef profile recipes tab).
  app.get("/api/chef-recipes/me", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const [chef] = await db
        .select()
        .from(chefProfiles)
        .where(eq(chefProfiles.userId, userId))
        .limit(1);
      if (!chef) return res.json({ recipes: [] }); // not a chef yet — empty library

      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

      const rows = await db
        .select()
        .from(chefRecipes)
        .where(eq(chefRecipes.chefId, chef.id))
        .orderBy(desc(chefRecipes.createdAt))
        .limit(limit);
      res.json({ recipes: rows });
    } catch (err: any) {
      console.error("[chef-recipes-me] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Public-by-id fetch (anyone authed can view a chef recipe — that's the point of a public chef library).
  app.get("/api/chef-recipes/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const rows = await db
        .select({
          recipe: chefRecipes,
          chefHandle: chefProfiles.handle,
          chefDisplayName: chefProfiles.displayName,
          chefAvatarUrl: chefProfiles.avatarUrl,
        })
        .from(chefRecipes)
        .innerJoin(chefProfiles, eq(chefProfiles.id, chefRecipes.chefId))
        .where(eq(chefRecipes.id, id))
        .limit(1);
      if (rows.length === 0) return res.status(404).json({ error: "Recipe not found" });
      const { recipe, chefHandle, chefDisplayName, chefAvatarUrl } = rows[0];
      res.json({ recipe: { ...recipe, chef: { handle: chefHandle, displayName: chefDisplayName, avatarUrl: chefAvatarUrl } } });
    } catch (err: any) {
      console.error("[chef-recipes-get] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Normalize a steps payload into the {instruction, time, location} object shape. Accepts both
  // legacy string entries (auto-upgraded) and the new object shape. Drops empty instructions.
  function sanitizeSteps(raw: unknown): { instruction: string; time: string | null; location: string | null }[] {
    if (!Array.isArray(raw)) return [];
    const out: { instruction: string; time: string | null; location: string | null }[] = [];
    for (const s of raw) {
      if (typeof s === "string") {
        const t = s.trim();
        if (t.length > 0) out.push({ instruction: t.slice(0, 1000), time: null, location: null });
        continue;
      }
      if (s && typeof s === "object" && typeof (s as any).instruction === "string") {
        const instr = (s as any).instruction.trim();
        if (instr.length === 0) continue;
        const rawTime = (s as any).time;
        const rawLoc = (s as any).location;
        out.push({
          instruction: instr.slice(0, 1000),
          time: typeof rawTime === "string" && rawTime.trim().length > 0 ? rawTime.trim().slice(0, 32) : null,
          location: typeof rawLoc === "string" && rawLoc.trim().length > 0 ? rawLoc.trim().slice(0, 64) : null,
        });
      }
    }
    return out;
  }

  // Create. The chef must be approved. Body matches the InsertChefRecipe shape minus chefId.
  app.post("/api/chef-recipes", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const [chef] = await db
        .select()
        .from(chefProfiles)
        .where(eq(chefProfiles.userId, userId))
        .limit(1);
      if (!chef || !chef.isApproved) {
        return res.status(403).json({ error: "Only approved Chef Creators can create recipes." });
      }
      const b = req.body ?? {};
      if (typeof b.title !== "string" || b.title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required." });
      }
      const rawIngredients = Array.isArray(b.ingredients) ? b.ingredients : [];
      // Normalize before persist: vague amounts → sensible defaults, units → InstacartUnit,
      // names → canonical from public.ingredients. The shape stored in JSONB is still the
      // bare { name, amount, unit } triple via toStoredShape().
      const normalized = await normalizeIngredients(rawIngredients).catch((err) => {
        console.error("[chef-recipes-post] Ingredient normalization failed (using raw):", err?.message ?? err);
        return null;
      });
      const ingredients = normalized ? normalized.map(toStoredShape) : rawIngredients;
      const servings = Number.isFinite(Number(b.servings)) ? Number(b.servings) : null;
      // Compute per-serving macros from the (now-normalized) ingredients list. Best-effort:
      // returns null if no ingredients matched. Doesn't block insert on failure.
      const nutrition = await computeChefRecipeNutrition(ingredients, servings ?? 1).catch((err) => {
        console.error("[chef-recipes-post] Nutrition compute failed (non-fatal):", err?.message ?? err);
        return null;
      });

      const [created] = await db
        .insert(chefRecipes)
        .values({
          chefId: chef.id,
          title: b.title.trim().slice(0, 200),
          description: typeof b.description === "string" ? b.description.slice(0, 2000) : null,
          photoUrl: typeof b.photoUrl === "string" ? b.photoUrl : null,
          prepTimeMinutes: Number.isFinite(Number(b.prepTimeMinutes)) ? Number(b.prepTimeMinutes) : null,
          cookTimeMinutes: Number.isFinite(Number(b.cookTimeMinutes)) ? Number(b.cookTimeMinutes) : null,
          passiveTimeMinutes: Number.isFinite(Number(b.passiveTimeMinutes)) ? Number(b.passiveTimeMinutes) : null,
          totalTimeMinutes: Number.isFinite(Number(b.totalTimeMinutes)) ? Number(b.totalTimeMinutes) : null,
          servings,
          ingredients,
          steps: sanitizeSteps(b.steps),
          source: ["manual", "gpt_extracted", "cloned_from_public"].includes(b.source) ? b.source : "manual",
          sourceTranscript: typeof b.sourceTranscript === "string" ? b.sourceTranscript : null,
          nutrition,
        })
        .returning();
      res.status(201).json({ recipe: created });
    } catch (err: any) {
      console.error("[chef-recipes-post] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update — owner only.
  app.put("/api/chef-recipes/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const [existing] = await db
        .select({ recipe: chefRecipes, chefUserId: chefProfiles.userId })
        .from(chefRecipes)
        .innerJoin(chefProfiles, eq(chefProfiles.id, chefRecipes.chefId))
        .where(eq(chefRecipes.id, id))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Recipe not found" });
      if (existing.chefUserId !== userId) return res.status(403).json({ error: "Not yours to edit." });

      const b = req.body ?? {};
      const updates: Partial<typeof chefRecipes.$inferInsert> = {};
      if (typeof b.title === "string") updates.title = b.title.trim().slice(0, 200);
      if (typeof b.description === "string" || b.description === null) updates.description = b.description?.slice(0, 2000) ?? null;
      if (typeof b.photoUrl === "string" || b.photoUrl === null) updates.photoUrl = b.photoUrl ?? null;
      if ("prepTimeMinutes" in b) updates.prepTimeMinutes = Number.isFinite(Number(b.prepTimeMinutes)) ? Number(b.prepTimeMinutes) : null;
      if ("cookTimeMinutes" in b) updates.cookTimeMinutes = Number.isFinite(Number(b.cookTimeMinutes)) ? Number(b.cookTimeMinutes) : null;
      if ("passiveTimeMinutes" in b) updates.passiveTimeMinutes = Number.isFinite(Number(b.passiveTimeMinutes)) ? Number(b.passiveTimeMinutes) : null;
      if ("totalTimeMinutes" in b) updates.totalTimeMinutes = Number.isFinite(Number(b.totalTimeMinutes)) ? Number(b.totalTimeMinutes) : null;
      if ("servings" in b) updates.servings = Number.isFinite(Number(b.servings)) ? Number(b.servings) : null;
      if (Array.isArray(b.ingredients)) {
        // Normalize on edit too — chefs can paste in vague text via the edit sheet.
        const normalized = await normalizeIngredients(b.ingredients).catch((err) => {
          console.error("[chef-recipes-put] Normalization failed (using raw):", err?.message ?? err);
          return null;
        });
        updates.ingredients = normalized ? normalized.map(toStoredShape) : b.ingredients;
      }
      if (Array.isArray(b.steps)) updates.steps = sanitizeSteps(b.steps);

      // If ingredients OR servings changed, recompute macros from the canonical source.
      const ingredientsChanged = Array.isArray(b.ingredients);
      const servingsChanged = "servings" in b;
      if (ingredientsChanged || servingsChanged) {
        const nextIngredients = updates.ingredients ?? existing.recipe.ingredients ?? [];
        const nextServings = updates.servings ?? existing.recipe.servings ?? 1;
        updates.nutrition = await computeChefRecipeNutrition(nextIngredients, nextServings ?? 1).catch((err) => {
          console.error("[chef-recipes-put] Nutrition compute failed (non-fatal):", err?.message ?? err);
          return null;
        });
      }

      const [updated] = await db.update(chefRecipes).set(updates).where(eq(chefRecipes.id, id)).returning();
      res.json({ recipe: updated });
    } catch (err: any) {
      console.error("[chef-recipes-put] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete — owner only. plan_meals.chef_recipe_id and reels.chef_recipe_id are both
  // ON DELETE SET NULL, so dependents stay alive minus the recipe link.
  app.delete("/api/chef-recipes/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const [existing] = await db
        .select({ recipe: chefRecipes, chefUserId: chefProfiles.userId })
        .from(chefRecipes)
        .innerJoin(chefProfiles, eq(chefProfiles.id, chefRecipes.chefId))
        .where(eq(chefRecipes.id, id))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Recipe not found" });
      if (existing.chefUserId !== userId) return res.status(403).json({ error: "Not yours to delete." });

      await db.delete(chefRecipes).where(eq(chefRecipes.id, id));
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("[chef-recipes-delete] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Photo upload — multipart 5MB cap, image MIME required. Returns the public URL.
  const recipePhotoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });
  app.post("/api/chef-recipes/photo", recipePhotoUpload.single("photo"), async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing 'photo' file." });
    if (!file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Photo must be an image." });
    }
    try {
      const [chef] = await db
        .select()
        .from(chefProfiles)
        .where(eq(chefProfiles.userId, userId))
        .limit(1);
      if (!chef) return res.status(403).json({ error: "Not a Chef Creator." });

      const supabase = getSupabaseClient();
      const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
      const fileName = `${chef.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chef-recipe-photos")
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chef-recipe-photos").getPublicUrl(fileName);
      res.json({ photoUrl: urlData.publicUrl });
    } catch (err: any) {
      console.error("[chef-recipe-photo-upload] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // SSE recipe extraction: Whisper transcript → GPT structured extraction → fields streamed
  // back one-by-one. Single POST with multipart video; the response is text/event-stream.
  const recipeExtractUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });
  app.post("/api/reels/extract-recipe", extractRecipeLimiter, recipeExtractUpload.single("video"), async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing 'video' file." });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    // Heartbeat so reverse-proxies don't kill the connection.
    const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15000);
    req.on("close", () => clearInterval(heartbeat));

    try {
      send("stage", { stage: "transcribing", message: "Listening to your video…" });
      const audio = await extractAudio(file.buffer);

      let transcript = "";
      try {
        transcript = await transcribeAudio(audio);
      } catch (transcribeErr: any) {
        // Whisper failure — extract from an empty transcript (GPT will return mostly nulls).
        console.error("[extract-recipe] Whisper failed:", transcribeErr);
        send("warning", { message: "Couldn't transcribe audio. Recipe fields may be incomplete." });
      }

      send("stage", { stage: "analyzing", message: "Extracting ingredients and steps…" });
      const recipe = await extractRecipeFromTranscript(transcript);

      // Post-extraction normalization: clean any vague amounts the model slipped past the
      // schema, map units down to InstacartUnit, and canonicalize names against the 2,792-row
      // public.ingredients catalog so the cart can deduplicate downstream. Best-effort —
      // failures fall through to the raw GPT output (still in canonical shape thanks to the
      // strict JSON schema).
      if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
        try {
          const normalized = await normalizeIngredients(recipe.ingredients);
          recipe.ingredients = normalized.map(toStoredShape);
        } catch (normErr: any) {
          console.error("[extract-recipe] Normalization failed (using raw GPT output):", normErr?.message ?? normErr);
        }
      }

      // Fire field events one-by-one so the form pops in dramatically. Even though GPT returns
      // the whole object at once, the staggered emission feels TikTok-style on the client.
      const fieldOrder: (keyof typeof recipe)[] = [
        "title",
        "servings",
        "prepTimeMinutes",
        "cookTimeMinutes",
        "passiveTimeMinutes",
        "ingredients",
        "steps",
      ];
      for (const name of fieldOrder) {
        send("field", { name, value: recipe[name] });
        await new Promise((r) => setTimeout(r, 80)); // small staggered pacing
      }

      send("complete", { recipe, transcript });
    } catch (err: any) {
      console.error("[extract-recipe] Error:", err);
      const isConfigError = /OPENAI_API_KEY|AI_INTEGRATIONS/.test(err?.message ?? "");
      send("error", { message: err?.message ?? "Extraction failed", configError: isConfigError });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });

  // ===== PUBLIC CHEF PROFILE (by vanity handle) =====
  // Reserved handles that conflict with our route structure or are otherwise off-limits.
  const RESERVED_HANDLES = new Set([
    "me", "admin", "api", "app", "auth", "chef", "settings", "profile",
    "recipes", "reels", "upload", "analytics", "share", "login", "register",
    "onboarding", "paywall", "preferences", "macro-wizard", "pro-welcome",
    "instacart", "pantry", "cart", "plan", "planner", "notifications",
  ]);
  const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;

  app.get("/api/chef/:handle", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const handle = String(req.params.handle).toLowerCase();
    try {
      const [profile] = await db
        .select()
        .from(chefProfiles)
        .where(and(eq(chefProfiles.handle, handle), eq(chefProfiles.isApproved, true)))
        .limit(1);
      if (!profile) return res.status(404).json({ error: "Chef not found" });
      // Whether the viewing user follows this chef (followerCount is on the profile row).
      const [follow] = await db
        .select({ userId: chefFollowers.userId })
        .from(chefFollowers)
        .where(and(eq(chefFollowers.chefId, profile.id), eq(chefFollowers.userId, userId)))
        .limit(1);
      res.json({ profile, isFollowing: !!follow });
    } catch (err: any) {
      console.error("[chef-by-handle] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ===== FOLLOWS (Phase H.17) =====
  // Toggle follow on a chef. Mirrors the like/save engagement pattern: insert/delete + denormalized
  // counter in one transaction, plus a deduped "follow" notification.
  async function setFollow(userId: number, chefId: number, follow: boolean): Promise<number> {
    return await db.transaction(async (tx) => {
      const [chef] = await tx
        .select({ id: chefProfiles.id, chefUserId: chefProfiles.userId, count: chefProfiles.followerCount })
        .from(chefProfiles)
        .where(eq(chefProfiles.id, chefId))
        .limit(1);
      if (!chef) throw Object.assign(new Error("Chef not found"), { status: 404 });
      if (chef.chefUserId === userId) throw Object.assign(new Error("Cannot follow your own profile"), { status: 400 });

      if (follow) {
        const inserted = await tx.insert(chefFollowers).values({ userId, chefId }).onConflictDoNothing().returning({ userId: chefFollowers.userId });
        if (inserted.length > 0) {
          const [row] = await tx.update(chefProfiles).set({ followerCount: sql`${chefProfiles.followerCount} + 1` }).where(eq(chefProfiles.id, chefId)).returning({ count: chefProfiles.followerCount });
          await tx.insert(notifications).values({ recipientUserId: chef.chefUserId, actorUserId: userId, type: "follow" }).onConflictDoNothing();
          return row.count;
        }
        return chef.count;
      } else {
        const deleted = await tx.delete(chefFollowers).where(and(eq(chefFollowers.userId, userId), eq(chefFollowers.chefId, chefId))).returning({ userId: chefFollowers.userId });
        if (deleted.length > 0) {
          const [row] = await tx.update(chefProfiles).set({ followerCount: sql`GREATEST(${chefProfiles.followerCount} - 1, 0)` }).where(eq(chefProfiles.id, chefId)).returning({ count: chefProfiles.followerCount });
          return row.count;
        }
        return chef.count;
      }
    });
  }

  app.post("/api/chefs/:chefId/follow", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const chefId = Number(req.params.chefId);
    if (!Number.isFinite(chefId)) return res.status(400).json({ error: "Invalid chef id" });
    try {
      const followerCount = await setFollow(userId, chefId, true);
      res.json({ following: true, followerCount });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  app.delete("/api/chefs/:chefId/follow", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const chefId = Number(req.params.chefId);
    if (!Number.isFinite(chefId)) return res.status(400).json({ error: "Invalid chef id" });
    try {
      const followerCount = await setFollow(userId, chefId, false);
      res.json({ following: false, followerCount });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  // Chefs the current user follows (powers the profile "Following" list + reels Following feed).
  app.get("/api/me/following", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
      const cursorRaw = Number(req.query.cursor);
      const cursor = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;
      const conditions = [eq(chefFollowers.userId, userId)];
      if (cursor) conditions.push(lt(chefProfiles.id, cursor));
      const rows = await db
        .select({
          chefId: chefProfiles.id,
          handle: chefProfiles.handle,
          displayName: chefProfiles.displayName,
          avatarUrl: chefProfiles.avatarUrl,
          followerCount: chefProfiles.followerCount,
        })
        .from(chefFollowers)
        .innerJoin(chefProfiles, eq(chefProfiles.id, chefFollowers.chefId))
        .where(and(...conditions))
        .orderBy(desc(chefProfiles.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ chefs: items, nextCursor: hasMore ? items[items.length - 1].chefId : null });
    } catch (err: any) {
      console.error("[me-following] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Creator-only: who follows ME. Resolves the calling user's chef profile, then lists followers.
  app.get("/api/chef/me/followers", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const [me] = await db.select({ id: chefProfiles.id }).from(chefProfiles).where(eq(chefProfiles.userId, userId)).limit(1);
      if (!me) return res.status(403).json({ error: "Not a chef" });
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
      const cursorRaw = Number(req.query.cursor);
      const offset = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : 0; // cursor = offset
      // Followers don't all have chef profiles; surface their display info from userProfiles.
      const rows = await db
        .select({
          userId: chefFollowers.userId,
          followedAt: chefFollowers.createdAt,
          username: users.username,
          displayName: userProfiles.displayName,
          avatarUrl: userProfiles.profileImageUrl,
          chefHandle: chefProfiles.handle,
        })
        .from(chefFollowers)
        .innerJoin(users, eq(users.id, chefFollowers.userId))
        .leftJoin(userProfiles, eq(userProfiles.userId, chefFollowers.userId))
        .leftJoin(chefProfiles, eq(chefProfiles.userId, chefFollowers.userId))
        .where(eq(chefFollowers.chefId, me.id))
        .orderBy(desc(chefFollowers.createdAt))
        .limit(limit + 1)
        .offset(offset);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ followers: items, nextCursor: hasMore ? offset + limit : null });
    } catch (err: any) {
      console.error("[chef-me-followers] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Reels uploaded by a specific chef (vanity handle). Cursor-paginated by id DESC.
  app.get("/api/chef/:handle/reels", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const handle = String(req.params.handle).toLowerCase();
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 12;
      const cursorRaw = Number(req.query.cursor);
      const cursor = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;

      const [chef] = await db
        .select()
        .from(chefProfiles)
        .where(and(eq(chefProfiles.handle, handle), eq(chefProfiles.isApproved, true)))
        .limit(1);
      if (!chef) return res.status(404).json({ error: "Chef not found" });

      const whereConditions = [
        eq(reels.chefId, chef.id),
        eq(reels.status, "published"),
        eq(reels.fingerprintStatus, "clean"),
      ];
      if (cursor) whereConditions.push(lt(reels.id, cursor));

      const rows = await db
        .select({
          id: reels.id,
          chefId: reels.chefId,
          cfStreamUid: reels.cfStreamUid,
          playbackUrl: reels.playbackUrl,
          thumbnailUrl: reels.thumbnailUrl,
          title: reels.title,
          description: reels.description,
          recipeId: reels.recipeId,
          chefRecipeId: reels.chefRecipeId,
          durationS: reels.durationS,
          status: reels.status,
          fingerprintStatus: reels.fingerprintStatus,
          likeCount: reels.likeCount,
          saveCount: reels.saveCount,
          shareCount: reels.shareCount,
          commentCount: reels.commentCount,
          viewCount: reels.viewCount,
          createdAt: reels.createdAt,
          liked: sql<boolean>`(${reelLikes.userId} IS NOT NULL)`,
          saved: sql<boolean>`(${reelSaves.userId} IS NOT NULL)`,
        })
        .from(reels)
        .leftJoin(reelLikes, and(eq(reelLikes.reelId, reels.id), eq(reelLikes.userId, userId)))
        .leftJoin(reelSaves, and(eq(reelSaves.reelId, reels.id), eq(reelSaves.userId, userId)))
        .where(and(...whereConditions))
        .orderBy(desc(reels.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      res.json({ reels: items, nextCursor: hasMore ? items[items.length - 1].id : null });
    } catch (err: any) {
      console.error("[chef-reels] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Public list of a chef's authored recipes by handle. Backs the Recipes tab on the
  // chef profile page. Auth-gated like the reels endpoint (any signed-in user can browse).
  app.get("/api/chef/:handle/recipes", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const handle = String(req.params.handle).toLowerCase();
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 24;

      const [chef] = await db
        .select()
        .from(chefProfiles)
        .where(and(eq(chefProfiles.handle, handle), eq(chefProfiles.isApproved, true)))
        .limit(1);
      if (!chef) return res.status(404).json({ error: "Chef not found" });

      const rows = await db
        .select()
        .from(chefRecipes)
        .where(eq(chefRecipes.chefId, chef.id))
        .orderBy(desc(chefRecipes.createdAt))
        .limit(limit);

      res.json({ recipes: rows });
    } catch (err: any) {
      console.error("[chef-handle-recipes] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update own chef profile. Allows changing displayName, bio, and handle (with validation).
  app.put("/api/chef/me", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const [existing] = await db
        .select()
        .from(chefProfiles)
        .where(eq(chefProfiles.userId, userId))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Not a Chef Creator." });

      const updates: Partial<typeof chefProfiles.$inferInsert> = {};

      if (typeof req.body.displayName === "string") {
        const dn = req.body.displayName.trim().slice(0, 80);
        if (dn.length < 2) return res.status(400).json({ error: "Display name must be at least 2 characters." });
        updates.displayName = dn;
      }
      if (typeof req.body.bio === "string") {
        updates.bio = req.body.bio.trim().slice(0, 500);
      }
      if (typeof req.body.handle === "string") {
        const newHandle = req.body.handle.trim().toLowerCase();
        if (newHandle !== existing.handle) {
          if (!HANDLE_REGEX.test(newHandle)) {
            return res.status(400).json({
              error: "Handle must be 3-30 characters: lowercase letters, numbers, underscores only.",
            });
          }
          if (RESERVED_HANDLES.has(newHandle)) {
            return res.status(400).json({ error: "That handle is reserved. Pick another." });
          }
          const [taken] = await db
            .select({ id: chefProfiles.id })
            .from(chefProfiles)
            .where(eq(chefProfiles.handle, newHandle))
            .limit(1);
          if (taken) return res.status(409).json({ error: "That handle is taken." });
          updates.handle = newHandle;
        }
      }

      if (Object.keys(updates).length === 0) return res.json({ profile: existing });

      const [updated] = await db
        .update(chefProfiles)
        .set(updates)
        .where(eq(chefProfiles.userId, userId))
        .returning();

      res.json({ profile: updated });
    } catch (err: any) {
      console.error("[chef-me-put] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Upload / replace the chef's avatar (multipart). Stores in Supabase Storage 'chef-avatars'.
  const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap
  });
  app.post("/api/chef/me/avatar", avatarUpload.single("avatar"), async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing 'avatar' file." });
    if (!file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Avatar must be an image." });
    }

    try {
      const [chef] = await db
        .select()
        .from(chefProfiles)
        .where(eq(chefProfiles.userId, userId))
        .limit(1);
      if (!chef) return res.status(404).json({ error: "Not a Chef Creator." });

      const supabase = getSupabaseClient();
      const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
      const fileName = `${chef.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chef-avatars")
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chef-avatars").getPublicUrl(fileName);

      const [updated] = await db
        .update(chefProfiles)
        .set({ avatarUrl: urlData.publicUrl })
        .where(eq(chefProfiles.userId, userId))
        .returning();

      res.json({ profile: updated, avatarUrl: urlData.publicUrl });
    } catch (err: any) {
      console.error("[chef-avatar-upload] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Submit a Chef Creator application. Status starts 'pending'; admin approves via Supabase dashboard.
  app.post("/api/chef-applications", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const userId = (req.user as any).id;
    try {
      const [existingPending] = await db
        .select()
        .from(chefApplications)
        .where(and(eq(chefApplications.userId, userId), eq(chefApplications.status, "pending")))
        .limit(1);
      if (existingPending) {
        return res.status(409).json({ error: "You already have a pending application." });
      }
      const [existingProfile] = await db
        .select()
        .from(chefProfiles)
        .where(eq(chefProfiles.userId, userId))
        .limit(1);
      if (existingProfile?.isApproved) {
        return res.status(409).json({ error: "You are already an approved Chef Creator." });
      }
      const input = insertChefApplicationSchema.parse({ ...req.body, userId });
      const [application] = await db.insert(chefApplications).values(input).returning();
      res.status(201).json(application);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ error: "Invalid input", details: err.errors });
      }
      console.error("[chef-applications-post] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
