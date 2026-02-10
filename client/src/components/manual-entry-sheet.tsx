import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface ManualEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualEntrySheet({ open, onOpenChange }: ManualEntrySheetProps) {
  const { toast } = useToast();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [manualEntry, setManualEntry] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    date: today
  });

  const handleManualAdd = async () => {
    if (!manualEntry.name || !manualEntry.calories) {
      toast({ title: "Error", description: "Name and calories are required", variant: "destructive" });
      return;
    }
    
    try {
      await apiRequest('POST', '/api/consumption-logs', {
        date: manualEntry.date,
        name: manualEntry.name,
        calories: parseInt(manualEntry.calories),
        protein: parseInt(manualEntry.protein) || 0,
        carbs: parseInt(manualEntry.carbs) || 0,
        fat: parseInt(manualEntry.fat) || 0,
        sourceType: 'manual_custom_entry'
      });
      
      setManualEntry({ name: '', calories: '', protein: '', carbs: '', fat: '', date: today });
      toast({ title: "Added", description: "Manual entry added to your log" });
      queryClient.invalidateQueries({ queryKey: ['/api/consumption-logs'] });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to add entry", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center">Manual Entry</SheetTitle>
        </SheetHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              placeholder="e.g., Protein shake"
              value={manualEntry.name}
              onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
              className="h-9 text-sm"
              data-testid="input-manual-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Calories</Label>
              <Input
                type="number"
                placeholder="0"
                value={manualEntry.calories}
                onChange={(e) => setManualEntry({ ...manualEntry, calories: e.target.value })}
                className="h-9 text-sm"
                data-testid="input-manual-calories"
              />
            </div>
            <div>
              <Label className="text-xs">Protein (g)</Label>
              <Input
                type="number"
                placeholder="0"
                value={manualEntry.protein}
                onChange={(e) => setManualEntry({ ...manualEntry, protein: e.target.value })}
                className="h-9 text-sm"
                data-testid="input-manual-protein"
              />
            </div>
            <div>
              <Label className="text-xs">Carbs (g)</Label>
              <Input
                type="number"
                placeholder="0"
                value={manualEntry.carbs}
                onChange={(e) => setManualEntry({ ...manualEntry, carbs: e.target.value })}
                className="h-9 text-sm"
                data-testid="input-manual-carbs"
              />
            </div>
            <div>
              <Label className="text-xs">Fat (g)</Label>
              <Input
                type="number"
                placeholder="0"
                value={manualEntry.fat}
                onChange={(e) => setManualEntry({ ...manualEntry, fat: e.target.value })}
                className="h-9 text-sm"
                data-testid="input-manual-fat"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={manualEntry.date}
              onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
              className="h-9 text-sm"
              data-testid="input-manual-date"
            />
          </div>
          <Button
            onClick={handleManualAdd}
            className="w-full bg-recipal-orange"
            data-testid="button-manual-save"
          >
            Save Entry
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
