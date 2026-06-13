<script setup lang="ts">
import { ref } from "vue";
import DebugLogPanel from "./log/DebugLogPanel.vue";
import StartFrame from "./start_frame/StartFrame.vue";
import FateChoiceScreen from "./fate_choice/FateChoiceScreen.vue";
import MainScreen from "./main-screen/MainScreen.vue";
import BattleScreen from "./battle_view/BattleScreen.vue";
import { gameLog } from "./log/gameLog";
import type { FateChoiceResult } from "./fate_choice/types";
import type { BattleTriggerEntry } from "./ai/state_generate";
import type { BattleResult } from "./battle_engine/types";

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

const pendingBattleTrigger = ref<BattleTriggerEntry | null>(null);

function onBattleTrigger(entry: BattleTriggerEntry) {
  gameLog.info("[App] 战斗触发: " + JSON.stringify(entry, null, 2));
  pendingBattleTrigger.value = entry;
  battleVisible.value = true;
}

const battleVisible = ref(false);
const lastBattleResult = ref<BattleResult | null>(null);

function onBattleEnd(result: BattleResult | null) {
  battleVisible.value = false;
  pendingBattleTrigger.value = null;
  if (result) lastBattleResult.value = result;
}

function onBattleResultConsumed() {
  lastBattleResult.value = null;
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
      :battle-result="lastBattleResult"
      @back="onMainScreenBack"
      @battle-trigger="onBattleTrigger"
      @consume-battle-result="onBattleResultConsumed"
    />
  </Transition>

  <BattleScreen
    v-if="battleVisible"
    :trigger="pendingBattleTrigger"
    @battle-end="onBattleEnd"
  />
</template>
