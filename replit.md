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
- **Grocery Management:** Smart grocery list generation with item categorization.
- **Pantry Management:** Tracks ingredient decay with dynamic expiration dates.
- **Recipe Interaction:** Recipe discovery with client-side filtering, Supabase-backed feeds and search, and database-backed favorites. Pantry-aware recipe cards display ingredient availability.
- **User Preferences:** Staged vs. Active filters with explicit save for persisting preferences. Diabetic-friendly carb limit preferences.
- **Recipe Diversity:** Utilizes meal-type and cuisine-specific variety keywords for diverse suggestions.
- **Nutritional Tracking (Pro):** Comprehensive macronutrient tracking, including a macro-optimized dashboard with server-side computed insights. Deduplication of cooked planner meals against consumption logs.
- **Ingredient Swapping:** Intelligent suggestions for same-category ingredient swaps.
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