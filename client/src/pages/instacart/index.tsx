import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ShoppingCart, ExternalLink, Check, Loader2, AlertTriangle, Info } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useDemoStore, getIngredientFoodGroup } from "@/lib/demo-store";
import { unitTrace, getCorrelationId } from "@/utils/unitTrace";
import { canonicalizeForInstacart } from "@/utils/instacartUnitCanonicalizer";
import type { CartItem, FoodGroup } from "@/lib/demo-store";

type HandoffState = 'preparing' | 'ready' | 'error' | 'returned';

interface PurchaseDecision {
  purchaseQty: number;
  purchaseUnit: string;
  purchaseReason: string;
}

interface InstacartLineItem {
  name: string;
  quantity: number;
  unit: string;
  recipeQty: number;
  recipeUnit: string;
  purchaseQty: number;
  purchaseUnit: string;
  purchaseReason: string;
  pantryCategory: FoodGroup;
  confidence: "high" | "medium" | "low";
  fallbackReason: string | null;
}

const WEIGHED_UNITS = new Set(["oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds", "g", "gram", "grams", "kg", "kilogram", "kilograms"]);
const COUNTABLE_UNITS = new Set(["each", "piece", "pieces", "count"]);
const RECIPE_MEASURE_UNITS = new Set(["cup", "cups", "tbsp", "tablespoon", "tablespoons", "tbs", "tsp", "teaspoon", "teaspoons"]);

const COUNT_BASED_UNITS = new Set(["each", "head", "bunch", "package", "jar", "bottle", "can", "box", "bag"]);

const PACKAGED_CATEGORIES: Set<FoodGroup> = new Set([
  "Canned & Jarred",
  "Oils, Sauces & Condiments",
  "Bread & Bakery",
  "Pasta, Rice & Grains",
  "Frozen",
  "Prepared Foods & Deli",
  "Snacks & Nuts",
]);

function decidePurchaseUnit(
  ingredientName: string,
  pantryCategory: FoodGroup,
  recipeQty: number,
  recipeUnit: string,
): PurchaseDecision {
  const unitLower = recipeUnit.toLowerCase().trim();
  const nameLower = ingredientName.toLowerCase();

  if (nameLower.includes("spray")) {
    return { purchaseQty: 1, purchaseUnit: "each", purchaseReason: "keyword_override_spray" };
  }

  if (pantryCategory === "Spices & Seasonings") {
    return { purchaseQty: 1, purchaseUnit: "each", purchaseReason: "spice_container" };
  }

  if (pantryCategory === "Produce") {
    if (nameLower.includes("cabbage")) {
      return { purchaseQty: 1, purchaseUnit: "head", purchaseReason: "produce_whole_head" };
    }
    if (nameLower.includes("cilantro")) {
      return { purchaseQty: 1, purchaseUnit: "bunch", purchaseReason: "produce_bunch" };
    }
    if (RECIPE_MEASURE_UNITS.has(unitLower)) {
      return { purchaseQty: 1, purchaseUnit: "each", purchaseReason: "produce_countable_fallback" };
    }
    return { purchaseQty: recipeQty, purchaseUnit: recipeUnit, purchaseReason: "produce_unit_kept" };
  }

  if (pantryCategory === "Meat & Seafood") {
    if (WEIGHED_UNITS.has(unitLower)) {
      return { purchaseQty: recipeQty, purchaseUnit: recipeUnit, purchaseReason: "meat_weighed_unit_kept" };
    }
    return { purchaseQty: 1, purchaseUnit: "each", purchaseReason: "meat_package_fallback" };
  }

  if (PACKAGED_CATEGORIES.has(pantryCategory)) {
    if (recipeQty > 1 && COUNTABLE_UNITS.has(unitLower)) {
      return { purchaseQty: recipeQty, purchaseUnit: recipeUnit, purchaseReason: "packaged_countable_kept" };
    }
    return { purchaseQty: 1, purchaseUnit: "each", purchaseReason: "packaged_default" };
  }

  if (pantryCategory === "Dairy & Eggs") {
    return { purchaseQty: recipeQty, purchaseUnit: recipeUnit, purchaseReason: "dairy_unit_kept" };
  }

  if (pantryCategory === "Baking & Sweeteners") {
    return { purchaseQty: 1, purchaseUnit: "each", purchaseReason: "baking_container" };
  }

  return { purchaseQty: recipeQty, purchaseUnit: recipeUnit, purchaseReason: "default_unit_kept" };
}

