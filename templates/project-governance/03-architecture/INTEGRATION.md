<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# INTEGRATION — {{MODULE_NAME}}

How `{{MODULE_NAME}}` connects to the Shell, to `@2enapps/ui`, and to its
backend. This is the procedure document: follow it in order and the module works.

Work on the module side and the Shell side interleaved, because each is small
and neither is complete alone.

---

## 1. The integration, end to end

| # | Step | Who | Where | Produces |
| --- | --- | --- | --- | --- |
| 1 | Declare the remote and its exposes | module | `vue.config.js` | a container, and public page keys |
| 2 | Declare federation metadata | module | `src/metadata.js` | stable identity |
| 3 | Configure the module's environment | module | `.env` | base, port, CORS origin, API bases |
| 4 | Build the standalone preview | module | `src/preview/` | a view that renders with no Shell |
| 5 | Register the remote in the Shell | Shell | `.env`, `vue.config.js` | the container URL |
| 6 | Add the fallback mapping | Shell | `src/mfe/loadRemoteView.js` | label + recovery probe |
| 7 | Add the protected route | Shell | `src/router/routes.js` | the URL users reach |
| 8 | Add the menu and role | Shell + backend | `offline-menu.js`, server menu | discoverability + authorization |
| 9 | Configure authentication | Shell | Keycloak env | the session |
| 10 | Enforce authorization on the API | backend | every endpoint | the actual security boundary |
| 11 | Verify | both | the checklist in §9 | evidence |

Steps 1–4 are this repository. Steps 5–8 and 10 are other repositories. A
change touching them is a **cross-repository change** and needs
`07-delivery/SYNC.md` before release.

---

## 2. Module side

### 2.1 Federation configuration

```js
const { ModuleFederationPlugin } = require("webpack").container;

new ModuleFederationPlugin({
  name: "{{MODULE_NAME}}",
  filename: "remoteEntry.js",
  exposes: {
    "./metadata": "./src/metadata.js",
    "./views/{{SUBMODULE}}": "./src/views/{{SUBMODULE}}.vue"
  },
  remotes: {
    shell: `shell@${shellBase}/remoteEntry.js`
  },
  shared: {
    vue:          { singleton: true, requiredVersion: false },
    "vue-router": { singleton: true, requiredVersion: false },
    pinia:        { singleton: true, requiredVersion: false },
    "vue-i18n":   { singleton: true, requiredVersion: false }
  }
})
```

No `eager`. The Shell owns the eager set. See
`03-architecture/ARCHITECTURE.md` §3.5.

### 2.2 Multiple pages

One remote can expose several independent pages. Each gets its own expose key
**and its own Shell route**. Do not add a second `remotes` entry for the same
module — the Shell registers a remote once.

```js
exposes: {
  "./metadata": "./src/metadata.js",
  "./views/{{SUBMODULE}}": "./src/views/{{SUBMODULE}}.vue",
  "./views/{{SUBMODULE_2}}": "./src/views/{{SUBMODULE_2}}.vue"
}
```

| Expose key | Shell import |
| --- | --- |
| `./views/{{SUBMODULE}}` | `{{MODULE_NAME}}/views/{{SUBMODULE}}` |
| `./views/{{SUBMODULE_2}}` | `{{MODULE_NAME}}/views/{{SUBMODULE_2}}` |

Expose only independent pages. A child that needs parent props or parent events
stays inside the parent.

### 2.3 Environment

```env
VUE_APP_MFE_BASE=http://localhost:{{REMOTE_PORT}}
VUE_APP_REMOTE=on
VUE_APP_SHELL_BASE=http://localhost:3000
VUE_APP_{{MODULE_PASCAL_UPPER}}_PORT={{REMOTE_PORT}}

# One entry per API base this module's own source reads.
VUE_APP_URL_KOD=
```

`VUE_APP_SHELL_BASE` is the module's allowed development CORS origin. It must
equal the actual Shell origin **including the port**. `localhost:3000` and
`localhost:3002` are different origins and only one of them is right.

### 2.4 Preview

`VUE_APP_REMOTE=off` switches the entry to `src/preview/main.js`, which installs
its own router, Pinia, i18n, the UI plugin and the stylesheet, and adds the
feature route to `src/preview/router.js`.

```js
{ path: "/{{MODULE_NAME}}", component: () => import("../views/{{SUBMODULE}}.vue") }
```

In preview mode `remoteEntry.js` must **not** exist. If it does, the mode is
wrong or the build is stale.

---

## 3. Shell side

### 3.1 Remote base

```env
VUE_APP_MFE_BASE_{{MODULE_PASCAL}}=http://localhost:{{REMOTE_PORT}}
```

### 3.2 Federation host

```js
const {{MODULE_CAMEL}}Base = (
  process.env.VUE_APP_MFE_BASE_{{MODULE_PASCAL}} || "http://localhost:{{REMOTE_PORT}}"
).replace(/\/+$/, "");

remotes: {
  {{MODULE_CAMEL}}: `{{MODULE_NAME}}@${ {{MODULE_CAMEL}}Base }/remoteEntry.js`
}
```

