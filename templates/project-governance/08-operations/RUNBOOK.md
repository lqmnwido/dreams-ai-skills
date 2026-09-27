<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# RUNBOOK — {{MODULE_NAME}}

The procedures you run when something is wrong, and the order to run them in.

**Start here, not in the code.** `06-quality/DEBUG.md` is for finding the cause;
this document is for restoring service. A runbook that requires reading source
is not a runbook.

---

## 1. The five-minute triage

Everything below depends on knowing these five things. Gather them first, every
time, in this order.

```sh
# 1. Is the container there?
curl -sS -o /dev/null -w 'status=%{http_code} type=%{content_type}\n' \
  "$VUE_APP_MFE_BASE/remoteEntry.js"
curl -sSI "$VUE_APP_MFE_BASE/remoteEntry.js" | grep -i 'access-control-allow-origin\|content-type\|cache-control'

# 2. Is a release the trigger?
git log --oneline -5 --date=iso --pretty='%h %ad %s'
#   → compare against the deploy marker on the chart

# 3. What is the version actually loaded?
#   → the response headers of the container, or a build marker in the footer
#   → if this does not match the last release, you are looking at a cache

# 4. What does the browser say?
#   → Console first for local failures, Network first for anything crossing
#      a boundary

# 5. Is it everyone, or some users?
#   → some users ⇒ roles, tenant, locale, or one cached browser
```

| Question | Answer | Go to |
| --- | --- | --- |
| Container 404 / 500 | The deploy failed, or the base URL is wrong | §2 |
| Container serves the wrong content type | Refused by the loader | §2 |
| CORS header missing or wrong | The Shell cannot load it | §2 |
| Container is an old version | Cache | §3 |
| Container is fine | The failure is inside the module | §4 |
| API failing | The failure is on the other side of the contract | §5 |
| Only some users | Not a deployment problem | §6 |

> **A module has no server to restart.** It is a static bundle. "Restart" here
> means redeploy, purge the cache, or fix the environment the bundle was
> compiled with — and every one of those is a release, so it goes through
> `07-delivery/RELEASE.md`.

---

## 2. The container is unreachable

`remoteEntry.js` is missing, or served wrong. Nothing in this module can work.

| Symptom | Cause | Action |
| --- | --- | --- |
| `404` | The deploy never happened, or `publicPath` is wrong so the file is not where it is published | Redeploy the previous tag. If the file is in `dist/` but 404s, `publicPath` is wrong. |
| `200` but `text/html` | The host serves `index.html` for unknown paths | Serve `.js` as `application/javascript`; disable the HTML fallback for `.js` |
| `403` | The host is private, or the path is not public | Check the bucket policy and the deployed prefix |
| `200`, correct type, no CORS header | The origin is not allowed | Add the **exact** Shell origin. Not `*` — the request sends credentials. |
| `200` in the terminal, fails in the browser | A proxy/CDN in front, or HTTPS mixed content | Compare the header set in both places |
| `502` / `503` | The host itself is down or the origin is wrong | Escalate to whoever runs the host. Nothing in this repository fixes it. |

```sh
# Confirm the file exists in the build before blaming the host
ls -l dist/remoteEntry.js
head -c 120 dist/remoteEntry.js      # must be JavaScript, not HTML
```

**The CORS rule:** `Access-Control-Allow-Origin` must be the exact Shell origin,
including the scheme and the port. `http://localhost:3000` and
`http://localhost:3002` are different origins, and a wildcard is invalid for a
credentialed request.

---

## 3. The users have the old version

The most confusing failure in this architecture, because nothing is red.

**Symptom:** a fix was released, and the behaviour is unchanged. Or a fix is in
production and one user still sees the bug.

