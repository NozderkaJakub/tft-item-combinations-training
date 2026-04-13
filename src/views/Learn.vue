<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useLesson } from "../composables/useLesson";
import { useItems, getImageUrl, type Item } from "../composables/useItems";

const {
  currentGroup,
  buildMatchingCombinedItems,
  buildBaseItemPool,
  totalLessons,
  currentLessonIndex,
  totalScore,
  totalPossible,
  finished,
  currentSet,
  submitLesson,
  resetLesson,
} = useLesson();

const { combinedItems } = useItems();

// --- Phase: "study" | "match" | "result" ---
type Phase = "study" | "match" | "result";
const phase = ref<Phase>("study");

// ---- Study phase helpers ----
function getCombinedItemObj(name: string): Item | undefined {
  return combinedItems.value.find((i) => i.name === name);
}

// ---- Match phase state ----
interface SlotPair {
  slot1: Item | null;
  slot2: Item | null;
}

const assignments = ref<SlotPair[]>([]);
const usedPoolIndices = ref<Set<number>>(new Set());
const selectedCombinedIndex = ref<number | null>(null);
const draggedPoolIndex = ref<number | null>(null);

// Frozen snapshots built once per match phase — not reactive to state changes after submit
const matchingCombinedItems = ref<Item[]>([]);
const matchingBaseItemPool = ref<Item[]>([]);

// Live pool: matchingBaseItemPool entries with their index
const availablePool = computed(() =>
  matchingBaseItemPool.value
    .map((item, idx) => ({ item, idx }))
    .filter(({ idx }) => !usedPoolIndices.value.has(idx))
);

// ---- Submit & Score ----
interface SlotResult {
  correct: boolean;
  correctCombine: string[]; // the expected base item names
}
const submitResult = ref<SlotResult[] | null>(null);

// Frozen lesson number for display — set at initMatch, not updated until next lesson starts
const displayLessonIndex = ref(currentLessonIndex.value);

function initMatch() {
  // Snapshot built using current lesson index BEFORE any submit increments it
  displayLessonIndex.value = currentLessonIndex.value;
  matchingCombinedItems.value = buildMatchingCombinedItems(currentLessonIndex.value);
  matchingBaseItemPool.value = buildBaseItemPool(matchingCombinedItems.value);
  assignments.value = matchingCombinedItems.value.map(() => ({
    slot1: null,
    slot2: null,
  }));
  usedPoolIndices.value = new Set();
  selectedCombinedIndex.value = null;
  draggedPoolIndex.value = null;
  submitResult.value = null;
}

// Initialize on mount
initMatch();

// Reset view state when the set changes (lesson state is reset in useLesson)
watch(currentSet, () => {
  phase.value = "study";
  matchingCombinedItems.value = [];
  matchingBaseItemPool.value = [];
  assignments.value = [];
  usedPoolIndices.value = new Set();
  selectedCombinedIndex.value = null;
  submitResult.value = null;
  displayLessonIndex.value = 0;
});

// ---- Interaction ----

// Tap on a combined item card → select it (desktop + mobile)
function selectCombined(idx: number) {
  if (submitResult.value !== null) return;
  selectedCombinedIndex.value = idx === selectedCombinedIndex.value ? null : idx;
}

// Tap on a base item in pool → assign to the active combined card:
// 1. If a combined card is selected, fill its first free slot.
// 2. Otherwise find the first combined card that still has a free slot.
function tapBaseItem(poolIdx: number) {
  if (submitResult.value !== null) return;
  const item = matchingBaseItemPool.value[poolIdx];
  if (!item) return;

  // Determine target combined index
  let ci = selectedCombinedIndex.value;
  if (ci === null) {
    // Auto-pick: first card with any free slot
    ci = assignments.value.findIndex((p) => !p.slot1 || !p.slot2);
  }
  if (ci === -1 || ci === null) return;

  const pair = assignments.value[ci];
  if (!pair.slot1) {
    pair.slot1 = item;
    usedPoolIndices.value = new Set([...usedPoolIndices.value, poolIdx]);
  } else if (!pair.slot2) {
    pair.slot2 = item;
    usedPoolIndices.value = new Set([...usedPoolIndices.value, poolIdx]);
    // Slot filled — deselect so next tap auto-picks the next incomplete card
    selectedCombinedIndex.value = null;
  }
}

