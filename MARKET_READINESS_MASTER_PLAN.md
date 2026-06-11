# Market-Readiness Master Plan (Phase M)

**Date:** 2026-06-10 · **Owner:** Claude (/Fable) implements all workstreams · **Approved by:** Mike
**Companion docs:** `HANDOFF-PREVIEW-WEEK-AUDIT.md` (Planner/macro engine, findings G1–G13 / SR1–SR11 / T1–T6 / D1–D4) · `AUDIT.md` + `SECURITY.md` (living docs, created during execution) · CHANGELOG.md

Two independent audits merged: Claude's (For You feed, Almost There banner, security) + the in-repo
Preview-Week audit. Baseline for line numbers: commit `bba4fc0` unless noted.

---

## Execution order (locked)

**WS-A Security (iron fortress) → WS-C Almost There → WS-B For You personalization → WS-D Planner
macro engine (per HANDOFF §9, P0→P4) → WS-E exhaustive audit interleaved throughout.**

Coordination: a teammate pushes styling/UI commits frequently — **re-pull (ff) before every work
session and before every push**; commit in small units. Hot styling files: `recipes/index.tsx`
(visual layer), `dark-mode-overrides.css`, `planner/index.tsx` (visual), auth/onboarding/pantry pages.

---

## WS-A — Security: full iron fortress

Verified findings (pre-pull line refs — re-locate):

| Sev | Finding | Location | Fix |
|---|---|---|---|
| CRIT | Hardcoded backdoor creds `admin123`/`free123` | routes.ts ~389/409/463 | Remove or hard-gate to `NODE_ENV=development` |
| CRIT | IDOR: no ownership check | `DELETE /api/plan/meal/:id` ~879; `POST /api/plan/meal/:id/sides` ~2182 | Join-to-user ownership guard; **sweep ALL mutating routes** |
| CRIT | Weak `SESSION_SECRET` fallback | routes.ts ~369 | Throw if unset in prod; rotate to 32 random bytes |
| HIGH | No `helmet` (CSP/HSTS/nosniff/X-Frame) | server/index.ts | `app.use(helmet())` + tuned CSP |
| HIGH | No CSRF on cookie-auth'd mutations | all POST/PUT/DELETE | CSRF tokens (or double-submit) + `sameSite` review |
| HIGH | Uploads trust client MIME string | multer routes ~2330/3655/4117 | Magic-byte check + Sharp re-encode + hardcoded content-type |
| HIGH | Rate-limit gaps | favorites, plan/consumption deletes, feeds, `/api/scaled-steps` (SR7), chef enum | Extend `middleware/rateLimits.ts` |
| MED | Supabase RLS not enabled (defense-in-depth) | all tables | Enable RLS; service-role key is server-only (verified) — client never talks to Supabase directly; keep that invariant |
| MED | No email verification / password reset | auth routes | Implement both flows |
| MED | No auth-failure logging | passport strategy | Log failures (user, IP, ts) |
| MED | Input validation gaps | various bodies | zod sweep |
| — | Add gitleaks/secret-scan to CI | — | `.env` verified NOT in git (gitignored, never committed, no blobs in history) — keep it that way |

Already good (do not "fix"): Drizzle is parameterized (no SQLi); no `dangerouslySetInnerHTML`; most
routes already check auth+ownership; scrypt password hashing; service-role key never shipped to client.

## WS-C — "Almost There" / ready-now feed logic

Spec (from Mike): **"Almost There" green banner = missing ≤2 ingredients.** Recipes the user can make
**immediately (0 missing)** go in the **first feed cell and every 4th after**, until exhausted.

Current bugs (`client/src/pages/recipes/index.tsx` rankForYouBatch ~189–266, `recipe-card.tsx` ~42–46):
- Threshold is `needCount >= 2 && needCount <= 3` (wrong on both ends).
- Injection is every-5th with an off-by-one (lands at positions 4, 9, 14…).
- 0-missing recipes are never surfaced specially at all.
- Banner fires on `isInjected`; text "Almost Ready".

