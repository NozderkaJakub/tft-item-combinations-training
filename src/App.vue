<script setup lang="ts">
import { RouterView, RouterLink } from "vue-router";
import { SETS, selectedSet, type SetValue } from "./composables/useItems";
</script>

<template>
  <div class="app">
    <header>
      <h1>TFT Items</h1>

      <div class="set-selector">
        <button
          v-for="s in SETS"
          :key="s"
          :class="['set-btn', { active: selectedSet === s }]"
          @click="selectedSet = s as SetValue"
        >
          Set {{ s }}
        </button>
      </div>

      <nav>
        <RouterLink to="/training" class="nav-link">Training</RouterLink>
        <RouterLink to="/cheat-sheet" class="nav-link">Cheat Sheet</RouterLink>
        <RouterLink to="/learn" class="nav-link">Learn</RouterLink>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>
  </div>
</template>

<style>
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #0a0e1a;
  color: #e2e8f0;
  font-family: 'Segoe UI', system-ui, sans-serif;
  min-height: 100vh;
}

.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

@media (max-width: 600px) {
  .app {
    padding: 1rem 0.75rem;
  }

  h1 {
    font-size: 1.3rem;
    margin-bottom: 0.75rem;
  }

  .set-selector {
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .set-btn {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
  }

  .nav-link {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }

  header {
    margin-bottom: 1.25rem;
  }
}

header {
  text-align: center;
  margin-bottom: 2.5rem;
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #c89b3c;
  margin-bottom: 1.25rem;
  text-transform: uppercase;
}

.set-selector {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.set-btn {
  background: #1a2035;
  border: 2px solid #2d3a5a;
  color: #94a3b8;
  padding: 0.45rem 1.25rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.set-btn:hover {
  border-color: #c89b3c;
  color: #e2e8f0;
}

.set-btn.active {
  background: #c89b3c;
  border-color: #c89b3c;
  color: #0a0e1a;
}

nav {
  display: flex;
  justify-content: center;
  gap: 0;
  border-bottom: 2px solid #2d3a5a;
}

.nav-link {
  display: inline-block;
  padding: 0.5rem 2rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #64748b;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.15s, border-color 0.15s;
}

.nav-link:hover {
  color: #e2e8f0;
}

.nav-link.router-link-active {
  color: #c89b3c;
  border-bottom-color: #c89b3c;
}
</style>
