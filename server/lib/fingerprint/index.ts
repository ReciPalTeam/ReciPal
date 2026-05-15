import { ChromaprintProvider } from "./chromaprint-provider";
import { ACRCloudProvider } from "./acrcloud-provider";
import type { FingerprintProvider } from "./types";

export { FINGERPRINT_MATCH_THRESHOLD } from "./types";
export type { FingerprintProvider, FingerprintResult } from "./types";

/**
 * Provider factory. Reads FINGERPRINT_PROVIDER env var; defaults to 'chromaprint'.
 *
 * Swap path (Phase 1 → Phase 2):
 *   FINGERPRINT_PROVIDER=chromaprint   →   FINGERPRINT_PROVIDER=acrcloud
 * No application-code changes needed.
 */
export function getFingerprintProvider(): FingerprintProvider {
  const choice = (process.env.FINGERPRINT_PROVIDER ?? "chromaprint").toLowerCase();
  if (choice === "acrcloud") return new ACRCloudProvider();
  return new ChromaprintProvider();
}
