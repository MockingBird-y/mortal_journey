<script setup lang="ts">
import { toRef, computed, ref } from "vue";
import { useOpeningStoryFromFateChoice } from "../ai/useOpeningStory";
import { useApiConfig } from "../ai/useApiConfig";
import { protagonist } from "../role_core/Protagonist";
import { Npc } from "../role_core/Npc";
import { npcStore } from "../role_core/npcStore";
import { getRealmPrimaryStats } from "../role_core/realmUtils";
import type { NpcPlayInfo } from "../role_core/types/playInfo";
import type { FateChoiceResult } from "../fate_choice/types";
import type { BattleTriggerEntry } from "../ai/state_generate";
import type { CultivationInput } from "../ai/cultivation_types";
import type { BattleResult } from "../battle_engine/types";
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

const { storyBody, phase, errorMessage, worldTime, worldTimeBaseline, worldLocation, initSnapshot, initActionOptions } =
  useOpeningStoryFromFateChoice(fateChoiceRef, apiSlice);

const emit = defineEmits<{
  back: [];
  battleTrigger: [value: BattleTriggerEntry];
  consumeBattleResult: [];
  cultivate: [value: CultivationInput];
}>();

const pendingCultivation = ref<CultivationInput | null>(null);
const chatGenerating = ref(false);

const isBusy = computed(() => phase.value !== "ready" || chatGenerating.value);

function onCultivate(input: CultivationInput) {
  pendingCultivation.value = input;
}

function consumeCultivation() {
  pendingCultivation.value = null;
}

function onBack() {
  emit("back");
}

const DUMMY_NAME = "战斗人偶";

function startTestBattle() {
  const p = protagonist.value;
  if (!p) return;

  npcStore.removeNpc(DUMMY_NAME);

  const realmStats = getRealmPrimaryStats(p.realm.major, p.realm.minor)
    ?? { physique: 10, spirit: 10, strength: 10, perception: 10, guard: 5, resistance: 5, agility: 1, insight: 1 };

  const dummyMaxHp = p.maxHp * 5;

  const dummyData: NpcPlayInfo = {
    id: "test-dummy",
    displayName: DUMMY_NAME,
    realm: { major: p.realm.major, minor: p.realm.minor },
    primaryStats: {
      physique: realmStats.physique,
      spirit: realmStats.spirit,
      strength: 1,
      perception: 1,
      guard: realmStats.guard,
      resistance: realmStats.resistance,
      agility: 1,
      insight: 1,
    },
    maxHp: dummyMaxHp,
    maxMp: 50,
    currentHp: dummyMaxHp,
    currentMp: 50,
    avatarUrl: "",
    gender: "无",
    linggen: [],
    age: 0,
    ageConfirmed: true,
    shouyuan: 9999,
    inventorySlots: [],
    gongfaSlots: [null, null, null, null, null, null, null, null],
    equippedSlots: [],
    role: "npc",
    identity: "战斗测试人偶",
    favorability: 0,
    isDead: false,
    powerTier: "小怪",
    currentStageGoal: "",
    longTermGoal: "",
    hobby: "",
    fear: "",
    personality: "",
    traits: [],
    xiuwei: 0,
  };

  npcStore.setNpc(Npc.fromData(dummyData));

  emit("battleTrigger", {
    shouldEnterBattle: true,
    triggerKind: "active" as const,
    triggerReason: "战斗测试",
    allies: [{ displayName: p.displayName, roleHint: "主角" }],
    enemies: [{ displayName: DUMMY_NAME, roleHint: "敌人" }],
    isTestBattle: true,
  });
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
          :init-action-options="initActionOptions"
          :battle-result="props.battleResult"
          :cultivation-input="pendingCultivation"
          v-model:world-time="worldTime"
          @update:world-location="worldLocation = $event"
          @battle-trigger="emit('battleTrigger', $event)"
          @consume-battle-result="emit('consumeBattleResult')"
          @consume-cultivation="consumeCultivation"
          @generating-change="chatGenerating = $event"
        />
      </main>
      <aside class="main-screen__pane main-screen__pane--side" aria-label="右栏：功能面板">
        <SideToolbarPanel :current-location="worldLocation" :test-disabled="isBusy" @test-battle="startTestBattle" />
      </aside>
    </div>
  </div>
</template>
