<script setup lang="ts">
import { ref, computed } from "vue";
import { getImageUrl } from "../composables/useItems";
import { useLessons } from "../composables/useLessons";

const {
  currentLessonIndex,
  totalLessons,
  finished,
  totalScore,
  totalPossible,
  currentLessonItems,
  matchPhaseItems,
  matchPhaseBasePool,
  submitLesson,
  resetLessons,
} = useLessons();

// ---- Phase management ----
// "learn"  — show items + their ingredients, user reads and confirms ready
// "match"  — user drags/taps base items onto combined item slots
// "result" — per-lesson result screen before going to next lesson
type Phase = "learn" | "match" | "result";
const phase = ref<Phase>("learn");

function startMatch() {
  initMatchState();
  phase.value = "match";
}

// ---- Match phase state ----

// For each combined item we need to fill two slots (indices 0 and 1)
// assignments[combinedItemName][slotIndex] = baseItemName | null
interface SlotMap {
  [combinedItemName: string]: [string | null, string | null];
}

const assignments = ref<SlotMap>({});
// remaining base items (names, with repeats). We remove one entry when placed.
const remainingPool = ref<string[]>([]);
// dragging / tap selection
const draggingItem = ref<string | null>(null);
const selectedItem = ref<string | null>(null); // tap selection highlight

function initMatchState() {
  const slots: SlotMap = {};
  for (const item of matchPhaseItems.value) {
    slots[item.name] = [null, null];
  }
  assignments.value = slots;
  remainingPool.value = [...matchPhaseBasePool.value];
  draggingItem.value = null;
  selectedItem.value = null;
  lessonScore.value = null;
}

