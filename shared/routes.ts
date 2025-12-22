import { z } from 'zod';
import { insertUserSchema, insertUserProfileSchema, recipes, weeklyPlans, planMeals, userProfiles, type InsertUserProfile } from './schema';

export { insertUserSchema, insertUserProfileSchema, recipes, weeklyPlans, planMeals, userProfiles };
export type { InsertUserProfile };

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertUserSchema,
      responses: {
        201: z.object({ id: z.number(), username: z.string() }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.object({ id: z.number(), username: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.object({ id: z.number(), username: z.string() }).nullable(),
      },
    },
  },
  profile: {
    get: {
      method: 'GET' as const,
      path: '/api/profile',
      responses: {
        200: z.custom<typeof userProfiles.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/profile',
      input: insertUserProfileSchema,
      responses: {
        201: z.custom<typeof userProfiles.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/profile',
      input: insertUserProfileSchema.partial(),
      responses: {
        200: z.custom<typeof userProfiles.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  plans: {
    current: {
      method: 'GET' as const,
      path: '/api/plans/current',
      responses: {
        200: z.any(), // Complex nested type WeeklyPlanWithDays
        404: z.object({ message: z.string() }), // Not found is okay, means no plan yet
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/plans/generate',
      responses: {
        201: z.object({ id: z.number(), message: z.string() }),
      },
    },
  },
  meals: {
    refresh: {
      method: 'PATCH' as const,
      path: '/api/meals/:id/refresh',
      responses: {
        200: z.custom<typeof planMeals.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    toggleLock: {
      method: 'PATCH' as const,
      path: '/api/meals/:id/lock',
      input: z.object({ locked: z.boolean() }),
      responses: {
        200: z.custom<typeof planMeals.$inferSelect>(),
      },
    },
  },
  cart: {
    get: {
      method: 'GET' as const,
      path: '/api/cart',
      responses: {
        200: z.any(), // ShoppingCart type
      },
    },
  },
  dashboard: {
    get: {
      method: 'GET' as const,
      path: '/api/dashboard',
      responses: {
        200: z.object({
          dailyCalories: z.number(),
          weeklySavings: z.number(),
          lifetimeSavings: z.number(),
          nextMeal: z.any().optional(),
        }),
      },
    },
  },
  favorites: {
    list: {
      method: 'GET' as const,
      path: '/api/favorites',
      responses: {
        200: z.any(),
      },
    },
    ids: {
      method: 'GET' as const,
      path: '/api/favorites/ids',
      responses: {
        200: z.array(z.number()),
      },
    },
    add: {
      method: 'POST' as const,
      path: '/api/recipes/:recipeId/favorite',
      responses: {
        201: z.any(),
        400: z.object({ message: z.string() }),
      },
    },
    remove: {
      method: 'DELETE' as const,
      path: '/api/recipes/:recipeId/favorite',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
