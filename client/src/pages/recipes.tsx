
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils } from "lucide-react";

export default function RecipesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-recipal-deep-green">Recipe Discovery</h1>
        <p className="text-muted-foreground">Find your next favorite meal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-recipal-orange" />
              Cook Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Recipes with high pantry overlap will appear here.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Something New</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Explore new cuisines and flavors.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
