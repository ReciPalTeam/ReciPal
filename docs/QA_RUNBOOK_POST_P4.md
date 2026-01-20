# QA Runbook - Post P4 Stabilization

Manual verification checklist for pre-release testing after P4 stabilization. Run these checks before shipping.

## Prerequisites

- App is running locally or in preview
- Both Free and Pro user modes can be tested (use demo mode toggle if available)

---

## 1. PLAN/TRACK TOGGLE

**Steps:**
1. Navigate to Planner page
2. Verify Plan/Track toggle is visible at top

**Free User:**
- Plan mode: Full access to weekly calendar
- Track mode: Blurred overlay with "Upgrade to Pro" CTA

**Pro User:**
- Plan mode: Full access
- Track mode: Progress bars with daily/weekly macro tracking

**Pass criteria:** Correct visibility per entitlement tier.

---

## 2. SUMMARY TOTALS CORRECTNESS

**Steps:**
1. Add a meal to the planner
2. Mark it as "Cooked"
3. Verify Today and Week totals update

**Must Include:**
- [x] Planner meals marked cooked
- [x] Planner meals auto-counted at midnight
- [x] Cook Now logs (cooknow_logged_recipe)
- [x] Checkout completion logs (checkout_logged_recipe)
- [x] Pro manual entries (manual_custom_entry)

**Must Exclude:**
- [ ] Scheduled meals not yet cooked/counted

**Pass criteria:** Totals include all counted sources, exclude scheduled.

---

## 3. MIDNIGHT ROLLOVER

**How to simulate:**
1. In dev tools, adjust `lastRolloverDate` in local storage/state to yesterday
2. Refresh or trigger rollover check

**Verify:**
- Scheduled meals from past dates transition to `autoCounted`
- Rollover runs exactly once per day (lastRolloverDate guard)
- Already-cooked or already-counted meals are NOT re-counted

**Pass criteria:** No double-counting, rollover happens exactly once.

---

## 4. COOKED BUTTON BEHAVIOR

**Steps:**
1. Schedule a meal
2. Click "Cooked" button
3. Verify meal state changes and totals update
4. Try clicking "Cooked" again

**Verify:**
- Cooked button only works on scheduled meals
- Already-cooked meals cannot be re-cooked
- Auto-counted meals cannot be marked cooked again

**Pass criteria:** No double-counting via Cooked button.

---

## 5. REMOVE BUTTON BEHAVIOR

**Steps:**
1. Mark a meal as cooked
2. Click "Remove" button
3. Verify totals subtract correctly

**Verify:**
- Removing a cooked/counted meal subtracts from totals
- Removing a scheduled meal does NOT affect totals
- Removal happens exactly once

**Pass criteria:** Correct subtraction, exactly once.

---

## 6. AUTO-POPULATE PREVIEW

**Steps:**
1. Click "Auto-populate Week" button (Plan mode)
2. Verify preview overlay appears

**Verify:**
- Preview does NOT write to planner until Confirm
- Desserts checkbox: OFF = no desserts generated, ON = up to 1/day
- Snackitizers checkbox: OFF = no snackitizers generated, ON = up to 1/day
- Serving steppers (1-10) scale projected totals correctly
- Swap meal in preview works
- Regenerate creates new preview without affecting calendar

**Pass criteria:** Preview is isolated, checkboxes control generation.

---

## 7. CONFIRM PLAN

**Steps:**
1. Have some meals already in planner
2. Generate preview
3. Click Confirm Plan

**Verify:**
- Only empty slots are filled
- Occupied slots show "Slot filled" badge
- Existing meals are NOT overwritten

**Pass criteria:** Confirm fills empty only, never overwrites.

---

## 8. ADD-TO-PLAN SCHEDULING POPUP

**Steps:**
1. Go to Recipe Detail page
2. Click "Add to Plan"
3. Test all three modes

**Single Day:**
- Select one day, verify one PlannedMeal created

**Date Range:**
- Select start and end dates, verify correct range of meals created

**Select Days (Multi-select):**
- Select multiple non-contiguous days, verify each gets a meal

**Replacement Warning:**
- Select a day that already has a meal in that slot
- Verify warning appears
- Confirm replacement only affects selected conflicts

**Pass criteria:** All modes work, replacement warning accurate.

---

## 9. INGREDIENT SWAP

**Steps:**
1. Add a meal to planner
2. Click Info button on meal card
3. Click Swap button on an ingredient

**Verify:**
- Classification label visible (Protein/Carb/Veggie/Fruit/Other) alongside Need/Maybe/Have
- 4 swap suggestions appear
- Search bar works
- Regenerate button refreshes suggestions
- Selecting a swap updates ingredient name
- Nutrition totals update immediately
- "Undo" button restores original
- Instructions text never changes after swap

**Pass criteria:** Swap UI complete, nutrition updates, undo works.

---

## 10. SWAP PERSISTENCE

**Steps:**
1. Swap an ingredient on Day 1 Lunch
2. Check Day 2 if same recipe is scheduled

**Verify:**
- Swap applies ONLY to that specific meal entry
- Other days with same recipe are unaffected
- Swaps persist within session
- Base recipe definition unchanged

**Pass criteria:** Per-entry persistence, no cascade.

---

## 11. PRO GATING

**Track Mode (Free):**
- [ ] Blurred placeholder visible
- [ ] No tracking computations running
- [ ] "Upgrade to Pro" CTA present

**Track Mode (Pro):**
- [ ] Real progress bars visible
- [ ] Daily/weekly macro tracking works

**Manual Add (Pro Only):**
- [ ] Not visible to Free users
- [ ] Visible to Pro users
- [ ] Creates manual_custom_entry logs correctly

**Pass criteria:** Features gated correctly per entitlement.

---

## 12. FREE USER LOGS

**Steps:**
1. As Free user, use "Cook Now" feature
2. Complete a checkout flow

**Verify:**
- cooknow_logged_recipe entries affect totals (calories only)
- checkout_logged_recipe entries affect totals
- No visible planner entry created for these logs

**Pass criteria:** Free logs count, no UI clutter.

---

## 13. UNIT TESTS

**Run:**
```bash
npx vitest run
```

**Pass criteria:** All tests pass (60+ tests expected)

---

## Ship/No-Ship Decision

| Check | Status |
|-------|--------|
| Plan/Track Toggle | [ ] Pass / [ ] Fail |
| Summary Totals | [ ] Pass / [ ] Fail |
| Midnight Rollover | [ ] Pass / [ ] Fail |
| Cooked Button | [ ] Pass / [ ] Fail |
| Remove Button | [ ] Pass / [ ] Fail |
| Auto-populate Preview | [ ] Pass / [ ] Fail |
| Confirm Plan | [ ] Pass / [ ] Fail |
| Add-to-Plan Popup | [ ] Pass / [ ] Fail |
| Ingredient Swap | [ ] Pass / [ ] Fail |
| Swap Persistence | [ ] Pass / [ ] Fail |
| Pro Gating | [ ] Pass / [ ] Fail |
| Free User Logs | [ ] Pass / [ ] Fail |
| Unit Tests | [ ] Pass / [ ] Fail |

**If any check fails: DO NOT SHIP.**

Fix the issue, re-run all checks, then proceed with deployment.
