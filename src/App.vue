<script setup lang="ts">
import { ref } from "vue";
import DebugLogPanel from "./log/DebugLogPanel.vue";
import StartFrame from "./start_frame/StartFrame.vue";
import FateChoiceScreen from "./fate_choice/FateChoiceScreen.vue";
import MainScreen from "./main-screen/MainScreen.vue";
import { gameLog } from "./log/gameLog";
import type { FateChoiceResult } from "./fate_choice/types";

const fateChoiceVisible = ref(false);
const mainScreenVisible = ref(false);
const lastFateChoice = ref<FateChoiceResult | null>(null);

function openFateChoice() {
  fateChoiceVisible.value = true;
}

function closeFateChoice() {
  fateChoiceVisible.value = false;
}

function onFateChoiceComplete(payload: FateChoiceResult) {
  gameLog.info("[App] 命运抉择 JSON: " + JSON.stringify(payload, null, 2));
  lastFateChoice.value = payload;
  fateChoiceVisible.value = false;
  mainScreenVisible.value = true;
}

function onMainScreenBack() {
  mainScreenVisible.value = false;
}
</script>

<template>
  <DebugLogPanel />

  <Transition name="mj-fade">
    <StartFrame
      v-if="!mainScreenVisible && !fateChoiceVisible"
      :main-screen-visible="mainScreenVisible"
      @start-new-life="openFateChoice"
    />
  </Transition>

  <Transition name="mj-slide-up">
    <FateChoiceScreen
      v-if="fateChoiceVisible"
      :visible="fateChoiceVisible"
      @close="closeFateChoice"
      @complete="onFateChoiceComplete"
    />
  </Transition>

  <Transition name="mj-main">
    <MainScreen
      v-if="mainScreenVisible"
      :visible="mainScreenVisible"
      :fate-choice="lastFateChoice"
      @back="onMainScreenBack"
    />
  </Transition>
</template>
