# ReciPal

## Overview

ReciPal is a full-stack web application designed to optimize meal planning, grocery shopping, and cooking. It offers features such as recipe discovery, automated meal plan generation, pantry management with ingredient decay tracking, and advanced nutritional insights for Pro members. The platform's goal is to promote healthier eating, minimize food waste, and streamline meal preparation, thereby enriching the user's culinary experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework:** React with TypeScript, built using Vite.
- **Routing:** Wouter for client-side navigation.
- **State Management:** TanStack React Query for server state.
- **Styling:** TailwindCSS with shadcn/ui (New York style).
- **Forms:** React Hook Form and Zod for validation.
- **Animations:** Framer Motion.
- **Data Visualization:** Recharts for dashboards.
- **UI/UX Decisions:** Consistent shadow effects, color-coded pills for expiration statuses, orange 3D bubble gloss for primary actions, green for secondary. Tab bar with orange badge for cart count. Collapsible chevron sections for filters.

### Backend
- **Technology Stack:** Node.js with Express.js, TypeScript, and ESM modules.
- **API Design:** RESTful endpoints defined with Zod schemas for validation.
- **Authentication:** Passport.js with Local Strategy and `express-session`, using Scrypt for password hashing.

### Data Storage
- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM with `drizzle-zod`.
- **Schema Management:** All table definitions in `shared/schema.ts`.
- **Migrations:** `drizzle-kit`.

### Key Design Patterns
- **Shared Contracts:** API routes and database schemas are in a `/shared` directory.
- **Storage Abstraction:** A `DatabaseStorage` class (`server/storage.ts`) centralizes database operations.
- **Path Aliases:** `@/` for client-side source and `@shared/` for shared code.

