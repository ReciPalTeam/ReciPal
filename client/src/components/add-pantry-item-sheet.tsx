import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Minus, X, Loader2, ScanBarcode, Receipt } from "lucide-react";
import { useDemoStore, getIngredientFoodGroup, computeExpirationDate, type FoodGroup } from "@/lib/demo-store";
import { getDefaultPantryUnit, getAlternateUnits, getUnitDef } from "@/lib/pantry-units";
import { isNativeApp } from "@/lib/capacitor-utils";
import { useScanReceipt } from "@/hooks/use-receipt";
import { downscaleImage } from "@/lib/image-downscale";

interface FoodSearchResult {
  food_id: string;
  food_name: string;
  food_type: string;
  food_description: string;
  brand_name?: string;
}

function parseNutritionFromDescription(desc: string): { calories: number; fat: number; carbs: number; protein: number; servingDesc: string } {
  const calories = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] || "0");
  const fatMatch = desc.match(/(?:Total\s+)?Fat:\s*([\d.]+)/i);
  const fat = parseFloat(fatMatch?.[1] || "0");
  const carbsMatch = desc.match(/(?:Carbs|Carbohydrate|Carbohydrates|Total\s+Carb)(?:s)?:\s*([\d.]+)/i);
  const carbs = parseFloat(carbsMatch?.[1] || "0");
  const protein = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1] || "0");
  const servingMatch = desc.match(/^Per\s+(.+?)\s*-/i);
  const servingDesc = servingMatch?.[1] || "1 serving";
  return { calories, fat, carbs, protein, servingDesc };
}

interface PantryItemEntry {
  id: string;
  name: string;
  foodGroup: FoodGroup;
  expirationDate: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: "manual" | "receipt";
}

interface AddPantryItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPantryItemSheet({ open, onOpenChange }: AddPantryItemSheetProps) {
  const { toast } = useToast();
  const { addToPantry, updatePantryExpiration, pantry } = useDemoStore();

