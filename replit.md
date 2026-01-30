# ReciPal

## Overview

ReciPal is a full-stack web application designed to streamline meal planning, grocery shopping, and cooking. It provides features like recipe discovery, automated meal plan generation, pantry management with ingredient decay tracking, and advanced nutritional tracking for Pro members. The platform aims to empower users to eat healthier, reduce food waste, and save time on meal preparation, ultimately enhancing their culinary journey.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Tooling:** React with TypeScript, using Vite for building.
- **Routing:** Wouter for client-side navigation.
- **State Management:** TanStack React Query for server state caching.
- **Styling:** TailwindCSS complemented by shadcn/ui (New York style).
- **Forms:** React Hook Form integrated with Zod for validation.
- **Animations:** Framer Motion for UI transitions.
- **Data Visualization:** Recharts for dashboards.
- **UI/UX Decisions:** Consistent use of shadow effects for cards and buttons (e.g., recipe cards, planner day cards, CTA buttons). Color-coded pills for expiration statuses (green, yellow, red). Orange 3D bubble gloss styling for primary actions (e.g., "Confirm Plan," "Add to Plan") and green for secondary (e.g., "Add to Cart"). Tab bar visible on recipe detail pages with an orange badge for cart item count. Collapsible chevron sections for recipe filters.

### Backend Architecture
- **Technology Stack:** Node.js with Express.js, written in TypeScript using ESM modules.
- **API Design:** RESTful endpoints defined in `shared/routes.ts` with Zod schemas for validation.
- **Authentication:** Passport.js with Local Strategy and `express-session` for session management, using Scrypt hashing for password storage.

### Data Storage
- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM, with `drizzle-zod` for schema-to-validation integration.
- **Schema Management:** All table definitions are in `shared/schema.ts`.
- **Migrations:** Handled via `drizzle-kit`.

### Key Design Patterns
- **Shared Contracts:** API routes and database schemas are defined in a `/shared` directory.
- **Storage Abstraction:** A `DatabaseStorage` class (`server/storage.ts`) centralizes database operations.
- **Path Aliases:** `@/` for client-side source and `@shared/` for shared code.

### Core Features
- **User Management:** Secure authentication and multi-step onboarding for dietary preferences.
- **Meal Planning:** Automated weekly meal plan generation, enhanced scheduling with date and meal slot selection, and an "Auto-populate Week" feature considering user preferences and pantry items. Meals are now keyed by actual date (YYYY-MM-DD). Past dates in the calendar are greyed out and disabled.
- **Grocery Management:** Smart grocery list generation categorizing ingredients (Have/Might Have/Need).
- **Pantry Management:** Tracks ingredient decay with dynamically computed expiration dates based on food groups, displayed via color-coded pills. Pantry item classification uses extensive keyword lists for accurate categorization.
- **Recipe Interaction:** Recipe discovery with client-side cuisine keyword filtering, API-driven search, server-side variety seeding for recipe feeds, and database-backed favorites. Recipe detail pages save and restore scroll state on back navigation. Pantry-aware recipe cards display "Have X • Maybe Y • Need Z" status badges with color-coded text (green/yellow/red). For You feed ranks recipes by pantryFitScore = (have*2) + maybe - need.
- **User Preferences Management:** Floating Save button in filter Sheet that persists preferences (Time/Difficulty, Cost, Dietary, Allergies, Carb Limit) to user profile. Changes require explicit Save action (no auto-save). Save shows "Preferences saved" toast and refreshes For You feed only. Dirty state tracking compares current values against saved profile values. Collapsible filter sections with proper test IDs for E2E testing.
- **Carb Limit Preferences:** Diabetic-friendly onboarding with carb limit preferences stored in grams (0-999, default 60g). Uses neutral wording ("Carb Preferences") with medical disclaimers. Client-side carb filtering allows null-carb recipes to pass. Carb limit section in filter Sheet follows existing Save button flow with toggle + grams input. maxCarbPercent DB field repurposed to store grams instead of percentage.
- **Recipe Diversity:** Meal-type-specific variety keyword arrays (BREAKFAST_VARIETY, LUNCH_VARIETY, DINNER_VARIETY, etc.) with diverse proteins (ground beef, steak, salmon, shrimp, pork, turkey, lamb, fish, tofu) and food types (birria tacos, curry, casserole, stew, meatballs, burgers). Additionally, 11 cuisine-specific variety arrays (AMERICAN_VARIETY, MEXICAN_VARIETY, ITALIAN_VARIETY, ASIAN_VARIETY, MEDITERRANEAN_VARIETY, INDIAN_VARIETY, MIDDLE_EASTERN_VARIETY, CARIBBEAN_VARIETY, SOUTHERN_VARIETY, BBQ_VARIETY, HEALTHY_VARIETY) with signature dishes per cuisine (e.g., American: hamburger, mac and cheese, pot roast; Mexican: birria tacos, carnitas, carne asada). When a cuisine filter is selected, cuisine variety arrays take priority over meal-type arrays. buildSearchExpression prioritizes variety keywords over generic cuisine keywords to enable specific dish searches. Three variety keywords searched simultaneously per page load with daily rotation offset and feed-type offset (+5 for Something New) to prevent same-protein dominance. For You ranking by pantryFitScore remains unaffected by diversity changes.
- **Nutritional Tracking (Pro):** Comprehensive macronutrient tracking, including a setup wizard, macro-optimized dashboard, and dynamic nutrition recalculations. The planner top counter card displays detailed macro information for Pro users.
- **Ingredient Swapping:** Intelligent ingredient swap suggestions with 8 IngredientCategory types (Protein, Carb, Veggie, Fruit, Dairy, Seasonings, Oils, Other). Classification order is Dairy → Oils → Seasonings → Veggie to prevent misclassifications (e.g., "unsalted butter" correctly → Dairy not Seasonings). Swap suggestions only return same-category items.
- **Cart Management:** "Add to Cart" functionality with deduplication against pantry items. The cart list features a fixed-height scrollable container for better UX.

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
- **FatSecret API:** Integrated for recipe search and retrieval, with OAuth2 client, token caching, and an in-memory recipe cache on the server.

### Development & Testing Tools
- **@replit/vite-plugin-runtime-error-modal:** For improved error display.
- **esbuild:** For efficient server-side bundling.
- **Vitest:** Unit testing framework.