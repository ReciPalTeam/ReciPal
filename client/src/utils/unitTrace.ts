export interface TraceEvent {
  timestamp: string;
  eventName: string;
  screen: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

const BUFFER_KEY = "unit_trace_buffer";
const MAX_BUFFER_SIZE = 200;

const correlationMap = new Map<string, string>();

let traceBuffer: TraceEvent[] = [];
let bufferLoaded = false;

function loadBuffer(): void {
  if (bufferLoaded) return;
  bufferLoaded = true;
  try {
    const stored = localStorage.getItem(BUFFER_KEY);
    if (stored) {
      traceBuffer = JSON.parse(stored);
    }
  } catch {
    traceBuffer = [];
  }
}

function persistBuffer(): void {
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(traceBuffer));
  } catch {
  }
}

export function isUnitTraceEnabled(): boolean {
  try {
    if (import.meta.env.VITE_DEBUG_UNIT_TRACE === "true") {
      return true;
    }
  } catch {
  }
  try {
    if (localStorage.getItem("debug_unit_trace") === "true") {
      return true;
    }
  } catch {
  }
  return false;
}

export function getOrCreateCorrelationId(ingredientKey: string): string {
  const existing = correlationMap.get(ingredientKey);
  if (existing) return existing;
  const id = crypto.randomUUID();
  correlationMap.set(ingredientKey, id);
  return id;
}

export function getCorrelationId(ingredientKey: string): string | undefined {
  return correlationMap.get(ingredientKey);
}

export function unitTrace(eventName: string, payload: Record<string, unknown>): void {
  if (!isUnitTraceEnabled()) return;

  loadBuffer();

  const event: TraceEvent = {
    timestamp: new Date().toISOString(),
    eventName,
    screen: typeof window !== "undefined" ? window.location.pathname : "unknown",
    correlationId: (payload.correlationId as string) || "none",
    payload,
  };

  traceBuffer.push(event);
  if (traceBuffer.length > MAX_BUFFER_SIZE) {
    traceBuffer = traceBuffer.slice(traceBuffer.length - MAX_BUFFER_SIZE);
  }

  persistBuffer();

  console.log(
    `[UNIT_TRACE] ${eventName}`,
    JSON.stringify(payload, null, 2)
  );
}

export function getUnitTraceBuffer(): TraceEvent[] {
  loadBuffer();
  return [...traceBuffer];
}

export function clearUnitTraceBuffer(): void {
  traceBuffer = [];
  correlationMap.clear();
  bufferLoaded = true;
  try {
    localStorage.removeItem(BUFFER_KEY);
  } catch {
  }
}
