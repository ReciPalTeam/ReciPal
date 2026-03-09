# ReciPal

## Overview
ReciPal is a full-stack web application designed to optimize meal planning, grocery shopping, and cooking. It aims to promote healthier eating, minimize food waste, and streamline meal preparation by offering features such as recipe discovery, automated meal plan generation, pantry management with ingredient decay tracking, and advanced nutritional insights for Pro members.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework:** React with TypeScript, built using Vite.
- **Routing:** Wouter.
- **State Management:** TanStack React Query.
- **Styling:** TailwindCSS with shadcn/ui (New York style).
- **Forms:** React Hook Form and Zod.
- **Animations:** Framer Motion.
- **Data Visualization:** Recharts.
- **UI/UX Decisions:** Consistent shadow effects, color-coded pills for expiration statuses, orange 3D bubble gloss for primary actions, green for secondary. Tab bar with orange badge for cart count. Collapsible chevron sections for filters.

### Backend
- **Technology Stack:** Node.js with Express.js, TypeScript, and ESM modules.
- **API Design:** RESTful endpoints with Zod schemas for validation.
- **Authentication:** Passport.js with Local Strategy and `express-session`, using Scrypt for password hashing.

### Data Storage
- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM with `drizzle-zod`.
- **Schema Management:** All table definitions in `shared/schema.ts`.
- **Migrations:** `drizzle-kit`.

### Key Design Patterns
- **Shared Contracts:** API routes and database schemas in a `/shared` directory.
- **Storage Abstraction:** `DatabaseStorage` class (`server/storage.ts`) centralizes database operations.
- **Path Aliases:** `@/` for client-side source and `@shared/` for shared code.

### Core Features
- **User Management:** Secure authentication, multi-step onboarding for dietary preferences.
- **Meal Planning:** Automated weekly plan generation with flexible scheduling. Includes "Auto-populate Week" with batched, per-meal-type recipe fetching, recipe scoring based on user preferences and nutritional goals (Pro), and options to lock/unlock meals. Recipe swap works for both preview and committed planner meals via an overhauled Swap Recipe modal with: current meal summary card at top, macro display (cal · P · C · F), doubled height (512px list + 85vh cap), title truncation at 22ch, and a recipe preview step with ingredient swap (SwapIngredientPopup) before confirming. Cooked meals show "Undo" button (red 3D gloss) instead of "Swap" — undo reverts meal state and deletes matching consumption log.
- **Serving Scaling:** Central serving adjuster above Ingredients/Steps tabs on recipe detail page (removed from Add-to-Plan and Add-to-Cart dialogs). Changing servings calls `POST /api/scaled-steps` which uses GPT-4o to rewrite step instructions with scaled quantities, computes scaled cook time by type (invariant/linear_batch/weight_based/surface_area), and scales macros. Results cached in Supabase `recipe_steps_variants` table. MealDetailPopup also has serving adjuster with scaling, synced to planner via `updateMealServings`. `POST /api/classify-cook-time-scale` batch-classifies recipes. `POST /api/reconcile-display-text` reformats ingredient display_text with fractions. Server files: `server/scaledSteps.ts`, `server/reconcileDisplayText.ts`.
- **Grocery Management:** Smart grocery list generation with item categorization.
- **Pantry Management:** Tracks ingredient decay with dynamic expiration dates. Uses a **dual classification system**: the 17-category `IngredientCategory` system powers Swap Ingredient, while a 14-group `PantryFoodGroup` system powers pantry UI filtering and grocery aisle grouping. `getPantryGroup(name, category)` in `ingredient-categories.ts` maps from IngredientCategory→PantryFoodGroup with Protein/Carb sub-classification and a frozen heuristic. `FoodGroup` in `demo-store.ts` is a type alias for `PantryFoodGroup`. Groups: Produce, Meat & Seafood, Dairy & Eggs, Bread & Bakery, Pasta Rice & Grains, Canned & Jarred, Spices & Seasonings, Oils Sauces & Condiments, Baking & Sweets, Frozen, Prepared Foods & Deli, Snacks & Nuts, Beverages & Alcohol, Non-Food.
- **Recipe Interaction:** Recipe discovery with client-side filtering, Supabase-backed feeds and search, and database-backed favorites. Pantry-aware recipe cards display ingredient availability.
- **User Preferences:** Staged vs. Active filters with explicit save for persisting preferences. Diabetic-friendly carb limit preferences.
- **Recipe Diversity:** Utilizes meal-type and cuisine-specific variety keywords for diverse suggestions.
- **Nutritional Tracking (Pro):** Comprehensive macronutrient tracking, including a macro-optimized dashboard with server-side computed insights. Deduplication of cooked planner meals against consumption logs.
- **Ingredient Swapping:** FatSecret-powered ingredient swap suggestions with 17-category classification system (`INGREDIENT_CATEGORIES` in `ingredient-categories.ts`), smart alternative search queries (`getAlternativeSearchQueries`), brand-stripping post-processor (`stripBrandName`), same-category filtering, exact-match pantry status ("In Pantry" for `state === 'have'` only), and AbortController-based request cancellation. No local/mock ingredient data — FatSecret API is the sole source. Empty state shown when no alternatives found.
- **Cart Management:** "Add to Cart" functionality with deduplication against pantry items.
- **Instacart Integration:** `canonicalizeForInstacart()` utility for unit sanitization and server-side `POST /api/instacart/shopping-list` for generating Instacart shopping list links. Includes a purchase unit decision layer for converting recipe units to appropriate purchase units.
- **Barcode Scanning:** Integrates native MLKit barcode scanner (mobile) or image upload with ZXing (web) for scanning and lookup via FatSecret.
- **Goal Management:** "Update Goals" button in Planner calorie counter, leading to calorie-only modal for Free users and Macro Wizard for Pro users.
- **Custom Meals:** Allows users to create ingredient-based custom meals using FatSecret food database, track nutrition, and save.
- **My Meals Tab:** Renamed "Favorites" tab with sub-toggles for "Favorites" and "My Recipes" (custom recipes with CRUD).

### Capacitor Integration
- Capacitor installed for future native app builds (Android/iOS).
- Plugins: `@capacitor/camera`, `@capacitor-mlkit/barcode-scanning`.
- `isNativeApp()` utility detects runtime environment to switch camera/scanner flows.

## External Dependencies

### Database Related
- **PostgreSQL:** Primary relational database.
- **connect-pg-simple:** For storing session data.

### UI/UX Libraries
- **Radix UI:** Accessible, unstyled UI primitives.
- **Lucide React:** Icon library.
- **cmdk:** Command palette functionality.
- **embla-carousel-react:** Carousel component.
- **vaul:** Drawer component.
- **react-day-picker:** Date selection component.

### APIs
- **Supabase (server-only):** Primary recipe data source for feeds (`recipes`, `recipe_nutrition_totals`, `recipe_ingredients`, `ingredients`, `ingredient_nutrients` tables).
- **FatSecret API:** Used for keyword recipe search, ingredient/food search (Manual Entry), barcode lookup, and server-side fallback for recipe details.

### Development & Testing Tools
- **@replit/vite-plugin-runtime-error-modal:** For improved error display.
- **esbuild:** For efficient server-side bundling.
- **Vitest:** Unit testing framework.