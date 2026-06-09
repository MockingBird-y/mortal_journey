import { STORY_SYSTEM_PRESET } from "./story_preset";
import { PRESET } from "./preset";
import { completeChatWithMessagesJson, type JsonChatRequestPayload, type ChatMessage } from "./openAiChatBridge";
import { Protagonist } from "../role_core/Protagonist";
import type { ProtagonistPlayInfo, NarrationPerson, EquippedSlotsState, GongfaSlotsState, InventoryStackItem, TraitEntry } from "../role_core/types/playInfo";
import { formatWorldLocationDash } from "../role_core/types/worldLocation";

export interface StoryChatEntry {
  role: "user" | "assistant";
  content: string;
}

export interface StoryGenerateInput {
  apiUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
  protagonist: ProtagonistPlayInfo;
  chatHistory: StoryChatEntry[];
}

export interface StoryParsed {
  storyBody: string;
}

const DEFAULT_TEMPERATURE = 0.55;
const DEFAULT_MAX_TOKENS = 65535;

const MJ_STORY_BODY_OPEN = "<mj_story_body>";
const MJ_STORY_BODY_CLOSE = "</mj_story_body>";

export function extractStoryBody(raw: string): string {
  const s = raw == null ? "" : String(raw);
  const i = s.indexOf(MJ_STORY_BODY_OPEN);
  if (i < 0) return s.trim();
  const from = i + MJ_STORY_BODY_OPEN.length;
  const j = s.indexOf(MJ_STORY_BODY_CLOSE, from);
  if (j < 0) return s.slice(from).trim();
  return s.slice(from, j).trim();
}

function narrationPersonLine(person: NarrationPerson): string {
  switch (person) {
    case "first":
      return "叙事人称：第一人称——以主角口吻，用「我」「我们」等叙述。";
    case "third":
      return "叙事人称：第三人称——以旁观视角写主角，用「他/她」或其姓名指代主角。";
    case "second":
    default:
      return "叙事人称：第二人称——面向玩家，将主角作为「你」「您」书写。";
  }
}

function formatEquipSlot(label: string, slot: EquippedSlotsState[number]): string {
  if (!slot) return `${label}：无`;
  return `${label}：${slot.name}（${slot.grade}）${slot.desc ? "—" + slot.desc : ""}`;
}

function formatEquippedSlots(slots: EquippedSlotsState): string {
  const lines: string[] = [];
  for (let i = 0; i < slots.length; i++) {
    lines.push(formatEquipSlot(`法宝${i + 1}`, slots[i]));
  }
  return lines.join("\n");
}

function formatGongfaSlots(slots: GongfaSlotsState): string {
  const lines: string[] = [];
  for (let i = 0; i < slots.length; i++) {
    const g = slots[i];
    if (!g) continue;
    lines.push(`功法：${g.name}（${g.grade}）${g.desc ? "—" + g.desc : ""}`);
  }
  return lines.length > 0 ? lines.join("\n") : "无";
}

function formatInventoryItem(item: InventoryStackItem): string {
  if ("type" in item && item.type === "灵石") {
    return `${item.name}×${item.count}`;
  }
  const d = item as { name?: string; grade?: string; count?: number; desc?: string };
  const grade = d.grade ? `（${d.grade}）` : "";
  return `${d.name || "未知物品"}${grade}×${d.count || 1}`;
}

function formatInventorySlots(slots: Array<InventoryStackItem | null>): string {
  const items = slots.filter((s): s is InventoryStackItem => s !== null);
  if (items.length === 0) return "无";
  return items.map(formatInventoryItem).join("、");
}

function formatTrait(t: TraitEntry): string {
  if (typeof t === "string") return t;
  const d = t.desc?.trim();
  return d ? `${t.name}：${d}` : t.name;
}

function buildStoryUserContent(p: ProtagonistPlayInfo): string {
  const traits = p.traits.length > 0
    ? p.traits.map(formatTrait).join("\n")
    : "无";
  const origin = p.originStory?.trim() || "—";
  const birthPlace = p.birthPlace ? formatWorldLocationDash(p.birthPlace) : "—";

  return [
    "【主角摘要 · 请据此与历史剧情继续生成后续剧情】",
    "",
    `姓名：${p.displayName}`,
    `性别：${p.gender || "—"}`,
    narrationPersonLine(p.narrationPerson),
    `境界：${Protagonist.formatRealm(p.realm)}${p.realmComplete ? "·圆满" : ""}`,
    `修为状态：${p.realmComplete ? "修为已圆满，可突破" : "修为未圆满"}`,
    `灵根：${Protagonist.formatLinggenElements(p.linggen)}`,
    `年龄：${p.age}`,
    `寿元：${p.shouyuan}`,
    `当前血量：${p.currentHp}/${p.maxHp}`,
    `当前法力：${p.currentMp}/${p.maxMp}`,
    "",
    "【出身背景】",
    `出身地点：${birthPlace}`,
    origin,
    "",
    "【天赋】",
    traits,
    "",
    "【装备】",
    formatEquippedSlots(p.equippedSlots),
    "",
    "【功法】",
    formatGongfaSlots(p.gongfaSlots),
    "",
    "【储物袋】",
    formatInventorySlots(p.inventorySlots),
    "",
  ].join("\n");
}

export function buildStoryRequestPayload(input: StoryGenerateInput): JsonChatRequestPayload {
  const messages: ChatMessage[] = [];

  const storyParts: string[] = [];
  let lastUserContent: string | undefined;
  for (const entry of input.chatHistory) {
    if (entry.role === "assistant") {
      storyParts.push(entry.content);
    } else {
      lastUserContent = entry.content;
    }
  }

  const systemParts = [PRESET, STORY_SYSTEM_PRESET];
  if (storyParts.length > 0) {
    systemParts.push("【之前的剧情】\n" + storyParts.join("\n\n---\n\n"));
  }
  messages.push({ role: "system", content: systemParts.join("\n\n") });

  messages.push({
    role: "user",
    content: buildStoryUserContent(input.protagonist),
  });

  if (lastUserContent != null) {
    messages.push({ role: "user", content: `[格式提醒：请严格将思考过程包裹在<thinking>...</thinking>标签内，正文包裹在 <mj_story_body>...</mj_story_body> 标签内。]\n\n${lastUserContent}` });
  }

  return {
    apiUrl: input.apiUrl,
    apiKey: input.apiKey,
    model: input.model,
    messages,
    temperature: input.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: input.max_tokens ?? DEFAULT_MAX_TOKENS,
    requestTimeoutMs: input.requestTimeoutMs,
    signal: input.signal,
  };
}

export async function generateStory(input: StoryGenerateInput): Promise<StoryParsed> {
  const raw = await completeChatWithMessagesJson(buildStoryRequestPayload(input));
  return { storyBody: extractStoryBody(raw) };
}
