<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useItems, getImageUrl, type Item } from "../composables/useItems";
import ItemCard from "../components/ItemCard.vue";

const { baseItems, combinedItems } = useItems();

// --- Podpowiedź (hint) ---
const HINT_DELAY = 1500;
const hintState = ref<"idle" | "loading" | "shown">("idle");
const hintItem = ref<Item | null>(null);
let hintTimer: ReturnType<typeof setTimeout> | null = null;

function resetHint() {
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = null;
  hintState.value = "idle";
  hintItem.value = null;
}

// --- Stan gry ---
const seenNames = ref<Set<string>>(new Set());
const targetItem = ref<Item | null>(null);
const slot1 = ref<Item | null>(null);
const slot2 = ref<Item | null>(null);
const result = ref<"correct" | "wrong" | null>(null);
const draggedItem = ref<Item | null>(null);

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

// Gdy zmienia się set, zresetuj historię i losuj nowy przedmiot
watch(combinedItems, () => {
  seenNames.value.clear();
  pickRandom();
}, { immediate: true });

function onTargetMouseEnter() {
  if (hintState.value !== "idle") return;
  hintState.value = "loading";
  hintTimer = setTimeout(() => {
    if (!targetItem.value?.combine) return;
    const pick = targetItem.value.combine[0];
    // Znajdź obiekt Item po nazwie spośród baseItems
    hintItem.value = baseItems.value.find((i) => i.name === pick) ?? null;
    hintState.value = "shown";
  }, HINT_DELAY);
}

function onTargetMouseLeave() {
  if (hintState.value === "loading") {
    resetHint();
  }
  // Jeśli "shown" — popup zostaje do następnego pickRandom
}

// --- Drag & Drop ---
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

function clearSlot(slotNum: 1 | 2) {
  result.value = null;
  if (slotNum === 1) slot1.value = null;
  else slot2.value = null;
}

// --- Sprawdzenie ---
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

    <!-- Cel: losowy przedmiot złożony -->
    <section class="target-section">
      <p class="section-label">Z czego składa się ten przedmiot?</p>
      <div
        class="target-card"
        v-if="targetItem"
        @mouseenter="onTargetMouseEnter"
        @mouseleave="onTargetMouseLeave"
      >
        <div class="target-img-wrap">
          <img :src="getImageUrl(targetItem.name)" :alt="targetItem.name" />

          <!-- Loading ring -->
          <svg
            v-if="hintState === 'loading'"
            class="hint-ring"
            viewBox="0 0 36 36"
          >
            <circle class="hint-ring-track" cx="18" cy="18" r="15" />
            <circle class="hint-ring-fill" cx="18" cy="18" r="15" />
          </svg>

          <!-- Popup z podpowiedzią -->
          <div v-if="hintState === 'shown' && hintItem" class="hint-popup">
            <img :src="getImageUrl(hintItem.name)" :alt="hintItem.name" />
            <span>{{ hintItem.name }}</span>
          </div>
        </div>

        <span class="target-name">{{ targetItem.name }}</span>
      </div>
    </section>

    <!-- Sloty na przedmioty bazowe -->
    <section class="slots-section">
      <div
        class="slot"
        :class="{ filled: slot1, 'drag-over': false }"
        @dragover="onDragOver"
        @drop="onDropSlot(1)"
      >
        <template v-if="slot1">
          <img :src="getImageUrl(slot1.name)" :alt="slot1.name" />
          <span class="slot-name">{{ slot1.name }}</span>
          <button class="clear-btn" @click="clearSlot(1)" title="Usuń">✕</button>
        </template>
        <span v-else class="slot-placeholder">Upuść tutaj</span>
      </div>

      <span class="plus">+</span>

      <div
        class="slot"
        :class="{ filled: slot2 }"
        @dragover="onDragOver"
        @drop="onDropSlot(2)"
      >
        <template v-if="slot2">
          <img :src="getImageUrl(slot2.name)" :alt="slot2.name" />
          <span class="slot-name">{{ slot2.name }}</span>
          <button class="clear-btn" @click="clearSlot(2)" title="Usuń">✕</button>
        </template>
        <span v-else class="slot-placeholder">Upuść tutaj</span>
      </div>
    </section>

    <!-- Wynik + przyciski -->
    <section class="actions">
      <div
        v-if="result"
        class="result-badge"
        :class="result"
      >
        {{ result === "correct" ? "Poprawnie!" : "Błędna kombinacja" }}
      </div>

      <div class="buttons">
        <button
          class="btn btn-check"
          :disabled="!canCheck"
          @click="check"
        >
          Zatwierdź
        </button>
        <button class="btn btn-next" :disabled="allSeen" @click="next">
          Następny
        </button>
      </div>

      <p v-if="allSeen" class="all-seen">
        Wszystkie przedmioty zostały pokazane. Odśwież stronę, aby zacząć od nowa.
      </p>
      <p v-else class="seen-count">
        {{ seenNames.size }} / {{ combinedItems.length }} pokazanych
      </p>
    </section>

    <!-- Siatka przedmiotów bazowych -->
    <section class="base-section">
      <p class="section-label">Przedmioty bazowe</p>
      <div class="base-grid">
        <div
          v-for="item in baseItems"
          :key="item.name"
          class="base-item"
          draggable="true"
          @dragstart="onDragStart(item)"
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

/* --- Cel --- */
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

/* --- Sloty --- */
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

/* --- Akcje --- */
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

/* --- Siatka bazowych --- */
.base-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.base-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 10px;
  width: 100%;
}

.base-item {
  cursor: grab;
}

.base-item:active {
  cursor: grabbing;
}
</style>
