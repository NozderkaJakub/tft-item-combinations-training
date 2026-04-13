import { ref, computed, watch } from "vue";
import { selectedSet, type SetValue } from "./useItems";
import allItems from "../items-clean.json";

// ---- Types ----

export interface LessonItem {
  name: string;
  combine: [string, string];
}

export interface LessonGroup {
  items: string[]; // 5 combined item names
}

export interface LessonState {
  set: SetValue;
  groups: LessonGroup[];
  currentLessonIndex: number;
  totalScore: number;
  totalPossible: number;
  finished: boolean;
}

// A single slot assignment in the match phase: which base item was placed on which combined item slot
export interface SlotAssignment {
  combinedItemName: string;
  slotIndex: 0 | 1; // 0 = first ingredient, 1 = second ingredient
  baseItemName: string;
}

// ---- Helpers ----

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getCombinedItemsForSet(set: SetValue): LessonItem[] {
  return (allItems as any[])
    .filter(
      (item) =>
        item.set.includes(set) &&
        item.shadow === false &&
        item.radiant === false &&
        item.combine !== undefined
    )
    .map((item) => ({
      name: item.name as string,
      combine: item.combine as [string, string],
    }));
}

const EXCLUDED_FROM_EXTRAS = ["Spatula", "Frying Pan"];

function getBaseItemsForSet(set: SetValue): string[] {
  return (allItems as any[])
    .filter(
      (item) =>
        item.set.includes(set) &&
        item.shadow === false &&
        item.radiant === false &&
        item.into !== undefined
    )
    .map((item) => item.name as string);
}

// ---- Storage keys ----

function storageKey(set: SetValue): string {
  return `tft-lessons-v1-set${set}`;
}

function loadState(set: SetValue): LessonState | null {
  try {
    const raw = localStorage.getItem(storageKey(set));
    if (!raw) return null;
    return JSON.parse(raw) as LessonState;
  } catch {
    return null;
  }
}

function saveState(state: LessonState) {
  localStorage.setItem(storageKey(state.set), JSON.stringify(state));
}

function buildFreshState(set: SetValue): LessonState {
  const combined = getCombinedItemsForSet(set);
  const shuffled = shuffle(combined);
  const groups: LessonGroup[] = [];
  for (let i = 0; i < shuffled.length; i += 5) {
    groups.push({ items: shuffled.slice(i, i + 5).map((x) => x.name) });
  }
  return {
    set,
    groups,
    currentLessonIndex: 0,
    totalScore: 0,
    totalPossible: 0,
    finished: false,
  };
}

// ---- Shared reactive state ----

const lessonState = ref<LessonState>(
  loadState(selectedSet.value) ?? buildFreshState(selectedSet.value)
);

watch(selectedSet, (newSet) => {
  lessonState.value =
    loadState(newSet) ?? buildFreshState(newSet);
});

// ---- Composable ----

export function useLessons() {
  const currentLessonIndex = computed(() => lessonState.value.currentLessonIndex);
  const totalLessons = computed(() => lessonState.value.groups.length);
  const finished = computed(() => lessonState.value.finished);
  const totalScore = computed(() => lessonState.value.totalScore);
  const totalPossible = computed(() => lessonState.value.totalPossible);

  /** Names of combined items in the current lesson */
  const currentLessonItemNames = computed<string[]>(() => {
    const idx = lessonState.value.currentLessonIndex;
    if (idx >= lessonState.value.groups.length) return [];
    return lessonState.value.groups[idx].items;
  });

  /** Full LessonItem objects for current lesson */
  const currentLessonItems = computed<LessonItem[]>(() => {
    const set = lessonState.value.set;
    const combined = getCombinedItemsForSet(set);
    const map = new Map(combined.map((c) => [c.name, c]));
    return currentLessonItemNames.value
      .map((name) => map.get(name))
      .filter((x): x is LessonItem => x !== undefined);
  });

  /**
   * Items to show in the match phase:
   * - 5 from current lesson
   * - from lesson 2+ also 3 random from previous lessons
   */
  const matchPhaseItems = computed<LessonItem[]>(() => {
    const idx = lessonState.value.currentLessonIndex;
    const set = lessonState.value.set;
    const combined = getCombinedItemsForSet(set);
    const map = new Map(combined.map((c) => [c.name, c]));

    const currentNames = new Set(currentLessonItemNames.value);
    const current = currentLessonItemNames.value
      .map((name) => map.get(name))
      .filter((x): x is LessonItem => x !== undefined);

    if (idx === 0) return current;

    // Collect all items from previous lessons
    const previousNames: string[] = [];
    for (let i = 0; i < idx; i++) {
      previousNames.push(...lessonState.value.groups[i].items);
    }
    const eligible = previousNames.filter((n) => !currentNames.has(n));
    const shuffledPrev = shuffle(eligible).slice(0, 3);
    const extra = shuffledPrev
      .map((name) => map.get(name))
      .filter((x): x is LessonItem => x !== undefined);

    return shuffle([...current, ...extra]);
  });

  /**
   * Base item pool for the match phase:
   * all required base items (with repetitions) + 2 random extras (not Spatula/Frying Pan)
   */
  const matchPhaseBasePool = computed<string[]>(() => {
    const required: string[] = [];
    for (const item of matchPhaseItems.value) {
      required.push(item.combine[0], item.combine[1]);
    }

    const allBase = getBaseItemsForSet(lessonState.value.set);
    const nonExcluded = allBase.filter((b) => !EXCLUDED_FROM_EXTRAS.includes(b));
    const requiredSet = new Set(required);
    const extrasPool = nonExcluded.filter((b) => !requiredSet.has(b));
    const extras = shuffle(extrasPool).slice(0, 2);

    return shuffle([...required, ...extras]);
  });

  function submitLesson(correctCount: number, possibleCount: number) {
    const state = lessonState.value;
    state.totalScore += correctCount;
    state.totalPossible += possibleCount;

    if (state.currentLessonIndex + 1 >= state.groups.length) {
      state.finished = true;
    } else {
      state.currentLessonIndex += 1;
    }

    saveState(state);
    // Trigger reactivity
    lessonState.value = { ...state };
  }

  function resetLessons() {
    const fresh = buildFreshState(selectedSet.value);
    saveState(fresh);
    lessonState.value = fresh;
  }

  return {
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
  };
}