Fix in `rankForYouBatch`: three lists — ready (0 missing), almost (1–2 missing), rest; inject ready at
index 0 + every 4th; banner condition = missing ≤2; update `buildForYouFeed.test.ts`. Pantry overlap =
`demo-store.ts` `getPantryOverlap` ~802–826 (substring match, no units — note for WS-E).

## WS-B — For You personalization + Pro macro-goal ranking

Current (`server/lib/recipeDb.ts` getForYouFeed ~291–384): applies allergies, dietaryPreferences,
cookingComfort only; "ordering" is 6 hardcoded sort strategies cycled by seed (~346–354) — not ranking.

Wire as real pre-filters/ranking: `dislikedFoods`, `excludedIngredients`, `cuisinePreferences`
(pre-filter, not post-fetch re-rank), `missingTools`, `isDiabetic` (sent but unread server-side),
`maxCarbPercent` (never read; column stores grams). Add **Pro-gated macro/goal-aware ranking** toward
`targetCalories`/macros/`goal` (Free: calorie-aware on `calorieGoal`). Reuse `filterByIngredients`
(~107–169) and the shared tolerance band (below).

## WS-D — Planner macro engine + AI serving reducer

Implement `HANDOFF-PREVIEW-WEEK-AUDIT.md` in its §9 order:
- **P0:** SR1 cache-poisoning fix (scaledSteps.ts ~215–228; don't cache LLM fallbacks; overwrite-upsert;
  cleanup script) + SR2 (json_object, max_tokens, temp 0) + **G13 servings-semantics decision (ASK MIKE
  — gates G1/G2/G4)**.
- **P1:** G1 target-seeking slot-budget scoring; G12 ONE shared tolerance band + unclamp overshoot UI;
  G2 servMult; G3 jitter after ranking; G4 caps × servings + supplemental budgets.
- **P2:** G7 BATCH_SIZE 15–20 + partial-fill UI; G8 server allergen/diet params on planner fetch;
  G5 existing-week awareness; G6 merged recipe lookup; G9 exclude 0-macro server-side.
- **P3:** SR3–SR11 reducer quality. **P4:** G10/G11, D1/D2 queries, T2–T6 hygiene.

## WS-E — Exhaustive line-by-line audit

Module-by-module sweep of `server/`, `client/src/`, `shared/` → living `AUDIT.md` (gaps, dead code,
correctness, perf, UX), fixed in priority order. Run as fan-out workflow.

---

## Cross-cutting invariants (both audits)

1. **Pool macros are per-serving** — never divide by `recipe.servings` in feed/planner paths.
2. **ONE shared tolerance band** (export the ±5% from insights as a shared constant; consider ±10% for
   generation acceptance) — used by WS-B ranking, WS-D generator, and UI.
3. **`scaledSteps` reducer: LLM never touches numbers** — keep that boundary; SR1 fix is prerequisite
   to trusting cached variants.
4. **Unify ingredient matching** on `shared/ingredient-intel.ts` (pantry overlap, allergen filter,
   planner client filter all differ today).
5. Catalog reality: 556 recipes, 100% macro-complete (CHANGELOG "469" is stale).

## Verification gates

- WS-A: cross-user requests → 403; helmet headers present; spoofed uploads rejected; 429s on limits;
  RLS denies anon cross-row access; typecheck + tests green.
- WS-C: 0-missing at cell 1 + every 4th; ≤2-missing tagged; test updated + green.
- WS-B: Pro `goal:cut` user sees lower-calorie recipes first; disliked/excluded never appear.
- WS-D: HANDOFF §9 acceptance criteria (≥6/7 days in band, servings-aware, no phantom zeros, no silent
  empty slots).

## Process rules

No commit/push without explicit authorization. CHANGELOG (Unreleased) + memory handoff updated after
every non-trivial change. Re-pull before sessions/pushes. Checkpoint docs before context limits. /Fable
