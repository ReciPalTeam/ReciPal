import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, ShoppingBag, RefreshCw, Sparkles, ExternalLink } from "lucide-react";
import { useDemoStore, ADDON_ITEMS } from "@/lib/demo-store";
import { mockRecipes } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useOnlineStatus } from "@/components/offline-banner";

export default function CartPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isOnline = useOnlineStatus();
  const { 
    cart, 
    buyAgain, 
    updateCartQuantity, 
    removeFromCart, 
    addBuyAgainToCart,
    addAddonToCart,
    clearCart 
  } = useDemoStore();

  const getRecipeTitles = (recipeIds: string[]) => {
    return recipeIds
      .map(id => mockRecipes.find(r => r.id === id)?.title)
      .filter(Boolean)
      .join(", ");
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const ingredientItems = cart.filter(item => !item.isAddon);
  const addonCartItems = cart.filter(item => item.isAddon);

  const handleCheckout = () => {
    if (!isOnline) {
      toast({
        title: "You're offline",
        description: "Checkout requires an internet connection.",
        variant: "destructive",
      });
      return;
    }
    setLocation("/instacart");
  };

  const handleAddBuyAgain = (itemId: string) => {
    addBuyAgainToCart(itemId);
    toast({
      title: "Added to cart",
      description: "Item added from your favorites",
    });
  };

  const handleAddAddon = (addonId: string) => {
    addAddonToCart(addonId);
    toast({
      title: "Added to cart",
      description: "Add-on item added",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* SECTION 1: Main Cart Items */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm">Your Cart</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{totalItems} items</span>
              {cart.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-destructive"
                  onClick={clearCart}
                  data-testid="button-clear-cart"
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>
          
          {ingredientItems.length > 0 ? (
            <Card>
              <CardContent 
                className="divide-y p-0 max-h-[384px] overflow-y-auto"
                style={{ WebkitOverflowScrolling: 'touch' }}
                data-testid="cart-list-container"
              >
                {ingredientItems.map((item) => (
                  <div key={item.id} className="p-4 flex items-center gap-3" data-testid={`row-cart-${item.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.name}</p>
                      {item.sourceRecipes.length > 0 && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          From: {getRecipeTitles(item.sourceRecipes) || "Manual add"}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">{item.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                        data-testid={`button-decrease-${item.id}`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        data-testid={`button-increase-${item.id}`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeFromCart(item.id)}
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

        {/* SECTION 2: Your Most Popular Buys - Buy Again */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-4 h-4 text-recipal-orange" />
            <h2 className="font-bold text-sm">Your Most Popular Buys — Buy Again</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {buyAgain.map((item) => (
              <Card key={item.id} className="min-w-[140px] flex-shrink-0" data-testid={`card-buy-again-${item.id}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">{item.lastPurchased}</p>
                  <Badge variant="secondary" className="text-[9px]">
                    Bought {item.purchaseCount}x
                  </Badge>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full h-7 text-xs"
                    onClick={() => handleAddBuyAgain(item.id)}
                    data-testid={`button-add-${item.id}`}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* SECTION 3a: Add-ons in Cart */}
        {addonCartItems.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-recipal-orange" />
              <h2 className="font-bold text-sm">Add-ons in Cart</h2>
            </div>
            <Card>
              <CardContent className="divide-y p-0">
                {addonCartItems.map((item) => (
                  <div key={item.id} className="p-4 flex items-center gap-3" data-testid={`row-addon-${item.id}`}>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{item.quantity}x</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeFromCart(item.id)}
                        data-testid={`button-remove-addon-${item.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}

        {/* SECTION 3b: Add-ons (available to add) */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-recipal-orange" />
            <h2 className="font-bold text-sm">Add-ons</h2>
          </div>
          <div className="space-y-2">
            {ADDON_ITEMS.slice(0, 4).map((item) => (
              <Card key={item.id} data-testid={`card-addon-${item.id}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">Household essential</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7"
                    onClick={() => handleAddAddon(item.id)}
                    data-testid={`button-add-addon-${item.id}`}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      {cart.length > 0 && (
        <div className="sticky bottom-16 left-0 right-0 p-4 bg-background border-t">
          <Button 
            className="w-full h-12 bg-recipal-orange hover:bg-recipal-orange/90 font-bold text-base"
            onClick={handleCheckout}
            data-testid="button-checkout"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Checkout with Instacart
          </Button>
        </div>
      )}
    </div>
  );
}
