<template>
  <main class="preview">
    <RouterView />
  </main>
</template>

<script setup>
import { RouterView } from "vue-router";
</script>

<style scoped>
.preview {
  min-height: 100vh;
  padding: 24px;
}
</style>