### Core Features
- **User Management:** Secure authentication, multi-step onboarding for dietary preferences.
- **Meal Planning:** Automated weekly plan generation, flexible scheduling, "Auto-populate Week" based on preferences and pantry. Past dates are disabled.
- **Grocery Management:** Smart grocery list generation with item categorization (Have/Might Have/Need).
- **Pantry Management:** Tracks ingredient decay with dynamic expiration dates and color-coded pills. Uses keyword lists for item classification.
- **Recipe Interaction:** Recipe discovery with client-side filtering, API-driven search, server-side variety seeding, and database-backed favorites. Pantry-aware recipe cards display "Have X • Maybe Y • Need Z" status. "For You" feed ranks recipes by `pantryFitScore`.
- **User Preferences:** Floating "Save" button in filter Sheet for persisting preferences (Time/Difficulty, Cost, Dietary, Allergies, Carb Limit). Changes require explicit save, which triggers a "Preferences saved" toast and refreshes the "For You" feed.
- **Staged vs. Active Filters:** Recipe filters use a two-state architecture ("staged" for editing, "active" for applying) to prevent premature recipe reloading. Filters apply only on "Apply Filters" click.
- **Carb Limit Preferences:** Diabetic-friendly onboarding with carb limits in grams (0-999g), stored in `maxCarbPercent` DB field. Client-side filtering allows null-carb recipes.
- **Recipe Diversity:** Uses meal-type and cuisine-specific variety keyword arrays (e.g., `AMERICAN_VARIETY`, `MEXICAN_VARIETY`) to ensure diverse recipe suggestions. Prioritizes cuisine varieties when a cuisine filter is active. Three variety keywords are searched simultaneously per page load with rotation offsets.
- **Nutritional Tracking (Pro):** Comprehensive macronutrient tracking for Pro members. Includes a macro-optimized dashboard and dynamic nutrition recalculations. The Pro dashboard features a real-time "Insights" section with categories like Consistency, Pattern Detection, and Nutritional Gaps, computed server-side from consumption log data over rolling windows.
- **Ingredient Swapping:** Intelligent suggestions for same-category ingredient swaps. Categories include Protein, Carb, Veggie, Fruit, Dairy, Seasonings, Oils, Other. Classification order prioritizes specific categories.
- **Cart Management:** "Add to Cart" functionality with deduplication against pantry items. Fixed-height scrollable cart list.
- **Instacart Unit Canonicalization:** `canonicalizeForInstacart()` utility sanitizes FatSecret unit strings into Instacart-compatible units at checkout. Handles quantity parsing, base token extraction, alias mapping, compound packaging, countable ingredient detection, and "serving" to "each" conversion.
- **Instacart Shopping List Checkout:** Server-side `POST /api/instacart/shopping-list` endpoint creates an Instacart shopping list link via `createInstacartShoppingListLink()` in `server/lib/instacartMeasurement.ts`. Calls `POST {baseUrl}/idp/v1/products/products_link` with `link_type: "shopping_list"` and `line_items` array (name/quantity/unit/display_text). Base URL resolved by: `INSTACART_BASE_URL` override > `INSTACART_API_ENV` (development→`connect.dev.instacart.tools`, production→`connect.instacart.com`) > default "development". Safety fallbacks: null/empty unit → "each", null/<=0 qty → 1, blank names skipped, display_text falls back to name. Strict response validation reads `products_link_url` from response. Frontend sends simplifiedLineItems (name/qty/unit/displayText) from the existing canonicalization+purchase-decision pipeline, redirects to returned `redirectUrl` via `window.location.assign()`. Standardized response shape: `{success, redirectUrl, productsLinkUrl, correlationId, correlationIds}` (both URL fields for backward compat). Error shape: `{success:false, error, status?, details?}`. Logging: per-request log with env/baseUrl/endpoint/keyPrefix(6chars+redacted)/status/correlationId. Diagnostic endpoints: `GET /api/instacart/health` (config visibility, no external call), `POST /api/instacart/diagnostic` (real minimal Instacart call for key validation).
- **Purchase Unit Decision Layer:** `decidePurchaseUnitAndQty()` in `instacart/index.tsx` converts recipe units to purchase units for client-side display/trace. Rules in strict priority: (1) Keyword overrides — "spray" → 1 each keyword_override_spray; (2) Spices & Seasonings → 1 each spice_container; (3) Produce — fresh herbs (cilantro/parsley/dill/mint/basil) → 1 bunch produce_bunch, cabbage → 1 head produce_whole_head, recipeUnit "each" → keep qty produce_unit_kept, else → 1 each produce_default_each; produce rounding for each/bunch/head via Math.ceil with _rounded_up suffix; (4) Meat & Seafood — weighed units kept meat_weighed_unit_kept, else 1 each meat_default_each; (5) Dairy & Eggs — allowed units kept dairy_unit_kept, else 1 each dairy_default_each; (6) All other — recipeUnit "each" integer → packaged_countable_kept, fractional "each" rounded up, else 1 each packaged_default. displayText shows name-only for items where measurement is omitted, or "name — qty unit" when measurement is included.
- **Scan Barcode:** Orange "+" menu → "Scan Barcode" opens native MLKit barcode scanner (mobile) or image upload with ZXing decode (web). Manual fallback input for unreadable barcodes. Backend `GET /api/fatsecret/barcode` normalizes UPC-A (12→13 digits) and calls FatSecret barcode lookup. Confirm card shows product name/brand/macros, "Add to Pantry" uses existing `addToPantry()`. Components: `ScanBarcodeSheet` (`client/src/components/scan-barcode-sheet.tsx`).
- **Capacitor Integration:** Capacitor installed for future native app builds (appId: `com.recipal.app`, webDir: `dist`). Plugins: `@capacitor/camera`, `@capacitor-mlkit/barcode-scanning`. Runtime detection via `isNativeApp()` in `client/src/lib/capacitor-utils.ts` switches between native camera/scanner and web upload flows. Android/iOS platform folders to be generated via `npx cap add android/ios`.
- **Update Goals:** "Update Goals" button in the Planner calorie counter card. Free users get a lightweight calorie-only modal (persists `calorieGoal` in `user_profiles`); Pro users navigate to the existing Macro Wizard. The free-user goal immediately updates the card and is used as the calorie target if set, falling back to `totalPlanned` otherwise.
- **Custom Meals:** Allows users to create ingredient-based custom meals using FatSecret food database search. Users can adjust amounts, view running nutrition totals, and save custom recipes. These are stored in `custom_recipes` and logged to consumption history with automatic pantry decay.
- **My Meals Tab:** Renames "Favorites" tab to "My Meals" with sub-toggles for "Favorites" and "My Recipes" (custom recipes with CRUD operations). My Recipes now renders as feed-parity recipe cards via a shared `RecipeCard` component (`client/src/components/recipe-card.tsx`), using `mapCustomRecipeToFeedRecipe()` adapter (`client/src/lib/custom-recipe-adapter.ts`) to map `CustomRecipe` → `Recipe` shape. Cards include ReciPal logo badge, edit/delete buttons, pantry overlap badge, and navigate to the same `/recipe/:id` detail page. Sorted newest-first by `createdAt`.

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
- **FatSecret API:** Used for recipe search and retrieval, with OAuth2, token caching, and an in-memory recipe cache.

### Development & Testing Tools
- **@replit/vite-plugin-runtime-error-modal:** For improved error display.
- **esbuild:** For efficient server-side bundling.
- **Vitest:** Unit testing framework.