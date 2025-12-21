import { useCart } from "@/hooks/use-plans";
import { Loader2, ShoppingCart, Check, DollarSign, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import clsx from "clsx";
import { useState } from "react";

export default function CartPage() {
  const { data: cart, isLoading } = useCart();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleItem = (name: string) => {
    setCheckedItems(prev => ({ ...prev, [name]: !prev[name] }));
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>;
  if (!cart) return null;

  // Group items by category
  const groupedItems = cart.items.reduce((acc: any, item: any) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const progress = Math.round((completedCount / cart.items.length) * 100) || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in pb-20">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-display font-bold">Grocery List</h1>
           <p className="text-muted-foreground">Generated from your weekly plan</p>
        </div>
        <div className="text-right">
           <div className="text-2xl font-bold font-display text-primary">Est. ${cart.summary.estimatedCost.toFixed(2)}</div>
           <div className="text-sm text-green-600 font-medium flex items-center justify-end gap-1">
             <DollarSign className="w-3 h-3" />
             Save ${cart.summary.potentialSavings.toFixed(2)} with deals
           </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
        <div className="bg-primary h-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>

      {cart.summary.potentialSavings > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
           <div className="p-2 bg-green-100 rounded-full text-green-700">
             <Store className="w-5 h-5" />
           </div>
           <div>
             <h3 className="font-bold text-green-900">Deals Detected!</h3>
             <p className="text-green-800 text-sm">We found matches at your preferred store. Look for the highlighted items below.</p>
           </div>
        </div>
      )}

      <div className="grid gap-6">
        {Object.entries(groupedItems).map(([category, items]: [string, any]) => (
          <Card key={category} className="overflow-hidden border-border/60">
            <div className="bg-muted/50 px-6 py-3 border-b border-border/50 font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              {category}
            </div>
            <div className="divide-y divide-border/30">
              {items.map((item: any) => (
                <div 
                  key={item.name} 
                  className={clsx(
                    "flex items-center justify-between p-4 hover:bg-muted/20 transition-colors",
                    checkedItems[item.name] && "bg-muted/30 opacity-60"
                  )}
                >
                   <div className="flex items-center gap-4">
                     <Checkbox 
                       id={`item-${item.name}`} 
                       checked={checkedItems[item.name] || false}
                       onCheckedChange={() => toggleItem(item.name)}
                       className="w-5 h-5 rounded-md border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                     />
                     <label 
                       htmlFor={`item-${item.name}`} 
                       className={clsx(
                         "font-medium cursor-pointer select-none",
                         checkedItems[item.name] && "line-through text-muted-foreground"
                       )}
                     >
                       {item.name}
                     </label>
                   </div>
                   
                   <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{item.amount} {item.unit}</span>
                      
                      {item.matchedDeal && (
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded text-xs">
                             ${item.matchedDeal.salePrice}
                          </span>
                          <span className="text-xs text-muted-foreground line-through">
                             ${item.matchedDeal.regularPrice}
                          </span>
                        </div>
                      )}
                   </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
