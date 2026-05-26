<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { CUSTOM_REALM_MAJORS, CUSTOM_REALM_MINORS } from "./types";
import type { CustomBirthPayload } from "./types";

const props = defineProps<{
  open: boolean;
  initialLocation?: string;
  initialRealmMajor?: string;
  initialRealmMinor?: string;
  initialBackground?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [payload: CustomBirthPayload];
}>();

const customLoc = ref("");
const customRealmMajor = ref<string>(CUSTOM_REALM_MAJORS[0]!);
const customRealmMinor = ref<string>(CUSTOM_REALM_MINORS[0]!);
const customBg = ref("");

const customBirthFormValid = computed(
  () =>
    String(customLoc.value || "").trim() !== "" && String(customBg.value || "").trim() !== "",
);

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    customLoc.value = props.initialLocation ?? "";
    customRealmMajor.value = props.initialRealmMajor ?? CUSTOM_REALM_MAJORS[0]!;
    customRealmMinor.value = props.initialRealmMinor ?? CUSTOM_REALM_MINORS[0]!;
    customBg.value = props.initialBackground ?? "";
  },
);

function confirm(): void {
  if (!customBirthFormValid.value) return;
  const loc = String(customLoc.value || "").trim();
  const maj = String(customRealmMajor.value || "").trim();
  const bg = String(customBg.value || "").trim();
  const mino = String(customRealmMinor.value || "").trim();
  const realmTxt = maj + mino;
  emit("confirm", {
    tag: loc,
    name: loc,
    location: loc,
    realmMajor: maj,
    realmMinor: mino,
    realmText: realmTxt,
    background: bg,
  });
}
</script>

<template>
  <div
    v-show="open"
    class="mj-trait-modal-root"
    :aria-hidden="open ? 'false' : 'true'"
  >
    <div class="mj-trait-modal-backdrop" @click="emit('close')"></div>
    <div class="mj-trait-modal mj-custom-birth-dialog" role="dialog" aria-modal="true">
      <button type="button" class="mj-trait-modal-close" aria-label="关闭" @click="emit('close')">
        ×
      </button>
      <h3 class="mj-trait-modal-title">自定义出身</h3>
      <div class="mj-trait-modal-body mj-custom-birth-body">
        <label class="mj-custom-birth-label" for="fc-custom-loc">出身地点</label>
        <input id="fc-custom-loc" v-model="customLoc" class="mj-custom-birth-input" type="text" />
        <span class="mj-custom-birth-label">境界</span>
        <div class="mj-custom-birth-realm-row">
          <select id="fc-custom-major" v-model="customRealmMajor" class="mj-custom-birth-select">
            <option v-for="m in CUSTOM_REALM_MAJORS" :key="m" :value="m">{{ m }}</option>
          </select>
          <div class="mj-custom-birth-realm-minor-wrap">
            <select id="fc-custom-minor" v-model="customRealmMinor" class="mj-custom-birth-select">
              <option v-for="m in CUSTOM_REALM_MINORS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </div>
        <label class="mj-custom-birth-label" for="fc-custom-bg">出身背景</label>
        <textarea id="fc-custom-bg" v-model="customBg" class="mj-custom-birth-textarea"></textarea>
        <div class="mj-custom-birth-actions">
          <button type="button" class="major-action-button mj-custom-birth-btn-cancel" @click="emit('close')">
            取消
          </button>
          <button
            type="button"
            class="major-action-button"
            :disabled="!customBirthFormValid"
            :title="customBirthFormValid ? undefined : '请填写出身地点与出身背景'"
            @click="confirm"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
