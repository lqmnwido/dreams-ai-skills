<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# DESIGN — {{MODULE_DISPLAY}}

UX and UI architecture for `{{MODULE_NAME}}`.

**This is not a colour palette.** It describes the structure of the experience:
what the user is doing, in what order, how the interface responds, how state is
shown, and what happens when something fails. Colour is a consequence of the
design system in `UI-STANDARD.md`, and it is defined there.

A design document that only describes appearance is incomplete. Users do not
experience colours; they experience flows and feedback.

---

## 1. Design principles

| # | Principle | What it means here |
| --- | --- | --- |
| 1 | The user is doing one thing | Each page has one primary task. A second task gets a second page. |
| 2 | State is always visible | Loading, empty, error, success are four designed states, not accidents. |
| 3 | Never lose the user's work | A failed save says what failed and what is still unsaved. |
| 4 | Explain the system | Errors say what happened and what to do next, in the user's language. |
| 5 | Consistency is a feature, not a preference | A new interaction pattern needs a reason strong enough to justify the inconsistency. |
| 6 | The interface adapts to the data | Long names, empty lists, a hundred thousand rows, and a slow network are the normal cases. |
| 7 | Accessibility is not a mode | Keyboard, screen reader and contrast work in the default experience. |
| 8 | Localised by construction | No string is written into a template. |

---

## 2. Information architecture

```
{{ROUTE_PREFIX}}/
├── {{ROUTE_PATH}}                the primary page — {{PRIMARY_TASK}}
│   ├── filter bar                search, status, date range
│   ├── result region             table, grid or cards
│   │   ├── loading               skeleton or spinner, first {{LOADING_SKELETON}} rows
│   │   ├── empty                 why it is empty + the one action that fixes it
│   │   ├── error                 what failed + retry
│   │   └── results               the data
│   └── row action                open {{SECONDARY_TASK}}
└── {{ROUTE_PATH_2}}              {{SECONDARY_TASK_NAME}}
    └── {{SECONDARY_STRUCTURE}}
```

### Page inventory

| Route | Purpose | Primary action | Empty state | Error state |
| --- | --- | --- | --- | --- |
| `{{ROUTE_PREFIX}}` | | | | |
| `{{ROUTE_PREFIX_2}}` | | | | |

Every page in this table has all four states designed. A page with a data state
and no empty state is half-built.

---

## 3. The primary flow — {{PRIMARY_TASK}}

The most common thing a user does here. Design it first; everything else is
secondary.

```
   Enter ──▶ filter applied ──▶ loading ──▶ results
                            │                    │
                            │                    ├──▶ row selected
                            ▼                    │      └──▶ detail / drawer
                       error (retry)             │
                                                 └──▶ export
```

| Step | User does | System does | Failure |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

### Timing and feedback

| State | Threshold | Feedback |
| --- | --- | --- |
| Fast | < 200ms | Nothing. A spinner that flashes is worse than none. |
| Noticeable | 200ms – 1s | Skeleton or inline progress |
| Slow | 1s – 5s | Progress with a cancellable action if possible |
| Very slow | > 5s | Progress **plus** an explicit message. Never a silent spinner. |
| Very slow, with progress | any | A real percentage when the endpoint can report one |

---

## 4. The four states

Every data-bearing region has these four. They are designed, not improvised.

### Loading

- A skeleton that matches the shape of the content, for the first
  {{LOADING_SKELETON}} rows.
- The layout does not shift when content arrives. Reserve the space.
- A refresh of existing data shows a subtle indicator, not a full-page skeleton —
  the user can already read what is there.

### Empty

The most neglected state. It must answer two questions:

1. **Why is it empty?** Never "No data".
2. **What can I do about it?** One primary action, if one exists.

| Situation | Message | Action |
| --- | --- | --- |
| Nothing exists yet | "No {{ENTITY}} yet." | "Create {{ENTITY}}" |
| Filters excluded everything | "No results match these filters." | "Clear filters" |
| Not permitted | "You do not have access to this." | — or "Request access" |
| A first-run state | "{{EXPLANATION}}" | The first step |

Distinguish them. "No data" for a permission problem tells a permitted user the
system is broken, and tells an unpermitted user to keep trying.

### Error

| Element | Content |
| --- | --- |
| What | A localised, specific statement: what failed |
| Why | The user-relevant reason, not the status code |
| What to do | Retry, or the specific next step |
| Evidence | A correlation id, so support can find it |
| Never | A stack trace, a raw API message, an `undefined` URL, a blank area |