// ---- Drag helpers ----
function onDragStart(baseItemName: string) {
  draggingItem.value = baseItemName;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function onDropSlot(combinedName: string, slotIdx: 0 | 1, e: DragEvent) {
  e.preventDefault();
  const name = draggingItem.value;
  if (!name) return;
  placeItem(name, combinedName, slotIdx);
  draggingItem.value = null;
}

// ---- Tap / click helpers ----
function onTapBaseItem(baseItemName: string) {
  if (selectedItem.value === baseItemName) {
    selectedItem.value = null;
    return;
  }
  selectedItem.value = baseItemName;
}

function onTapSlot(combinedName: string, slotIdx: 0 | 1) {
  if (!selectedItem.value) return;
  placeItem(selectedItem.value, combinedName, slotIdx);
  selectedItem.value = null;
}

function placeItem(baseItemName: string, combinedName: string, slotIdx: 0 | 1) {
  const slots = assignments.value[combinedName];
  if (!slots) return;
  // If slot already filled — return the old item to pool first
  const existing = slots[slotIdx];
  if (existing) {
    remainingPool.value.push(existing);
  }
  // Place
  slots[slotIdx] = baseItemName;
  // Remove from pool (first occurrence only)
  const idx = remainingPool.value.indexOf(baseItemName);
  if (idx !== -1) remainingPool.value.splice(idx, 1);
}

function clearSlot(combinedName: string, slotIdx: 0 | 1) {
  const slots = assignments.value[combinedName];
  if (!slots) return;
  const existing = slots[slotIdx];
  if (!existing) return;
  slots[slotIdx] = null;
  remainingPool.value.push(existing);
}

// All slots filled?
const allSlotsFilled = computed(() => {
  return matchPhaseItems.value.every((item) => {
    const slots = assignments.value[item.name];
    return slots && slots[0] !== null && slots[1] !== null;
  });
});

// ---- Submission & scoring ----
const lessonScore = ref<{ correct: number; possible: number } | null>(null);

// Per-item correctness after submit
const itemCorrectness = ref<Record<string, boolean>>({});

function submitMatch() {
  let correct = 0;
  const correctness: Record<string, boolean> = {};
  for (const item of matchPhaseItems.value) {
    const slots = assignments.value[item.name];
    if (!slots) { correctness[item.name] = false; continue; }
    const answer = [slots[0] ?? "", slots[1] ?? ""].sort().join("|");
    const expected = [...item.combine].sort().join("|");
    const isCorrect = answer === expected;
    correctness[item.name] = isCorrect;
    if (isCorrect) correct++;
  }
  const possible = matchPhaseItems.value.length;
  itemCorrectness.value = correctness;
  lessonScore.value = { correct, possible };
  submitLesson(correct, possible);
  phase.value = "result";
}

function nextLesson() {
  if (finished.value) return;
  phase.value = "learn";
}

function handleReset() {
  resetLessons();
  phase.value = "learn";
}

// Unique pool items for display (keep duplicates shown multiple times)
// We just render remainingPool as-is since duplicates are desired
</script>

<template>
  <div class="lessons">

    <!-- ===== HEADER BAR ===== -->
    <div class="lessons-header">
      <div class="lesson-progress">
        <span class="lesson-counter">
          Lesson {{ Math.min(currentLessonIndex + 1, totalLessons) }} / {{ totalLessons }}
        </span>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: (currentLessonIndex / totalLessons * 100) + '%' }"
          />
        </div>
      </div>
      <button class="btn btn-reset" @click="handleReset" title="Reset all lessons">
        Reset
      </button>
    </div>

    <!-- ===== FINISHED SCREEN ===== -->
    <template v-if="finished">
      <div class="finish-screen">
        <h2 class="finish-title">All lessons complete!</h2>
        <div class="finish-score">
          <span class="score-big">{{ totalScore }}</span>
          <span class="score-sep">/</span>
          <span class="score-big">{{ totalPossible }}</span>
        </div>
        <p class="finish-sub">correct answers across all lessons</p>
        <button class="btn btn-primary" @click="handleReset">Start over</button>
      </div>
    </template>

    <!-- ===== LEARN PHASE ===== -->
    <template v-else-if="phase === 'learn'">
      <p class="phase-label">Study these items</p>
      <div class="learn-grid">
        <div
          v-for="item in currentLessonItems"
          :key="item.name"
          class="learn-card"
        >
          <div class="learn-combined">
            <img :src="getImageUrl(item.name)" :alt="item.name" loading="lazy" />
            <span class="item-name">{{ item.name }}</span>
          </div>
          <span class="equals">=</span>
          <div class="learn-recipe">
            <div class="recipe-item">
              <img :src="getImageUrl(item.combine[0])" :alt="item.combine[0]" loading="lazy" />
              <span class="item-name small">{{ item.combine[0] }}</span>
            </div>
            <span class="plus">+</span>
            <div class="recipe-item">
              <img :src="getImageUrl(item.combine[1])" :alt="item.combine[1]" loading="lazy" />
              <span class="item-name small">{{ item.combine[1] }}</span>
            </div>
          </div>
        </div>
      </div>
      <button class="btn btn-primary ready-btn" @click="startMatch">
        I'm ready — start matching
      </button>
    </template>

    <!-- ===== MATCH PHASE ===== -->
    <template v-else-if="phase === 'match'">
      <p class="phase-label">Match base items to combined items</p>

      <!-- Combined items with slots -->
      <div class="match-combined-list">
        <div
          v-for="item in matchPhaseItems"
          :key="item.name"
          class="match-row"
        >
          <!-- Combined item icon -->
          <div class="match-combined-icon">
            <img :src="getImageUrl(item.name)" :alt="item.name" loading="lazy" />
            <span class="item-name small">{{ item.name }}</span>
          </div>

          <span class="equals">=</span>

          <!-- Slot 0 -->
          <div
            class="match-slot"
            :class="{
              filled: assignments[item.name]?.[0] != null,
              'drop-target': true,
            }"
            @dragover="onDragOver"
            @drop="onDropSlot(item.name, 0, $event)"
            @click="onTapSlot(item.name, 0)"
          >
            <template v-if="assignments[item.name]?.[0]">
              <img
                :src="getImageUrl(assignments[item.name][0]!)"
                :alt="assignments[item.name][0]!"
                loading="lazy"
              />
              <button
                class="clear-btn"
                @click.stop="clearSlot(item.name, 0)"
                title="Remove"
              >✕</button>
            </template>
            <span v-else class="slot-placeholder">?</span>
          </div>

          <span class="plus">+</span>

          <!-- Slot 1 -->
          <div
            class="match-slot"
            :class="{
              filled: assignments[item.name]?.[1] != null,
              'drop-target': true,
            }"
            @dragover="onDragOver"
            @drop="onDropSlot(item.name, 1, $event)"
            @click="onTapSlot(item.name, 1)"
          >
            <template v-if="assignments[item.name]?.[1]">
              <img
                :src="getImageUrl(assignments[item.name][1]!)"
                :alt="assignments[item.name][1]!"
                loading="lazy"
              />
              <button
                class="clear-btn"
                @click.stop="clearSlot(item.name, 1)"
                title="Remove"
              >✕</button>
            </template>
            <span v-else class="slot-placeholder">?</span>
          </div>
        </div>
      </div>

      <!-- Base item pool -->
      <div class="pool-section">
        <p class="phase-label">Available base items</p>
        <div class="pool-grid">
          <div
            v-for="(baseName, idx) in remainingPool"
            :key="`${baseName}-${idx}`"
            class="pool-item"
            :class="{ selected: selectedItem === baseName }"
            draggable="true"
            @dragstart="onDragStart(baseName)"
            @click="onTapBaseItem(baseName)"
          >
            <img :src="getImageUrl(baseName)" :alt="baseName" loading="lazy" />
            <span class="item-name small">{{ baseName }}</span>
          </div>
        </div>
      </div>

      <div class="match-actions">
        <button
          class="btn btn-primary"
          :disabled="!allSlotsFilled"
          @click="submitMatch"
        >
          Submit
        </button>
      </div>
    </template>

    <!-- ===== RESULT PHASE ===== -->
    <template v-else-if="phase === 'result'">
      <div class="result-section">
        <div class="result-score-badge" :class="lessonScore && lessonScore.correct === lessonScore.possible ? 'perfect' : 'partial'">
          {{ lessonScore?.correct }} / {{ lessonScore?.possible }} correct
        </div>

        <div class="result-items-list">
          <div
            v-for="item in matchPhaseItems"
            :key="item.name"
            class="result-row"
            :class="itemCorrectness[item.name] ? 'correct' : 'wrong'"
          >
            <img :src="getImageUrl(item.name)" :alt="item.name" loading="lazy" class="result-icon" />
            <span class="result-item-name">{{ item.name }}</span>
            <span class="result-arrow">=</span>
            <!-- What user answered -->
            <div class="result-answer">
              <template v-if="assignments[item.name]">
                <img
                  v-if="assignments[item.name][0]"
                  :src="getImageUrl(assignments[item.name][0]!)"
                  :alt="assignments[item.name][0]!"
                  loading="lazy"
                  class="result-base-icon"
                />
                <span class="plus-sm">+</span>
                <img
                  v-if="assignments[item.name][1]"
                  :src="getImageUrl(assignments[item.name][1]!)"
                  :alt="assignments[item.name][1]!"
                  loading="lazy"
                  class="result-base-icon"
                />
              </template>
            </div>
            <span v-if="!itemCorrectness[item.name]" class="correct-label">
              ✓
              <img :src="getImageUrl(item.combine[0])" :alt="item.combine[0]" loading="lazy" class="result-base-icon" />
              <span class="plus-sm">+</span>
              <img :src="getImageUrl(item.combine[1])" :alt="item.combine[1]" loading="lazy" class="result-base-icon" />
            </span>
          </div>
        </div>

        <div class="result-actions">
          <template v-if="!finished">
            <button class="btn btn-primary" @click="nextLesson">
              Next lesson
            </button>
          </template>
          <template v-else>
            <div class="finish-screen">
              <h2 class="finish-title">All lessons complete!</h2>
              <div class="finish-score">
                <span class="score-big">{{ totalScore }}</span>
                <span class="score-sep">/</span>
                <span class="score-big">{{ totalPossible }}</span>
              </div>
              <p class="finish-sub">correct answers total</p>
              <button class="btn btn-primary" @click="handleReset">Start over</button>
            </div>
          </template>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
