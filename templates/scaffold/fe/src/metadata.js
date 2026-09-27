/**
 * Integration manifest for {{MODULE_NAME}}.
 *
 * It does not mount a page and the Shell does not need it to load an exposed
 * view — the Shell registers pages explicitly. It exists so that a future
 * discovery mechanism has stable metadata to read instead of parsing
 * `vue.config.js`.
 *
 * Every field here is a public value: renaming one is a breaking change.
 * `defaultExpose` is the primary page and must always be one of the expose keys
 * in `vue.config.js`.
 */
export const {{MODULE_PASCAL}}_METADATA = Object.freeze({
  remoteName: "{{MODULE_NAME}}",
  displayName: "{{MODULE_DISPLAY}}",
  version: "{{MODULE_VERSION}}",
  apiVersion: {{API_VERSION}},
  routePrefix: "{{ROUTE_PREFIX}}",
  defaultExpose: "views/{{SUBMODULE}}"
});
