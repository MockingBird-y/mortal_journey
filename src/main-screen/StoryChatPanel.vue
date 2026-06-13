<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { OpeningStoryPhase } from "../ai/useOpeningStory";
import { useApiConfig } from "../ai/useApiConfig";
import { generateStory, type StoryChatEntry } from "../ai/story_generate";
import { generateState, type StateParsed, type BattleTriggerEntry } from "../ai/state_generate";
import { generateCultivationStory } from "../ai/cultivation_story_generate";
import type { CultivationInput } from "../ai/cultivation_types";
import { protagonist } from "../role_core/Protagonist";
import { npcStore } from "../role_core/npcStore";
import { worldMapStore } from "../role_core/worldMapStore";
import { Character } from "../role_core/Character";
import { gameLog } from "../log/gameLog";
import { advanceWorldTime, type WorldTime } from "../role_core/worldTime";
import type { BattleResult } from "../battle_engine/types";
import type { WorldLocation } from "../role_core/types/worldLocation";
import { formatWorldLocationDash, isEmptyWorldLocation } from "../role_core/types/worldLocation";

const props = withDefaults(
  defineProps<{
    storyText?: string;
    phase?: OpeningStoryPhase;
    errorMessage?: string;
    currentWorldLocation?: WorldLocation | null;
    worldTime?: WorldTime;
    battleResult?: BattleResult | null;
    initSnapshot?: string;
    cultivationInput?: CultivationInput | null;
  }>(),
  {
    storyText: "",
    phase: "idle",
    errorMessage: "",
    currentWorldLocation: null,
    worldTime: undefined,
    battleResult: undefined,
    initSnapshot: "",
    cultivationInput: null,
  },
);

const { apiUrl, apiKey, apiModel } = useApiConfig();

const emit = defineEmits<{
  "update:worldLocation": [value: WorldLocation | null];
  "update:worldTime": [value: WorldTime];
  "battleTrigger": [value: BattleTriggerEntry];
  "consumeBattleResult": [];
  "consumeCultivation": [];
}>();

interface ChatMessage {
  type: "story" | "user";
  content: string;
  snapshot?: string;
}

const chatMessages = ref<ChatMessage[]>([]);
const inputText = ref("");
const generating = ref(false);
const genError = ref("");
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const pendingBattleTrigger = ref<BattleTriggerEntry | null>(null);
const battlePending = computed(() => pendingBattleTrigger.value !== null);

function autoResizeTextarea(): void {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

let abortCtl: AbortController | null = null;

function buildChatHistory(): StoryChatEntry[] {
  const msgs = chatMessages.value;
  let latestStoryIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].type === "story") {
      latestStoryIdx = i;
      break;
    }
  }
  return msgs.map((m, idx) => {
    const isStory = m.type === "story";
    const isLatest = isStory && idx === latestStoryIdx;
    const useSnapshot = isStory && !isLatest && m.snapshot;
    return {
      role: isStory ? ("assistant" as const) : ("user" as const),
      content: useSnapshot ? m.snapshot! : m.content,
    };
  });
}

watch(
  () => props.storyText,
  (text) => {
    if (text?.trim() && chatMessages.value.length === 0) {
      chatMessages.value.push({
        type: "story",
        content: text.trim(),
        snapshot: props.initSnapshot?.trim() || undefined,
      });
    }
  },
  { immediate: true },
);

function applyStateResult(stateResult: StateParsed, linggen: string[]): void {
  if (stateResult.worldLocation && !isEmptyWorldLocation(stateResult.worldLocation)) {
    emit("update:worldLocation", stateResult.worldLocation);
  }

  const current = protagonist.value;
  if (current) {
    current.applyStateChanges(stateResult);

    if (stateResult.timeAdvance && props.worldTime) {
      const delta = stateResult.timeAdvance;
      const newTime = advanceWorldTime(props.worldTime, delta);
      emit("update:worldTime", newTime);
      if (current.isShouyuanExhausted()) {
        gameLog.warn("[StoryChat] 寿元耗尽！");
      }
    }
  }

  if (stateResult.nearbyNpcs.length > 0) {
    npcStore.applyNpcUpdates(stateResult.nearbyNpcs, linggen);
  }

  if (stateResult.worldLocation && !isEmptyWorldLocation(stateResult.worldLocation)) {
    worldMapStore.addLocation(
      stateResult.worldLocation,
      stateResult.nearbyNpcs.map(n => n.displayName),
    );
  }

  if (stateResult.battleTrigger) {
    pendingBattleTrigger.value = stateResult.battleTrigger;
  }
}

