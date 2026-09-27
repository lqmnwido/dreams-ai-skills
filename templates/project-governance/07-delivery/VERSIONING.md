<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# VERSIONING — {{MODULE_NAME}}

Version schemes for this repository, the shared package, the Shell, and the APIs —
and which changes are breaking.

Because every box in this architecture is a separate repository deployed
independently, a version number is a compatibility statement, not a formality.

---

## 1. This module

[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

| Part | Increments when | The consumer's obligation |
| --- | --- | --- |
| **MAJOR** | A public contract breaks | Action required before upgrading |
| **MINOR** | A capability is added, backwards compatible | None |
| **PATCH** | A defect is fixed | None |

Current: `{{MODULE_VERSION}}`

### What is a public contract

| Contract | Where | Breaking when |
| --- | --- | --- |
| An expose key | `vue.config.js` `exposes` | Renamed or removed |
| The remote name | `ModuleFederationPlugin.name` | Renamed |
| A route path | the Shell's `routes.js` | Changed |
| A role id | the Shell's `meta.roles`, the menu, the API | Changed |
| `routePrefix` in the metadata | `src/metadata.js` | Changed |
| A component's props or emitted events | `@2enapps/ui` consumption | Changed |
| A prop a Shell route passes | the Shell's route config | Changed |
| A documented API field | `03-architecture/API-CONTRACT.md` | Changed |

### What is not

- Anything inside a view that is not a public prop or event.
- A service function's internals.
- A file added inside `src/`.
- A translation key, unless a consumer depends on it.
- The build tooling, unless the output changes.

> **The test:** if a deployed Shell at version *N* would break when this module
> moves to *N+1* without any change on the Shell's side, it is a MAJOR.

---

## 2. `@2enapps/ui`

| Version | Meaning |
| --- | --- |
| `1.2.0` | A compatible addition: a new export, a new optional prop |
| `2.0.0` | A removed or renamed export, or a changed required prop |
| `1.1.1` | A fix that does not alter the API |

**The shared package versions independently of every consumer.** It is consumed as
a Git branch in development, and as a version range once published.

### The rule that prevents shared-component drift

> A consumer moves to a new major of `@2enapps/ui` **deliberately, one at a
> time, with a test run against each**. Never automatically, never as part of an
> unrelated change.

The failure this prevents: a shared component's markup changes in a major
release, several modules upgrade at once, and every page using it changes
appearance in the same deployment. Nobody can attribute the change, and rolling
back means rolling back each module separately.

Procedure: `07-delivery/SYNC.md` §3.

---

## 3. The APIs

The API version lives in the path or a header — never in a query parameter. A
version that can be forgotten is not a version.

```http
GET /dreams/api/kod/v1/program
```

| Change | Version impact |
| --- | --- |
| A new optional response field | Same major. The frontend must tolerate its absence. |
| A new endpoint | Same major |
| A new optional request parameter | Same major |
| A required new request parameter | **Major** |
| A renamed, removed or retyped field | **Major** |
| A new enum value | **Major** — a client with an exhaustive `switch` breaks |
| A change to an error code's meaning | **Major** |
| A stricter validation rule | **Major** |
| A new rate limit | Same major, announced |

The deprecation window is **at least one minor release of every consumer**. A
backend that removes a field the same week it stops sending it has not deprecated
it.

Full rules: `03-architecture/API-CONTRACT.md`.

---

## 4. The Shell

| Version | Meaning |
| --- | --- |
| `4.0.0` | A new Shell, possibly requiring new module versions — see the matrix in `SYNC.md` |
| `4.1.0` | A new module registered, or a new shared component. Existing modules keep working. |
| `4.1.1` | A fix |

**A Shell minor release must not break a deployed module.** If it does, the Shell
minor was a major. This is what makes it safe to deploy the Shell on a Tuesday
while three modules are in production at different versions.

---

## 5. Version sources of truth

| Number | Lives in | Not in |
| --- | --- | --- |
| `{{MODULE_NAME}}` version | `package.json` + `src/metadata.js`, updated together | A README badge |
| `@2enapps/ui` version | the shared package's `package.json` | A branch name |
| The Shell version | the Shell's `package.json` | |
| The API version | the backend's source of truth | The frontend's expectation |
| The resolved UI commit | `package-lock.json` | The `git+…#branch` string |

> **`package.json` and `src/metadata.js` must declare the same version.** They
> drift, and then the Shell reports a version that does not exist.

---

## 6. A version number is a promise

Before incrementing, answer these:

- [ ] Has any public contract changed? → MAJOR
- [ ] Is a capability added that nothing breaks without? → MINOR
- [ ] Is it a fix with no contract change? → PATCH
- [ ] Is this actually a MAJOR? → the compatibility matrix in `SYNC.md` needs a new row
- [ ] Do `package.json` and `src/metadata.js` agree?
- [ ] Is `07-delivery/RELEASE.md` updated?
- [ ] Is `07-delivery/SYNC.md` updated?
- [ ] Can a consumer upgrade without reading the diff? If not, the release notes are the problem.

---

## 7. Deprecation

| Stage | Duration | Action |
| --- | --- | --- |
| Announced | 1 release | Document it, mark it in the contract, tell the consumers |
| Soft-deprecated | 1 release | A warning in the response; the consumer still works |
| Removed | — | Only after every consumer has migrated |

A contract is removed when no consumer uses it, **verified** — not assumed. Check
the logs, or the consuming repositories, before removing anything.

Renaming a federated expose path is a two-repository operation: the module adds
the new expose and keeps the old for one release, then the Shell switches, then
the module removes the old one. The reverse order breaks the Shell.

---

## 8. Version history

| Version | Date | Type | What changed | Breaking | Released by |
| --- | --- | --- | --- | --- | --- |
| `{{MODULE_VERSION}}` | {{REVIEW_DATE}} | — | Initial release | No | {{OWNER}} |
