<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# TEMPLATE — {{MODULE_NAME}}

Reusable patterns. Copy the whole block, fill the marked parts, delete the rest.

**Check this file before writing a new one.** Most "new" components in a codebase
are a pattern that already exists, and retyping it is how two things that look
identical start behaving differently.

Each template states what it replaces and when **not** to use it.

---

## 1. Exposed view

**Use for:** a page the Shell routes to.
**Do not use for:** a child view that needs parent props or events — keep it
inside its parent.

```vue
<!-- src/views/{{SUBMODULE}}.vue -->
<script>
import PageHeader from "@2enapps/ui/dist/PageHeader.vue";   // or the shared export
import { useI18n } from "vue-i18n";
import ProgramFilters from "./components/ProgramFilters.vue";
import ProgramTable from "./components/ProgramTable.vue";
import { fetchPrograms } from "@/services/{{MODULE_NAME}}/program";

export default {
  name: "{{MODULE_PASCAL}}ProgramList",
  components: { PageHeader, ProgramFilters, ProgramTable },
  props: { roleType: { type: String, default: "" } },
  data() {
    return { programs: [], loading: false, error: null };
  },
  computed: {
    emptyMessage() {
      return this.error
        ? this.$t("{{MODULE_NAME}}.program.loadError")
        : this.$t("{{MODULE_NAME}}.program.empty");
    }
  },
  async mounted() {
    await this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      this.error = null;
      try {
        // Credentials come from the host adapter inside the service transport.
        this.programs = await fetchPrograms({ roleType: this.roleType });
      } catch (err) {
        this.error = err;
        // Never show a raw backend message to a user.
        console.error("[{{MODULE_NAME}}] failed to load programs", err.status);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<template>
  <section class="{{MODULE_NAME}}">
    <PageHeader :title="$t('{{MODULE_NAME}}.program.title')" />
    <ProgramFilters @apply="load" />
    <ProgramTable
      :rows="programs"
      :loading="loading"
      :error="error"
      :empty-message="emptyMessage"
      @retry="load"
    />
  </section>
</template>

<style scoped>
.{{MODULE_NAME}} { /* layout only; tokens from @2enapps/ui/styles.css */ }
</style>
```

Register it as an expose in `vue.config.js` **and** add a route in the Shell.
Both, or neither works.

---

## 2. Service function

**Use for:** every call to an API this module owns.
**Do not use for:** a call owned by the Shell. That is the host adapter's job.

```js
// src/services/{{MODULE_NAME}}/program.js
import { kod } from "./http";
import { returnResponseList, returnResponsePost } from "./http";

export async function fetchPrograms({ kategori, page = 1, pageSize = 20 } = {}) {
  const res = await kod.get("/program", { params: { kategori, page, pageSize } });
  return returnResponseList("/program", res);
}

export async function createProgram(payload) {
  const res = await kod.post("/program", payload);
  // Goes through the helper so the audit record is written and upload URLs are
  // cleaned up. A bare client.post() skips the audit trail: a compliance defect.
  return returnResponsePost("/program", res, payload, "PROGRAM");
}
```

Rules:

- Credentials are handled inside `./http`. Never touch a token here.
- Every write goes through a `returnResponse*` helper.
- The base comes from this module's own environment.
- Errors propagate. Handle them in the view, in the user's language.

---

## 3. List state: the four states

**Use for:** any region showing a collection. Copy it rather than
reinventing the four states.

```js
data() {
  return { rows: [], loading: false, error: null, loadedOnce: false };
},
computed: {
  state() {
    if (this.loading && !this.loadedOnce) return "loading";
    if (this.error) return "error";
    if (!this.rows.length) return "empty";
    return "ready";
  },
  emptyMessage() {
    return {
      noFilters: this.$t("{{MODULE_NAME}}.list.empty"),
      noAccess: this.$t("{{MODULE_NAME}}.list.noAccess"),
      notCreated: this.$t("{{MODULE_NAME}}.list.notCreated")
    };
  }
}
```

```vue
<template>
  <div class="{{MODULE_NAME}}-list">
    <!-- 1. first load -->
    <ListSkeleton v-if="state === 'loading'" :rows="5" />
    <!-- 2. error persists; never a toast -->
    <ErrorPanel v-else-if="state === 'error'" :message="$t('{{MODULE_NAME}}.list.loadError')" @retry="load" />
    <!-- 3. empty states distinguish *why* -->
    <EmptyState v-else-if="state === 'empty'" :message="emptyMessage.noFilters">
      <template #action><button @click="clearFilters">{{ $t("common.clearFilters") }}</button></template>
    </EmptyState>
    <!-- 4. data -->
    <table v-else>…</table>
  </div>
</template>
```

