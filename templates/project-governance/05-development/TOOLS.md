<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# TOOLS — {{MODULE_NAME}}

The approved engineering stack, and the procedure for changing it.

A dependency added without an entry here is an unreviewed change with a permanent
supply-chain surface.

---

## 1. Approved dependencies

Exactly these, at the declared range. Anything else is a Change Request against
this document first.

```json
{
  "name": "{{REPO_NAME}}",
  "version": "{{MODULE_VERSION}}",
  "private": true,
  "type": "module",
  "dependencies": {
    "@2enapps/ui": "{{UI_DEPENDENCY}}",
    "@huggingface/transformers": "^3.8.1",
    "exceljs": "^4.4.0",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.1",
    "pinia": "^2.3.1",
    "vue": "^3.3.4",
    "vue-i18n": "^9.5.0",
    "vue-router": "^4.6.4"
  },
  "devDependencies": {
    "@vue/cli-plugin-babel": "~5.0.8",
    "@vue/cli-service": "~5.0.8",
    "@vue/compiler-sfc": "^3.2.47",
    "webpack": "^5.0.0"
  }
}
```

### Why each is here

| Package | Why it is needed |
| --- | --- |
| `@2enapps/ui` | Shared presentation, layouts, stores, styles. **Not** a peer of any of the four below |
| `@huggingface/transformers` | In-browser inference, where the module needs it |
| `exceljs` | Excel export |
| `jspdf` + `jspdf-autotable` | PDF export, with tables |
| `pinia` | State. **Must** be the Shell's instance |
| `vue` | Framework. **Must** be the Shell's instance |
| `vue-i18n` | Translations. **Must** be the Shell's instance |
| `vue-router` | Routing. **Must** be the Shell's instance |
| `@vue/cli-*`, `webpack` | Build and federation |

### What is deliberately absent

| Not allowed here | Where it belongs | Why |
| --- | --- | --- |
| `keycloak-js` | Shell only | A second auth client; see `02-governance/GUARDRAILS.md` §1 |
| `axios` | Module transport is `fetch` | The shared chrome and this module must not have two HTTP layers |
| A UI framework | `@2enapps/ui` | A forked component diverges |
| A state library other than Pinia | — | A second store registry breaks the shared chrome |
| A test runner not in `TOOLS.md` | Add it here first | CI and every developer depend on it |
| A date library | `Intl` | The platform ships it |

---

## 2. The four singletons

`vue`, `vue-router`, `pinia`, `vue-i18n` are **owned by the Shell** and shared
through Module Federation. `@2enapps/ui` declares them as peers.

They appear in this repository's `dependencies` because a module must be able to
**build and run standalone** in preview mode. They are still single-instance at
runtime, because:

1. `shared: { singleton: true }` in `vue.config.js`.
2. `resolve.symlinks(false)` — a setter call, not an assignment.
3. Exact-match aliases (`pinia$`) redirecting to this repository's copy.

**Do not add a version of any of the four that could resolve differently from the
Shell's.** A `file:` link or a different range reintroduces the failure described
in `02-governance/GUARDRAILS.md` §2.

---

## 3. `@2enapps/ui` versions

| Mode | Value | Use when |
| --- | --- | --- |
| Git branch | `{{UI_DEPENDENCY}}` | Normal work |
| Local link | `file:../ui` | Only while developing the shared package and this module together |
| Published | a version range | Once published |

### The update procedure

```sh
# 1. Change the shared package, commit, push to the UI branch.
# 2. In this repository, deliberately refresh the locked version:
npm update @2enapps/ui

# 3. Review the package-lock.json change and commit it.
```

The lockfile records the resolved commit. Committing it is what makes every
developer and every deployment use the same shared-package build.

**Modules must not automatically upgrade major versions.** See
`07-delivery/SYNC.md` §3.

### A git dependency is not immutable until the lockfile says so

`"@2enapps/ui": "git+…#lqmnwido/ui"` names a **branch**, which moves. Without a
committed lockfile, two developers running `npm install` on the same day can get
two different builds, and CI can get a third. Commit `package-lock.json` with
every update. Never run `npm update` for the whole tree as a side effect of
unrelated work.

---

## 4. Node and npm

| Item | Value |
| --- | --- |
| Node | `^20.19.0 \|\| >=22.12.0` |
| Lockfile | `package-lock.json`, committed |
| Registry | the configured private registry plus the default one |
| `engines` | declared in `package.json` |

Use a version manager (`nvm`, `fnm`, `volta`) pinned per repository. A different
Node major changes the build output, and a diff caused by the toolchain is a diff
nobody wants to review.

---

## 5. Internal tooling

| Tool | Purpose | Install |
| --- | --- | --- |
| `npx -y @lqmnwido/dreams-ai-skills` | This governance tree | per repository, never globally |
| `npx -y @lqmnwido/dreams-ai-skills-check` | Verify the tree | per repository |
| Playwright | Blackbox and E2E browser testing | `npx -y playwright` |
| Browser devtools MCP | Console, network, DOM, traces | configured in the agent |

These are **not** global installs. A global tool applies to every repository on
the machine, including the ones whose architecture it knows nothing about.

---

## 6. Adding a dependency

1. **Confirm you need it.** Search the module, then `@2enapps/ui`. A 30-line
   helper beats a package with 200 transitive dependencies.
2. **Open a Change Request** against this document.
3. Assess: licences, transitive count, maintainer activity, known advisories,
   install scripts, bundle size.
4. Use an exact or caret range. Never `latest`. Never a git URL without a
   reviewed commit.
5. **Add it here** with a one-line reason, in the same commit.
6. Check the bundle size delta, and check the singleton rules in §2 still hold.
7. Update `07-delivery/SYNC.md` if it changes a contract.

**A `postinstall` script runs with the developer's permissions.** Review one
before approving a package that has it.

---

## 7. Prohibited

| Prohibited | Reason |
| --- | --- |
| Installing globally | Different repositories, different stacks |
| A `latest` tag | Not reproducible |
| A git URL without a committed lockfile | The branch moves |
| A package duplicating an existing one | Two implementations, one fix |
| Removing a lockfile entry to make an install work | Hides the conflict |
| A dependency added without updating this file | An unreviewed supply-chain decision |
| A second copy of a shared singleton | See §2 |

---

## 8. Change log

| Date | Package | From | To | Reason | Approved by |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
