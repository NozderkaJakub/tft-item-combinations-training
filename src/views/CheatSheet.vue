<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useItems, getImageUrl, type Item } from "../composables/useItems";

const { baseItems, combinedItems } = useItems();

const selectedBase = ref<Item | null>(null);
const selectedCombined = ref<Item | null>(null);

const baseGridRef = ref<HTMLElement | null>(null);
const combinedGridRef = ref<HTMLElement | null>(null);
const baseDetailRef = ref<HTMLElement | null>(null);
const combinedDetailRef = ref<HTMLElement | null>(null);

// Popup position – computed from the clicked button, applied as inline style
// on the teleported fixed element
const popupStyle = ref<Record<string, string>>({});

// When a base item is clicked: build recipe rows
// Each row = { otherBase: Item, result: Item }
const baseRecipes = computed(() => {
  if (!selectedBase.value) return [];
  const results: { otherBase: Item | null; result: Item }[] = [];
  for (const combined of combinedItems.value) {
    if (!combined.combine) continue;
    if (!combined.combine.includes(selectedBase.value.name)) continue;
    // Use index to find "the other" ingredient so that
    // double-same-base items (e.g. Sword + Sword) are handled correctly.
    const firstIdx = combined.combine.indexOf(selectedBase.value.name);
    const otherIdx = firstIdx === 0 ? 1 : 0;
    const otherName = combined.combine[otherIdx] ?? null;
    const otherBase = otherName
      ? baseItems.value.find((b) => b.name === otherName) ?? null
      : null;
    results.push({ otherBase, result: combined });
  }
  // Sort alphabetically by result name
  results.sort((a, b) => a.result.name.localeCompare(b.result.name));
  return results;
});

// When a combined item is clicked: show the two base components
const combinedRecipe = computed(() => {
  if (!selectedCombined.value?.combine) return [];
  return selectedCombined.value.combine.map(
    (name) => baseItems.value.find((b) => b.name === name) ?? null
  );
});

// Returns the two base component Items for a given combined item
function getComponents(item: Item): [Item | null, Item | null] {
  if (!item.combine || item.combine.length < 2) return [null, null];
  const a = baseItems.value.find((b) => b.name === item.combine![0]) ?? null;
  const b = baseItems.value.find((b) => b.name === item.combine![1]) ?? null;
  return [a, b];
}

function closeAll() {
  selectedBase.value = null;
  selectedCombined.value = null;
}

/**
 * Compute `position: fixed` top/left/maxWidth for the popup.
 *
 * Strategy:
 *   top    = btn.bottom + 6px (below the button)
 *   left   = btn.left  (desktop) | gridEl.left  (mobile, ≤600px)
 *   right  = never exceeds window.innerWidth - 8
 *
 * We do NOT use Math.max(8, left) because that is what caused the popup to
 * always be stuck at the left edge: on a narrow screen
 *   window.innerWidth - 8 - POPUP_MAX_W  can be negative,
 *   Math.min(btn.left, negative) → negative,
 *   Math.max(8, negative) → 8.
 *
 * Instead we compute `left` first and then derive `maxWidth` so the right
 * edge = left + maxWidth never exceeds window.innerWidth - 8.
 */
function positionPopup(btn: HTMLElement, gridEl: HTMLElement | null) {
  const btnRect = btn.getBoundingClientRect();
  const GAP = 6;
  const EDGE = 8; // minimum distance from right viewport edge

  const isMobile = window.innerWidth <= 600;

  // Left anchor: on mobile align to the grid container; on desktop to the button
  let leftAnchor: number;
  if (isMobile && gridEl) {
    leftAnchor = gridEl.getBoundingClientRect().left;
  } else {
    leftAnchor = btnRect.left;
  }

  // Available width from leftAnchor to right viewport edge (with margin)
  const availableWidth = window.innerWidth - leftAnchor - EDGE;
  // Cap at a sensible maximum
  const maxWidth = Math.min(380, availableWidth);

  popupStyle.value = {
    top: `${btnRect.bottom + GAP}px`,
    left: `${leftAnchor}px`,
    width: `${maxWidth}px`,
  };

  // After Vue renders the popup, check if it goes below the viewport and flip
  // it above the button if needed.
  nextTick(() => {
    const el = baseDetailRef.value ?? combinedDetailRef.value;
    if (!el) return;
    const popRect = el.getBoundingClientRect();
    if (popRect.bottom > window.innerHeight - EDGE) {
      popupStyle.value = {
        ...popupStyle.value,
        top: `${Math.max(EDGE, btnRect.top - GAP - popRect.height)}px`,
      };
    }
  });
}

