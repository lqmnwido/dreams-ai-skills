<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# SYNC — Dependency Synchronization

**The document this architecture most needs.**

Shell, frontend module, shared package and backend API are separate
repositories, built and deployed independently. At any moment they can be at
**four different versions**. Nothing enforces that those versions are compatible
except this file and the people who read it.

Without it, a shared-component change reaches the Shell and one module, and the
other two render differently — with no error anywhere.

---

## 1. Compatibility matrix

The known-good combinations. **A combination is only "known good" once it has
been tested together and released together.**

| Shell | `{{MODULE_NAME}}` | `@2enapps/ui` | API | UI pkg commit | Status |
| --- | --- | --- | --- | --- | --- |
| 4.x | {{MODULE_VERSION}} | 1.x | v1 | `lqmnwido/ui` @ `<commit>` | ✅ production |
| 4.x | {{MODULE_VERSION}} | 1.x | v1 | `lqmnwido/ui` @ `<commit>` | ✅ staging |
| 5.x | — | 2.x | v1 | | 🧪 in development |
| | | | | | |

| Status | Meaning |
| --- | --- |
| ✅ | Tested together, released, in production |
| 🧪 | In development, not yet combined |
| ⚠️ | Known incompatible — do not deploy |
| ❓ | Unknown — assume incompatible until tested |

> **An untested combination is not a "probably fine".** It is `❓`, and a
> release that introduces one must say so.

---

## 2. What can be independent

| Change | Independent? | Why |
| --- | --- | --- |
| A view's internal refactor | ✅ | Nothing outside the module sees it |
| A new exposed page | ✅ with an order | Deploy the module first; the Shell route comes later |
| A new translation key | ✅ | Additive |
| A new optional API field | ✅ | The frontend must tolerate its absence |
| A `@2enapps/ui` **minor** | ⚠️ | Additive, but it still needs a test run |
| A `@2enapps/ui` **major** | ❌ | Every consumer must be checked, deliberately |
| A new shared component | ✅ | Nobody uses it until they do |
| A change to an existing shared component | ❌ | Every consumer renders it |
| An API contract change | ❌ | The backend and the frontend must move together |
| A Shell change to a shared singleton | ❌ | Every module is affected |
| An environment variable | ⚠️ | Missing in one environment, broken in another |

---

## 3. Updating a shared package

```
  @2enapps/ui 1.4.0 released
        ↓
  A dependency PR is raised in every consuming repository
        ↓
  CI: build, unit, component, E2E against the current Shell
        ↓
  Review the diff. Look at rendered pages that use the changed component.
        ↓
  Merge one repository at a time
        ↓
  Deploy in the order in DEPLOYMENT.md §6
        ↓
  Record the combination in §1
```

### The rules

1. **Major versions are never upgraded automatically.** Not by a bot, not by
   `npm update` on a whole tree, not as part of an unrelated change.
2. **One repository at a time.** A simultaneous upgrade across every consumer
   makes a visual regression impossible to attribute.
3. **The lockfile is committed with every update.** A branch dependency is not
   immutable without it.
4. **The E2E suite must pass against the current Shell.** A shared change that
   only passes in isolation has not been tested in the environment it ships to.

```sh
# Deliberate, reviewed, one repository at a time
npm update @2enapps/ui
git diff package-lock.json        # read it
npm run build && npm run test:e2e # against the running Shell
```

### Rolling back a shared change

A broken major is recovered by pinning consumers back, not by reverting the shared
package alone — a published version is immutable to its consumers.

```sh
# In every affected consumer
npm install @2enapps/ui@<previous-version>
git commit package-lock.json
```

Each consumer rolls back independently, and each is a release.

---

## 4. Cross-repository change checklist

Any change touching more than one repository:

- [ ] Every affected repository is listed in §1 with its current version
- [ ] The deployment order is written down (`07-delivery/DEPLOYMENT.md` §6)
- [ ] The rollback order is the reverse, and is known
- [ ] Every affected owner is notified
- [ ] The combined version is tested, not assumed
- [ ] `07-delivery/RELEASE.md` records the sequence, not just the end state
- [ ] A CR is filed in each affected repository

---

## 5. The shared UI drift problem

The specific failure this document exists to prevent.

**Symptom:** three modules at the same `@2enapps/ui` branch, and the same button
looks different on three pages.

**Cause:** the branch moved, and the three consumers resolved to three different
commits.

**Prevention:**

| Control | How |
| --- | --- |
| Pin the commit | `package-lock.json`, committed, reviewed in the diff |
| Pin the version | A published range, not a branch, in production |
| One at a time | Never upgrade every consumer in one change |
| Test the combination | E2E against the current Shell, not in isolation |
| Record it | §1, so the next person knows what was tested |

**Detection:** if two pages in the same product render the same shared component
differently, stop and compare their lockfiles before investigating anything else.

---

## 6. Routine maintenance

| Cadence | Task |
| --- | --- |
| Every release | Update §1 with the released combination |
| Every shared release | Raise the dependency PR in every consumer |
| Monthly | Check for advisories in every dependency |
| Quarterly | Review the matrix; mark anything stale `❓` |
| Quarterly | Remove `❓` rows by testing them |

---

## 7. Status

| Item | Owner | Last checked | Outcome |
| --- | --- | --- | --- |
| {{SYNC_ITEM_1}} | {{OWNER}} | {{REVIEW_DATE}} | |
| | | | |