function enterBattle(): void {
  const entry = pendingBattleTrigger.value;
  if (!entry) return;
  pendingBattleTrigger.value = null;
  emit("battleTrigger", entry);
}

async function handleSend(): Promise<void> {
  const msg = inputText.value.trim();
  if (!msg || generating.value) return;

  const p = protagonist.value;
  if (!p) {
    genError.value = "主角数据未就绪，无法生成剧情。";
    return;
  }

  const url = String(apiUrl.value || "").trim();
  const model = String(apiModel.value || "").trim();
  if (!url || !model) {
    genError.value = "未配置 API URL 或模型。";
    return;
  }

  chatMessages.value.push({ type: "user", content: msg });
  inputText.value = "";
  if (textareaRef.value) textareaRef.value.style.height = "auto";
  generating.value = true;
  genError.value = "";

  const chatHistory: StoryChatEntry[] = buildChatHistory();
  const npcSnapshot = buildNpcSnapshot();

  const ac = new AbortController();
    abortCtl = ac;

  try {
    const storyResult = await generateStory({
      apiUrl: url,
      apiKey: String(apiKey.value || "").trim() || undefined,
      model,
      protagonist: p,
      chatHistory,
      signal: ac.signal,
    });

    if (abortCtl !== ac) return;

    if (!storyResult.storyBody.trim()) {
      genError.value = "模型返回的剧情正文为空。";
      return;
    }

    chatMessages.value.push({ type: "story", content: storyResult.storyBody.trim() });

    try {
      const stateResult: StateParsed = await generateState({
        apiUrl: url,
        apiKey: String(apiKey.value || "").trim() || undefined,
        model,
        storyBody: storyResult.storyBody,
        protagonist: p,
        currentWorldLocation: props.currentWorldLocation ?? undefined,
        currentWorldTime: props.worldTime,
        npcSnapshot: npcSnapshot || undefined,
        signal: ac.signal,
      });

      if (abortCtl !== ac) return;

      applyStateResult(stateResult, p.linggen);

      if (stateResult.storySnapshot.trim()) {
        const last = chatMessages.value[chatMessages.value.length - 1];
        if (last && last.type === "story") {
          last.snapshot = stateResult.storySnapshot.trim();
        }
      }
    } catch (stateErr) {
      gameLog.error("[StoryChat] 状态更新失败：" + (stateErr instanceof Error ? stateErr.message : String(stateErr)));
    }
  } catch (e) {
    if (ac.signal.aborted) return;
    genError.value = e instanceof Error ? e.message : String(e);
    gameLog.error("[StoryChat] " + genError.value);
  } finally {
    if (abortCtl === ac) abortCtl = null;
    generating.value = false;
  }
}

function buildNpcSnapshot(): string {
  const npcs = npcStore.allNpcs();
  if (npcs.length === 0) return "";
  const lines: string[] = [];
  for (const npc of npcs) {
    const favor = npc.favorability;
    const hp = `${npc.currentHp}/${npc.maxHp}`;
    const mp = `${npc.currentMp}/${npc.maxMp}`;
    const dead = npc.isDead ? " [已故]" : "";
    lines.push(
      `${npc.displayName}（${npc.identity}，${Character.formatRealm(npc.realm)}，好感${favor}，HP ${hp}，MP ${mp}）${dead}`,
    );
  }
  return lines.join("\n");
}

function onInputKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function formatBattleResultMessage(r: BattleResult): string {
  const outcomeMap: Record<string, string> = {
    victory: "胜",
    defeat: "败",
    fled: "撤退",
  };
  const outcomeText = outcomeMap[r.outcome];
  const enemyText = r.enemyNames.join("、");

  const parts: string[] = [];
  parts.push(`与${enemyText}的战斗结束，${outcomeText}。`);

  if (r.enemiesKilled.length > 0) {
    parts.push(`${r.enemiesKilled.join("、")}已被击杀。`);
  }

  return parts.join("");
}

function formatCultivationMessage(input: CultivationInput): string {
  const years = Math.floor(input.estimatedMonths / 12);
  const months = input.estimatedMonths % 12;
  const timeParts: string[] = [];
  if (years > 0) timeParts.push(`${years}年`);
  if (months > 0) timeParts.push(`${months}个月`);
  const timeStr = timeParts.join("") || "数日";

  return `取出${input.spiritStoneCount}枚灵石，开始闭关修炼${input.gongfaName}，预计需要${timeStr}。`;
}

