import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";

export default function CartPage() {
  return (
    <div className="p-4 space-y-8">
      <section>
        <h3 className="text-sm font-bold text-recipal-deep-green mb-4 uppercase tracking-wider">Most Popular Buys</h3>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[1,2,3].map(i => (
            <div key={i} className="min-w-[120px] aspect-square bg-muted rounded-xl flex items-center justify-center text-xs text-muted-foreground">Item {i}</div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold text-recipal-deep-green mb-4 uppercase tracking-wider">Your Cart</h3>
        <div className="p-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
          <ShoppingBag className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Your cart is empty</p>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold text-recipal-deep-green mb-4 uppercase tracking-wider">Add-ons</h3>
        <div className="grid grid-cols-2 gap-3">
          {[1,2].map(i => (
            <div key={i} className="p-3 bg-card border rounded-xl text-xs flex justify-between items-center">
              <span>Essentials {i}</span>
              <button className="text-recipal-orange font-bold text-lg">+</button>
            </div>
          ))}
        </div>
      </section>

      <Button className="w-full h-14 text-lg font-bold bg-recipal-orange hover:bg-recipal-orange/90">
        Checkout with Instacart
      </Button>
    </div>
  );
}
