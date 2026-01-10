
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Box, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function PantryPage() {
  const { toast } = useToast();
  const { data: items, isLoading } = useQuery<any[]>({ queryKey: ["/api/pantry"] });

  const addMutation = useMutation({
    mutationFn: async (newItem: any) => {
      const res = await apiRequest("POST", "/api/pantry", newItem);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry"] });
      toast({ title: "Item added to pantry" });
    }
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/pantry/${id}`, { lastConfirmedAt: new Date() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry"] });
      toast({ title: "Freshness updated" });
    }
  });

  const likelyHave = items?.filter(i => i.status === "likely_have") || [];
  const mightRunOut = items?.filter(i => i.status === "might_run_out") || [];
  const probablyGone = items?.filter(i => i.status === "probably_gone") || [];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-recipal-deep-green">My Pantry</h1>
          <p className="text-muted-foreground">Manage your ingredients and track freshness</p>
        </div>
        <Button 
          className="bg-recipal-orange hover:bg-recipal-orange/90"
          onClick={() => addMutation.mutate({ name: "Milk", category: "Dairy", estimatedDecayDays: 7 })}
        >
          <Plus className="w-4 h-4 mr-2" /> Add Mock Item
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PantrySection title="Likely Have" items={likelyHave} color="text-recipal-deep-green" onConfirm={confirmMutation.mutate} />
        <PantrySection title="Might Run Out" items={mightRunOut} color="text-amber-600" onConfirm={confirmMutation.mutate} />
        <PantrySection title="Probably Gone" items={probablyGone} color="text-destructive" onConfirm={confirmMutation.mutate} />
      </div>
    </div>
  );
}

function PantrySection({ title, items, color, onConfirm }: any) {
  return (
    <Card className="border-none shadow-sm bg-card h-fit">
      <CardHeader>
        <CardTitle className={`text-sm font-bold uppercase tracking-wider ${color}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No items here.</p>
        ) : (
          items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-background group">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <div className="w-24 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full ${item.status === 'probably_gone' ? 'bg-destructive' : item.status === 'might_run_out' ? 'bg-amber-400' : 'bg-recipal-orange'}`} 
                    style={ { width: `${(1 - item.decayProgress) * 100}%` } } 
                  />
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onConfirm(item.id)}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
