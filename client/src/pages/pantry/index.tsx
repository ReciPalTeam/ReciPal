import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Square, CheckSquare, SlidersHorizontal, Check, HelpCircle, X, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDemoStore, FoodGroup, PantryState, getIngredientFoodGroup } from "@/lib/demo-store";
import { useToast } from "@/hooks/use-toast";

const FOOD_GROUPS: FoodGroup[] = [
  "Produce", "Meat & Seafood", "Dairy & Eggs", "Bread & Bakery",
  "Pasta, Rice & Grains", "Canned & Jarred", "Spices & Seasonings",
  "Oils, Sauces & Condiments", "Baking & Sweeteners", "Frozen",
  "Prepared Foods & Deli", "Snacks & Nuts", "Other"
];

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

  const { pantry, addToPantry, updatePantryState, removePantryItems } = useDemoStore();

  const filteredItems = pantry
    .filter(item => item.state === activeFilter)
    .filter(item => selectedFoodGroup === "all" || item.foodGroup === selectedFoodGroup)
    .filter(item => searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedItems(filteredItems.map(i => i.id));
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const handleDelete = () => {
    removePantryItems(selectedItems);
    clearSelection();
    setSelectMode(false);
    toast({
      title: "Items removed",
      description: `${selectedItems.length} items removed from pantry`,
    });
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
    
    addToPantry({
      name: newItemName.trim(),
      foodGroup: newItemGroup,
      state: "have",
      source: "manual",
    });
    
    setNewItemName("");
    setAddDialogOpen(false);
    toast({
      title: "Item added",
      description: `${newItemName} added to pantry`,
    });
  };

  const getCategoryCount = (group: FoodGroup | "all") => {
    if (group === "all") return pantry.filter(i => i.state === activeFilter).length;
    return pantry.filter(i => i.state === activeFilter && i.foodGroup === group).length;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background p-4 space-y-4 border-b">
        <div className="flex items-center gap-2">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                data-testid="button-filter"
                className={selectedFoodGroup !== "all" ? "border-primary" : ""}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  Filter by Food Group
                  {selectedFoodGroup !== "all" && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setSelectedFoodGroup("all"); setFilterOpen(false); }}
                    >
                      Clear
                    </Button>
                  )}
                </SheetTitle>
              </SheetHeader>
              <div className="py-4 space-y-1">
                <Button 
                  variant={selectedFoodGroup === "all" ? "secondary" : "ghost"} 
                  className="w-full justify-between"
                  onClick={() => { setSelectedFoodGroup("all"); setFilterOpen(false); }}
                >
                  <span>All Categories</span>
                  <Badge variant="outline">{getCategoryCount("all")}</Badge>
                </Button>
                {FOOD_GROUPS.map(group => {
                  const count = getCategoryCount(group);
                  return (
                    <Button 
                      key={group} 
                      variant={selectedFoodGroup === group ? "secondary" : "ghost"} 
                      className="w-full justify-between"
                      onClick={() => { setSelectedFoodGroup(group); setFilterOpen(false); }}
                      data-testid={`filter-${group.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <span>{group}</span>
                      <Badge variant="outline">{count}</Badge>
                    </Button>
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
              data-testid="input-search-pantry"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant={selectMode ? "secondary" : "outline"} 
              size="sm"
              onClick={() => { setSelectMode(!selectMode); clearSelection(); }}
              data-testid="button-select-mode"
            >
              {selectMode ? "Cancel" : "Select"}
            </Button>
            <Button 
              size="sm" 
              className="bg-recipal-orange hover:bg-recipal-orange/90"
              onClick={() => setAddDialogOpen(true)}
              data-testid="button-add-item"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        <Tabs value={activeFilter} onValueChange={(v) => { setActiveFilter(v as PantryState); clearSelection(); setSelectMode(false); }} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="have" className="gap-1" data-testid="tab-have">
              <Check className="w-3 h-3" /> Have
            </TabsTrigger>
            <TabsTrigger value="might" className="gap-1" data-testid="tab-might">
              <HelpCircle className="w-3 h-3" /> Maybe
            </TabsTrigger>
            <TabsTrigger value="gone" className="gap-1" data-testid="tab-gone">
              <X className="w-3 h-3" /> Gone
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {selectMode && selectedItems.length > 0 && (
          <div className="flex items-center justify-between bg-muted p-2 rounded-lg">
            <span className="text-sm">{selectedItems.length} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} data-testid="button-select-all">Select All</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} data-testid="button-delete-selected">
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        )}
        
        {selectedFoodGroup !== "all" && (
          <Badge variant="secondary" className="gap-1">
            {selectedFoodGroup}
            <button onClick={() => setSelectedFoodGroup("all")}>
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className={`cursor-pointer transition-colors shadow-md border-0 ${selectedItems.includes(item.id) ? 'ring-2 ring-primary' : ''}`}
              onClick={() => selectMode && toggleSelect(item.id)}
              data-testid={`card-pantry-${item.id}`}
            >
              <CardContent className="p-4 flex items-center gap-3">
                {selectMode && (
                  <div className="text-primary">
                    {selectedItems.includes(item.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{item.foodGroup}</span>
                    <span>•</span>
                    <span>exp. {new Date(item.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>
                {!selectMode && (
                  <div className="flex items-center gap-1">
                    {activeFilter !== "have" && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-7 text-xs text-green-600"
                        onClick={(e) => { e.stopPropagation(); handleStateChange(item.id, "have"); }}
                        data-testid={`button-have-${item.id}`}
                      >
                        <Check className="w-3 h-3 mr-1" /> Have
                      </Button>
                    )}
                    {activeFilter !== "might" && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-7 text-xs text-yellow-600"
                        onClick={(e) => { e.stopPropagation(); handleStateChange(item.id, "might"); }}
                        data-testid={`button-might-${item.id}`}
                      >
                        <HelpCircle className="w-3 h-3 mr-1" /> Maybe
                      </Button>
                    )}
                    {activeFilter !== "gone" && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-7 text-xs text-red-600"
                        onClick={(e) => { e.stopPropagation(); handleStateChange(item.id, "gone"); }}
                        data-testid={`button-gone-${item.id}`}
                      >
                        <X className="w-3 h-3 mr-1" /> Gone
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No items in this category</p>
              <p className="text-xs mt-1">Add items using the + button above</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
                  if (e.target.value) {
                    setNewItemGroup(getIngredientFoodGroup(e.target.value));
                  }
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
