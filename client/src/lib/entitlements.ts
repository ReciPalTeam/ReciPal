import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SubscriptionStatus = 
  | 'active' 
  | 'expired' 
  | 'grace_period' 
  | 'canceled_active' 
  | 'none';

export interface EntitlementState {
  isPro: boolean;
  status: SubscriptionStatus;
  expiresAt: string | null;
  willRenew: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface NotificationPreferences {
  mealReminders: boolean;
  groceryReminders: boolean;
  promotionalNotifications: boolean;
  hasRequestedPermission: boolean;
}

export interface UserPreferences {
  allergies: string[];
  dietaryPreferences: string[];
  cookingComfort: 'beginner' | 'intermediate' | 'advanced';
  costPreference: 'budget' | 'moderate' | 'premium';
  missingTools: string[];
  language: 'en' | 'es';
}

interface EntitlementsStore {
  entitlement: EntitlementState;
  notifications: NotificationPreferences;
  preferences: UserPreferences;
  
  getEntitlements: () => Promise<EntitlementState>;
  purchasePro: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  openManageSubscription: () => void;
  
  setNotificationPreference: <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => void;
  setUserPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  
  deleteAccount: () => Promise<boolean>;
  logout: () => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  _setProForDemo: (isPro: boolean) => void;
}

const PRIVACY_POLICY_URL = 'https://recipal.app/privacy';
const TERMS_URL = 'https://recipal.app/terms';
const SUPPORT_EMAIL = 'support@recipal.app';

export { PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_EMAIL };

export const useEntitlements = create<EntitlementsStore>()(
  persist(
    (set, get) => ({
      entitlement: {
        isPro: false,
        status: 'none',
        expiresAt: null,
        willRenew: false,
        isLoading: false,
        error: null,
      },
      
      notifications: {
        mealReminders: true,
        groceryReminders: true,
        promotionalNotifications: false,
        hasRequestedPermission: false,
      },
      
      preferences: {
        allergies: [],
        dietaryPreferences: [],
        cookingComfort: 'intermediate',
        costPreference: 'moderate',
        missingTools: [],
        language: 'en',
      },
      
      getEntitlements: async () => {
        set((state) => ({ 
          entitlement: { ...state.entitlement, isLoading: true, error: null } 
        }));
        
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));
          
          const { entitlement } = get();
          set((state) => ({ 
            entitlement: { ...state.entitlement, isLoading: false } 
          }));
          return entitlement;
        } catch (error) {
          set((state) => ({ 
            entitlement: { 
              ...state.entitlement, 
              isLoading: false, 
              error: 'Failed to fetch entitlements' 
            } 
          }));
          throw error;
        }
      },
      
      purchasePro: async () => {
        set((state) => ({ 
          entitlement: { ...state.entitlement, isLoading: true, error: null } 
        }));
        
        try {
          console.log('[RevenueCat] Initiating purchase flow...');
          await new Promise((resolve) => setTimeout(resolve, 1500));
          
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          
          set({
            entitlement: {
              isPro: true,
              status: 'active',
              expiresAt: expiresAt.toISOString(),
              willRenew: true,
              isLoading: false,
              error: null,
            }
          });
          
          console.log('[RevenueCat] Purchase successful');
          return true;
        } catch (error) {
          set((state) => ({ 
            entitlement: { 
              ...state.entitlement, 
              isLoading: false, 
              error: 'Purchase failed. Please try again.' 
            } 
          }));
          return false;
        }
      },
      
      restorePurchases: async () => {
        set((state) => ({ 
          entitlement: { ...state.entitlement, isLoading: true, error: null } 
        }));
        
        try {
          console.log('[RevenueCat] Restoring purchases...');
          await new Promise((resolve) => setTimeout(resolve, 1500));
          
          console.log('[RevenueCat] No previous purchases found');
          set((state) => ({ 
            entitlement: { ...state.entitlement, isLoading: false } 
          }));
          return false;
        } catch (error) {
          set((state) => ({ 
            entitlement: { 
              ...state.entitlement, 
              isLoading: false, 
              error: 'Failed to restore purchases' 
            } 
          }));
          return false;
        }
      },
      
      openManageSubscription: () => {
        console.log('[RevenueCat] Opening subscription management...');
        
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isIOS) {
          window.location.href = 'itms-apps://apps.apple.com/account/subscriptions';
        } else if (isAndroid) {
          window.location.href = 'https://play.google.com/store/account/subscriptions';
        } else {
          console.log('[Web] Subscription management not available on web');
        }
      },
      
      setNotificationPreference: (key, value) => {
        set((state) => ({
          notifications: { ...state.notifications, [key]: value }
        }));
      },
      
      setUserPreference: (key, value) => {
        set((state) => ({
          preferences: { ...state.preferences, [key]: value }
        }));
      },
      
      deleteAccount: async () => {
        set((state) => ({ 
          entitlement: { ...state.entitlement, isLoading: true } 
        }));
        
        try {
          console.log('[Account] Deleting account...');
          await new Promise((resolve) => setTimeout(resolve, 1000));
          
          set({
            entitlement: {
              isPro: false,
              status: 'none',
              expiresAt: null,
              willRenew: false,
              isLoading: false,
              error: null,
            },
            notifications: {
              mealReminders: true,
              groceryReminders: true,
              promotionalNotifications: false,
              hasRequestedPermission: false,
            },
            preferences: {
              allergies: [],
              dietaryPreferences: [],
              cookingComfort: 'intermediate',
              costPreference: 'moderate',
              missingTools: [],
              language: 'en',
            },
          });
          
          localStorage.clear();
          console.log('[Account] Account deleted successfully');
          return true;
        } catch (error) {
          set((state) => ({ 
            entitlement: { ...state.entitlement, isLoading: false } 
          }));
          return false;
        }
      },
      
      logout: () => {
        console.log('[Auth] Logging out...');
      },
      
      setLoading: (loading) => {
        set((state) => ({ 
          entitlement: { ...state.entitlement, isLoading: loading } 
        }));
      },
      
      setError: (error) => {
        set((state) => ({ 
          entitlement: { ...state.entitlement, error } 
        }));
      },
      
      _setProForDemo: (isPro) => {
        const expiresAt = isPro ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
        set({
          entitlement: {
            isPro,
            status: isPro ? 'active' : 'none',
            expiresAt,
            willRenew: isPro,
            isLoading: false,
            error: null,
          }
        });
      },
    }),
    {
      name: 'recipal-entitlements',
      partialize: (state) => ({
        entitlement: {
          isPro: state.entitlement.isPro,
          status: state.entitlement.status,
          expiresAt: state.entitlement.expiresAt,
          willRenew: state.entitlement.willRenew,
        },
        notifications: state.notifications,
        preferences: state.preferences,
      }),
    }
  )
);

export function getSubscriptionStatusText(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'expired':
      return 'Expired';
    case 'grace_period':
      return 'Payment Issue - Grace Period';
    case 'canceled_active':
      return 'Canceled - Active until end of period';
    default:
      return 'No subscription';
  }
}
