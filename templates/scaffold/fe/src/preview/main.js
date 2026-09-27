__UI_IMPORT__
import { createApp } from "vue";
import { createI18n } from "vue-i18n";

import App from "./App.vue";
import pinia from "./pinia";
import router from "./router";

/**
 * The preview entry runs this module without the Shell — `VUE_APP_REMOTE=off`
 * makes it the webpack entry instead of `src/remote-entry.js`.
 *
 * `pinia`, `vue-router` and `vue-i18n` are federation singletons: in the Shell
 * they resolve to the host's instances. Registering them here is only for
 * standalone development, and the same versions must be declared so both sides
 * agree on the shared range.
 */
const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "bm",
  fallbackLocale: "bm",
  messages: { bm: {}, en: {} },
});

const app = createApp(App);

app.use(pinia);
app.use(i18n);
app.use(router);
__UI_USE__
app.mount("#app");
