import { Switch, Route, useLocation } from "wouter";
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
import Dashboard from "@/pages/dashboard";
import WeeklyPlan from "@/pages/plan";
import CartPage from "@/pages/cart";

// Auth wrapper component
function AuthWrapper() {
  const { data: user, isLoading: userLoading } = useUser();
  const [, setLocation] = useLocation();

  if (userLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  if (!user) {
    setLocation("/login");
    return null;
  }

  return <ProfileWrapper />;
}

// Profile wrapper component
function ProfileWrapper() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();

  if (profileLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  if (!profile) {
    setLocation("/onboarding");
    return null;
  }

  return <AppContent />;
}

// Main app content
function AppContent() {
  const location = useLocation()[0];

  if (location === "/onboarding") {
    return <Onboarding />;
  }

  return (
    <LayoutShell>
      {location === "/dashboard" && <Dashboard />}
      {location === "/plan" && <WeeklyPlan />}
      {location === "/cart" && <CartPage />}
    </LayoutShell>
  );
}

// Onboarding wrapper
function OnboardingWrapper() {
  const { data: user, isLoading } = useUser();

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  if (!user) {
    return <AuthPage />;
  }

  return <Onboarding />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/register" component={AuthPage} />
      <Route path="/onboarding" component={OnboardingWrapper} />
      <Route component={() => <AuthWrapper />} />
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
