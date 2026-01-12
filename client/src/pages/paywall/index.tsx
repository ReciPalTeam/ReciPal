import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ShieldCheck, ChevronLeft, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEntitlements, PRIVACY_POLICY_URL, TERMS_URL } from "@/lib/entitlements";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function PaywallPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { entitlement, purchasePro, restorePurchases } = useEntitlements();
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [legalDialogType, setLegalDialogType] = useState<'privacy' | 'terms'>('privacy');

  const features = [
    "Macro Tracker & Insights",
    "Personalized Meal Plans",
    "Pantry Decay Tracking",
    "Export Grocery Lists",
    "Advanced Dietary Filters"
  ];

  const handlePurchase = async () => {
    const success = await purchasePro();
    if (success) {
      toast({
        title: "Welcome to Pro!",
        description: "Your subscription is now active.",
      });
      setLocation("/profile");
    } else {
      toast({
        title: "Purchase failed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    }
  };

  const handleRestore = async () => {
    const success = await restorePurchases();
    if (success) {
      toast({
        title: "Purchases restored",
        description: "Your Pro subscription has been restored.",
      });
      setLocation("/profile");
    } else {
      toast({
        title: "No purchases found",
        description: "We couldn't find any previous purchases.",
        variant: "destructive",
      });
    }
  };

  const openLegalDialog = (type: 'privacy' | 'terms') => {
    setLegalDialogType(type);
    setLegalDialogOpen(true);
  };

  const getLegalContent = () => {
    if (legalDialogType === 'privacy') {
      return {
        title: "Privacy Policy",
        content: `ReciPal respects your privacy. We collect only the data necessary to provide our meal planning services. Your personal information is never sold to third parties.\n\nFor the full privacy policy, visit:\n${PRIVACY_POLICY_URL}`,
      };
    }
    return {
      title: "Terms of Service",
      content: `By using ReciPal, you agree to our terms of service.\n\nSubscription Terms:\n- Payment will be charged to your App Store or Google Play account at confirmation of purchase\n- Subscription automatically renews unless canceled at least 24 hours before the end of the current period\n- Account will be charged for renewal within 24 hours prior to the end of the current period\n- Subscriptions may be managed and auto-renewal turned off in Account Settings after purchase\n- Any unused portion of a free trial period will be forfeited when purchasing a subscription\n\nFor full terms, visit:\n${TERMS_URL}`,
    };
  };

  return (
    <div className="min-h-screen bg-recipal-deep-green text-white flex flex-col">
      <div className="sticky top-0 z-10 p-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setLocation("/")}
          className="text-white hover:bg-white/10"
          data-testid="button-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-8">
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
                  <div className="h-5 w-5 rounded-full bg-recipal-orange/20 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-recipal-orange" />
                  </div>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-3 pt-4">
              <Button 
                className="w-full bg-recipal-orange hover:bg-recipal-orange/90 text-white font-bold h-12"
                onClick={handlePurchase}
                disabled={entitlement.isLoading}
                data-testid="button-subscribe"
              >
                {entitlement.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Subscribe Now"
                )}
              </Button>
              <Button 
                variant="ghost" 
                className="w-full text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => setLocation("/")}
                data-testid="button-maybe-later"
              >
                Maybe Later
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-4 max-w-xs">
          <div className="space-y-1 text-[10px] text-white/40 leading-relaxed">
            <p>
              <strong>Auto-renewing subscription.</strong> Cancel anytime.
            </p>
            <p>
              Payment will be charged to your App Store or Google Play account at confirmation of purchase. Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px]">
            <button 
              onClick={handleRestore}
              disabled={entitlement.isLoading}
              className="text-recipal-orange hover:underline"
              data-testid="link-restore"
            >
              Restore Purchases
            </button>
            <button 
              onClick={() => openLegalDialog('terms')}
              className="text-recipal-orange hover:underline"
              data-testid="link-terms"
            >
              Terms of Service
            </button>
            <button 
              onClick={() => openLegalDialog('privacy')}
              className="text-recipal-orange hover:underline"
              data-testid="link-privacy"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
      
      <Dialog open={legalDialogOpen} onOpenChange={setLegalDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getLegalContent().title}</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground whitespace-pre-wrap">
            {getLegalContent().content}
          </div>
          <DialogFooter>
            <Button onClick={() => setLegalDialogOpen(false)} data-testid="button-close-legal">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
