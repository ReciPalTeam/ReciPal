import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Bell, Shield, FileText, Trash2, Mail, Info, Tag, RefreshCw, CreditCard, LogOut, Loader2, ExternalLink, ShoppingCart, Megaphone } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEntitlements, PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_EMAIL, getSubscriptionStatusText } from "@/lib/entitlements";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const {
    entitlement,
    notifications,
    restorePurchases,
    openManageSubscription,
    setNotificationPreference,
    deleteAccount,
    logout
  } = useEntitlements();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [manageSubDialogOpen, setManageSubDialogOpen] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [legalDialogType, setLegalDialogType] = useState<'privacy' | 'terms' | 'nutrition' | 'affiliate'>('privacy');

  const handleRestorePurchases = async () => {
    const success = await restorePurchases();
    if (success) {
      toast({
        title: "Purchases restored",
        description: "Your Pro subscription has been restored.",
      });
    } else {
      toast({
        title: "No purchases found",
        description: "We couldn't find any previous purchases to restore.",
        variant: "destructive",
      });
    }
  };

  const handleManageSubscription = () => {
    const isNative = /iPad|iPhone|iPod|Android/.test(navigator.userAgent);
    if (isNative) {
      openManageSubscription();
    } else {
      setManageSubDialogOpen(true);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;

    setIsDeleting(true);
    const success = await deleteAccount();
    setIsDeleting(false);

    if (success) {
      toast({
        title: "Account deleted",
        description: "Your account and data have been permanently deleted.",
      });
      setDeleteDialogOpen(false);
      logout();
      setLocation("/login");
    } else {
      toast({
        title: "Failed to delete account",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
    setLocation("/login");
  };

  const openLegalDialog = (type: 'privacy' | 'terms' | 'nutrition' | 'affiliate') => {
    setLegalDialogType(type);
    setLegalDialogOpen(true);
  };

  const getLegalContent = () => {
    switch (legalDialogType) {
      case 'privacy':
        return {
          title: "Privacy Policy",
          content: "ReciPal respects your privacy. We collect only the data necessary to provide our meal planning services. Your personal information is never sold to third parties. For the full privacy policy, visit: " + PRIVACY_POLICY_URL,
        };
      case 'terms':
        return {
          title: "Terms of Service",
          content: "By using ReciPal, you agree to our terms of service. Subscriptions auto-renew unless canceled at least 24 hours before the end of the current period. For full terms, visit: " + TERMS_URL,
        };
      case 'nutrition':
        return {
          title: "Nutrition Disclaimer",
          content: "Nutrition information provided by ReciPal is estimated and for informational purposes only. This is not medical advice. Always consult with a healthcare professional before making dietary changes, especially if you have health conditions or allergies.",
        };
      case 'affiliate':
        return {
          title: "Affiliate Disclosure",
          content: "ReciPal may earn commissions from qualifying purchases made through links to partner services, including Instacart. This does not affect the price you pay. We only recommend products and services we believe will benefit our users.",
        };
    }
  };

  const IconBox = ({ children, color }: { children: React.ReactNode; color: string }) => (
    <div className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center text-white flex-shrink-0" style={{ background: color }}>
      {children}
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: '#f2f2f7' }}>
      <div className="p-4 pb-2">
        <button
          onClick={() => setLocation("/profile")}
          className="flex items-center gap-1 text-[#ff6300] text-sm font-medium mb-1"
          data-testid="button-back"
        >
          <ChevronLeft className="h-4 w-4" />
          Profile
        </button>
        <h1 className="text-[32px] font-extrabold text-foreground leading-tight">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-6">
        {/* Account Section */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-1.5">Account</p>
          <div className="bg-white dark:bg-card rounded-xl overflow-hidden">
            <button
              onClick={handleManageSubscription}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea] dark:border-border"
              data-testid="button-manage-subscription"
            >
              <div className="flex items-center gap-3">
                <IconBox color="#ff9500"><CreditCard className="h-4 w-4" /></IconBox>
                <span className="text-[15px]">Subscription</span>
              </div>
              <div className="flex items-center gap-1.5">
                {entitlement.isPro && (
                  <span className="text-sm text-muted-foreground">{getSubscriptionStatusText(entitlement.status)}</span>
                )}
                <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
              </div>
            </button>
            <button
              onClick={handleRestorePurchases}
              disabled={entitlement.isLoading}
              className="w-full flex items-center justify-between px-4 py-3"
              data-testid="button-restore-purchases"
            >
              <div className="flex items-center gap-3">
                <IconBox color="#af52de">
                  {entitlement.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </IconBox>
                <span className="text-[15px]">Restore Purchases</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
            </button>
          </div>
        </div>

        {/* Notifications Section */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-1.5">Notifications</p>
          <div className="bg-white dark:bg-card rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea] dark:border-border">
              <div className="flex items-center gap-3">
                <IconBox color="#34c759"><Bell className="h-4 w-4" /></IconBox>
                <div>
                  <span className="text-[15px]">Meal Reminders</span>
                </div>
              </div>
              <Switch
                checked={notifications.mealReminders}
                onCheckedChange={(checked) => setNotificationPreference('mealReminders', checked)}
                data-testid="switch-meal-reminders"
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea] dark:border-border">
              <div className="flex items-center gap-3">
                <IconBox color="#5ac8fa"><ShoppingCart className="h-4 w-4" /></IconBox>
                <div>
                  <span className="text-[15px]">Grocery Reminders</span>
                </div>
              </div>
              <Switch
                checked={notifications.groceryReminders}
                onCheckedChange={(checked) => setNotificationPreference('groceryReminders', checked)}
                data-testid="switch-grocery-reminders"
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <IconBox color="#8e8e93"><Megaphone className="h-4 w-4" /></IconBox>
                <div>
                  <span className="text-[15px]">Promotional</span>
                </div>
              </div>
              <Switch
                checked={notifications.promotionalNotifications}
                onCheckedChange={(checked) => setNotificationPreference('promotionalNotifications', checked)}
                data-testid="switch-promo-notifications"
              />
            </div>
          </div>
        </div>

        {/* Legal Section */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-1.5">Legal</p>
          <div className="bg-white dark:bg-card rounded-xl overflow-hidden">
            <button
              onClick={() => openLegalDialog('privacy')}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea] dark:border-border"
              data-testid="link-privacy"
            >
              <div className="flex items-center gap-3">
                <IconBox color="#007aff"><Shield className="h-4 w-4" /></IconBox>
                <span className="text-[15px]">Privacy Policy</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
            </button>
            <button
              onClick={() => openLegalDialog('terms')}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea] dark:border-border"
              data-testid="link-terms"
            >
              <div className="flex items-center gap-3">
                <IconBox color="#007aff"><FileText className="h-4 w-4" /></IconBox>
                <span className="text-[15px]">Terms of Service</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
            </button>
            <button
              onClick={() => openLegalDialog('nutrition')}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea] dark:border-border"
              data-testid="link-nutrition-disclaimer"
            >
              <div className="flex items-center gap-3">
                <IconBox color="#8e8e93"><Info className="h-4 w-4" /></IconBox>
                <span className="text-[15px]">Nutrition Disclaimer</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
            </button>
            <button
              onClick={() => openLegalDialog('affiliate')}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea] dark:border-border"
              data-testid="link-affiliate-disclosure"
            >
              <div className="flex items-center gap-3">
                <IconBox color="#ff9500"><Tag className="h-4 w-4" /></IconBox>
                <span className="text-[15px]">Affiliate Disclosure</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
            </button>
            <button
              onClick={() => window.location.href = `mailto:${SUPPORT_EMAIL}`}
              className="w-full flex items-center justify-between px-4 py-3"
              data-testid="link-support"
            >
              <div className="flex items-center gap-3">
                <IconBox color="#34c759"><Mail className="h-4 w-4" /></IconBox>
                <span className="text-[15px]">Contact Support</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
            </button>
          </div>
        </div>

        {/* Log Out */}
        <div className="bg-white dark:bg-card rounded-xl overflow-hidden">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center py-3.5"
            data-testid="button-logout"
          >
            <span className="text-[16px] text-[#ff3b30] font-medium">Log Out</span>
          </button>
        </div>

        {/* Delete Account */}
        <div className="bg-white dark:bg-card rounded-xl overflow-hidden">
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="w-full flex items-center justify-center py-3.5"
            data-testid="button-delete-account"
          >
            <span className="text-[15px] text-[#ff3b30]">Delete Account</span>
          </button>
        </div>

        <div className="text-center pt-2 pb-4">
          <p className="text-xs text-muted-foreground">ReciPal</p>
          <p className="text-[11px] text-muted-foreground/60">Version 1.0.0 (Build 1)</p>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent style={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your account and all associated data including your meal plans, pantry, and preferences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">Type <strong>DELETE</strong> to confirm:</p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              data-testid="input-delete-confirm"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(""); }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "DELETE" || isDeleting}
              onClick={handleDeleteAccount}
              data-testid="button-confirm-delete"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageSubDialogOpen} onOpenChange={setManageSubDialogOpen}>
        <DialogContent style={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>
              Subscription management is available in the installed app.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            <p>When you install ReciPal from the App Store or Google Play, you can manage your subscription directly from the native settings.</p>
            <ul className="mt-4 space-y-2">
              <li><strong>iOS:</strong> Settings → Apple ID → Subscriptions</li>
              <li><strong>Android:</strong> Play Store → Profile → Payments & subscriptions</li>
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setManageSubDialogOpen(false)} data-testid="button-close-manage-sub">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={legalDialogOpen} onOpenChange={setLegalDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto" style={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
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