.lessons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.75rem;
  width: 100%;
}

/* ---- Header ---- */
.lessons-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 1rem;
}

.lesson-progress {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
}

.lesson-counter {
  font-size: 0.8rem;
  color: #94a3b8;
  font-weight: 600;
}

.progress-bar {
  height: 6px;
  background: #1a2035;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid #2d3a5a;
}

.progress-fill {
  height: 100%;
  background: #c89b3c;
  border-radius: 999px;
  transition: width 0.4s ease;
}

/* ---- Phase label ---- */
.phase-label {
  font-size: 0.78rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ---- Learn grid ---- */
.learn-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 700px;
}

.learn-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #111827;
  border: 1px solid #2d3a5a;
  border-radius: 10px;
  padding: 0.75rem 1.25rem;
  flex-wrap: wrap;
}

.learn-combined {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-width: 72px;
}

.learn-combined img {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  border: 2px solid #c89b3c;
}

.learn-recipe {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  flex-wrap: wrap;
}

.recipe-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.recipe-item img {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  border: 2px solid #2d3a5a;
}

.equals {
  font-size: 1.3rem;
  color: #64748b;
  user-select: none;
  padding: 0 0.25rem;
}

.plus {
  font-size: 1.2rem;
  color: #64748b;
  user-select: none;
}

.item-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #e2e8f0;
  text-align: center;
  max-width: 100px;
}

.item-name.small {
  font-size: 0.65rem;
  color: #94a3b8;
  max-width: 80px;
  line-height: 1.2;
}

