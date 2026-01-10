import { pgTable, text, serial, integer, boolean, timestamp, json, doublePrecision, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // email
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  // Stats
  goal: text("goal").notNull(), // cut, maintain, bulk
  sex: text("sex").notNull(),
  age: integer("age").notNull(),
  height: integer("height").notNull(), // cm
  weight: integer("weight").notNull(), // lbs (as per prompt implication of g/lb)
  activityLevel: text("activity_level").notNull(),
  trainingDays: integer("training_days").notNull(),
  // Preferences
  dietaryPreferences: json("dietary_preferences").$type<string[]>().notNull(),
  allergies: json("allergies").$type<string[]>().notNull(),
  mealsPerDay: integer("meals_per_day").notNull(),
  snacksPerDay: integer("snacks_per_day").notNull(),
  cookingTime: text("cooking_time").notNull(), // quick, normal
  budgetMode: text("budget_mode").notNull(), // cheap, normal
  preferredStoreId: integer("preferred_store_id"),
  pantryStaples: json("pantry_staples").$type<string[]>().notNull(), // list of what they HAVE
  // ReciPal Onboarding
  allergies: json("allergies").$type<string[]>().default([]).notNull(),
  dietaryPreferences: json("dietary_preferences").$type<string[]>().default([]).notNull(),
  costPreference: text("cost_preference").$type<"low" | "balanced" | "flexible">().default("balanced").notNull(),
  missingTools: json("missing_tools").$type<string[]>().default([]).notNull(),
  subscriptionTier: text("subscription_tier").$type<"free" | "pro">().default("free").notNull(),
  // Computed Macros (Pro)
  targetCalories: integer("target_calories").notNull(),
  targetProtein: integer("target_protein").notNull(),
  targetCarbs: integer("target_carbs").notNull(),
  targetFat: integer("target_fat").notNull(),
});

export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mealType: text("meal_type").notNull(), // breakfast, lunch, dinner, snack
  prepTimeMinutes: integer("prep_time_minutes").notNull(),
  tags: json("tags").$type<string[]>().notNull(),
  allergens: json("allergens").$type<string[]>().notNull(),
  // Macros per serving
  calories: integer("calories").notNull(),
  protein: integer("protein").notNull(),
  carbs: integer("carbs").notNull(),
  fat: integer("fat").notNull(),
  // Content
  ingredients: json("ingredients").$type<{name: string, amount: number, unit: string, category: string}[]>().notNull(),
  instructions: json("instructions").$type<string[]>().notNull(),
  imageUrl: text("image_url"),
});

export const weeklyPlans = pgTable("weekly_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  weekStartDate: text("week_start_date").notNull(), // ISO date string YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow(),
});

export const planDays = pgTable("plan_days", {
  id: serial("id").primaryKey(),
  weeklyPlanId: integer("weekly_plan_id").references(() => weeklyPlans.id).notNull(),
  date: text("date").notNull(), // ISO date string
  dayOfWeek: integer("day_of_week").notNull(), // 0-6
});

export const planMeals = pgTable("plan_meals", {
  id: serial("id").primaryKey(),
  planDayId: integer("plan_day_id").references(() => planDays.id).notNull(),
  slotIndex: integer("slot_index").notNull(), // 0 to N
  mealType: text("meal_type").notNull(),
  recipeId: integer("recipe_id").references(() => recipes.id).notNull(),
  servingMultiplier: doublePrecision("serving_multiplier").default(1.0).notNull(), // Scale portions to hit targets
  locked: boolean("locked").default(false).notNull(),
  eaten: boolean("eaten").default(false).notNull(),
});

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const storeDeals = pgTable("store_deals", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  regularPrice: doublePrecision("regular_price").notNull(),
  salePrice: doublePrecision("sale_price").notNull(),
  weekStartDate: text("week_start_date").notNull(),
});

export const savingsLedger = pgTable("savings_ledger", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  weekStartDate: text("week_start_date").notNull(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  savingsAmount: doublePrecision("savings_amount").notNull(),
});

export const recipeFavorites = pgTable("recipe_favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  recipeId: integer("recipe_id").references(() => recipes.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const userRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  plans: many(weeklyPlans),
}));

export const weeklyPlanRelations = relations(weeklyPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [weeklyPlans.userId],
    references: [users.id],
  }),
  days: many(planDays),
}));

export const planDayRelations = relations(planDays, ({ one, many }) => ({
  plan: one(weeklyPlans, {
    fields: [planDays.weeklyPlanId],
    references: [weeklyPlans.id],
  }),
  meals: many(planMeals),
}));

export const planMealRelations = relations(planMeals, ({ one }) => ({
  day: one(planDays, {
    fields: [planMeals.planDayId],
    references: [planDays.id],
  }),
  recipe: one(recipes, {
    fields: [planMeals.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeFavoriteRelations = relations(recipeFavorites, ({ one }) => ({
  user: one(users, {
    fields: [recipeFavorites.userId],
    references: [users.id],
  }),
  recipe: one(recipes, {
    fields: [recipeFavorites.recipeId],
    references: [recipes.id],
  }),
}));

// === SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true, userId: true });
export const insertRecipeSchema = createInsertSchema(recipes).omit({ id: true });
export const insertWeeklyPlanSchema = createInsertSchema(weeklyPlans).omit({ id: true, createdAt: true });

// === TYPES ===

export type User = typeof users.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type WeeklyPlan = typeof weeklyPlans.$inferSelect;
export type PlanDay = typeof planDays.$inferSelect;
export type PlanMeal = typeof planMeals.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type StoreDeal = typeof storeDeals.$inferSelect;
export type RecipeFavorite = typeof recipeFavorites.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

// Complex Types for API
export type PlanDayWithMeals = PlanDay & {
  meals: (PlanMeal & { recipe: Recipe })[];
  stats: { calories: number; protein: number; carbs: number; fat: number };
};

export type WeeklyPlanWithDays = WeeklyPlan & {
  days: PlanDayWithMeals[];
  stats: { totalCalories: number; avgCalories: number };
};

export type CartItem = {
  name: string;
  category: string;
  amount: number;
  unit: string;
  isStaple: boolean;
  haveInPantry: boolean;
  matchedDeal?: {
    storeName: string;
    regularPrice: number;
    salePrice: number;
    savings: number;
  };
};

export type ShoppingCart = {
  items: CartItem[];
  summary: {
    totalItems: number;
    estimatedCost: number;
    potentialSavings: number;
  };
};
