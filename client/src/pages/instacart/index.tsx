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
  displayText: string;
  originalPurchaseQty: number;
  roundingApplied: boolean;
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
  displayText: string;
  originalPurchaseQty: number;
  roundingApplied: boolean;
  pantryCategory: FoodGroup;
  confidence: "high" | "medium" | "low";
  fallbackReason: string | null;
}

const WEIGHED_UNITS = new Set(["oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds", "g", "gram", "grams", "kg", "kilogram", "kilograms"]);
const PRODUCE_COUNTABLE_ROUND_UNITS = new Set(["each", "bunch", "head"]);
const FRESH_HERBS = ["cilantro", "parsley", "dill", "mint", "basil"];
const DAIRY_ALLOWED_UNITS = new Set(["cup", "tablespoon", "teaspoon", "fl_oz", "milliliter", "liter", "gram", "ounce"]);

function applyCountableRounding(qty: number, unit: string, reason: string, roundUnits: Set<string>): { qty: number; reason: string; rounded: boolean } {
  if (roundUnits.has(unit.toLowerCase()) && !Number.isInteger(qty)) {
    return { qty: Math.ceil(qty), reason: `${reason}_rounded_up`, rounded: true };
  }
  return { qty, reason, rounded: false };
}

const MEASUREMENT_OMIT_CATEGORIES = new Set(["Spices & Seasonings"]);

function shouldOmitMeasurement(ingredientName: string, pantryCategory: FoodGroup, recipeUnit: string, originalUnitDisplay: string, confidence: string): boolean {
  if (MEASUREMENT_OMIT_CATEGORIES.has(pantryCategory)) return true;
  if (pantryCategory === "Produce" && (recipeUnit.toLowerCase() === "cup" || originalUnitDisplay.toLowerCase().includes("cup"))) return true;
  if (recipeUnit.toLowerCase() === "serving" || originalUnitDisplay.toLowerCase().includes("serving")) return true;
  if (originalUnitDisplay.includes("(") || originalUnitDisplay.includes(")") || /juice\s+of/i.test(originalUnitDisplay)) return true;
  if (confidence === "low" && !new Set(["each","ounce","pound","gram","kilogram","ml","liter","fl_oz"]).has(recipeUnit.toLowerCase())) return true;
  if (!["each","ounce","pound","gram","kilogram","ml","liter","fl_oz"].includes(recipeUnit.toLowerCase())) return true;
  return false;
}

