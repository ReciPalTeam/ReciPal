export default function PantryPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button className="px-4 py-1.5 bg-primary text-white rounded-full text-sm whitespace-nowrap">Have</button>
        <button className="px-4 py-1.5 bg-muted rounded-full text-sm whitespace-nowrap">Might Have</button>
        <button className="px-4 py-1.5 bg-muted rounded-full text-sm whitespace-nowrap">Gone</button>
      </div>
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>Showing all items</span>
        <button className="text-primary font-medium">Select All</button>
      </div>
      <div className="space-y-2">
        <div className="p-4 bg-card border rounded-xl text-center text-muted-foreground">
          Pantry is empty
        </div>
      </div>
    </div>
  );
}
