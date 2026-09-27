<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# SCOPE — {{MODULE_NAME}}

The ownership boundary of `{{REPO_NAME}}`.

This is the shortest and most-used document in the tree. Read it before any
change. If the work is not on the "owns" list, stop and open a Change Request
against whichever repository does own it.

---

## 1. Identity

| Field | Value |
| --- | --- |
| Module name (federation remote name) | `{{MODULE_NAME}}` |
| Display name | `{{MODULE_DISPLAY}}` |
| Kind | `{{MODULE_KIND}}` |
| Repository | `{{REPO_NAME}}` |
| Route prefix in the Shell | `{{ROUTE_PREFIX}}` |
| Role id granting access | `{{ROLE_KEY}}` |
| Local development port | `{{REMOTE_PORT}}` |
| Shell repository | `{{SHELL_REPO}}` |
| API bases read | {{API_BASES_LIST}} |

---

## 2. This repository owns

Everything here is this repository's responsibility to build, change, test and
document.

| # | Owns | Lives in | Notes |
| --- | --- | --- | --- |
| O1 | Exposed pages | `src/views/` | each key is a contract with a Shell route |
| O2 | Feature services | `src/services/{{MODULE_NAME}}/` | the module's own API calls |
| O3 | Local preview entry | `src/preview/` | router, Pinia, i18n, UI plugin, CSS |
| O4 | Federation metadata | `src/metadata.js` | stable identity, not a page |
| O5 | Module translations | `src/locales/{{MODULE_NAME}}/` | |
| O6 | Module documentation | `.docs/project-governance/**` | |
| O7 | {{SCOPE_OWNS_7}} | | |

---

## 3. This repository does NOT own

The most important table in this document. A change here that is not listed above
is a change in the wrong repository, no matter how convenient it would be.

| # | Does not own | Owner | Where to change it instead |
| --- | --- | --- | --- |
| N1 | Application bootstrap | Shell | `shell/src/main.js` |
| N2 | Keycloak / OIDC session | Shell | `shell/src/auth/keycloak.js` |
| N3 | Top-level routing and route guards | Shell | `shell/src/router/` |
| N4 | Menu tree and role derivation | Shell + backend | `shell/src/services/<module>/offline-menu.js`, server menu source |
| N5 | Shared presentation components, layouts, global styles | `@2enapps/ui` | the shared package |
| N6 | Shared Pinia stores used by the chrome | `@2enapps/ui` | the shared package |
| N7 | Credentials, tokens, client secrets | Shell | — never in a frontend repository |
| N8 | Authorization decisions | Backend API | every endpoint validates its own token and role |
| N9 | Data persistence, migrations | Backend API | |
| N10 | The `remoteEntry.js` host configuration | Shell | `shell/vue.config.js` |

### The two that get violated most

**N7 — credentials.** A remote receives credentials through the host adapter. A
remote that constructs its own auth client has created a second session model,
and the day the Shell changes its token handling the remote silently keeps the
old behaviour. Worse, a client secret in a frontend repository is a published
secret.

**N8 — authorization.** The Shell's role guard stops a user from *navigating* to
a module. It does not stop them from calling the API. An endpoint that trusts
the frontend guard has no access control at all, because the frontend is the
client's machine.

---

## 4. Boundaries with other repositories

| Repository | Relationship | Contract | Verified by |
| --- | --- | --- | --- |
| Shell | consumed by | `<remote>/<expose-path>` import strings, `shared` singletons | `03-architecture/INTEGRATION.md` |
| `@2enapps/ui` | consumed by | the version range in `package.json` | `07-delivery/SYNC.md` |
| {{SCOPE_API_1}} | called by | `03-architecture/API-CONTRACT.md` | `06-quality/TESTING.md` contract tests |

---

## 5. Change boundary

A change is **in scope** when it does all of:

1. Lives in a path listed under "owns".
2. Needs no change in a repository listed under "does NOT own".
3. Does not alter an exposed page path.
4. Does not change a shared singleton configuration.
5. Does not add a dependency outside `05-development/TOOLS.md`.

If (2), (3) or (4) fails, it is a **cross-repository change**: it needs an entry
in `07-delivery/SYNC.md` and a coordinated release. It is still usually small —
what makes it a governance event is that one repository can be deployed without
the other.

---

## 6. Definition of out of scope

{{SCOPE_NON_GOALS}}

---

## 7. Review

| Date | Reviewer | Outcome |
| --- | --- | --- |
| {{REVIEW_DATE}} | {{OWNER}} | Initial scope |
