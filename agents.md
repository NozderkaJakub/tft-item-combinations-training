# agents.md — AI Coding Assistant Guidelines

This file provides context and rules for AI coding assistants (e.g. Claude, Cursor, Copilot) working on this project.

---

## Project Overview

**TFT Items Combination Training** is a client-side, browser-based quiz app that helps Teamfight Tactics (TFT) players memorize item recipes — which two base items combine into each combined item.

The app has two modes:

- **Training** — an interactive quiz where the player identifies the two base ingredients of a shown combined item, with a progressive hint system and drag-and-drop / tap interaction.
- **Cheat Sheet** — a browseable reference showing all items and their recipes in a side-by-side grid with click-to-reveal popups.

The app supports multiple TFT sets (16, 4.5, 17), selectable from the header. There is no backend, no database, and no build-time data fetching — everything runs from static JSON.

Deployed to GitHub Pages at `/tft-item-combinations-training/`.

---

## Tech Stack & Architecture

| Layer | Technology |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>` SFCs) |
| Language | TypeScript |
| Build tool | Vite |
| Router | Vue Router 4 (hash-based history) |
| Type checking | vue-tsc |
| Package manager | Yarn |
| Deployment | GitHub Actions → GitHub Pages |
| Item images | External CDN: `https://sunderarmor.com/items/` |
| Persistence | `localStorage` (one flag only: hint tooltip seen state) |
| State management | Vue `ref`/`computed` (no Pinia or Vuex) |

### Architecture Summary

```
App.vue (shell: header + set selector + nav + RouterView)
├── Training.vue      ← main quiz game (default route /)
└── CheatSheet.vue    ← reference grid with popups
```

All data flows from `src/composables/useItems.ts`, which:
- Exports a **module-level shared `ref`** (`selectedSet`) — this is the single source of truth for the currently selected TFT set.
- Exports the `useItems()` composable, which returns `computed` arrays (`baseItems`, `combinedItems`) automatically filtered by `selectedSet`.
- Exports the `getImageUrl(name)` helper for converting item names to CDN image URLs.

Switching sets in the header updates `selectedSet`, which reactively re-filters items in all views simultaneously.

---

## File Structure

```
src/
├── assets/
│   └── vue.svg                 # Unused default asset, do not reference
├── components/
│   └── ItemCard.vue            # Reusable item image tile with hover tooltip
├── composables/
│   └── useItems.ts             # Core data layer: types, shared state, computed items, image URL helper
├── router/
│   └── index.ts                # Hash-based routes: / → /training, /cheat-sheet
├── views/
│   ├── Training.vue            # Main quiz/game view (~813 lines)
│   ├── CheatSheet.vue          # Reference view (~551 lines)
│   ├── BaseItems.vue           # Simple base items grid (not registered in router)
│   └── CombinedItems.vue       # Simple combined items grid (not registered in router)
├── App.vue                     # Application shell
├── items-clean.json            # Master item data (147 records, all sets)
├── main.ts                     # App entry point
└── style.css                   # Global CSS resets (mostly overridden by component styles)
```

---

## Data Model

All item data lives in `src/items-clean.json`. The TypeScript interface is defined in `src/composables/useItems.ts`:

```typescript
interface Item {
  name: string;           // English canonical name — used as the primary key everywhere
  id: number;             // Numeric TFT item ID
  set: number[];          // TFT sets this item appears in, e.g. [16, 4.5, 17]
  shadow: boolean;        // Shadow item variant
  radiant: boolean;       // Radiant item variant
  artifact: boolean;      // Artifact item
  tier: number;           // Rarity tier 1–6
  into?: string[];        // BASE items only: names of combined items this contributes to
  combine?: string[];     // COMBINED items only: exactly [base1Name, base2Name]
  stats?: { name: string; value: string }[];
  // + localized name/bonus fields for 11 languages (not used in the UI)
}
```

**Key rules:**
- A **base item** has `into` and no `combine`.
- A **combined item** has `combine` (always a 2-element array) and no `into`.
- `name` is the canonical key used to match ingredients — never use `id` for lookups.
- Both ingredients in `combine` can be the same item (e.g., `["Tear of the Goddess", "Tear of the Goddess"]` for Blue Buff).
- There are exactly **10 base items** and **55 combined items** per set in Set 16.
- The `set` array on each item controls which sets it appears in. Filtering is done reactively via `selectedSet`.
- Localized name fields exist in the JSON but are **not used in the current UI**.

---

## Coding Conventions

### Vue & TypeScript
- Use **Vue 3 Composition API** with `<script setup>` syntax for all components and views.
- All new files must be TypeScript (`.ts` / `.vue` with `lang="ts"`).
- Follow the existing strict TypeScript config (`tsconfig.app.json`). Do not loosen `strict` settings.
- Prefer `computed` over manual watchers. Avoid `watch` unless side effects are unavoidable.

### State Management
- Do **not** add Pinia or Vuex. The app uses a lightweight module-level `ref` pattern intentionally.
- Shared state (cross-view) belongs in `src/composables/useItems.ts` or a new composable file.
- Component-local state stays inside the component.

