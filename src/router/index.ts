import { createRouter, createWebHashHistory } from "vue-router";
import Training from "../views/Training.vue";
import CheatSheet from "../views/CheatSheet.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/training" },
    { path: "/training", component: Training },
    { path: "/cheat-sheet", component: CheatSheet },
    { path: "/lesson", component: () => import("../views/Lesson.vue") },
  ],
});
