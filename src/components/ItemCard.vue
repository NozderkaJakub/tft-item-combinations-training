<script setup lang="ts">
import { type Item, getImageUrl } from "../composables/useItems";

defineProps<{ item: Item }>();
</script>

<template>
  <div class="item-card">
    <img
      :src="getImageUrl(item.name)"
      :alt="item.name"
      loading="lazy"
    />
    <span class="tooltip">{{ item.name }}</span>
  </div>
</template>

<style scoped>
.item-card {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  cursor: pointer;
}

.item-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  border: 2px solid #2d3a5a;
  display: block;
  transition: border-color 0.15s, transform 0.15s;
}

.item-card:hover img {
  border-color: #c89b3c;
  transform: scale(1.1);
  z-index: 1;
}

.tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #0f1627;
  color: #e2e8f0;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #2d3a5a;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}

.item-card:hover .tooltip {
  opacity: 1;
}
</style>
