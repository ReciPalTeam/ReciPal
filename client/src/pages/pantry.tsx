
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Box, Plus, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function PantryPage() {
  const { toast } = useToast();
  const [isAddOpen, setIsOpen] = useState(false);
  const { data: items, isLoading } = useQuery<any[]>({ queryKey: ["/api/pantry"] });

  const addMutation = useMutation({
    mutationFn: async (newItem: any) => {
      const res = await apiRequest("POST", "/api/pantry", newItem);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry"] });
      toast({ title: "Item added to pantry" });
      setIsOpen(false);
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pantry/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pantry"] });
      toast({ title: "Item removed" });
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
        
        <Dialog open={isAddOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-recipal-orange hover:bg-recipal-orange/90">
              <Plus className="w-4 h-4 mr-2" /> Add Ingredient
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Pantry</DialogTitle>
            </DialogHeader>
            <AddIngredientForm onSubmit={(data: any) => addMutation.mutate(data)} isPending={addMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PantrySection title="Likely Have" items={likelyHave} color="text-recipal-deep-green" onConfirm={confirmMutation.mutate} onDelete={deleteMutation.mutate} />
        <PantrySection title="Might Run Out" items={mightRunOut} color="text-amber-600" onConfirm={confirmMutation.mutate} onDelete={deleteMutation.mutate} />
        <PantrySection title="Probably Gone" items={probablyGone} color="text-destructive" onConfirm={confirmMutation.mutate} onDelete={deleteMutation.mutate} />
      </div>
    </div>
  );
}

function AddIngredientForm({ onSubmit, isPending }: any) {
  const form = useForm({
    defaultValues: {
      name: "",
      category: "Produce",
      estimatedDecayDays: "7"
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => onSubmit({ ...data, estimatedDecayDays: parseInt(data.estimatedDecayDays) }))} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ingredient Name</FormLabel>
              <FormControl><Input placeholder="e.g. Spinach, Milk, Eggs" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Produce">Produce</SelectItem>
                    <SelectItem value="Dairy">Dairy</SelectItem>
                    <SelectItem value="Meat">Meat</SelectItem>
                    <SelectItem value="Pantry">Pantry</SelectItem>
                    <SelectItem value="Bakery">Bakery</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="estimatedDecayDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shelf Life (Days)</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full bg-recipal-orange" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Add to Pantry
        </Button>
      </form>
    </Form>
  );
}

function PantrySection({ title, items, color, onConfirm, onDelete }: any) {
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
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)}>
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
