<script setup lang="ts">
import { ref, watch } from "vue";
import type { OpeningStoryPhase } from "../ai/useOpeningStory";
import { useApiConfig } from "../ai/useApiConfig";
import { generateStory, type StoryChatEntry } from "../ai/story_generate";
import { generateState, type StateParsed, type BattleTriggerEntry } from "../ai/state_generate";
import { protagonist } from "../role_core/Protagonist";
import { npcStore } from "../role_core/npcStore";
import { Character } from "../role_core/Character";
import { gameLog } from "../log/gameLog";
import { advanceWorldTime, type WorldTime } from "../role_core/worldTime";
import type { BattleResult } from "../battle_core/battleTypes";

const props = withDefaults(
  defineProps<{
    storyText?: string;
    phase?: OpeningStoryPhase;
    errorMessage?: string;
    currentWorldLocation?: string;
    worldTime?: WorldTime;
    battleResult?: BattleResult | null;
    initSnapshot?: string;
  }>(),
  {
    storyText: "",
    phase: "idle",
    errorMessage: "",
    currentWorldLocation: "",
    worldTime: undefined,
    battleResult: undefined,
    initSnapshot: "",
  },
);

const { apiUrl, apiKey, apiModel } = useApiConfig();

const emit = defineEmits<{
  "update:worldLocation": [value: string];
  "update:worldTime": [value: WorldTime];
  "battleTrigger": [value: BattleTriggerEntry];
  "consumeBattleResult": [];
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
  if (stateResult.worldLocation.trim()) {
    emit("update:worldLocation", stateResult.worldLocation.trim());
  }

  const current = protagonist.value;
  if (current) {
    current.applyStateChanges(stateResult);

    if (stateResult.userState?.timeAdvance && props.worldTime) {
      const delta = stateResult.userState.timeAdvance;
      const newTime = advanceWorldTime(props.worldTime, delta);
      emit("update:worldTime", newTime);
      if (delta.years && delta.years > 0) {
        current.applyAutoGongfaMasteryExp(delta.years);
      }
      if (current.isShouyuanExhausted()) {
        gameLog.warn("[StoryChat] 寿元耗尽！");
      }
    }
  }

  if (stateResult.nearbyNpcs.length > 0) {
    npcStore.applyNpcUpdates(stateResult.nearbyNpcs, linggen);
  }

  if (stateResult.battleTrigger) {
    emit("battleTrigger", stateResult.battleTrigger);
  }
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
        currentWorldLocation: props.currentWorldLocation || undefined,
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
    victory: "胜利",
    defeat: "失败",
    fled: "撤退",
    draw: "平局",
  };
  const outcomeText = outcomeMap[r.outcome];
  const killed = r.enemiesKilled.length > 0
    ? `，击杀了${r.enemiesKilled.join("、")}` : "";
  const elixir = r.elixirsUsed.length > 0
    ? `，消耗了${r.elixirsUsed.map(e => `${e.name}×${e.count}`).join("、")}` : "";
  const kind = r.triggerKind === "active" ? "主动发起" : "被迫迎战";

  return [
    `[战斗结算]`,
    `${r.allyNames.join("、")}与${r.enemyNames.join("、")}发生了战斗（${kind}，原因：${r.triggerReason}）。`,
    `战斗结果：${outcomeText}，共${r.turn}回合。`,
    `主角HP剩余${r.protagonistHpPercent}%，MP剩余${r.protagonistMpPercent}%${killed}${elixir}。`,
    `请根据战斗结果继续生成后续剧情。`,
  ].join("\n");
}

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
          currentWorldLocation: props.currentWorldLocation || undefined,
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
      </div>
      <div class="main-panel__composer">
        <textarea
          ref="textareaRef"
          class="main-panel__input"
          :readonly="generating"
          :disabled="phase !== 'ready' && chatMessages.length === 0"
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
          :disabled="generating || !inputText.trim() || (phase !== 'ready' && chatMessages.length === 0)"
          @click="handleSend"
        >
          {{ generating ? "生成中…" : "发送" }}
        </button>
      </div>
    </div>
  </section>
</template>
