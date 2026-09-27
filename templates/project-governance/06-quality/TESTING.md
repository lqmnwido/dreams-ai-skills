<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# TESTING — {{MODULE_NAME}}

The layered test plan. Both kinds of testing, always:

- **Whitebox** — testing from the inside. Unit, component, service. Fast, precise,
  and blind to everything the test does not set up.
- **Blackbox** — testing from the outside, through a real browser. Slow,
  expensive, and the only kind that finds integration, CORS, federation and
  layout defects.

Neither replaces the other. A green whitebox suite with no browser test has
never once proved a page renders.

---

## 1. The layers

```
  Unit          pure functions, service logic            fast   many
      ↓
  Component     a view, mounted, with its props           fast   many
      ↓
  API           a service against a stubbed or real API   medium some
      ↓
  Integration   this module against the real backend      slow  some
      ↓
  Contract      the response shape the frontend assumed   slow  some
      ↓
  E2E           the whole thing, through a browser        slow  few
      ↓
  UAT           a human, against the requirement          slow  few
```

Each layer finds what the one above it cannot:

| Layer | Finds | Misses |
| --- | --- | --- |
| Unit | Wrong logic in isolation | Anything about wiring |
| Component | Bad rendering, props, events | CORS, federation, routing |
| API | Wrong request shape | Whether the browser sends it |
| Integration | Auth, headers, real response parsing | Layout, routing, the Shell |
| Contract | A backend change nobody told the frontend about | Whether the user can use it |
| E2E | Everything the user touches | Logic branches nobody exercised |
| UAT | Whether it was the right thing | Almost nothing technical |

---

## 2. Coverage expectations

| Layer | What must be covered |
| --- | --- |
| Unit | Every pure function, every branch in a service, every validation rule |
| Component | Every view, all four states: loading, empty, error, ready |
| API | Every service function's request shape |
| Integration | Every endpoint the module calls |
| Contract | Every endpoint's response envelope |
| E2E | Every exposed page, plus the role-denied path |
| UAT | Every PRD success criterion |

**The failure path is mandatory.** A test suite where every test asserts a
success is a suite that will pass while the module is broken for the users who
matter.

---

## 3. Whitebox testing

### 3.1 Unit

Pure functions only. No HTTP, no store, no mount.

```js
// tests/unit/program.test.js
import { buildProgramQuery, isProgramComplete } from "@/services/{{MODULE_NAME}}/program";

describe("buildProgramQuery", () => {
  it("omits empty filters rather than sending them as empty strings", () => {
    // An empty filter reaching the backend is a request that returns
    // unfiltered results, which looks like "the filter is broken".
    expect(buildProgramQuery({ kategori: "", status: "aktif" }))
      .toEqual({ status: "aktif" });
  });

  it("encodes values rather than concatenating them", () => {
    expect(buildProgramQuery({ q: "a&b=c" })).toEqual({ q: "a&b=c" });
  });
});
```

### 3.2 Component

Mount with explicit props. Assert on what the user can observe.

```js
import { mount } from "@vue/test-utils";
import ProgramTable from "@/views/{{SUBMODULE}}/ProgramTable.vue";

describe("ProgramTable", () => {
  it("shows a skeleton on the first load, not a spinner flash", () => { /* … */ });
  it("distinguishes 'no results' from 'no permission'", () => { /* … */ });
  it("keeps the error visible — it is not a toast", () => { /* … */ });
  it("emits row-selected with an object, not the raw row", () => { /* … */ });
  it("is reachable by keyboard", async () => {
    // Tab reaches the first row action; Enter fires it.
  });
});
```

Cover: **all four states, the empty-state variants, the keyboard path, and the
error path.** Those are the four things a component test exists to find.

### 3.3 Service

Assert the request that leaves, not the response that comes back.

```js
it("sends the contract's authId and public prefix", async () => {
  await fetchPrograms({ kategori: "latihan" });
  expect(kod.get).toHaveBeenCalledWith(
    "/public/program",
    expect.objectContaining({ params: { kategori: "latihan" } })
  );
});
```

---

## 4. Blackbox testing — the browser

**Every change is exercised in a real browser before it is called done.** This is
criterion D5 in `02-governance/QUALITY.md`, and it exists because every one of the
defects below was once "verified" by reading code and was not true.

### 4.1 What only a browser finds

| Defect | Why reading the code does not reveal it |
| --- | --- |
| `Module does not exist in container` | A federation string mismatch on the other side of a network call |
| A blank route | A downed container resolving to an empty stub module |
| `undefined/kategori-program` | An environment variable missing from the module's own `.env` |
| A CORS error | An origin that does not match, port included |
| A second Pinia | `getActivePinia() was called but there was no active Pinia` at runtime |
| An unstyled page | A missing `import "@2enapps/ui/styles.css"` |
| A layout shift | Real font metrics against a skeleton |
| A missing locale key | A visible key where a label should be |

