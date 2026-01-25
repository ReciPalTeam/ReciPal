# ReciPal

## Overview

ReciPal is a full-stack web application designed to streamline meal planning, grocery shopping, and cooking. It offers features such as recipe discovery, automated meal plan generation, pantry management with ingredient decay tracking, and advanced nutritional tracking for Pro members. The platform aims to empower users to eat healthier, reduce food waste, and save time on meal preparation.

## Recent Changes (January 2026)

- **P13.2 Pantry Food Group Classification Fix:**
  - Fixed bug where pantry items weren't appearing in Food Group filter categories
  - Expanded keyword lists for all 13 food group categories with 40+ new terms
  - Removed overly generic produce terms ('green', 'pea') that caused misclassification
  - Replaced with specific phrases: 'green bean', 'green onion', 'fresh pea', 'sugar pea'
  - Added legume keywords to canned: 'black bean', 'kidney bean', 'lentil', 'chickpea', etc.
  - Added to snacks: 'protein powder', 'whey protein', 'casein', 'supplement'
  - Added to oils/sauces: 'wine', 'cooking wine', 'mirin', 'sake', 'glaze', 'marinade'
  - Reordered classification: pasta/grains checked BEFORE canned to catch 'dry beans/lentils' first
  - Migration version: 'v5-specific-keywords' forces reclassification of existing pantry items
  - Classification order: Prepared Foods → Frozen → Produce → Meat → Dairy → Bread → Pasta/Grains → Canned → Spices → Oils/Sauces → Baking → Snacks → Other

- **FatSecret API Integration:**
  - Server: OAuth2 client with token caching (5min early refresh) in server/fatsecret/client.ts
  - Server: Recipe adapter flattens FatSecret macros to canonical Recipe format in server/fatsecret/adapter.ts
  - Server: In-memory cache (6hr recipe, 5min search) in server/fatsecret/cache.ts
  - Server: API routes GET /api/fatsecret/recipes/search and GET /api/fatsecret/recipes/:id
  - Client: Recipe store (Zustand) caches fetched recipes in client/src/lib/recipe-store.ts
  - Client: Recipe feed uses infinite scroll (20 initial, 5 per batch) with fallback to mockRecipes
  - Client: Recipe detail tries API first, falls back to mockRecipes on error
  - Client: Planner uses shared recipe store for lookups (store recipes + mockRecipes)
  - Error handling: Returns 503 with meaningful message on API unavailability
  - **Note:** Requires IP whitelist in FatSecret developer portal for production

- **P13.1 Expiration Pill Feature:**
  - PantryItem now has `assignedAt` (when item added) and `expirationDate` fields
  - Shelf life defaults by food group: Produce 7 days, Meat 5 days, Dairy 10 days, Canned 730 days, etc.
  - Expiration status uses thirds logic: >66% remaining = fresh (green), 33-66% = warning (yellow), <33% = expired (red)
  - Color-coded clickable pill replaces plain "exp. date" text in pantry cards
  - Clicking pill opens Popover with Calendar date picker for manual override
  - getExpirationStatus guards against invalid dates and division by zero
  - Migration auto-adds expiration fields to existing pantry items using computeExpirationDate()

- **P12.1 Cart Re-Add Logic Fix:**
  - Fixed bug where planner meals were incorrectly treated as ingredient coverage
  - Only Pantry inventory now counts as "covered" (determines "All ingredients already covered" message)
  - Planner meals do NOT count as Pantry coverage
  - Cart items used only for dedupe (prevent duplicates), not coverage
  - Emptying cart and re-adding missing items now works correctly
  - addRecipeToCartWithDedupe refactored to separate coverage (pantry-only) from dedupe (cart-only)

- **P11.8 Planner Date-Key Persistence:**
  - Meals now keyed by actual date (YYYY-MM-DD) instead of weekday template/dayIndex
  - Prevents meals from appearing in different weeks on the same day-of-week
  - getMealAtSlot and getMealsForDay now match by date string only
  - Auto-populate handleConfirmPlan computes actual dates from weekStart + dayIndex
  - getConflictingDates uses date-only matching (no dayIndex fallback)
  - Past dates in Add-to-Plan calendar: greyed out (opacity-40), show X (\u2715), disabled (non-clickable)
  - PlannedMeal.date is now required in the interface

- **P11.7 Planner Top Counter Card Style:**
  - Removed black border outline
  - Added subtle green 3D gloss outline effect (~3px): shadow-[0_0_0_3px_rgba(34,197,94,0.3),inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.1)]
  - Today Macros centered under Today Calories, Week Macros centered under Week Calories
  - Replaced P/C/F abbreviations with full words: Protein, Carbs, Fat (both Pro and Free versions)
  - Pro gating preserved unchanged (Free: blurred with Upgrade overlay)

- **P11.6 Planner Day Card Style:**
  - Removed black border outline from day cards
  - Added same drop-shadow as recipe cards: shadow-[0_0_8px_rgba(0,0,0,0.35)]
  - No layout shifts - padding and rounded corners preserved

- **P11.5 Auto-populate "Preview Your Week" Overlay Reorganization:**
  - Added "Servings" label above B/L/D stepper controls
  - Moved Add Desserts/Add Snackitizers checkboxes BELOW B/L/D controls
  - Checkbox auto-add behavior: checking resets servings to 1 and regenerates preview (1 per day at 1 serving)
  - Desserts/Snackitizers steppers appear conditionally below checkboxes when their checkbox is checked
  - "Confirm Plan" button now uses orange 3D bubble gloss styling (bg-recipal-orange + shadow + border-t)

