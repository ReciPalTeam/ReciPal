import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { 
  Utensils, Calendar, DoorOpen, ShoppingCart, User, Menu, Settings, 
  Crown, RefreshCw, Bell, Shield, FileText, Mail, LogOut, X, Sun, Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import logoUrl from "@assets/Recipal_Logo_FILL_1768337767642.png";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { mutate: logout } = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  if (!user) return <>{children}</>;

  const isPro = profile?.subscriptionTier === 'pro';

  const bottomTabs = [
    { href: "/recipes", label: "Recipes", icon: Utensils },
    { href: "/plan", label: "Planner", icon: Calendar },
    { href: "/pantry", label: "Pantry", icon: DoorOpen },
    { href: "/cart", label: "Cart", icon: ShoppingCart },
    { href: "/profile", label: "Profile", icon: User },
  ];

  const hamburgerItems = [
    { label: "Settings", icon: Settings, action: () => setLocation("/settings") },
    { label: "Upgrade to Pro", icon: Crown, action: () => setLocation("/paywall"), hideForPro: true },
    { label: "Restore Purchases", icon: RefreshCw, action: () => {} },
    { label: "Manage Subscription", icon: Settings, action: () => {} },
    { label: "Notification Preferences", icon: Bell, action: () => {} },
    { label: "Privacy Policy", icon: Shield, action: () => window.open('#', '_blank') },
    { label: "Terms of Service", icon: FileText, action: () => window.open('#', '_blank') },
    { label: "Nutrition Disclaimer", icon: FileText, action: () => {} },
    { label: "Affiliate Disclosure", icon: FileText, action: () => {} },
    { label: "Contact Support", icon: Mail, action: () => window.open('mailto:support@recipal.app', '_blank') },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-[#FDFCFB] dark:bg-card border-b h-14 flex items-center justify-start px-4">
        <Link href="/">
          <img src={logoUrl} alt="ReciPal Logo" className="h-[42px] w-auto object-contain cursor-pointer mt-[10px] mb-[10px]" />
        </Link>

        <div className="absolute right-4">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-recipal-deep-green dark:text-foreground hover:bg-recipal-deep-green/5" data-testid="button-hamburger">
                <Menu style={{ width: '31px', height: '31px' }} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col p-2">
                <div className="flex items-center justify-between px-3 h-12 mb-2">
                  <div className="flex items-center gap-3 text-sm font-medium">
                    {theme === 'light' ? <Sun className="w-5 h-5 text-recipal-orange" /> : <Moon className="w-5 h-5 text-blue-400" />}
                    <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
                  </div>
                  <Switch 
                    checked={theme === 'dark'} 
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} 
                    data-testid="switch-theme"
                  />
                </div>
                <hr className="mb-2" />
                {hamburgerItems.map((item) => {
                  if (item.hideForPro && isPro) return null;
                  return (
                    <Button
                      key={item.label}
                      variant="ghost"
                      className="justify-start gap-3 h-12"
                      onClick={() => { item.action(); setMenuOpen(false); }}
                      data-testid={`menu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Button>
                  );
                })}
                <hr className="my-2" />
                <Button
                  variant="ghost"
                  className="justify-start gap-3 h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => { logout(); setMenuOpen(false); }}
                  data-testid="menu-logout"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t h-16 flex items-center justify-around safe-area-pb">
        {bottomTabs.map((tab) => {
          const isActive = location === tab.href || (tab.href === "/recipes" && location === "/");
          return (
            <Link key={tab.href} href={tab.href}>
              <button 
                className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
                data-testid={`tab-${tab.label.toLowerCase()}`}
              >
                <tab.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
