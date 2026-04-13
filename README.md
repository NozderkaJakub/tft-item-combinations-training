# TFT Item Combinations Training

A browser-based quiz app to help **Teamfight Tactics (TFT)** players memorize item recipes — which two base components combine into each completed item.

**Live app:** https://nozderkajakub.github.io/tft-item-combinations-training/

---

## Features

- **Training mode** — interactive quiz: identify the two base ingredients of a displayed combined item, with a progressive hint system and drag-and-drop / tap interaction
- **Learn mode** — structured, lesson-based study system that teaches item recipes in two phases:
  - **Study phase** — read and memorize up to 5 item recipes (combined item + its two base ingredients displayed as cards)
  - **Match phase** — drag or tap base items onto the correct combined item slots; includes spaced-repetition review of items from previous lessons starting at lesson 2; submit to score and proceed
  - Progress (score, lesson index, item ordering) is saved to `localStorage` and restored on next visit
- **Cheat Sheet** — browseable reference grid showing all items and their recipes, with click-to-reveal popups
- **Multi-set support** — switch between TFT sets (16, 4.5, 17) from the header
- Fully client-side, no backend, no login required

## Tech Stack

- Vue 3 (Composition API) + TypeScript
- Vite
- Vue Router 4 (hash-based, GitHub Pages compatible)
- Deployed via GitHub Actions to GitHub Pages

## Keywords

`tft` `teamfight tactics` `item combinations` `item recipes` `tft items` `tft cheat sheet` `tft training` `tft quiz` `league of legends tft` `tft set 16` `tft set 17`

---

✨ _Vibe coded with [Claude Sonnet 4.6](https://www.anthropic.com/claude) + [OpenCode](https://opencode.ai)_ ✨
