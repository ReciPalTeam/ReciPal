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
                  {event.payload.originalQuantity !== undefined && (
                    <div>
                      <span className="text-muted-foreground">original qty:</span>{" "}
                      {String(event.payload.originalQuantity)}
                    </div>
                  )}
                  {Boolean(event.payload.parsedBaseToken) && (
                    <div>
                      <span className="text-muted-foreground">parsed token:</span>{" "}
                      {String(event.payload.parsedBaseToken)}
                    </div>
                  )}
                  {Boolean(event.payload.instacartUnit) && (
                    <div>
                      <span className="text-muted-foreground">instacart unit:</span>{" "}
                      <span className="font-semibold">{String(event.payload.instacartUnit)}</span>
                    </div>
                  )}
                  {Boolean(event.payload.instacartUnitUsed) && !event.payload.instacartUnit && (
                    <div>
                      <span className="text-muted-foreground">instacart unit:</span>{" "}
                      {String(event.payload.instacartUnitUsed)}
                    </div>
                  )}
                  {event.payload.instacartQuantity !== undefined && (
                    <div>
                      <span className="text-muted-foreground">instacart qty:</span>{" "}
                      <span className="font-semibold">{String(event.payload.instacartQuantity)}</span>
                    </div>
                  )}
                  {Boolean(event.payload.confidence) && (
                    <div>
                      <span className="text-muted-foreground">confidence:</span>{" "}
                      <span className={
                        event.payload.confidence === "high" ? "text-green-600 dark:text-green-400" :
                        event.payload.confidence === "medium" ? "text-amber-600 dark:text-amber-400" :
                        "text-red-600 dark:text-red-400"
                      }>
                        {String(event.payload.confidence)}
                      </span>
                    </div>
                  )}
                  {event.payload.unitIsCanonical !== undefined && (
                    <div>
                      <span className="text-muted-foreground">canonical:</span>{" "}
                      <span className={event.payload.unitIsCanonical ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
                        {event.payload.unitIsCanonical ? "yes" : "no"}
                      </span>
                    </div>
                  )}
                  {Boolean(event.payload.canonicalUnitCandidate) && (
                    <div>
                      <span className="text-muted-foreground">candidate:</span>{" "}
                      <span className="font-semibold">{String(event.payload.canonicalUnitCandidate)}</span>
                    </div>
                  )}
                  {Boolean(event.payload.pantryCategory) && (
                    <div>
                      <span className="text-muted-foreground">category:</span>{" "}
                      {String(event.payload.pantryCategory)}
                    </div>
                  )}
                  {event.payload.recipeQty !== undefined && (
                    <div>
                      <span className="text-muted-foreground">recipe:</span>{" "}
                      {String(event.payload.recipeQty)} {String(event.payload.recipeUnit || "")}
                    </div>
                  )}
                  {event.payload.purchaseQty !== undefined && (
                    <div>
                      <span className="text-muted-foreground">purchase:</span>{" "}
                      <span className="font-semibold">{String(event.payload.purchaseQty)} {String(event.payload.purchaseUnit || "")}</span>
                    </div>
                  )}
                  {Boolean(event.payload.purchaseReason) && (
                    <div>
                      <span className="text-muted-foreground">reason:</span>{" "}
                      <span className="text-xs">{String(event.payload.purchaseReason)}</span>
                    </div>
                  )}
                  {Boolean(event.payload.rawUnitData) && (
                    <div>
                      <span className="text-muted-foreground">raw unit:</span>{" "}
                      {String(event.payload.rawUnitData)}
                    </div>
                  )}
                  {event.payload.fallbackApplied !== undefined && (
                    <div>
                      <span className="text-muted-foreground">fallback applied:</span>{" "}
                      <span className={event.payload.fallbackApplied ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-green-600 dark:text-green-400 font-semibold"}>
                        {String(event.payload.fallbackApplied)}
                      </span>
                      {Boolean(event.payload.fallbackUnit) && (
                        <span className="text-muted-foreground"> ({String(event.payload.fallbackUnit)})</span>
                      )}
                    </div>
                  )}
                  {Boolean(event.payload.fallbackReason) && (
                    <div className="text-amber-600 dark:text-amber-400">
                      fallback: {String(event.payload.fallbackReason)}
                    </div>
                  )}
                  {event.payload.success !== undefined && (
                    <div>
                      <span className="text-muted-foreground">success:</span>{" "}
                      <span className={Boolean(event.payload.success) ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        {String(event.payload.success)}
                      </span>
                    </div>
                  )}
                  {Boolean(event.payload.checkoutMethod) && (
                    <div>
                      <span className="text-muted-foreground">method:</span>{" "}
                      {String(event.payload.checkoutMethod)}
                    </div>
                  )}
                  {event.payload.redirectUrlGenerated !== undefined && (
                    <div>
                      <span className="text-muted-foreground">redirect generated:</span>{" "}
                      <span className={Boolean(event.payload.redirectUrlGenerated) ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        {String(event.payload.redirectUrlGenerated)}
                      </span>
                    </div>
                  )}
                  {Array.isArray(event.payload.simplifiedLineItems) && (
                    <div>
                      <span className="text-muted-foreground">line items ({(event.payload.simplifiedLineItems as any[]).length}):</span>
                      <div className="ml-2 mt-1 space-y-0.5">
                        {(event.payload.simplifiedLineItems as any[]).slice(0, 5).map((li: any, j: number) => (
                          <div key={j} className="font-mono text-[10px]">
                            {li.name}: {li.qty} {li.unit}
                            {li.recipeUnit && li.recipeUnit !== li.unit && (
                              <span className="text-muted-foreground ml-1">(recipe: {li.recipeQty} {li.recipeUnit})</span>
                            )}
                          </div>
                        ))}
                        {(event.payload.simplifiedLineItems as any[]).length > 5 && (
                          <div className="text-muted-foreground text-[10px]">
                            +{(event.payload.simplifiedLineItems as any[]).length - 5} more
                          </div>
                        )}
                      </div>
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
                  {event.payload.ok !== undefined && event.payload.success === undefined && (
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
