// Shared interface implemented by every fingerprint provider.
// Swapping providers (Phase 1 Chromaprint → Phase 2 ACRCloud) requires only
// changing the FINGERPRINT_PROVIDER env var — no application-code changes.

export interface FingerprintResult {
  matched: boolean;
  confidence: number; // 0-1
  track?: string;
  artist?: string;
  album?: string;
  provider: "chromaprint" | "acrcloud";
  rawResponse?: unknown;
}

export interface FingerprintProvider {
  /** Identify the audio buffer. Buffer is expected to be a WAV (mono, 16kHz). */
  identify(audioBuffer: Buffer): Promise<FingerprintResult>;
  /** Provider name for logging / audit trail on the reels.fingerprint_provider column. */
  name: "chromaprint" | "acrcloud";
}

/** Confidence cutoff used by the upload route to decide flagged vs clean. */
export const FINGERPRINT_MATCH_THRESHOLD = 0.7;
