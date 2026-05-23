<script setup lang="ts">
import { ref } from "vue";
import NpcListModal from "./NpcListModal.vue";

const npcModalOpen = ref(false);

function openNpcModal() {
  npcModalOpen.value = true;
}

function closeNpcModal() {
  npcModalOpen.value = false;
}
</script>

<template>
  <section class="main-panel main-panel--side" aria-label="功能面板">
    <div class="main-panel__body">
      <div class="side-btn-group">
        <button type="button" class="main-screen__btn side-btn" @click="openNpcModal">周围人物</button>
      </div>
    </div>
    <NpcListModal :open="npcModalOpen" @close="closeNpcModal" />
  </section>
</template>

<style scoped>
.side-btn {
  width: 100%;
  margin-bottom: 6px;
}
</style>
