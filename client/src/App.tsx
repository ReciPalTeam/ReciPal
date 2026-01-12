import { Switch, Route, useLocation } from "wouter";
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
import PlannerPage from "@/pages/planner/index";
import PantryPage from "@/pages/pantry/index";
import CartPage from "@/pages/cart/index";
import ProfilePage from "@/pages/profile/index";
import SettingsPage from "@/pages/settings/index";
import PaywallPage from "@/pages/paywall/index";

function ProtectedApp() {
  const { data: user, isLoading: userLoading } = useUser();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!userLoading && !user) {
      setLocation("/login");
    }
  }, [user, userLoading, setLocation]);

  useEffect(() => {
    if (!profileLoading && !profile && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [profile, profileLoading, location, setLocation]);

  if (userLoading || profileLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;
  }

  if (!user) return null;

  if (!profile && location !== "/onboarding") return null;

  if (location === "/onboarding") {
    return <Onboarding />;
  }

  return (
    <LayoutShell>
      {location === "/recipes" && <RecipesPage />}
      {location === "/plan" && <PlannerPage />}
      {location === "/pantry" && <PantryPage />}
      {location === "/cart" && <CartPage />}
      {location === "/profile" && <ProfilePage />}
      {location === "/settings" && <SettingsPage />}
      {location === "/paywall" && <PaywallPage />}
      {(location === "/" || location === "") && <RecipesPage />}
    </LayoutShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={AuthPage} />
      <Route path="/register" component={AuthPage} />
      <Route path="/share/recipe/:id" component={ShareRecipePage} />
      <Route component={ProtectedApp} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
