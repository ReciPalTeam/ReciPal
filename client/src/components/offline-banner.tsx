import { useState, useEffect } from "react";
import { WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className }: OfflineBannerProps) {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  if (isOnline || dismissed) {
    return null;
  }

  return (
    <div className={cn(
      "bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-2",
      className
    )}>
      <div className="flex items-center gap-2 flex-1">
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <p className="text-sm">
          You're offline. Some features may be unavailable.
        </p>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 hover:bg-amber-600/20"
        onClick={() => setDismissed(true)}
        data-testid="button-dismiss-offline"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface OfflineScreenProps {
  title?: string;
  message?: string;
}

export function OfflineScreen({ 
  title = "You're offline",
  message = "Connect to the internet to access all features. Your saved data is still available."
}: OfflineScreenProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="text-center space-y-4 max-w-sm">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{message}</p>
        <div className="pt-4 text-xs text-muted-foreground">
          <p>Available offline:</p>
          <ul className="mt-2 space-y-1">
            <li>View saved recipes</li>
            <li>Check your pantry</li>
            <li>See your meal plan</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function OfflineDisabledButton({ 
  children, 
  ...props 
}: React.ComponentProps<typeof Button>) {
  const isOnline = useOnlineStatus();
  
  return (
    <Button 
      {...props} 
      disabled={!isOnline || props.disabled}
      title={!isOnline ? "This action requires an internet connection" : undefined}
    >
      {children}
    </Button>
  );
}