### Styling
- Styles are written as **scoped CSS** inside each `.vue` file (`<style scoped>`).
- The color palette uses CSS variables defined in `App.vue`. Reuse existing variables (`--gold`, `--bg-dark`, `--border-gold`, etc.) rather than hardcoding colors.
- The theme is dark navy (`#0a0e1a`) with TFT gold (`#c89b3c`) accents. Maintain this throughout.
- Do **not** introduce a CSS framework (Tailwind, Bootstrap, etc.).

### Routing
- Router uses hash-based history (`createWebHashHistory`) — this is required for GitHub Pages. Do **not** change it to HTML5 history.
- Routes use component-level code-splitting (`() => import(...)`) for lazy loading.

### Images
- All item images are served from the external CDN via `getImageUrl(name)` in `useItems.ts`.
- Always use `getImageUrl` — do not construct image URLs manually.
- Use `loading="lazy"` on all item `<img>` elements.

### Naming
- Vue components: `PascalCase` filenames and component names.
- Composables: `camelCase` with `use` prefix (e.g., `useItems`).
- Item names from the JSON are used as-is (English canonical form) for all lookups and comparisons.

---

## What to Avoid

- **Do not add a backend or database.** The app is intentionally fully static and client-side.
- **Do not modify `items-clean.json` structure** without updating the `Item` interface in `useItems.ts` and all consumers. The `name` field is a primary key used across the entire app.
- **Do not use `id` for item lookups** — always use `name`.
- **Do not introduce Pinia, Vuex, or any other state management library.** The current pattern is intentional.
- **Do not change the Vite `base` path** in `vite.config.ts` — it must remain `/tft-item-combinations-training/` for GitHub Pages deployment.
- **Do not switch the router to HTML5 history** — GitHub Pages does not support server-side rewrites.
- **Do not hardcode item image URLs** — always use `getImageUrl()`.
- **Do not add routes for `BaseItems.vue` or `CombinedItems.vue`** without first confirming intent — they are currently unused development utilities.
- **Do not use `localStorage` for new features** without strong justification. It is currently used only for the one-time hint tooltip flag.
- **Do not import from `node_modules`, `dist`, or `local/`** — these are gitignored and must not be referenced from source.

---

## Feature Implementation Guide

### Adding a New View / Route

1. Create the component in `src/views/NewView.vue` using `<script setup lang="ts">`.
2. Import `useItems` from `../composables/useItems` to access item data.
3. Register the route in `src/router/index.ts` using lazy import:
   ```ts
   { path: '/new-view', component: () => import('../views/NewView.vue') }
   ```
4. Add a `<RouterLink to="/new-view">` in the nav section of `App.vue`.

### Adding a New TFT Set

1. Add the new set value to the `SETS` constant in `src/composables/useItems.ts`.
2. Add the set number to the `SetValue` union type.
3. Add the new items to `src/items-clean.json` with the correct `set` array values.
4. No other changes are needed — filtering is fully reactive.

### Adding a New Item

1. Add the item object to `src/items-clean.json`, following the existing `Item` shape.
2. For a **base item**: populate `into` with the names of combined items it creates; leave `combine` absent.
3. For a **combined item**: populate `combine` with exactly two base item names (can be identical); leave `into` absent.
4. Ensure the item's CDN image exists at `https://sunderarmor.com/items/<NormalizedName>.png`. The normalization logic is in `getImageUrl()` in `useItems.ts` — verify the URL resolves correctly.

### Adding a New Game Mode

1. Create the view in `src/views/`.
2. Import `useItems` for item data access — do not duplicate the item data or filtering logic.
3. Register the route in `src/router/index.ts`.
4. Add a nav tab in `App.vue`.
5. Follow the existing drag-and-drop / tap interaction patterns from `Training.vue` if the mode involves item selection.

### Modifying the Hint System

The hint system in `Training.vue` is a 5-state machine (`"idle"` | `"loading"` | `"shown"` | `"loading2"` | `"shown2"`). The loading animation is a CSS ring that fills over 1.5 seconds. Desktop uses `mouseenter`/`mouseleave` events; mobile uses `pointerup` with `pointerType === "touch"`. Keep both paths in sync when modifying hint behavior.

---

## Keeping Documentation Up to Date

When making changes that affect the project's structure, features, architecture, or conventions, update the relevant documentation files as part of the same task:

- **`AGENTS.md`** — update whenever you:
  - Add, remove, or rename source files or directories (update the File Structure section)
  - Change the tech stack, router configuration, or build setup
  - Add a new TFT set or change the set list
  - Introduce new coding conventions or architectural patterns
  - Add new reusable composables or components
  - Change the data model (`Item` interface or `items-clean.json` structure)
  - Add a new game mode or view (update the Feature Implementation Guide)

- **`README.md`** — update whenever you:
  - Add or remove user-facing features or game modes
  - Change how the app is run, built, or deployed
  - Add prerequisites or new environment requirements
  - Change the project description in a way visible to end users or contributors

Both files should always accurately reflect the current state of the project. Do not leave them stale after structural or feature changes.
