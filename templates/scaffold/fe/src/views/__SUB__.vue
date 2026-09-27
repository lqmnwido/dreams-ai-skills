<template>
  <section class="page">
    <h1 class="page__title">{{ heading }}</h1>
    <p class="page__module">{{ moduleName }}</p>
  </section>
</template>

<script setup>
/**
 * The scaffolded page for one exposed route.
 *
 * It is deliberately a shell: a heading and nothing else, so the first commit
 * that adds real behaviour is visibly the first one. Do not add a loading
 * state, an empty state or a store here until there is something to load — see
 * `02-governance/ANTI-SLOP.md`.
 */
const heading = "{{SUBMODULE_HEADING}}";
const moduleName = "{{MODULE_DISPLAY}}";
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
}

.page__title {
  margin: 0;
  font-size: 1.5rem;
}

.page__module {
  margin: 0;
  color: #6b7280;
}
</style>
