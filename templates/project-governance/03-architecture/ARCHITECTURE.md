<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# ARCHITECTURE — {{MODULE_DISPLAY}}

The rules of the D-ReAMS ecosystem. This document defines how `{{MODULE_NAME}}`
relates to the Shell, to `@2enapps/ui`, and to the backend APIs.

**This is the document an architect reads first, and the document an agent reads
before writing any code.** If a change conflicts with a rule here, either the
change is wrong, or this document is — and that is a Change Request, not a
workaround.

---

## 1. The system

```
Users
   |
   v
+---------------------------+
|        SHELL / HOST       |   @2enapps/shell
| Auth / SSO / Navigation   |
| Shared UI / Routing       |
+-------------+-------------+
              |
      +-------+--------+----------------+
      |                |                |
      v                v                v
+-----------+    +-----------+    +-----------+
| {{MODULE_DISPLAY}}  | Module B      | Module C      |
| {{MODULE_NAME}}     |               |               |
+-----+-----+    +-----+-----+    +-----+-----+
      |                |                |
      v                v                v
+-----------+    +-----------+    +-----------+
| API A     |    | API B     |    | API C     |
| Backend   |    | Backend   |    | Backend   |
+-----------+    +-----------+    +-----------+

Shared:  @2enapps/ui  (presentation package, versioned, consumed by all frontends)
```

Every box is a **separate repository**, built and deployed independently. There
is no monorepo build, no shared CI, and no guarantee that any two boxes are at
compatible versions at the same moment. `07-delivery/SYNC.md` is the document
that tracks that.

---

## 2. Ownership

### Shell owns

- Application bootstrap, and the order plugins are installed in.
- Keycloak / OIDC initialisation — **once**.
- The top-level router, the navigation guard, and the role guard.
- The menu tree and the derivation of a user's roles from it.
- The shared Vue, Vue Router, Pinia and Vue I18n instances.
- The federation **host** configuration: `remotes`, and the resilient loader that
  renders a fallback when a remote is unreachable.
- The API clients for shared lookups, and the host adapter that hands
  credentials and host capabilities to the shared package and to remotes.

### `{{MODULE_NAME}}` owns

- Its exposed pages, under `{{ROUTE_PREFIX}}`.
- Its feature services — its own calls to its own APIs.
- Its translations.
- Its standalone preview entry, for developing a view without the Shell.
- Its federation metadata.

### `@2enapps/ui` owns

- Presentation: navigation chrome, layouts, shared components, styles, fonts,
  images, icons.
- Shared Pinia stores used by the chrome.
- The host-adapter interface it calls back into.

### Backend APIs own

- Data, validation, authorization, and the truth.
- The shape of every response. The frontend adapts to it; it does not get to
  redefine it in a view.

---

## 3. Module Federation

### 3.1 Identity

| Field | Value |
| --- | --- |
| Remote name | `{{MODULE_NAME}}` |
| `filename` | `remoteEntry.js` |
| `name` (webpack container) | `{{MODULE_NAME}}` |
| Route prefix | `{{ROUTE_PREFIX}}` |
| Role id | `{{ROLE_KEY}}` |
| Local port | `{{REMOTE_PORT}}` |
| Shell origin (dev) | `http://localhost:3000` |
| Exposes | {{EXPOSE_LIST}} |

### 3.2 The contract

A remote's `name` and its `exposes` keys, and the Shell's matching `remotes` key
and `import()` string, are **one public contract across two repositories**.

```
remote vue.config.js                    Shell route
─────────────────────                   ───────────
name: "{{MODULE_NAME}}"                 remotes: { {{MODULE_NAME}}: "{{MODULE_NAME}}@<base>/remoteEntry.js" }
exposes: {                              import("{{MODULE_NAME}}/views/{{SUBMODULE}}")
  "./views/{{SUBMODULE}}": "./src/views/{{SUBMODULE}}.vue"
}
```

The expose key loses its leading `./` when the Shell imports it. Everything else
must be byte-identical.

**A mismatch fails at runtime with a misleading error.** `Module … does not
exist in container` names the container; the actual fault is usually a renamed
file on the other side of the network. Verify both sides before touching anything
else. `06-quality/DEBUG.md` §1 has the full diagnostic.

### 3.3 What to expose

Expose **only an independent page**.

A child view that needs parent props, a selected row, or a parent event is not
independent. Keep it inside its parent, as a tab or a panel. Exposing it creates
a public contract for something that will be refactored the moment the parent
changes.

An expose path is a versioned API. Renaming one is a major version bump; see
`07-delivery/VERSIONING.md`.

### 3.4 Metadata

`src/metadata.js` records stable identity:

```js
export const {{MODULE_PASCAL}}_METADATA = Object.freeze({
  remoteName: "{{MODULE_NAME}}",
  displayName: "{{MODULE_DISPLAY}}",
  version: "{{MODULE_VERSION}}",
  apiVersion: {{API_VERSION}},
  routePrefix: "{{ROUTE_PREFIX}}",
  defaultExpose: "views/{{SUBMODULE}}"
});
```

It is `Object.freeze`d because it is consumed as data, not as configuration. The
current Shell registers pages **explicitly**; the metadata exists so a future
discovery mechanism has something stable to read, not so the Shell can guess.

