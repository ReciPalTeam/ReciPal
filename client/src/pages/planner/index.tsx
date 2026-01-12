export default function PlannerPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Your Week</h2>
        <div className="flex bg-muted p-1 rounded-md text-xs">
          <button className="px-3 py-1 bg-white rounded shadow-sm">Card</button>
          <button className="px-3 py-1 text-muted-foreground">List</button>
        </div>
      </div>
      <div className="space-y-3">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
          <div key={day} className="p-4 bg-card border rounded-xl flex justify-between items-center">
            <span className="font-medium">{day}</span>
            <span className="text-sm text-muted-foreground italic">No meals planned</span>
          </div>
        ))}
      </div>
    </div>
  );
}
