<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# DEBUG — {{MODULE_NAME}}

A troubleshooting guide, not a philosophy. The symptom is on the left; the cause
and the fix are on the right.

**The first rule: reproduce before you fix.** A change made before reproduction
is a guess, and a guess that happens to work has left the actual cause in place.

---

## 1. The loop

```
   REPRODUCE     get it to happen on demand, from a clean state
       ↓
   OBSERVE      console, network tab, response body — facts, not theories
       ↓
   HYPOTHESISE  one candidate at a time, written down before testing it
       ↓
   TEST         the cheapest check that would disprove it
       ↓
   FIX          the cause, not the symptom
       ↓
   VERIFY       the original reproduction no longer works
       ↓
   PREVENT      a test, or a document, so it cannot come back silently
```

**If you cannot reproduce it, you cannot fix it.** "Sometimes" is itself a
finding: it points at a race, a cache, or an ordering dependency, and each has a
different investigation.

---

## 2. Capture first

Before changing anything:

```sh
git rev-parse HEAD
git status --porcelain
cat .env | grep -v -i "key\|secret\|token\|password"
curl -sS -o /dev/null -w 'status=%{http_code} type=%{content_type}\n' \
  "$VUE_APP_MFE_BASE/remoteEntry.js"
```

Then record it in the format from `06-quality/AUDIT.md` §3: symptom,
environment, numbered steps, expected, actual, reproducible-always-or-sometimes,
console output, and the network requests.

---

## 3. Symptom table

### 3.1 Federation and loading

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Module … does not exist in container` | The Shell's `import()` and the remote's `exposes` key differ | Compare the strings exactly, character for character. The key loses its leading `./` in the import. Restart the remote, then hard-refresh the Shell. |
| The route renders the Shell's fallback | The container is unreachable, or the module resolved to an empty stub | `curl <base>/remoteEntry.js` — it must return JavaScript. Confirm the Shell's `VUE_APP_MFE_BASE_<MODULE>` points at the right origin. |
| The route renders a blank page | The fallback was not used, so the import resolved to a stub | Check the Shell registered the remote in **both** `REMOTE_LABELS` and `REMOTE_BASES`. Without a base there is no recovery probe. |
| The fallback appears only in preview mode | `VUE_APP_REMOTE=off` is still set | Set it to `on` and **restart**. It is a compile-time value. |
| `getActivePinia() was called but there was no active Pinia` | A second Pinia instance | The `shared` block, `resolve.symlinks(false)` (setter call), and the exact-match peer aliases. See `02-governance/GUARDRAILS.md` §2. |
| Vue warns "two instances of Vue" | A second Vue | Same cause, same fix. |
| The page is unstyled | The stylesheet was not imported | `import "@2enapps/ui/styles.css"` in the entry, once |
| Chunks 404 after a deploy | `publicPath` is wrong, or cached HTML points at old assets | `publicPath` must be the remote's absolute base. Purge the CDN and hard-refresh. |
| A build succeeds but `remoteEntry.js` is absent | `VUE_APP_REMOTE=off`, or a stale build | Set `on`, remove `dist/`, rebuild |

### 3.2 Environment and URLs

| Symptom | Cause | Fix |
| --- | --- | --- |
| `undefined/kategori-program`, then a 404 | The API base is missing from **this module's** `.env` | Shell and module compile separately. Add it here, and restart. |
| The API works in the Shell, not in the module | Same | The value must be in both `.env` files if both read it |
| A `.env` change has no effect | Not restarted | These are compile-time values |
| CORS error in the console | `VUE_APP_SHELL_BASE` does not match the Shell's real origin | Include the port. `localhost:3000` and `localhost:3002` are different origins. |
| CORS error with credentials | `Access-Control-Allow-Origin: *` on an endpoint that sends credentials | Wildcards are invalid with credentials. Configure the exact origin. |
| The request never leaves the browser | The service threw before `fetch` | Check for an `undefined` base in the console |

### 3.3 Routing, menu and roles

| Symptom | Cause | Fix |
| --- | --- | --- |
| The menu entry is missing | No role in the menu source, or the fixture is not registered | The fixture must be appended to **both** offline arrays. For deployed users, configure the server-side menu. |
| The menu entry 404s | `capaianUrl` ≠ the route `path` | They must match exactly |
| A permitted user reaches `/forbidden` | The role is in the menu but not in `meta.roles`, or vice versa | Both, plus the backend's check |
| An unpermitted user sees the page | `authRequired: false`, or the role is missing from `meta.roles` | Set `authRequired: true` and the roles array |
| The menu shows but the API returns 403 | The role is not configured in the backend | Configure it there. The menu is not the boundary. |
| Every route denies in local development | No backend, so no menu, so no roles | `VUE_APP_SKIP_ROLE_CHECK=1` in a **local** `.env.development` only |
| A bookmarked URL 404s after a refresh in preview mode | History fallback is off | Enable it when `VUE_APP_REMOTE=off` |

### 3.4 API and data

| Symptom | Cause | Fix |
| --- | --- | --- |
| 401 | Missing, expired, or wrong-audience token | Check the adapter is installed before the first request. A remote that requests headers before `createHostAdapter()` throws rather than returning them. |
| 403 with a permitted user | The endpoint's role differs from the route's | Align all three: route, menu, API |
| `res.list` is undefined | The response is not in the `data` envelope | Use the `returnResponse*` helpers |
| No audit record after a save | The call bypassed the response helpers | Route the write through `returnResponsePost()` / `Put()` / `Delete()` |
| A field is `undefined` in the payload | The backend changed the shape | A contract change. `03-architecture/API-CONTRACT.md` and a version bump. |
| A duplicate record appears on retry | A retried `POST` | Never auto-retry a non-idempotent call |
| A large list is slow | Client-side sorting or filtering above the page size | Sort and paginate server-side |

### 3.5 UI

| Symptom | Cause | Fix |
| --- | --- | --- |
| Two sidebars | The module renders its own layout | A module renders inside the Shell's chrome. Remove the wrapper. |
| Styles differ from other pages | A forked component | Use `@2enapps/ui` |
| A translation key shows instead of text | The key is missing in that locale | Add it to all six |
| A date shows in the wrong format | Manual formatting | Locale-format it |
| The layout is mirrored oddly in `ar` | Physical CSS properties | Logical properties: `margin-inline-start` |
| A click does nothing | A `div` with a handler | A real `<button>` |
| The page jumps when data loads | No reserved space | A skeleton matching the content shape |
| An error vanishes before it is read | It is a toast | Errors persist until resolved |
| A spinner flashes for 100ms | No loading threshold | Show nothing under 200ms |

### 3.6 Build and dependency

| Symptom | Cause | Fix |
| --- | --- | --- |
| A component is missing after a UI update | The shared package version moved | Deliberately `npm update @2enapps/ui`, review the lockfile, commit it. See `07-delivery/SYNC.md`. |
| Two developers see different behaviour | The lockfile is not committed, or a branch dependency moved | Commit `package-lock.json`. A git branch is not immutable without it. |
| `npm ci` fails | The lockfile is out of sync with `package.json` | Regenerate deliberately, and review the diff before committing. |
| The build differs on two machines | A different Node version | Pin it. `^20.19.0 \|\| >=22.12.0` |
| A peer resolution problem after switching to `file:` | The symlink and npm peer auto-install traps | `03-architecture/ARCHITECTURE.md` §3.6 |
| Source maps appear in production | `productionSourceMap: true` | Set it to `false` |

---

## 4. Browser diagnostics

The three tools, and what each tells you that the others cannot.

| Tool | Use it for | It shows |
| --- | --- | --- |
| **Console** | The first place a silent failure appears | Errors, warnings, the federation error, a Vue warning, a swallowed exception |
| **Network** | Anything that leaves the browser | The full URL, the request headers, the payload, the status, the CORS verdict |
| **DOM inspector** | What actually rendered | Whether the real view is there, or the fallback, or an empty stub |

Order of attack: **Network first** for anything crossing a boundary, **Console
first** for anything failing locally.

### Questions worth asking of the network tab

- Is the URL complete? A missing base shows as `undefined/…`.
- Is the method what the contract says?
- Are the auth headers present?
- What is the status? `403` is authorization, not a bug in your view.
- Is this request one the backend should have, or one you added?

---

## 5. Method notes

### Bisect

```sh
git log --oneline -20
git bisect start
git bisect bad <known-bad-commit>
git bisect good <known-good-commit>
# → git bisect run npm run test:e2e
```

### Bisecting a federation defect

A federation bug is often in the repository you are not looking at. Check, in
this order:

1. Does `remoteEntry.js` return JavaScript? `curl` it.
2. Does the expose key match the Shell's import, character for character?
3. Is `VUE_APP_REMOTE=on` in the module, and has it been restarted?
4. Does `VUE_APP_SHELL_BASE` equal the Shell's origin exactly?
5. Do the shared singletons resolve to the Shell's instance?

### Isolating a module bug

If it renders in preview mode but not through the Shell, the module's own code is
probably fine and the problem is integration: federation, environment, CORS, or
routing. Work `03-architecture/INTEGRATION.md` §6 from the top.

---

## 6. The debug record

```markdown
### DEBUG-{{DEBUG_NUMBER}} — <symptom in one sentence> — {{REVIEW_DATE}}

