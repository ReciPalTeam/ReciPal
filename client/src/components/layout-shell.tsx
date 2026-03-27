import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useDemoStore } from "@/lib/demo-store";
import { 
  Utensils, Calendar, DoorOpen, ShoppingCart, User, Menu, Settings, 
  Crown, LogOut, X, Sun, Moon,
  Plus, PenLine, ScanBarcode, Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import React, { useState, useEffect, useRef } from "react";
import logoUrl from "@assets/Recipal_Logo_FILL_1768337767642.png";
import { AppContainerContext } from "@/lib/app-container";
import { ManualEntrySheet } from "@/components/manual-entry-sheet";
import { ScanBarcodeSheet } from "@/components/scan-barcode-sheet";
import { UnitTraceButton } from "@/components/unit-trace-viewer";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { mutate: logout } = useLogout();
  const { cart } = useDemoStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [barcodeSheetOpen, setBarcodeSheetOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainerEl(containerRef.current);
  }, []);
  
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
    <AppContainerContext.Provider value={containerEl}>
    <div className="h-dvh bg-zinc-100 dark:bg-zinc-900 flex justify-center">
    <div ref={containerRef} className="h-full w-full max-w-[430px] bg-background flex flex-col relative overflow-hidden shadow-xl" style={{ transform: "translateZ(0)" }}>
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

      <main className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </main>

      <nav className="shrink-0 bg-white dark:bg-card border-t h-16 flex items-center safe-area-pb z-50">
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
                    onClick={() => setAddMenuOpen(true)}
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

      <Sheet open={addMenuOpen} onOpenChange={setAddMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center">Add Entry</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setAddMenuOpen(false); setManualEntryOpen(true); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted hover-elevate transition-colors"
              data-testid="button-add-manual"
            >
              <div className="w-12 h-12 rounded-full bg-recipal-orange/10 flex items-center justify-center">
                <PenLine className="w-6 h-6 text-recipal-orange" />
              </div>
              <span className="text-sm font-medium">Manual Entry</span>
            </button>
            <button
              onClick={() => { setAddMenuOpen(false); setBarcodeSheetOpen(true); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted hover-elevate transition-colors"
              data-testid="button-add-barcode"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ScanBarcode className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-sm font-medium">Scan Barcode</span>
            </button>
            <button
              onClick={() => { setAddMenuOpen(false); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted hover-elevate transition-colors"
              data-testid="button-add-receipt"
            >
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Receipt className="w-6 h-6 text-green-500" />
              </div>
              <span className="text-sm font-medium">Scan Receipt</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <ManualEntrySheet open={manualEntryOpen} onOpenChange={setManualEntryOpen} />
      <ScanBarcodeSheet open={barcodeSheetOpen} onOpenChange={setBarcodeSheetOpen} />
    </div>
    </div>
    </AppContainerContext.Provider>
  );
}
