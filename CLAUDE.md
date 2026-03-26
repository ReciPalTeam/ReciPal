# ReciPal — Project DNA

## Overview

ReciPal is a mobile-first web app for recipe management, macro/calorie tracking, meal planning, pantry tracking, and photo-based food logging. It runs as a **Vite + React** web app with an **Express** backend, wrapped in **Capacitor** for native iOS/Android builds. The recipe database is AI-generated (~2,800 recipes in Supabase) with additional search via FatSecret API.

**Business model:** Freemium — calorie logging is free, macro goal-tracking is Pro.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 7, TypeScript 5.6 |
| Routing | Wouter |
| State | Zustand, TanStack React Query |
| UI | shadcn/ui (Radix primitives), Tailwind CSS 3, Framer Motion |
| Backend | Express 4, TypeScript, tsx runner |
| ORM | Drizzle ORM (PostgreSQL) |
| Database | Supabase PostgreSQL (single instance, shared by app tables and recipe DB) |
| Recipe DB | Supabase (2,800+ AI-generated recipes, queried via Supabase JS client) |
| Nutrition API | FatSecret (OAuth2, routed through relay proxy for static IP) |
| AI | OpenAI GPT-4o (scaled steps, nutritional insights, recipe classification) |
| Mobile | Capacitor (iOS/Android native wrapper) |
| Auth | Passport.js with local email/password strategy |
| Charts | Recharts |
| Barcode | Capacitor MLKit (native) / ZXing (web fallback) |

## Directory Structure

```
ReciPal/
├── client/                    # Frontend (Vite root)
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx            # Wouter routes + auth guards
│   │   ├── main.tsx           # React entry point
│   │   ├── index.css          # Tailwind imports
│   │   ├── components/        # 12 custom + 48 shadcn/ui components
│   │   ├── hooks/             # Auth, profile, plans, toast, etc.
│   │   ├── lib/               # Business logic, stores, utilities
│   │   │   └── feed/          # For You / Something New feed builders
│   │   ├── pages/             # Route pages (see Routes below)
│   │   └── utils/             # Instacart unit canonicalizer
│   └── public/                # Static assets
├── server/                    # Backend (Express)
│   ├── index.ts               # Express entry, port binding
│   ├── routes.ts              # All API endpoints (~2000 lines)
│   ├── db.ts                  # Drizzle + pg Pool init
│   ├── storage.ts             # Data access layer (Drizzle queries)
│   ├── recipe-service.ts      # Recipe orchestration
│   ├── insights.ts            # Pro nutritional insights (GPT-4o)
│   ├── scaledSteps.ts         # AI-powered serving scaling
│   ├── reconcileDisplayText.ts # Recipe text normalization
│   ├── static.ts              # Production static file serving
│   ├── vite.ts                # Dev middleware (Vite HMR)
│   ├── fatsecret/             # FatSecret OAuth client (4 files)
│   │   ├── client.ts          # Token management, API calls
│   │   ├── adapter.ts         # Format conversion
│   │   ├── cache.ts           # In-memory cache
│   │   └── index.ts
│   ├── lib/
│   │   ├── supabaseServer.ts  # Supabase server client
│   │   ├── recipeDb.ts        # Supabase recipe queries
│   │   ├── batchProcess.ts    # Generic batch processor with rate limiting
│   │   └── instacart*.ts      # Instacart unit utilities
│   └── services/
│       └── spoonacular.ts     # Fallback recipe source
├── shared/                    # Shared between client & server
│   ├── schema.ts              # Drizzle table definitions + types
│   ├── routes.ts              # Shared API route definitions
│   └── models/
│       └── auth.ts            # Session + social user tables
├── script/
│   └── build.ts               # Production build (Vite + esbuild)
├── attached_assets/           # App logo images (2 files)
├── .env                       # Environment variables (git-ignored)
├── .env.example               # Template with all required vars
├── package.json
├── vite.config.ts
├── tsconfig.json
├── drizzle.config.ts
├── capacitor.config.ts        # com.recipal.app
├── tailwind.config.ts
└── vitest.config.ts
```

## Database Architecture

**Single Supabase PostgreSQL instance** with two categories of tables:

### App Tables (managed by Drizzle ORM)
- `users` — Local auth accounts (email/password)
- `app_user_profiles` — Fitness goals, dietary prefs, macro targets, subscription tier
- `app_recipes` — Local recipe cache for the planner (53 seeded recipes)
- `weekly_plans` → `plan_days` → `plan_meals` — Meal planning hierarchy
- `consumption_logs` — Calorie/macro tracking entries
- `custom_recipes` — User-created meals from FatSecret foods
- `user_favorite_recipes` — Saved recipe snapshots (Supabase or FatSecret)
- `pantry_items` — Pantry inventory with decay tracking
- `user_rollover_state` — Planner date rollover tracking
- `stores`, `store_deals`, `savings_ledger` — Deal tracking (future)
- `recipe_favorites` — Simple recipe bookmarks
- `sessions` — Express session store

