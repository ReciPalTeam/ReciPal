import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useDemoStore } from "@/lib/demo-store";
import { 
  Utensils, Calendar, DoorOpen, ShoppingCart, User, Menu, Settings, 
  Crown, LogOut, X, Sun, Moon,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import React, { useState, useEffect, useRef } from "react";
import logoUrl from "@assets/Recipal_Logo_FILL_1768337767642.png";
import { ManualEntrySheet } from "@/components/manual-entry-sheet";
import { ScanBarcodeSheet } from "@/components/scan-barcode-sheet";
import { AddPantryItemSheet } from "@/components/add-pantry-item-sheet";
import { UnitTraceButton } from "@/components/unit-trace-viewer";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { mutate: logout } = useLogout();
  const { cart } = useDemoStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [forkMenuOpen, setForkMenuOpen] = useState(false);
  const [addPantrySheetOpen, setAddPantrySheetOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [barcodeSheetOpen, setBarcodeSheetOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const mainRef = useRef<HTMLElement>(null);

  const scrollToTop = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  };

  // Scroll to top on route change, unless entering cook flow
  useEffect(() => {
    const isCookFlow = location.includes('cookMealId') && location.includes('tab=steps');
    if (!isCookFlow) {
      scrollToTop();
    }
  }, [location]);
  
  // Distinct cart item count (each item in cart array is already a distinct line item)
  const cartItemCount = cart.length;

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
  ];

  const hamburgerItems = [
    { label: "Profile", icon: User, action: () => setLocation("/profile") },
    { label: "Settings", icon: Settings, action: () => setLocation("/settings") },
    { label: "Upgrade to Pro", icon: Crown, action: () => setLocation("/paywall"), hideForPro: true },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main ref={mainRef} className="flex-1 pb-20">
        <header className="relative z-50 bg-[#FDFCFB] dark:bg-card border-b h-14 flex items-center justify-start px-4">
          <Link href="/">
            <img src={logoUrl} alt="ReciPal Logo" className="h-[42px] w-auto object-contain cursor-pointer mt-[10px] mb-[10px]" />
          </Link>

          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <UnitTraceButton />
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-recipal-deep-green dark:text-foreground hover:bg-recipal-deep-green/5" data-testid="button-hamburger">
                  <Menu style={{ width: '28px', height: '28px' }} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
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
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-card border-t h-16 flex items-center safe-area-pb">
        {bottomTabs.map((tab, idx) => {
          const isActive = location === tab.href || (tab.href === "/recipes" && location === "/");
          const isCartTab = tab.href === "/cart";
          return (
            <React.Fragment key={tab.href}>
              <Link href={tab.href} className="flex-1" onClick={() => {
                scrollToTop();
                if (isActive) {
                  window.dispatchEvent(new CustomEvent('tab-reselected', { detail: tab.href }));
                }
              }}>
                <button
                  className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  data-testid={`tab-${tab.label.toLowerCase()}`}
                >
                  <div className="relative">
                    <tab.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                    {isCartTab && cartItemCount > 0 && (
                      <span 
                        className="absolute -top-2 -right-2 bg-recipal-orange text-white text-[9px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1"
                        data-testid="cart-badge"
                      >
                        {cartItemCount > 99 ? '99+' : cartItemCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              </Link>
              {idx === 1 && (
                <div className="flex items-center justify-center px-1 -mt-6 relative">
                  <button
                    onClick={() => setForkMenuOpen(!forkMenuOpen)}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(255,99,0,0.35)] transition-all duration-300 z-[61]"
                    style={{ background: forkMenuOpen ? 'linear-gradient(135deg, #e05500, #cc7700)' : 'linear-gradient(135deg, #ff6300, #ff9500)' }}
                    data-testid="button-add-entry"
                  >
                    <Plus className={`w-7 h-7 text-white transition-transform duration-300 ${forkMenuOpen ? 'rotate-45' : ''}`} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Overlay */}
      {forkMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-300"
          onClick={() => setForkMenuOpen(false)}
        />
      )}

      {/* B3 Popover — glass pills above FAB */}
      <div className="fixed bottom-[108px] left-1/2 -translate-x-1/2 z-[55] flex flex-col items-center gap-[10px] pointer-events-none">
        <button
          onClick={() => { setForkMenuOpen(false); setAddPantrySheetOpen(true); }}
          className={`flex items-center gap-3 w-[240px] py-2 pl-2 pr-5 rounded-full bg-white shadow-[0_6px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.04)] cursor-pointer transition-all duration-400 ${
            forkMenuOpen
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto delay-75'
              : 'opacity-0 translate-y-10 scale-[0.3] pointer-events-none'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          data-testid="button-fork-pantry"
        >
          <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-lg flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
            style={{ background: 'linear-gradient(135deg, #34d058, #22c55e)' }}>
            🥫
          </div>
          <span className="text-sm font-bold text-[#15803d]">+ Add Pantry Item</span>
        </button>

        <button
          onClick={() => { setForkMenuOpen(false); setManualEntryOpen(true); }}
          className={`flex items-center gap-3 w-[240px] py-2 pl-2 pr-5 rounded-full bg-white shadow-[0_6px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.04)] cursor-pointer transition-all duration-400 ${
            forkMenuOpen
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 translate-y-10 scale-[0.3] pointer-events-none'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          data-testid="button-fork-meal"
        >
          <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-lg flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
            style={{ background: 'linear-gradient(135deg, #ff7b1a, #ff6300)' }}>
            🍲
          </div>
          <span className="text-sm font-bold text-[#d45400]">+ Add Meal / Recipe</span>
        </button>
      </div>

      <ManualEntrySheet open={manualEntryOpen} onOpenChange={setManualEntryOpen} />
      <ScanBarcodeSheet open={barcodeSheetOpen} onOpenChange={setBarcodeSheetOpen} />
      <AddPantryItemSheet open={addPantrySheetOpen} onOpenChange={setAddPantrySheetOpen} />
    </div>
  );
}