function decidePurchaseUnitAndQty(
  ingredientName: string,
  pantryCategory: FoodGroup,
  recipeQty: number,
  recipeUnit: string,
  originalUnitDisplay?: string,
  confidence?: string,
): PurchaseDecision {
  const unitLower = recipeUnit.toLowerCase().trim();
  const nameLower = ingredientName.toLowerCase();
  const omitMeasurement = shouldOmitMeasurement(ingredientName, pantryCategory, recipeUnit, originalUnitDisplay || "", confidence || "high");
  const displayText = omitMeasurement ? ingredientName : `${ingredientName} — ${recipeQty} ${recipeUnit}`;

  if (nameLower.includes("spray")) {
    return { purchaseQty: 1, purchaseUnit: "each", purchaseReason: "keyword_override_spray", displayText, originalPurchaseQty: 1, roundingApplied: false };
  }

  if (pantryCategory === "Spices & Seasonings") {
    return { purchaseQty: 1, purchaseUnit: "each", purchaseReason: "spice_container", displayText, originalPurchaseQty: 1, roundingApplied: false };
  }

  if (pantryCategory === "Produce") {
    let pQty: number;
    let pUnit: string;
    let pReason: string;

    if (FRESH_HERBS.some(herb => nameLower.includes(herb))) {
      pQty = 1; pUnit = "bunch"; pReason = "produce_bunch";
    } else if (nameLower.includes("cabbage")) {
      pQty = 1; pUnit = "head"; pReason = "produce_whole_head";
    } else if (unitLower === "each") {
      pQty = recipeQty; pUnit = "each"; pReason = "produce_unit_kept";
    } else {
      pQty = 1; pUnit = "each"; pReason = "produce_default_each";
    }

    const r = applyCountableRounding(pQty, pUnit, pReason, PRODUCE_COUNTABLE_ROUND_UNITS);
    return { purchaseQty: r.qty, purchaseUnit: pUnit, purchaseReason: r.reason, displayText, originalPurchaseQty: pQty, roundingApplied: r.rounded };
  }

  if (pantryCategory === "Meat & Seafood") {
    if (WEIGHED_UNITS.has(unitLower)) {
      return { purchaseQty: recipeQty, purchaseUnit: recipeUnit, purchaseReason: "meat_weighed_unit_kept", displayText, originalPurchaseQty: recipeQty, roundingApplied: false };
    }
    return { purchaseQty: 1, purchaseUnit: "each", purchaseReason: "meat_default_each", displayText, originalPurchaseQty: 1, roundingApplied: false };
  }

  if (pantryCategory === "Dairy & Eggs") {
    if (DAIRY_ALLOWED_UNITS.has(unitLower)) {
      return { purchaseQty: recipeQty, purchaseUnit: recipeUnit, purchaseReason: "dairy_unit_kept", displayText, originalPurchaseQty: recipeQty, roundingApplied: false };
    }
    const dairyQty = 1;
    const r = applyCountableRounding(dairyQty, "each", "dairy_default_each", new Set(["each"]));
    return { purchaseQty: r.qty, purchaseUnit: "each", purchaseReason: r.reason, displayText, originalPurchaseQty: dairyQty, roundingApplied: r.rounded };
  }

  if (unitLower === "each") {
    const origQty = recipeQty;
    if (Number.isInteger(recipeQty)) {
      return { purchaseQty: recipeQty, purchaseUnit: "each", purchaseReason: "packaged_countable_kept", displayText, originalPurchaseQty: origQty, roundingApplied: false };
    }
    return { purchaseQty: Math.ceil(recipeQty), purchaseUnit: "each", purchaseReason: "packaged_countable_kept_rounded_up", displayText, originalPurchaseQty: origQty, roundingApplied: true };
  }

  return { purchaseQty: 1, purchaseUnit: "each", purchaseReason: "packaged_default", displayText, originalPurchaseQty: 1, roundingApplied: false };
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

    const purchase = decidePurchaseUnitAndQty(item.name, pantryCategory, recipeQty, recipeUnit, item.unit, result.confidence);

    unitTrace("instacart_purchase_unit_decided", {
      correlationId,
      ingredientName: item.name,
      pantryCategory,
      recipeQty,
      recipeUnit,
      purchaseQty: purchase.purchaseQty,
      purchaseUnit: purchase.purchaseUnit,
      purchaseReason: purchase.purchaseReason,
      originalPurchaseQty: purchase.originalPurchaseQty,
      finalPurchaseQty: purchase.purchaseQty,
      roundingApplied: purchase.roundingApplied,
      displayText: purchase.displayText,
    });

    return {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      recipeQty,
      recipeUnit,
      purchaseQty: purchase.purchaseQty,
      purchaseUnit: purchase.purchaseUnit,
      purchaseReason: purchase.purchaseReason,
      displayText: purchase.displayText,
      originalPurchaseQty: purchase.originalPurchaseQty,
      roundingApplied: purchase.roundingApplied,
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

  const handleOpenInstacart = async () => {
    console.log('[Instacart] Opening Instacart with cart items:', cart.length);
    setHandoffState('preparing');

    const items = cart.filter(item => !item.isAddon);
    const correlationIds = items
      .map(item => getCorrelationId(item.normalizedName))
      .filter(Boolean) as string[];

    const instacartLineItems = buildInstacartLineItems(items);

    const simplifiedLineItems = instacartLineItems.map(li => ({
      name: li.name,
      recipeQty: li.recipeQty,
      recipeUnit: li.recipeUnit,
      purchaseQty: li.purchaseQty,
      purchaseUnit: li.purchaseUnit,
      purchaseReason: li.purchaseReason,
      displayText: li.displayText,
      qty: li.purchaseQty,
      unit: li.purchaseUnit,
    }));

    unitTrace("instacart_checkout_payload_ready", {
      correlationId: "aggregate",
      correlationIds,
      simplifiedLineItems,
      checkoutMethod: "redirect",
      screen: "/instacart",
    });

    try {
      const response = await fetch("/api/instacart/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "ReciPal Grocery List",
          lineItems: simplifiedLineItems,
          correlationIds,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.productsLinkUrl) {
        unitTrace("instacart_api_response", {
          correlationId: "aggregate",
          correlationIds,
          success: false,
          checkoutMethod: "redirect",
          errorMessage: data.errorMessage || "No URL returned",
          redirectUrlGenerated: false,
        });
        const errMsg = data.errorMessage || "Failed to create Instacart checkout. Please try again.";
        toast({ title: "Checkout failed", description: errMsg, variant: "destructive" });
        setError(errMsg);
        setHandoffState('error');
        return;
      }

      unitTrace("instacart_api_response", {
        correlationId: "aggregate",
        correlationIds,
        success: true,
        checkoutMethod: "redirect",
        redirectUrlGenerated: true,
        productsLinkUrl: data.productsLinkUrl,
      });

      toast({
        title: "Opening Instacart",
        description: "Redirecting to Instacart to complete your purchase.",
      });

      window.location.assign(data.productsLinkUrl);
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
      toast({ title: "Connection error", description: "Failed to connect to Instacart. Please try again.", variant: "destructive" });
      setError('Failed to connect to Instacart. Please try again.');
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
