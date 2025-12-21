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

// Wrapper for protected routes to handle auth redirection
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  if (!user) {
    setLocation("/login");
    return null;
  }

  return (
    <ProfileCheck>
      <LayoutShell>
        <Component />
      </LayoutShell>
    </ProfileCheck>
  );
}

// Ensure user has a profile before letting them access the app
function ProfileCheck({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading, error } = useProfile();
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  // 404 on profile get means no profile exists
  if (!profile) {
    setLocation("/onboarding");
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/register" component={AuthPage} />
      
      {/* Protected Routes */}
      <Route path="/onboarding">
         {/* Onboarding handles its own "needs profile" check inversely */}
         {() => {
           const { data: user, isLoading } = useUser();
           if (isLoading) return null;
           if (!user) return <AuthPage />;
           return <Onboarding />;
         }}
      </Route>

      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      
      <Route path="/plan">
        {() => <ProtectedRoute component={WeeklyPlan} />}
      </Route>
      
      <Route path="/cart">
        {() => <ProtectedRoute component={CartPage} />}
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
