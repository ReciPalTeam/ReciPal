import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUser } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Zap, Settings, TrendingUp, PieChart, Target, User } from "lucide-react";
import { useLocation } from "wouter";

export default function ProfilePage() {
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const [, setLocation] = useLocation();

  const isPro = profile?.subscriptionTier === 'pro';

  if (isPro) {
    return (
      <div className="p-4 space-y-6 pb-24">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-recipal-deep-green flex items-center justify-center text-white font-bold text-xl">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="font-bold text-lg">Hello, {user?.username?.split('@')[0] || 'User'}</h2>
              <span className="text-[10px] bg-recipal-orange/10 text-recipal-orange px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Pro Member</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} data-testid="button-settings">
            <Settings className="w-5 h-5" />
          </Button>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-recipal-deep-green text-white rounded-2xl space-y-2">
            <TrendingUp className="w-4 h-4 text-recipal-orange" />
            <p className="text-[10px] text-white/60">Weekly Savings</p>
            <p className="text-xl font-bold" data-testid="text-weekly-savings">$42.50</p>
          </div>
          <div className="p-4 bg-white border rounded-2xl space-y-2">
            <Target className="w-4 h-4 text-primary" />
            <p className="text-[10px] text-muted-foreground">Calories Today</p>
            <p className="text-xl font-bold" data-testid="text-calories-today">1,850 / 2.2k</p>
          </div>
        </div>

        <div className="p-6 bg-white border rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" /> Macros
            </h3>
            <span className="text-[10px] text-muted-foreground">Today</span>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]"><span>Protein</span><span data-testid="text-protein">120g / 150g</span></div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-recipal-orange" style={ { width: '80%' } } /></div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]"><span>Carbs</span><span data-testid="text-carbs">210g / 250g</span></div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={ { width: '84%' } } /></div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]"><span>Fats</span><span data-testid="text-fats">45g / 65g</span></div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-recipal-deep-green" style={ { width: '69%' } } /></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8 flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        <User className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-recipal-deep-green" data-testid="text-username">{user?.username?.split('@')[0] || 'User'}</h2>
        <p className="text-muted-foreground text-sm">Free Account</p>
      </div>
      
      <Card className="bg-recipal-orange/5 border-recipal-orange/20 w-full max-w-xs">
        <CardContent className="pt-6 space-y-4">
          <div className="h-12 w-12 bg-recipal-orange/20 rounded-2xl flex items-center justify-center mx-auto">
            <Zap className="text-recipal-orange" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold">Upgrade to Pro</h3>
            <p className="text-xs text-muted-foreground">Unlock macro tracking, personalized meal plans, and more.</p>
          </div>
          <Button 
            className="w-full bg-recipal-orange hover:bg-recipal-orange/90 font-bold" 
            onClick={() => setLocation("/paywall")}
            data-testid="button-upgrade"
          >
            View Pro Plans
          </Button>
        </CardContent>
      </Card>

      <Button variant="ghost" className="text-muted-foreground" onClick={() => setLocation("/settings")} data-testid="button-account-settings">
        Account Settings
      </Button>
    </div>
  );
}
