import { readFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Phase H.16 follow-up #2 — fail if the local `ingredient-intel.ts` no longer matches its committed
 * `.ingredient-intel.sha`. Catches drift when someone edits a copy without running
 * `scripts/sync-ingredient-intel.ts`. Repo-agnostic: works from ReciPal `scripts/` and RP2 `script/`.
 * Wired into `npm run check` in both repos.
 *
 * USAGE: node --import tsx scripts/check-ingredient-intel-sync.ts   (exit 0 = in sync, 1 = drift)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAIRS = [
  { file: resolve(__dirname, "../shared/ingredient-intel.ts"), sha: resolve(__dirname, "../shared/.ingredient-intel.sha") },          // ReciPal
  { file: resolve(__dirname, "../server/utils/ingredient-intel.ts"), sha: resolve(__dirname, "../server/utils/.ingredient-intel.sha") }, // RP2
];

const found = PAIRS.find((p) => existsSync(p.file));
if (!found) { console.error("✗ ingredient-intel.ts not found in expected locations."); process.exit(2); }
if (!existsSync(found.sha)) {
  console.error(`✗ Missing checksum ${found.sha} — run scripts/sync-ingredient-intel.ts.`);
  process.exit(2);
}

const actual = createHash("sha256").update(readFileSync(found.file, "utf8")).digest("hex");
const expected = readFileSync(found.sha, "utf8").trim();

if (actual !== expected) {
  console.error("✗ DRIFT: ingredient-intel.ts does not match its committed checksum.");
  console.error("  Edit ONLY ReciPal shared/ingredient-intel.ts, then run scripts/sync-ingredient-intel.ts.");
  console.error(`  expected ${expected}`);
  console.error(`  actual   ${actual}`);
  process.exit(1);
}
console.log("✓ ingredient-intel.ts in sync with checksum.");