  const [items, setItems] = useState<PantryItemEntry[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const scanReceipt = useScanReceipt();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCacheRef = useRef<Map<string, FoodSearchResult[]>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setItems([]);
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    setIsSaving(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const cached = searchCacheRef.current.get(query.toLowerCase());
    if (cached) {
      setSearchResults(cached);
      setShowResults(true);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/fatsecret/foods/search?query=${encodeURIComponent(query)}&max_results=8`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();

      let foods: FoodSearchResult[] = [];
      if (data?.foods?.food) {
        foods = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food];
      }
      searchCacheRef.current.set(query.toLowerCase(), foods);
      setSearchResults(foods);
      setShowResults(true);
    } catch {
      toast({ title: "Search error", description: "Could not search for foods", variant: "destructive" });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => handleSearch(value), 400);
  };

  const addItem = (name: string, nutrition?: { calories: number; protein: number; carbs: number; fat: number }) => {
    const foodGroup = getIngredientFoodGroup(name);
    const now = new Date().toISOString();
    const expirationDate = computeExpirationDate(now, foodGroup);
    const detected = getDefaultPantryUnit(name, foodGroup);

    setItems(prev => [...prev, {
      id: `temp-${Date.now()}-${Math.random()}`,
      name,
      foodGroup,
      expirationDate,
      quantity: detected.min,
      unit: detected.unit,
      calories: nutrition?.calories ?? 0,
      protein: nutrition?.protein ?? 0,
      carbs: nutrition?.carbs ?? 0,
      fat: nutrition?.fat ?? 0,
    }]);
  };

  // Scan a grocery receipt (Phase H.21): downscale → GPT-4o vision → populate the editable list.
  const handleReceiptScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setIsScanning(true);
    try {
      const blob = await downscaleImage(file);
      const result = await scanReceipt.mutateAsync(blob);
      if (!result.items.length) {
        toast({ title: "No items found", description: "Couldn't read products on this receipt — try a clearer photo.", variant: "destructive" });
        return;
      }
      const now = new Date().toISOString();
      const mapped: PantryItemEntry[] = result.items.map((it, idx) => {
        const foodGroup = getIngredientFoodGroup(it.name);
        const detected = getDefaultPantryUnit(it.name, foodGroup);
        const unit = it.unit && it.unit !== "each" ? it.unit : detected.unit;
        return {
          id: `receipt-${Date.now()}-${idx}`,
          name: it.name,
          foodGroup,
          expirationDate: computeExpirationDate(now, foodGroup),
          quantity: it.quantity > 0 ? it.quantity : detected.min,
          unit,
          calories: 0, protein: 0, carbs: 0, fat: 0,
          source: "receipt",
        };
      });
      setItems(prev => [...prev, ...mapped]);
      if (result.confidence === "low") {
        toast({ title: "Receipt was blurry", description: "Double-check the scanned items below before adding." });
      } else {
        toast({ title: `Scanned ${mapped.length} item${mapped.length !== 1 ? "s" : ""}`, description: "Review and edit below, then tap Add Items." });
      }
    } catch (err: any) {
      toast({ title: "Couldn't scan receipt", description: err?.message ?? "Try a clearer photo.", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const addFromSearch = (food: FoodSearchResult) => {
    const displayName = food.brand_name ? `${food.food_name} (${food.brand_name})` : food.food_name;
    const nutrition = parseNutritionFromDescription(food.food_description);
    addItem(displayName, {
      calories: Math.round(nutrition.calories),
      protein: Math.round(nutrition.protein),
      carbs: Math.round(nutrition.carbs),
      fat: Math.round(nutrition.fat),
    });
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItemExpiration = (id: string, date: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, expirationDate: date } : i));
  };

  const updateItemQuantity = (id: string, quantity: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
  };

  const updateItemUnit = (id: string, unit: string) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const def = getUnitDef(unit);
      return { ...i, unit, quantity: Math.max(def.min, i.quantity) };
    }));
  };

  const lookupBarcode = async (digits: string) => {
    try {
      const resp = await fetch(`/api/fatsecret/barcode?barcode=${encodeURIComponent(digits)}`);
      if (!resp.ok) {
        throw new Error('Barcode lookup failed');
      }
      const data = await resp.json();
      const food = data?.food;
      if (!food) {
        toast({ title: "Not found", description: "Couldn't identify this product", variant: "destructive" });
        return;
      }
      const name = food.brand_name ? `${food.food_name} (${food.brand_name})` : food.food_name;
      addItem(name);
      toast({ title: "Item found", description: `${food.food_name} added to list` });
    } catch {
      toast({ title: "Scan failed", description: "Could not look up barcode", variant: "destructive" });
    }
  };

  const handleBarcodeScan = async () => {
    if (isNativeApp()) {
      try {
        const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
        const { barcodes } = await BarcodeScanner.scan();
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          await lookupBarcode(barcodes[0].rawValue);
        } else {
          toast({ title: "No barcode", description: "No barcode detected. Try again?", variant: "destructive" });
        }
      } catch {
        toast({ title: "Scanner error", description: "Scanner failed. Try uploading an image instead.", variant: "destructive" });
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const imgEl = document.createElement('img');
      const url = URL.createObjectURL(file);
      imgEl.src = url;
      await new Promise<void>((res, rej) => { imgEl.onload = () => res(); imgEl.onerror = () => rej(); });
      const result = await reader.decodeFromImageElement(imgEl);
      URL.revokeObjectURL(url);
      const digits = result.getText();

      if (digits) {
        await lookupBarcode(digits);
      } else {
        toast({ title: "No barcode", description: "Could not read barcode from image", variant: "destructive" });
      }
    } catch {
      toast({ title: "Scan failed", description: "Could not read barcode from image", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddItems = () => {
    if (items.length === 0) return;
    setIsSaving(true);

    const pantryBefore = pantry.length;

    for (const item of items) {
      addToPantry({
        name: item.name,
        foodGroup: item.foodGroup,
        state: "have",
        source: item.source ?? "manual",
        quantity: item.quantity,
        unit: item.unit,
      });
    }

    const currentPantry = useDemoStore.getState().pantry;
    const newItems = currentPantry.slice(pantryBefore);

    for (let i = 0; i < items.length && i < newItems.length; i++) {
      const defaultExpiration = computeExpirationDate(newItems[i].assignedAt, newItems[i].foodGroup);
      const userDate = new Date(items[i].expirationDate).toDateString();
      const defaultDate = new Date(defaultExpiration).toDateString();
      if (userDate !== defaultDate) {
        updatePantryExpiration(newItems[i].id, new Date(items[i].expirationDate).toISOString());
      }
    }

    toast({
      title: "Items added",
      description: `${items.length} item${items.length > 1 ? 's' : ''} added to pantry`,
    });
    resetForm();
    onOpenChange(false);
  };

  const formatDateForInput = (isoDate: string) => {
    const d = new Date(isoDate);
    return d.toISOString().split('T')[0];
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[345px] max-h-[85vh] overflow-y-auto p-6"
        overlayClassName="bg-black/35 backdrop-blur-md"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.5)', border: 'none' }}
        data-testid="dialog-add-pantry-item"
      >
        {/* P4 Header: Icon + Title + Subtitle */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-[14px] flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1.5px solid #bbf7d0' }}>
            🥫
          </div>
          <div className="flex-1">
            <DialogTitle className="font-display text-[17px] font-bold text-foreground">Add Pantry Item</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">What do you have on hand?</p>
          </div>
        </div>

        {/* Search Section */}
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Search</p>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search foods (e.g., chicken, rice)"
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className="h-10 text-sm pl-9 pr-4 rounded-xl bg-[#f1f5f9] border-[#e2e8f0] focus:bg-white focus:border-green-500"
              data-testid="input-pantry-search"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {isSearching && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {showResults && searchResults.length > 0 && (
            <div className="border rounded-xl mt-1.5 max-h-48 overflow-y-auto bg-background shadow-md" style={{ contain: 'layout' }}>
              {searchResults.map((food) => {
                const nutrition = parseNutritionFromDescription(food.food_description);
                return (
                  <button
                    key={food.food_id}
                    onClick={() => addFromSearch(food)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b last:border-b-0"
                    style={{ minHeight: '48px' }}
                    data-testid={`pantry-search-result-${food.food_id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{food.food_name}</p>
                        {food.brand_name && (
                          <p className="text-[10px] text-muted-foreground truncate">{food.brand_name}</p>
                        )}
                      </div>
                      <Plus className="w-4 h-4 text-green-600 flex-shrink-0" />
                    </div>
                    <p className="text-[10px] mt-0.5">
                      {!/^100\s*g$/i.test(nutrition.servingDesc) && <><span className="text-muted-foreground">{nutrition.servingDesc}</span> <span className="text-muted-foreground">&middot;</span> </>}
                      <span className="text-recipal-orange font-medium">P: {Math.round(nutrition.protein)}g</span>
                      <span className="text-muted-foreground"> &middot; </span>
                      <span className="text-green-600 font-medium">C: {Math.round(nutrition.carbs)}g</span>
                      <span className="text-muted-foreground"> &middot; </span>
                      <span className="text-blue-600 font-medium">F: {Math.round(nutrition.fat)}g</span>
                      <span className="text-muted-foreground"> &middot; </span>
                      <span className="text-yellow-600 font-medium">Cal: {Math.round(nutrition.calories)}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {showResults && searchResults.length === 0 && searchQuery && !isSearching && (
            <p className="text-xs text-muted-foreground text-center py-2">No foods found for "{searchQuery}"</p>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[#f1f5f9] my-4" />

        {/* Other ways to add */}
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Other ways to add</p>
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            onClick={handleBarcodeScan}
            className="flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-[14px] bg-[#f8faf9] border-[1.5px] border-[#e2e8f0] hover:border-green-500 hover:bg-[#ecfdf5] transition-all"
            data-testid="button-pantry-barcode"
          >
            <ScanBarcode className="w-6 h-6 text-green-700" />
            <span className="text-xs font-semibold text-foreground">Scan Barcode</span>
          </button>
          <button
            onClick={() => receiptInputRef.current?.click()}
            disabled={isScanning}
            className="flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-[14px] bg-[#f8faf9] border-[1.5px] border-[#e2e8f0] hover:border-green-500 hover:bg-[#ecfdf5] transition-all disabled:opacity-60"
            data-testid="button-scan-receipt"
          >
            {isScanning ? <Loader2 className="w-6 h-6 text-green-700 animate-spin" /> : <Receipt className="w-6 h-6 text-green-700" />}
            <span className="text-xs font-semibold text-foreground">{isScanning ? "Scanning…" : "Scan Receipt"}</span>
          </button>
          <input
            ref={receiptInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleReceiptScan}
            data-testid="input-receipt-file"
          />
        </div>

        {/* Added items list */}
        {items.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Items ({items.length})</p>
            {items.map((item) => {
              const unitDef = getUnitDef(item.unit);
              const fmtQty = item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(item.quantity >= 1 ? 1 : 2);
              return (
                <div
                  key={item.id}
                  className="relative px-3 py-2.5 rounded-xl border bg-muted/30"
                  data-testid={`pantry-item-${item.id}`}
                >
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    data-testid={`remove-pantry-item-${item.id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.foodGroup}</p>
                      {(item.calories > 0 || item.protein > 0 || item.carbs > 0 || item.fat > 0) && (
                        <p className="text-[10px]">
                          <span className="text-recipal-orange font-medium">P: {item.protein}g</span>
                          <span className="text-muted-foreground"> &middot; </span>
                          <span className="text-green-600 font-medium">C: {item.carbs}g</span>
                          <span className="text-muted-foreground"> &middot; </span>
                          <span className="text-blue-600 font-medium">F: {item.fat}g</span>
                          <span className="text-muted-foreground"> &middot; </span>
                          <span className="text-yellow-600 font-medium">Cal: {item.calories}</span>
                        </p>
                      )}
                    </div>
                    <input
                      type="date"
                      value={formatDateForInput(item.expirationDate)}
                      onChange={(e) => {
                        if (e.target.value) {
                          updateItemExpiration(item.id, new Date(e.target.value).toISOString());
                        }
                      }}
                      className="text-xs border rounded px-2 py-1 bg-background w-[120px]"
                      data-testid={`expiration-input-${item.id}`}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => {
                        const newQty = Math.max(unitDef.min, +(item.quantity - unitDef.step).toFixed(2));
                        updateItemQuantity(item.id, newQty);
                      }}
                      disabled={item.quantity <= unitDef.min}
                      data-testid={`button-qty-minus-${item.id}`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-semibold w-10 text-center tabular-nums" data-testid={`text-qty-${item.id}`}>
                      {fmtQty}
                    </span>
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted/80 transition-colors"
                      onClick={() => {
                        const newQty = +(item.quantity + unitDef.step).toFixed(2);
                        updateItemQuantity(item.id, newQty);
                      }}
                      data-testid={`button-qty-plus-${item.id}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <Select value={item.unit} onValueChange={(v) => updateItemUnit(item.id, v)}>
                      <SelectTrigger className="h-7 w-[95px] text-xs" data-testid={`select-unit-${item.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAlternateUnits(item.foodGroup).map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button
          onClick={handleAddItems}
          disabled={items.length === 0 || isSaving}
          className="w-full rounded-[14px] py-3.5 text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(255,99,0,0.3)]"
          style={{ background: 'linear-gradient(135deg, #ff8533, #ff6300)' }}
          data-testid="button-add-pantry-items"
        >
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Add Items
        </Button>
      </DialogContent>
    </Dialog>
  );
}
