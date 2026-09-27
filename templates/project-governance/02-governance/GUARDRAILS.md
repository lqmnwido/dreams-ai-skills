<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# GUARDRAILS — {{MODULE_NAME}}

**These are prohibitions. There is no exception, no "small enough", and no
"we'll fix it after the demo".** A guardrail exists because the failure it
prevents is silent, expensive, or both.

This file is loaded at the start of every session, before anything is read or
written. A violation found later in a change is a `CHECK` failure and a reason to
stop, not a review comment to address later.

---

## 1. Authentication

> **Never create a second authentication client.**

The Shell initialises Keycloak once. A remote receives the session through the
host adapter. Consequences of violating this:

- A second client means a second token refresh schedule. When the Shell's
  refresh succeeds and the remote's does not, the remote fails on the request
  after the access token expires, in production, for some users only.
- A client secret in a frontend repository is a published secret. Frontend
  bundles are readable by anyone who can load the page.
- Two session stores mean a logout in one does not log out the other.

**Also prohibited**

- Storing a token, a refresh token, or an `authId` in module-local storage.
- Reading credentials from `localStorage` directly instead of through the adapter.
- Setting `authRequired: false` on a route that handles real data. The existing
  V2T route has it for local access; **do not copy that pattern to a protected
  module**.
- Setting `VUE_APP_SKIP_ROLE_CHECK=1` anywhere other than a local
  `.env.development`. It must never be present in a deployed environment, and it
  must never be tied to another flag that reads "yes" in a broken deployment.

---

## 2. Shared singletons

> **Never bundle a second copy of `vue`, `vue-router`, `pinia` or `vue-i18n`.**

These must resolve to the instance the Shell loaded. A second copy does not
throw at build time; it fails at runtime, usually as:

```
getActivePinia() was called but there was no active Pinia
```

or, worse, as a store that renders the wrong value because the Shell wrote to
its own instance.

This is not only a `shared` configuration problem. Two mechanisms break it:

1. **Symlinked packages.** A `file:` dependency is a symlink; webpack resolves it
   to its real path, so a peer import resolves inside the shared package's own
   `node_modules` instead of the application's. `resolve.symlinks` must be set
   with the webpack-chain *setter call* (`config.resolve.symlinks(false)`), not by
   assignment — assignment overwrites the method and silently does nothing.
2. **npm's peer auto-install.** npm installs a package's `peerDependencies` into
   that package's own `node_modules`, and that copy is found first. Bare
   specifiers must be aliased back to the application's copy. Use exact-match
   aliases (`name$`) so subpath imports still resolve normally.

**Prohibited**

- Adding a peer of the shared UI package to a module's own `dependencies` at a
  different version.
- Declaring a shared singleton `eager` in a remote when the Shell does not. The
  Shell owns the eager set, because the share-scope entry must exist before any
  remote module is evaluated.
- Editing the `shared` block in a remote to "fix" a resolution problem without
  reading this section first.

---

## 3. Ownership boundaries

> **Never move work across a repository boundary to make a change convenient.**

| Never | Instead |
| --- | --- |
| A feature page in the Shell | Expose it from the module that owns the feature |
| Shell logic (auth, routing, menu) in a remote | Change the Shell |
| A forked UI component in a module or the Shell | Change `@2enapps/ui` and consume the new version |
| A module calling an endpoint it does not own | Ask the owner; add it to `03-architecture/API-CONTRACT.md` |
| A hardcoded `CORS` origin to make a fetch work | Configure the origin properly, or proxy through the host |

See `01-product/SCOPE.md` §3 for the full list.

---

## 4. Contracts

> **Never change a public contract in one repository without the other.**

| Contract | Lives in | Breaking it looks like |
| --- | --- | --- |
| Federation expose key | remote `vue.config.js` + Shell route import | `Module does not exist in container` |
| Remote name | remote `ModuleFederationPlugin.name` + Shell `remotes` | The container is never loaded; the Shell falls back |
| Route path | Shell `routes.js` + menu `capaianUrl` | Menu link 404s |
| Role id | Shell `meta.roles` + menu `listRole` + API authorization | User sees a menu they cannot use, or is denied a page they should reach |
| `@2enapps/ui` version | every consumer's `package.json` | Missing export, or a second Pinia |
| API shape | `03-architecture/API-CONTRACT.md` | `undefined` in a payload; a view rendering a blank table |
| Environment variable | the `.env.example` of the module that **reads** it | `undefined/kategori-program` and a 404 |

