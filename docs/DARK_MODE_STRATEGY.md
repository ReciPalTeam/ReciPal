# Dark Mode Strategy

## Overview

Dark mode is implemented using a **CSS-variable-first + override stylesheet** approach. All styling work is isolated to 3-4 files that do not conflict with functional component changes being made by other contributors.

## Current Status

### Covered surfaces

The override stylesheet provides dark-mode treatment across the full app surface as of the most recent coverage-expansion pass (post Phase H ship merge):

- **Tab-level pages:** Recipes (index + detail), Planner, Pantry, Cart, Grocery, Favorites, Instacart, Profile, Settings, Dashboard, Preferences, Macro Wizard, Onboarding, Auth, Pro, Pro Welcome, Paywall.
- **Phase H surfaces (token-clean by design):** Reels feed, Chef pages (`chef/[handle]`, `chef/me`, `chef/analytics`, `chef/upload`), Chef Recipe detail, Hashtag, Notifications. These were built *after* the dark mode system existed and use semantic tokens directly — no hardcoded-hex remediation needed.
- **Modals / sheets:** SwapIngredientPopup, SidePicker (inline + modal), SidesRadialPicker, CookCelebrationModal, MealDetailPopup, LeftoverAssignmentModal, AddPantryItemSheet, ManualEntrySheet, ScanBarcodeSheet, CommentsSheet, ShareSheet, MusicPickerSheet, ChefApplicationSheet, ChefRecipeEditSheet, RecipePickerSheet, AvatarCropDialog.
- **Chrome:** Header (raised surface), bottom nav (with orange active-tab glow), hamburger menu, theme toggle, fork radial menu.

### Token taxonomy

The CSS variable groups in `index.css` cover:

- **Macro nutrients** — protein (5 variants), carbs (7 variants), fat (6 variants), calories (4 variants), vitamins (2 variants)
- **iOS system colors** — green (2 variants), blue, plus iOS-styled text / borders / destructive / chevron
- **Surfaces** — raised, input, subtle, muted, hover-green, plus border-subtle
- **Status** — success (3 variants), danger (3 variants), warning
- **Text** — dark, gray, medium-gray, muted-ios, warning-dark, warning-medium
- **CTA** — green, orange, blue, instacart (2 variants)

### Recently closed gaps (audit-driven coverage expansion)

| Variable | Hex | Primary usage |
|---|---|---|
| `--macro-protein-lighter` | `#ff9500` | macro-wizard, paywall, profile, settings, preferences, planner, pro-welcome (32 uses across 8 files) |
| `--macro-protein-light-alt` | `#ff7b1a` | layout-shell fork menu inactive state |
| `--macro-protein-medium-dark` | `#e05500` | layout-shell active fork gradient |
| `--macro-protein-dark-alt` | `#cc7700` | cook-celebration gradient stop |
| `--macro-carbs-pale-light` | `#bbf7d0` | cook-celebration, macro-wizard success surfaces |
| `--macro-carbs-very-pale` | `#d1fae5` | same family |
| `--ios-system-green` | `#34c759` | macro-wizard energy-balance visuals |
| `--ios-system-green-bright` | `#30d158` | macro-wizard celebration variant |
| `--ios-system-blue` | `#007aff` | macro-wizard SVG strokes |
| `--cta-blue-text` | `#1e40af` | meal-detail-popup, preferences custom CTA |

Plus inline-style and SVG attribute coverage added for: `#ca8a04` (calories text + `stopColor`), `#f59e0b` (amber warnings + `stopColor`), `#d97706`, `#fde047` (companion SVG stops), `#ef4444` (red warnings), `#f5f5f7` (iOS light gray surface), `#888`, `#999` (generic grays).

### Vocabulary additions and treatments (continued progress)

Work landed after the gunmetal recolor commit. Themes:

**1. Pillbox vocabulary unified across light + dark.** The segmented-control pillow + engraved-divider treatment used to be `.dark`-only. It's now unscoped, with a new family of `--pill-*` CSS variables that swap colors per theme:

