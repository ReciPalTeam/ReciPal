import { pgTable, text, serial, integer, boolean, timestamp, json, doublePrecision, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // email
  password: text("password").notNull(),
  isPro: boolean("is_pro").default(false).notNull(),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userProfiles = pgTable("app_user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  // Stats (Pro — set via Macro Wizard)
  goal: text("goal"), // cut, maintain, bulk
  sex: text("sex"),
  age: integer("age"),
  height: integer("height"), // cm
  weight: integer("weight"), // lbs
  activityLevel: text("activity_level"),
  trainingDays: integer("training_days"),
  // Preferences
  dietaryPreferences: json("dietary_preferences").$type<string[]>().default([]),
  allergies: json("allergies").$type<string[]>().default([]),
  mealsPerDay: integer("meals_per_day").default(3),
  snacksPerDay: integer("snacks_per_day").default(1),
  cookingTime: text("cooking_time").default("normal"),
  preferredStoreId: integer("preferred_store_id"),
  pantryStaples: json("pantry_staples").$type<string[]>().default([]),
  // ReciPal Onboarding
  cookingComfort: text("cooking_comfort").$type<"quick" | "comfortable" | "involved">().default("quick").notNull(),
  costPreference: text("cost_preference").$type<"low" | "balanced" | "flexible">().default("balanced").notNull(),
  missingTools: json("missing_tools").$type<string[]>().default([]).notNull(),
  subscriptionTier: text("subscription_tier").$type<"free" | "pro">().default("free").notNull(),
  // Diabetes-related preferences (carb limit stored in grams, not percentage)
  isDiabetic: boolean("is_diabetic").default(false).notNull(),
  maxCarbPercent: integer("max_carb_percent"), // NOTE: Stores grams (0-999) despite column name
  calorieGoal: integer("calorie_goal"),
  // Computed Macros (Pro)
  targetCalories: integer("target_calories"),
  targetProtein: integer("target_protein"),
  targetCarbs: integer("target_carbs"),
  targetFat: integer("target_fat"),
  macrosSet: boolean("macros_set").default(false).notNull(),
  // Display & Identity
  displayName: text("display_name"),
  profileImageUrl: text("profile_image_url"),
  // Disliked Foods
  dislikedFoods: json("disliked_foods").$type<string[]>().default([]),
  mealSlots: json("meal_slots").$type<string[]>().default(["breakfast", "lunch", "dinner"]),
  // Discovery Preferences
  cuisinePreferences: json("cuisine_preferences").$type<string[]>().default([]),
  excludedIngredients: json("excluded_ingredients").$type<string[]>().default([]),
  // Notification & App Preferences
  language: text("language").default("en"),
  mealReminders: boolean("meal_reminders").default(false),
  groceryReminders: boolean("grocery_reminders").default(false),
  promotionalNotifications: boolean("promotional_notifications").default(false),
  hasRequestedPermission: boolean("has_requested_permission").default(false),
});

export const recipes = pgTable("app_recipes", {
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
  mealState: text("meal_state").$type<"scheduled" | "cooked" | "autoCounted">().default("scheduled").notNull(),
  parentMealId: integer("parent_meal_id"), // Self-referential: sides point to their parent meal
});

export const consumptionLogs = pgTable("consumption_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // ISO date string YYYY-MM-DD
  sourceType: text("source_type").$type<"checkout_logged_recipe" | "cooknow_logged_recipe" | "manual_custom_entry">().notNull(),
  recipeId: integer("recipe_id").references(() => recipes.id),
  name: text("name"), // For manual entries without a recipe
  mealSlot: text("meal_slot"), // Breakfast, Lunch, Dinner, etc.
  calories: integer("calories").notNull(),
  protein: integer("protein").default(0).notNull(),
  carbs: integer("carbs").default(0).notNull(),
  fat: integer("fat").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customRecipes = pgTable("custom_recipes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  ingredients: json("ingredients").$type<{
    foodId: string;
    name: string;
    amount: number;
    unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[]>().notNull(),
  calories: integer("calories").notNull(),
  protein: integer("protein").default(0).notNull(),
  carbs: integer("carbs").default(0).notNull(),
  fat: integer("fat").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userRolloverState = pgTable("user_rollover_state", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  lastRolloverDate: text("last_rollover_date").notNull(), // ISO date string of last processed date
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const userFavoriteRecipes = pgTable("user_favorite_recipes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  recipeId: text("recipe_id").notNull(),
  recipePayload: json("recipe_payload").$type<{
    id: string;
    title: string;
    image: string;
    cookTime: string;
    servings: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealTypes: string[];
    cookingStyle: string;
    ingredients: { name: string; amount: string; unit: string }[];
  }>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const recipeRatings = pgTable("recipe_ratings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  recipeId: text("recipe_id").notNull(), // Supabase recipe_id (string)
  rating: integer("rating").notNull(), // 1-5 stars
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pantryItems = pgTable("pantry_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  estimatedDecayDays: integer("estimated_decay_days").notNull(), // How many days it lasts on average
  lastConfirmedAt: timestamp("last_confirmed_at").defaultNow().notNull(), // Last time user said "I still have this"
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

export const planMealRelations = relations(planMeals, ({ one, many }) => ({
  day: one(planDays, {
    fields: [planMeals.planDayId],
    references: [planDays.id],
  }),
  recipe: one(recipes, {
    fields: [planMeals.recipeId],
    references: [recipes.id],
  }),
  parentMeal: one(planMeals, {
    fields: [planMeals.parentMealId],
    references: [planMeals.id],
    relationName: "sides",
  }),
  sides: many(planMeals, { relationName: "sides" }),
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
export const insertConsumptionLogSchema = createInsertSchema(consumptionLogs).omit({ id: true, createdAt: true });
export const insertCustomRecipeSchema = createInsertSchema(customRecipes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRecipeRatingSchema = createInsertSchema(recipeRatings).omit({ id: true, createdAt: true, updatedAt: true });

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
export type UserFavoriteRecipe = typeof userFavoriteRecipes.$inferSelect;
export type ConsumptionLog = typeof consumptionLogs.$inferSelect;
export type UserRolloverState = typeof userRolloverState.$inferSelect;
export type CustomRecipe = typeof customRecipes.$inferSelect;
export type InsertConsumptionLog = z.infer<typeof insertConsumptionLogSchema>;
export type InsertCustomRecipe = z.infer<typeof insertCustomRecipeSchema>;
export type RecipeRating = typeof recipeRatings.$inferSelect;
export type InsertRecipeRating = z.infer<typeof insertRecipeRatingSchema>;
export type MealState = "scheduled" | "cooked" | "autoCounted";
export type ConsumptionSourceType = "checkout_logged_recipe" | "cooknow_logged_recipe" | "manual_custom_entry";

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

// Export Replit Auth models
export * from "./models/auth";
