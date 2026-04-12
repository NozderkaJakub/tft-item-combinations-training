import { createRouter, createWebHashHistory } from "vue-router";
import BaseItems from "../views/BaseItems.vue";
import CombinedItems from "../views/CombinedItems.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/base" },
    { path: "/base", component: BaseItems },
    { path: "/combined", component: CombinedItems },
  ],
});