| Variable | Light | Dark |
|---|---|---|
| `--pill-track-top` / `--pill-track-mid` / `--pill-track-bottom` | light pillow stops (`hsl(220 14% 96%)` → `hsl(220 13% 87%)`) | gunmetal stops (`hsl(215 12% 21%)` → `hsl(215 13% 14%)`) |
| `--pill-stripe-dark` / `--pill-stripe-light` | engraved divider rgbas (darker shadow + brighter highlight on light bg) | engraved divider rgbas (lighter highlight on dark bg) |
| `--pill-edge-rim` / `--pill-edge-highlight` / `--pill-edge-shadow` / `--pill-outer-shadow` | inset + drop shadow values for light pillow depth | inset + drop shadow values for dark pillow depth |
| `--pill-text-inactive` / `--pill-text-inactive-hover` | dark inactive text (`rgba(0,0,0,0.55)`) | light inactive text (`rgba(255,255,255,0.55)`) |

Same geometry in both modes; only the gradient stops, divider rgbas, and inactive text colors change when `.dark` is toggled.

**2. Pillbox extended to additional 2-segment surfaces.**

- **My Meals → Favorites / My Recipes sub-selector** (`pages/recipes/index.tsx:1837`). Pulled `-19px` margin-top so it sits the same distance from the primary tablist as the meal-pill row, with `32px` margin-bottom to balance the spacing below.
- **Ingredients / Steps tabs on the recipe detail page** (`pages/recipe/[id].tsx:982`). Different class signature (`grid-cols-2` without `rounded-[9999px]`), so it gets its own selector but reuses the same `--pill-*` vars.
- **"Build a New Meal" CTA** under the sub-selector got border removed and a subtle muted-bg treatment so it doesn't render as a horizontal hairline below the sub-selector.

**3. Tailwind standard color coverage on recipe detail.** Recipe detail page uses lots of Tailwind STANDARD color classes (not arbitrary `[#XXXX]`). Added `.dark` overrides for:

- `bg-gray-50` / `bg-gray-100`, `from-gray-50` / `to-gray-100`, `border-gray-50` / `border-gray-100`, `text-gray-700` → map to `--surface-*` or `--border` tokens
- Time pill "Total" highlighted state: `from-orange-50` / `to-orange-100` / `border-orange-200` → `--macro-protein` at low opacity
- Detailed Nutrition section header tints: four colored gradient pairs (blue/indigo, green/emerald, orange/amber, purple/pink) with hover variants → low-opacity macro-color tints

**4. Brightened `--destructive` in dark mode.** Was `0 62.8% 30.6%` (dim, 30% lightness — Logout button text was lost on gunmetal). Bumped to `0 82% 62%`, matching the brightness tier of `--ios-destructive` and `--status-danger`. Affects all `text-destructive` and `bg-destructive` consumers app-wide.

**5. FAB Quick Add radial menu — dark-mode treatment.** Component (`components/fab-radial-menu.tsx`) uses heavy inline styles. Added attribute-substring overrides for: white-glass modal container → gunmetal glass; decorative ring; three radial buttons (pantry green, meal orange, reel purple) each with per-color tints blended into gunmetal + brighter colored border.

**6. Filter sheet controls — Variation B (Filled Token) vocabulary.** Per a 4-variant mockup comparison, chose the "Filled Token" direction which aligns with the existing green-pillow checkbox + Apply Filters CTA pattern. Applied to:

- **Checkbox** — bumped from `#2a2a2a` / 10% white border to `#2e333c` / 14% white border. Checked state unchanged (green pillow).
- **Radio (`[role="radio"]`)** — same Filled Token unchecked surface + green-pillow checked surface + white indicator dot.
- **Serving Size stepper** — 44×44 framed Filled Token buttons (`#2e333c` bg, 14% white border, 12px radius, inset highlight + drop shadow) flanking a 22px / 700-weight number display.

### Visual QA findings (post-expansion pass)

Walked the running app via the MCP preview, toggling `.dark` and screenshotting each surface. Verified clean in dark mode: Home/Recipes, Settings, Plan, Reels, Chef profile, Notifications, Pantry, Macro Wizard intro + step 1 + step 2, Paywall.

**Two issues found and fixed during QA:**

1. **Bootstrap gap — 8 routes bypassed LayoutShell.** `LayoutShell` was the only place that applied the `.dark` class to `<html>`, but `App.tsx` does not wrap LayoutShell around `/login`, `/register`, `/onboarding`, `/macro-wizard`, `/paywall`, `/share/recipe/:id`, `/swatchboard`, `/instacart`, or `/pro-welcome`. Those pages stayed in light mode regardless of the user's theme preference. Fixed by adding a pre-render dark-mode bootstrap in `client/src/main.tsx` that reads `localStorage["theme"]` and applies `.dark` to `<html>` before React mounts. LayoutShell's toggle still owns runtime theme switching.