| Cause | Check | Action |
| --- | --- | --- |
| `remoteEntry.js` is cached immutably | `cache-control` on the container | `no-cache` on the container and `index.html`; immutable only for hashed assets |
| The CDN holds a stale object | Compare the header set at the edge and at the origin | Purge by path, not the whole site |
| The user's browser cached it | A hard reload in a private window still shows it | Ask the user for a hard reload; add a version marker to the UI |
| The Shell cached the old container | The Shell's own cache headers | Purge the Shell |
| The deploy did not happen | The deploy marker is absent from the chart | Check the pipeline, then redeploy |
| The wrong artefact was deployed | Its footer version, or a build hash | Redeploy the correct tag |

> **`remoteEntry.js` is not content-hashed.** Everything else in `dist/` is. So
> the one file that decides which version runs is also the one file that can be
> served stale forever. It must never be cached immutably.

### Proving a version, cheaply

A version you cannot observe is a version you cannot roll back from. Render the
build hash, the module version and the `@2enapps/ui` version in a footer or a
`data-` attribute, visible without devtools. Every "it's still the old version"
report becomes answerable in one glance.

---

## 4. Federation and integration

The module's own code is fine; the wiring is not.

| Symptom | Cause | Action |
| --- | --- | --- |
| `Module … does not exist in container` | The Shell's `import()` and the module's `exposes` key differ | Compare the strings character for character; the key loses its leading `./`. Restart the module, then hard-refresh the Shell. |
| The Shell's fallback renders | The container is unreachable, or the import resolved to a stub | `curl` the container. Confirm the Shell's base for this module is registered. |
| A blank route, no fallback | The loader failed, so there was no fallback to show | Register the remote in **both** the Shell's `REMOTE_LABELS` and `REMOTE_BASES` |
| `getActivePinia() was called…` | A second Pinia instance | The `shared` block, `resolve.symlinks(false)` (a setter call, not a property), and the exact-match `$` peer aliases. `02-governance/GUARDRAILS.md` §2 |
| Two instances of Vue | Same cause | Same fix |
| The page is unstyled | The stylesheet was not imported | `import "@2enapps/ui/styles.css"` in the entry, once |
| The module has its own sidebar | It is rendering its own layout | Remove the wrapper. The Shell owns the chrome. |
| It works in preview, fails in the Shell | Preview bypasses federation | Debug the Shell path. Preview is not evidence. |
| `404` on chunks after a deploy | `publicPath`, or cached HTML pointing at old assets | `publicPath` must be the module's absolute base |
| The route works, the menu 404s | `capaianUrl` ≠ the route `path` | They must match exactly |
| Everything denies locally | No backend, so no menu, so no roles | `VUE_APP_SKIP_ROLE_CHECK=1` in a **local** `.env.development` only |

Full symptom table: `06-quality/DEBUG.md` §3.1. Bisecting a federation defect:
`06-quality/DEBUG.md` §5. Registration procedure:
`03-architecture/INTEGRATION.md`.

---

## 5. API and data

| Symptom | Cause | Action |
| --- | --- | --- |
| `undefined/kategori-program` in a URL | The API base is missing from **this module's** `.env` | Add it here and restart. The module compiles separately from the Shell. |
| It works in the Shell, not the module | Same | The value must be in both `.env` files if both read it |
| A `.env` change has no effect | Not restarted | These are compile-time values |
| `401` | Token missing, expired, or the wrong audience | Confirm the host adapter is installed before the first request. A remote that asks for headers before `createHostAdapter()` throws instead of returning them. |
| `403` for a permitted user | The endpoint's role differs from the route's | Align all three: route, menu, API |
| `403` for everyone after a release | A role was removed or renamed in the backend | Restore the role. The frontend cannot fix it. |
| The response body is `undefined` | The call bypassed the `data` envelope | Use the `returnResponse*` helpers |
| No audit record after a write | The write bypassed the response helpers | Route writes through them |
| A field is `undefined` in the payload | The backend changed the shape | A contract change: `03-architecture/API-CONTRACT.md`, a version bump, and `07-delivery/SYNC.md` |
| Duplicates after a retry | A retried `POST` | Never auto-retry a non-idempotent call |
| The list is slow | Client-side sort or filter above the page size | Sort and paginate server-side |
| One user sees another user's data | Object-level authorization missing | SEV-1, security. `02-governance/SECURITY.md` |