A raw backend `message` may contain internal identifiers or another user's data.
Map known codes to a localised string; show a generic message otherwise.

### Success

- Confirm the outcome, briefly. A transient confirmation for a save.
- Show **what changed**, not just "Saved".
- Keep the user where they were. Do not navigate away on success unless leaving is
  the task.

---

## 5. Data display

| Concern | Rule |
| --- | --- |
| Density | {{DENSITY_RULE}} |
| Sorting | Server-side when the list is large; client-side only below the page size |
| Pagination | Server-side above {{PAGINATION_THRESHOLD}} rows |
| Column choice | Show what the task needs. A column nobody reads is noise, however cheap it is to add. |
| Empty cells | A placeholder, never blank — blank reads as a loading state |
| Long text | Truncate with an accessible full value on hover/focus, not a fixed `…` |
| Numbers | Locale-formatted. Never `toFixed` by hand. |
| Dates | Locale-formatted, with the timezone stated where it matters. |
| Identity | Show the human-readable name, and the id on request, not instead. |

### Tables

- Sortable headers are buttons with `aria-sort`, not clickable text.
- A selected row is indicated by more than colour.
- A row's actions are reachable by keyboard, in a predictable order.
- The header row is sticky when the page scrolls.

### Forms

| Rule | Detail |
| --- | --- |
| Label | Every control has one. A placeholder is not a label. |
| Validation | On blur, and on submit. Not on every keystroke. |
| Error text | Specific, next to the field, associated programmatically |
| Disabled | Explain why, in a tooltip or adjacent text |
| Required | Marked, and the reason given |
| Destructive | Confirm, naming what will be destroyed |
| Draft state | Long forms save a draft, or warn before navigating away |

### Long operations

Anything over {{LONG_OPERATION_THRESHOLD}} shows progress, disables the trigger,
and survives a page navigation where possible. A button that silently does nothing
for 40 seconds is indistinguishable from a broken button.

---

## 6. Error presentation

| Class | Where | Example |
| --- | --- | --- |
| Field | Beside the input | "This field is required" |
| Region | Above the affected region | "3 records could not be loaded" |
| Page | Full page | "We could not reach the service" |
| Toast | Transient, non-blocking | "Saved" |
| **Never** | A toast for an error | — |

**An error that a toast auto-dismisses is a bug report you will never receive.**
Errors persist until resolved or explicitly dismissed.

---

## 7. Responsive behaviour

| Breakpoint | Layout |
| --- | --- |
| Mobile | One column; filters in a sheet; tables become cards with a defined priority order |
| Tablet | Reduced columns; actions in a menu |
| Desktop | Full layout |

Each table defines its column priority order, so the mobile card view is a
deliberate subset rather than a horizontally scrolling table.

---

## 8. Internationalisation

- All six locales: `bm`, `en`, `ms`, `zh`, `ar`, `es`.
- Keys are namespaced: `{{MODULE_NAME}}.<area>.<element>`.
- **Right-to-left:** `ar` requires the layout to mirror — icons that imply
  direction, breadcrumbs, and the side of a drawer. A left-aligned card list in
  Arabic is a bug, not a preference.
- Numbers, dates, currency and plurals are locale-formatted.
- A key missing from a locale is a visible gap, not a silent fallback. `ms` and
  `zh` are the ones that get forgotten.

---

## 9. Accessibility as a design requirement

| Requirement | How it is met |
| --- | --- |
| Keyboard | Every action reachable, in a logical order, with a visible focus ring |
| Focus | Focus moves to a region when it appears; returns to the trigger when a dialog closes |
| Semantics | Landmarks, headings in order, real buttons and links |
| Labels | Every control labelled; errors announced |
| Contrast | Text ≥ 4.5:1, large text and UI ≥ 3:1 |
| Motion | Respects `prefers-reduced-motion` |
| Zoom | Usable at 200% without horizontal scrolling on desktop |

---

## 10. Design decisions

| # | Decision | Why | Revisit when |
| --- | --- | --- | --- |
| {{DESIGN_DECISION_1}} | | | |

A design decision that constrains future screens is an ADR. See
`03-architecture/ADR.md`.

---

## 11. Review checklist

- [ ] All four states designed for every data region
- [ ] Every page in the inventory has an empty and an error state
- [ ] No string is hardcoded in a template
- [ ] `ar` right-to-left layout is handled
- [ ] Keyboard path works end to end
- [ ] The layout does not shift when data loads
- [ ] No error is a toast
- [ ] No raw API message reaches a user
- [ ] A design decision that constrains future screens has an ADR
