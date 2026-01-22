# ReciPal

## Overview

ReciPal is a full-stack web application designed to streamline meal planning, grocery shopping, and cooking. It offers features such as recipe discovery, automated meal plan generation, pantry management with ingredient decay tracking, and advanced nutritional tracking for Pro members. The platform aims to empower users to eat healthier, reduce food waste, and save time on meal preparation.

## Recent Changes (January 2026)

- **P10.4 Cart UX Fix:**
  - Reordered Cart page sections: Main Cart → Buy Again → Add-ons
  - Added collapse logic: shows 6 items by default with grey fade overlay (bg-gradient-to-t from-muted/80)
  - Centered "Expand" / "Show less" toggle below cart list
  - Cart logic unchanged: all add/remove/update/clear functions preserved
  - Checkout button remains sticky at bottom, more reachable due to collapsed cart

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