- **P11.4 Recipe Detail CTA Row Layout/Styling:**
  - Both "Add to Plan" and "Add to Cart" buttons now equal width (50/50 split via flex-1)
  - Both buttons same height (h-12) with consistent gap (gap-3)
  - "Add to Plan" now uses orange 3D bubble gloss styling (bg-recipal-orange + shadow + border)
  - "Add to Cart" retains green 3D bubble gloss styling (bg-green-600 + shadow + border)
  - Icons: Add to Plan = Plus icon, Add to Cart = ShoppingCart icon
  - 3D effect: shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20

- **P11.3 Tab Bar Visible in Recipe Detail + Cart Badge:**
  - Recipe detail page (/recipe/:id) now wrapped with LayoutShell, keeping bottom nav visible
  - Added orange badge to Cart icon in bottom nav showing distinct item count
  - Badge uses bg-recipal-orange background, white text, positioned top-right of icon
  - Badge hidden when cart is empty (0 items)
  - Badge updates live on add/remove via Zustand store (useDemoStore)
  - data-testid="cart-badge" for testing

- **P11.2 Recipes Feed Back Nav State Restore:**
  - Navigating from recipe feed to recipe detail now saves state (sourceFeedKey, scrollY) to sessionStorage
  - Back navigation restores feed toggle (For You / Something New / Favorites) + scroll position
  - State cleared after restore to prevent stale restores
  - Deep links to recipe detail work normally (no forced toggle)

- **P11.1 Cart List Scroll Window:**
  - Replaced expand/collapse behavior with fixed-height scrollable container
  - Cart list shows ~6 items visible with internal scrolling (max-h-[384px], overflow-y-auto)
  - Removed fade overlay and Expand/Show less toggle
  - Section order preserved: Main Cart → Buy Again → Add-ons
  - Cart logic unchanged: all add/remove/update/clear functions preserved
  - Checkout button remains sticky at bottom

- **P10.3 Recipes Filter Chevron Refactor:**
  - Converted Recipes filter panel from flat list to collapsible chevron sections
  - Created reusable CollapsibleFilterSection component (client/src/components/collapsible-filter-section.tsx)
  - 8 collapsible sections: Meal Type, Cuisine, Serving Size, Kid Friendly, Time/Difficulty, Cost Preference, Dietary Restrictions, Allergies
  - Default open: Meal Type + Cuisine; other 6 sections collapsed by default
  - All filter controls preserved exactly - UI reorganization only
  - Works identically across For You / Something New / Favorites tabs

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Tooling:** React with TypeScript, using Vite for building.
- **Routing:** Wouter for client-side navigation.
- **State Management:** TanStack React Query handles server state caching.
- **Styling:** TailwindCSS complemented by shadcn/ui (New York style) for components.
- **Forms:** React Hook Form integrated with Zod for robust validation.
- **Animations:** Framer Motion for UI transitions.
- **Data Visualization:** Recharts for dashboards.

### Backend Architecture
- **Technology Stack:** Node.js with Express.js, written in TypeScript using ESM modules.
- **API Design:** RESTful endpoints defined in `shared/routes.ts` with Zod schemas for validation.
- **Authentication:** Passport.js with Local Strategy and `express-session` for session management.
- **Security:** Scrypt hashing for password storage.

### Data Storage
- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM, with `drizzle-zod` for schema-to-validation integration.
- **Schema Management:** All table definitions are in `shared/schema.ts`.
- **Migrations:** Handled via `drizzle-kit`.

### Key Design Patterns
- **Shared Contracts:** API routes and database schemas are defined in a `/shared` directory, accessible by both frontend and backend.
- **Storage Abstraction:** A `DatabaseStorage` class (`server/storage.ts`) centralizes database operations.
- **Path Aliases:** `@/` for client-side source and `@shared/` for shared code improve module resolution.

### Core Features
- **User Management:** Secure authentication and a multi-step onboarding process for dietary preferences.
- **Meal Planning:** Automated weekly meal plan generation, enhanced scheduling with flexible date and meal slot selection, and an "Auto-populate Week" feature considering user preferences and pantry items.
- **Grocery Management:** Smart grocery list generation categorizing ingredients (Have/Might Have/Need), with integration for ingredient acquisition.
- **Pantry Management:** Tracks ingredient decay and integrates with meal cooking to accelerate decay.
- **Recipe Interaction:** Recipe discovery, detailed views, and sharing capabilities.
- **Nutritional Tracking (Pro):** Comprehensive macronutrient tracking, including a setup wizard (Mifflin-St Jeor formula or manual entry), a macro-optimized dashboard, and dynamic nutrition recalculations based on ingredient swaps.
- **Ingredient Swapping:** Intelligent ingredient swap suggestions based on dietary needs, pantry availability, and macro alignment.
- **Cart Management:** "Add to Cart" functionality with deduplication against pantry and planned meals.

## External Dependencies

### Database Related
- **PostgreSQL:** The primary relational database.
- **connect-pg-simple:** Used for storing session data in PostgreSQL.

### UI/UX Libraries
- **Radix UI:** Provides accessible, unstyled UI primitives.
- **Lucide React:** Icon library.
- **cmdk:** For command palette functionality.
- **embla-carousel-react:** Carousel component.
- **vaul:** Drawer component.
- **react-day-picker:** Date selection component.

### Development & Testing Tools
- **@replit/vite-plugin-runtime-error-modal:** For improved error display during development.
- **esbuild:** Used for efficient server-side bundling.
- **Vitest:** Unit testing framework.