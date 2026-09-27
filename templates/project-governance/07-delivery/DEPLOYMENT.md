<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# DEPLOYMENT — {{MODULE_NAME}}

Environments, pipelines, and the order things go live in.

`{{MODULE_NAME}}` is a **static** artifact deployed to `{{DEPLOY_TARGET}}`. It has
no server, no database and no runtime configuration: everything it needs is baked
in at build time from the environment it was built with.

That single fact drives everything below.

---

## 1. Environments

| Environment | Built from | `VUE_APP_REMOTE` | API bases | Who uses it |
| --- | --- | --- | --- | --- |
| Local | working tree | `off` for preview, `on` for integration | `localhost` or a dev backend | developers |
| Development | `develop` | `on` | development | the team |
| Staging | `release/*` | `on` | staging | QA, UAT |
| Production | `main` tag | `on` | production | users |

### The build-time rule

> **The build is bound to the environment it was built for.** A production bundle
> contains the API URLs it was compiled with, in plain text, and it cannot be
> repointed without a rebuild.

So:

- Never promote a build artefact between environments. **Rebuild from the
  matching branch with the matching environment.**
- Never build once and deploy to two environments "to save time". That is how a
  staging bundle ends up calling production.
- A build for production is built from `main`, from a clean checkout, with a
  committed lockfile.

---

## 2. Environment variables per environment

```env
# Development
VUE_APP_MFE_BASE=http://localhost:{{REMOTE_PORT}}
VUE_APP_REMOTE=on
VUE_APP_SHELL_BASE=http://localhost:3000
VUE_APP_{{MODULE_PASCAL_UPPER}}_PORT={{REMOTE_PORT}}
VUE_APP_URL_KOD={{DEV_API_BASE}}
```

| Rule | Why |
| --- | --- |
| Every variable is in `.env.example` | Discoverable without a real `.env` |
| `.env` is never committed | No secret in history |
| Production secrets are injected by the platform | Not in the repository |
| The variable set is identical across environments | A variable that only exists in staging fails in production, at runtime, for every user |
| `VUE_APP_SKIP_ROLE_CHECK` never appears in a deployable file | It disables the role guard |

**A variable that exists in one environment and not another is a defect**, even
if nobody has noticed yet.

---

## 3. Build

```sh
# A production build is reproducible and traceable.
git checkout main && git pull --ff-only
npm ci                                     # from the committed lockfile
npm run build
```

| Output | Purpose |
| --- | --- |
| `dist/index.html` | The remote's own page, used in preview |
| `dist/remoteEntry.js` | The container the Shell loads. **Must exist.** |
| `dist/js/*` | Chunks, served from the module's own origin |
| `dist/css/*` | Styles |

### Build requirements

| Requirement | Value | Why |
| --- | --- | --- |
| Node | `^20.19.0 \|\| >=22.12.0` | A different major changes the output |
| Lockfile | `package-lock.json`, committed | Reproducibility |
| `VUE_APP_REMOTE` | `on` | Without it there is no `remoteEntry.js` |
| `publicPath` | the module's absolute base | Assets must resolve from the remote's origin |
| `productionSourceMap` | `false` | Never publish source maps |
| `VUE_APP_MFE_BASE` | the deployed module base | Wrong value, wrong asset URLs |

---

## 4. Serving

The module is served as static files, and it is a **different origin** from the
Shell. That has consequences.

| Requirement | Detail |
| --- | --- |
| `Content-Type` for `remoteEntry.js` | `application/javascript`. A wrong type is refused by the module loader. |
| CORS on `remoteEntry.js` | `Access-Control-Allow-Origin` must be the **exact** Shell origin |
| Path-based routing | Not needed — a remote has no routes of its own. `historyApiFallback` applies to preview only. |
| Caching | `remoteEntry.js` and `index.html` must **not** be cached immutably; hashed assets may be |
| HTTPS | Required. A module loaded over HTTP on an HTTPS page is blocked. |
| `Cross-Origin-Resource-Policy` | Must permit the Shell origin, or the container is blocked |

### The caching rule that breaks deployments

`remoteEntry.js` is **not** content-hashed. If it is served with a long
`max-age` or an immutable cache header, a deployed Shell keeps loading the old
container after the module is updated — so the module is "released" and nothing
changes. The user gets no error; they get the old version.

| Asset | Cache |
| --- | --- |
| `remoteEntry.js` | `no-cache` or a short `max-age` |
| `index.html` | `no-cache` |
| Hashed JS/CSS | immutable, one year |

---

## 5. The pipeline

```
  commit / merge
      ↓
  build      npm ci → npm run build
      ↓
  verify     remoteEntry.js present · CORS header · the module renders in a browser
      ↓
  deploy     static assets to the module origin
      ↓
  smoke      the Shell route renders the remote, from the deployed origin
      ↓
  verify     07-delivery/SYNC.md reflects the deployed combination
```

**The smoke test deploys nothing.** It loads the Shell route against the deployed
remote. If the container is not reachable, the Shell shows its fallback — which
means the release is broken, and the fallback is the only thing standing between
the user and a blank page.

---

## 6. Deployment order

Each repository is deployed independently, so an order exists whether or not it
was chosen.

| Change | Deploy first | Why |
| --- | --- | --- |
| Additive API field | Backend | The frontend must tolerate a field that may be absent |
| New API endpoint | Backend, then the module | A module that calls a missing endpoint 404s |
| `@2enapps/ui` update | The shared package, then consumers | A module must not expect an export that does not exist yet |
| New exposed page | The module, then the Shell route | A Shell route importing a missing expose renders the fallback |
| Shell route / menu entry | The Shell, then the module | Otherwise the route exists before its container |
| Role added to the backend | Backend, then the menu | A menu entry with no backend role is a dead link |
| **Removal of anything** | Reverse | Remove consumers before providers |

> **A new expose path is deployable in either order, but only if the Shell's
> fallback works.** Deploy the module first and the Shell route is simply
> unreachable until the Shell release — which is a better failure than a Shell
> route with no container.

---

## 7. Rollback

| Situation | Action |
| --- | --- |
| The module is broken | Redeploy the previous tag. Seconds. |
| The Shell is broken | Redeploy the previous tag |
| The shared package is broken | Pin the version back in every consumer, then redeploy each |
| A backend change is broken | Roll the backend back; the frontend is compatible with both if the change was additive |
| A contract was changed incompatibly | A rollback is required. There is no version to move back to. This is why §6 exists. |

Rules:

- A release that cannot be reverted in one step is not a release.
- Every release is tagged. `07-delivery/RELEASE.md`.
- The previous artefact is retained, not deleted at deploy time.
- A rollback is a release: it gets its own entry, so the timeline is honest.

---

## 8. Pre-deployment checklist

- [ ] Built from the correct branch, from a clean checkout
- [ ] `npm ci` — the lockfile was used, not regenerated
- [ ] `VUE_APP_REMOTE=on`
- [ ] `VUE_APP_MFE_BASE` is the deployed origin, not localhost
- [ ] `dist/remoteEntry.js` exists
- [ ] `productionSourceMap: false`
- [ ] Every production environment variable is set, and set to the production value
- [ ] `VUE_APP_SKIP_ROLE_CHECK` is absent
- [ ] `remoteEntry.js` is served as `application/javascript`
- [ ] CORS allows the exact production Shell origin
- [ ] `remoteEntry.js` is not cached immutably
- [ ] The tests pass, including E2E
- [ ] The governance check passes
- [ ] `07-delivery/SYNC.md` records this version combination
- [ ] The rollback target is known
