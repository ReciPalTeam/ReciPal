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
import { planMeals, planDays, recipes } from "@shared/schema";
import { eq } from "drizzle-orm";

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
    very: 1.725
  };
  
  let tdee = bmr * (activityMultipliers[profile.activityLevel] || 1.2);
  
  // Goal Adjustment
  if (profile.goal === 'cut') tdee *= 0.85;
  if (profile.goal === 'bulk') tdee *= 1.10;
  
  const targetCalories = Math.round(tdee);
  
  // Protein
  let proteinFactor = 0.8;
  if (profile.goal === 'cut') proteinFactor = 1.0;
  
  const targetProtein = Math.round(profile.weight * proteinFactor);
  const proteinCals = targetProtein * 4;
  
  // Fat (25% of cals)
  const targetFat = Math.round((targetCalories * 0.25) / 9);
  const fatCals = targetFat * 9;
  
  // Carbs (remainder)
  const targetCarbs = Math.round((targetCalories - proteinCals - fatCals) / 4);
  
  return { targetCalories, targetProtein, targetCarbs, targetFat };
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
      const macros = calculateMacros(req.body);
      const input = api.profile.create.input.parse({ ...req.body, ...macros });
      const profile = await storage.createProfile({ ...input, userId: (req.user as any).id });
      res.status(201).json(profile);
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

    // Generate Plan Logic
    const startDate = new Date().toISOString().split('T')[0]; // Start today
    const plan = await storage.createWeeklyPlan(userId, startDate);
    
    const recipes = await storage.getRecipes();
    const days = await storage.getWeeklyPlanDays(plan.id);

    for (const day of days) {
      const mealSlots = [];
      const mealsPerDay = profile.mealsPerDay;
      const snacksPerDay = profile.snacksPerDay;

      // Simple distribution
      for (let i = 0; i < mealsPerDay; i++) mealSlots.push('lunch'); // Simplified
      if (mealsPerDay >= 1) mealSlots[0] = 'breakfast';
      if (mealsPerDay >= 3) mealSlots[mealsPerDay - 1] = 'dinner';
      for (let i = 0; i < snacksPerDay; i++) mealSlots.push('snack');

      for (let i = 0; i < mealSlots.length; i++) {
        const type = mealSlots[i];
        const candidates = recipes.filter(r => r.mealType === type);
        const recipe = candidates[Math.floor(Math.random() * candidates.length)] || recipes[0];
        
        await db.insert(planMeals).values({
          planDayId: day.id,
          slotIndex: i,
          mealType: type,
          recipeId: recipe.id,
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

    const recipeOptions = await storage.getRecipesByMealType(meal.mealType);
    if (recipeOptions.length === 0) {
      return res.status(400).json({ message: "No alternative recipes available" });
    }
    const newRecipe = recipeOptions[Math.floor(Math.random() * recipeOptions.length)];
    
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
    const ingredients: any[] = [];
    
    days.forEach(day => {
      day.meals.forEach(meal => {
        meal.recipe.ingredients.forEach((ing: any) => {
          ingredients.push(ing);
        });
      });
    });

    // Aggregate
    const aggregated: Record<string, any> = {};
    ingredients.forEach(ing => {
      if (aggregated[ing.name]) {
        aggregated[ing.name].amount += ing.amount;
      } else {
        aggregated[ing.name] = { ...ing, isStaple: false, haveInPantry: false };
      }
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

  // Seeding - only run if database is empty to avoid duplicates
  const existingRecipes = await storage.getRecipes();
  if (existingRecipes.length === 0) {
    console.log("Seeding Database with recipes...");
    
    // Seed Recipes - 30 diverse recipes with real macro data
    const seedRecipes = [
      // BREAKFASTS (8)
      { name: "Oatmeal & Berries", mealType: "breakfast", prepTimeMinutes: 10, calories: 350, protein: 12, carbs: 60, fat: 6, ingredients: [{name: "oats", amount: 50, unit: "g", category: "pantry"}, {name: "mixed berries", amount: 100, unit: "g", category: "produce"}, {name: "honey", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Boil water", "Add oats and cook 5 min", "Top with berries and honey"], tags: ["vegetarian", "quick"], allergens: [] },
      { name: "Scrambled Eggs & Avocado Toast", mealType: "breakfast", prepTimeMinutes: 12, calories: 450, protein: 22, carbs: 32, fat: 26, ingredients: [{name: "eggs", amount: 3, unit: "count", category: "dairy"}, {name: "whole wheat bread", amount: 2, unit: "slices", category: "bakery"}, {name: "avocado", amount: 0.5, unit: "count", category: "produce"}], instructions: ["Scramble eggs in pan", "Toast bread", "Mash avocado on toast", "Serve together"], tags: ["vegetarian", "high-protein"], allergens: ["eggs", "wheat"] },
      { name: "Protein Pancakes", mealType: "breakfast", prepTimeMinutes: 20, calories: 420, protein: 35, carbs: 45, fat: 10, ingredients: [{name: "protein powder", amount: 30, unit: "g", category: "pantry"}, {name: "oats", amount: 40, unit: "g", category: "pantry"}, {name: "egg whites", amount: 100, unit: "ml", category: "dairy"}, {name: "banana", amount: 1, unit: "count", category: "produce"}], instructions: ["Blend all ingredients", "Cook on griddle", "Serve with banana slices"], tags: ["high-protein"], allergens: ["eggs"] },
      { name: "Greek Yogurt Parfait", mealType: "breakfast", prepTimeMinutes: 5, calories: 380, protein: 28, carbs: 42, fat: 12, ingredients: [{name: "greek yogurt", amount: 200, unit: "g", category: "dairy"}, {name: "granola", amount: 40, unit: "g", category: "pantry"}, {name: "mixed berries", amount: 80, unit: "g", category: "produce"}], instructions: ["Layer yogurt in bowl", "Add granola", "Top with berries"], tags: ["vegetarian", "quick", "high-protein"], allergens: ["dairy"] },
      { name: "Breakfast Burrito", mealType: "breakfast", prepTimeMinutes: 15, calories: 520, protein: 32, carbs: 42, fat: 24, ingredients: [{name: "eggs", amount: 3, unit: "count", category: "dairy"}, {name: "flour tortilla", amount: 1, unit: "large", category: "bakery"}, {name: "black beans", amount: 60, unit: "g", category: "pantry"}, {name: "cheese", amount: 30, unit: "g", category: "dairy"}, {name: "salsa", amount: 30, unit: "g", category: "pantry"}], instructions: ["Scramble eggs", "Warm tortilla", "Add beans, eggs, cheese", "Roll and top with salsa"], tags: ["high-protein"], allergens: ["eggs", "wheat", "dairy"] },
      { name: "Smoothie Bowl", mealType: "breakfast", prepTimeMinutes: 8, calories: 340, protein: 18, carbs: 55, fat: 8, ingredients: [{name: "frozen banana", amount: 1, unit: "count", category: "produce"}, {name: "protein powder", amount: 25, unit: "g", category: "pantry"}, {name: "almond milk", amount: 150, unit: "ml", category: "dairy"}, {name: "chia seeds", amount: 10, unit: "g", category: "pantry"}], instructions: ["Blend banana, protein, and milk until thick", "Pour into bowl", "Top with chia seeds"], tags: ["vegetarian", "quick"], allergens: ["nuts"] },
      { name: "Veggie Egg Muffins", mealType: "breakfast", prepTimeMinutes: 25, calories: 280, protein: 24, carbs: 8, fat: 18, ingredients: [{name: "eggs", amount: 4, unit: "count", category: "dairy"}, {name: "spinach", amount: 50, unit: "g", category: "produce"}, {name: "bell pepper", amount: 50, unit: "g", category: "produce"}, {name: "feta cheese", amount: 30, unit: "g", category: "dairy"}], instructions: ["Whisk eggs", "Add chopped veggies and cheese", "Pour into muffin tin", "Bake at 350F for 20 min"], tags: ["vegetarian", "meal-prep", "low-carb"], allergens: ["eggs", "dairy"] },
      { name: "Overnight Oats", mealType: "breakfast", prepTimeMinutes: 5, calories: 390, protein: 16, carbs: 58, fat: 12, ingredients: [{name: "oats", amount: 50, unit: "g", category: "pantry"}, {name: "almond milk", amount: 150, unit: "ml", category: "dairy"}, {name: "chia seeds", amount: 15, unit: "g", category: "pantry"}, {name: "peanut butter", amount: 20, unit: "g", category: "pantry"}], instructions: ["Mix all ingredients in jar", "Refrigerate overnight", "Eat cold or warm"], tags: ["vegetarian", "meal-prep", "quick"], allergens: ["nuts"] },
      
      // LUNCHES (8)
      { name: "Grilled Chicken Salad", mealType: "lunch", prepTimeMinutes: 15, calories: 480, protein: 45, carbs: 12, fat: 28, ingredients: [{name: "chicken breast", amount: 150, unit: "g", category: "meat"}, {name: "mixed greens", amount: 150, unit: "g", category: "produce"}, {name: "cherry tomatoes", amount: 80, unit: "g", category: "produce"}, {name: "olive oil", amount: 2, unit: "tbsp", category: "pantry"}, {name: "feta cheese", amount: 30, unit: "g", category: "dairy"}], instructions: ["Grill chicken breast", "Toss greens with tomatoes", "Slice chicken and add to salad", "Drizzle with olive oil"], tags: ["high-protein", "low-carb"], allergens: ["dairy"] },
      { name: "Turkey Wrap", mealType: "lunch", prepTimeMinutes: 10, calories: 420, protein: 35, carbs: 38, fat: 16, ingredients: [{name: "turkey breast", amount: 120, unit: "g", category: "meat"}, {name: "whole wheat wrap", amount: 1, unit: "large", category: "bakery"}, {name: "lettuce", amount: 50, unit: "g", category: "produce"}, {name: "tomato", amount: 50, unit: "g", category: "produce"}, {name: "mustard", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Lay wrap flat", "Layer turkey, lettuce, tomato", "Add mustard", "Roll tightly"], tags: ["high-protein", "quick"], allergens: ["wheat"] },
      { name: "Quinoa Buddha Bowl", mealType: "lunch", prepTimeMinutes: 20, calories: 520, protein: 18, carbs: 65, fat: 22, ingredients: [{name: "quinoa", amount: 80, unit: "g", category: "pantry"}, {name: "chickpeas", amount: 100, unit: "g", category: "pantry"}, {name: "cucumber", amount: 80, unit: "g", category: "produce"}, {name: "hummus", amount: 60, unit: "g", category: "dairy"}, {name: "mixed greens", amount: 80, unit: "g", category: "produce"}], instructions: ["Cook quinoa", "Roast chickpeas", "Arrange all ingredients in bowl", "Top with hummus"], tags: ["vegan", "high-fiber"], allergens: [] },
      { name: "Tuna Salad Sandwich", mealType: "lunch", prepTimeMinutes: 10, calories: 450, protein: 38, carbs: 35, fat: 18, ingredients: [{name: "canned tuna", amount: 120, unit: "g", category: "pantry"}, {name: "whole wheat bread", amount: 2, unit: "slices", category: "bakery"}, {name: "greek yogurt", amount: 30, unit: "g", category: "dairy"}, {name: "celery", amount: 30, unit: "g", category: "produce"}], instructions: ["Drain tuna", "Mix with yogurt and diced celery", "Spread on bread"], tags: ["high-protein", "quick"], allergens: ["fish", "wheat", "dairy"] },
      { name: "Chicken Stir-Fry Rice Bowl", mealType: "lunch", prepTimeMinutes: 20, calories: 550, protein: 40, carbs: 55, fat: 18, ingredients: [{name: "chicken breast", amount: 140, unit: "g", category: "meat"}, {name: "brown rice", amount: 100, unit: "g", category: "pantry"}, {name: "broccoli", amount: 100, unit: "g", category: "produce"}, {name: "soy sauce", amount: 2, unit: "tbsp", category: "pantry"}, {name: "sesame oil", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Cook rice", "Stir-fry chicken", "Add broccoli and soy sauce", "Serve over rice"], tags: ["high-protein"], allergens: ["soy"] },
      { name: "Mediterranean Grain Bowl", mealType: "lunch", prepTimeMinutes: 15, calories: 480, protein: 22, carbs: 52, fat: 22, ingredients: [{name: "farro", amount: 80, unit: "g", category: "pantry"}, {name: "cucumber", amount: 80, unit: "g", category: "produce"}, {name: "cherry tomatoes", amount: 80, unit: "g", category: "produce"}, {name: "feta cheese", amount: 40, unit: "g", category: "dairy"}, {name: "olives", amount: 30, unit: "g", category: "pantry"}], instructions: ["Cook farro", "Chop vegetables", "Combine all ingredients", "Drizzle with olive oil"], tags: ["vegetarian"], allergens: ["wheat", "dairy"] },
      { name: "Black Bean Tacos", mealType: "lunch", prepTimeMinutes: 15, calories: 440, protein: 16, carbs: 58, fat: 18, ingredients: [{name: "black beans", amount: 150, unit: "g", category: "pantry"}, {name: "corn tortillas", amount: 3, unit: "count", category: "bakery"}, {name: "avocado", amount: 0.5, unit: "count", category: "produce"}, {name: "salsa", amount: 60, unit: "g", category: "pantry"}, {name: "lime", amount: 1, unit: "count", category: "produce"}], instructions: ["Heat beans with spices", "Warm tortillas", "Assemble tacos", "Top with avocado and salsa"], tags: ["vegan", "quick"], allergens: [] },
      { name: "Shrimp Caesar Salad", mealType: "lunch", prepTimeMinutes: 15, calories: 420, protein: 35, carbs: 18, fat: 24, ingredients: [{name: "shrimp", amount: 140, unit: "g", category: "seafood"}, {name: "romaine lettuce", amount: 150, unit: "g", category: "produce"}, {name: "parmesan cheese", amount: 25, unit: "g", category: "dairy"}, {name: "caesar dressing", amount: 30, unit: "g", category: "pantry"}, {name: "croutons", amount: 20, unit: "g", category: "bakery"}], instructions: ["Grill shrimp", "Chop romaine", "Toss with dressing", "Top with shrimp and parmesan"], tags: ["high-protein"], allergens: ["shellfish", "dairy", "wheat"] },
      
      // DINNERS (8)
      { name: "Grilled Salmon with Asparagus", mealType: "dinner", prepTimeMinutes: 25, calories: 520, protein: 42, carbs: 12, fat: 34, ingredients: [{name: "salmon fillet", amount: 180, unit: "g", category: "seafood"}, {name: "asparagus", amount: 150, unit: "g", category: "produce"}, {name: "lemon", amount: 1, unit: "count", category: "produce"}, {name: "olive oil", amount: 2, unit: "tbsp", category: "pantry"}], instructions: ["Season salmon with lemon", "Grill salmon 4-5 min per side", "Roast asparagus with olive oil", "Serve together"], tags: ["high-protein", "low-carb", "keto"], allergens: ["fish"] },
      { name: "Lean Beef Stir-Fry", mealType: "dinner", prepTimeMinutes: 25, calories: 580, protein: 45, carbs: 48, fat: 22, ingredients: [{name: "lean beef", amount: 160, unit: "g", category: "meat"}, {name: "brown rice", amount: 100, unit: "g", category: "pantry"}, {name: "bell peppers", amount: 100, unit: "g", category: "produce"}, {name: "snap peas", amount: 80, unit: "g", category: "produce"}, {name: "soy sauce", amount: 2, unit: "tbsp", category: "pantry"}], instructions: ["Cook rice", "Slice beef thinly", "Stir-fry beef and veggies", "Add soy sauce", "Serve over rice"], tags: ["high-protein"], allergens: ["soy"] },
      { name: "Baked Chicken Thighs", mealType: "dinner", prepTimeMinutes: 40, calories: 550, protein: 40, carbs: 35, fat: 28, ingredients: [{name: "chicken thighs", amount: 200, unit: "g", category: "meat"}, {name: "sweet potato", amount: 150, unit: "g", category: "produce"}, {name: "green beans", amount: 100, unit: "g", category: "produce"}, {name: "garlic", amount: 3, unit: "cloves", category: "produce"}], instructions: ["Season chicken with garlic", "Cube sweet potato", "Bake everything at 400F for 35 min"], tags: ["high-protein", "meal-prep"], allergens: [] },
      { name: "Shrimp Pasta", mealType: "dinner", prepTimeMinutes: 25, calories: 620, protein: 38, carbs: 68, fat: 22, ingredients: [{name: "shrimp", amount: 150, unit: "g", category: "seafood"}, {name: "whole wheat pasta", amount: 100, unit: "g", category: "pantry"}, {name: "cherry tomatoes", amount: 100, unit: "g", category: "produce"}, {name: "garlic", amount: 3, unit: "cloves", category: "produce"}, {name: "olive oil", amount: 2, unit: "tbsp", category: "pantry"}], instructions: ["Cook pasta", "Saute garlic in olive oil", "Add shrimp and tomatoes", "Toss with pasta"], tags: ["high-protein"], allergens: ["shellfish", "wheat"] },
      { name: "Turkey Meatballs with Zucchini Noodles", mealType: "dinner", prepTimeMinutes: 30, calories: 480, protein: 42, carbs: 18, fat: 28, ingredients: [{name: "ground turkey", amount: 180, unit: "g", category: "meat"}, {name: "zucchini", amount: 200, unit: "g", category: "produce"}, {name: "marinara sauce", amount: 120, unit: "g", category: "pantry"}, {name: "parmesan cheese", amount: 20, unit: "g", category: "dairy"}], instructions: ["Form turkey into meatballs", "Bake at 400F for 20 min", "Spiralize zucchini", "Top with sauce and cheese"], tags: ["high-protein", "low-carb"], allergens: ["dairy"] },
      { name: "Vegetable Curry with Rice", mealType: "dinner", prepTimeMinutes: 35, calories: 520, protein: 14, carbs: 72, fat: 20, ingredients: [{name: "chickpeas", amount: 120, unit: "g", category: "pantry"}, {name: "coconut milk", amount: 100, unit: "ml", category: "pantry"}, {name: "basmati rice", amount: 100, unit: "g", category: "pantry"}, {name: "curry paste", amount: 30, unit: "g", category: "pantry"}, {name: "mixed vegetables", amount: 150, unit: "g", category: "produce"}], instructions: ["Cook rice", "Saute curry paste", "Add coconut milk and veggies", "Simmer 20 min", "Serve over rice"], tags: ["vegan"], allergens: [] },
      { name: "Pork Tenderloin with Roasted Vegetables", mealType: "dinner", prepTimeMinutes: 40, calories: 510, protein: 42, carbs: 28, fat: 26, ingredients: [{name: "pork tenderloin", amount: 180, unit: "g", category: "meat"}, {name: "brussels sprouts", amount: 120, unit: "g", category: "produce"}, {name: "carrots", amount: 100, unit: "g", category: "produce"}, {name: "olive oil", amount: 2, unit: "tbsp", category: "pantry"}], instructions: ["Season pork", "Roast pork at 400F for 25 min", "Roast vegetables alongside", "Rest meat before slicing"], tags: ["high-protein"], allergens: [] },
      { name: "Stuffed Bell Peppers", mealType: "dinner", prepTimeMinutes: 45, calories: 480, protein: 32, carbs: 38, fat: 22, ingredients: [{name: "bell peppers", amount: 2, unit: "large", category: "produce"}, {name: "ground beef", amount: 150, unit: "g", category: "meat"}, {name: "brown rice", amount: 60, unit: "g", category: "pantry"}, {name: "tomato sauce", amount: 100, unit: "g", category: "pantry"}, {name: "cheese", amount: 40, unit: "g", category: "dairy"}], instructions: ["Cook rice and beef", "Mix with tomato sauce", "Stuff peppers", "Top with cheese", "Bake at 375F for 30 min"], tags: ["high-protein", "meal-prep"], allergens: ["dairy"] },
      
      // SNACKS (6)
      { name: "Greek Yogurt with Honey", mealType: "snack", prepTimeMinutes: 2, calories: 180, protein: 18, carbs: 20, fat: 3, ingredients: [{name: "greek yogurt", amount: 170, unit: "g", category: "dairy"}, {name: "honey", amount: 1, unit: "tbsp", category: "pantry"}], instructions: ["Scoop yogurt into bowl", "Drizzle with honey"], tags: ["high-protein", "quick", "vegetarian"], allergens: ["dairy"] },
      { name: "Apple with Peanut Butter", mealType: "snack", prepTimeMinutes: 3, calories: 250, protein: 8, carbs: 30, fat: 14, ingredients: [{name: "apple", amount: 1, unit: "medium", category: "produce"}, {name: "peanut butter", amount: 2, unit: "tbsp", category: "pantry"}], instructions: ["Slice apple", "Serve with peanut butter for dipping"], tags: ["vegan", "quick"], allergens: ["nuts"] },
      { name: "Protein Shake", mealType: "snack", prepTimeMinutes: 3, calories: 220, protein: 30, carbs: 12, fat: 6, ingredients: [{name: "protein powder", amount: 30, unit: "g", category: "pantry"}, {name: "almond milk", amount: 250, unit: "ml", category: "dairy"}, {name: "banana", amount: 0.5, unit: "count", category: "produce"}], instructions: ["Add all ingredients to blender", "Blend until smooth"], tags: ["high-protein", "quick"], allergens: ["nuts"] },
      { name: "Cottage Cheese with Berries", mealType: "snack", prepTimeMinutes: 2, calories: 200, protein: 22, carbs: 18, fat: 4, ingredients: [{name: "cottage cheese", amount: 150, unit: "g", category: "dairy"}, {name: "mixed berries", amount: 80, unit: "g", category: "produce"}], instructions: ["Scoop cottage cheese", "Top with berries"], tags: ["high-protein", "quick", "vegetarian"], allergens: ["dairy"] },
      { name: "Trail Mix", mealType: "snack", prepTimeMinutes: 1, calories: 280, protein: 8, carbs: 24, fat: 20, ingredients: [{name: "mixed nuts", amount: 30, unit: "g", category: "pantry"}, {name: "dried cranberries", amount: 20, unit: "g", category: "pantry"}, {name: "dark chocolate chips", amount: 15, unit: "g", category: "pantry"}], instructions: ["Mix all ingredients", "Portion into serving"], tags: ["vegan", "quick"], allergens: ["nuts"] },
      { name: "Hummus with Veggies", mealType: "snack", prepTimeMinutes: 5, calories: 180, protein: 6, carbs: 18, fat: 10, ingredients: [{name: "hummus", amount: 60, unit: "g", category: "dairy"}, {name: "carrots", amount: 80, unit: "g", category: "produce"}, {name: "cucumber", amount: 80, unit: "g", category: "produce"}], instructions: ["Slice vegetables", "Serve with hummus for dipping"], tags: ["vegan", "quick"], allergens: [] }
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
    
    console.log("Seeding Complete - 30 recipes added");
  }

  return httpServer;
}
