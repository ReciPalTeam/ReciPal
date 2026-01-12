import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

export default function PaywallPage() {
  const [, setLocation] = useLocation();

  const features = [
    "Macro Tracker & Insights",
    "Personalized Meal Plans",
    "Pantry Decay Tracking",
    "Export Grocery Lists",
    "Advanced Dietary Filters"
  ];

  return (
    <div className="min-h-screen bg-recipal-deep-green text-white p-6 flex flex-col items-center justify-center space-y-8">
      <div className="text-center space-y-2">
        <ShieldCheck className="h-16 w-16 text-recipal-orange mx-auto" />
        <h1 className="text-3xl font-bold">Upgrade to Pro</h1>
        <p className="text-white/70">Unlock the full power of ReciPal</p>
      </div>

      <Card className="w-full max-w-sm bg-white/10 border-white/20 text-white backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl text-center">Pro Membership</CardTitle>
          <div className="text-center">
            <span className="text-4xl font-bold">$4.99</span>
            <span className="text-white/60"> / month</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-recipal-orange/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-recipal-orange" />
                </div>
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-3 pt-4">
            <Button 
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90 text-white font-bold h-12"
              data-testid="button-subscribe"
            >
              Start 7-Day Free Trial
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-white/60 hover:text-white"
              onClick={() => setLocation("/")}
              data-testid="button-maybe-later"
            >
              Maybe Later
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-center space-y-4 max-w-xs">
        <p className="text-[10px] text-white/40 leading-relaxed">
          Subscription automatically renews unless canceled at least 24 hours before the end of the current period. 
          Payment will be charged to your App Store account at confirmation of purchase.
        </p>
        <div className="flex justify-center gap-4 text-[10px] text-recipal-orange">
          <button data-testid="link-restore">Restore Purchases</button>
          <button data-testid="link-terms">Terms of Service</button>
          <button data-testid="link-privacy">Privacy Policy</button>
        </div>
      </div>
    </div>
  );
}
