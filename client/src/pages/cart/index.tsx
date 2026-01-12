import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Minus, Trash2, ShoppingBag, RefreshCw, Sparkles } from "lucide-react";

type CartItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  sourceRecipes: string[];
};

const mockCartItems: CartItem[] = [
  { id: "1", name: "Chicken Breast", quantity: 2, unit: "lbs", sourceRecipes: ["Grilled Chicken Salad"] },
  { id: "2", name: "Olive Oil", quantity: 1, unit: "bottle", sourceRecipes: ["Grilled Chicken Salad", "Pasta Primavera"] },
  { id: "3", name: "Broccoli", quantity: 2, unit: "heads", sourceRecipes: ["Stir Fry", "Chicken Bowl"] },
];

const buyAgainItems = [
  { id: "ba1", name: "Greek Yogurt", lastPurchased: "2 weeks ago" },
  { id: "ba2", name: "Almond Milk", lastPurchased: "1 week ago" },
  { id: "ba3", name: "Bananas", lastPurchased: "3 days ago" },
];

const addonItems = [
  { id: "ao1", name: "Protein Powder", description: "Popular with your recipes" },
  { id: "ao2", name: "Quinoa", description: "Healthy grain alternative" },
];

export default function CartPage() {
  const [cartItems, setCartItems] = useState(mockCartItems);

  const updateQuantity = (id: string, delta: number) => {
    setCartItems(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    ).filter(item => item.quantity > 0));
  };

  const removeItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-4 h-4 text-recipal-orange" />
            <h2 className="font-bold text-sm">Your Most Popular Buys — Buy Again</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {buyAgainItems.map((item) => (
              <Card key={item.id} className="min-w-[140px] flex-shrink-0" data-testid={`card-buy-again-${item.id}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">{item.lastPurchased}</p>
                  <Button size="sm" variant="outline" className="w-full h-7 text-xs" data-testid={`button-add-${item.id}`}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm">Your Cart</h2>
            </div>
            <span className="text-xs text-muted-foreground">{totalItems} items</span>
          </div>
          
          {cartItems.length > 0 ? (
            <Card>
              <CardContent className="divide-y p-0">
                {cartItems.map((item) => (
                  <div key={item.id} className="p-4 flex items-center gap-3" data-testid={`row-cart-${item.id}`}>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        From: {item.sourceRecipes.join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, -1)}
                        data-testid={`button-decrease-${item.id}`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, 1)}
                        data-testid={`button-increase-${item.id}`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem(item.id)}
                        data-testid={`button-remove-${item.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Your cart is empty</p>
                <p className="text-xs">Add recipes to your plan to populate your cart</p>
              </CardContent>
            </Card>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-recipal-orange" />
            <h2 className="font-bold text-sm">Add-ons</h2>
          </div>
          <div className="space-y-2">
            {addonItems.map((item) => (
              <Card key={item.id} data-testid={`card-addon-${item.id}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.description}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7" data-testid={`button-add-addon-${item.id}`}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      {cartItems.length > 0 && (
        <div className="sticky bottom-16 left-0 right-0 p-4 bg-background border-t">
          <Button className="w-full h-12 bg-recipal-orange hover:bg-recipal-orange/90 font-bold text-base" data-testid="button-checkout">
            <ShoppingBag className="w-5 h-5 mr-2" />
            Checkout with Instacart
          </Button>
        </div>
      )}
    </div>
  );
}
