import type { FingerprintProvider, FingerprintResult } from "./types";

/**
 * Phase 2 provider skeleton. Not yet wired to the ACRCloud API.
 * Activating it requires:
 *   1. `npm install acrcloud`
 *   2. Set ACRCLOUD_ACCESS_KEY, ACRCLOUD_ACCESS_SECRET, ACRCLOUD_HOST in .env
 *   3. Implement the body below using the acrcloud npm package
 *   4. Set FINGERPRINT_PROVIDER=acrcloud
 *
 * Nothing else changes — same route, same schema, same response shape.
 * The `reels.fingerprint_provider` column gives us an audit trail across the transition.
 */
export class ACRCloudProvider implements FingerprintProvider {
  readonly name = "acrcloud" as const;

  async identify(_audioBuffer: Buffer): Promise<FingerprintResult> {
    const missing: string[] = [];
    if (!process.env.ACRCLOUD_ACCESS_KEY) missing.push("ACRCLOUD_ACCESS_KEY");
    if (!process.env.ACRCLOUD_ACCESS_SECRET) missing.push("ACRCLOUD_ACCESS_SECRET");
    if (!process.env.ACRCLOUD_HOST) missing.push("ACRCLOUD_HOST");
    if (missing.length > 0) {
      throw new Error(
        `ACRCloud provider requires: ${missing.join(", ")}. Set these in .env to activate Phase 2.`
      );
    }
    throw new Error(
      "ACRCloud provider is not yet implemented. Install `acrcloud` npm package and complete the identify() body."
    );
  }
}