> **The menu is not the boundary, and the route guard is not the boundary.**
> The backend is. When the two disagree, the backend is right and the frontend
> is wrong — regardless of which one is easier to change.

---

## 6. The affected scope is small

Some users, one role, one locale, one browser. Not a deployment problem.

| Scope | Likely cause | Check |
| --- | --- | --- |
| One role only | A role mismatch across route, menu, and API | Compare all three |
| One tenant only | Object-level authorization | Same query, two tenants, two results |
| One locale only | A missing translation key | All six: `bm`, `en`, `ms`, `zh`, `ar`, `es` |
| `ar` only, mirrored oddly | Physical CSS properties | Logical properties: `margin-inline-start` |
| One browser only | A cache, or a stale service worker | A private window, hard reload |
| One environment only | A variable set in one `.env` only | `07-delivery/DEPLOYMENT.md` §2 |
| Everyone, only after a deploy | The release | §3 and §7 |
| Everyone, since a date, no deploy | Data or a backend change | The timeline, not the repo |

---

## 7. Rollback

The first action, not the last. A rollback restores service; a diagnosis
explains it. Do both, in that order.

| Situation | Action | Time |
| --- | --- | --- |
| This module is at fault | Redeploy the previous tag | ~1 min |
| The Shell is at fault | Redeploy the Shell's previous tag | ~1 min |
| `@2enapps/ui` is at fault | Pin it back in **every** consumer, then redeploy each | ~10 min |
| The backend is at fault | Roll the backend back | Minutes |
| An incompatible contract change | There is no version to go back to | — |

```sh
# The rollback, as an operation
git tag --list 'v*' --sort=-v:refname | head -3   # know the target first
git checkout <previous-tag>
npm ci
VUE_APP_REMOTE=on npm run build                  # the production environment
# deploy, then verify: container 200, correct type, the route renders
```

| Rule | Why |
| --- | --- |
| Never promote a build artefact between environments | The build is bound to its environment. Rebuild from the matching branch. |
| A rollback is a release | It gets its own entry, so the timeline is honest |
| The previous artefact is retained, not deleted | Otherwise there is nothing to roll back to |
| After rolling back, verify the *symptom* is gone | The cause may be elsewhere and the rollback may be irrelevant |
| A rollback that takes more than one step is not one | If it is, the release was not reversible — that is the finding |

---

## 8. Cache purge

Almost always the step between "redeploy" and "nothing happened".

| Asset | Correct header | Purge by |
| --- | --- | --- |
| `remoteEntry.js` | `no-cache` or a very short `max-age` | Path, not the whole site |
| `index.html` | `no-cache` | Path |
| `js/css` with a content hash | `immutable`, one year | Never needed |
| The Shell's `index.html` | `no-cache` | Path |

**Order:** deploy → purge the container → purge `index.html` → hard-refresh one
browser → verify → check the chart, not the browser.

---

## 9. Local development recovery

| Symptom | Action |
| --- | --- |
| The preview is blank | `VUE_APP_REMOTE=off` still on, or a stale `dist/`. Remove `dist/` and restart. |
| The preview shows the Shell's layout | The module is loading the Shell. Check `VUE_APP_REMOTE`. |
| Federation errors that only appear locally | The module was started without the `shared` config, or `symlinks` was set as a property instead of called. |
| Peers resolve to the wrong instance | `resolve.symlinks(false)` must be a **call**; the peer aliases must match exactly. |
| `npm ci` fails | The lockfile is out of sync. Regenerate deliberately and read the diff. |
| Two machines, two behaviours | An uncommitted lockfile, or a branch dependency that moved |
| The build output differs | Node version. Pin it. |
| Switching `file:` ↔ git broke peers | The symlink and npm auto-install-peer traps: `03-architecture/ARCHITECTURE.md` §3.6 |

---

## 10. Cross-repository procedures

**The single most important thing in this document.** A remote module's runtime
depends on three other repositories, and a failure in any of them looks like a
failure in this one.

