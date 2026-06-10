import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Square, CheckSquare, SlidersHorizontal, X, Search, ShoppingCart, CalendarDays, AlertTriangle, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useDemoStore, FoodGroup, PantryState, PantryItem, getIngredientFoodGroup } from "@/lib/demo-store";
import { PANTRY_FOOD_GROUPS } from "@/lib/ingredient-categories";
import { useToast } from "@/hooks/use-toast";

/* ─── Category dot colors ─── */
const CATEGORY_DOT: Record<string, string> = {
  "Produce": "#22c55e",
  "Meat & Seafood": "#ef4444",
  "Dairy & Eggs": "#3b82f6",
  "Grains & Bread": "#f59e0b",
  "Canned & Jarred": "#8b5cf6",
  "Frozen": "#06b6d4",
  "Snacks": "#f97316",
  "Beverages": "#a855f7",
  "Condiments & Sauces": "#ec4899",
  "Baking & Spices": "#d97706",
};

/* ─── Expiry helpers ─── */
function getDaysUntilExpiry(expirationDate: string): number {
  const now = new Date();
  const exp = new Date(expirationDate);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expMidnight = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  return Math.round((expMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

function getExpiryChipLabel(expirationDate: string): string {
  const days = getDaysUntilExpiry(expirationDate);
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  if (days === 1) return "1d left";
  if (days <= 7) return `${days}d left`;
  return `${days}d`;
}

type ExpiryStyle = "fresh" | "warn" | "danger" | "long";
function getExpiryChipStyle(expirationDate: string): ExpiryStyle {
  const days = getDaysUntilExpiry(expirationDate);
  if (days < 0) return "danger";
  if (days <= 2) return "warn";
  if (days <= 7) return "fresh";
  if (days > 180) return "long";
  return "fresh";
}

const EXPIRY_COLORS: Record<ExpiryStyle, { bg: string; border: string; text: string; icon: string }> = {
  fresh:  { bg: "#dcfce7", border: "rgba(34,197,94,0.2)",  text: "#16a34a", icon: "#16a34a" },
  warn:   { bg: "#fef3c7", border: "rgba(245,158,11,0.2)", text: "#d97706", icon: "#d97706" },
  danger: { bg: "#fee2e2", border: "rgba(239,68,68,0.2)",  text: "#dc2626", icon: "#dc2626" },
  long:   { bg: "#f5f5f5", border: "rgba(0,0,0,0.05)",     text: "#999",    icon: "#999" },
};

/* ─── ExpirationChip — split design, fixed 80px ─── */
function ExpirationChip({ item, onUpdate }: { item: PantryItem; onUpdate: (id: string, date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    item.expirationDate ? new Date(item.expirationDate) : undefined
  );

  const label = getExpiryChipLabel(item.expirationDate);
  const styleKey = getExpiryChipStyle(item.expirationDate);
  const c = EXPIRY_COLORS[styleKey];

  const handleSave = () => {
    if (selectedDate) {
      onUpdate(item.id, selectedDate.toISOString());
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            borderRadius: 8,
            overflow: "hidden",
            flexShrink: 0,
            cursor: "pointer",
            transition: "all 0.15s",
            border: `1.5px solid ${c.border}`,
            width: 80,
            background: c.bg,
          }}
          onClick={(e) => e.stopPropagation()}
          data-testid={`expiration-chip-${item.id}`}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "4px 4px 4px 8px",
              whiteSpace: "nowrap",
              flex: 1,
              textAlign: "center",
              color: c.text,
            }}
          >
            {label}
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              padding: "4px 2px",
              borderLeft: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <CalendarDays style={{ width: 11, height: 11, color: c.icon }} />
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <p className="text-sm font-medium">Edit Expiration Date</p>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            initialFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Status dropdown colors ─── */
const STATUS_STYLES: Record<PantryState, { bg: string; border: string; text: string; label: string }> = {
  have:  { bg: "#dcfce7", border: "rgba(34,197,94,0.25)",  text: "#16a34a", label: "Have" },
  might: { bg: "#fef3c7", border: "rgba(245,158,11,0.25)", text: "#d97706", label: "Maybe" },
  gone:  { bg: "#fee2e2", border: "rgba(239,68,68,0.25)",  text: "#dc2626", label: "Gone" },
};

const STATUS_DOTS: Record<PantryState, string> = {
  have: "#22c55e",
  might: "#f59e0b",
  gone: "#ef4444",
};

/* ─── StatusDropdown — compact chip with popover menu ─── */
function StatusDropdown({ item, onStateChange }: { item: PantryItem; onStateChange: (id: string, state: PantryState) => void }) {
  const [open, setOpen] = useState(false);
  const s = STATUS_STYLES[item.state];
  const allStates: PantryState[] = ["have", "might", "gone"];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: "4px 6px 4px 8px",
            borderRadius: 8,
            border: `1.5px solid ${s.border}`,
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 700,
            whiteSpace: "nowrap",
            width: 68,
            justifyContent: "space-between",
            background: s.bg,
            color: s.text,
            transition: "all 0.15s",
          }}
          onClick={(e) => e.stopPropagation()}
          data-testid={`status-dropdown-${item.id}`}
        >
          <span>{s.label}</span>
          <ChevronDown
            style={{
              width: 10,
              height: 10,
              flexShrink: 0,
              color: s.text,
              transition: "transform 0.2s",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-auto min-w-[120px]"
        align="end"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "white", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)" }}
      >
        {allStates.map((state) => {
          const isCurrent = state === item.state;
          const st = STATUS_STYLES[state];
          return (
            <button
              key={state}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: isCurrent ? 500 : 600,
                color: isCurrent ? "#999" : "#333",
                background: "none",
                border: "none",
                borderBottom: state !== "gone" ? "1px solid rgba(0,0,0,0.04)" : "none",
                width: "100%",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#f5f5f7"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "none"; }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isCurrent) onStateChange(item.id, state);
                setOpen(false);
              }}
              data-testid={`status-option-${state}-${item.id}`}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: STATUS_DOTS[state] }} />
              <span>{st.label}</span>
              {isCurrent && <span style={{ marginLeft: "auto", fontSize: 11, color: "#22c55e" }}>✓</span>}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

const FOOD_GROUPS: FoodGroup[] = [...PANTRY_FOOD_GROUPS];

/* ─── Main Page ─── */
export default function PantryPage() {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<PantryState>("have");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFoodGroup, setSelectedFoodGroup] = useState<FoodGroup | "all">("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemGroup, setNewItemGroup] = useState<FoodGroup>("Produce");
  const [searchQuery, setSearchQuery] = useState("");

  const { pantry, addToPantry, updatePantryState, updatePantryExpiration, removePantryItems, addToCart, autoUpdatePantryFromExpiration } = useDemoStore();

  useEffect(() => { autoUpdatePantryFromExpiration(); }, []);

  const filteredItems = pantry
    .filter(item => item.state === activeFilter)
    .filter(item => selectedFoodGroup === "all" || item.foodGroup === selectedFoodGroup)
    .filter(item => searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  /* Stat counts */
  const haveCount = pantry.filter(i => i.state === "have").length;
  const maybeCount = pantry.filter(i => i.state === "might").length;
  const goneCount = pantry.filter(i => i.state === "gone").length;

  /* Items expiring within 2 days (have only) */
  const expiringSoon = pantry.filter(i => {
    if (i.state !== "have") return false;
    const days = getDaysUntilExpiry(i.expirationDate);
    return days >= 0 && days <= 2;
  });

  const toggleSelect = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedItems(filteredItems.map(i => i.id));
  const clearSelection = () => setSelectedItems([]);

  const handleDelete = () => {
    removePantryItems(selectedItems);
    clearSelection();
    setSelectMode(false);
    toast({ title: "Items removed", description: `${selectedItems.length} items removed from pantry` });
  };

  const handleStateChange = (id: string, newState: PantryState) => {
    updatePantryState(id, newState);
    toast({
      title: "Status updated",
      description: `Item marked as ${newState === 'have' ? 'in stock' : newState === 'might' ? 'uncertain' : 'gone'}`,
    });
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    addToPantry({ name: newItemName.trim(), foodGroup: newItemGroup, state: "have", source: "manual" });
    setNewItemName("");
    setAddDialogOpen(false);
    toast({ title: "Item added", description: `${newItemName} added to pantry` });
  };

  const getCategoryCount = (group: FoodGroup | "all") => {
    if (group === "all") return pantry.filter(i => i.state === activeFilter).length;
    return pantry.filter(i => i.state === activeFilter && i.foodGroup === group).length;
  };

  /* Glass pill position */
  const pillX = activeFilter === "have" ? "translateX(0%)" : activeFilter === "might" ? "translateX(100%)" : "translateX(200%)";

  return (
    // Transparent root — the body's warm bloom (light peach / dark gunmetal) carries
    // the whole pantry surface; a solid bg here would cut it off mid-page.
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="z-10 p-3 pb-0">
        {/* Search + Filter */}
        <div className="flex items-center gap-2 mb-2">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="button-filter"
                className={`bg-white/90 backdrop-blur-md border border-black/10 rounded-full ${selectedFoodGroup !== "all" ? "ring-2 ring-primary" : ""}`}
              >
                <SlidersHorizontal className="w-4 h-4 text-recipal-deep-green dark:text-foreground" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] overflow-y-auto p-3" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
              <SheetHeader className="px-2 pt-1 pb-2 space-y-0.5 text-left">
                <SheetTitle className="text-[17px] font-extrabold text-recipal-deep-green">Filter by category</SheetTitle>
                <p className="text-xs font-medium text-gray-400">Show only items in one food group</p>
              </SheetHeader>
              <div className="space-y-0.5">
                {[{ key: "all", label: "All Categories" }, ...FOOD_GROUPS.map((g) => ({ key: g, label: g }))].map(({ key, label }) => {
                  const count = getCategoryCount(key);
                  const selected = selectedFoodGroup === key;
                  const empty = count === 0 && key !== "all";
                  return (
                    <button
                      key={key}
                      onClick={() => { setSelectedFoodGroup(key); setFilterOpen(false); }}
                      data-testid={key === "all" ? "filter-all" : `filter-${key.toLowerCase().replace(/\s+/g, "-")}`}
                      className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/50 ${
                        selected
                          ? "bg-green-600/10 dark:bg-green-500/15 text-green-700 dark:text-green-400"
                          : empty
                          ? "text-gray-400 hover:bg-black/[0.03]"
                          : "text-gray-700 hover:bg-black/[0.04]"
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`min-w-[26px] text-center text-[11px] font-bold rounded-full px-2 py-0.5 transition-colors ${
                          selected ? "bg-green-600 text-white" : empty ? "text-gray-300" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search pantry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              style={{ background: "rgba(118,118,128,0.08)", border: "none", borderRadius: 10 }}
              data-testid="input-search-pantry"
            />
          </div>
        </div>

        {/* ── Have/Maybe/Gone — liquid-glass segmented control, same material as the
            Recipes tabs (.rp-sc-subtabs track + .rp-sc-seg-indicator green pill).
            Counts keep their status color when inactive, go white on the pill. ── */}
        <div className="rp-sc-subtabs relative w-full grid grid-cols-3 p-0 h-auto rounded-[9999px] border-0 my-2" data-testid="pantry-status-tabs">
          <div
            className="rp-sc-seg-indicator absolute top-0 bottom-0 left-0 pointer-events-none transition-transform duration-300 ease-out"
            style={{ width: "calc(100% / 3)", transform: pillX }}
          />
          {([
            { key: "have", label: "Have", count: haveCount, color: "#22c55e" },
            { key: "might", label: "Maybe", count: maybeCount, color: "#f59e0b" },
            { key: "gone", label: "Gone", count: goneCount, color: "#ef4444" },
          ] as const).map(({ key, label, count, color }) => {
            const active = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => { setActiveFilter(key); clearSelection(); setSelectMode(false); }}
                className={`relative z-10 rounded-[9999px] flex items-center justify-center gap-1.5 py-2 px-3 text-sm transition-all duration-200 ${
                  active ? "text-white font-semibold" : "text-gray-600/80 dark:text-white/80 font-medium"
                }`}
                data-testid={`tab-${key}`}
              >
                <span className="font-extrabold" style={{ color: active ? "#ffffff" : color }}>{count}</span>
                {label}
              </button>
            );
          })}
        </div>

        {selectedFoodGroup !== "all" && (
          <Badge variant="secondary" className="gap-1 mb-2">
            {selectedFoodGroup}
            <button onClick={() => setSelectedFoodGroup("all")}>
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {/* Alert banner — expiring items */}
        {expiringSoon.length > 0 && activeFilter === "have" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "8px 0 10px",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(245,158,11,0.15)",
              background: "linear-gradient(135deg, #fef3c7, #fde68a)",
            }}
          >
            <AlertTriangle style={{ width: 18, height: 18, color: "#92400e", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                {expiringSoon.length} item{expiringSoon.length > 1 ? "s" : ""} expiring soon
              </div>
              <div style={{ fontSize: 10, color: "#a16207", marginTop: 1 }}>
                {expiringSoon.slice(0, 2).map(i => i.name).join(" · ")}
                {expiringSoon.length > 2 && ` + ${expiringSoon.length - 2} more`}
              </div>
            </div>
          </div>
        )}

        {/* Select mode bar */}
        <div className="flex items-center gap-2 mb-2 px-1">
          <Checkbox
            id="select-mode-checkbox"
            checked={selectMode}
            onCheckedChange={(checked) => { setSelectMode(!!checked); if (!checked) clearSelection(); }}
          />
          <label htmlFor="select-mode-checkbox" className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
            {selectMode ? `Select items (${selectedItems.length} selected)` : "Select"}
          </label>
          {selectMode && selectedItems.length > 0 && (
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-6 text-xs">Select All</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} className="h-6 text-xs">
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            </div>
          )}
        </div>

        {/* Section label */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#6e6e73", textTransform: "uppercase", letterSpacing: 0.3, padding: "0 4px", marginBottom: 6 }}>
          {activeFilter === "have" ? "Have" : activeFilter === "might" ? "Maybe" : "Gone"}
        </div>

        {/* iOS-style white card container */}
        {filteredItems.length > 0 ? (
          <div style={{ background: "white", borderRadius: 12, overflow: "hidden" }}>
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 12px",
                  borderBottom: index < filteredItems.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  transition: "background 0.2s",
                  cursor: selectMode ? "pointer" : "default",
                  background: selectedItems.includes(item.id) ? "#f0f9ff" : "transparent",
                }}
                onClick={() => selectMode && toggleSelect(item.id)}
                data-testid={`card-pantry-${item.id}`}
              >
                {/* Select checkbox */}
                {selectMode && (
                  <div className="text-primary mt-0.5 flex-shrink-0">
                    {selectedItems.includes(item.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </div>
                )}

                {/* Category dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: CATEGORY_DOT[item.foodGroup] || "#999",
                  }}
                />

                {/* Item info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#8e8e93", marginTop: 1 }}>
                    {item.quantity} {item.unit} · {item.foodGroup}
                  </div>
                </div>

                {/* Expiry chip */}
                <ExpirationChip item={item} onUpdate={updatePantryExpiration} />

                {/* Status dropdown + Cart */}
                {!selectMode && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <StatusDropdown item={item} onStateChange={handleStateChange} />
                    <button
                      className="flex items-center gap-1 px-2.5 py-[5px] rounded-full border-none cursor-pointer flex-shrink-0 bg-green-600 text-white text-[10px] font-bold whitespace-nowrap"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart({ name: item.name, quantity: 1, unit: "", sourceRecipes: [] });
                        toast({ title: "Added to cart", description: `${item.name} added to your shopping list` });
                      }}
                      data-testid={`button-add-to-cart-${item.id}`}
                    >
                      <ShoppingCart style={{ width: 12, height: 12 }} /> Cart
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No items in this category</p>
            <p className="text-xs mt-1">No pantry items found</p>
          </div>
        )}

      </div>

      {/* ── Add Item Dialog ── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
          <DialogHeader>
            <DialogTitle>Add Pantry Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Item Name</label>
              <Input
                placeholder="e.g., Chicken Breast"
                value={newItemName}
                onChange={(e) => {
                  setNewItemName(e.target.value);
                  if (e.target.value) setNewItemGroup(getIngredientFoodGroup(e.target.value));
                }}
                data-testid="input-new-item-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Food Group</label>
              <Select value={newItemGroup} onValueChange={(v) => setNewItemGroup(v as FoodGroup)}>
                <SelectTrigger data-testid="select-food-group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOOD_GROUPS.map((group) => (
                    <SelectItem key={group} value={group}>{group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={!newItemName.trim()} data-testid="button-confirm-add">
              <Plus className="w-4 h-4 mr-2" /> Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
