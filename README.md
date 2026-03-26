# ReciPal

Recipe management, macro tracking, meal planning, and pantry tracking — all in one app.

## Prerequisites

- **Node.js** 20+ (tested on 24.x)
- **npm** 9+
- A **Supabase** project with the recipe database tables provisioned
- **FatSecret API** credentials (with relay proxy for static IP)
- **OpenAI API** key (GPT-4o for AI features)

## Local Development Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd ReciPal
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in all required values:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | Supabase Dashboard → Settings → Database → Connection string (use pooler/transaction mode) |
| `SESSION_SECRET` | Generate a random string (32+ chars) |
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `FATSECRET_CLIENT_ID` | FatSecret Platform → My Apps → your app |
| `FATSECRET_CLIENT_SECRET` | FatSecret Platform → My Apps → your app |
| `RELAY_URL` | Your FatSecret relay proxy URL |
| `RELAY_KEY` | Your relay authentication key |
| `OPENAI_API_KEY` | OpenAI Dashboard → API Keys |

### 3. Set up the database

The Supabase project needs both:
- **Recipe database tables** (recipes, ingredients, etc.) — these should already exist with data
- **App tables** (users, plans, sessions, etc.) — create these by running the SQL in the migration or using `drizzle-kit push`:

```bash
npm run db:push
```

### 4. Start the dev server

```bash
npm run dev
```

This starts Express (API) + Vite (frontend HMR) on **http://localhost:5000**.

### 5. Open the app

Navigate to `http://localhost:5000` in your browser. Register a new account to get started.

## Running on Mobile

### Expo Go (web preview)
The app is mobile-first responsive — test in your browser's mobile device simulator (F12 → device toolbar).

### Capacitor (native build)
```bash
npm run build
npx cap add ios        # or android
npx cap sync
npx cap open ios       # opens in Xcode
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Express + Vite HMR) |
| `npm run build` | Production build (client + server) |
| `npm start` | Run production build |
| `npm run check` | TypeScript type check |
| `npm run db:push` | Push Drizzle schema to database |

## Project Structure

```
client/src/     → React frontend (pages, components, hooks, lib)
server/         → Express backend (routes, storage, APIs)
shared/         → Shared types and schema (Drizzle ORM)
script/         → Build scripts
```

See `CLAUDE.md` for detailed architecture documentation.

## Tech Stack

React 18 · Vite 7 · TypeScript · Express · Drizzle ORM · Supabase · FatSecret API · OpenAI GPT-4o · Capacitor · Tailwind CSS · shadcn/ui · Wouter · Zustand · TanStack Query

## Platform Notes

- **Windows:** Fully supported. Uses Node's `--env-file` flag for env loading.
- **macOS/Linux:** Also works. Same setup steps.
- The `DATABASE_URL` password contains special characters — they are URL-encoded in the connection string.
