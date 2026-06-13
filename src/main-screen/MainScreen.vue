<script setup lang="ts">
import { toRef, computed, ref } from "vue";
import { useOpeningStoryFromFateChoice } from "../ai/useOpeningStory";
import { useApiConfig } from "../ai/useApiConfig";
import { protagonist } from "../role_core/Protagonist";
import type { FateChoiceResult } from "../fate_choice/types";
import type { BattleTriggerEntry } from "../ai/state_generate";
import type { CultivationInput } from "../ai/cultivation_types";
import type { BattleResult } from "../battle_core/types";
import type { WorldLocation } from "../role_core/types/worldLocation";
import SideToolbarPanel from "./SideToolbarPanel.vue";
import PlayerInfoPanel from "./PlayerInfoPanel.vue";
import StoryChatPanel from "./StoryChatPanel.vue";

const props = defineProps<{
  visible: boolean;
  fateChoice?: FateChoiceResult | null;
  battleResult?: BattleResult | null;
}>();

const { apiUrl, apiKey, apiModel } = useApiConfig();

const fateChoiceRef = toRef(props, "fateChoice");
const apiSlice = computed(() => ({
  apiUrl: apiUrl.value,
  apiKey: apiKey.value,
  apiModel: apiModel.value,
}));

const { storyBody, phase, errorMessage, worldTime, worldTimeBaseline, worldLocation, initSnapshot } =
  useOpeningStoryFromFateChoice(fateChoiceRef, apiSlice);

const emit = defineEmits<{
  back: [];
  battleTrigger: [value: BattleTriggerEntry];
  consumeBattleResult: [];
  cultivate: [value: CultivationInput];
}>();

const pendingCultivation = ref<CultivationInput | null>(null);

function onCultivate(input: CultivationInput) {
  pendingCultivation.value = input;
}

function consumeCultivation() {
  pendingCultivation.value = null;
}

function onBack() {
  emit("back");
}
</script>

<template>
  <div
    class="main-screen"
    role="application"
    aria-label="凡人修仙传主界面"
  >
    <header class="main-screen__toolbar">
      <h1 class="main-screen__title">凡人修仙传</h1>
      <div class="main-screen__toolbar-actions">
        <button type="button" class="main-screen__btn" @click="onBack">返回标题</button>
      </div>
    </header>
    <div class="main-screen__body">
      <aside class="main-screen__pane main-screen__pane--player" aria-label="左栏：主角与世界时间">
        <PlayerInfoPanel
          :protagonist="protagonist"
          :world-time="worldTime"
          :world-time-baseline="worldTimeBaseline"
          @update:world-time="worldTime = $event"
          @cultivate="onCultivate"
        />
      </aside>
      <main class="main-screen__pane main-screen__pane--chat" aria-label="中栏：剧情">
        <StoryChatPanel
          :story-text="storyBody"
          :phase="phase"
          :error-message="errorMessage"
          :current-world-location="worldLocation"
          :init-snapshot="initSnapshot"
          :battle-result="props.battleResult"
          :cultivation-input="pendingCultivation"
          v-model:world-time="worldTime"
          @update:world-location="worldLocation = $event"
          @battle-trigger="emit('battleTrigger', $event)"
          @consume-battle-result="emit('consumeBattleResult')"
          @consume-cultivation="consumeCultivation"
        />
      </main>
      <aside class="main-screen__pane main-screen__pane--side" aria-label="右栏：功能面板">
        <SideToolbarPanel :current-location="worldLocation" />
      </aside>
    </div>
  </div>
</template>
