import { Switch, Route, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { LayoutShell } from "@/components/layout-shell";
import { useDeepLink } from "@/hooks/use-deep-link";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { Loader2 } from "lucide-react";
import { useEntitlements } from "@/lib/entitlements";

import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import Onboarding from "@/pages/onboarding";
import ShareRecipePage from "@/pages/share/recipe/[id]";

import RecipesPage from "@/pages/recipes/index";
import RecipeDetailPage from "@/pages/recipe/[id]";
import ReelsPage from "@/pages/reels/index";
import ChefAnalyticsPage from "@/pages/chef/analytics/index";
import ChefMyPage from "@/pages/chef/me/index";
import ChefUploadPage from "@/pages/chef/upload/index";
import ChefHandlePage from "@/pages/chef/[handle]/index";
import HashtagPage from "@/pages/hashtag/[tag]/index";
import ChefRecipePage from "@/pages/chef-recipe/[id]/index";
import PlannerPage from "@/pages/planner/index";
import PantryPage from "@/pages/pantry/index";
import CartPage from "@/pages/cart/index";
import ProfilePage from "@/pages/profile/index";
import SettingsPage from "@/pages/settings/index";
import PaywallPage from "@/pages/paywall/index";
import NotificationsPage from "@/pages/notifications/index";
import PreferencesPage from "@/pages/preferences/index";
import InstacartHandoffPage from "@/pages/instacart/index";
import MacroWizardPage from "@/pages/macro-wizard/index";
import ProWelcomePage from "@/pages/pro-welcome/index";
import SwatchboardPage from "@/pages/swatchboard/index";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading: userLoading } = useUser();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [location] = useLocation();
  const setProForDemo = useEntitlements((s) => s._setProForDemo);
  const syncPreferencesFromServer = useEntitlements((s) => s.syncPreferencesFromServer);

  useEffect(() => {
    if (user) {
      setProForDemo(user.isPro || false);
    }
  }, [user, setProForDemo]);

  useEffect(() => {
    if (profile) {
      syncPreferencesFromServer(profile);
    }
  }, [profile, syncPreferencesFromServer]);

  if (userLoading || profileLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!profile && location !== "/onboarding") {
    return <Redirect to="/onboarding" />;
  }

  return <>{children}</>;
}

function ProLandingRedirect() {
  const { data: user, isLoading: userLoading } = useUser();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();
  const setProForDemo = useEntitlements((s) => s._setProForDemo);
  const syncPreferencesFromServer = useEntitlements((s) => s.syncPreferencesFromServer);

  useEffect(() => {
    if (user) {
      setProForDemo(user.isPro || false);
    }
  }, [user, setProForDemo]);

  useEffect(() => {
    if (profile) {
      syncPreferencesFromServer(profile);
    }
  }, [profile, syncPreferencesFromServer]);

  if (userLoading || profileLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!profile) {
    return <Redirect to="/onboarding" />;
  }

  const isPro = profile.subscriptionTier === 'pro';
  
  if (isPro) {
    return (
      <LayoutShell>
        <ProfilePage />
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <RecipesPage />
    </LayoutShell>
  );
}

function AppRoutes() {
  useDeepLink();
  
  return (
    <Switch>
      <Route path="/login" component={AuthPage} />
      <Route path="/register" component={AuthPage} />
      <Route path="/share/recipe/:id" component={ShareRecipePage} />
      <Route path="/swatchboard" component={SwatchboardPage} />
      
      <Route path="/onboarding">
        <ProtectedRoute>
          <Onboarding />
        </ProtectedRoute>
      </Route>
      
      <Route path="/recipe/:id">
        <ProtectedRoute>
          <LayoutShell>
            <RecipeDetailPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/recipes">
        <ProtectedRoute>
          <LayoutShell>
            <RecipesPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>

      <Route path="/reels">
        <ProtectedRoute>
          <LayoutShell>
            <ReelsPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>

      <Route path="/chef/analytics">
        <ProtectedRoute>
          <LayoutShell>
            <ChefAnalyticsPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>

      <Route path="/chef/me">
        <ProtectedRoute>
          <LayoutShell>
            <ChefMyPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>

      <Route path="/chef/upload">
        <ProtectedRoute>
          <LayoutShell>
            <ChefUploadPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>

      {/* Vanity handle route — MUST come after /chef/me, /chef/upload, /chef/analytics
          so the literal slugs take precedence over :handle. */}
      <Route path="/chef/:handle">
        <ProtectedRoute>
          <LayoutShell>
            <ChefHandlePage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>

      <Route path="/hashtag/:tag">
        <ProtectedRoute>
          <LayoutShell>
            <HashtagPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>

      <Route path="/chef-recipe/:id">
        <ProtectedRoute>
          <LayoutShell>
            <ChefRecipePage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>

      <Route path="/plan">
        <ProtectedRoute>
          <LayoutShell>
            <PlannerPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/pantry">
        <ProtectedRoute>
          <LayoutShell>
            <PantryPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/cart">
        <ProtectedRoute>
          <LayoutShell>
            <CartPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/profile">
        <ProtectedRoute>
          <LayoutShell>
            <ProfilePage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings">
        <ProtectedRoute>
          <LayoutShell>
            <SettingsPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/paywall">
        <ProtectedRoute>
          <PaywallPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/notifications">
        <ProtectedRoute>
          <LayoutShell>
            <NotificationsPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/preferences">
        <ProtectedRoute>
          <LayoutShell>
            <PreferencesPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/instacart">
        <ProtectedRoute>
          <InstacartHandoffPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/macro-wizard">
        <ProtectedRoute>
          <MacroWizardPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/pro-welcome">
        <ProtectedRoute>
          <ProWelcomePage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/">
        <ProLandingRedirect />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <OfflineBanner className="fixed top-0 left-0 right-0 z-50" />
          <Toaster />
          <AppRoutes />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