// Remove an assignment from a slot (return base item to pool)
function clearSlot(combinedIdx: number, slot: 1 | 2) {
  if (submitResult.value !== null) return;
  const pair = assignments.value[combinedIdx];
  const item = slot === 1 ? pair.slot1 : pair.slot2;
  if (!item) return;

  // Find the pool index for this item (pick first matching used index)
  const poolIdx = matchingBaseItemPool.value.findIndex(
    (pi, idx) => pi.name === item.name && usedPoolIndices.value.has(idx)
  );
  if (poolIdx !== -1) {
    const newUsed = new Set(usedPoolIndices.value);
    newUsed.delete(poolIdx);
    usedPoolIndices.value = newUsed;
  }

  if (slot === 1) pair.slot1 = null;
  else pair.slot2 = null;
}

// ---- Drag & Drop (desktop) ----
function onDragStartPool(poolIdx: number) {
  draggedPoolIndex.value = poolIdx;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function onDropSlot(combinedIdx: number, slot: 1 | 2, e: DragEvent) {
  e.preventDefault();
  if (draggedPoolIndex.value === null) return;
  if (submitResult.value !== null) return;
  const item = matchingBaseItemPool.value[draggedPoolIndex.value];
  if (!item) return;

  const pair = assignments.value[combinedIdx];
  // Free current item in that slot
  const existing = slot === 1 ? pair.slot1 : pair.slot2;
  if (existing) {
    const existingPoolIdx = matchingBaseItemPool.value.findIndex(
      (pi, idx) => pi.name === existing.name && usedPoolIndices.value.has(idx)
    );
    if (existingPoolIdx !== -1) {
      const newUsed = new Set(usedPoolIndices.value);
      newUsed.delete(existingPoolIdx);
      usedPoolIndices.value = newUsed;
    }
  }

  if (slot === 1) pair.slot1 = item;
  else pair.slot2 = item;
  usedPoolIndices.value = new Set([...usedPoolIndices.value, draggedPoolIndex.value]);
  draggedPoolIndex.value = null;
}

// ---- Submit & Score ----
const allAssigned = computed(() =>
  assignments.value.every((p) => p.slot1 !== null && p.slot2 !== null)
);

function doSubmit() {
  const results: SlotResult[] = [];
  let correct = 0;
  let possible = 0;

  for (let i = 0; i < matchingCombinedItems.value.length; i++) {
    const ci = matchingCombinedItems.value[i];
    const pair = assignments.value[i];
    const ciObj = getCombinedItemObj(ci.name);

    const correctCombine = ciObj?.combine ?? [];
    const answer = [pair.slot1?.name ?? "", pair.slot2?.name ?? ""].sort().join("|");
    const expected = [...correctCombine].sort().join("|");
    const isCorrect = answer === expected;

    possible++;
    if (isCorrect) correct++;

    results.push({ correct: isCorrect, correctCombine });
  }

  submitResult.value = results;
  submitLesson(correct, possible);
}

function goNext() {
  if (finished.value) {
    phase.value = "result";
  } else {
    phase.value = "study";
  }
}

// ---- Finished screen ----
const percentage = computed(() => {
  if (totalPossible.value === 0) return 0;
  return Math.round((totalScore.value / totalPossible.value) * 100);
});

function handleReset() {
  resetLesson();
  displayLessonIndex.value = 0;
  phase.value = "study";
}
</script>

<template>
  <div class="lesson-view">

    <!-- ============================================================ -->
    <!--  FINISHED SCREEN                                              -->
    <!-- ============================================================ -->
    <div v-if="finished" class="finished-screen">
      <h2 class="finished-title">Lessons complete!</h2>
      <p class="finished-sub">All {{ totalLessons }} lessons done for Set {{ currentSet }}</p>

      <div class="score-circle">
        <span class="score-pct">{{ percentage }}%</span>
        <span class="score-detail">{{ totalScore }} / {{ totalPossible }}</span>
      </div>

      <button class="btn btn-reset" @click="handleReset">
        Reset &amp; Start over
      </button>
    </div>

    <!-- ============================================================ -->
    <!--  ACTIVE LESSON                                                -->
    <!-- ============================================================ -->
    <template v-else-if="currentGroup">

      <!-- Progress bar -->
      <div class="progress-bar-wrap">
        <div
          class="progress-bar-fill"
          :style="{ width: `${((phase === 'study' ? currentLessonIndex : displayLessonIndex) / totalLessons) * 100}%` }"
        />
      </div>
      <p class="progress-label">Lesson {{ (phase === 'study' ? currentLessonIndex : displayLessonIndex) + 1 }} / {{ totalLessons }}</p>

      <!-- ── STUDY PHASE ─────────────────────────────────────────── -->
      <template v-if="phase === 'study'">
        <h2 class="phase-title">Learn these items</h2>
        <p class="phase-sub">Study the recipes, then click Ready.</p>

        <div class="study-grid">
          <div
            v-for="name in currentGroup.itemNames"
            :key="name"
            class="study-card"
          >
            <img :src="getImageUrl(name)" :alt="name" loading="lazy" class="study-combined-img" />
            <span class="item-name">{{ name }}</span>

            <template v-if="getCombinedItemObj(name)?.combine">
              <span class="recipe-equals">=</span>
              <div class="study-ingredients">
                <div
                  v-for="(baseName, bi) in getCombinedItemObj(name)!.combine!"
                  :key="bi"
                  class="study-base"
                >
                  <img :src="getImageUrl(baseName)" :alt="baseName" loading="lazy" />
                  <span class="base-name">{{ baseName }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="phase-actions">
          <button class="btn btn-ready" @click="phase = 'match'; initMatch()">
            Ready!
          </button>
          <button class="btn btn-reset-sm" @click="handleReset" title="Reset all lessons">
            Reset progress
          </button>
        </div>
      </template>

      <!-- ── MATCH PHASE ─────────────────────────────────────────── -->
      <template v-else-if="phase === 'match'">
        <h2 class="phase-title">Match the ingredients</h2>
        <p class="phase-sub">
          Select a combined item, then tap or drag the base items to it.
          <template v-if="currentLessonIndex > 0">
            <span class="review-badge">+{{ Math.min(3, currentLessonIndex * 5) }} review items</span>
          </template>
        </p>

        <!-- Combined items row -->
        <div class="match-combined-row">
          <div
            v-for="(ci, idx) in matchingCombinedItems"
            :key="ci.name"
            class="match-combined-card"
            :class="{
              selected: selectedCombinedIndex === idx && !submitResult,
              correct: submitResult && submitResult[idx]?.correct === true,
              wrong: submitResult && submitResult[idx]?.correct === false,
              review: currentLessonIndex > 0 && !currentGroup.itemNames.includes(ci.name),
            }"
            @click="selectCombined(idx)"
          >
            <!-- Combined item image -->
            <img :src="getImageUrl(ci.name)" :alt="ci.name" loading="lazy" class="combined-img" />
            <span class="combined-name">{{ ci.name }}</span>

            <!-- Slots (before submit) -->
            <div v-if="!submitResult" class="slots-row">
              <div
                class="mini-slot"
                :class="{ filled: assignments[idx]?.slot1 }"
                @dragover="onDragOver"
                @drop="onDropSlot(idx, 1, $event)"
              >
                <template v-if="assignments[idx]?.slot1">
                  <img
                    :src="getImageUrl(assignments[idx].slot1!.name)"
                    :alt="assignments[idx].slot1!.name"
                    loading="lazy"
                  />
                  <button class="mini-clear" @click.stop="clearSlot(idx, 1)" title="Remove">✕</button>
                </template>
                <span v-else class="mini-placeholder">?</span>
              </div>

              <span class="plus-sign">+</span>

              <div
                class="mini-slot"
                :class="{ filled: assignments[idx]?.slot2 }"
                @dragover="onDragOver"
                @drop="onDropSlot(idx, 2, $event)"
              >
                <template v-if="assignments[idx]?.slot2">
                  <img
                    :src="getImageUrl(assignments[idx].slot2!.name)"
                    :alt="assignments[idx].slot2!.name"
                    loading="lazy"
                  />
                  <button class="mini-clear" @click.stop="clearSlot(idx, 2)" title="Remove">✕</button>
                </template>
                <span v-else class="mini-placeholder">?</span>
              </div>
            </div>

            <!-- After submit: show what user answered -->
            <template v-else>
              <!-- User's answer -->
              <div class="slots-row">
                <div class="mini-slot filled" :class="{ 'slot-correct': submitResult[idx]?.correct, 'slot-wrong': !submitResult[idx]?.correct }">
                  <img
                    v-if="assignments[idx]?.slot1"
                    :src="getImageUrl(assignments[idx].slot1!.name)"
                    :alt="assignments[idx].slot1!.name"
                    loading="lazy"
                  />
                </div>
                <span class="plus-sign">+</span>
                <div class="mini-slot filled" :class="{ 'slot-correct': submitResult[idx]?.correct, 'slot-wrong': !submitResult[idx]?.correct }">
                  <img
                    v-if="assignments[idx]?.slot2"
                    :src="getImageUrl(assignments[idx].slot2!.name)"
                    :alt="assignments[idx].slot2!.name"
                    loading="lazy"
                  />
                </div>
              </div>

              <!-- Correct answer (only if wrong) -->
              <div v-if="!submitResult[idx]?.correct && submitResult[idx]?.correctCombine?.length" class="correct-answer">
                <span class="correct-answer-label">Correct:</span>
                <div class="correct-answer-items">
                  <div
                    v-for="(baseName, bi) in submitResult[idx].correctCombine"
                    :key="bi"
                    class="correct-base"
                  >
                    <img :src="getImageUrl(baseName)" :alt="baseName" loading="lazy" />
                    <span class="correct-base-name">{{ baseName }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Base item pool — hidden after submit -->
        <div v-if="!submitResult" class="base-pool">
          <p class="pool-label">Base items</p>
          <div class="pool-grid">
            <div
              v-for="{ item, idx } in availablePool"
              :key="`${item.name}-${idx}`"
              class="pool-item"
              draggable="true"
              @dragstart="onDragStartPool(idx)"
              @click="tapBaseItem(idx)"
            >
              <img :src="getImageUrl(item.name)" :alt="item.name" loading="lazy" />
              <span class="pool-item-name">{{ item.name }}</span>
            </div>
            <!-- Ghost placeholders to maintain grid shape when items disappear -->
            <div
              v-for="n in usedPoolIndices.size"
              :key="`ghost-${n}`"
              class="pool-item pool-item-ghost"
            />
          </div>
        </div>

        <!-- Submit / Next -->
        <div class="match-actions">
          <template v-if="!submitResult">
            <button
              class="btn btn-submit"
              :disabled="!allAssigned"
              @click="doSubmit"
            >
              Submit
            </button>
          </template>
          <template v-else>
            <div class="lesson-result-summary">
              <span class="lesson-result-score">
                {{ submitResult.filter(r => r.correct).length }} / {{ matchingCombinedItems.length }} correct
              </span>
            </div>
            <button class="btn btn-next-lesson" @click="goNext">
              {{ finished ? 'See final results' : 'Next lesson' }}
            </button>
          </template>

          <button class="btn btn-reset-sm" @click="handleReset" title="Reset all lessons">
            Reset progress
          </button>
        </div>
      </template>

    </template>

    <!-- Fallback (no group — shouldn't happen unless data is empty) -->
    <div v-else class="no-data">
      <p>No lesson data available. Try a different set or reset.</p>
      <button class="btn btn-reset" @click="handleReset">Reset</button>
    </div>

  </div>
</template>

<style scoped>
.lesson-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 3rem;
}

/* ---- Progress ---- */
.progress-bar-wrap {
  width: 100%;
  max-width: 480px;
  height: 6px;
  background: #1a2035;
  border-radius: 999px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: #c89b3c;
  border-radius: 999px;
  transition: width 0.4s ease;
}
.progress-label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ---- Phase titles ---- */
.phase-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #e2e8f0;
}
.phase-sub {
  font-size: 0.85rem;
  color: #64748b;
  text-align: center;
  max-width: 480px;
}

/* ---- Study grid ---- */
.study-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  width: 100%;
}
.study-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  background: #111827;
  border: 2px solid #1e2d4a;
  border-radius: 10px;
  padding: 0.75rem 0.6rem;
  width: 140px;
  min-width: 120px;
}
.study-combined-img {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 2px solid #c89b3c;
}
.item-name {
  font-size: 0.65rem;
  color: #94a3b8;
  text-align: center;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recipe-equals {
  font-size: 1rem;
  color: #c89b3c;
  font-weight: 700;
  flex-shrink: 0;
}
.study-ingredients {
  display: flex;
  gap: 0.4rem;
  justify-content: center;
}
.study-base {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.study-base img {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  border: 2px solid #2d3a5a;
}
.base-name {
  font-size: 0.58rem;
  color: #64748b;
  max-width: 52px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

/* ---- Actions ---- */
.phase-actions,
.match-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.btn {
  padding: 0.55rem 1.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  border: 2px solid transparent;
  transition: opacity 0.15s, background 0.15s, border-color 0.15s;
}
.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.btn-ready {
  background: #c89b3c;
  color: #0a0e1a;
}
.btn-ready:not(:disabled):hover {
  background: #dbb04f;
}
.btn-submit {
  background: #c89b3c;
  color: #0a0e1a;
}
.btn-submit:not(:disabled):hover {
  background: #dbb04f;
}
.btn-reset {
  background: #1a2035;
  border-color: #2d3a5a;
  color: #94a3b8;
}
.btn-reset:hover {
  border-color: #c89b3c;
  color: #e2e8f0;
}
.btn-reset-sm {
  background: transparent;
  border-color: #2d3a5a;
  color: #475569;
  font-size: 0.78rem;
  padding: 0.35rem 1rem;
}
.btn-reset-sm:hover {
  border-color: #e53e3e;
  color: #f87171;
}

/* ---- Match phase ---- */
.match-combined-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  width: 100%;
}

.match-combined-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  background: #111827;
  border: 2px solid #1e2d4a;
  border-radius: 10px;
  padding: 0.75rem 0.6rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  width: 140px;
  min-width: 120px;
}
.match-combined-card:hover {
  border-color: #3d5a8a;
}
.match-combined-card.selected {
  border-color: #c89b3c;
  background: #1a1608;
}
.match-combined-card.correct {
  border-color: #4ade80;
  background: #0d2014;
}
.match-combined-card.wrong {
  border-color: #f87171;
  background: #200d0d;
}
.match-combined-card.review {
  opacity: 0.8;
}
.combined-img {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 2px solid #c89b3c;
}
.combined-name {
  font-size: 0.65rem;
  color: #94a3b8;
  text-align: center;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.slots-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}
.mini-slot {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  border: 1.5px dashed #2d3a5a;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a2035;
  transition: border-color 0.15s;
}
.mini-slot.filled {
  border-style: solid;
  border-color: #3d5a8a;
}
.mini-slot img {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
}
.mini-placeholder {
  font-size: 1rem;
  color: #2d3a5a;
  font-weight: 700;
}
.mini-clear {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: #e53e3e;
  color: #fff;
  font-size: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
}
.plus-sign {
  font-size: 1rem;
  color: #64748b;
  user-select: none;
}

.result-overlay {
  position: absolute;
  top: 4px;
  right: 6px;
}
.result-check {
  font-size: 1rem;
  color: #4ade80;
  font-weight: 700;
}
.result-x {
  font-size: 1rem;
  color: #f87171;
  font-weight: 700;
}

/* ---- Base pool ---- */
.base-pool {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}
.pool-label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.pool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, 60px);
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 68px;
}
.pool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: grab;
  transition: transform 0.1s;
}
.pool-item:active {
  cursor: grabbing;
}
.pool-item img {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  border: 2px solid #2d3a5a;
  transition: border-color 0.15s, transform 0.15s;
  object-fit: cover;
}
.pool-item:hover img {
  border-color: #c89b3c;
  transform: scale(1.08);
}
.pool-item-name {
  font-size: 0.58rem;
  color: #64748b;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
.pool-item-ghost {
  pointer-events: none;
  visibility: hidden;
}

/* ---- Lesson result summary ---- */
.lesson-result-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.lesson-result-score {
  font-size: 1rem;
  font-weight: 700;
  color: #c89b3c;
  padding: 0.35rem 1rem;
  border: 1px solid #c89b3c;
  border-radius: 6px;
  background: #1a1608;
}

.btn-next-lesson {
  background: #c89b3c;
  color: #0a0e1a;
}
.btn-next-lesson:hover {
  background: #dbb04f;
}

/* ---- Slot state after submit ---- */
.mini-slot.slot-correct {
  border-color: #4ade80;
  background: #0d2014;
}
.mini-slot.slot-wrong {
  border-color: #f87171;
  background: #200d0d;
}

/* ---- Correct answer panel (shown below wrong cards) ---- */
.correct-answer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  padding-top: 6px;
  border-top: 1px solid #2d3a5a;
  width: 100%;
}
.correct-answer-label {
  font-size: 0.6rem;
  color: #4ade80;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.correct-answer-items {
  display: flex;
  gap: 4px;
  justify-content: center;
}
.correct-base {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.correct-base img {
  width: 36px;
  height: 36px;
  border-radius: 5px;
  border: 2px solid #4ade80;
  object-fit: cover;
}
.correct-base-name {
  font-size: 0.55rem;
  color: #4ade80;
  max-width: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.review-badge {
  display: inline-block;
  margin-left: 6px;
  background: #1a2035;
  color: #64748b;
  font-size: 0.75rem;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid #2d3a5a;
}

/* ---- Finished screen ---- */
.finished-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 3rem 1rem;
}
.finished-title {
  font-size: 2rem;
  font-weight: 700;
  color: #c89b3c;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.finished-sub {
  font-size: 0.9rem;
  color: #64748b;
}
.score-circle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: 4px solid #c89b3c;
  background: #111827;
  gap: 4px;
}
.score-pct {
  font-size: 2.5rem;
  font-weight: 700;
  color: #c89b3c;
}
.score-detail {
  font-size: 0.9rem;
  color: #94a3b8;
}

/* ---- No data ---- */
.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  color: #64748b;
}

/* ---- Responsive ---- */
@media (max-width: 600px) {
  .study-card {
    width: 120px;
    padding: 0.5rem 0.4rem;
  }
  .study-combined-img {
    width: 44px;
    height: 44px;
  }
  .study-base img {
    width: 36px;
    height: 36px;
  }
  .match-combined-card {
    width: 120px;
    padding: 0.5rem 0.4rem;
  }
  .combined-img {
    width: 44px;
    height: 44px;
  }
  .mini-slot {
    width: 36px;
    height: 36px;
  }
  .mini-slot img {
    width: 28px;
    height: 28px;
  }
}
</style>
