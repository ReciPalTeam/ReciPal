import { useState } from "react";
import { useCart } from "@/hooks/use-plans";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShoppingCart, Check, HelpCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function GroceryPage() {
  const { data: cart, isLoading } = useCart();
  const [includeMightHave, setIncludeMightHave] = useState(true);
  const [showInstacartModal, setShowInstacartModal] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cart || cart.items?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <ShoppingCart className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-display font-bold">No Groceries Yet</h2>
        <p className="text-muted-foreground max-w-md">
          Add recipes to your weekly plan to generate a consolidated grocery list.
        </p>
      </div>
    );
  }

  const checkoutItems = [
    ...cart.need,
    ...(includeMightHave ? cart.mightHave : [])
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-recipal-deep-green">Grocery List</h1>
          <p className="text-muted-foreground">
            {cart.summary?.totalItems} ingredients from your weekly plan
          </p>
        </div>
        <Button 
          className="bg-recipal-orange hover:bg-recipal-orange/90"
          onClick={() => setShowInstacartModal(true)}
          data-testid="button-checkout-instacart"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Checkout with Instacart
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GrocerySection
          title="You Have"
          subtitle="Already in your pantry"
          items={cart.have || []}
          icon={<Check className="w-4 h-4 text-recipal-deep-green" />}
          color="text-recipal-deep-green"
          bgColor="bg-recipal-deep-green/5"
        />

        <GrocerySection
          title="Might Run Out"
          subtitle="Check before shopping"
          items={cart.mightHave || []}
          icon={<HelpCircle className="w-4 h-4 text-amber-600" />}
          color="text-amber-600"
          bgColor="bg-amber-50 dark:bg-amber-900/10"
          action={
            <div className="flex items-center gap-2 text-xs">
              <Checkbox 
                id="include-might" 
                checked={includeMightHave} 
                onCheckedChange={(v) => setIncludeMightHave(!!v)}
                data-testid="checkbox-include-might-have"
              />
              <label htmlFor="include-might" className="cursor-pointer">Include in checkout</label>
            </div>
          }
        />

        <GrocerySection
          title="Need to Buy"
          subtitle="Not in your pantry"
          items={cart.need || []}
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
          color="text-destructive"
          bgColor="bg-destructive/5"
        />
      </div>

      <Card className="bg-recipal-deep-green text-white border-none">
        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold">Ready to shop?</h3>
            <p className="text-sm opacity-80">
              {checkoutItems.length} items to checkout • Potential savings: ${cart.summary?.potentialSavings?.toFixed(2) || '0.00'}
            </p>
          </div>
          <Button 
            variant="secondary" 
            className="bg-white text-recipal-deep-green hover:bg-white/90"
            onClick={() => setShowInstacartModal(true)}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Instacart
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showInstacartModal} onOpenChange={setShowInstacartModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Instacart Integration</DialogTitle>
            <DialogDescription>Coming soon to ReciPal</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Your Shopping List ({checkoutItems.length} items)</h4>
              <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
                {checkoutItems.map((item, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">{item.amount} {item.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Soon you'll be able to send this list directly to Instacart for easy checkout and delivery.
              </p>
              <Badge variant="outline" className="text-recipal-orange border-recipal-orange">
                Coming Soon
              </Badge>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GrocerySection({ title, subtitle, items, icon, color, bgColor, action }: any) {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader className={`${bgColor} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className={`text-sm font-bold uppercase tracking-wider ${color}`}>
              {title}
            </CardTitle>
          </div>
          <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
        </div>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
        {action}
      </CardHeader>
      <CardContent className="p-4 space-y-2 max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No items</p>
        ) : (
          items.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">{item.category}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {item.amount} {item.unit}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