2. **Pantry "expiring soon" banner — light-yellow multi-stop inline gradient.** `pages/pantry/index.tsx:502` used `style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}` (yellow-100 → yellow-200). The override CSS can't selectively rewrite an inline gradient string, but it *can* match the full computed `style` attribute and replace `background-image` wholesale. Added an attribute-substring override that swaps the gradient for a flat dark-amber tint. Same pattern pre-emptively applied to the add-pantry-item green pill cards (`#ecfdf5 → #d1fae5`).

**Pre-existing design decisions confirmed (not dark-mode regressions):**

- **Paywall hero** intentionally uses an orange-to-cream sunrise gradient on both themes; the cream end is part of the aspirational "Go Pro" treatment. Low contrast between white feature text and the cream lower half is a pre-existing issue and exists in light mode too.

### Remaining open items

1. **Deeper wizard / modal verification.** Macro Wizard steps 3-5 (energy balance, macro breakdown, review) were not opened during the QA pass — they're where the `--ios-system-green/blue` and `--macro-carbs-pale-light` variants get exercised. Cook-celebration modal, swap-ingredient popup, side-picker modal, and the other ingredient-flow surfaces were also not opened because they require an in-app multi-click flow to trigger. Worth a manual click-through.
2. **Multi-stop inline gradients (limitation).** CSS still can't rewrite a single stop inside an inline gradient. We can only swap the whole `background-image` via attribute-substring selectors. Brand-orange and brand-green gradients render fine on dark (both stops are saturated colors). Watch for any other pale/light gradients added in future TSX — they'll need the same banner-override pattern.
3. **Tailwind config token mappings** — the new variables (`--macro-protein-lighter`, `--ios-system-*`, `--cta-blue-text`, `--pill-*`) have not been added to `tailwind.config.ts` semantic-token mappings. Not blocking today because the override CSS catches everything; needed during the future semantic-token migration step.
4. **Future migration to semantic tokens** — see the "Migration plan" section below. Once Mike's functional work is stable, run the find-and-replace pass to swap arbitrary-value Tailwind classes for semantic tokens (`bg-macro-protein` instead of `bg-[#ff6300]`), then delete `dark-mode-overrides.css` entirely.
5. **Continued tour of remaining surfaces.** Filter sheet controls (Variation B), FAB menu, Logout button, recipe detail Detailed Nutrition + time pills, and the pillbox vocabulary are all done. Remaining unaudited per-surface treatments include: the Pantry "Add Pantry Item" sheet (already overridden but visually unverified post-vocabulary work), Cart line items, Profile / Settings deep screens, Cook Celebration modal, Swap Ingredient popup, Side Picker modal/inline, manual entry sheet, scan barcode sheet, comments sheet, share sheet, music picker, recipe-form, recipe-picker, avatar-crop-dialog. Walk these one at a time as visual issues surface.
6. **Screenshot tool reliability.** The MCP `preview_screenshot` tool has been timing out (Vite HMR log overflow). DOM-based verification via `preview_eval` + `preview_inspect` remains the workaround. The user can still see results directly in their own browser.

## Architecture

### How it works

1. **CSS custom properties** in `client/src/index.css` define every color token for both `:root` (light) and `.dark` (dark) modes
2. **`dark-mode-overrides.css`** uses `.dark` context selectors to restyle hardcoded Tailwind arbitrary-value classes (e.g. `bg-[#ff6300]`) without touching the component files that contain them
3. **Tailwind config** (`tailwind.config.ts`) maps semantic token names (e.g. `macro.protein`) to the CSS variables, providing the migration path

Dark mode is toggled via the `dark` class on `<html>`, controlled by the existing toggle in the layout shell.

### Design decisions

- **Background**: Very dark neutral gray (`#121212`, HSL `0 0% 7%`). No true black, no blue tint.
- **Cards/surfaces**: Slightly elevated grays (`#171717` to `#1a1a1a`) for visual layering
- **Borders**: Neutral gray (`#2e2e2e` to `#383838`)
- **Macro colors**: Same hues as light mode but brightened slightly for readability on dark backgrounds
- **Text**: Near-white (`#f5f5f5`) for primary, mid-grays for secondary