### Recipe Database Tables (managed directly in Supabase, NOT by Drizzle)
- `recipes` — 2,800+ AI-generated recipes (uuid `recipe_id`)
- `recipe_ingredients` — Recipe ingredient details
- `recipe_nutrition_totals` — Per-recipe macros
- `ingredients` — Master ingredient list
- `ingredient_nutrients` — Ingredient nutritional data
- `recipe_steps_variants` — Cached scaled-step results
- `recipe_image_archive` — Recipe images

**Important:** The Drizzle `recipes` export maps to `app_recipes` table. The Supabase `recipes` table (with `recipe_id` uuid) is queried only through `server/lib/recipeDb.ts` via the Supabase client.

## Key Routes (Frontend)

| Route | Page | Access |
|-------|------|--------|
| `/login`, `/register` | Auth | Public |
| `/` | Pro landing redirect | Auth required |
| `/recipes` | Recipe discovery + filters | Auth + profile |
| `/recipe/:id` | Recipe detail | Auth + profile |
| `/plan` | Meal planner | Auth + profile |
| `/pantry` | Pantry management | Auth + profile |
| `/cart` | Shopping cart | Auth + profile |
| `/profile` | User profile | Auth |
| `/settings` | App settings | Auth |
| `/preferences` | Dietary preferences | Auth |
| `/paywall` | Premium upsell | Auth |
| `/macro-wizard` | Pro macro setup | Auth + Pro |
| `/instacart` | Instacart handoff | Auth + profile |
| `/share/recipe/:id` | Public recipe sharing | Public |

## Environment Variables

All defined in `.env` (see `.env.example` for template):

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Supabase Postgres pooler connection string |
| `SESSION_SECRET` | Yes | Express session encryption |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase server-side key |
| `FATSECRET_CLIENT_ID` | Yes | FatSecret OAuth client ID |
| `FATSECRET_CLIENT_SECRET` | Yes | FatSecret OAuth client secret |
| `RELAY_URL` | Yes | FatSecret relay proxy (static IP requirement) |
| `RELAY_KEY` | Yes | Relay authentication key |
| `OPENAI_API_KEY` | Yes | GPT-4o for insights, scaled steps, classification |
| `PORT` | No | Server port (default: 5000) |

## Development Commands

```bash
npm run dev       # Start dev server (Express + Vite HMR) on port 5000
npm run build     # Production build (Vite client + esbuild server)
npm start         # Start production server from dist/
npm run check     # TypeScript type check (tsc --noEmit)
npm run db:push   # Push Drizzle schema changes to database
```

## Code Conventions

- **Path aliases:** `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`
- **UI components:** shadcn/ui pattern — primitives in `client/src/components/ui/`, composed components alongside pages
- **State:** Zustand stores for local state (`recipe-store`, `demo-store`), TanStack Query for server state
- **API pattern:** Express routes in single `server/routes.ts`, storage layer in `server/storage.ts`
- **Supabase queries:** Always server-side via `server/lib/recipeDb.ts` — no direct client-to-Supabase calls
- **FatSecret:** OAuth2 client credentials, 2 scopes (`basic`, `barcode`), routed through relay proxy
- **Freemium checks:** `client/src/lib/entitlements.ts` gates Pro features

## Feature Architecture

### Recipe Sources (Dual System)
1. **Supabase recipes** — AI-generated, 32 dish-type categories, 11-primary cuisine hierarchy. Queried for feeds (For You, Something New), search, and planner auto-populate.
2. **FatSecret recipes** — External API search for recipe discovery. Also provides food database for Manual Entry and ingredient swaps.
3. **Local app_recipes** — 53 seeded recipes used as planner fallback.

### Meal Planner
- Weekly plan → 7 days → N meals per day (breakfast, lunch, dinner, snacks)
- Auto-populate with macro-aware recipe selection via `getPlannerCandidates()`
- Serving multiplier scaling per meal
- Lock/unlock individual meals
- Meal states: `scheduled` → `cooked` → `autoCounted`
- Daily rollover via `userRolloverState`

### Ingredient System
- 17-category classification for Swap Ingredient (`IngredientCategory`)
- 14-group classification for pantry UI and grocery aisles (`PantryFoodGroup`)
- Mapping in `client/src/lib/ingredient-categories.ts`

### Scaled Steps (AI)
- `POST /api/scaled-steps` — GPT-4o rewrites recipe instructions for different serving counts
- Cook time scaling: invariant, linear_batch, weight_based, surface_area
- Results cached in Supabase `recipe_steps_variants`

## Known Issues / Technical Debt

- `client/src/lib/time-format.ts` is imported in `recipe-card.tsx` but doesn't exist
- Pre-existing TypeScript strict-mode errors (Set iteration, implicit any) — don't block Vite
- `shared/models/chat.ts` is unused (was for Replit chat integration)
- Some pages have duplicate files (e.g., `pantry.tsx` and `pantry/index.tsx`)
- `server/routes.ts` is ~2000 lines — could be split into route modules

## Future Roadmap Context

- Photo-based food logging (camera → AI food recognition)
- Recipe bot scaling to 200K+ recipes
- Instacart deep integration for grocery ordering
- EAS Build for app store deployment (Capacitor)
