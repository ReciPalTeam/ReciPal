import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { 
  Utensils, 
  Calendar, 
  Box, 
  ShoppingCart, 
  User, 
  Menu, 
  Search, 
  Filter, 
  Settings, 
  CreditCard, 
  RefreshCw, 
  LifeBuoy, 
  LogOut,
  Shield,
  FileText,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { useState } from "react";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useUser();
  const { mutate: logout } = useLogout();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user) return <>{children}</>;

  const tabs = [
    { href: "/recipes", label: "Recipes", icon: Utensils },
    { href: "/planner", label: "Planner", icon: Calendar },
    { href: "/pantry", label: "Pantry", icon: Box },
    { href: "/cart", label: "Cart", icon: ShoppingCart },
    { href: "/profile", label: "Profile", icon: User },
  ];

  const showFilter = ["/recipes", "/pantry", "/favorites"].includes(location);
  const showSearch = location === "/recipes";

  const HamburgerMenu = () => (
    <div className="flex flex-col h-full py-6">
      <div className="px-6 mb-6">
        <h2 className="text-xl font-bold text-recipal-deep-green">ReciPal</h2>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => { setLocation("/settings"); setIsMenuOpen(false); }}>
          <Settings className="w-4 h-4" /> Settings
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3 text-recipal-orange" onClick={() => { setLocation("/paywall"); setIsMenuOpen(false); }}>
          <Zap className="w-4 h-4" /> Upgrade to Pro
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => setIsMenuOpen(false)}>
          <RefreshCw className="w-4 h-4" /> Restore Purchases
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => setIsMenuOpen(false)}>
          <CreditCard className="w-4 h-4" /> Manage Subscription
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => setIsMenuOpen(false)}>
          <Bell className="w-4 h-4" /> Notifications
        </Button>
        <div className="my-2 border-t" />
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
          <Shield className="w-4 h-4" /> Privacy Policy
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
          <FileText className="w-4 h-4" /> Terms of Service
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
          <Info className="w-4 h-4" /> Nutrition Disclaimer
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
          <LifeBuoy className="w-4 h-4" /> Contact Support
        </Button>
      </nav>
      <div className="px-4 mt-auto">
        <Button variant="outline" className="w-full justify-start gap-3 text-destructive border-destructive/20" onClick={() => logout()}>
          <LogOut className="w-4 h-4" /> Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {showFilter && (
            <Button variant="ghost" size="icon" className="text-recipal-deep-green">
              <Filter className="w-5 h-5" />
            </Button>
          )}
          {!showFilter && <div className="w-10" />}
        </div>

        <div className="flex-1 flex justify-center">
          {showSearch ? (
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search recipes..." 
                className="w-full bg-muted/50 border-none rounded-full py-1.5 pl-9 pr-4 text-sm focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : (
            <h1 className="text-xl font-bold text-recipal-deep-green font-display">ReciPal</h1>
          )}
        </div>

        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-recipal-deep-green">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 w-72">
            <HamburgerMenu />
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-14 pb-20 overflow-x-hidden">
        <div className="max-w-md mx-auto min-h-full">
          {children}
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t z-40 flex items-center justify-around px-2">
        {tabs.map((tab) => {
          const isActive = location === tab.href || (location === "/" && tab.href === "/recipes");
          return (
            <Link key={tab.href} href={tab.href} className="flex flex-col items-center justify-center gap-1 min-w-[64px]">
              <tab.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
