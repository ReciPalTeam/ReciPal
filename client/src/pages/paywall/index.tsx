import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
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
      setLocation("/pro-welcome");
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
    <div className="fixed inset-0 flex justify-center" style={{ background: 'linear-gradient(170deg, #ff6300 0%, #ff9500 30%, #ffb347 60%, #fff5e6 100%)' }}>
    <div className="h-full w-full md:max-w-[430px] flex flex-col relative overflow-hidden overflow-y-auto md:shadow-xl">
      {/* Back button */}
      <div className="sticky top-0 z-10 p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/profile")}
          className="text-white/80 hover:bg-white/10 rounded-full"
          data-testid="button-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 px-6 pb-10 flex flex-col items-center justify-center">
        {/* Title */}
        <h1 className="text-[32px] font-extrabold text-white mb-1" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          Go Pro
        </h1>
        <p className="text-[16.8px] text-white/80 mb-8 font-semibold">Unlock the full power of ReciPal</p>

        {/* Frosted white card */}
        <div
          className="w-full max-w-sm rounded-[28px] px-6 py-8"
          style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.08)'
          }}
        >
          {/* Price */}
          <div className="text-center mb-6">
            <span className="text-[48px] font-extrabold text-[#1c1c1e]">$4.99</span>
            <span className="text-[15px] text-[#8e8e93]"> / month</span>
          </div>

          {/* Features */}
          <div className="flex justify-center mb-7">
            <div className="flex flex-col gap-[14px]">
              {features.map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #ff6300, #ff9500)' }}
                  >
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-[15.4px] text-[#1c1c1e] font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subscribe button - dark */}
          <button
            className="w-full py-4 border-none rounded-full bg-[#1c1c1e] text-white text-[17px] font-bold cursor-pointer disabled:opacity-60"
            onClick={handlePurchase}
            disabled={entitlement.isLoading}
            data-testid="button-subscribe"
          >
            {entitlement.isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </span>
            ) : (
              "Subscribe Now"
            )}
          </button>

          {/* Maybe later */}
          <button
            className="w-full py-3 border-none bg-transparent text-[#8e8e93] text-[14px] cursor-pointer"
            onClick={() => setLocation("/profile")}
            data-testid="button-maybe-later"
          >
            Maybe Later
          </button>
        </div>

        {/* Legal footer */}
        <div className="text-center space-y-1 max-w-[300px] mt-6">
          <p className="text-[10px] text-black/70 leading-relaxed">
            <strong>Auto-renewing subscription.</strong> Cancel anytime.
          </p>
          <p className="text-[10px] text-black/55 leading-relaxed">
            Payment will be charged to your App Store or Google Play account at confirmation of purchase. Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
          <button
            onClick={handleRestore}
            disabled={entitlement.isLoading}
            className="text-[10px] text-[#1c1c1e] font-semibold hover:underline bg-transparent border-none cursor-pointer"
            data-testid="link-restore"
          >
            Restore Purchases
          </button>
          <button
            onClick={() => openLegalDialog('terms')}
            className="text-[10px] text-[#1c1c1e] font-semibold hover:underline bg-transparent border-none cursor-pointer"
            data-testid="link-terms"
          >
            Terms of Service
          </button>
          <button
            onClick={() => openLegalDialog('privacy')}
            className="text-[10px] text-[#1c1c1e] font-semibold hover:underline bg-transparent border-none cursor-pointer"
            data-testid="link-privacy"
          >
            Privacy Policy
          </button>
        </div>
      </div>

      <Dialog open={legalDialogOpen} onOpenChange={setLegalDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
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
    </div>
  );
}
