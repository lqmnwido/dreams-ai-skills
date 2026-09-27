<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# UI STANDARD — {{MODULE_NAME}}

The presentation rules for `{{MODULE_NAME}}`.

Most of what a page looks like is already decided, in the shared package. This
document is about the decisions that are **not** already made, and about not
making them again locally.

---

## 1. The one rule

> **If a component or style exists in `@2enapps/ui`, use it. Do not copy it,
> do not fork it, do not re-implement it with different props.**

A forked component is a component that will diverge. It gets a bug fix in the
shared package and not in the copy, and now two things that look identical behave
differently on two pages. That is a defect the user reports as "this page is
broken" and nobody can reproduce, because the shared version works.

This is a `GUARDRAILS.md` violation, not a preference.

**Installed as:**

```json
"@2enapps/ui": "{{UI_DEPENDENCY}}"
```

---

## 2. What comes from the shared package

| Category | Examples |
| --- | --- |
| Navigation chrome | `AppNavBar`, `AppSideBar`, `AppSideNav`, `AppRightBar`, `AppFooter` |
| Layouts | `LayoutAuth`, `LayoutHorizontal`, `LayoutVertical` |
| Presentation | `AppLogo`, `PageHeader`, `Spinner`, dynamic-form components |
| Stores | `useSessionStore`, `useLayoutStore`, `useSupportUserStore`, … |
| Helpers | `useHostAdapter`, `errorSwal`, notification helpers |
| Styles | `@2enapps/ui/styles.css` |
| Assets | `@2enapps/ui/images/*`, `/fonts/*`, `/logo/*` |

**Global styles are imported from the package.** This repository does not keep a
duplicate stylesheet, and does not re-declare a variable the package already
defines. Check before adding a `:root` rule.

---

## 3. Installation modes

Choose one per repository. Never both.

| Mode | Dependency | Use when |
| --- | --- | --- |
| Git branch | `{{UI_DEPENDENCY}}` | Normal work. Portable; works in CI and on any machine. |
| Local link | `"@2enapps/ui": "file:../ui"` | Only while actively developing the shared package and this module together. |
| Published | a version range | Once the package is published. |

The local link creates a symlink, which is why `resolve.symlinks(false)` and the
peer aliases exist in `vue.config.js`. See
`03-architecture/ARCHITECTURE.md` §3.6. **Do not remove them**, whatever the
installation mode.

---

## 4. Using the package

```js
import { createApp } from "vue";
import pinia from "./pinia";
import i18n from "./i18n";
import UI from "@2enapps/ui";
import "@2enapps/ui/styles.css";

const app = createApp(App);
app.use(pinia);                                  // before UI, always
app.use(i18n);
app.use(UI, { hostAdapter: createHostAdapter() });
app.mount("#app");
```

The stylesheet must be imported once. The JavaScript package does not inject its
extracted CSS.

`@2enapps/ui` declares `vue`, `vue-router`, `pinia` and `vue-i18n` as **peer**
dependencies. This repository provides them and shares them as federation
singletons. That is not optional — see `02-governance/GUARDRAILS.md` §2.

---

## 5. Tokens

Do not hardcode a colour, a size or a font in this repository.

```css
/* No */ .header { color: #1a73e8; font-size: 18px; }
/* Yes */ .header { color: var(--color-primary); font-size: var(--font-size-lg); }
```

| Token group | Examples |
| --- | --- |
| Colour | `--color-primary`, `--color-danger`, `--color-text`, `--color-border` |
| Typography | `--font-size-sm/md/lg/xl`, `--font-weight-*` |
| Spacing | `--space-1` … `--space-8` |
| Radius | `--radius-sm/md/lg` |
| Elevation | `--shadow-1` … `--shadow-4` |
| Motion | `--duration-fast/base/slow` |

The authoritative list is in `@2enapps/ui/styles.css`. A token that does not exist
there is added to the shared package, in a Change Request — not invented here.

---

## 6. Layout

