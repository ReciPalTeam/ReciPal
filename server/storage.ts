import { db } from "./db";
import {
  users, userProfiles, recipes, weeklyPlans, planDays, planMeals, stores, storeDeals, savingsLedger, recipeFavorites,
  pantryItems,
  type User, type InsertUser, type InsertUserProfile, type UserProfile, type Recipe,
  type WeeklyPlan, type PlanDay, type PlanMeal, type Store, type StoreDeal, type RecipeFavorite
} from "@shared/schema";
import { eq, and, desc, gte, lt } from "drizzle-orm";

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Profile
  getProfile(userId: number): Promise<UserProfile | undefined>;
  createProfile(profile: InsertUserProfile & { userId: number }): Promise<UserProfile>;
  updateProfile(userId: number, profile: Partial<InsertUserProfile>): Promise<UserProfile>;
  
  // Recipes
  getRecipes(): Promise<Recipe[]>;
  getRecipe(id: number): Promise<Recipe | undefined>;
  getRecipesByMealType(mealType: string): Promise<Recipe[]>;
  createRecipe(recipe: any): Promise<Recipe>; // For seeding
  
  // Plans
  getCurrentWeeklyPlan(userId: number): Promise<WeeklyPlan | undefined>;
  createWeeklyPlan(userId: number, startDate: string): Promise<WeeklyPlan>;
  getWeeklyPlanDays(planId: number): Promise<(PlanDay & { meals: (PlanMeal & { recipe: Recipe })[] })[]>;
  
  // Meals
  getPlanMeal(id: number): Promise<PlanMeal | undefined>;
  updatePlanMeal(id: number, updates: Partial<PlanMeal>): Promise<PlanMeal>;
  
  // Stores & Deals
  getStores(): Promise<Store[]>;
  getDeals(storeId: number): Promise<StoreDeal[]>;
  createStore(store: any): Promise<Store>;
  createStoreDeal(deal: any): Promise<StoreDeal>;
  
  // Savings
  getLifetimeSavings(userId: number): Promise<number>;
  recordSavings(userId: number, weekStartDate: string, storeId: number, amount: number): Promise<void>;
  
  // Favorites
  getFavorites(userId: number): Promise<(RecipeFavorite & { recipe: Recipe })[]>;
  getFavoriteRecipeIds(userId: number): Promise<number[]>;
  addFavorite(userId: number, recipeId: number): Promise<RecipeFavorite>;
  removeFavorite(userId: number, recipeId: number): Promise<void>;
  isFavorite(userId: number, recipeId: number): Promise<boolean>;

  // Pantry
  getPantryItems(userId: number): Promise<any[]>;
  createPantryItem(item: any): Promise<any>;
  updatePantryItem(id: number, userId: number, updates: any): Promise<any>;
  deletePantryItem(id: number, userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProfile(userId: number): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async createProfile(profile: InsertUserProfile & { userId: number }): Promise<UserProfile> {
    const [newProfile] = await db.insert(userProfiles).values(profile as any).returning();
    return newProfile;
  }

  async updateProfile(userId: number, profile: Partial<InsertUserProfile>): Promise<UserProfile> {
    const [updated] = await db.update(userProfiles)
      .set(profile as any)
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated;
  }

  async getRecipes(): Promise<Recipe[]> {
    return await db.select().from(recipes);
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe;
  }

  async getRecipesByMealType(mealType: string): Promise<Recipe[]> {
    return await db.select().from(recipes).where(eq(recipes.mealType, mealType));
  }

  async createRecipe(recipe: any): Promise<Recipe> {
    const [newRecipe] = await db.insert(recipes).values(recipe).returning();
    return newRecipe;
  }

  async getCurrentWeeklyPlan(userId: number): Promise<WeeklyPlan | undefined> {
    const [plan] = await db.select()
      .from(weeklyPlans)
      .where(eq(weeklyPlans.userId, userId))
      .orderBy(desc(weeklyPlans.weekStartDate), desc(weeklyPlans.createdAt))
      .limit(1);
    return plan;
  }

  async createWeeklyPlan(userId: number, startDate: string): Promise<WeeklyPlan> {
    const [plan] = await db.insert(weeklyPlans).values({ userId, weekStartDate: startDate }).returning();
    
    // Create days
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      await db.insert(planDays).values({
        weeklyPlanId: plan.id,
        date: date.toISOString().split('T')[0],
        dayOfWeek: i,
      });
    }
    
    return plan;
  }

  async getWeeklyPlanDays(planId: number): Promise<(PlanDay & { meals: (PlanMeal & { recipe: Recipe })[] })[]> {
    const days = await db.select().from(planDays).where(eq(planDays.weeklyPlanId, planId));
    
    const result = [];
    for (const day of days) {
      const meals = await db.select()
        .from(planMeals)
        .leftJoin(recipes, eq(planMeals.recipeId, recipes.id))
        .where(eq(planMeals.planDayId, day.id))
        .orderBy(planMeals.slotIndex);
        
      result.push({
        ...day,
        meals: meals.map(m => ({ ...m.plan_meals, recipe: m.recipes! }))
      });
    }
    return result;
  }

  async getPlanMeal(id: number): Promise<PlanMeal | undefined> {
    const [meal] = await db.select().from(planMeals).where(eq(planMeals.id, id));
    return meal;
  }

  async updatePlanMeal(id: number, updates: Partial<PlanMeal>): Promise<PlanMeal> {
    const [updated] = await db.update(planMeals).set(updates).where(eq(planMeals.id, id)).returning();
    return updated;
  }

  async getStores(): Promise<Store[]> {
    return await db.select().from(stores);
  }

  async getDeals(storeId: number): Promise<StoreDeal[]> {
    return await db.select().from(storeDeals).where(eq(storeDeals.storeId, storeId));
  }
  
  async createStore(store: any): Promise<Store> {
    const [newStore] = await db.insert(stores).values(store).returning();
    return newStore;
  }

  async createStoreDeal(deal: any): Promise<StoreDeal> {
    const [newDeal] = await db.insert(storeDeals).values(deal).returning();
    return newDeal;
  }

  async getLifetimeSavings(userId: number): Promise<number> {
    const savings = await db.select().from(savingsLedger).where(eq(savingsLedger.userId, userId));
    return savings.reduce((acc, curr) => acc + curr.savingsAmount, 0);
  }

  async recordSavings(userId: number, weekStartDate: string, storeId: number, amount: number): Promise<void> {
    await db.insert(savingsLedger).values({ userId, weekStartDate, storeId, savingsAmount: amount });
  }

  async getFavorites(userId: number): Promise<(RecipeFavorite & { recipe: Recipe })[]> {
    const favorites = await db.select()
      .from(recipeFavorites)
      .leftJoin(recipes, eq(recipeFavorites.recipeId, recipes.id))
      .where(eq(recipeFavorites.userId, userId))
      .orderBy(desc(recipeFavorites.createdAt));
    
    return favorites.map(f => ({ ...f.recipe_favorites, recipe: f.recipes! }));
  }

  async getFavoriteRecipeIds(userId: number): Promise<number[]> {
    const favorites = await db.select({ recipeId: recipeFavorites.recipeId })
      .from(recipeFavorites)
      .where(eq(recipeFavorites.userId, userId));
    return favorites.map(f => f.recipeId);
  }

  async addFavorite(userId: number, recipeId: number): Promise<RecipeFavorite> {
    const existing = await db.select()
      .from(recipeFavorites)
      .where(and(eq(recipeFavorites.userId, userId), eq(recipeFavorites.recipeId, recipeId)));
    
    if (existing.length > 0) return existing[0];
    
    const [favorite] = await db.insert(recipeFavorites).values({ userId, recipeId }).returning();
    return favorite;
  }

  async removeFavorite(userId: number, recipeId: number): Promise<void> {
    await db.delete(recipeFavorites)
      .where(and(eq(recipeFavorites.userId, userId), eq(recipeFavorites.recipeId, recipeId)));
  }

  async isFavorite(userId: number, recipeId: number): Promise<boolean> {
    const [favorite] = await db.select()
      .from(recipeFavorites)
      .where(and(eq(recipeFavorites.userId, userId), eq(recipeFavorites.recipeId, recipeId)));
    return !!favorite;
  }

  async getPantryItems(userId: number): Promise<any[]> {
    const items = await db.select().from(pantryItems).where(eq(pantryItems.userId, userId));
    const now = new Date();
    
    return items.map(item => {
      const addedDate = new Date(item.lastConfirmedAt || item.addedAt);
      const daysSinceAdded = Math.floor((now.getTime() - addedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let status: "likely_have" | "might_run_out" | "probably_gone" = "likely_have";
      const decayProgress = Math.min(daysSinceAdded / item.estimatedDecayDays, 1.2);

      if (decayProgress > 1.0) status = "probably_gone";
      else if (decayProgress > 0.7) status = "might_run_out";

      return { ...item, status, decayProgress };
    });
  }

  async createPantryItem(item: any): Promise<any> {
    const [newItem] = await db.insert(pantryItems).values(item).returning();
    return newItem;
  }

  async updatePantryItem(id: number, userId: number, updates: any): Promise<any> {
    const [item] = await db.update(pantryItems)
      .set(updates)
      .where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
      .returning();
    return item;
  }

  async deletePantryItem(id: number, userId: number): Promise<void> {
    await db.delete(pantryItems).where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)));
  }
}

export const storage = new DatabaseStorage();