function selectBase(item: Item, e: MouseEvent) {
  selectedCombined.value = null;
  if (selectedBase.value?.name === item.name) {
    selectedBase.value = null;
    return;
  }
  selectedBase.value = item;
  nextTick(() => positionPopup(e.currentTarget as HTMLElement, baseGridRef.value));
}

function selectCombined(item: Item, e: MouseEvent) {
  selectedBase.value = null;
  if (selectedCombined.value?.name === item.name) {
    selectedCombined.value = null;
    return;
  }
  selectedCombined.value = item;
  nextTick(() => positionPopup(e.currentTarget as HTMLElement, combinedGridRef.value));
}

// Close popup on pointerdown outside – pointerdown fires on both mouse and touch
function onPointerDown(e: PointerEvent) {
  const target = e.target as Node;
  const insideBase =
    baseGridRef.value?.contains(target) || baseDetailRef.value?.contains(target);
  const insideCombined =
    combinedGridRef.value?.contains(target) || combinedDetailRef.value?.contains(target);
  if (!insideBase && !insideCombined) {
    closeAll();
  }
}

onMounted(() => document.addEventListener("pointerdown", onPointerDown));
onUnmounted(() => document.removeEventListener("pointerdown", onPointerDown));
</script>

<template>
  <div class="cheat-sheet">

    <!-- Left: base items -->
    <section class="panel panel-base">
      <h2 class="panel-title">Base items</h2>
      <div class="base-grid" ref="baseGridRef">
        <button
          v-for="item in baseItems"
          :key="item.name"
          class="item-btn"
          :class="{ active: selectedBase?.name === item.name }"
          @click="selectBase(item, $event)"
          :title="item.name"
        >
          <img :src="getImageUrl(item.name)" :alt="item.name" />
          <span class="item-label">{{ item.name }}</span>
        </button>
      </div>
    </section>

    <!-- Right: combined items -->
    <section class="panel panel-combined">
      <h2 class="panel-title">Combined items</h2>
      <div class="combined-grid" ref="combinedGridRef">
        <button
          v-for="item in combinedItems"
          :key="item.name"
          class="item-btn item-btn-sm"
          :class="{ active: selectedCombined?.name === item.name }"
          @click="selectCombined(item, $event)"
          :title="item.name"
        >
          <div class="combined-img-wrap">
            <img :src="getImageUrl(item.name)" :alt="item.name" />
            <template v-for="(comp, idx) in getComponents(item)" :key="idx">
              <img
                v-if="comp"
                :src="getImageUrl(comp.name)"
                :alt="comp.name"
                class="component-badge"
                :class="idx === 0 ? 'component-badge-left' : 'component-badge-right'"
                :title="comp.name"
              />
            </template>
          </div>
          <span class="item-label">{{ item.name }}</span>
        </button>
      </div>
    </section>

  </div>

  <!-- Popups rendered at body level via Teleport so they escape overflow:hidden parents -->
  <Teleport to="body">
    <transition name="popup-fade">
      <div
        v-if="selectedBase"
        class="cs-popup"
        ref="baseDetailRef"
        :style="popupStyle"
      >
        <p class="detail-title">
          <img :src="getImageUrl(selectedBase.name)" :alt="selectedBase.name" class="detail-title-img" />
          <span>{{ selectedBase.name }}</span>
          <span class="detail-sub">combines into {{ baseRecipes.length }} items</span>
        </p>
        <div class="recipe-list">
          <div v-for="row in baseRecipes" :key="row.result.name" class="recipe-row">
            <span class="plus-sign">+</span>
            <template v-if="row.otherBase">
              <img :src="getImageUrl(row.otherBase.name)" :alt="row.otherBase.name" class="ri" />
              <span class="recipe-name-small">{{ row.otherBase.name }}</span>
            </template>
            <span v-else class="ri-placeholder">?</span>
            <span class="arrow">→</span>
            <img :src="getImageUrl(row.result.name)" :alt="row.result.name" class="ri ri-result" />
            <span class="recipe-name">{{ row.result.name }}</span>
          </div>
        </div>
      </div>
    </transition>

    <transition name="popup-fade">
      <div
        v-if="selectedCombined"
        class="cs-popup"
        ref="combinedDetailRef"
        :style="popupStyle"
      >
        <p class="detail-title">
          <img :src="getImageUrl(selectedCombined.name)" :alt="selectedCombined.name" class="detail-title-img" />
          <span>{{ selectedCombined.name }}</span>
          <span class="detail-sub">is crafted from</span>
        </p>
        <div class="recipe-row recipe-row-combined">
          <template v-for="(comp, idx) in combinedRecipe" :key="idx">
            <span v-if="idx > 0" class="plus-sign">+</span>
            <template v-if="comp">
              <img :src="getImageUrl(comp.name)" :alt="comp.name" class="ri ri-lg" />
              <span class="recipe-name">{{ comp.name }}</span>
            </template>
            <span v-else class="ri-placeholder ri-lg">?</span>
          </template>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* --- Layout --- */