A module renders **inside** the Shell's layout. It does not bring a layout, a
sidebar, a navbar or a page wrapper of its own. The Shell owns the chrome; a
module that renders its own produces two sidebars.

```vue
<template>
  <section class="{{MODULE_NAME}}">
    <PageHeader :title="$t('{{MODULE_NAME}}.title')" />
    <!-- content only -->
  </section>
</template>
```

Rules:

- One `<section>` per view, with the module's class prefix.
- A view fills its container. It is not `position: fixed` and not `100vh` — the
  Shell owns scrolling.
- No `z-index` above the Shell's chrome without a reason in an ADR.
- A modal is a shared component, so it is a shared overlay and closes the same
  way everywhere.

---

## 7. Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Root element class | `{{MODULE_NAME}}` | `.{{MODULE_NAME}}` |
| Block | `{{MODULE_NAME}}-<block>__<element>--<modifier>` | `.{{MODULE_NAME}}-program__row--selected` |
| Scoped styles | `scoped` by default | |
| Global styles | Only for a token override, with a reason | |

Prefix every class with the module name. Two remotes render into the same
document; an unprefixed `.header` in both is a collision waiting for the day the
two pages appear on one screen.

---

## 8. Component style

- `scoped` by default. `<style>` without `scoped` is a `CHECK` failure unless it
  defines tokens.
- Props define the variants a component supports. A boolean prop that changes
  layout is two components wearing a prop.
- Slots for content, props for configuration.
- Emit domain events (`row-selected`), not DOM events (`click`).
- No business logic in a presentational component. A component that fetches is a
  view, and it belongs in `src/views/`.

---

## 9. Forms

Use the shared form components, or the shared validation approach. A bespoke form
is a bespoke validation story, a bespoke error style, and a bespoke accessibility
bug.

| Rule | Detail |
| --- | --- |
| Labels | Always visible. Not a placeholder. |
| Validation | On blur and on submit. |
| Errors | Beside the field, associated programmatically, localised. |
| Required | Marked, with a reason. |
| Numbers | Validate as numbers, send as the contract requires. Never a string. |
| Sensitive input | `autocomplete` set correctly; never logged; never persisted. |

---

## 10. Feedback

| Component | Use for | Never for |
| --- | --- | --- |
| Inline progress | A region loading | The whole page, for a refresh |
| Skeleton | First load of a known shape | A refresh of visible data |
| Toast | A brief, non-blocking confirmation | An error — errors persist |
| Banner | A persistent condition | A transient one |
| Dialog | A decision that needs an answer | A confirmation the user cannot act on |
| Empty state | No results, with a reason and an action | "No data" alone |

An error that auto-dismisses is a bug report you will never receive.

---

## 11. Right-to-left

`ar` is a supported locale, not an afterthought.

- Use logical properties — `margin-inline-start`, not `margin-left`.
  `left`/`right` do not mirror.
- Icons that imply direction mirror: back arrows, breadcrumb separators, next.
- Do not use a physical-direction icon to mean "next" without checking.
- Test `ar` at least once per new pattern.

---

## 12. Accessibility

- Every interactive element is a real `<button>` or `<a>`. A `div` with a click
  handler is not a control.
- Visible focus. Never `outline: none` without a replacement.
- Landmarks: one `<main>`, one `<h1>` per page, headings in order.
- Images have `alt`; decorative images have `alt=""`.
- Colour is never the only signal.
- Contrast: text ≥ 4.5:1, large text and UI ≥ 3:1.

---

## 13. Checklist

Run in `06-quality/CHECK.md` §2.

- [ ] No component copied or forked from `@2enapps/ui`
- [ ] No hardcoded colour, size, font or shadow — tokens only
- [ ] No global `<style>` without `scoped`, except token overrides
- [ ] No layout, sidebar, navbar or page wrapper in a view
- [ ] Every class is prefixed with `{{MODULE_NAME}}`
- [ ] Logical properties used for anything directional
- [ ] Every control is keyboard reachable with a visible focus ring
- [ ] No error is a toast
- [ ] No string hardcoded in a template
