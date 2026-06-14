<script setup lang="ts">
import { ref } from "vue";
import type { WorldLocation } from "../role_core/types/worldLocation";
import WorldMapModal from "./WorldMapModal.vue";

const props = defineProps<{
  currentLocation?: WorldLocation | null;
  testDisabled?: boolean;
}>();

const emit = defineEmits<{
  testBattle: [];
}>();

const mapModalOpen = ref(false);

function openMapModal() {
  mapModalOpen.value = true;
}

function closeMapModal() {
  mapModalOpen.value = false;
}
</script>

<template>
  <section class="main-panel main-panel--side" aria-label="功能面板">
    <div class="main-panel__body">
      <div class="side-btn-group">
        <button type="button" class="main-screen__btn side-btn" @click="openMapModal">世界地图</button>
        <button type="button" class="main-screen__btn side-btn" @click="emit('testBattle')" :disabled="props.testDisabled">战斗测试</button>
      </div>
    </div>
    <WorldMapModal
      :open="mapModalOpen"
      :current-location="props.currentLocation"
      @close="closeMapModal"
    />
  </section>
</template>

<style scoped>
.side-btn {
  width: 100%;
  margin-bottom: 6px;
}

.side-btn:disabled {
  color: #888;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
