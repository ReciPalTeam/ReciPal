# Dark / Light Mode Changes — Local vs. GitHub

A running log of the theme (dark/light mode) work done on this machine that is **not yet on GitHub**, so we can report back and decide what to push.

- **Branch:** `main`
- **"On GitHub" means:** `origin/main` (the ReciPalTeam/ReciPal remote)
- **Last updated:** 2026-05-30
- **Status:** local `main` is **9 commits ahead** of GitHub, **plus 2 files with uncommitted edits**. None of the below is on GitHub yet.

Files touched across all this work:
`client/src/index.css` (light theme), `client/src/dark-mode-overrides.css` (dark theme),
plus a few component files (`manual-entry-sheet.tsx`, `add-pantry-item-sheet.tsx`, `planner/index.tsx`, `recipes/index.tsx`).

---

## 1. Committed locally, NOT pushed to GitHub (9 commits)

Grouped by area. Short commit hashes in brackets for reference.

### Bottom navigation
- Added an **active-tab indicator** — a colored line on the top edge of the active tab (green in light mode, orange in dark mode). [`26f35bf`]
- **Tab-press feedback** made theme-neutral: a soft-black fill on light, soft-white on dark, that fades out on release. Reverted an earlier "wrap-around-the-+" extension. [`59b243f`]

### "Build a Meal" modal
- Converted from a **bottom sheet to a centered dialog** with a frosted-glass surface + blurred backdrop; brand-orange header, labels, and CTA; macro totals styled like the MacroPills. [`26f35bf`]
- **Orange focus rings + orange date selection**: active mode button (Single/Range/Select), selected day, and "today" are now orange instead of green. [`377a7ec`]
- **Save Meal button**: dropped the green border/background, applied the shared orange beveled treatment with white text (identical in light + dark). Inactive date-mode buttons are now filled (not wireframe); the meal-slot dropdown highlight is neutral gray instead of lime green. [`319350e`]
- **Barcode-scan icon** in the ingredient search recolored green → orange. [`550bbc5`]

### Call-to-action buttons (app-wide)
- **White text on solid-orange CTAs** in both themes — previously rendered green-on-orange in dark mode. (Opacity-tinted orange buttons keep their orange text.) [`3cd0d18`]
- **"Apply Filters" button**: fixed dark-mode green text and unified it to the orange beveled treatment, identical in both themes. [`a366c92`, `5caafaf`]
- **"Auto-populate Week" button**: now keeps the bright orange light-mode gradient in dark mode too (instead of a toned-down dark gradient). [`dff52ae`, `5caafaf`]
- **"Add Items" (Add Pantry) CTA**: now brand orange in both modes. [`59b243f`]

### Planner (dark mode)
- **"Preview Your Week" dialog**: frosted-glass + blurred backdrop popup treatment; meal-type labels (Breakfast/Lunch/…) color-matched to the "+ Add" text. [`59b243f`]

### Search fields
- **Unified Recipes & Pantry search**: Recipes adopts Pantry's iOS-gray field in light mode; Pantry adopts Recipes' glass field in dark mode. [`5caafaf`]

---

## 2. In progress — NOT committed, NOT on GitHub (uncommitted edits)

**Bottom-nav active indicator → "Bold Flat Bar"** (`index.css` + `dark-mode-overrides.css`)
- Replaced the glowing gradient hairline (2px line with multi-layer glow/halo) with a **flat, full-width 4px solid bar** on the top edge of the active tab — green in light, orange in dark. No glow, no rounding.
- Also **removed the dark-mode glow halo** on the active tab's icon and the text-shadow "lift" on its label.

> This supersedes the glowing indicator that was added in commit `26f35bf` above. If we push, this is the look that should ship.

---

## Quick reference: how to check current state

```
git fetch origin
git status                          # ahead-count + uncommitted files
git log origin/main..HEAD --oneline # commits not on GitHub
git diff                            # uncommitted edits
```
