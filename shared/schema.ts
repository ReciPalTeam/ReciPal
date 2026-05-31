import { pgTable, text, serial, integer, boolean, timestamp, json, doublePrecision, date, primaryKey } from "drizzle-orm/pg-core";
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
  // A plan meal points to EITHER an app_recipes row (recipeId) OR a chef-authored
  // chef_recipes row (chefRecipeId). DB enforces "at least one is set" via a check
  // constraint added in the Phase H.4 migration.
  recipeId: integer("recipe_id").references(() => recipes.id),
  chefRecipeId: integer("chef_recipe_id"),
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

// === CHEF CREATOR SYSTEM ===
// Phase A of Reels + Chef Creator Platform. Activated chef profile (one per user).
export const chefProfiles = pgTable("chef_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  handle: text("handle").notNull().unique(), // vanity URL slug; lowercased
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  isApproved: boolean("is_approved").default(false).notNull(),
  followerCount: integer("follower_count").default(0).notNull(), // denormalized; maintained on follow/unfollow
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Application queue. Status flips by admin via Supabase dashboard.
export const chefApplications = pgTable("chef_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  bio: text("bio").notNull(),
  sampleLinks: json("sample_links").$type<string[]>().default([]).notNull(),
  status: text("status").$type<"pending" | "approved" | "rejected">().default("pending").notNull(),
  reviewerNotes: text("reviewer_notes"),
  reviewedAt: timestamp("reviewed_at"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

// Curated royalty-free music library for chefs to overlay on reels.
// MP3 files live in Supabase Storage 'music-tracks' bucket; file_url is the public URL.
// Source = 'pixabay' for our hand-curated Pixabay Music picks; other sources can be added.
export const musicTracks = pgTable("music_tracks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist"),
  vibe: text("vibe").$type<"upbeat" | "chill" | "cozy" | "energetic" | "cinematic" | "acoustic">(),
  durationS: integer("duration_s"),
  fileUrl: text("file_url").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  source: text("source").default("pixabay").notNull(),
  sourceTrackId: text("source_track_id"),
  tags: json("tags").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chef-authored recipes (Phase H). Each chef's public recipe library. Created either by
// editing the form directly OR auto-extracted from a video via Whisper + GPT.
// Linked to a reel via reels.chef_recipe_id (separate from reels.recipe_id which points
// at the system public.recipes table).
export const chefRecipes = pgTable("chef_recipes", {
  id: serial("id").primaryKey(),
  chefId: integer("chef_id").references(() => chefProfiles.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  photoUrl: text("photo_url"),
  prepTimeMinutes: integer("prep_time_minutes"),
  cookTimeMinutes: integer("cook_time_minutes"),
  passiveTimeMinutes: integer("passive_time_minutes"),
  totalTimeMinutes: integer("total_time_minutes"),
  servings: integer("servings"),
  ingredients: json("ingredients").$type<{ name: string; amount: string; unit: string }[]>().default([]).notNull(),
  steps: json("steps").$type<({ instruction: string; time: string | null; location: string | null } | string)[]>().default([]).notNull(),
  source: text("source").$type<"manual" | "gpt_extracted" | "cloned_from_public">().default("manual").notNull(),
  sourceTranscript: text("source_transcript"),
  // Per-serving nutrition computed at create/update time from the ingredients list.
  // Mirrors `DetailedNutrition` so the chef-recipe detail page can render the same
  // Detailed-Nutrition accordion the public recipe page does. Null when computation
  // hasn't run yet or no ingredients matched the canonical DB.
  nutrition: json("nutrition").$type<{
    calories: number; protein: number; carbs: number; fat: number;
    saturatedFat: number; polyunsaturatedFat: number; monounsaturatedFat: number; transFat: number;
    fiber: number; sugar: number; addedSugars: number;
    cholesterol: number; sodium: number; potassium: number; calcium: number; iron: number;
    vitaminA: number; vitaminC: number; vitaminD: number;
  } | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reels: chef-uploaded short videos. Video itself lives on Cloudflare Stream
// (cf_stream_uid + playback_url). Fingerprint check is server-side, inline in upload.
// recipe_id     → optional link to a system recipe in public.recipes
// chef_recipe_id → optional link to a chef-authored recipe in public.chef_recipes
// At most one of the two should be set on any given reel.
export const reels = pgTable("reels", {
  id: serial("id").primaryKey(),
  chefId: integer("chef_id").references(() => chefProfiles.id).notNull(),
  cfStreamUid: text("cf_stream_uid").notNull().unique(),
  playbackUrl: text("playback_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  title: text("title"),
  description: text("description"),
  recipeId: text("recipe_id"),
  chefRecipeId: integer("chef_recipe_id").references(() => chefRecipes.id, { onDelete: "set null" }),
  durationS: integer("duration_s"),
  status: text("status").$type<"uploading" | "processing" | "published" | "failed">().default("processing").notNull(),
  fingerprintStatus: text("fingerprint_status").$type<"clean" | "flagged" | "pending">().notNull(),
  fingerprintProvider: text("fingerprint_provider").$type<"chromaprint" | "acrcloud">(),
  flaggedTrack: text("flagged_track"),
  flaggedArtist: text("flagged_artist"),
  // Denormalized counters for cheap display. Maintained in app code on insert/delete.
  likeCount: integer("like_count").default(0).notNull(),
  saveCount: integer("save_count").default(0).notNull(),
  shareCount: integer("share_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === REEL ENGAGEMENTS (Phase E) ===
// Compound (user_id, reel_id) PK enforces one row per user per reel for the three toggle actions.

export const reelLikes = pgTable("reel_likes", {
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reelId: integer("reel_id").references(() => reels.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.reelId] }),
}));

export const reelSaves = pgTable("reel_saves", {
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reelId: integer("reel_id").references(() => reels.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.reelId] }),
}));

// === VIEWS (Phase H.19.1) ===
// One row per (user, reel) — UNIQUE viewers, not raw impressions. reels.view_count is the
// denormalized counter (incremented only on the first view per user; self-views excluded).
// created_at gives an event log for views-over-time.
export const reelViews = pgTable("reel_views", {
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reelId: integer("reel_id").references(() => reels.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.reelId] }),
}));

// === FOLLOWS (Phase H.17) ===
// A user follows a chef creator. Toggle pattern (insert=follow, delete=unfollow), composite PK
// keeps one row per (user, chef). chefProfiles.follower_count is the denormalized counter.
export const chefFollowers = pgTable("chef_followers", {
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  chefId: integer("chef_id").references(() => chefProfiles.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.chefId] }),
}));

