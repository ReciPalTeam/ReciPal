import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, UtensilsCrossed, ShoppingCart, Sparkles, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEntitlements } from "@/lib/entitlements";

export default function NotificationExplainerPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setNotificationPreference } = useEntitlements();

  const handleEnableNotifications = async () => {
    console.log('[Notifications] Requesting permission...');
    
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationPreference('hasRequestedPermission', true);
          toast({
            title: "Notifications enabled",
            description: "You'll receive reminders for meals and groceries.",
          });
        } else {
          toast({
            title: "Notifications disabled",
            description: "You can enable them later in Settings.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.log('[Notifications] Web API not available, simulating for native');
      }
    }
    
    setNotificationPreference('hasRequestedPermission', true);
    setLocation("/settings");
  };

  const handleNotNow = () => {
    setNotificationPreference('hasRequestedPermission', true);
    setLocation("/settings");
  };

  const notificationTypes = [
    {
      icon: UtensilsCrossed,
      title: "Meal Reminders",
      description: "Get reminded when it's time to start cooking your planned meals",
    },
    {
      icon: ShoppingCart,
      title: "Grocery Reminders",
      description: "We'll remind you when you have items waiting in your cart",
    },
    {
      icon: Sparkles,
      title: "Tips & Updates",
      description: "Optional tips, new features, and special offers",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/settings")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-recipal-orange/10 flex items-center justify-center">
            <Bell className="h-10 w-10 text-recipal-orange" />
          </div>
          <h2 className="text-2xl font-bold">Stay on Track</h2>
          <p className="text-muted-foreground max-w-sm">
            Enable notifications to get helpful reminders about your meal plans and grocery shopping.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          {notificationTypes.map((type) => (
            <Card key={type.title}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <type.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">{type.title}</h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="w-full max-w-sm space-y-3 pt-4">
          <Button 
            className="w-full bg-recipal-orange hover:bg-recipal-orange/90 h-12"
            onClick={handleEnableNotifications}
            data-testid="button-enable-notifications"
          >
            Enable Notifications
          </Button>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={handleNotNow}
            data-testid="button-not-now"
          >
            Not Now
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-xs">
          You can change your notification preferences at any time in Settings.
        </p>
      </div>
    </div>
  );
}
