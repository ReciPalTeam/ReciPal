export type SubscriptionTier = 'free' | 'pro';

export type SubscriptionPlan = {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
};

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$9.99',
    period: '/month',
    features: [
      'Unlimited meal plans',
      'Full macro tracking',
      'Pantry management',
      'Smart grocery lists',
      'Recipe scaling',
    ],
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: '$79.99',
    period: '/year',
    features: [
      'Everything in Monthly',
      '2 months free',
      'Priority support',
      'Early access features',
    ],
    popular: true,
  },
];

export interface SubscriptionState {
  tier: SubscriptionTier;
  expiresAt: Date | null;
  isActive: boolean;
}

export function getMockSubscriptionState(isPro: boolean): SubscriptionState {
  return {
    tier: isPro ? 'pro' : 'free',
    expiresAt: isPro ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
    isActive: isPro,
  };
}

export function isFeatureGated(feature: string, tier: SubscriptionTier): boolean {
  const proFeatures = [
    'macro_tracking',
    'meal_planning',
    'pantry_decay',
    'recipe_scaling',
    'nutrition_insights',
  ];
  
  if (tier === 'pro') return false;
  return proFeatures.includes(feature);
}

export function useSubscription() {
  return {
    purchaseSubscription: async (planId: string): Promise<boolean> => {
      console.log(`[RevenueCat Mock] Purchasing ${planId}`);
      return true;
    },
    restorePurchases: async (): Promise<boolean> => {
      console.log('[RevenueCat Mock] Restoring purchases');
      return false;
    },
    getOfferings: async () => {
      return subscriptionPlans;
    },
  };
}
