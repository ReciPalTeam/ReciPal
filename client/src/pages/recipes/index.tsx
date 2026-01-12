import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, SlidersHorizontal, Heart, Clock, Users, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { mockRecipes, Recipe } from "@/lib/mock-data";
import { useLocation } from "wouter";

export default function RecipesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("for-you");
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setLocation] = useLocation();

  const filteredRecipes = mockRecipes.filter((recipe: Recipe) => 
    recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background p-4 space-y-4 border-b">
        <div className="flex items-center gap-2">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-filter">
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetHeader>
                <SheetTitle>Filter Recipes</SheetTitle>
              </SheetHeader>
              <div className="py-4 space-y-4">
                <p className="text-sm text-muted-foreground">Filter options coming soon...</p>
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="for-you" data-testid="tab-for-you">For You</TabsTrigger>
            <TabsTrigger value="new" data-testid="tab-new">Something New</TabsTrigger>
            <TabsTrigger value="favorites" data-testid="tab-favorites">Favorites</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4">
          {filteredRecipes.map((recipe: Recipe) => (
            <Card 
              key={recipe.id} 
              className="overflow-hidden cursor-pointer"
              onClick={() => setLocation(`/recipe/${recipe.id}`)}
              data-testid={`card-recipe-${recipe.id}`}
            >
              <div className="aspect-square bg-muted relative">
                <img 
                  src={recipe.image} 
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm h-8 w-8"
                  onClick={(e) => { e.stopPropagation(); }}
                  data-testid={`button-favorite-${recipe.id}`}
                >
                  <Heart className="w-4 h-4" />
                </Button>
              </div>
              <CardContent className="p-3 space-y-2">
                <h3 className="font-semibold text-sm line-clamp-2">{recipe.title}</h3>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {recipe.cookTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {recipe.servings}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-primary">{recipe.calories} cal</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" data-testid={`button-add-plan-${recipe.id}`}>
                    <Plus className="w-3 h-3 mr-1" /> Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
