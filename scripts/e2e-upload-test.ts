import { chromium, type Page } from "playwright";
import { resolve } from "path";
import { existsSync } from "fs";

// E2E test of the chef upload flow exercised against http://localhost:5002.
// Uses the dev admin bypass (server/routes.ts:378) to authenticate.
// Walks: login → upload video → choose recipe → trim last 2s → add music → Process & upload.

const APP = "http://localhost:5002";
const VIDEO_PATH = "/Users/Michael/Desktop/Claude_Latest_GitHub_Pull/attached_assets/v15044gf0000d22eaf7og65i54c9d3gg.MP4";
const USER = "sellwithdealmate@gmail.com";
const PASS = "admin123";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function logState(page: Page, label: string) {
  const url = page.url();
  const visibleText = await page.locator("body").innerText().then((t) => t.slice(0, 250).replace(/\s+/g, " "));
  console.log(`\n[${label}] url=${url}`);
  console.log(`  body: ${visibleText}…`);
}

async function main(): Promise<void> {
  if (!existsSync(VIDEO_PATH)) {
    console.error(`Test video not found at ${VIDEO_PATH}`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const allConsole: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
    if (m.type() === "log" || m.type() === "info") allConsole.push(`${m.type()}: ${m.text()}`);
    // Capture the chef-upload diagnostic prefix from any level.
    if (m.text().includes("[chef-upload]")) allConsole.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("requestfailed", (req) => failedRequests.push(`${req.url()} — ${req.failure()?.errorText}`));
  page.on("response", (r) => {
    if (r.status() >= 400) failedRequests.push(`HTTP ${r.status()} ${r.url()}`);
  });

  // --- 1. Login ---
  console.log("\n=== 1. Login ===");
  await page.goto(APP, { waitUntil: "networkidle" });
  await sleep(800);
  await page.fill('input[type="email"], input[name="email"]', USER);
  await page.fill('input[type="password"], input[name="password"]', PASS);
  // The button label is "Sign Into ReciPal"; press Enter to submit the form reliably.
  await page.locator('input[type="password"]').press("Enter");
  await page.waitForLoadState("networkidle");
  await sleep(2000);
  await logState(page, "post-login");
  if (page.url().includes("/login")) {
    console.log("  Still on /login — trying button click fallback");
    await page.locator('button:has-text("Sign Into")').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForLoadState("networkidle");
    await sleep(2000);
    await logState(page, "post-login-2");
  }

  // --- 2. Navigate to /chef/upload ---
  console.log("\n=== 2. Open chef upload ===");
  await page.goto(`${APP}/chef/upload`, { waitUntil: "networkidle" });
  await sleep(1500);
  await logState(page, "upload page");

  // --- 3. Upload the test video file ---
  console.log("\n=== 3. Pick video file ===");
  const fileInput = page.locator('[data-testid="input-video-file"]');
  await fileInput.setInputFiles(resolve(VIDEO_PATH));
  await sleep(2000);
  await logState(page, "after file pick");

  // --- 4. choose-recipe step: tap "Pick an existing recipe" or "Generate" depending on what shows. ---
  console.log("\n=== 4. Choose recipe path ===");
  // The RecipeChoiceStep exposes two options. Pick "Generate" to exercise more, but if the
  // OpenAI key is missing we'll get an error fallback — handle both.
  // Quicker: pick "Pick existing" so we don't depend on Whisper/GPT.
  const pickExisting = page.locator('button:has-text("Pick an existing recipe"), button:has-text("Pick existing"), [data-testid="choice-pick-existing"]').first();
  await pickExisting.click({ timeout: 5000 }).catch(() => console.log("  (no pick-existing button found)"));
  await sleep(800);

  // Picker sheet should be open. Click on "My recipes" tab and the first recipe.
  console.log("\n=== 5. Pick first recipe ===");
  await sleep(1500);
  const firstMineRecipe = page.locator('[data-testid^="picker-mine-"]').first();
  const haveMine = (await firstMineRecipe.count()) > 0;
  if (haveMine) {
    await firstMineRecipe.click();
  } else {
    // Fall back to "All recipes" tab + search.
    await page.locator('[data-testid="picker-tab-all"]').click().catch(() => {});
    await sleep(500);
    await page.fill('[data-testid="input-recipe-search"]', "chicken").catch(() => {});
    await sleep(1500);
    const firstAll = page.locator('[data-testid^="picker-all-"]').first();
    if ((await firstAll.count()) > 0) await firstAll.click();
    else console.log("  (no recipes available)");
  }
  await sleep(2000);
  await logState(page, "after recipe pick");

  // --- 6. Timeline-edit: wait for thumbnails, then trim last 2 seconds ---
  console.log("\n=== 6. Wait for timeline, then trim last 2s ===");
  // Wait for the trim handle to render (means metadata loaded).
  await page.locator('[data-testid="trim-handle-right"]').waitFor({ timeout: 30000 });
  // Give thumbnails time to render.
  await sleep(3000);

  const track = page.locator('[data-testid="timeline-track"]');
  const trackBox = await track.boundingBox();
  if (!trackBox) {
    console.log("  TIMELINE TRACK MISSING");
  } else {
    console.log(`  track box: ${JSON.stringify(trackBox)}`);
    // Get the right handle's bounding box
    const rightHandle = page.locator('[data-testid="trim-handle-right"]');
    const handleBox = await rightHandle.boundingBox();
    console.log(`  right handle: ${JSON.stringify(handleBox)}`);

    // Get total video duration via the editor's stats line. We expect ~16s for the test video,
    // so trim 2 seconds = 2/16 = ~12.5% of width. Drag handle inward by that fraction.
    const videoDurEval = await page.evaluate(() => {
      const stats = document.querySelector('[data-testid="timeline-track"]')?.previousElementSibling?.previousElementSibling;
      return stats?.textContent || "";
    });
    console.log(`  stats text: "${videoDurEval}"`);
    const durMatch = videoDurEval.match(/of ([0-9.]+)s/);
    const dur = durMatch ? parseFloat(durMatch[1]) : 16;
    const trimSeconds = 2;
    const trimFraction = trimSeconds / dur;
    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;
    const endX = startX - trackBox.width * trimFraction;
    console.log(`  drag from (${startX},${startY}) to (${endX},${startY}) — fraction ${trimFraction.toFixed(3)} = ${trimSeconds}s of ${dur}s`);

    // Drive pointer events from the page context — Playwright's page.mouse.* didn't reliably
    // trigger React's onPointerDown on the trim handle under headless Chromium. Pass as a
    // string-bodied function to avoid tsx's __name helper polluting the browser bundle.
    const dragFn = `(coords) => {
      const handle = document.querySelector('[data-testid="trim-handle-right"]');
      if (!handle) return false;
      const fire = (type, x, y) => {
        const ev = new PointerEvent(type, {
          bubbles: true, cancelable: true,
          clientX: x, clientY: y,
          pointerId: 1, pointerType: 'mouse', isPrimary: true,
          button: 0, buttons: type === 'pointerup' ? 0 : 1,
        });
        handle.dispatchEvent(ev);
      };
      fire('pointerdown', coords.sx, coords.sy);
      const steps = 20;
      for (let i = 1; i <= steps; i++) {
        const x = coords.sx + ((coords.ex - coords.sx) * i) / steps;
        fire('pointermove', x, coords.sy);
      }
      fire('pointerup', coords.ex, coords.ey);
      return true;
    }`;
    await page.evaluate(new Function('coords', `return (${dragFn})(coords);`) as any,
      { sx: startX, sy: startY, ex: endX, ey: startY });
    await sleep(1500);
  }
  await logState(page, "after trim");

  // --- 7. Title + Description ---
  console.log("\n=== 7. Fill title + description ===");
  await page.locator('[data-testid="input-reel-title"]').fill("Cheesy Garlic Parm Chicken & Potatoes");
  await page.locator('[data-testid="textarea-reel-description"]').fill("Yummy Cheesy Garlic Parm Chicken & Potatoes! #chicken #potatoes");
  await sleep(500);

  // --- 8. Add music + adjust volume ---
  console.log("\n=== 8. Add music ===");
  await page.locator('[data-testid="button-add-music"]').click().catch(() => console.log("  (no add-music button)"));
  await sleep(1500);
  // Pick first track in the picker — click the "Select" button on the first row.
  const firstSelectBtn = page.locator('[data-testid^="button-select-"]').first();
  if ((await firstSelectBtn.count()) > 0) {
    await firstSelectBtn.click();
    console.log("  picked first music track");
  } else {
    console.log("  (no music-track Select buttons visible)");
    const t = await page.locator("body").innerText();
    console.log("  body:", t.slice(0, 400));
  }
  await sleep(1500);

  // Adjust music volume to be below the original (drag the Music slider to ~30%).
  // The sliders are radix-ui sliders. Click+drag the thumb of the second one (music).
  const sliders = page.locator('[role="slider"]');
  const sliderCount = await sliders.count();
  console.log(`  sliders found: ${sliderCount}`);
  if (sliderCount >= 2) {
    const musicSlider = sliders.nth(1);
    const sb = await musicSlider.boundingBox();
    if (sb) {
      // Press Home then Right arrow ~6 times (5% step = 30%) — most reliable for radix.
      await musicSlider.focus();
      await page.keyboard.press("Home");
      await sleep(100);
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("ArrowRight");
        await sleep(40);
      }
      console.log("  music slider stepped to ~30%");
    }
  }
  await sleep(500);

  // --- 9. Process & upload ---
  console.log("\n=== 9. Click Process & Upload ===");
  const processBtn = page.locator('[data-testid="button-process-upload"]');
  await processBtn.waitFor({ timeout: 10000 });
  await processBtn.click();
  console.log("  clicked Process & Upload");
  await sleep(1000);
  await logState(page, "immediately after click");

  // Wait for either "Processing…" or "Uploading…" or an error UI.
  const processingMaxMs = 180_000;
  const start = Date.now();
  let finalState = "";
  while (Date.now() - start < processingMaxMs) {
    const txt = await page.locator("body").innerText();
    if (/Reel uploaded/i.test(txt) || /uploaded/i.test(txt) || /Audio flagged/i.test(txt)
        || /Setup incomplete/i.test(txt) || /Upload failed/i.test(txt)) {
      finalState = txt.slice(0, 300);
      break;
    }
    await sleep(2000);
  }
  console.log(`\n=== Final state after ${Math.round((Date.now() - start) / 1000)}s ===`);
  console.log(`  ${finalState || "(timed out without resolution)"}`);

  console.log("\n=== Console errors ===");
  console.log(consoleErrors.slice(0, 20).join("\n"));
  console.log("\n=== Page errors ===");
  console.log(pageErrors.slice(0, 20).join("\n"));
  console.log("\n=== Failed requests (last 30) ===");
  console.log(failedRequests.slice(-30).join("\n"));
  console.log("\n=== Console log/info (last 20) ===");
  console.log(allConsole.slice(-20).join("\n"));

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