### Establish the actual versions

```sh
# In every affected repository, before any diagnosis
git rev-parse --short HEAD
npm ls @2enapps/ui vue pinia vue-router vue-i18n --depth=0
grep -E 'VUE_APP_URL_|VUE_APP_SHELL_BASE' .env .env.example 2>/dev/null
```

Then compare against `07-delivery/SYNC.md` §1. A combination that is not in
the matrix is `❓`, and `❓` behaves exactly like ⚠️.

### The bisect order for a cross-repository fault

1. Does the module's own container load? → `curl`
2. Do the expose keys match the Shell's imports, exactly?
3. Do `vue`, `pinia`, `vue-router` and `vue-i18n` resolve to one instance?
4. Is the Shell's base for this module the deployed origin?
5. Do the API bases in **this module's** `.env` match the deployed environment?
6. Does the Shell's route role equal the menu role equal the API role?
7. Only then: is the module's own code at fault?

### Who owns the fix

| The fault is in | The fix goes in | Not |
| --- | --- | --- |
| This module's view or service | This repository | The Shell |
| This module's `exposes` or `shared` | This repository, plus a Shell update afterwards | The Shell alone |
| The Shell's route, menu, or base | The Shell repository, with a CR here | A workaround here |
| `@2enapps/ui` | The shared package, then every consumer | One consumer |
| An API | The backend repository | A hardcoded mock |

> **Never fix a cross-repository fault with a local workaround.** A workaround
> hides the fault in one environment and leaves the contract broken everywhere
> else. The one exception is a *documented* workaround with the real fix
> tracked, and then both are in the CR.

---

## 11. Procedure index

| Situation | Procedure |
| --- | --- |
| Nothing loads at all | §1, then §2 |
| Users see an old version | §3 |
| The Shell shows a fallback or a blank route | §4 |
| Data is missing or wrong | §5 |
| Some users only | §6 |
| A release caused it | §7 |
| Nothing changed after deploying | §8 |
| Local development is broken | §9 |
| More than one repository is involved | §10 |
| It is affecting users now | `08-operations/INCIDENT.md` |
| You need the cause, not the fix | `06-quality/DEBUG.md` |

---

## 12. Local specifics

Fill these in once. They are the values you will otherwise be grepping for at
an awkward moment.

| Item | Value |
| --- | --- |
| Module name | `{{MODULE_NAME}}` |
| Repository | `{{REPO_NAME}}` |
| Route prefix | `{{ROUTE_PREFIX}}` |
| Exposed pages | `{{EXPOSE_LIST}}` |
| Shell repository | `{{SHELL_REPO}}` |
| Shell origin (local) | `{{SHELL_ORIGIN}}` |
| Local port | `{{REMOTE_PORT}}` |
| UI dependency | `{{UI_DEPENDENCY}}` |
| API bases read | `{{API_BASES_LIST}}` |
| Deployed base | `{{MODULE_BASE}}` |
| Previous known-good release | `{{ROLLBACK_TARGET}}` |
| Deployment owner | `{{OWNER}}` |
| Escalation contact | `{{ESCALATION_CONTACT}}` |
| Last tested | {{REVIEW_DATE}} |

---

## 13. Drill

| Cadence | Drill | Pass condition |
| --- | --- | --- |
| Monthly | Roll back to the previous tag and back | Under 5 minutes, observed |
| Monthly | Purge the container cache and confirm the new version loads | Observed in a real browser |
| Quarterly | Every §11 procedure, as a table-top walkthrough | No step requires reading source |
| Quarterly | A cross-repository version mismatch, injected deliberately | Diagnosed using §10 within 15 minutes |
| After any SEV-1 or SEV-2 | A drill of that failure mode | The runbook covers it, or it is amended |

> **A procedure that has never been executed is documentation, not a runbook.**
> The first execution of a real rollback is always slower than expected and
> always reveals a missing credential or a missing tag. Do it while nothing is
> broken, and write down what was actually observed.
