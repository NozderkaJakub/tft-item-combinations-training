import { ref, computed, watch } from "vue";
import { selectedSet, type SetValue, type Item } from "./useItems";
import allItems from "../items-clean.json";

// --- Types ---
export interface LessonGroup {
  itemNames: string[];
}

export interface LessonState {
  set: SetValue;
  groups: LessonGroup[];
  currentLessonIndex: number;
  totalScore: number;
  totalPossible: number;
  finished: boolean;
}

const STORAGE_KEY = "tft-lesson-state";
const LESSON_SIZE = 5;
const EXTRA_BASE_ITEMS = 2;
const REVIEW_FROM_PREV = 3;
const EXCLUDED_FROM_EXTRA = ["Spatula", "Frying Pan"];

// --- Helpers ---
function getItemsForSet(set: SetValue): Item[] {
  const items = allItems as Item[];
  return items.filter(
    (item) =>
      item.set.includes(set) &&
      item.shadow === false &&
      item.radiant === false
  );
}

function getBaseItems(set: SetValue): Item[] {
  return getItemsForSet(set).filter((i) => i.into !== undefined && i.combine === undefined);
}

function getCombinedItems(set: SetValue): Item[] {
  return getItemsForSet(set).filter((i) => i.combine !== undefined && i.into === undefined);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildGroups(set: SetValue): LessonGroup[] {
  const combined = shuffle(getCombinedItems(set));
  const groups: LessonGroup[] = [];
  for (let i = 0; i < combined.length; i += LESSON_SIZE) {
    groups.push({ itemNames: combined.slice(i, i + LESSON_SIZE).map((c) => c.name) });
  }
  return groups;
}

function createFreshState(set: SetValue): LessonState {
  return {
    set,
    groups: buildGroups(set),
    currentLessonIndex: 0,
    totalScore: 0,
    totalPossible: 0,
    finished: false,
  };
}

function loadState(): LessonState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LessonState;
  } catch {
    return null;
  }
}

function saveState(state: LessonState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Module-level reactive state ---
const lessonState = ref<LessonState>(loadState() ?? createFreshState(selectedSet.value));

// Reset state when set changes
watch(selectedSet, (newSet) => {
  lessonState.value = createFreshState(newSet);
  saveState(lessonState.value);
});

// --- Exports ---
export function useLesson() {
  // Current lesson items (always exactly the group's items, 5)
  const currentGroup = computed<LessonGroup | null>(() => {
    const s = lessonState.value;
    if (s.finished || s.currentLessonIndex >= s.groups.length) return null;
    return s.groups[s.currentLessonIndex];
  });

  // Build the list of combined items to show in the matching phase for a given lesson index.
  // Called once when entering match phase — result should be frozen in a local ref.
  function buildMatchingCombinedItems(lessonIndex: number): Item[] {
    const s = lessonState.value;
    const allCombined = getCombinedItems(s.set as SetValue);
    const byName = (name: string) => allCombined.find((i) => i.name === name) ?? null;

    const group = s.groups[lessonIndex];
    if (!group) return [];

    const lessonItems = group.itemNames
      .map(byName)
      .filter(Boolean) as Item[];

    if (lessonIndex === 0) return lessonItems;

    // Collect all previous lesson item names
    const prevNames: string[] = [];
    for (let i = 0; i < lessonIndex; i++) {
      prevNames.push(...s.groups[i].itemNames);
    }

    // Pick 3 random from previous (no duplicates with current lesson)
    const prevPool = shuffle(
      prevNames
        .filter((n) => !group.itemNames.includes(n))
        .map(byName)
        .filter(Boolean) as Item[]
    ).slice(0, REVIEW_FROM_PREV);

    return shuffle([...lessonItems, ...prevPool]);
  }

  // Build the base-item pool for the matching phase given the combined items to show.
  // Called once when entering match phase — result should be frozen in a local ref.
  function buildBaseItemPool(combinedItems: Item[]): Item[] {
    const s = lessonState.value;
    const allBase = getBaseItems(s.set as SetValue);
    const allCombined = getCombinedItems(s.set as SetValue);
    const byName = (name: string) => allBase.find((i) => i.name === name) ?? null;

    // Gather required base items with repetition
    const required: Item[] = [];
    for (const ci of combinedItems) {
      const combinedItem = allCombined.find((i) => i.name === ci.name);
      if (!combinedItem?.combine) continue;
      for (const baseName of combinedItem.combine) {
        const baseItem = byName(baseName);
        if (baseItem) required.push(baseItem);
      }
    }

    // Choose extra base items
    const requiredNames = new Set(required.map((i) => i.name));
    const extraPool = allBase.filter(
      (i) => !EXCLUDED_FROM_EXTRA.includes(i.name) && !requiredNames.has(i.name)
    );
    const extras = shuffle(extraPool).slice(0, EXTRA_BASE_ITEMS);

    return shuffle([...required, ...extras]);
  }

  const totalLessons = computed(() => lessonState.value.groups.length);
  const currentLessonIndex = computed(() => lessonState.value.currentLessonIndex);
  const totalScore = computed(() => lessonState.value.totalScore);
  const totalPossible = computed(() => lessonState.value.totalPossible);
  const finished = computed(() => lessonState.value.finished);
  const currentSet = computed(() => lessonState.value.set);

  function submitLesson(correct: number, possible: number) {
    lessonState.value.totalScore += correct;
    lessonState.value.totalPossible += possible;
    lessonState.value.currentLessonIndex++;
    if (lessonState.value.currentLessonIndex >= lessonState.value.groups.length) {
      lessonState.value.finished = true;
    }
    saveState(lessonState.value);
  }

  function resetLesson() {
    lessonState.value = createFreshState(selectedSet.value);
    saveState(lessonState.value);
  }

  return {
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
  };
}
