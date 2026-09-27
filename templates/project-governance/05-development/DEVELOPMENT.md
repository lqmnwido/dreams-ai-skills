<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# DEVELOPMENT — {{MODULE_NAME}}

How code gets written in `{{REPO_NAME}}`.

Order matters more than speed here. A change that follows this loop is
predictable; one that skips a step is fast once and expensive forever.

---

## 1. The build loop

```
   1  AUDIT        what exists today?
   2  PLAN         what will change, and what will not?
   3  SCAFFOLD     files and signatures only
   4  IMPLEMENT    the logic
   5  PREVIEW      run it standalone, with no Shell
   6  CHECK        static verification
   7  TEST         unit → component → API → contract → browser
   8  INTEGRATE    register with the Shell
   9  DOCUMENT     every document the change invalidated
  10  SYNC         cross-repository compatibility
  11  RELEASE      per 07-delivery/RELEASE.md
```

### 1 — Audit

Read the code you are about to change. Not the documentation of it — the code.
Record findings in `06-quality/AUDIT.md`. A fix built on a wrong model of the
current code is a fix for a problem that does not exist.

### 2 — Plan

State the change in three parts:

| Part | Content |
| --- | --- |
| **Will change** | The exact files, and what each becomes |
| **Will not change** | Everything else, explicitly |
| **Depends on** | Other repositories, contracts, migrations |

The "will not change" list is what stops a change from growing while nobody is
looking.

### 3 — Scaffold

Create the files and their signatures before the logic. An empty view with a
service import tells you immediately whether the import path is right. Logic
written first hides a wrong path until runtime.

### 4 — Implement

Only the approved plan. If the plan turns out to be wrong, stop, and change the
plan through a Change Request. Do not quietly grow the implementation — the
approval covered the plan, not your improved idea of it.

### 5 — Preview

Run the module on its own, with `VUE_APP_REMOTE=off`:

```sh
cp .env.example .env      # fill the values
npm install
npm run serve             # → http://localhost:{{REMOTE_PORT}}
```

| Value | Setting |
| --- | --- |
| `VUE_APP_REMOTE` | `off` |
| `VUE_APP_MFE_BASE` | `http://localhost:{{REMOTE_PORT}}` |
| `VUE_APP_{{MODULE_PASCAL_UPPER}}_PORT` | `{{REMOTE_PORT}}` |
| `VUE_APP_SHELL_BASE` | `http://localhost:3000` |

Open the preview route directly. `remoteEntry.js` must **not** exist in this mode
— if it does, restart; a stale build is a confusing half-state.

### 6–7 — Check, then test

`06-quality/CHECK.md`, then `06-quality/TESTING.md`. In that order. A test
written against code that fails a standard is a test of the wrong thing.

### 8 — Integrate

Follow `03-architecture/INTEGRATION.md` §1 exactly. Module side first, then Shell.

### 9 — Document

In the same commit as the code. Not afterwards, not in a follow-up.

### 10 — Sync

If any other repository is affected, update `07-delivery/SYNC.md`. If none is,
say so in the report.

---

## 2. Environment

| File | Committed | Contains |
| --- | --- | --- |
| `.env.example` | yes | every variable, values empty or local defaults |
| `.env` | **no** | the actual values |
| `.env.development` | no | local-only overrides |

```sh
cp .env.example .env
```

**Every `.env` or `vue.config.js` change needs a restart.** They are compile-time
values in a webpack build. A change that appears not to take effect is almost
always this.

### The rule that causes the most confusion

Shell and module compile **separately**. A `VUE_APP_*` value read by this
module's source is replaced from **this module's** `.env`.

> If `VUE_APP_URL_KOD` is missing here, the module builds the URL
> `undefined/kategori-program`, and the browser receives a 404 from somewhere
> unexpected. The code is correct; the environment is incomplete.

A base used by both applications must be in **both** environment files.

---

## 3. Scripts

```json
{
  "scripts": {
    "serve": "vue-cli-service serve",
    "build": "vue-cli-service build"
  }
}
```

| Command | Does |
| --- | --- |
| `npm run serve` | dev server with federation, per `VUE_APP_REMOTE` |
| `npm run build` | production bundle, including `remoteEntry.js` when remote mode is on |

