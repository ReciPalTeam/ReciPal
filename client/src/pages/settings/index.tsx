import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Bell, Shield, FileText, Trash2, Mail, Info, Tag, RefreshCw, CreditCard, LogOut, Loader2, ExternalLink } from "lucide-react";
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

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/profile")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Subscription
            </CardTitle>
            {entitlement.isPro && (
              <p className="text-xs text-muted-foreground">
                Status: {getSubscriptionStatusText(entitlement.status)}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-between" 
              onClick={handleRestorePurchases}
              disabled={entitlement.isLoading}
              data-testid="button-restore-purchases"
            >
              <div className="flex items-center gap-2">
                {entitlement.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span>Restore Purchases</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-between" 
              onClick={handleManageSubscription}
              data-testid="button-manage-subscription"
            >
              <span>Manage Subscription</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="meal-reminders" className="flex-1">
                <div className="font-medium">Meal Reminders</div>
                <div className="text-xs text-muted-foreground">Get notified about planned meals</div>
              </Label>
              <Switch 
                id="meal-reminders"
                checked={notifications.mealReminders}
                onCheckedChange={(checked) => setNotificationPreference('mealReminders', checked)}
                data-testid="switch-meal-reminders"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="grocery-reminders" className="flex-1">
                <div className="font-medium">Grocery Reminders</div>
                <div className="text-xs text-muted-foreground">Remind me to shop for ingredients</div>
              </Label>
              <Switch 
                id="grocery-reminders"
                checked={notifications.groceryReminders}
                onCheckedChange={(checked) => setNotificationPreference('groceryReminders', checked)}
                data-testid="switch-grocery-reminders"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="promo-notifications" className="flex-1">
                <div className="font-medium">Promotional</div>
                <div className="text-xs text-muted-foreground">Tips, offers, and new features</div>
              </Label>
              <Switch 
                id="promo-notifications"
                checked={notifications.promotionalNotifications}
                onCheckedChange={(checked) => setNotificationPreference('promotionalNotifications', checked)}
                data-testid="switch-promo-notifications"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Legal & Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Button 
              variant="ghost" 
              className="w-full justify-between" 
              onClick={() => openLegalDialog('privacy')}
              data-testid="link-privacy"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Privacy Policy</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-between" 
              onClick={() => openLegalDialog('terms')}
              data-testid="link-terms"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Terms of Service</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-between" 
              onClick={() => openLegalDialog('nutrition')}
              data-testid="link-nutrition-disclaimer"
            >
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                <span>Nutrition Disclaimer</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-between" 
              onClick={() => openLegalDialog('affiliate')}
              data-testid="link-affiliate-disclosure"
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <span>Affiliate Disclosure</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-between" 
              onClick={() => window.location.href = `mailto:${SUPPORT_EMAIL}`}
              data-testid="link-support"
            >
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>Contact Support</span>
              </div>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-blue-200/30 bg-blue-50/40 dark:bg-blue-950/20">
          <CardContent className="pt-[24px]">
            <Button 
              className="w-full gap-2 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold" 
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pt-[2px] pb-[2px]">
            <CardTitle className="text-sm font-medium text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              className="w-full gap-2" 
              onClick={() => setDeleteDialogOpen(true)}
              data-testid="button-delete-account"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
          <p>ReciPal v1.0.0 (Build 1)</p>
        </div>
      </div>
      
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
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
        <DialogContent>
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
