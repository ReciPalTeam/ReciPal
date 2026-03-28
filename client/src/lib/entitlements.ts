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
  syncPreferencesFromServer: (profile: Record<string, any>) => void;
  
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

        const PREF_TO_PROFILE_KEY: Record<string, string> = {
          allergies: 'allergies',
          dietaryPreferences: 'dietaryPreferences',
          cookingComfort: 'cookingComfort',
          missingTools: 'missingTools',
        };
        const UI_TO_DB_COMFORT: Record<string, string> = {
          beginner: 'quick',
          intermediate: 'comfortable',
          advanced: 'involved',
        };
        const profileKey = PREF_TO_PROFILE_KEY[key];
        if (profileKey) {
          let serverValue = value;
          if (key === 'cookingComfort' && typeof value === 'string') {
            serverValue = (UI_TO_DB_COMFORT[value] || value) as typeof value;
          }
          fetch('/api/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ [profileKey]: serverValue }),
          }).then((res) => {
            if (!res.ok) {
              console.warn(`[Preferences] Failed to sync ${profileKey} to server (${res.status})`);
            }
          }).catch((err) => {
            console.warn('[Preferences] Network error syncing to server:', err);
          });
        }
      },

      syncPreferencesFromServer: (profile) => {
        if (!profile) return;
        const DB_TO_UI_COMFORT: Record<string, UserPreferences['cookingComfort']> = {
          quick: 'beginner',
          comfortable: 'intermediate',
          involved: 'advanced',
        };
        const updates: Partial<UserPreferences> = {};
        if (Array.isArray(profile.allergies)) {
          updates.allergies = profile.allergies as string[];
        }
        if (Array.isArray(profile.dietaryPreferences)) {
          updates.dietaryPreferences = profile.dietaryPreferences as string[];
        }
        if (typeof profile.cookingComfort === 'string' && profile.cookingComfort) {
          const dbVal = profile.cookingComfort as string;
          updates.cookingComfort = DB_TO_UI_COMFORT[dbVal] || dbVal as UserPreferences['cookingComfort'];
        }
        if (Array.isArray(profile.missingTools)) {
          updates.missingTools = profile.missingTools as string[];
        }
        if (Object.keys(updates).length > 0) {
          set((state) => ({
            preferences: { ...state.preferences, ...updates }
          }));
        }
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