Extend this list deliberately. A new script is a new thing every developer and
every CI job depends on. Adding `package.json` scripts is not part of a feature;
it is a Change Request against `05-development/TOOLS.md`.

---

## 4. Modes

| Mode | `VUE_APP_REMOTE` | Entry | Use |
| --- | --- | --- | --- |
| Preview | `off` | `src/preview/main.js` | Developing a view alone |
| Remote | `on` | `src/remote-entry.js` | Shell integration, and building |

In preview mode the module installs its own router, Pinia, i18n, the UI plugin
and the stylesheet, so a view renders with no Shell present. That is the fastest
loop and it should be the default for view work.

---

## 5. Build configuration

`vue.config.js` holds the federation contract. Changes here are
cross-repository by definition — see `02-governance/GUARDRAILS.md` §3 and §4.

| Setting | Value | Why |
| --- | --- | --- |
| `name` | `{{MODULE_NAME}}` | The container identity. Public contract. |
| `filename` | `remoteEntry.js` | Fixed name; the Shell hardcodes it |
| `publicPath` | from `VUE_APP_MFE_BASE` | Assets must resolve from the remote's own origin |
| `chunkLoadingGlobal` | `webpackChunk{{MODULE_PASCAL}}` | Unique; a collision breaks chunk loading |
| `uniqueName` | a unique string | Same reason |
| `productionSourceMap` | `false` | Never publish source maps to a static host |
| `resolve.symlinks` | `false` (setter call) | Peer resolution through a `file:` symlink |
| peer aliases | `pinia$`, `vue-router$`, `vue-i18n$` | npm auto-installs peers into the package's own tree |
| `shared` | the four singletons | `singleton: true`, no `eager` |

**Do not "tidy" the aliases or the symlink setting.** They are not defensive
extras; they are what makes the shared singletons work. See
`03-architecture/ARCHITECTURE.md` §3.6.

---

## 6. Pull request

A PR that will pass review:

| # | Requirement |
| --- | --- |
| 1 | Title follows Conventional Commits |
| 2 | Description says what changed, why, and how it was verified — with command output |
| 3 | Scope: every touched document is in the same commit |
| 4 | No unrelated reformatting. A `git diff` of 2000 lines where 20 matter will not be reviewed carefully, and the 20 are the point. |
| 5 | Screenshots or a Playwright run for any visual change |
| 6 | Tests added or updated, including the failure case |
| 7 | `npx -y @lqmnwido/dreams-ai-skills-check` passes |
| 8 | No new dependency without `05-development/TOOLS.md` |

---

## 7. Working rules

- **Read before writing.** Grep for an existing helper before creating one.
- **One commit, one thing.** Bug fix and reformat are two commits.
- **Never edit generated output.** No hand-editing `dist/`, no hand-editing
  `package-lock.json`.
- **Never commit `node_modules/`, `dist/` or `.env`.**
- **Delete a dead view in the same change that makes it dead.** A view nothing
  routes to is a page someone will eventually find and try to fix.
- **Leave a note when you preserve legacy behaviour**, with the reason. Future
  readers cannot tell an intentional port from a mistake.

---

## 8. Adding a new view

```sh
mkdir -p src/views/{{NEW_SUBMODULE}}
$EDITOR src/views/{{NEW_SUBMODULE}}/index.vue
```

Then, all of:

1. Add the expose key in `vue.config.js`.
2. Add the route in the **Shell**, with `authRequired: true` and `meta.roles`.
3. Add the menu entry and the role, in the fixture **and** the server-side menu.
4. Add the API contract entry if it calls anything new.
5. Add the preview route in `src/preview/router.js`.
6. Add translations in every locale.
7. Update `07-delivery/SYNC.md` — an exposed page is a contract.

Skipping step 2 or 3 is the most common way a view becomes unreachable: the
expose works, and no route imports it.

---

## 9. Local ports

| Repository | Port | Command |
| --- | --- | --- |
| Shell | 3000 | `npm run serve` |
| `{{MODULE_NAME}}` | `{{REMOTE_PORT}}` | `npm run serve` |
| `@2enapps/ui` | n/a | `npm run build` before a local-link consumer starts |

Two `npm run serve` processes, in two terminals. The Shell's role is to serve
the host and probe `{{REMOTE_PORT}}/remoteEntry.js`; the module's is to serve the
container.
