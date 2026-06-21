/**
 * @fileoverview 剧情/对话状态模块单例。
 *
 * 把原本散落在 `useOpeningStory`（开局）与 `StoryChatPanel`（每轮对话）的组件级 ref
 * 提升为模块级单例，对齐 `npcStore` / `worldMapStore` 模式，使存档系统可统一序列化：
 *
 *   存档 = Protagonist.toData() + npcStore.serializeNpcs()
 *        + worldMapStore.serializeWorldMap() + storyStore.serializeStory()
 *
 * `useOpeningStory` 写入本 store；`MainScreen` / `StoryChatPanel` 读取本 store。
 */

import { ref } from "vue";
import type { OpeningStoryPhase } from "../ai/useOpeningStory";
import type { ActionSuggestions } from "../ai/state_generate";
import type { WorldLocation } from "./types/worldLocation";
import type { WorldTime } from "./worldTime";
import { cloneWorldTime, createDefaultWorldTime } from "./worldTime";

/** 单条聊天消息。story 消息可携带 AI 生成的快照（compact summary），用于后续上下文。 */
export interface ChatMessage {
  type: "story" | "user";
  content: string;
  snapshot?: string;
}

/** 可序列化的剧情快照（存档载荷的 story 分量）。 */
export interface StorySerialData {
  storyBody: string;
  /** 存档恢复后恒为 "ready"；保存时原样记录。 */
  phase: OpeningStoryPhase;
  worldTime: WorldTime;
  worldTimeBaseline: WorldTime;
  worldLocation: WorldLocation | null;
  initSnapshot: string;
  actionOptions: ActionSuggestions | null;
  chatMessages: ChatMessage[];
}

const storyBody = ref("");
const phase = ref<OpeningStoryPhase>("idle");
const worldTime = ref<WorldTime>(createDefaultWorldTime());
const worldTimeBaseline = ref<WorldTime>(cloneWorldTime(worldTime.value));
const worldLocation = ref<WorldLocation | null>(null);
const initSnapshot = ref("");
const actionOptions = ref<ActionSuggestions | null>(null);
const chatMessages = ref<ChatMessage[]>([]);

/**
 * 读档会话标志：true 表示当前 MainScreen 是从存档恢复挂载的，
 * `useOpeningStory` 据此跳过「清空主角/剧情」与「重跑开局 AI」。
 * 仅会话内有效，不持久化。
 */
const restored = ref(false);

/** 重置全部剧情/对话状态到初始值（开新档、读档前清场用）。 */
function clearStory(): void {
  storyBody.value = "";
  phase.value = "idle";
  const w = createDefaultWorldTime();
  worldTime.value = w;
  worldTimeBaseline.value = cloneWorldTime(w);
  worldLocation.value = null;
  initSnapshot.value = "";
  actionOptions.value = null;
  chatMessages.value = [];
  restored.value = false;
}

/** 序列化当前剧情状态为纯 JSON（深拷贝，断开与响应式引用的联系）。 */
function serializeStory(): StorySerialData {
  return {
    storyBody: storyBody.value,
    phase: phase.value,
    worldTime: cloneWorldTime(worldTime.value),
    worldTimeBaseline: cloneWorldTime(worldTimeBaseline.value),
    worldLocation: worldLocation.value ? { ...worldLocation.value } : null,
    initSnapshot: initSnapshot.value,
    actionOptions: actionOptions.value,
    chatMessages: chatMessages.value.map((m) => ({ ...m })),
  };
}

/** 从存档数据恢复剧情状态，并置 restored=true（读档会话）。 */
function restoreStory(data: StorySerialData | null | undefined): void {
  const d = data ?? ({} as Partial<StorySerialData>);
  storyBody.value = d.storyBody || "";
  // 读档总是在「就绪」状态恢复——不存档生成中途。
  phase.value = "ready";
  worldTime.value = d.worldTime ? cloneWorldTime(d.worldTime) : createDefaultWorldTime();
  worldTimeBaseline.value = d.worldTimeBaseline
    ? cloneWorldTime(d.worldTimeBaseline)
    : createDefaultWorldTime();
  worldLocation.value = d.worldLocation ? { ...d.worldLocation } : null;
  initSnapshot.value = d.initSnapshot || "";
  actionOptions.value = d.actionOptions ?? null;
  chatMessages.value = (d.chatMessages ?? []).map((m) => ({ ...m }));
  restored.value = true;
}

export const storyStore = {
  storyBody,
  phase,
  worldTime,
  worldTimeBaseline,
  worldLocation,
  initSnapshot,
  actionOptions,
  chatMessages,
  restored,
  clearStory,
  serializeStory,
  restoreStory,
};
