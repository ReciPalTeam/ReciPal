import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, Bell, Shield, FileText, Trash2, Mail, Info, Tag } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-2xl font-bold text-recipal-deep-green">Settings</h1>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-between" data-testid="button-restore-purchases">
            <span>Restore Purchases</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="w-full justify-between" data-testid="button-manage-subscription">
            <span>Manage Subscription</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-between" data-testid="button-notification-prefs">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span>Notification Preferences</span>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Legal & Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="ghost" className="w-full justify-between" data-testid="link-privacy">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Privacy Policy</span>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="w-full justify-between" data-testid="link-terms">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Terms of Service</span>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="w-full justify-between" data-testid="link-nutrition-disclaimer">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <span>Nutrition Disclaimer</span>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="w-full justify-between" data-testid="link-affiliate-disclosure">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span>Affiliate Disclosure</span>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="w-full justify-between" data-testid="link-support">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>Contact Support</span>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="w-full gap-2" data-testid="button-delete-account">
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground pt-4">
        ReciPal v1.0.0
      </div>
    </div>
  );
}