An expose key, a remote name and a route path are public contracts. Changing one
is a major version bump, coordinated, per `07-delivery/VERSIONING.md`.

---

## 5. Authorization

> **Never treat the Shell's route guard as a security boundary.**

The guard stops a user from navigating. It does not stop them from calling the
API. The browser is the user's machine.

**Prohibited**

- An endpoint that trusts a role, a header, or a body field supplied by the
  frontend for an authorization decision.
- `VUE_APP_SKIP_ROLE_CHECK` in any deployed configuration.
- A menu fixture (`offline-menu.js`) treated as granting access. It is a
  **local/offline fallback only**. Production roles come from the server-side
  menu source.
- Logging a token, a password, a full `Authorization` header, or personal data
  to the console or to a third-party error tracker.

---

## 6. Secrets and environment

- **Never commit `.env`.** Commit `.env.example` with empty values.
- **Never commit a key, a token, a client secret, a certificate or a private
  key**, in any form, including inside a comment.
- Every URL, port, bucket name and tenant origin is read from the environment at
  compile time. No literal in source.
- A base URL used by a module's own code must exist in **that module's** `.env`.
  The Shell's `.env` does not supply it: the two compile separately.
- Environment variables are compile-time constants in this build. A value that
  must change without a rebuild does not belong in a `VUE_APP_` variable.

---

## 7. Data and privacy

This platform handles personal and official data. Treat accordingly.

- Do not log personal data, or send it to a third-party service, without a
  documented decision in `02-governance/SECURITY.md`.
- Do not store personal data in `localStorage` or `sessionStorage` beyond what
  the Shell already stores for the session.
- Uploaded files are validated on the server. A client-side check is a usability
  affordance, not a control.
- Audit trail records are written by the module's response helpers, and are the
  backend's to persist. Do not bypass them for a "temporary" call.

---

## 8. Code integrity

- **Never** weaken a lint rule, a type, or a test to make a change pass. Fix the
  code, or write a Change Request explaining why the rule is wrong.
- **Never** catch and swallow. An empty `catch` converts a bug into silence.
- **Never** commit commented-out code. Git remembers it.
- **Never** copy a helper that already exists. Duplicated code diverges, and the
  fix lands in one copy.
- **Never** report a result you did not observe. Run the command, read the
  output, quote it. "Should work" is not evidence; "verified" without a command
  is a false claim and is treated as a defect in the report itself.
- **Never** fill a `{{PLACEHOLDER}}` with a plausible guess. Fill it with the
  real value or leave it visible and say it is open.

---

## 9. Deployment

- **Never** set `VUE_APP_SKIP_ROLE_CHECK` in any deployed environment.
- **Never** deploy a build whose `remoteEntry.js` is not reachable from the Shell
  origin. The remote is a separate origin; an unreachable container is a blank
  route, not an error message.
- **Never** deploy the Shell and a module from branches that were never tested
  together. `07-delivery/SYNC.md` records which combinations are known good.
- **Never** deploy without a rollback path. A release that cannot be reverted in
  one step is not a release.

---

## 10. Enforcement

`06-quality/CHECK.md` verifies what can be verified mechanically:

| Guardrail | Check |
| --- | --- |
| §1 second auth client | no `keycloak-js` import outside the Shell; no secret-shaped literal |
| §2 second singleton | the `shared` block matches the Shell's; no duplicate peer in `dependencies` |
| §3 boundaries | a Shell change touching `src/views/<feature>/` is flagged |
| §4 contracts | expose keys and Shell imports compared for exact match |
| §5 authorization | `VUE_APP_SKIP_ROLE_CHECK` absent from deployed env files |
| §6 secrets | secret scan; no `.env` committed |
| §7 privacy | no personal data in logs |
| §8 integrity | no empty `catch`, no `console.log`, no commented-out block |
| §9 deployment | `remoteEntry.js` reachable and CORS-permitting from the Shell origin |

The rest is not mechanically checkable and is reviewed by a human. That is why
they are written down here rather than left to judgement.
