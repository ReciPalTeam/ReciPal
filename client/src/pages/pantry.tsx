
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Box, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PantryPage() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-recipal-deep-green">My Pantry</h1>
          <p className="text-muted-foreground">Manage your ingredients and track freshness</p>
        </div>
        <Button className="bg-recipal-orange hover:bg-recipal-orange/90">
          <Plus className="w-4 h-4 mr-2" /> Add Ingredients
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Likely Have</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground italic">Items recently added or long-lasting.</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-amber-600">Might Run Out</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground italic">Items that might be getting low.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-destructive">Probably Gone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground italic">Items likely consumed or expired.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
