import { ref, computed } from "vue";
import allItems from "../items-clean.json";

export type SetValue = 16 | 4.5 | 17;

export interface Item {
  name: string;
  set: number[];
  shadow: boolean;
  radiant: boolean;
  into?: string[];
  combine?: string[];
}

export const SETS: SetValue[] = [16, 4.5, 17];

// Stan setu współdzielony między widokami
export const selectedSet = ref<SetValue>(16);

const items = allItems as Item[];

export function useItems() {
  const baseItems = computed(() =>
    items.filter(
      (item) =>
        item.set.includes(selectedSet.value) &&
        item.shadow === false &&
        item.radiant === false &&
        item.into !== undefined
    )
  );

  const combinedItems = computed(() =>
    items.filter(
      (item) =>
        item.set.includes(selectedSet.value) &&
        item.shadow === false &&
        item.radiant === false &&
        item.combine !== undefined
    )
  );

  return { baseItems, combinedItems };
}

export function getImageUrl(name: string): string {
  const wordsToKeepLowercase = ["of", "the", "and"];

  const normalized = name
    .replace(/'/g, "")
    .replace(/\./g, "")
    .replace(/:/g, "")
    .replace(/\//g, "")
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index !== 0 && wordsToKeepLowercase.includes(lower)) return lower;
      if (word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");

  return `https://sunderarmor.com/items/${normalized}.png`;
}
