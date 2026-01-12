export default function RecipesPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <button className="flex-1 py-1.5 text-sm font-medium bg-white rounded-md shadow-sm">For You</button>
        <button className="flex-1 py-1.5 text-sm font-medium text-muted-foreground">Something New</button>
        <button className="flex-1 py-1.5 text-sm font-medium text-muted-foreground">Favorites</button>
      </div>
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Recommended for You</h2>
        <div className="grid grid-cols-1 gap-4">
          <div className="aspect-video bg-muted rounded-xl animate-pulse" />
          <div className="aspect-video bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
