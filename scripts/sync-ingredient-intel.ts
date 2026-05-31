import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Phase H.16 follow-up #2 — propagate the canonical ingredient-intel module to the RP2 mirror and
 * refresh both `.ingredient-intel.sha` checksums. ReciPal `shared/ingredient-intel.ts` is the
 * SINGLE SOURCE OF TRUTH; the RP2 copy is kept byte-identical so the classifier / defaults /
 * cosmetic-descriptor logic can never drift between the two separately-deployed repos.
 *
 * RP2 location: defaults to a sibling `../Recipe-Pal-2`; override with RP2_DIR=/abs/path.
 *
 * USAGE (run after editing shared/ingredient-intel.ts):
 *   node --import tsx scripts/sync-ingredient-intel.ts
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECIPAL_ROOT = resolve(__dirname, "..");
const RP2_ROOT = process.env.RP2_DIR ? resolve(process.env.RP2_DIR) : resolve(RECIPAL_ROOT, "..", "Recipe-Pal-2");

const SOURCE = resolve(RECIPAL_ROOT, "shared/ingredient-intel.ts");
const MIRROR = resolve(RP2_ROOT, "server/utils/ingredient-intel.ts");
const SHA_RECIPAL = resolve(RECIPAL_ROOT, "shared/.ingredient-intel.sha");
const SHA_RP2 = resolve(RP2_ROOT, "server/utils/.ingredient-intel.sha");

if (!existsSync(SOURCE)) { console.error(`Source not found: ${SOURCE}`); process.exit(2); }
if (!existsSync(RP2_ROOT)) { console.error(`RP2 repo not found: ${RP2_ROOT} (set RP2_DIR)`); process.exit(2); }

const content = readFileSync(SOURCE, "utf8");
const sha = createHash("sha256").update(content).digest("hex");

writeFileSync(MIRROR, content);
writeFileSync(SHA_RECIPAL, sha + "\n");
writeFileSync(SHA_RP2, sha + "\n");

console.log(`✓ Synced ingredient-intel.ts (sha256=${sha})`);
console.log(`  mirror → ${MIRROR}`);
console.log(`  checksums → ${SHA_RECIPAL}`);
console.log(`             ${SHA_RP2}`);
console.log(`  Commit all four files in their respective repos.`);
