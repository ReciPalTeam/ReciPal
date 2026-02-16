import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
      {open && createPortal(
        <UnitTracePanel onClose={() => setOpen(false)} />,
        document.body
      )}
    </>
  );
}

function UnitTracePanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [traceEnabled, setTraceEnabled] = useState(() => isUnitTraceEnabled());

  useEffect(() => {
    setEvents(getUnitTraceBuffer().slice(-50).reverse());
  }, []);

  const refresh = () => {
    setEvents(getUnitTraceBuffer().slice(-50).reverse());
  };

  const handleToggle = useCallback((checked: boolean) => {
    try {
      localStorage.setItem("debug_unit_trace", checked ? "true" : "false");
    } catch {}
    setTraceEnabled(checked);
  }, []);

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
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <FlaskConical className="w-4 h-4 shrink-0" />
            <h2 className="font-bold text-sm truncate">Unit Trace</h2>
            <span className="text-xs text-muted-foreground shrink-0">({events.length})</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="icon" onClick={refresh} data-testid="button-trace-refresh" title="Refresh">
              <FlaskConical className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleCopy} data-testid="button-trace-copy" title="Copy JSON">
              <Copy className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleClear} data-testid="button-trace-clear" title="Clear Logs">
              <Trash2 className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-trace-close" title="Close">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="trace-toggle" className="text-sm font-semibold cursor-pointer">
              Enable Unit Trace
            </label>
            <span className="text-[11px] text-muted-foreground">
              {traceEnabled ? "Tracing is active — events will be recorded" : "Toggle on to start recording trace events"}
            </span>
          </div>
          <Switch
            id="trace-toggle"
            checked={traceEnabled}
            onCheckedChange={handleToggle}
            data-testid="switch-enable-trace"
          />
        </div>

        <CardContent className="flex-1 overflow-y-auto p-0">
          {events.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No trace events yet. Enable tracing and add ingredients to cart to start.
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
                  {Boolean(event.payload.ingredientName) && (
                    <div>
                      <span className="text-muted-foreground">ingredient:</span>{" "}
                      {String(event.payload.ingredientName)}
                    </div>
                  )}
                  {Boolean(event.payload.originalUnitDisplay) && (
                    <div>
                      <span className="text-muted-foreground">unit:</span>{" "}
                      {String(event.payload.originalUnitDisplay)}
                    </div>
                  )}
                  {Boolean(event.payload.instacartUnitUsed) && (
                    <div>
                      <span className="text-muted-foreground">instacart unit:</span>{" "}
                      {String(event.payload.instacartUnitUsed)}
                    </div>
                  )}
                  {Boolean(event.payload.rawUnitData) && (
                    <div>
                      <span className="text-muted-foreground">raw unit:</span>{" "}
                      {String(event.payload.rawUnitData)}
                    </div>
                  )}
                  {Boolean(event.payload.fallbackReason) && (
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
                  {event.payload.missingCount !== undefined && (
                    <div>
                      <span className="text-muted-foreground">missing:</span>{" "}
                      {String(event.payload.missingCount)}
                    </div>
                  )}
                  {event.payload.itemsCount !== undefined && (
                    <div>
                      <span className="text-muted-foreground">items:</span>{" "}
                      {String(event.payload.itemsCount)}
                    </div>
                  )}
                  {Boolean(event.payload.recipeName) && (
                    <div>
                      <span className="text-muted-foreground">recipe:</span>{" "}
                      {String(event.payload.recipeName)}
                    </div>
                  )}
                  {event.payload.ok !== undefined && (
                    <div>
                      <span className="text-muted-foreground">ok:</span>{" "}
                      <span className={Boolean(event.payload.ok) ? "text-green-600" : "text-red-600"}>
                        {String(event.payload.ok)}
                      </span>
                    </div>
                  )}
                  {Boolean(event.payload.errorMessage) && (
                    <div className="text-red-600 dark:text-red-400">
                      error: {String(event.payload.errorMessage)}
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