// Shares aren't toggles — every share is an event. share_method tracks which channel was used
// for analytics ("native", "copy", "sms", "instagram", etc.).
export const reelShares = pgTable("reel_shares", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reelId: integer("reel_id").references(() => reels.id, { onDelete: "cascade" }).notNull(),
  shareMethod: text("share_method"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comments are flat (no threading). deleted_at = soft delete (so historical counts stay sane).
// Chef of the reel OR the comment's author can delete.
export const reelComments = pgTable("reel_comments", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").references(() => reels.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  body: text("body").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === HASHTAGS (Phase F) ===
// Hashtags emerge organically from reel descriptions (parser extracts #tag patterns).
// Tag = lowercased, alphanumeric + underscore. usage_count is denormalized for ranking.
export const hashtags = pgTable("hashtags", {
  tag: text("tag").primaryKey(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reelHashtags = pgTable("reel_hashtags", {
  reelId: integer("reel_id").references(() => reels.id, { onDelete: "cascade" }).notNull(),
  tag: text("tag").references(() => hashtags.tag, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.reelId, t.tag] }),
}));

// === NOTIFICATIONS (Phase G) ===
// Generated on engagement events when actor != recipient.
// type: 'like' | 'favorite' | 'save' | 'comment'.
// Toggle-off (un-like/un-favorite/un-save) deletes the corresponding notification.
// Soft-deleted comments delete their notification too.
// A unique index on (recipient, actor, reel, type) keeps "User X liked your reel" notifications
// to one row per actor-per-reel-per-type — preventing spam on toggle abuse.
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  recipientUserId: integer("recipient_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").$type<"like" | "favorite" | "save" | "comment" | "follow">().notNull(),
  reelId: integer("reel_id").references(() => reels.id, { onDelete: "cascade" }),
  commentId: integer("comment_id").references(() => reelComments.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
export const insertChefApplicationSchema = createInsertSchema(chefApplications).omit({
  id: true,
  status: true,
  reviewerNotes: true,
  reviewedAt: true,
  submittedAt: true,
});
export const insertReelSchema = createInsertSchema(reels).omit({
  id: true,
  likeCount: true,
  saveCount: true,
  shareCount: true,
  commentCount: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

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

export type ChefProfile = typeof chefProfiles.$inferSelect;
export type InsertChefProfile = typeof chefProfiles.$inferInsert;
export type ChefApplication = typeof chefApplications.$inferSelect;
export type InsertChefApplication = z.infer<typeof insertChefApplicationSchema>;
export type Reel = typeof reels.$inferSelect;
export type InsertReel = z.infer<typeof insertReelSchema>;
export type MusicTrack = typeof musicTracks.$inferSelect;
export type ReelComment = typeof reelComments.$inferSelect;
export type Hashtag = typeof hashtags.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ChefRecipe = typeof chefRecipes.$inferSelect;
export type InsertChefRecipe = typeof chefRecipes.$inferInsert;

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
