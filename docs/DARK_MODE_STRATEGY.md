# Dark Mode Strategy

## Overview

Dark mode is implemented using a **CSS-variable-first + override stylesheet** approach. All styling work is isolated to 3-4 files that do not conflict with functional component changes being made by other contributors.

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
