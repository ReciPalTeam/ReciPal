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
import React, { useState, useEffect } from "react";
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
      <header className="sticky top-0 z-50 bg-[#FDFCFB] dark:bg-card border-b h-14 flex items-center justify-start px-4">
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

      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-card border-t h-16 flex items-center safe-area-pb">
        {bottomTabs.map((tab, idx) => {
          const isActive = location === tab.href || (tab.href === "/recipes" && location === "/");
          const isCartTab = tab.href === "/cart";
          return (
            <React.Fragment key={tab.href}>
              <Link href={tab.href} className="flex-1">
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
                <div className="flex items-center justify-center px-1 -mt-6">
                  <button
                    onClick={() => setForkMenuOpen(true)}
                    className="w-14 h-14 rounded-full bg-recipal-orange flex items-center justify-center shadow-lg"
                    data-testid="button-add-entry"
                  >
                    <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <Sheet open={forkMenuOpen} onOpenChange={setForkMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center">What would you like to add?</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setForkMenuOpen(false); setManualEntryOpen(true); }}
              className="w-full py-4 px-6 rounded-xl text-white font-bold text-base bg-gradient-to-b from-[#FF7B1A] to-[#FF6300] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_12px_rgba(255,99,0,0.3)] border-t border-white/20 hover:opacity-90 transition-opacity"
              data-testid="button-fork-meal"
            >
              Add Meal/Recipe
            </button>
            <button
              onClick={() => { setForkMenuOpen(false); setAddPantrySheetOpen(true); }}
              className="w-full py-4 px-6 rounded-xl text-white font-bold text-base bg-gradient-to-b from-[#34D058] to-[#22C55E] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_12px_rgba(34,197,94,0.3)] border-t border-white/20 hover:opacity-90 transition-opacity"
              data-testid="button-fork-pantry"
            >
              Add to Pantry
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <ManualEntrySheet open={manualEntryOpen} onOpenChange={setManualEntryOpen} />
      <ScanBarcodeSheet open={barcodeSheetOpen} onOpenChange={setBarcodeSheetOpen} />
      <AddPantryItemSheet open={addPantrySheetOpen} onOpenChange={setAddPantrySheetOpen} />
    </div>
  );
}
