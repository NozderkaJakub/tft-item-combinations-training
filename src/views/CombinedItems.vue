<script setup lang="ts">
import { useItems } from "../composables/useItems";
import ItemCard from "../components/ItemCard.vue";

const { combinedItems } = useItems();
</script>

<template>
  <div>
    <p class="count">{{ combinedItems.length }} przedmiotów</p>
    <div class="grid">
      <ItemCard v-for="item in combinedItems" :key="item.name" :item="item" />
    </div>
  </div>
</template>

<style scoped>
.count {
  font-size: 0.8rem;
  color: #64748b;
  text-align: center;
  margin-bottom: 1.5rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 10px;
}
</style>