function buildInstacartLineItems(items: CartItem[]): InstacartLineItem[] {
  return items.map(item => {
    const correlationId = getCorrelationId(item.normalizedName) ?? "none";
    const result = canonicalizeForInstacart({
      quantity: item.quantity,
      unitDisplay: item.unit,
      ingredientName: item.name,
      sourceType: "cart",
      correlationId,
    });

    unitTrace("instacart_unit_canonicalized", {
      correlationId,
      ingredientName: item.name,
      originalQuantity: item.quantity,
      originalUnitDisplay: item.unit,
      parsedBaseToken: result.normalizedFromUnitDisplay,
      instacartQuantity: result.instacartQuantity,
      instacartUnit: result.instacartUnit,
      fallbackReason: result.fallbackReason,
      confidence: result.confidence,
    });

    const recipeQty = result.instacartQuantity ?? item.quantity;
    const recipeUnit = result.instacartUnit || item.unit || "each";
    const pantryCategory = getIngredientFoodGroup(item.name);

    const purchase = decidePurchaseUnit(item.name, pantryCategory, recipeQty, recipeUnit);

    const originalPurchaseQty = purchase.purchaseQty;
    let finalPurchaseQty = purchase.purchaseQty;
    let finalPurchaseReason = purchase.purchaseReason;
    let roundingApplied = false;

    if (COUNT_BASED_UNITS.has(purchase.purchaseUnit.toLowerCase())) {
      finalPurchaseQty = Math.ceil(purchase.purchaseQty);
      if (finalPurchaseQty !== originalPurchaseQty) {
        roundingApplied = true;
        finalPurchaseReason = `${purchase.purchaseReason}_rounded_up`;
      }
    }

    unitTrace("instacart_purchase_unit_decided", {
      correlationId,
      ingredientName: item.name,
      pantryCategory,
      recipeQty,
      recipeUnit,
      purchaseQty: finalPurchaseQty,
      purchaseUnit: purchase.purchaseUnit,
      purchaseReason: finalPurchaseReason,
      originalPurchaseQty,
      finalPurchaseQty,
      roundingApplied,
    });

    return {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      recipeQty,
      recipeUnit,
      purchaseQty: finalPurchaseQty,
      purchaseUnit: purchase.purchaseUnit,
      purchaseReason: finalPurchaseReason,
      pantryCategory,
      confidence: result.confidence,
      fallbackReason: result.fallbackReason,
    };
  });
}

