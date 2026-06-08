<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import type { ProtagonistDetailAction, ProtagonistDetailPayload } from "./protagonistDetailPayload";
import { useScrollLock } from "../composables/useScrollLock";

const props = defineProps<{
  open: boolean;
  payload: ProtagonistDetailPayload | null;
}>();

const emit = defineEmits<{
  close: [];
  action: [a: ProtagonistDetailAction];
}>();

const scrollLock = useScrollLock();

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
    if (v) scrollLock.acquire();
    else scrollLock.release();
  },
);

onMounted(() => {
  document.addEventListener("keydown", onKeydown, true);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown, true);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="mj-backdrop">
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
        <Transition name="mj-modal" appear>
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
        <div
          class="mj-trait-modal-body"
          :class="{ 'mj-trait-modal-body--grid': payload.gridSections }"
        >
          <div v-for="(s, si) in payload.sections" :key="si" class="mj-trait-modal-section">
            <span class="mj-trait-modal-k">{{ s.label }}</span>
              <div class="mj-trait-modal-v">
              <template v-if="s.masteryLayer != null">
                <div class="mj-mastery-row">
                  <span class="mj-mastery-layer">{{ s.masteryLayer }}</span>
                  <span class="mj-mastery-exp">{{ s.masteryProgress }}</span>
                </div>
              </template>
              <template v-else>{{ s.text }}</template>
              <div v-if="s.progress && !s.progress.isMax" class="mj-mastery-progress">
                <div class="mj-mastery-progress-bar">
                  <div class="mj-mastery-progress-fill" :style="{ width: s.progress.percent + '%' }" />
                </div>
                <span class="mj-mastery-progress-pct">{{ s.progress.percent }}%</span>
              </div>
            </div>
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
      </Transition>
    </div>
    </Transition>
  </Teleport>
</template>