### 3.5 Shared singletons

```js
shared: {
  vue:          { singleton: true, requiredVersion: false },
  "vue-router": { singleton: true, requiredVersion: false },
  pinia:        { singleton: true, requiredVersion: false },
  "vue-i18n":   { singleton: true, requiredVersion: false }
}
```

The Shell adds `eager: true` to these. **The remote does not.** The share-scope
entry must exist before any remote module is evaluated, and the Shell is what
creates it. Declaring them `eager` in a remote as well can load them in the
wrong order, and the failure surfaces as
`getActivePinia() was called but there was no active Pinia`.

`requiredVersion: false` is deliberate. The Shell's version is authoritative; a
remote that refuses to load because of a semver range turns a patch release into
an outage.

`@2enapps/ui` declares these four as **peer** dependencies. That is what forces
them into the shared list — if the shared package instantiates a store at module
scope, a second Pinia in any consumer breaks the chrome.

Full mechanism and its two failure modes: `02-governance/GUARDRAILS.md` §2.

### 3.6 Resolution: the symlink trap

A `file:` dependency is a symlink, and npm installs a package's peers into that
package's own `node_modules`. Two settings are required, and both are easy to get
wrong in a way that does not fail loudly:

```js
// 1. Must be a setter CALL. Assignment overwrites the method and does nothing.
config.resolve.symlinks(false);

// 2. Exact-match alias ($) back to the application's copy.
//    Subpath imports (pinia/dist/pinia.mjs) still resolve normally.
["pinia", "vue-router", "vue-i18n"].forEach((name) => {
  config.resolve.alias.set(`${name}$`, require.resolve(name));
});
```

`vue` is deliberately absent from that alias list: Vue CLI already pins it with
its own `vue$` alias, and the federation `shared` block owns its singleton.

---

## 4. Composition

```js
// shell/src/main.js — the reference order
const app = createApp(App);
app.use(pinia);   // before UI: shared components call useStore() at module scope
app.use(i18n);
app.use(UI, { hostAdapter: createHostAdapter() });
app.mount("#app");
```

**Pinia is installed before `@2enapps/ui`.** Not by convention — the shared
package's components and stores call `useLayoutStore()` while their modules are
being evaluated, which happens during `app.use(UI)`. Reversing the order throws.

The same order applies in a remote's preview entry, which must install its own
router, Pinia, i18n, the UI plugin and the stylesheet, so a view renders with no
Shell present.

---

## 5. Modes

| `VUE_APP_REMOTE` | Entry | `remoteEntry.js` | Use |
| --- | --- | --- | --- |
| `on` | `src/remote-entry.js` | present | Shell integration |
| `off` | `src/preview/main.js` | **absent** | developing a view alone |

`remoteEntry.js` is deliberately absent in preview mode. Do not open the Shell
route while preview mode is on: the Shell will probe for a container that does
not exist, and show its fallback, which looks like a Shell bug.

Every `.env` or `vue.config.js` change requires a restart. These are compile-time
values.

---

## 6. Environment ownership

The Shell and the module compile separately. A `VUE_APP_*` value read by module
source is replaced from the **module's** `.env`.

**A base URL read by both applications must be declared in both.** If it is only
in the Shell's, the module builds `undefined/kategori-program` and the browser
receives a 404 from a different host — a genuinely confusing failure, because the
module's code is correct and the URL is simply missing its host.

| Variable | Read by | Note |
| --- | --- | --- |
| `VUE_APP_MFE_BASE_{{MODULE_PASCAL}}` | Shell | this module's container base |
| `VUE_APP_SHELL_BASE` | module | allowed dev CORS origin; must be exact, port included |
| `VUE_APP_REMOTE` | module | `on` / `off` |
| `{{REMOTE_PORT}}` | module | local dev port |
| {{API_BASES_LIST}} | whoever reads them | declare in **every** compiled app that reads them |

---

## 7. Resilience

Federation has no built-in degradation. When a container is unreachable, the
dynamic `import()` either rejects or — on a later attempt in the same page —
resolves to an **empty stub module**, which renders a blank route.

The Shell therefore wraps every remote route in a loader that:

1. Fails fast, so the user never stares at a blank page.
2. Renders a labelled fallback, not an error.
3. Probes `remoteEntry.js` and recovers automatically when the remote comes back.

A remote must not attempt to handle this itself, and must not re-import the same
module to heal it — in this webpack runtime that cannot work in-document. The
recovery is a page reload.

---

## 8. Architecture decisions

Contested decisions get a record in `03-architecture/ADR.md`. Write it when the
decision is made, not afterwards.

| # | Decision | ADR | Status |
| --- | --- | --- | --- |
| {{ADR_INDEX_1}} | | | |

---

## 9. Architecture checklist

Before `06-quality/CHECK.md`:

- [ ] The change respects the ownership table in §2
- [ ] No expose key or remote name changed without a version bump
- [ ] The `shared` block is unchanged, or the ADR explains why
- [ ] Every environment variable read by module source is in the module's
      `.env.example`
- [ ] `resolve.symlinks(false)` and the peer aliases are intact
- [ ] Pinia is installed before the UI plugin
- [ ] Nothing in this module reads a token directly
- [ ] The remote still builds and `remoteEntry.js` is still reachable
