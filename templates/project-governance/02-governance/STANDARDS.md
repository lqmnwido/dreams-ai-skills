<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# STANDARDS — {{MODULE_NAME}}

How code in this repository must look. Enforced by `06-quality/CHECK.md`.

`02-governance/GUARDRAILS.md` says what must never happen. This document says how
to do it correctly.

---

## 1. Language and runtime

| Item | Value |
| --- | --- |
| Language | JavaScript (ES modules), Vue 3 SFC |
| Framework | Vue 3.3+, Vue Router 4, Pinia 2, Vue I18n 9 |
| Build | Vue CLI 5 (`@vue/cli-service`), webpack 5 |
| Module Federation | webpack container plugin, remote name `{{MODULE_NAME}}` |
| Node | `^20.19.0 \|\| >=22.12.0` |
| Editor config | 2 spaces, no tabs, UTF-8, LF |
| Semicolons | yes |
| Quotes | double, except inside template literals |
| Trailing commas | multiline only |

Match the existing files. Consistency inside a repository beats correctness of any
one file's style.

---

## 2. File and directory layout

```
{{REPO_NAME}}/
├── .docs/project-governance/   this tree
├── public/
├── src/
│   ├── metadata.js            federation identity, frozen
│   ├── remote-entry.js        remote build entry (an empty module)
│   ├── preview/               standalone preview, VUE_APP_REMOTE=off
│   │   ├── main.js  App.vue  pinia.js  router.js
│   ├── services/{{MODULE_NAME}}/
│   │   ├── http.js            transport for this module's APIs
│   │   ├── <feature>.js       one service per feature area
│   │   └── helpers.js         pure functions only, no I/O
│   └── views/{{SUBMODULE}}/
│       └── <page>.vue
├── .env.example
├── vue.config.js
└── package.json
```

Rules:

- One view per file, named in kebab-case, matching the exposed path.
- One service per feature area. A service file that is a bag of unrelated
  endpoints is a file nobody can safely change.
- `helpers.js` holds pure functions. If it imports an HTTP client, it is not a
  helpers file.
- No barrel `index.js` re-exporting views. It hides which module a symbol comes
  from and defeats tree-shaking.

---

## 3. Naming

| Thing | Convention | Example |
| --- | --- | --- |
| View file | kebab-case | `senarai-program.vue` |
| Component in a view | PascalCase | `ProgramTable` |
| Service file | kebab-case, singular | `program.js` |
| Exported function | camelCase verb first | `fetchPrograms()` |
| Pinia store id | camelCase | `useProgramStore` |
| Event emitted | kebab-case | `@row-selected` |
| Prop | camelCase in JS, kebab-case in templates | `roleType` / `role-type` |
| Environment variable | `VUE_APP_` prefix, SCREAMING_SNAKE | `VUE_APP_URL_KOD` |
| CSS class | BEM-ish, prefixed by module | `v2t-program__row` |
| Custom event payload | object with named keys | `{ id, status }` |

The federation remote name `{{MODULE_NAME}}` is lowercase and hyphen-free. It is
a public contract; see `07-delivery/VERSIONING.md`.

---

## 4. Vue component rules

```vue
<script>
export default {
  name: "ProgramTable",
  props: {
    programs: { type: Array, required: true, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  emits: ["row-selected"],
  data() { return { page: 1 }; },
  computed: { visible() { return this.programs.slice(this.offset, this.offset + this.pageSize); } },
  methods: { onRowClick(row) { this.$emit("row-selected", { id: row.id }); } }
};
</script>
```

- `name` is always declared. It is what Vue Devtools, `keep-alive` and error
  stacks use; an anonymous component is untraceable.
- Every prop declares a type. `required: true` and `default` are never both set.
- `emits` is declared, not assumed.
- `data()` returns a factory-produced object, never a shared reference.
- No side effects at module scope that depend on a store. The shared package
  calls `useLayoutStore()` while its module is being evaluated, which is why
  Pinia must be a shared singleton; see `02-governance/GUARDRAILS.md` §2.

Prefer Composition API for new components in a `{{MODULE_KIND}}`; do not convert
existing Options API components just for consistency. Mixed styles in one file
are the actual problem.

