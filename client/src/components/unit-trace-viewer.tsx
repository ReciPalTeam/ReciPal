import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Copy, Trash2, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  isUnitTraceEnabled,
  getUnitTraceBuffer,
  clearUnitTraceBuffer,
  type TraceEvent,
} from "@/utils/unitTrace";

export function UnitTraceButton() {
  const [open, setOpen] = useState(false);

  if (!isUnitTraceEnabled()) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1 text-xs"
        onClick={() => setOpen(true)}
        data-testid="button-unit-trace"
      >
        <FlaskConical className="w-3 h-3" />
        Unit Trace
      </Button>
      {open && <UnitTracePanel onClose={() => setOpen(false)} />}
    </>
  );
}

function UnitTracePanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [events, setEvents] = useState<TraceEvent[]>([]);

  useEffect(() => {
    setEvents(getUnitTraceBuffer().slice(-50).reverse());
  }, []);

  const refresh = () => {
    setEvents(getUnitTraceBuffer().slice(-50).reverse());
  };

  const handleCopy = () => {
    const json = JSON.stringify(events, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      toast({ title: "Copied", description: "Trace JSON copied to clipboard" });
    });
  };

  const handleClear = () => {
    clearUnitTraceBuffer();
    setEvents([]);
    toast({ title: "Cleared", description: "Trace buffer cleared" });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            <h2 className="font-bold text-sm">Unit Normalization Trace</h2>
            <span className="text-xs text-muted-foreground">({events.length} events)</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={refresh} data-testid="button-trace-refresh">
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-trace-copy">
              <Copy className="w-3 h-3 mr-1" /> Copy JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear} data-testid="button-trace-clear">
              <Trash2 className="w-3 h-3 mr-1" /> Clear Logs
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-trace-close">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {events.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No trace events yet. Add ingredients to cart to start tracing.
            </div>
          ) : (
            <div className="divide-y">
              {events.map((event, i) => (
                <div key={`${event.timestamp}-${i}`} className="p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono font-bold text-primary">
                      {event.eventName}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground font-mono">
                    id: {event.correlationId.slice(0, 8)}...
                  </div>
                  {event.payload.ingredientName && (
                    <div>
                      <span className="text-muted-foreground">ingredient:</span>{" "}
                      {String(event.payload.ingredientName)}
                    </div>
                  )}
                  {event.payload.originalUnitDisplay && (
                    <div>
                      <span className="text-muted-foreground">unit:</span>{" "}
                      {String(event.payload.originalUnitDisplay)}
                    </div>
                  )}
                  {event.payload.instacartUnitUsed && (
                    <div>
                      <span className="text-muted-foreground">instacart unit:</span>{" "}
                      {String(event.payload.instacartUnitUsed)}
                    </div>
                  )}
                  {event.payload.rawUnitData && (
                    <div>
                      <span className="text-muted-foreground">raw unit:</span>{" "}
                      {String(event.payload.rawUnitData)}
                    </div>
                  )}
                  {event.payload.fallbackReason && (
                    <div className="text-amber-600 dark:text-amber-400">
                      fallback: {String(event.payload.fallbackReason)}
                    </div>
                  )}
                  {event.payload.totalItems !== undefined && (
                    <div>
                      <span className="text-muted-foreground">total items:</span>{" "}
                      {String(event.payload.totalItems)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
