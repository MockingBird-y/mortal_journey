<script setup lang="ts">
import { ref, watch, computed, nextTick } from "vue";
import type { OpeningStoryPhase } from "../ai/useOpeningStory";
import { useApiConfig } from "../ai/useApiConfig";
import { generateStory, type StoryChatEntry } from "../ai/story_generate";
import { generateState, type StateParsed, type BattleTriggerEntry, type ActionSuggestions } from "../ai/state_generate";
import { generateCultivationStory } from "../ai/cultivation_story_generate";
import { generateNpcReevaluation } from "../ai/npc_reevaluation_generate";
import type { CultivationInput } from "../ai/cultivation_types";
import { protagonist } from "../role_core/Protagonist";
import { npcStore } from "../role_core/npcStore";
import { worldMapStore } from "../role_core/worldMapStore";
import { Character } from "../role_core/Character";
import { gameLog } from "../log/gameLog";
import {
  advanceWorldTime,
  formatWorldTimeZhDisplay,
  worldTimeYearsBetween,
  NPC_REEVALUATION_THRESHOLD_YEARS,
  type WorldTime,
} from "../role_core/worldTime";
import type { BattleResult } from "../battle_engine/types";
import type { WorldLocation } from "../role_core/types/worldLocation";
import { formatWorldLocationDash, isEmptyWorldLocation, isWorldLocationEqual } from "../role_core/types/worldLocation";
import type { Npc } from "../role_core/Npc";

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
    initActionOptions?: ActionSuggestions | null;
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
    initActionOptions: null,
  },
);

const { apiUrl, apiKey, apiModel } = useApiConfig();

const emit = defineEmits<{
  "update:worldLocation": [value: WorldLocation | null];
  "update:worldTime": [value: WorldTime];
  "battleTrigger": [value: BattleTriggerEntry];
  "consumeBattleResult": [];
  "consumeCultivation": [];
  "generatingChange": [value: boolean];
}>();

interface ChatMessage {
  type: "story" | "user";
  content: string;
  snapshot?: string;
}

const chatMessages = ref<ChatMessage[]>([]);
const inputText = ref("");
const generating = ref(false);
const generatingPhase = ref<"story" | "state">("story");
const genError = ref("");
/** 当前显示的四个行动建议（来自状态 AI）。null 时隐藏按钮区。 */
const actionOptions = ref<ActionSuggestions | null>(null);

function beginGenerating(): void {
  generating.value = true;
  generatingPhase.value = "story";
  genError.value = "";
}
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const pendingBattleTrigger = ref<BattleTriggerEntry | null>(null);
const battlePending = computed(() => pendingBattleTrigger.value !== null);

