import { createPinia } from "pinia";

/**
 * A single Pinia instance for standalone development.
 *
 * Inside the Shell this module must use the host's Pinia — bundling a second
 * one produces a store the Shell never writes to, which is a runtime failure
 * with no console warning. The federation `shared` block in `vue.config.js` is
 * what guarantees that; this file is never loaded when the remote entry is.
 */
const pinia = createPinia();

export default pinia;