## Files involved

| File | Role | Merge risk |
|------|------|------------|
| `client/src/index.css` | CSS variable definitions (light + dark) | Low - rarely touched for functional changes |
| `client/src/dark-mode-overrides.css` | Override stylesheet for hardcoded colors | None - new file |
| `client/src/main.tsx` | Imports the override stylesheet (1-line change) | Low - only an import line added |
| `tailwind.config.ts` | Semantic token mappings (`macro.*`, `surface.*`, `ios.*`) | Low - rarely touched for functional changes |

**No component TSX files are modified.** This is the key isolation guarantee.

## Working with Mike's changes

### Merge rules

Mike is making functional changes to component files (pages, API routes, shared types). This dark mode work is deliberately isolated from those files.

**When merging:**

1. **Pull Mike's latest changes first** - his functional work takes priority
2. **Our CSS/config changes should merge cleanly** - they touch different files
3. **If a conflict occurs in `index.css` or `tailwind.config.ts`**, accept both sets of changes (Mike's additions + our dark mode variables). They occupy different sections of the file.
4. **Never force-push or overwrite Mike's branches**

### What Mike should know

- The `dark` class on `<html>` activates dark mode. If he adds new components, they should use semantic Tailwind classes (`bg-card`, `text-foreground`, `border-border`) instead of hardcoded hex values — these automatically adapt to dark mode.
- If he must use a hardcoded color, we can add an override for it later.
- The `.dark` CSS variables and override file are additive — they don't change any existing light-mode behavior.

## Migration plan (future)

Once Mike's functional changes are merged and stable, the final step is a mechanical find-and-replace pass in component files:

| Find | Replace with |
|------|-------------|
| `text-[#ff6300]` | `text-macro-protein` |
| `from-[#ff6300]` | `from-macro-protein` |
| `bg-[#FDFCFB]` | `bg-surface-raised` |
| `text-[#1c1c1e]` | `text-ios-text-primary` |
| `border-[#e5e5ea]` | `border-ios-border` |
| `text-[#8e8e93]` | `text-ios-text-secondary` |
| `text-[#c7c7cc]` | `text-ios-chevron` |
| `text-[#e67e22]` | `text-macro-calories` |
| `text-[#2ecc71]` | `text-macro-carbs` |
| `text-[#3498db]` | `text-macro-fat` |
| `bg-[#ff6300]` | `bg-macro-protein` |
| `bg-[#22c55e]` | `bg-macro-carbs-medium` |
| `bg-[#3b82f6]` | `bg-macro-fat-medium` |
| `border-[#e2e8f0]` | `border-border-subtle` |
| `bg-[#f1f5f9]` | `bg-surface-input` |
| `bg-[#f8faf9]` | `bg-surface-subtle` |
| `text-[#ff3b30]` | `text-ios-destructive` |
| inline `style={{ color: '#ff6300' }}` | `className="text-macro-protein"` |
| inline `style={{ color: '#ca8a04' }}` | `className="text-macro-calories-amber"` |
| SVG `stopColor="rgb(...)"` | CSS variable references |

After migration, delete `dark-mode-overrides.css` entirely.

## Token reference

### Macro nutrients
- `--macro-protein` / `macro.protein` — orange (#ff6300 light, brightened in dark)
- `--macro-carbs` / `macro.carbs` — green (#2ecc71)
- `--macro-fat` / `macro.fat` — blue (#3498db)
- `--macro-calories` / `macro.calories` — amber (#e67e22)
- `--macro-vitamins` / `macro.vitamins` — purple (#9b59b6)

Each has `-light`, `-dark`, and variant suffixes for gradient stops.

### Surfaces
- `--surface-raised` / `surface.raised` — slightly elevated background
- `--surface-input` / `surface.input` — input field background
- `--surface-subtle` / `surface.subtle` — subtle differentiation
- `--surface-muted` / `surface.muted` — most subdued surface

### iOS UI
- `--ios-text-primary` / `ios.text-primary` — primary text (#1c1c1e / #f2f2f2)
- `--ios-text-secondary` / `ios.text-secondary` — secondary text (#8e8e93)
- `--ios-chevron` / `ios.chevron` — disclosure arrows (#c7c7cc)
- `--ios-border` / `ios.border` — list separators (#e5e5ea)
- `--ios-destructive` / `ios.destructive` — delete/logout red (#ff3b30)