function autoResizeTextarea(): void {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

/** 点击快捷选项：填入输入框（玩家可编辑后手动发送），并触发 textarea 自适应高度。 */
function useActionOption(text: string): void {
  inputText.value = text;
  nextTick(() => autoResizeTextarea());
}

// 开局选项：从 prop 同步到内部 ref（仅开局触发一次）。
watch(
  () => props.initActionOptions,
  (opts) => {
    if (opts) actionOptions.value = opts;
  },
);

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

watch(generating, (val) => {
  emit("generatingChange", val);
});

/**
 * 主角进入新地点时：唤醒该地点 dormant NPC，并对长期未见的（≥ NPC_REEVALUATION_THRESHOLD_YEARS）
 * 批量触发 AI 核心层重评估。低频、批量、整体性更新，是「严格事件驱动」的受控例外。
 */
async function handleLocationEnter(
  newLocation: WorldLocation,
  worldTime: WorldTime,
  linggen: string[],
): Promise<void> {
  // wake 前先收集 dormant 列表（此时 lastSeen 仍是旧值，用于算 gap）。
  const dormantHere = npcStore.getDormantNpcsAt(newLocation);
  if (dormantHere.length === 0) return;

  // 计算每个 dormant NPC 的间隔年数，筛出需重评估者。
  const reevaluationBatch: Array<{ npc: Npc; gap: number }> = [];
  let maxGap = 0;
  for (const npc of dormantHere) {
    const gap = worldTimeYearsBetween(npc.lastSeenWorldTime, worldTime);
    if (gap >= NPC_REEVALUATION_THRESHOLD_YEARS) {
      reevaluationBatch.push({ npc, gap });
      if (gap > maxGap) maxGap = gap;
    }
  }

  // 唤醒（更新 presence + lastSeen=now）。
  npcStore.wakeDormantAtLocation(newLocation, worldTime);

  if (reevaluationBatch.length === 0) return;

  const url = String(apiUrl.value || "").trim();
  const model = String(apiModel.value || "").trim();
  if (!url || !model) return;

  const p = protagonist.value;
  try {
    gameLog.info(`[StoryChat] 重评估 ${reevaluationBatch.length} 名长期未见的 NPC（间隔约 ${maxGap.toFixed(1)} 年）…`);
    const results = await generateNpcReevaluation({
      apiUrl: url,
      apiKey: String(apiKey.value || "").trim() || undefined,
      model,
      yearsElapsed: maxGap,
      currentWorldTime: worldTime,
      protagonistRealm: p ? { major: p.realm.major, minor: p.realm.minor } : { major: "练气", minor: "初期" },
      npcs: reevaluationBatch.map(b => b.npc),
      signal: undefined,
    });
    npcStore.applyReevaluation(results, linggen);
  } catch (e) {
    gameLog.error("[StoryChat] NPC 重评估失败：" + (e instanceof Error ? e.message : String(e)));
  }
}

async function applyStateResult(stateResult: StateParsed, linggen: string[]): Promise<void> {
  const oldLocation = props.currentWorldLocation ?? null;
  const newLocation = stateResult.worldLocation && !isEmptyWorldLocation(stateResult.worldLocation)
    ? stateResult.worldLocation
    : oldLocation;
  const locationChanged = !isWorldLocationEqual(oldLocation, newLocation);

  // ① 快照旧地点 active 集合（在 markDormant 之前），用于后续判定跨地点跟随的合法性。
  const oldActiveSet = locationChanged && oldLocation
    ? new Set(npcStore.getActiveNpcsAt(oldLocation))
    : new Set<Npc>();

  // ② 地点切换：旧地点 active NPC 转入休眠（保留全部数据，等待回归）。
  if (locationChanged && oldLocation) {
    npcStore.markDormantAtLocation(oldLocation);
  }

  if (newLocation && !isWorldLocationEqual(newLocation, oldLocation)) {
    emit("update:worldLocation", newLocation);
  }

  const current = protagonist.value;
  let newWorldTime: WorldTime | undefined = props.worldTime;
  if (current) {
    current.applyStateChanges(stateResult);

    if (stateResult.timeAdvance && props.worldTime) {
      const delta = stateResult.timeAdvance;
      newWorldTime = advanceWorldTime(props.worldTime, delta);
      emit("update:worldTime", newWorldTime);
      if (current.isShouyuanExhausted()) {
        gameLog.warn("[StoryChat] 寿元耗尽！");
      }
    }
  }

  // ③ 地点切换：唤醒新地点 dormant NPC，并对长期未见的批量重评估（必须在 nearbyNpcs 处理前完成）。
  if (locationChanged && newLocation && newWorldTime) {
    await handleLocationEnter(newLocation, newWorldTime, linggen);
  }

  // ④ nearbyNpcs 一致性校正 + 跨地点迁移合法性过滤。
  // 在场者的 currentLocation 必须 = 主角新地点；AI 写错则强制校正。
  // 跨地点迁移：只有上一回合在旧地点 active 的 NPC 才能"跟随"到新地点；
  // 上一回合在第三地 dormant 的 NPC 不应瞬间出现在新地点，剔除并告警。
  let nearbyNpcsToApply = stateResult.nearbyNpcs;
  if (nearbyNpcsToApply.length > 0) {
    nearbyNpcsToApply = nearbyNpcsToApply.map(entry => {
      if (newLocation && (!entry.currentLocation || !isWorldLocationEqual(entry.currentLocation, newLocation))) {
        if (entry.currentLocation) {
          gameLog.warn(`[StoryChat] NPC「${entry.displayName}」的 currentLocation 与主角地点不符，已强制校正`);
        }
        return { ...entry, currentLocation: { ...newLocation } };
      }
      return entry;
    });

    if (locationChanged && oldLocation) {
      nearbyNpcsToApply = nearbyNpcsToApply.filter(entry => {
        const existing = entry.npcId
          ? npcStore.getNpcById(entry.npcId)
          : (entry.displayName ? npcStore.getNpc(entry.displayName) : undefined);
        // 新 NPC 或无位置信息：保留
        if (!existing || !existing.currentLocation) return true;
        // 上一回合在旧地点 active：合法跟随主角迁移
        if (oldActiveSet.has(existing)) return true;
        // 上一回合就在新地点（被唤醒的 dormant 或本就在场）：保留
        if (isWorldLocationEqual(existing.currentLocation, newLocation)) return true;
        // 上一回合在第三地 dormant：不可能瞬间跨地点，剔除并告警
        gameLog.warn(`[StoryChat] 地点切换兜底：剔除 NPC「${existing.displayName}」误入新地点 nearbyNpcs（上一回合在 ${formatWorldLocationDash(existing.currentLocation)}，不可能瞬间跨地点）`);
        return false;
      });
    }
  }

  if (nearbyNpcsToApply.length > 0 || stateResult.npcCoreChanges.length > 0) {
    npcStore.applyNpcUpdates(nearbyNpcsToApply, linggen, {
      coreChangeEvents: stateResult.npcCoreChanges,
      currentLocation: newLocation,
      currentWorldTime: newWorldTime ?? null,
    });
  }

  // ⑤ 登记新地点到世界地图（地点树）；NPC 在某地点的展示由 npcStore.currentLocation 单独维护。
  if (stateResult.worldLocation && !isEmptyWorldLocation(stateResult.worldLocation)) {
    worldMapStore.addLocation(stateResult.worldLocation);
  }

  if (stateResult.battleTrigger) {
    pendingBattleTrigger.value = stateResult.battleTrigger;
  }

  // 状态更新完成后刷新四个行动建议（由模板按 generating/battlePending 条件控制显隐）。
  actionOptions.value = stateResult.actionOptions;
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
  actionOptions.value = null;
  if (textareaRef.value) textareaRef.value.style.height = "auto";
  beginGenerating();

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
      sceneNpcSnapshot: buildSceneNpcSnapshot() || undefined,
      currentWorldLocation: props.currentWorldLocation ? formatWorldLocationDash(props.currentWorldLocation) : undefined,
      signal: ac.signal,
    });

    if (abortCtl !== ac) return;

    if (!storyResult.storyBody.trim()) {
      genError.value = "模型返回的剧情正文为空。";
      return;
    }

    chatMessages.value.push({ type: "story", content: storyResult.storyBody.trim() });

    try {
      generatingPhase.value = "state";
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

        await applyStateResult(stateResult, p.linggen);

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

/**
 * 构建发给 AI 的 NPC 上下文快照（三段式精简注入）。
 *
 * - 【当前场景在场】主角所在地点的 active NPC，完整状态（境界/HP/MP/好感/npcId）。
 *   npcId 必须给出，AI 才能在 nearbyNpcs 和核心变更事件里正确引用。
 * - 【本地点休眠】归属本地点但当前不在场的 dormant NPC，简表（用于让 AI 知道这些人
 *   仍在该地点，可在剧情里自然提及）。
 * - 【重要羁绊】高好感或 boss 级 NPC，无论身在何方，简表（老熟人线索）。
 *
 * 已故 NPC 不再出现。token 开销相比「全表灌入」大幅下降，也杜绝了 AI 因看到无关
 * NPC 而误改其数据。
 */
function formatNpcFullLine(npc: Npc): string {
  const favor = npc.favorability;
  const hp = `${npc.currentHp}/${npc.maxHp}`;
  const mp = `${npc.currentMp}/${npc.maxMp}`;
  const dead = npc.isDead ? " [已故]" : "";
  const cur = npc.currentLocation ? formatWorldLocationDash(npc.currentLocation) : "未知";
  return `${npc.displayName}（npcId:${npc.id}，${npc.identity}，${Character.formatRealm(npc.realm)}，当前:${cur}，好感${favor}，HP ${hp}，MP ${mp}）${dead}`;
}

function formatNpcBriefLine(npc: Npc): string {
  const lastSeen = npc.lastSeenWorldTime ? formatWorldTimeZhDisplay(npc.lastSeenWorldTime) : "未知";
  const cur = npc.currentLocation ? formatWorldLocationDash(npc.currentLocation) : "未知";
  return `${npc.displayName}（npcId:${npc.id}，${npc.identity}，${Character.formatRealm(npc.realm)}，当前:${cur}，好感${npc.favorability}，上次见面:${lastSeen}）`;
}

function buildNpcSnapshot(): string {
  const loc = props.currentWorldLocation ?? null;
  const activeNpcs = loc ? npcStore.getActiveNpcsAt(loc) : [];
  const dormantNpcs = loc ? npcStore.getDormantNpcsAt(loc) : [];
  const activeSet = new Set<Npc>(activeNpcs);
  const dormantSet = new Set<Npc>(dormantNpcs);
  const bondedNpcs = npcStore.getBondedNpcs().filter(n =>
    !activeSet.has(n) && !dormantSet.has(n) && n.presence !== "dead",
  );

  const sections: string[] = [];

  if (activeNpcs.length > 0) {
    sections.push("【当前场景在场NPC】\n" + activeNpcs.map(formatNpcFullLine).join("\n"));
  }
  if (dormantNpcs.length > 0) {
    sections.push("【本地点休眠NPC（曾在此地见过，当前不在场）】\n" + dormantNpcs.map(formatNpcBriefLine).join("\n"));
  }
  if (bondedNpcs.length > 0) {
    sections.push("【重要羁绊NPC（高好感或boss级，可能身在别处）】\n" + bondedNpcs.map(formatNpcBriefLine).join("\n"));
  }

  return sections.join("\n\n");
}

/**
 * 仅当前场景在场 NPC 的快照（给剧情 AI，让它描写与场景 NPC 行为一致）。
 * 比三段式更精简——剧情 AI 只需关心在场者，不需要休眠/羁绊 NPC。
 */
function buildSceneNpcSnapshot(): string {
  const loc = props.currentWorldLocation ?? null;
  const activeNpcs = loc ? npcStore.getActiveNpcsAt(loc) : [];
  return activeNpcs.map(formatNpcFullLine).join("\n");
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

    beginGenerating();

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
        generatingPhase.value = "state";
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

        await applyStateResult(stateResult, p.linggen);

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

    beginGenerating();

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
        sceneNpcSnapshot: buildSceneNpcSnapshot() || undefined,
        currentWorldLocation: props.currentWorldLocation ? formatWorldLocationDash(props.currentWorldLocation) : undefined,
        signal: ac.signal,
      });

      if (abortCtl !== ac) return;

      if (!storyResult.storyBody.trim()) {
        genError.value = "模型返回的剧情正文为空。";
        return;
      }

      chatMessages.value.push({ type: "story", content: storyResult.storyBody.trim() });

      try {
        generatingPhase.value = "state";
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

        await applyStateResult(stateResult, p.linggen);

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
      </div>
      <div class="main-panel__composer-area">
        <div v-if="generating || (phase === 'loading' && chatMessages.length > 0)" class="main-panel__composer-status main-panel__composer-status--loading">
          <span class="main-panel__status-pulse"></span>
          {{ phase === 'loading' && chatMessages.length > 0 ? 'AI 正在更新开局状态…' : (generatingPhase === 'state' ? 'AI 正在更新状态…' : 'AI 正在生成剧情…') }}
        </div>
        <div v-else-if="genError" class="main-panel__composer-status main-panel__composer-status--error">
          <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{{ genError }}
        </div>
        <div v-if="battlePending" class="main-panel__battle-entry main-panel__battle-entry--inline">
          <button type="button" class="main-panel__battle-entry-btn" @click="enterBattle">
            <i class="fa-solid fa-swords" aria-hidden="true"></i>
            进入战斗
          </button>
        </div>
        <div v-else class="main-panel__composer">
          <div
            v-if="actionOptions && phase === 'ready'"
            class="main-panel__action-options"
            aria-label="快捷行动选项"
          >
            <button
              type="button"
              class="action-option"
              @click="useActionOption(actionOptions.aggressive)"
              :title="actionOptions.aggressive"
            >
              <span class="action-option__text">{{ actionOptions.aggressive }}</span>
            </button>
            <button
              type="button"
              class="action-option"
              @click="useActionOption(actionOptions.moderate)"
              :title="actionOptions.moderate"
            >
              <span class="action-option__text">{{ actionOptions.moderate }}</span>
            </button>
            <button
              type="button"
              class="action-option"
              @click="useActionOption(actionOptions.cautious)"
              :title="actionOptions.cautious"
            >
              <span class="action-option__text">{{ actionOptions.cautious }}</span>
            </button>
            <button
              type="button"
              class="action-option"
              @click="useActionOption(actionOptions.veryCautious)"
              :title="actionOptions.veryCautious"
            >
              <span class="action-option__text">{{ actionOptions.veryCautious }}</span>
            </button>
          </div>
          <textarea
            ref="textareaRef"
            class="main-panel__input"
            :readonly="generating"
            :disabled="phase !== 'ready'"
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
            :disabled="generating || phase !== 'ready' || !inputText.trim()"
            @click="handleSend"
          >
            {{ generating ? "生成中…" : "发送" }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
