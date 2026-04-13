<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useItems, getImageUrl, type Item } from "../composables/useItems";
import ItemCard from "../components/ItemCard.vue";

const { baseItems, combinedItems } = useItems();

// --- Hint tooltip visibility (shown only for 3s after page load) ---
const showHintTooltip = ref(true);
let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

// Second hint tooltip – shown once ever (persisted in localStorage),
// appears after the first hint is revealed
const HINT2_TOOLTIP_KEY = "tft-hint2-tooltip-seen";
const showHint2Tooltip = ref(false);
let hint2TooltipTimer: ReturnType<typeof setTimeout> | null = null;

function triggerHint2Tooltip() {
  if (localStorage.getItem(HINT2_TOOLTIP_KEY)) return;
  localStorage.setItem(HINT2_TOOLTIP_KEY, "1");
  showHint2Tooltip.value = true;
  hint2TooltipTimer = setTimeout(() => {
    showHint2Tooltip.value = false;
  }, 3000);
}

onMounted(() => {
  tooltipTimer = setTimeout(() => {
    showHintTooltip.value = false;
  }, 3000);
  document.addEventListener("pointerdown", onPointerDown);
});

onUnmounted(() => {
  if (tooltipTimer) clearTimeout(tooltipTimer);
  if (hint2TooltipTimer) clearTimeout(hint2TooltipTimer);
  document.removeEventListener("pointerdown", onPointerDown);
});

// --- Hint ---
const HINT_DELAY = 1500;
const hintState = ref<"idle" | "loading" | "shown" | "loading2" | "shown2">("idle");
const hintItem = ref<Item | null>(null);
const hint2Item = ref<Item | null>(null);
let hintTimer: ReturnType<typeof setTimeout> | null = null;

// Flag to suppress synthetic mouse events fired after touch on mobile
let touchActive = false;

function resetHint() {
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = null;
  hintState.value = "idle";
  hintItem.value = null;
  hint2Item.value = null;
}

// --- Game state ---
const seenNames = ref<Set<string>>(new Set());
const targetItem = ref<Item | null>(null);
const slot1 = ref<Item | null>(null);
const slot2 = ref<Item | null>(null);
const result = ref<"correct" | "wrong" | null>(null);
const draggedItem = ref<Item | null>(null);
const targetCardRef = ref<HTMLElement | null>(null);

// Close hint popups when clicking/tapping outside the target card
function onPointerDown(e: PointerEvent) {
  const activeStates = ["shown", "shown2", "loading2"];
  if (!activeStates.includes(hintState.value)) return;
  const target = e.target as Node;
  if (!targetCardRef.value?.contains(target)) {
    resetHint();
  }
}

const allSeen = computed(
  () => combinedItems.value.length > 0 &&
        combinedItems.value.every((i) => seenNames.value.has(i.name))
);

function pickRandom() {
  const pool = combinedItems.value.filter((i) => !seenNames.value.has(i.name));
  if (!pool.length) return;
  const item = pool[Math.floor(Math.random() * pool.length)];
  seenNames.value.add(item.name);
  targetItem.value = item;
  slot1.value = null;
  slot2.value = null;
  result.value = null;
  resetHint();
}

// When set changes, reset history and pick a new item
watch(combinedItems, () => {
  seenNames.value.clear();
  pickRandom();
}, { immediate: true });

function onTargetMouseEnter() {
  // Suppress synthetic mouse events fired by browser after touch
  if (touchActive) return;
  if (hintState.value === "loading" || hintState.value === "loading2") return;

  if (hintState.value === "idle") {
    hintState.value = "loading";
    hintTimer = setTimeout(() => {
      if (!targetItem.value?.combine) return;
      hintItem.value = baseItems.value.find((i) => i.name === targetItem.value!.combine![0]) ?? null;
      hintState.value = "shown";
      triggerHint2Tooltip();
    }, HINT_DELAY);
    return;
  }

  if (hintState.value === "shown") {
    hintState.value = "loading2";
    hintTimer = setTimeout(() => {
      if (!targetItem.value?.combine) return;
      hint2Item.value = baseItems.value.find((i) => i.name === targetItem.value!.combine![1]) ?? null;
      hintState.value = "shown2";
    }, HINT_DELAY);
  }
}

function onTargetMouseLeave() {
  if (touchActive) return;
  if (hintState.value === "loading") {
    resetHint();
    return;
  }
  if (hintState.value === "loading2") {
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = null;
    hintState.value = "shown";
  }
  // If "shown" or "shown2" — popup stays until next pickRandom or click outside
}

