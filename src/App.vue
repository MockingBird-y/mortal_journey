<script setup lang="ts">
import { ref } from "vue";
import DebugLogPanel from "./log/DebugLogPanel.vue";
import StartFrame from "./start_frame/StartFrame.vue";
import FateChoiceScreen from "./fate_choice/FateChoiceScreen.vue";
import MainScreen from "./main-screen/MainScreen.vue";
import BattleScreen from "./battle_view/BattleScreen.vue";
import { gameLog } from "./log/gameLog";
import { npcStore } from "./role_core/npcStore";
import { ALL_TEST_DUMMY_NAMES } from "./main-screen/testBattle";
import type { FateChoiceResult } from "./fate_choice/types";
import type { BattleTriggerEntry } from "./ai/state_generate";
import type { BattleResult } from "./battle_engine/types";
import {
  resetAllGameState,
  createSave,
  writeActiveSave,
  restoreSave,
  setActiveSave,
  isCompleteSave,
  readSave,
  getPersistedActiveId,
  clearActiveId,
  type MjSavePayload,
} from "./save/gameSave";

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
  resetAllGameState();
  createSave(payload);
  lastFateChoice.value = payload;
  fateChoiceVisible.value = false;
  mainScreenVisible.value = true;
}

function onMainScreenBack() {
  writeActiveSave();
  clearActiveId();
  mainScreenVisible.value = false;
}

/** 恢复一个完整存档并进入主界面。`resetFirst=true` 时先清空上一局状态（手动读档）。 */
function enterSaveSession(id: string, payload: MjSavePayload, resetFirst: boolean): void {
  if (resetFirst) resetAllGameState();
  setActiveSave(id, payload.fateChoice, payload.createdAt || Date.now());
  restoreSave(payload);
  lastFateChoice.value = null;
  fateChoiceVisible.value = false;
  mainScreenVisible.value = true;
}

/** 从标题读取人生：恢复存档（完整则直接读档，占位/未完成则按 fateChoice 重跑开局）。 */
function onSaveLoaded(value: { id: string; payload: MjSavePayload }): void {
  const { id, payload } = value;
  if (isCompleteSave(payload)) {
    enterSaveSession(id, payload, true);
  } else {
    resetAllGameState();
    setActiveSave(id, payload.fateChoice, payload.createdAt || Date.now());
    lastFateChoice.value = payload.fateChoice;
    fateChoiceVisible.value = false;
    mainScreenVisible.value = true;
  }
}

// 刷新续玩：若本地持久化了活动存档且为完整存档，启动时直接恢复进主界面（无标题闪烁）。
(function resumeOnStartup(): void {
  const id = getPersistedActiveId();
  if (!id) return;
  const payload = readSave(id);
  if (payload && isCompleteSave(payload)) {
    enterSaveSession(id, payload, false);
  } else {
    clearActiveId();
  }
})();

const pendingBattleTrigger = ref<BattleTriggerEntry | null>(null);

function onBattleTrigger(entry: BattleTriggerEntry) {
  gameLog.info("[App] 战斗触发: " + JSON.stringify(entry, null, 2));
  pendingBattleTrigger.value = entry;
  battleVisible.value = true;
}

const battleVisible = ref(false);
const lastBattleResult = ref<BattleResult | null>(null);

function onBattleEnd(result: BattleResult | null) {
  const wasTest = pendingBattleTrigger.value?.isTestBattle ?? false;
  battleVisible.value = false;
  pendingBattleTrigger.value = null;
  if (wasTest) {
    for (const n of ALL_TEST_DUMMY_NAMES) {
      npcStore.removeNpc(n);
    }
  } else if (result) {
    lastBattleResult.value = result;
  }
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
      @save-loaded="onSaveLoaded"
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
