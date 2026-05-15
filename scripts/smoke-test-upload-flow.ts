import { chromium } from "playwright";

// Smoke test: open the chef upload page and confirm the JS bundles load without runtime
// errors. Auth-gated UI (the actual Trim & finalize controls) requires login, which this
// script can't perform — we surface that limitation and report what was verified.

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors: string[] = [];
  const warnings: string[] = [];

  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    if (msg.type() === "warning") warnings.push(`console.warn: ${msg.text()}`);
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure();
    if (failure) errors.push(`request failed: ${req.url()} — ${failure.errorText}`);
  });

  console.log("\n=== Loading / (root) ===");
  await page.goto("http://localhost:5002/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  console.log("  page title:", await page.title());

  console.log("\n=== Loading /chef/upload (unauthed) ===");
  await page.goto("http://localhost:5002/chef/upload", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);

  // The page either renders the guest-gate "Chef Creators only" view, or it redirects
  // through the auth flow. Either way it should not throw.
  const bodyText = await page.locator("body").innerText();
  console.log("  body snippet:", bodyText.slice(0, 200).replace(/\n/g, " "));

  // Confirm the bundled timeline-trim-editor source includes the post-fix string.
  const sourceFetch = await page.evaluate(async () => {
    try {
      const res = await fetch("/src/components/timeline-trim-editor.tsx", { headers: { Accept: "application/javascript" } });
      const text = await res.text();
      return {
        ok: res.ok,
        size: text.length,
        hasKeptCheck: text.includes("keptSegments.length >= 2 && segments.map"),
        hasEdgeCollapse: text.includes("isLeftmostKept") && text.includes("isRightmostKept"),
        hasClickToSeek: text.includes("onTimelinePointerDown"),
      };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
  console.log("  timeline-trim-editor.tsx fetch:", sourceFetch);

  const uploadFetch = await page.evaluate(async () => {
    try {
      const res = await fetch("/src/pages/chef/upload/index.tsx", { headers: { Accept: "application/javascript" } });
      const text = await res.text();
      return {
        ok: res.ok,
        size: text.length,
        // Detect: setStep("processing") immediately followed by setProcessingMessage
        // and BEFORE awaiting ensureFfmpeg. Walks the file structure.
        hasImmediateSetStep: (() => {
          const idxSetStep = text.indexOf('setStep("processing")');
          const idxEnsure = text.indexOf("await ensureFfmpeg()");
          return idxSetStep > 0 && idxEnsure > 0 && idxSetStep < idxEnsure;
        })(),
        hasDisabledRemoved: !/disabled=\{!trimValid\}/.test(text),
      };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
  console.log("  chef/upload/index.tsx fetch:", uploadFetch);

  console.log("\n=== Errors ===");
  if (errors.length === 0) console.log("  (none)");
  else for (const e of errors) console.log("  -", e);

  console.log("\n=== Warnings ===");
  if (warnings.length === 0) console.log("  (none)");
  else for (const w of warnings.slice(0, 10)) console.log("  -", w);

  await browser.close();

  // Verdict
  const verdict: string[] = [];
  if (!sourceFetch.hasKeptCheck) verdict.push("FAIL: delete-button visibility fix missing");
  if (!sourceFetch.hasEdgeCollapse) verdict.push("FAIL: edge-collapse delete logic missing");
  if (!uploadFetch.hasImmediateSetStep) verdict.push("FAIL: immediate setStep('processing') missing");
  if (!uploadFetch.hasDisabledRemoved) verdict.push("FAIL: button is still disabled when invalid");
  if (errors.length > 0) verdict.push(`FAIL: ${errors.length} runtime error(s)`);

  console.log("\n=== Verdict ===");
  if (verdict.length === 0) console.log("  PASS — code changes present, no runtime errors");
  else for (const v of verdict) console.log("  ", v);

  process.exit(verdict.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