---

## 4. Form with validation

```vue
<script>
export default {
  name: "{{MODULE_PASCAL}}ProgramForm",
  props: {
    initial: { type: Object, default: () => ({}) },
    saving: { type: Boolean, default: false }
  },
  emits: ["submit", "cancel"],
  data() {
    return { form: { nama: "", tarikh: "", kategori: "" }, errors: {} };
  },
  computed: {
    valid() { return Object.keys(this.errors).length === 0; }
  },
  methods: {
    validate() {
      const errors = {};
      if (!this.form.nama.trim()) errors.nama = this.$t("{{MODULE_NAME}}.form.nameRequired");
      if (this.form.tarikh && Number.isNaN(Date.parse(this.form.tarikh))) {
        errors.tarikh = this.$t("{{MODULE_NAME}}.form.dateInvalid");
      }
      this.errors = errors;
      return this.valid;
    },
    onSubmit() {
      if (!this.validate()) return;
      this.$emit("submit", { ...this.form });
    }
  }
};
</script>
```

Rules: a real `<label>` per control, errors associated with the input, validate on
blur and submit (not every keystroke), and a disabled submit while `saving` with
a reason.

---

## 5. Pinia store — UI state only

**Use for:** selection, filters, the open panel, the current tab.
**Do not use for:** server data. That is a service function.

```js
// src/state/{{MODULE_NAME}}.js
import { defineStore } from "pinia";

export const use{{MODULE_PASCAL}}Store = defineStore("{{MODULE_NAME}}", {
  state: () => ({
    filters: { kategori: "", status: "" },
    selectedId: null,
    openPanel: null
  }),
  getters: {
    hasFilters: (state) => Object.values(state.filters).some(Boolean)
  },
  actions: {
    setFilter(key, value) { this.filters[key] = value; },
    clearFilters() { this.filters = { kategori: "", status: "" }; },
    select(id) { this.selectedId = id; }
  }
});
```

Pinia must be the Shell's instance. If `useStore()` throws
`getActivePinia() was called but there was no active Pinia`, the singleton
configuration has been broken — see `02-governance/GUARDRAILS.md` §2. Do not
"fix" it by creating a Pinia inside the module.

---

## 6. Accessible modal

Use the shared component. This is the shape to match if a genuinely bespoke one
is unavoidable.

```vue
<template>
  <Dialog :open="open" :title="$t('{{MODULE_NAME}}.confirm.title')" @close="$emit('close')">
    <p>{{ $t("{{MODULE_NAME}}.confirm.body", { name }) }}</p>
    <template #footer>
      <button @click="$emit('close')">{{ $t("common.cancel") }}</button>
      <button class="danger" :disabled="busy" @click="$emit('confirm')">
        {{ $t("common.delete") }}
      </button>
    </template>
  </Dialog>
</template>
```

Requirements: focus moves into the dialog on open, is trapped while open, and
returns to the trigger on close. `Escape` closes. A destructive confirmation
names what will be destroyed.

---

## 7. Exported config block

**Use for:** anything a page needs to be configured by the Shell or the menu.

```js
// src/metadata.js
export const {{MODULE_PASCAL}}_METADATA = Object.freeze({
  remoteName: "{{MODULE_NAME}}",
  displayName: "{{MODULE_DISPLAY}}",
  version: "{{MODULE_VERSION}}",
  apiVersion: {{API_VERSION}},
  routePrefix: "{{ROUTE_PREFIX}}",
  defaultExpose: "views/{{SUBMODULE}}"
});
```

`Object.freeze` because it is consumed as data. Keep the shape: the Shell may read
these fields, and adding one is an additive change while renaming one is a
breaking change.

---

## 8. Adding a pattern

Before adding one here:

- [ ] It is not already in `@2enapps/ui`
- [ ] It is not already in this file
- [ ] It appears at least twice in the module, so it is a pattern and not an
      incident
- [ ] It states what it replaces and when not to use it
- [ ] It passed review as real code first

Add it with a real example from the module, not a hypothetical one. A template
with no instance behind it is a wish.
