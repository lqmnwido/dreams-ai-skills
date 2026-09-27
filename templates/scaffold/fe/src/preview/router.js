import { createRouter, createWebHistory } from "vue-router";

/**
 * Preview routes — one per page this module exposes, plus the redirect that
 * sends `/` to the primary page.
 *
 * The Shell does not use this file: it registers its own routes from the expose
 * keys in `vue.config.js`. This router exists only so the module can be
 * developed and demonstrated without the Shell running.
 */
const routes = [
__ROUTES__
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