### 3.3 Fallback mapping

```js
// src/mfe/loadRemoteView.js — both maps
const REMOTE_LABELS = { {{MODULE_NAME}}: "{{MODULE_DISPLAY}}" };
const REMOTE_BASES  = { {{MODULE_NAME}}: process.env.VUE_APP_{{MODULE_PASCAL_UPPER}} || "" };
```

The label names the fallback view. The base drives the recovery probe. A remote
missing from either map still loads, but has no fallback and no automatic
recovery.

### 3.4 Protected route

```js
{
  path: "{{ROUTE_PATH}}",
  name: "{{MODULE_NAME}}-{{SUBMODULE_SLUG}}",
  meta: {
    title: "{{MODULE_DISPLAY}} - {{PAGE_TITLE}}",
    authRequired: true,
    roles: ["{{ROLE_KEY}}"],
    moduleLabel: "{{MODULE_DISPLAY}}"
  },
  component: loadRemoteView(
    "{{MODULE_NAME}}",
    () => import("{{MODULE_NAME}}/views/{{SUBMODULE}}")
  )
}
```

`authRequired: true` and an explicit `roles` array. A protected module must not
copy the `authRequired: false` used by the existing V2T route for local access.

### 3.5 Menu and role

```js
// src/services/{{MODULE_NAME}}/offline-menu.js
{
  singkatan: "{{MENU_LABEL}}",
  capaianUrl: "/{{ROUTE_PATH}}",
  listRole: [
    { id: "{{ROLE_KEY}}", keterangan: "{{ROLE_DESCRIPTION}}", priv: "IUD" }
  ]
}
```

Register the fixture in **both** offline arrays in `src/services/admin/sistem.js`.

`capaianUrl` must equal the route path exactly, or the menu links to a 404.

**The fixture is a local and offline fallback only.** Configure the same menu and
role in the server-side menu source for deployed users. The Shell derives a
signed-in user's role ids from the menu tree that arrives from the API — a
browser fixture grants nothing in production.

---

## 4. Authentication and authorization

- Keycloak is configured in the Shell only: `VUE_APP_KEYCLOAK_URL`,
  `VUE_APP_KEYCLOAK_REALM`, `VUE_APP_KEYCLOAK_CLIENT_ID`.
- The module never creates a Keycloak client and never holds a client secret.
- The Shell exposes `shell/auth` and the shared host adapter; the module
  consumes the adapter for credentials.
- `authRequired: true` and `meta.roles` on the route: navigation defence.
- **Every backend endpoint validates the token and the role itself.** This is the
  boundary. See `03-architecture/AUTHENTICATION.md`.

---

## 5. Order of operations

Do the module side fully before touching the Shell. The Shell has no way to
verify a remote that does not exist yet, and a broken Shell route during
development is indistinguishable from a bad remote.

1. Module builds; `remoteEntry.js` returns JavaScript.
2. Module preview renders with `VUE_APP_REMOTE=off`.
3. Then register in the Shell.
4. Then the route, then the menu, then the API authorization.
5. Restart after every `.env` and `vue.config.js` change — they are compile-time.

---

## 6. Integration checklist

| # | Check | How | Pass |
| --- | --- | --- | --- |
| 1 | Preview renders | `VUE_APP_REMOTE=off`, open the preview route | renders, `remoteEntry.js` absent |
| 2 | Container is served | `VUE_APP_REMOTE=on`, `GET <base>/remoteEntry.js` | JavaScript |
| 3 | CORS permits the Shell | response header on that request | exact Shell origin, port included |
| 4 | Expose key matches | compare `exposes` with the Shell `import()` | byte-identical after the leading `./` |
| 5 | Route renders the remote | open the Shell route | the real view, not the fallback |
| 6 | Roles are correct | permitted user, then unpermitted user | menu + route, then `/forbidden` |
| 7 | Menu links resolve | click every menu entry | no 404 |
| 8 | API authorizes | call without a token, then with a wrong role | rejected, independently of the UI |
| 9 | Console is clean | browser console + network | no CORS error, no missing expose, no `undefined` in a URL |
| 10 | Version combination is recorded | `07-delivery/SYNC.md` | this combination is listed |

---

## 7. Unregistering

Removing a module cleanly, in reverse order:

1. Remove the backend authorization for its role.
2. Remove the server-side menu entry, then the offline fixture and its
   registrations.
3. Remove the Shell route, then the fallback maps, then the federation host entry,
   then the base variable.
4. Deprecate the module — do not delete the repository while a deployed Shell
   still references it. See `07-delivery/VERSIONING.md` deprecation policy.
5. Record it in `07-delivery/SYNC.md`.

Steps 5–1 in the other order leaves deployed users with a menu entry that 404s.