// Touch handler for mobile: each tap immediately shows next hint (no hold needed)
function onTargetTap(e: PointerEvent) {
  // Only handle touch/pen, not mouse (mouse uses mouseenter/leave)
  if (e.pointerType === "mouse") return;

  // Mark touch as active to suppress the synthetic mouseenter that browsers fire
  // ~300ms after a touch event
  touchActive = true;
  setTimeout(() => { touchActive = false; }, 500);

  e.preventDefault();

  if (hintState.value === "idle") {
    if (!targetItem.value?.combine) return;
    hintItem.value = baseItems.value.find((i) => i.name === targetItem.value!.combine![0]) ?? null;
    hintState.value = "shown";
    triggerHint2Tooltip();
    return;
  }

  if (hintState.value === "shown") {
    if (!targetItem.value?.combine) return;
    hint2Item.value = baseItems.value.find((i) => i.name === targetItem.value!.combine![1]) ?? null;
    hintState.value = "shown2";
  }
}

// --- Drag & Drop (desktop) ---
function onDragStart(item: Item) {
  draggedItem.value = item;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function onDropSlot(slotNum: 1 | 2) {
  if (!draggedItem.value) return;
  result.value = null;
  if (slotNum === 1) slot1.value = draggedItem.value;
  else slot2.value = draggedItem.value;
  draggedItem.value = null;
}

// --- Tap to place (mobile) ---
// Tapping a base item immediately fills the first empty slot.
// If both slots are filled, the tap is ignored (user must clear a slot first).
function onTapItem(item: Item) {
  result.value = null;
  if (!slot1.value) {
    slot1.value = item;
  } else if (!slot2.value) {
    slot2.value = item;
  }
  // Both slots occupied — do nothing
}

function onTapSlot(_slotNum: 1 | 2) {
  // Slots are no longer used as drop targets for tap-to-place;
  // kept for drag-and-drop compatibility.
}

function clearSlot(slotNum: 1 | 2) {
  result.value = null;
  if (slotNum === 1) slot1.value = null;
  else slot2.value = null;
}

// --- Validation ---
const canCheck = computed(() => slot1.value !== null && slot2.value !== null);

function check() {
  if (!targetItem.value || !slot1.value || !slot2.value) return;

  const answer = [slot1.value.name, slot2.value.name].sort().join("|");
  const correct = [...(targetItem.value.combine ?? [])].sort().join("|");

  result.value = answer === correct ? "correct" : "wrong";
}

function next() {
  pickRandom();
}
</script>

<template>
  <div class="training">

    <!-- Target: random combined item -->
    <section class="target-section">
      <p class="section-label">What is this item made of?</p>
      <div
        class="target-card"
        v-if="targetItem"
        ref="targetCardRef"
        @mouseenter="onTargetMouseEnter"
        @mouseleave="onTargetMouseLeave"
        @pointerup="onTargetTap"
      >
        <div class="target-img-wrap">
          <img :src="getImageUrl(targetItem.name)" :alt="targetItem.name" />

          <!-- Hint tooltip: visible only for 3s after page load -->
          <transition name="tooltip-fade">
            <div v-if="showHintTooltip && hintState === 'idle'" class="hint-tooltip">
              Tap / hover for a hint
            </div>
          </transition>

          <!-- Second hint tooltip: shown once after first hint is revealed -->
          <transition name="tooltip-fade">
            <div v-if="showHint2Tooltip && (hintState === 'shown' || hintState === 'loading2' || hintState === 'shown2')" class="hint-tooltip hint-tooltip-2">
              Tap again for a second hint
            </div>
          </transition>

          <!-- Loading ring (hint 1) -->
          <svg
            v-if="hintState === 'loading'"
            class="hint-ring"
            viewBox="0 0 36 36"
          >
            <circle class="hint-ring-track" cx="18" cy="18" r="15" />
            <circle class="hint-ring-fill" cx="18" cy="18" r="15" />
          </svg>

          <!-- Loading ring (hint 2) -->
          <svg
            v-if="hintState === 'loading2'"
            class="hint-ring"
            viewBox="0 0 36 36"
          >
            <circle class="hint-ring-track" cx="18" cy="18" r="15" />
            <circle class="hint-ring-fill" cx="18" cy="18" r="15" />
          </svg>

          <!-- Hint 1 popup -->
          <div v-if="(hintState === 'shown' || hintState === 'loading2' || hintState === 'shown2') && hintItem" class="hint-popup hint-popup-1">
            <img :src="getImageUrl(hintItem.name)" :alt="hintItem.name" />
            <span>{{ hintItem.name }}</span>
          </div>

          <!-- Hint 2 popup -->
          <div v-if="hintState === 'shown2' && hint2Item" class="hint-popup hint-popup-2">
            <img :src="getImageUrl(hint2Item.name)" :alt="hint2Item.name" />
            <span>{{ hint2Item.name }}</span>
          </div>
        </div>

        <span class="target-name">{{ targetItem.name }}</span>
      </div>
    </section>

    <!-- Slots for base items -->
    <section class="slots-section">
      <div
        class="slot"
        :class="{ filled: slot1 }"
        @dragover="onDragOver"
        @drop="onDropSlot(1)"
        @click="onTapSlot(1)"
      >
        <template v-if="slot1">
          <img :src="getImageUrl(slot1.name)" :alt="slot1.name" />
          <span class="slot-name">{{ slot1.name }}</span>
          <button class="clear-btn" @click.stop="clearSlot(1)" title="Remove">✕</button>
        </template>
        <span v-else class="slot-placeholder">Drop here</span>
      </div>

      <span class="plus">+</span>

      <div
        class="slot"
        :class="{ filled: slot2 }"
        @dragover="onDragOver"
        @drop="onDropSlot(2)"
        @click="onTapSlot(2)"
      >
        <template v-if="slot2">
          <img :src="getImageUrl(slot2.name)" :alt="slot2.name" />
          <span class="slot-name">{{ slot2.name }}</span>
          <button class="clear-btn" @click.stop="clearSlot(2)" title="Remove">✕</button>
        </template>
        <span v-else class="slot-placeholder">Drop here</span>
      </div>
    </section>

    <!-- Result + buttons -->
    <section class="actions">
      <div
        v-if="result"
        class="result-badge"
        :class="result"
      >
        {{ result === "correct" ? "Correct!" : "Wrong combination" }}
      </div>

      <div class="buttons">
        <button
          class="btn btn-check"
          :disabled="!canCheck"
          @click="check"
        >
          Confirm
        </button>
        <button class="btn btn-next" :disabled="allSeen" @click="next">
          Next
        </button>
      </div>

      <p v-if="allSeen" class="all-seen">
        All items have been shown. Refresh the page to start over.
      </p>
      <p v-else class="seen-count">
        {{ seenNames.size }} / {{ combinedItems.length }} shown
      </p>
    </section>

    <!-- Base items grid -->
    <section class="base-section">
      <p class="section-label">Base items</p>
      <div class="base-grid">
        <div
          v-for="item in baseItems"
          :key="item.name"
          class="base-item"
          draggable="true"
          @dragstart="onDragStart(item)"
          @click="onTapItem(item)"
        >
          <ItemCard :item="item" />
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.training {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

/* --- Target --- */
.target-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.section-label {
  font-size: 0.8rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.target-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  cursor: default;
}

.target-img-wrap {
  position: relative;
  width: 96px;
  height: 96px;
}

.target-card img {
  width: 96px;
  height: 96px;
  border-radius: 8px;
  border: 2px solid #c89b3c;
  display: block;
}

/* --- Hint tooltip (idle state) --- */
.hint-tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: #1a2035;
  border: 1px solid #2d3a5a;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.68rem;
  color: #64748b;
  white-space: nowrap;
  pointer-events: none;
  z-index: 30;
  animation: tooltip-pulse 1s ease-in-out 0.3s 2;
}

.hint-tooltip::before {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #2d3a5a;
}

/* Second hint tooltip: same style, no repeat animation */
.hint-tooltip-2 {
  animation: tooltip-pulse 1s ease-in-out 0s 2;
}

@keyframes tooltip-pulse {
  0%   { color: #64748b; border-color: #2d3a5a; background: #1a2035; }
  50%  { color: #c89b3c; border-color: #c89b3c; background: #29200a; }
  100% { color: #64748b; border-color: #2d3a5a; background: #1a2035; }
}

.tooltip-fade-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

/* --- Loading ring --- */
.hint-ring {
  position: absolute;
  inset: -6px;
  width: calc(100% + 12px);
  height: calc(100% + 12px);
  pointer-events: none;
  transform: rotate(-90deg);
}

.hint-ring-track {
  fill: none;
  stroke: #2d3a5a;
  stroke-width: 3;
}

.hint-ring-fill {
  fill: none;
  stroke: #c89b3c;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 94.25; /* 2π × 15 */
  stroke-dashoffset: 94.25;
  animation: ring-fill 1.5s linear forwards;
}

@keyframes ring-fill {
  to { stroke-dashoffset: 0; }
}

/* --- Hint popup --- */
.hint-popup {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: #0f1627;
  border: 1px solid #c89b3c;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  z-index: 20;
  animation: popup-in 0.2s ease;
}

.hint-popup::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #c89b3c;
}

/* Hint 1: left side, hint 2: right side */
.hint-popup-1 {
  left: auto;
  right: calc(100% + 12px);
  bottom: 50%;
  transform: translateY(50%);
}

.hint-popup-1::after {
  top: 50%;
  left: 100%;
  transform: translateY(-50%);
  border-top-color: transparent;
  border-left-color: #c89b3c;
}

.hint-popup-2 {
  left: calc(100% + 12px);
  right: auto;
  bottom: 50%;
  transform: translateY(50%);
}

.hint-popup-2::after {
  top: 50%;
  left: auto;
  right: 100%;
  transform: translateY(-50%);
  border-top-color: transparent;
  border-right-color: #c89b3c;
}

.hint-popup img {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  border: 2px solid #2d3a5a;
}

.hint-popup span {
  font-size: 0.75rem;
  font-weight: 600;
  color: #e2e8f0;
}

@keyframes popup-in {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.target-name {
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
}

/* --- Slots --- */
.slots-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.slot {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 8px;
  border: 2px dashed #2d3a5a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s;
  background: #1a2035;
}

.slot:hover {
  border-color: #c89b3c;
}

.slot.filled {
  border-style: solid;
  border-color: #3d5a8a;
}

.slot img {
  width: 72px;
  height: 72px;
  border-radius: 6px;
  object-fit: cover;
}

.slot-name {
  position: absolute;
  bottom: -1.4rem;
  font-size: 0.65rem;
  color: #94a3b8;
  white-space: nowrap;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.slot-placeholder {
  font-size: 0.7rem;
  color: #3d5a8a;
  text-align: center;
  padding: 0 8px;
  pointer-events: none;
}

.clear-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: #e53e3e;
  color: #fff;
  font-size: 0.6rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
}

.plus {
  font-size: 1.5rem;
  color: #64748b;
  user-select: none;
}

/* --- Actions --- */
.actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.buttons {
  display: flex;
  gap: 0.75rem;
}

.btn {
  padding: 0.5rem 1.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  border: 2px solid transparent;
  transition: opacity 0.15s, background 0.15s;
}

.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-check {
  background: #c89b3c;
  color: #0a0e1a;
}

.btn-check:not(:disabled):hover {
  background: #dbb04f;
}

.btn-next {
  background: #1a2035;
  border-color: #2d3a5a;
  color: #94a3b8;
}

.btn-next:hover {
  border-color: #c89b3c;
  color: #e2e8f0;
}

.result-badge {
  font-size: 1rem;
  font-weight: 700;
  padding: 0.4rem 1.5rem;
  border-radius: 999px;
}

.result-badge.correct {
  background: #1a3a2a;
  color: #4ade80;
  border: 1px solid #4ade80;
}

.result-badge.wrong {
  background: #3a1a1a;
  color: #f87171;
  border: 1px solid #f87171;
}

.seen-count {
  font-size: 0.75rem;
  color: #475569;
}

.all-seen {
  font-size: 0.8rem;
  color: #c89b3c;
  text-align: center;
  max-width: 300px;
}

/* --- Base items grid --- */
.base-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.base-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, 64px);
  justify-content: center;
  gap: 10px;
  width: 100%;
}

.base-item {
  cursor: grab;
}

.base-item:active {
  cursor: grabbing;
}

@media (max-width: 600px) {
  .training {
    gap: 1.25rem;
  }

  .target-img-wrap {
    width: 80px;
    height: 80px;
  }

  .target-card img {
    width: 80px;
    height: 80px;
  }

  .slot {
    width: 80px;
    height: 80px;
  }

  .slot img {
    width: 60px;
    height: 60px;
  }

  .actions {
    margin-top: 0.5rem;
  }
}
</style>