### 4.2 The three modes to test

| Mode | `VUE_APP_REMOTE` | What it proves |
| --- | --- | --- |
| Preview | `off` | The view renders with no Shell at all |
| Remote, module route | `on` | The container serves its exposes |
| Remote, through the Shell | `on` | The whole integration works |

The third is the only one that proves the module works. The first two are
debugging aids.

### 4.3 Playwright

Two distinct jobs, both required.

**E2E** — a scripted user journey.

```js
// tests/e2e/program.spec.js
import { test, expect } from "@playwright/test";

test("a permitted user reaches the program list", async ({ page }) => {
  await page.goto(`${SHELL_BASE}${ROUTE_PREFIX}`);

  // The real remote view rendered — not the Shell's fallback.
  await expect(page.locator("[data-testid='{{MODULE_NAME}}-program']")).toBeVisible();
  await expect(page.locator("text=Modul Tidak Tersedia")).toHaveCount(0);
});

test("an unpermitted user is denied", async ({ page }) => {
  await page.goto(`${SHELL_BASE}${ROUTE_PREFIX}`);
  await expect(page).toHaveURL(/forbidden/);
});

test("a downed remote shows the fallback, not a blank page", async ({ page }) => {
  await page.route("**/remoteEntry.js", (r) => r.abort());
  await page.goto(`${SHELL_BASE}${ROUTE_PREFIX}`);
  await expect(page.getByRole("alert")).toBeVisible();
});

test("a failed load shows a persistent, retryable error", async ({ page }) => {
  await page.route("**/program*", (r) => r.fulfill({ status: 500, body: "{}" }));
  await page.goto(`${SHELL_BASE}${ROUTE_PREFIX}`);
  await expect(page.getByTestId("error-panel")).toBeVisible();
});
```

**Interactive verification** — the parts a script cannot assert, done through the
browser devtools MCP: the console, the network tab, the DOM.

| Check | How |
| --- | --- |
| Console is clean | Devtools console: no error, no warning |
| No CORS error | Network tab: no blocked request |
| No `undefined` in a URL | Network tab: every request URL is complete |
| The request is well-formed | Network tab: headers, payload, status |
| The DOM is what was designed | Inspect the rendered structure |
| Right-to-left works | Switch to `ar` and look at the layout |
| Responsive | Resize to 375px, 768px, 1440px |

### 4.4 UAT

A human, against the requirement, not the implementation.

| Criterion (from `01-product/PRD.md` §6) | Passes when | Tester | Date |
| --- | --- | --- | --- |
| S1 | | | |
| S2 | | | |

UAT is not a demonstration. If the tester was not given the acceptance criteria
in advance, they will approve whatever looks finished, and the requirement will
be discovered missing in production.

---

## 5. Test data

| Rule | Why |
| --- | --- |
| No real personal data, ever | `02-governance/SECURITY.md` |
| Fixtures are explicit, not copied from a response at 3am | Anonymised data still needs anonymising |
| Long names, empty lists, a very large result set | The normal cases, not the corner ones |
| Malformed input | A real backend sends it |
| A second tenant's record | Object-level authorization |

---

## 6. Running

```sh
# Layered
npm run test:unit
npm run test:component
npm run test:api
npm run test:contract

# Blackbox — the module must be in remote mode and the Shell must be running
npm run test:e2e

# Governance
npx -y @lqmnwido/dreams-ai-skills-check
```

A suite that passes only when the Shell is not running is not testing the
integration. A suite that needs a backend seeded by hand is not reproducible, and
will not be run before the next release.

---

## 7. The test record

```markdown
### TEST-{{TEST_NUMBER}} — {{REVIEW_DATE}}

Scope: {{TEST_SCOPE}}
By: {{OWNER}}

| Layer | Command | Result | Notes |
| --- | --- | --- | --- |
| Unit | | pass / fail | |
| Component | | | |
| API | | | |
| Integration | | | |
| Contract | | | |
| E2E | | | |
| UAT | | | |

**Browser verification**

| Check | Observed |
| --- | --- |
| Console clean | |
| No CORS error | |
| No `undefined` in a URL | |
| Remote view rendered, not the fallback | |
| Role-denied path | |
| `ar` layout | |
| Responsive | |

**Not covered**

- 
```

**Not covered** is a required section. A test record that covers everything is
either a very small change or an inaccurate record.

---

## 8. Checklist

- [ ] Every pure function has unit tests, including its failure branches
- [ ] Every view is mounted with all four states covered
- [ ] Every service function's request shape is asserted
- [ ] The contract test pins the response envelope
- [ ] The expose key and the Shell import are compared
- [ ] E2E covers a permitted user, a denied user, and a downed remote
- [ ] A real browser was opened and the change was exercised
- [ ] The console and network tab were inspected
- [ ] Failure paths are tested, not just success paths
- [ ] No real personal data in any fixture
- [ ] "Not covered" is filled in honestly
