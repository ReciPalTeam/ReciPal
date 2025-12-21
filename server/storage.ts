import { db } from "./db";
import {
  users, userProfiles, recipes, weeklyPlans, planDays, planMeals, stores, storeDeals, savingsLedger,
  type User, type InsertUser, type InsertUserProfile, type UserProfile, type Recipe,
  type WeeklyPlan, type PlanDay, type PlanMeal, type Store, type StoreDeal
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
    const [newProfile] = await db.insert(userProfiles).values(profile).returning();
    return newProfile;
  }

  async updateProfile(userId: number, profile: Partial<InsertUserProfile>): Promise<UserProfile> {
    const [updated] = await db.update(userProfiles)
      .set(profile)
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
}

export const storage = new DatabaseStorage();