watch(
  () => props.cultivationInput,
  async (input) => {
    if (!input) return;

    const p = protagonist.value;
    if (!p) return;

    const url = String(apiUrl.value || "").trim();
    const model = String(apiModel.value || "").trim();
    if (!url || !model) return;

    const msg = formatCultivationMessage(input);
    chatMessages.value.push({ type: "user", content: msg });

    emit("consumeCultivation");

    generating.value = true;
    genError.value = "";

    const npcSnapshot = buildNpcSnapshot();
    const chatHistory: StoryChatEntry[] = buildChatHistory();

    const ac = new AbortController();
    abortCtl = ac;

    try {
      const cultStoryResult = await generateCultivationStory({
        apiUrl: url,
        apiKey: String(apiKey.value || "").trim() || undefined,
        model,
        gongfaName: input.gongfaName,
        gongfaGrade: input.gongfaGrade,
        gongfaSystem: input.gongfaSystem,
        currentMastery: input.currentMastery,
        currentMasteryExp: input.currentMasteryExp,
        masteryThreshold: input.masteryThreshold,
        spiritStoneCount: input.spiritStoneCount,
        estimatedMonths: input.estimatedMonths,
        protagonist: p,
        currentWorldLocation: props.currentWorldLocation ?? undefined,
        npcSnapshot: npcSnapshot || undefined,
        chatHistory,
        signal: ac.signal,
      });

      if (abortCtl !== ac) return;

      if (!cultStoryResult.storyBody.trim()) {
        genError.value = "模型返回的修炼剧情正文为空。";
        return;
      }

      chatMessages.value.push({ type: "story", content: cultStoryResult.storyBody.trim() });

      try {
        const stateResult: StateParsed = await generateState({
          apiUrl: url,
          apiKey: String(apiKey.value || "").trim() || undefined,
          model,
          storyBody: cultStoryResult.storyBody,
          protagonist: p,
          currentWorldLocation: props.currentWorldLocation ?? undefined,
          currentWorldTime: props.worldTime,
          npcSnapshot: npcSnapshot || undefined,
          signal: ac.signal,
        });

        if (abortCtl !== ac) return;

        applyStateResult(stateResult, p.linggen);

        if (stateResult.storySnapshot.trim()) {
          const last = chatMessages.value[chatMessages.value.length - 1];
          if (last && last.type === "story") {
            last.snapshot = stateResult.storySnapshot.trim();
          }
        }
      } catch (stateErr) {
        gameLog.error("[StoryChat] 修炼状态更新失败：" + (stateErr instanceof Error ? stateErr.message : String(stateErr)));
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      genError.value = e instanceof Error ? e.message : String(e);
      gameLog.error("[StoryChat] " + genError.value);
    } finally {
      if (abortCtl === ac) abortCtl = null;
      generating.value = false;
    }
  },
);

watch(
  () => props.battleResult,
  async (result) => {
    if (!result) return;

    const p = protagonist.value;
    if (!p) return;

    const url = String(apiUrl.value || "").trim();
    const model = String(apiModel.value || "").trim();
    if (!url || !model) return;

    const msg = formatBattleResultMessage(result);
    chatMessages.value.push({ type: "user", content: msg });

    emit("consumeBattleResult");

    generating.value = true;
    genError.value = "";

    const chatHistory: StoryChatEntry[] = buildChatHistory();

    const npcSnapshot = buildNpcSnapshot();

    const ac = new AbortController();
    abortCtl = ac;

    try {
      const storyResult = await generateStory({
        apiUrl: url,
        apiKey: String(apiKey.value || "").trim() || undefined,
        model,
        protagonist: p,
        chatHistory,
        signal: ac.signal,
      });

      if (abortCtl !== ac) return;

      if (!storyResult.storyBody.trim()) {
        genError.value = "模型返回的剧情正文为空。";
        return;
      }

      chatMessages.value.push({ type: "story", content: storyResult.storyBody.trim() });

      try {
        const stateResult: StateParsed = await generateState({
          apiUrl: url,
          apiKey: String(apiKey.value || "").trim() || undefined,
          model,
          storyBody: storyResult.storyBody,
          protagonist: p,
          currentWorldLocation: props.currentWorldLocation ?? undefined,
          currentWorldTime: props.worldTime,
          npcSnapshot: npcSnapshot || undefined,
          signal: ac.signal,
        });

        if (abortCtl !== ac) return;

        applyStateResult(stateResult, p.linggen);

        if (stateResult.storySnapshot.trim()) {
          const last = chatMessages.value[chatMessages.value.length - 1];
          if (last && last.type === "story") {
            last.snapshot = stateResult.storySnapshot.trim();
          }
        }
      } catch (stateErr) {
        gameLog.error("[StoryChat] 战斗后状态更新失败：" + (stateErr instanceof Error ? stateErr.message : String(stateErr)));
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      genError.value = e instanceof Error ? e.message : String(e);
      gameLog.error("[StoryChat] " + genError.value);
    } finally {
      if (abortCtl === ac) abortCtl = null;
      generating.value = false;
    }
  },
);
</script>

<template>
  <section class="main-panel main-panel--story" aria-label="剧情对话">
    <header class="main-panel__head">
      <h2 class="main-panel__title">剧情</h2>
      <div v-if="currentWorldLocation" class="main-panel__location-breadcrumb">
        <span v-if="currentWorldLocation.region" class="mj-breadcrumb-seg">{{ currentWorldLocation.region }}</span>
        <template v-if="currentWorldLocation.country">
          <span class="mj-breadcrumb-sep">›</span>
          <span class="mj-breadcrumb-seg">{{ currentWorldLocation.country }}</span>
        </template>
        <template v-if="currentWorldLocation.area">
          <span class="mj-breadcrumb-sep">›</span>
          <span class="mj-breadcrumb-seg">{{ currentWorldLocation.area }}</span>
        </template>
        <template v-if="currentWorldLocation.detail">
          <span class="mj-breadcrumb-sep">›</span>
          <span class="mj-breadcrumb-seg mj-breadcrumb-seg--detail">{{ currentWorldLocation.detail }}</span>
        </template>
      </div>
    </header>
    <div class="main-panel__body">
      <div class="main-panel__chat-messages" aria-label="剧情正文区域" aria-live="polite">
        <p v-if="phase === 'loading' && chatMessages.length === 0" class="main-panel__story-status main-panel__story-status--loading">
          正在生成开局剧情…
        </p>
        <p
          v-else-if="phase === 'error' && chatMessages.length === 0"
          class="main-panel__story-status main-panel__story-status--error"
        >
          {{ errorMessage || "开局剧情生成失败。" }}
        </p>
        <p
          v-else-if="phase === 'idle' && chatMessages.length === 0"
          class="main-panel__placeholder"
        >
          完成命运抉择并进入主界面后，开局剧情将显示于此。
        </p>
        <template v-else>
          <div
            v-for="(msg, idx) in chatMessages"
            :key="idx"
            :class="['main-panel__chat-bubble', msg.type === 'user' ? 'main-panel__chat-bubble--user' : 'main-panel__chat-bubble--story']"
          >
            <template v-if="msg.type === 'story'">
              <div class="main-panel__story-prose">{{ msg.content }}</div>
            </template>
            <template v-else>
              {{ msg.content }}
            </template>
          </div>
        </template>
        <p v-if="generating" class="main-panel__story-status main-panel__story-status--loading">
          正在生成后续剧情…
        </p>
        <p v-if="genError" class="main-panel__story-status main-panel__story-status--error">
          {{ genError }}
        </p>
        <div v-if="battlePending" class="main-panel__battle-entry">
          <button type="button" class="main-panel__battle-entry-btn" @click="enterBattle">
            <i class="fa-solid fa-swords" aria-hidden="true"></i>
            进入战斗
          </button>
        </div>
      </div>
      <div class="main-panel__composer">
        <textarea
          ref="textareaRef"
          class="main-panel__input"
          :readonly="generating || battlePending"
          :disabled="(phase !== 'ready' && chatMessages.length === 0) || battlePending"
          placeholder="输入你的行动…"
          aria-label="消息输入"
          v-model="inputText"
          @input="autoResizeTextarea"
          @keydown="onInputKeydown"
          rows="1"
        />
        <button
          type="button"
          class="main-screen__btn"
          :disabled="generating || battlePending || !inputText.trim() || (phase !== 'ready' && chatMessages.length === 0)"
          @click="handleSend"
        >
          {{ generating ? "生成中…" : "发送" }}
        </button>
      </div>
    </div>
  </section>
</template>