.cheat-sheet {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1.5rem;
  height: calc(100vh - 200px);
  min-height: 0;
}

@media (max-width: 600px) {
  .cheat-sheet {
    grid-template-columns: 1fr;
    height: auto;
  }

  .panel {
    overflow-y: visible;
  }
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  overflow-y: auto;
}

.panel-combined {
  overflow-y: visible;
}

.panel-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  flex-shrink: 0;
}

/* --- Grids --- */
.base-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 6px;
  overflow-y: auto;
  flex-shrink: 0;
}

.combined-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 5px;
  align-items: start;
  align-content: start;
}

/* --- Item buttons --- */
.item-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: #1a2035;
  border: 2px solid #2d3a5a;
  border-radius: 8px;
  padding: 5px 4px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.item-btn:hover {
  border-color: #c89b3c;
}

.item-btn.active {
  border-color: #c89b3c;
  background: #29200a;
}

.item-btn > img {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  display: block;
}

.item-btn-sm > img,
.item-btn-sm .combined-img-wrap > img:first-child {
  width: 36px;
  height: 36px;
}

/* --- Combined item: ingredient badges in bottom corners --- */
.combined-img-wrap {
  position: relative;
  display: inline-block;
  line-height: 0;
}

.component-badge {
  position: absolute;
  bottom: -3px;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid #0f1627;
  background: #0f1627;
  pointer-events: none;
}

.component-badge-left {
  left: -2px;
}

.component-badge-right {
  right: -2px;
}

.item-label {
  font-size: 0.52rem;
  color: #94a3b8;
  text-align: center;
  line-height: 1.2;
  max-width: 54px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

@media (max-width: 600px) {
  .item-btn > img {
    width: 56px;
    height: 56px;
  }

  .item-btn-sm > img,
  .item-btn-sm .combined-img-wrap > img:first-child {
    width: 48px;
    height: 48px;
  }

  .component-badge {
    width: 18px;
    height: 18px;
  }

  .item-label {
    font-size: 0.65rem;
    max-width: 64px;
  }

  .base-grid {
    grid-template-columns: repeat(auto-fill, minmax(66px, 1fr));
    gap: 6px;
  }

  .combined-grid {
    grid-template-columns: repeat(auto-fill, minmax(66px, 1fr));
    gap: 6px;
  }
}

/* --- Fade transition --- */
.popup-fade-enter-active,
.popup-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.popup-fade-enter-from,
.popup-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>

<!-- cs-popup is teleported to <body> so it needs non-scoped global styles -->
<style>
.cs-popup {
  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
  background: #0f1627;
  border: 1px solid #2d3a5a;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  overflow-x: hidden;
  overflow-y: auto;
  max-height: calc(100vh - 80px);
}

.cs-popup .detail-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0.6rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #e2e8f0;
  flex-wrap: wrap;
}

.cs-popup .detail-title-img {
  width: 28px;
  height: 28px;
  border-radius: 4px;
}

.cs-popup .detail-sub {
  font-size: 0.72rem;
  font-weight: 400;
  color: #64748b;
  margin-left: 2px;
}

.cs-popup .recipe-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cs-popup .recipe-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.cs-popup .recipe-row-combined {
  gap: 10px;
  margin-top: 0.25rem;
}

.cs-popup .ri {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  flex-shrink: 0;
}

.cs-popup .ri-lg {
  width: 40px;
  height: 40px;
  border-radius: 6px;
}

.cs-popup .ri-result {
  border: 1px solid #c89b3c;
}

.cs-popup .ri-placeholder {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: #2d3a5a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #64748b;
  flex-shrink: 0;
}

.cs-popup .plus-sign {
  font-size: 0.9rem;
  color: #64748b;
  user-select: none;
}

.cs-popup .arrow {
  font-size: 0.9rem;
  color: #c89b3c;
  user-select: none;
  margin: 0 2px;
}

.cs-popup .recipe-name {
  font-size: 0.75rem;
  color: #c89b3c;
  font-weight: 600;
}

.cs-popup .recipe-name-small {
  font-size: 0.65rem;
  color: #94a3b8;
}
</style>
