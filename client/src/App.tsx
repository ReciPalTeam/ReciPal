import { Switch, Route, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { LayoutShell } from "@/components/layout-shell";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import Onboarding from "@/pages/onboarding";
import ShareRecipePage from "@/pages/share-recipe";

import RecipesPage from "@/pages/recipes/index";
import RecipeDetailPage from "@/pages/recipe/[id]";
import PlannerPage from "@/pages/planner/index";
import PantryPage from "@/pages/pantry/index";
import CartPage from "@/pages/cart/index";
import ProfilePage from "@/pages/profile/index";
import SettingsPage from "@/pages/settings/index";
import PaywallPage from "@/pages/paywall/index";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading: userLoading } = useUser();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [location] = useLocation();

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

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={AuthPage} />
      <Route path="/register" component={AuthPage} />
      <Route path="/share/recipe/:id" component={ShareRecipePage} />
      
      <Route path="/onboarding">
        <ProtectedRoute>
          <Onboarding />
        </ProtectedRoute>
      </Route>
      
      <Route path="/recipe/:id">
        <ProtectedRoute>
          <RecipeDetailPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/recipes">
        <ProtectedRoute>
          <LayoutShell>
            <RecipesPage />
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
      
      <Route path="/">
        <ProtectedRoute>
          <LayoutShell>
            <RecipesPage />
          </LayoutShell>
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppRoutes />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
