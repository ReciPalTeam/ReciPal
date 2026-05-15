import { useRef, useState, useCallback } from "react";

export type ExtractStage = "idle" | "transcribing" | "analyzing" | "complete" | "error";

export interface ExtractedRecipeFields {
  title: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  passiveTimeMinutes: number | null;
  servings: number | null;
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { instruction: string; time: string | null; location: string | null }[];
}

const EMPTY_RECIPE: ExtractedRecipeFields = {
  title: null,
  prepTimeMinutes: null,
  cookTimeMinutes: null,
  passiveTimeMinutes: null,
  servings: null,
  ingredients: [],
  steps: [],
};

/**
 * Open a streaming POST to /api/reels/extract-recipe with the video file and parse the SSE
 * response. Fields populate one-by-one onto `recipe` as `event: field` arrives.
 *
 * Returns reactive state for the consumer's UI:
 *   - stage: current pipeline stage ('idle' | 'transcribing' | 'analyzing' | 'complete' | 'error')
 *   - message: human-readable stage message
 *   - recipe: partially-filled (or fully-filled, on complete) recipe object
 *   - transcript: full Whisper transcript on complete
 *   - configError: true if the server rejected because of missing API keys
 *   - start(file), cancel()
 */
export function useExtractRecipe() {
  const [stage, setStage] = useState<ExtractStage>("idle");
  const [message, setMessage] = useState<string>("");
  const [recipe, setRecipe] = useState<ExtractedRecipeFields>(EMPTY_RECIPE);
  const [transcript, setTranscript] = useState<string>("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [configError, setConfigError] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStage("idle");
    setMessage("");
    setRecipe(EMPTY_RECIPE);
    setTranscript("");
    setErrorText(null);
    setConfigError(false);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStage("idle");
  }, []);

  const handleEvent = useCallback((event: string, data: any) => {
    switch (event) {
      case "stage":
        if (data.stage === "transcribing") setStage("transcribing");
        else if (data.stage === "analyzing") setStage("analyzing");
        if (typeof data.message === "string") setMessage(data.message);
        break;
      case "warning":
        if (typeof data.message === "string") setMessage(data.message);
        break;
      case "field":
        setRecipe((prev) => ({ ...prev, [data.name]: data.value }));
        break;
      case "complete":
        if (data.recipe) setRecipe(data.recipe);
        if (typeof data.transcript === "string") setTranscript(data.transcript);
        setStage("complete");
        setMessage("");
        break;
      case "error":
        setErrorText(data.message ?? "Extraction failed");
        setConfigError(Boolean(data.configError));
        setStage("error");
        break;
    }
  }, []);

  const start = useCallback(async (videoFile: File) => {
    reset();
    setStage("transcribing");
    setMessage("Listening to your video…");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const formData = new FormData();
    formData.append("video", videoFile);

    try {
      const res = await fetch("/api/reels/extract-recipe", {
        method: "POST",
        credentials: "include",
        body: formData,
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setErrorText(body.error ?? `HTTP ${res.status}`);
        setStage("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE messages are delimited by double newlines.
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          // Each block may have multiple lines: "event: foo\ndata: {...}"
          let event = "message";
          let dataLine = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
            // Ignore ': ping' heartbeats.
          }
          if (dataLine) {
            try {
              const parsed = JSON.parse(dataLine);
              handleEvent(event, parsed);
            } catch {
              /* malformed event — ignore */
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setErrorText(err?.message ?? "Network error");
      setStage("error");
    } finally {
      abortRef.current = null;
    }
  }, [handleEvent, reset]);

  return { stage, message, recipe, transcript, errorText, configError, start, cancel, reset };
}
