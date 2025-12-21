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
import { planMeals, planDays } from "@shared/schema";
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

    const recipes = await storage.getRecipesByMealType(meal.mealType);
    const newRecipe = recipes[Math.floor(Math.random() * recipes.length)];
    
    const updated = await storage.updatePlanMeal(mealId, { recipeId: newRecipe.id });
    const fullMeal = await db.select().from(planMeals).where(eq(planMeals.id, mealId)).leftJoin(recipes, eq(planMeals.recipeId, recipes.id)).then(res => ({...res[0].plan_meals, recipe: res[0].recipes!}));
    
    res.json(fullMeal);
  });
  
  app.patch(api.meals.toggleLock.path, async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const updated = await storage.updatePlanMeal(parseInt(req.params.id), { locked: req.body.locked });
    res.json(updated);
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

  // Seeding
  const existingRecipes = await storage.getRecipes();
  if (existingRecipes.length === 0) {
    console.log("Seeding Database...");
    
    // Seed Recipes
    const seedRecipes = [
      { name: "Oatmeal & Berries", mealType: "breakfast", prepTimeMinutes: 10, calories: 350, protein: 12, carbs: 60, fat: 6, ingredients: [{name: "oats", amount: 50, unit: "g", category: "pantry"}, {name: "berries", amount: 100, unit: "g", category: "produce"}], instructions: ["Boil water", "Add oats", "Top with berries"], tags: ["vegan", "quick"], allergens: [] },
      { name: "Eggs & Toast", mealType: "breakfast", prepTimeMinutes: 10, calories: 400, protein: 20, carbs: 30, fat: 22, ingredients: [{name: "eggs", amount: 2, unit: "count", category: "dairy"}, {name: "bread", amount: 2, unit: "slices", category: "bakery"}], instructions: ["Fry eggs", "Toast bread"], tags: ["vegetarian", "quick"], allergens: ["eggs", "wheat"] },
      { name: "Chicken Salad", mealType: "lunch", prepTimeMinutes: 15, calories: 500, protein: 45, carbs: 10, fat: 30, ingredients: [{name: "chicken breast", amount: 150, unit: "g", category: "meat"}, {name: "lettuce", amount: 200, unit: "g", category: "produce"}], instructions: ["Grill chicken", "Chop lettuce", "Mix"], tags: ["high-protein"], allergens: [] },
      { name: "Pasta Primavera", mealType: "dinner", prepTimeMinutes: 25, calories: 600, protein: 18, carbs: 80, fat: 20, ingredients: [{name: "pasta", amount: 100, unit: "g", category: "pantry"}, {name: "veggies", amount: 200, unit: "g", category: "produce"}], instructions: ["Boil pasta", "Saute veggies", "Combine"], tags: ["vegetarian"], allergens: ["wheat"] },
      { name: "Greek Yogurt", mealType: "snack", prepTimeMinutes: 2, calories: 150, protein: 15, carbs: 10, fat: 0, ingredients: [{name: "greek yogurt", amount: 150, unit: "g", category: "dairy"}], instructions: ["Serve in bowl"], tags: ["high-protein", "quick"], allergens: ["dairy"] },
      { name: "Apple & Almonds", mealType: "snack", prepTimeMinutes: 2, calories: 200, protein: 4, carbs: 25, fat: 10, ingredients: [{name: "apple", amount: 1, unit: "count", category: "produce"}, {name: "almonds", amount: 15, unit: "g", category: "pantry"}], instructions: ["Wash apple", "Eat"], tags: ["vegan", "quick"], allergens: ["nuts"] }
    ];
    
    for (const r of seedRecipes) {
      await storage.createRecipe(r);
    }
    
    // Seed Store
    const store = await storage.createStore({ name: "FreshMart" });
    await storage.createStoreDeal({ storeId: store.id, itemName: "chicken breast", category: "meat", regularPrice: 8.99, salePrice: 6.99, weekStartDate: new Date().toISOString() });
    await storage.createStoreDeal({ storeId: store.id, itemName: "oats", category: "pantry", regularPrice: 3.99, salePrice: 2.99, weekStartDate: new Date().toISOString() });
    
    console.log("Seeding Complete");
  }

  return httpServer;
}