export default function InstacartHandoffPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { cart } = useDemoStore();
  
  const [handoffState, setHandoffState] = useState<HandoffState>('preparing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prepareHandoff = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setHandoffState('ready');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        unitTrace("instacart_api_response", {
          correlationId: "aggregate",
          correlationIds: null,
          success: false,
          checkoutMethod: "redirect",
          errorMessage: errorMsg,
          redirectUrlGenerated: false,
        });
        setError('Failed to prepare your cart. Please try again.');
        setHandoffState('error');
      }
    };
    
    prepareHandoff();
  }, []);

  const handleOpenInstacart = () => {
    console.log('[Instacart] Opening Instacart with cart items:', cart.length);

    const items = cart.filter(item => !item.isAddon);
    const correlationIds = items
      .map(item => getCorrelationId(item.normalizedName))
      .filter(Boolean) as string[];

    const instacartLineItems = buildInstacartLineItems(items);

    unitTrace("instacart_checkout_payload_ready", {
      correlationId: "aggregate",
      correlationIds,
      simplifiedLineItems: instacartLineItems.map(li => ({
        name: li.name,
        recipeQty: li.recipeQty,
        recipeUnit: li.recipeUnit,
        purchaseQty: li.purchaseQty,
        purchaseUnit: li.purchaseUnit,
        purchaseReason: li.purchaseReason,
        qty: li.purchaseQty,
        unit: li.purchaseUnit,
      })),
      checkoutMethod: "redirect",
      screen: "/instacart",
      recipeId: null,
    });

    try {
      unitTrace("instacart_api_response", {
        correlationId: "aggregate",
        correlationIds,
        success: true,
        checkoutMethod: "redirect",
        redirectUrlGenerated: true,
      });

      toast({
        title: "Opening Instacart",
        description: "Your items are ready to checkout.",
      });
      setHandoffState('returned');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      unitTrace("instacart_api_response", {
        correlationId: "aggregate",
        correlationIds,
        success: false,
        checkoutMethod: "redirect",
        errorMessage: errorMsg,
        redirectUrlGenerated: false,
      });
      setError('Failed to initiate checkout.');
      setHandoffState('error');
    }
  };

  const handleRetry = () => {
    setError(null);
    setHandoffState('preparing');
    setTimeout(() => setHandoffState('ready'), 1500);
  };

  const handleContinue = () => {
    toast({
      title: "Cart ready",
      description: "Your cart is saved. Continue checkout anytime.",
    });
    setLocation("/cart");
  };

  const cartItems = cart.filter(item => !item.isAddon);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/cart")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Instacart Checkout</h1>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        {handoffState === 'preparing' && (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Preparing Your Cart</h2>
              <p className="text-muted-foreground text-sm">
                Getting {cartItems.length} items ready for Instacart...
              </p>
            </div>
          </>
        )}

        {handoffState === 'error' && (
          <>
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Connection Failed</h2>
              <p className="text-muted-foreground text-sm">
                {error || "We couldn't connect to Instacart. Your cart is saved."}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setLocation("/cart")} data-testid="button-back-to-cart">
                Back to Cart
              </Button>
              <Button onClick={handleRetry} data-testid="button-retry">
                Try Again
              </Button>
            </div>
          </>
        )}

        {handoffState === 'ready' && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
              <ShoppingCart className="h-10 w-10 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Cart Ready</h2>
              <p className="text-muted-foreground text-sm">
                {cartItems.length} items prepared for Instacart
              </p>
            </div>

            <Card className="w-full max-w-sm">
              <CardContent className="p-4 space-y-3 max-h-48 overflow-y-auto">
                {cartItems.slice(0, 8).map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">{item.quantity} {item.unit}</span>
                  </div>
                ))}
                {cartItems.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{cartItems.length - 8} more items
                  </p>
                )}
              </CardContent>
            </Card>

            <Button 
              className="w-full max-w-sm bg-[#43b02a] hover:bg-[#3a9a24] h-12 gap-2"
              onClick={handleOpenInstacart}
              data-testid="button-open-instacart"
            >
              <ExternalLink className="h-4 w-4" />
              Open Instacart
            </Button>
            
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              You'll be redirected to Instacart to complete your purchase. 
              Prices and availability may vary.
            </p>
          </>
        )}

        {handoffState === 'returned' && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Welcome Back!</h2>
              <p className="text-muted-foreground text-sm">
                Your cart is saved. Continue checkout anytime.
              </p>
            </div>
            <Button onClick={handleContinue} className="w-full max-w-sm" data-testid="button-continue">
              Back to Cart
            </Button>
          </>
        )}
      </div>
      
      <div className="p-4 border-t">
        <div className="flex items-start gap-2 text-[10px] text-muted-foreground max-w-sm mx-auto">
          <Info className="h-4 w-4 flex-shrink-0" />
          <p>
            ReciPal may earn a commission from qualifying Instacart purchases. 
            This doesn't affect the price you pay.
          </p>
        </div>
      </div>
    </div>
  );
}