/* ---- Match combined list ---- */
.match-combined-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 700px;
}

.match-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: #111827;
  border: 1px solid #2d3a5a;
  border-radius: 10px;
  padding: 0.6rem 1rem;
  flex-wrap: wrap;
}

.match-combined-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-width: 60px;
}

.match-combined-icon img {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 2px solid #c89b3c;
}

.match-slot {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 2px dashed #2d3a5a;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a2035;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.match-slot:hover {
  border-color: #c89b3c;
}

.match-slot.filled {
  border-style: solid;
  border-color: #3d5a8a;
}

.match-slot img {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  object-fit: cover;
}

.slot-placeholder {
  font-size: 1.2rem;
  color: #3d5a8a;
  user-select: none;
}

.clear-btn {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: #e53e3e;
  color: #fff;
  font-size: 0.55rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
}

/* ---- Pool ---- */
.pool-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.pool-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  max-width: 600px;
}

.pool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  cursor: grab;
  padding: 4px;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}

.pool-item:active {
  cursor: grabbing;
}

.pool-item:hover {
  border-color: #c89b3c;
  background: #1a2035;
}

.pool-item.selected {
  border-color: #c89b3c;
  background: #1e1a0a;
}

.pool-item img {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  border: 2px solid #2d3a5a;
}

/* ---- Match actions ---- */
.match-actions {
  margin-top: 0.5rem;
}

/* ---- Result ---- */
.result-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
}

.result-score-badge {
  font-size: 1.1rem;
  font-weight: 700;
  padding: 0.4rem 1.75rem;
  border-radius: 999px;
}

.result-score-badge.perfect {
  background: #1a3a2a;
  color: #4ade80;
  border: 1px solid #4ade80;
}

.result-score-badge.partial {
  background: #2a2a1a;
  color: #fbbf24;
  border: 1px solid #fbbf24;
}

.result-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
  max-width: 700px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  border: 1px solid;
  flex-wrap: wrap;
}

.result-row.correct {
  background: #0f2a1a;
  border-color: #4ade80;
}

.result-row.wrong {
  background: #2a0f0f;
  border-color: #f87171;
}

.result-icon {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  border: 2px solid #2d3a5a;
}

.result-base-icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 2px solid #2d3a5a;
}

.result-item-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: #e2e8f0;
  flex: 1;
  min-width: 80px;
}

.result-arrow {
  color: #64748b;
  font-size: 1rem;
}

.result-answer {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.correct-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: #4ade80;
  margin-left: 0.5rem;
}

.plus-sm {
  font-size: 0.9rem;
  color: #64748b;
}

.result-actions {
  margin-top: 0.5rem;
}

/* ---- Buttons ---- */
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

.btn-primary {
  background: #c89b3c;
  color: #0a0e1a;
  border-color: #c89b3c;
}

.btn-primary:not(:disabled):hover {
  background: #dbb04f;
}

.btn-reset {
  background: #1a2035;
  border: 2px solid #2d3a5a;
  color: #94a3b8;
  padding: 0.4rem 1rem;
  font-size: 0.8rem;
  white-space: nowrap;
}

.btn-reset:hover {
  border-color: #f87171;
  color: #f87171;
}

.ready-btn {
  margin-top: 0.5rem;
}

/* ---- Finish screen ---- */
.finish-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: #111827;
  border: 1px solid #2d3a5a;
  border-radius: 12px;
  text-align: center;
}

.finish-title {
  font-size: 1.5rem;
  color: #c89b3c;
  font-weight: 700;
}

.finish-score {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.score-big {
  font-size: 3rem;
  font-weight: 800;
  color: #e2e8f0;
}

.score-sep {
  font-size: 2rem;
  color: #64748b;
}

.finish-sub {
  color: #64748b;
  font-size: 0.85rem;
}

/* ---- Responsive ---- */
@media (max-width: 600px) {
  .learn-card {
    padding: 0.6rem 0.75rem;
    gap: 0.6rem;
  }

  .learn-combined img {
    width: 52px;
    height: 52px;
  }

  .recipe-item img {
    width: 44px;
    height: 44px;
  }

  .match-row {
    padding: 0.5rem 0.6rem;
    gap: 0.4rem;
  }

  .match-slot {
    width: 48px;
    height: 48px;
  }

  .match-slot img {
    width: 36px;
    height: 36px;
  }

  .match-combined-icon img {
    width: 48px;
    height: 48px;
  }

  .pool-item img {
    width: 44px;
    height: 44px;
  }
}
</style>
