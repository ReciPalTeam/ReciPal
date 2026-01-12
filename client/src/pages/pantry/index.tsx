import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Check, Square, CheckSquare, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type PantryItem = {
  id: string;
  name: string;
  foodGroup: string;
  state: "have" | "might" | "gone";
  quantity?: string;
};

const mockPantryItems: PantryItem[] = [
  { id: "1", name: "Chicken Breast", foodGroup: "Protein", state: "have", quantity: "2 lbs" },
  { id: "2", name: "Brown Rice", foodGroup: "Grains", state: "have", quantity: "1 bag" },
  { id: "3", name: "Broccoli", foodGroup: "Vegetables", state: "might" },
  { id: "4", name: "Eggs", foodGroup: "Protein", state: "have", quantity: "12" },
  { id: "5", name: "Milk", foodGroup: "Dairy", state: "might" },
  { id: "6", name: "Spinach", foodGroup: "Vegetables", state: "gone" },
];

export default function PantryPage() {
  const [activeFilter, setActiveFilter] = useState<"have" | "might" | "gone">("have");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredItems = mockPantryItems.filter(item => item.state === activeFilter);

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

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background p-4 space-y-4 border-b">
        <div className="flex items-center justify-between">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-filter">
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetHeader>
                <SheetTitle>Filter by Food Group</SheetTitle>
              </SheetHeader>
              <div className="py-4 space-y-2">
                {["Protein", "Vegetables", "Grains", "Dairy", "Fruits"].map(group => (
                  <Button key={group} variant="ghost" className="w-full justify-start">
                    {group}
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center gap-2">
            <Button 
              variant={selectMode ? "secondary" : "outline"} 
              size="sm"
              onClick={() => { setSelectMode(!selectMode); clearSelection(); }}
              data-testid="button-select-mode"
            >
              {selectMode ? "Cancel" : "Select"}
            </Button>
            <Button size="sm" className="bg-recipal-orange hover:bg-recipal-orange/90" data-testid="button-add-item">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as typeof activeFilter)} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="have" data-testid="tab-have">Have</TabsTrigger>
            <TabsTrigger value="might" data-testid="tab-might">Might Have</TabsTrigger>
            <TabsTrigger value="gone" data-testid="tab-gone">Gone/Expired</TabsTrigger>
          </TabsList>
        </Tabs>

        {selectMode && selectedItems.length > 0 && (
          <div className="flex items-center justify-between bg-muted p-2 rounded-lg">
            <span className="text-sm">{selectedItems.length} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} data-testid="button-select-all">Select All</Button>
              <Button variant="destructive" size="sm" data-testid="button-delete-selected">
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className={`cursor-pointer transition-colors ${selectedItems.includes(item.id) ? 'ring-2 ring-primary' : ''}`}
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
                    {item.quantity && <span>• {item.quantity}</span>}
                  </div>
                </div>
                {!selectMode && (
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    item.state === 'have' ? 'bg-green-100 text-green-700' :
                    item.state === 'might' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {item.state === 'have' ? 'In Stock' : item.state === 'might' ? 'Check' : 'Expired'}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No items in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
