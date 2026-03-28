# QA Runbook - ReciPal Recipes Feed

Manual verification checklist for pre-release testing. Run these checks before shipping any changes to the Recipes feed or filtering logic.

## Prerequisites

- App is running locally or in preview
- Demo mode data is loaded (no login required for basic checks)

---

## 1. RECIPES FILTER CHECK

**Steps:**
1. Navigate to Recipes page
2. Click the filter button (funnel icon) on "For You" tab
3. Verify the filter sheet opens

**Expected filter options in EXACT order:**

| Order | Filter Name | Type | Options |
|-------|-------------|------|---------|
| 1 | Meal Type | Multi-select chips | Breakfast, Lunch, Dinner, Dessert, Snacks, Side |
| 2 | Cooking Style | Multi-select chips | Quick & Easy, Balanced, Healthy Gourmet, Meal Prep, Comfort Food |
| 3 | Serving Size | Dropdown | Any size, 1, 2, 3-4, 5+ |
| 4 | Kid Friendly | Toggle switch | On/Off |
| 5 | Time/Difficulty | Radio group | Quick (<30min), Medium (30-60min), Long (60+ min) |
| 6 | Cost Preference | Radio group | Budget, Balanced, Premium |
| 7 | Dietary Restrictions | Multi-select chips | Vegetarian, Vegan, Gluten-Free, Dairy-Free, Keto, Paleo |
| 8 | Allergies | Multi-select chips | Peanuts, Tree Nuts, Shellfish, Dairy, Eggs, Wheat, Soy, Fish |

**Pass criteria:** All filters present, correct labels, correct order.

---

## 2. FOR YOU INJECTION CHECK

**Purpose:** Verify "close-to-cook" recipes (2-3 missing ingredients) appear ONLY at every 5th position.

**Steps:**
1. Navigate to Recipes > For You tab
2. Scroll through at least 20 recipes
3. Identify recipes showing "Need 2" or "Need 3" badge
4. Note the positions where these appear

**Expected positions (1-based):** 5, 10, 15, 20, 25...

**Pass criteria:**
- "Need 2" or "Need 3" badges appear ONLY at positions 5, 10, 15, 20 (1-based)
- No "Need 2/3" badges appear at positions 1-4, 6-9, 11-14, 16-19, etc.

**How to verify positions:**
- Count cards from top-left, left-to-right, top-to-bottom
- Position 1 = first card, Position 5 = fifth card, etc.

---

## 3. SOMETHING NEW CHECK

**Steps:**
1. Navigate to Recipes page
2. Switch to "Something New" tab
3. Open the filter sheet
4. Set an allergy (e.g., Peanuts)
5. Verify peanut-containing recipes are excluded
6. Verify filter labels match the "For You" filter options

**Pass criteria:**
- Allergies and dietary restrictions are enforced
- Filter sheet has identical options and labels as For You
- Recipes with allergens do NOT appear

---

## 4. PANTRY CARD UI CHECK

**Steps:**
1. Navigate to Pantry page
2. Observe ingredient cards

**Pass criteria:**
- Pantry cards have NO hard border outline
- Pantry cards DO have a medium drop shadow
- No layout regressions (cards are properly aligned, sized)

---

## 5. UNIT TEST CHECK

**Steps:**
```bash
npx vitest run
```

Or with watch mode for development:
```bash
npx vitest
```

**Pass criteria:**
- All feed builder tests pass (22 tests)
- No test failures

---

## Ship/No-Ship Decision

| Check | Status |
|-------|--------|
| Recipes Filter Check | [ ] Pass / [ ] Fail |
| For You Injection Check | [ ] Pass / [ ] Fail |
| Something New Check | [ ] Pass / [ ] Fail |
| Pantry Card UI Check | [ ] Pass / [ ] Fail |
| Unit Test Check | [ ] Pass / [ ] Fail |

**If any check fails: DO NOT SHIP.**

Fix the issue, re-run all checks, then proceed with deployment.

---

## Quick Debug Tips

**If injection positions are wrong:**
- Check `buildForYouFeed.ts` logic for position % 5 === 0 condition
- Verify `pantryMissingIsSmall` is set correctly for 2-3 missing items

**If filters don't work:**
- Check `applyFilters` function
- Verify filter state is being passed correctly to the function

**If allergies don't exclude:**
- Check `hasAllergyConflict` function
- Verify ingredient names contain the allergen substring