**Environment:** repo, branch, commit, .env mode, Shell on/off, backend

**Steps**
1. 
2. 

**Expected:** 
**Actual:** 
**Reproducible:** always / sometimes / once

**Evidence**

Console:
```
<the actual message>
```

Network:
```
<request URL, status, and the relevant headers>
```

**Hypotheses tested**

| # | Hypothesis | Check | Result |
| --- | --- | --- | --- |
| H1 | | | disproved / confirmed |

**Cause:** 
**Fix:** 
**Verification:** the original reproduction no longer reproduces
**Prevention:** the test or document that stops it returning
```

An entry with no evidence section is a story, not a debug record.

---

## 7. Prevention

A fix that is not prevented from returning is a fix that will return.

| Cause | Prevention |
| --- | --- |
| A federation key mismatch | A test comparing the expose keys with the Shell's imports |
| A missing environment variable | A test asserting every `VUE_APP_*` read is in `.env.example` |
| A duplicated singleton | A `CHECK` step on the `shared` block and the aliases |
| A contract drift | A contract test pinning the response envelope |
| An unhandled error path | A component test for the error state |
| A role mismatch across three places | A test asserting the route role, the menu role and the API role agree |
| A missing locale key | A check that every key exists in all six locales |
| A 403 users report | Object-level authorization tests per tenant |

---

## 8. Escalation

| Situation | Do |
| --- | --- |
| Not reproducible after a serious attempt | Record everything, and say so. Do not ship a guess. |
| The cause is in another repository | A Change Request against that repository. Not a local workaround. |
| It is a security defect | `02-governance/SECURITY.md` §10, and a private report |
| It is live for users | `08-operations/INCIDENT.md` — the process, not the fix |
| The fix needs a contract change | `03-architecture/API-CONTRACT.md`, a version bump, and `07-delivery/SYNC.md` |
| The fix is a workaround | Both: the workaround now, and the real fix with a ticket |
