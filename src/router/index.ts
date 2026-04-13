import { createRouter, createWebHashHistory } from "vue-router";
import Training from "../views/Training.vue";
import CheatSheet from "../views/CheatSheet.vue";
import Learn from "../views/Learn.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/learn" },
    { path: "/learn", component: Learn },
    { path: "/training", component: Training },
    { path: "/cheat-sheet", component: CheatSheet },
  ],
});