---

## 5. State

- Server state lives in a service function, not a store. A store holds UI state:
  selection, filters, open panels, the current tab.
- A store is a `defineStore`/`useXStore` module, not a component-scoped object
  passed around as props through three levels.
- Do not copy a value from a store into `data`. Pick one owner. A copy is a
  second source of truth that diverges silently and is very hard to find.

---

## 6. API access

All calls go through this module's own service layer. A view never calls `fetch`
directly.

```js
// src/services/{{MODULE_NAME}}/program.js
import { kod } from "./http";

export async function fetchPrograms({ kategori, page } = {}) {
  const { data } = await kod.get("/program", { params: { kategori } });
  return data;
}
```

- The base URL comes from the module's **own** environment. V2T and the Shell
  compile separately, so a `VUE_APP_URL_*` value the module reads must be in the
  module's `.env`, not only in the Shell's.
- Credentials come from the host adapter, never from a module-local token store.
- Errors are surfaced to the user. A `catch` that only logs leaves the user
  staring at a spinner.

---

## 7. Comments

A comment explains **why**, not **what**. The code already says what.

```js
// Bad: increments the page number
page++;

// Good: the backend caps the page at 50; beyond that it silently returns page 1
if (page > MAX_PAGE) page = 1;
```

Comment the traps. A non-obvious webpack alias, a preserved legacy behaviour, an
off-by-one in a date boundary — those are worth a line. Do not narrate the
obvious, and do not leave commented-out code. Git remembers it.

---

## 8. Errors

- Never an empty `catch`. Either handle it, or rethrow with context.
- Never `console.log` left in a merged view. `console.warn` for a real degraded
  path, `console.error` for a failure, nothing otherwise.
- Error messages shown to a user are localised, in the module's translation
  namespace. No raw API error text, no stack, no `undefined` in a URL.

---

## 9. Internationalisation

- Every user-visible string is a translation key. No inline English or Malay text
  in a template.
- Keys are namespaced by module: `{{MODULE_NAME}}.programs.title`.
- All six locales present in the Shell (`bm`, `en`, `ms`, `zh`, `ar`, `es`) get
  the key. A missing key is a visible fallback for a user, not a warning.
- Dates, numbers and currency are formatted by locale, never string-concatenated.

---

## 10. Accessibility

- Every interactive element is reachable and operable by keyboard, with a visible
  focus ring.
- Every form control has a label. Placeholder text is not a label.
- Errors are associated with their input programmatically, not only shown in red.
- Colour is never the only signal carrying meaning.

---

## 11. Git

- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`, `build:`, `perf:`.
- One commit does one thing. A commit that fixes a bug and reformats a file is
  two commits.
- A commit that changes behaviour changes the document that describes it, in the
  same commit.
- Never commit `.env`. Commit `.env.example` with the new keys, values empty.

See `05-development/REPOSITORY-STANDARD.md` for branches and required files.

---

## 12. Anti-slop

These are the tells of unreviewed generated code. They are all failures in
`CHECK`:

| Pattern | Why it is rejected |
| --- | --- |
| A comment restating the line below it | Noise that hides real comments |
| `console.log` left in a view | Debug output shipped |
| An empty `catch {}` | The failure is now invisible |
| `TODO` with no owner and no ticket | It will not happen |
| Commented-out code | Git remembers it |
| A hardcoded `localhost` or IP in source | It breaks in every deployed environment |
| A function longer than ~50 lines doing three things | It has three responsibilities |
| Two copies of a helper, one per feature | Fix one, ship the other |
| A function named `handleClick` doing five things | The name is a lie |
| Prose in a code comment that reads as marketing | It says nothing a reviewer can check |

---

## 13. Review checklist

- [ ] No `console.log`, no empty `catch`, no `TODO` without a ticket
- [ ] Every prop typed, every `emits` declared, every component named
- [ ] No hardcoded URL, port, bucket, role or environment value
- [ ] Every user-visible string is a translation key, present in all locales
- [ ] No duplicated helper that already exists in the module or `@2enapps/ui`
- [ ] `package.json` unchanged, or the change is in `05-development/TOOLS.md`
- [ ] The document that describes this behaviour changed in the same commit
