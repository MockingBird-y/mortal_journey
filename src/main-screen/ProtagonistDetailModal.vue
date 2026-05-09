<script setup lang="ts">
/**
 * 主角详情弹窗：结构与 `mortal_journey/main.html` 中 `mj-item-detail-root` / `mj-trait-detail-root` 一致。
 */
import { onMounted, onUnmounted, ref, watch } from "vue";
import type { ProtagonistDetailAction, ProtagonistDetailPayload } from "./protagonistDetailPayload";

const props = defineProps<{
  open: boolean;
  payload: ProtagonistDetailPayload | null;
}>();

const emit = defineEmits<{
  close: [];
  action: [a: ProtagonistDetailAction];
}>();

function onActionClick(a: ProtagonistDetailAction) {
  emit("action", a);
}

function onBackdropClick() {
  emit("close");
}

function onCloseClick() {
  emit("close");
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === "Escape" && props.open) {
    ev.preventDefault();
    emit("close");
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  },
);

onMounted(() => {
  document.addEventListener("keydown", onKeydown, true);
});
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown, true);
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && payload"
      class="mj-trait-modal-root mj-protagonist-detail-root"
      role="presentation"
      aria-hidden="false"
    >
      <div
        class="mj-trait-modal-backdrop"
        tabindex="-1"
        aria-label="关闭"
        @click="onBackdropClick"
      />
      <div
        class="mj-trait-modal mj-item-detail-panel"
        role="dialog"
        aria-modal="true"
        :data-rarity="payload.dataRarity"
        @click.stop
      >
        <button type="button" class="mj-trait-modal-close" aria-label="关闭" @click="onCloseClick">
          ×
        </button>
        <h4 class="mj-trait-modal-title">{{ payload.title }}</h4>
        <div class="mj-trait-modal-rarity">{{ payload.subtitle }}</div>
        <div class="mj-trait-modal-body">
          <div v-for="(s, si) in payload.sections" :key="si" class="mj-trait-modal-section">
            <span class="mj-trait-modal-k">{{ s.label }}</span>
            <div class="mj-trait-modal-v">{{ s.text }}</div>
          </div>
        </div>
        <div v-if="payload.actions?.length" class="mj-item-detail-actions">
          <button
            v-for="(ab, ai) in payload.actions"
            :key="ai"
            type="button"
            class="mj-item-detail-action-btn"
            :class="{ 'mj-item-detail-action-btn--primary': ab.primary }"
            @click="onActionClick(ab.action)"
          >
            {{ ab.label }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
