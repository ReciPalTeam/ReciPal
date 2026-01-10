# ReciPal

## Overview

ReciPal is a full-stack web application that helps users plan meals, order groceries, and cook smarter. It features recipe discovery, automated meal planning, pantry management with ingredient decay tracking, and a Pro membership that includes a comprehensive macronutrient tracker.

**Core Features:**
- User authentication (email/password)
- Multi-step onboarding wizard for collecting health/diet preferences
- Macro calculation using Mifflin-St Jeor formula
- Weekly meal plan generation from recipe database
- Grocery list generation with Have/Might Have/Need categorization
- Dashboard with progress and savings overview
- Recipe sharing via public shareable links
- Pro membership with macro tracker and onboarding (Fast Track + Guided Setup)
- Pantry decay acceleration when marking recipes as cooked

## Recent Changes (January 2026)

- Updated login/registration screens with ReciPal branding (deep green and orange palette)
- Added consolidated grocery list page with pantry-based categorization
- Implemented recipe sharing functionality with public routes (/share/recipe/:id)
- Created Pro macro onboarding with dual paths (Fast Track manual entry, Guided Setup using Mifflin-St Jeor)
- Added "Get Missing Ingredients" feature with Instacart placeholder
- Implemented pantry decay acceleration when meals are marked as cooked
- Added Spoonacular service layer with demo mode fallback and 90-day caching

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React with TypeScript, using Vite as the build tool
- **Routing:** Wouter for client-side routing
- **State Management:** TanStack React Query for server state caching and synchronization
- **Styling:** TailwindCSS with shadcn/ui component library (New York style variant)
- **Forms:** React Hook Form with Zod validation via @hookform/resolvers
- **Animations:** Framer Motion for wizard transitions and page animations
- **Charts:** Recharts for dashboard visualizations

### Backend Architecture
- **Runtime:** Node.js with Express.js
- **Language:** TypeScript with ESM modules
- **API Design:** RESTful endpoints defined in shared/routes.ts with Zod schemas for validation
- **Authentication:** Passport.js with Local Strategy, session-based auth using express-session
- **Password Security:** Scrypt hashing with timing-safe comparison

### Data Storage
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM with drizzle-zod for schema-to-validation integration
- **Schema Location:** shared/schema.ts contains all table definitions
- **Migrations:** Managed via drizzle-kit with `db:push` command

### Key Design Patterns
- **Shared Types:** Schema and route definitions in /shared directory are used by both client and server
- **Storage Abstraction:** DatabaseStorage class in server/storage.ts provides interface for all data operations
- **Path Aliases:** @/ for client/src, @shared/ for shared directory

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/ui/  # shadcn/ui components
│       ├── hooks/          # Custom React hooks
│       ├── pages/          # Route pages
│       └── lib/            # Utilities
├── server/           # Express backend
│   ├── index.ts      # Entry point
│   ├── routes.ts     # API route handlers
│   ├── storage.ts    # Database operations
│   └── db.ts         # Database connection
├── shared/           # Shared code
│   ├── schema.ts     # Drizzle schema definitions
│   └── routes.ts     # API contract definitions
└── migrations/       # Database migrations
```

## External Dependencies

### Database
- **PostgreSQL:** Primary database, connection via DATABASE_URL environment variable
- **connect-pg-simple:** Session storage in PostgreSQL

### UI Components
- **Radix UI:** Primitive components for accessibility (dialog, dropdown, tabs, etc.)
- **Lucide React:** Icon library
- **cmdk:** Command palette component
- **embla-carousel-react:** Carousel functionality
- **vaul:** Drawer component
- **react-day-picker:** Calendar/date picker

### Development Tools
- **Vite Plugins:** @replit/vite-plugin-runtime-error-modal for error display
- **esbuild:** Server bundling for production builds