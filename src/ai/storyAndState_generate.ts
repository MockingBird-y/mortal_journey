import { STORY_AND_STATE_SYSTEM_PRESET } from "./storyAndState";
import { extractTagContent, tryParseJsonArray } from "./parseAiItem";
import {
  completeChatWithMessagesJson,
  type JsonChatRequestPayload,
  type ChatMessage,
} from "./openAiChatBridge";
import { Protagonist } from "../role_core/Protagonist";
import type {
  NarrationPerson,
  ProtagonistPlayInfo,
  EquippedSlotsState,
  GongfaSlotsState,
  InventoryStackItem,
} from "../role_core/types/playInfo";

export interface StoryAndStateApiConfig {
  apiUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
}

export interface StoryChatEntry {
  role: "user" | "assistant";
  content: string;
}

export interface StoryAndStateInput extends StoryAndStateApiConfig {
  protagonist: ProtagonistPlayInfo;
  chatHistory: StoryChatEntry[];
  currentWorldLocation?: string;
  npcSnapshot?: string;
}

export interface StoryParsed {
  storyBody: string;
  worldLocation: string;
}

export interface UserStateChange {
  currentHp: number;
  currentMp: number;
}

export interface SpiritStoneChange {
  op: "add" | "remove";
  name: string;
  count: number;
}

export interface ItemAddEntry {
  type: string;
  name: string;
  intro: string;
  grade: string;
  bonus?: string[] | Record<string, number>;
  count: number;
  function?: unknown;
}

export interface ItemRemoveEntry {
  name: string;
  count: number;
}

export interface NpcNearbyEntry {
  displayName: string;
  identity: string;
  isDead: boolean;
  favorability: number;
  currentStageGoal: string;
  longTermGoal: string;
  hobby: string;
  fear: string;
  personality: string;
  gender: string;
  age: number;
  linggen: string[];
  realm: { major: string; minor: string };
  currentHp: number;
  currentMp: number;
  maxHp: number;
  maxMp: number;
  equippedSlots?: unknown[];
  gongfaSlots?: unknown[];
  inventorySlots?: unknown[];
  [key: string]: unknown;
}

export interface StateParsed {
  userState: UserStateChange | null;
  spiritStoneChanges: SpiritStoneChange[];
  itemAdds: ItemAddEntry[];
  itemRemoves: ItemRemoveEntry[];
  nearbyNpcs: NpcNearbyEntry[];
}

export interface StoryAndStateParsed {
  story: StoryParsed;
  state: StateParsed;
}

const DEFAULT_TEMPERATURE = 0.55;
const DEFAULT_MAX_TOKENS = 16384;

const MJ_STORY_BODY_OPEN = "<mj_story_body>";
const MJ_STORY_BODY_CLOSE = "</mj_story_body>";
const MJ_WORLD_BODY_OPEN = "<mj_world_body>";
const MJ_WORLD_BODY_CLOSE = "</mj_world_body>";

const TAG_USER_STATE_OPEN = "<USER_STATE_TAG>";
const TAG_USER_STATE_CLOSE = "</USER_STATE_TAG>";
const TAG_SPIRIT_STONE_OPEN = "<SPIRIT_STONE_TAG>";
const TAG_SPIRIT_STONE_CLOSE = "</SPIRIT_STONE_TAG>";
const TAG_ITEM_ADD_OPEN = "<ITEM_ADD_TAG>";
const TAG_ITEM_ADD_CLOSE = "</ITEM_ADD_TAG>";
const TAG_ITEM_REMOVE_OPEN = "<ITEM_REMOVE_TAG>";
const TAG_ITEM_REMOVE_CLOSE = "</ITEM_REMOVE_TAG>";
const TAG_NPC_NEARBY_OPEN = "<NPC_NEARBY_TAG>";
const TAG_NPC_NEARBY_CLOSE = "</NPC_NEARBY_TAG>";

export function extractMjWorldBody(raw: string): string {
  const s = raw == null ? "" : String(raw);
  const i = s.indexOf(MJ_WORLD_BODY_OPEN);
  if (i < 0) return "";
  const from = i + MJ_WORLD_BODY_OPEN.length;
  const j = s.indexOf(MJ_WORLD_BODY_CLOSE, from);
  if (j < 0) return s.slice(from).trim();
  return s.slice(from, j).trim();
}

export function extractMjStoryBody(raw: string): string {
  const s = raw == null ? "" : String(raw);
  const i = s.indexOf(MJ_STORY_BODY_OPEN);
  if (i < 0) return s.trim();
  const from = i + MJ_STORY_BODY_OPEN.length;
  const j = s.indexOf(MJ_STORY_BODY_CLOSE, from);
  if (j < 0) return s.slice(from).trim();
  return s.slice(from, j).trim();
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseNearbyNpcs(raw: string): NpcNearbyEntry[] {
  const text = extractTagContent(raw, TAG_NPC_NEARBY_OPEN, TAG_NPC_NEARBY_CLOSE);
  const arr = tryParseJsonArray(text) ?? [];
  return arr
    .map((e: unknown): NpcNearbyEntry | null => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const displayName = String(o.displayName || "").trim();
      if (!displayName) return null;
      const realm = o.realm && typeof o.realm === "object"
        ? o.realm as { major: string; minor: string }
        : { major: "练气", minor: "初期" };
      const linggenRaw = o.linggen;
      const linggen = Array.isArray(linggenRaw)
        ? linggenRaw.map((x: unknown) => String(x).trim()).filter(Boolean)
        : typeof linggenRaw === "string"
          ? linggenRaw.split("").filter((c: string) => "金木水火土".includes(c))
          : [];
      const parsed: NpcNearbyEntry = {
        displayName,
        identity: String(o.identity || ""),
        isDead: o.isDead === true,
        favorability: typeof o.favorability === "number" ? o.favorability : 0,
        currentStageGoal: String(o.currentStageGoal || ""),
        longTermGoal: String(o.longTermGoal || ""),
        hobby: String(o.hobby || ""),
        fear: String(o.fear || ""),
        personality: String(o.personality || ""),
        gender: String(o.gender || "男"),
        age: typeof o.age === "number" ? o.age : 0,
        linggen,
        realm,
        currentHp: typeof o.currentHp === "number" ? o.currentHp : 100,
        currentMp: typeof o.currentMp === "number" ? o.currentMp : 50,
        maxHp: typeof o.maxHp === "number" ? o.maxHp : 100,
        maxMp: typeof o.maxMp === "number" ? o.maxMp : 50,
      };
      return parsed;
    })
    .filter((e): e is NpcNearbyEntry => e !== null);
}

export function parseStoryAndStateAiResponse(raw: string): StoryAndStateParsed {
  const storyBody = extractMjStoryBody(raw);
  const worldLocation = extractMjWorldBody(raw);

  const userStateText = extractTagContent(raw, TAG_USER_STATE_OPEN, TAG_USER_STATE_CLOSE);
  const spiritStoneText = extractTagContent(raw, TAG_SPIRIT_STONE_OPEN, TAG_SPIRIT_STONE_CLOSE);
  const itemAddText = extractTagContent(raw, TAG_ITEM_ADD_OPEN, TAG_ITEM_ADD_CLOSE);
  const itemRemoveText = extractTagContent(raw, TAG_ITEM_REMOVE_OPEN, TAG_ITEM_REMOVE_CLOSE);

  let userState: UserStateChange | null = null;
  if (userStateText) {
    const obj = safeJsonParse(userStateText);
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      const hp = typeof o.currentHp === "number" ? Math.round(o.currentHp) : 0;
      const mp = typeof o.currentMp === "number" ? Math.round(o.currentMp) : 0;
      userState = { currentHp: hp, currentMp: mp };
    }
  }

  const stoneArr = tryParseJsonArray(spiritStoneText) ?? [];
  const spiritStoneChanges: SpiritStoneChange[] = stoneArr
    .map((e: unknown) => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const op = String(o.op || "").trim();
      if (op !== "add" && op !== "remove") return null;
      const name = String(o.name || "").trim();
      const count = typeof o.count === "number" ? Math.max(1, Math.floor(o.count)) : 1;
      if (!name) return null;
      return { op, name, count } as SpiritStoneChange;
    })
    .filter((c): c is SpiritStoneChange => c !== null);

  const addArr = tryParseJsonArray(itemAddText) ?? [];
  const itemAdds: ItemAddEntry[] = addArr
    .map((e: unknown) => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const type = String(o.type || "").trim();
      const name = String(o.name || "").trim();
      const intro = String(o.intro || "").trim();
      const grade = String(o.grade || "下品").trim();
      const count = typeof o.count === "number" ? Math.max(1, Math.floor(o.count)) : 1;
      if (!name) return null;
      const bonus = Array.isArray(o.bonus) || (typeof o.bonus === "object" && o.bonus !== null)
        ? o.bonus as string[] | Record<string, number>
        : undefined;
      return {
        type,
        name,
        intro,
        grade,
        bonus,
        count,
        ...(o.function != null ? { function: o.function } : {}),
      } as ItemAddEntry;
    })
    .filter((e): e is ItemAddEntry => e !== null);

  const removeArr = tryParseJsonArray(itemRemoveText) ?? [];
  const itemRemoves: ItemRemoveEntry[] = removeArr
    .map((e: unknown) => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const name = String(o.name || "").trim();
      const count = typeof o.count === "number" ? Math.max(1, Math.floor(o.count)) : 1;
      if (!name) return null;
      return { name, count } as ItemRemoveEntry;
    })
    .filter((e): e is ItemRemoveEntry => e !== null);

  const nearbyNpcs = parseNearbyNpcs(raw);

  return {
    story: { storyBody, worldLocation },
    state: { userState, spiritStoneChanges, itemAdds, itemRemoves, nearbyNpcs },
  };
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
  const bonusStr = slot.bonus && Object.keys(slot.bonus).length > 0
    ? "，加成：" + Object.entries(slot.bonus).map(([k, v]) => `${k}+${v}`).join("、")
    : "";
  return `${label}：${slot.name}（${slot.grade}）${slot.desc ? "—" + slot.desc : ""}${bonusStr}`;
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
    const bonusStr = g.bonus && Object.keys(g.bonus).length > 0
      ? "，加成：" + Object.entries(g.bonus).map(([k, v]) => `${k}+${v}`).join("、")
      : "";
    lines.push(`功法：${g.name}（${g.grade}）${g.desc ? "—" + g.desc : ""}${bonusStr}`);
  }
  return lines.length > 0 ? lines.join("\n") : "无";
}

function formatInventoryItem(item: InventoryStackItem): string {
  if ("type" in item && item.type === "灵石") {
    return `${item.name}×${item.count}`;
  }
  const d = item as { name?: string; grade?: string; count?: number; desc?: string };
  const grade = d.grade ? `（${d.grade}）` : "";
  const desc = d.desc ? `—${d.desc}` : "";
  return `${d.name || "未知物品"}${grade}×${d.count || 1}${desc}`;
}

function formatInventorySlots(slots: Array<InventoryStackItem | null>): string {
  const items = slots.filter((s): s is InventoryStackItem => s !== null);
  if (items.length === 0) return "无";
  return items.map(formatInventoryItem).join("、");
}

function buildStoryAndStateUserContent(input: StoryAndStateInput): string {
  const p = input.protagonist;
  const locationHint = input.currentWorldLocation?.trim()
    ? `\n当前所在地点：${input.currentWorldLocation.trim()}`
    : "";

  const npcSection = input.npcSnapshot?.trim()
    ? `\n【当前场景人物】\n${input.npcSnapshot.trim()}\n`
    : "";

  return [
    "【主角摘要 · 请据此与历史剧情继续生成后续剧情，并输出状态更新标签】",
    "",
    `姓名：${p.displayName}`,
    `性别：${p.gender || "—"}`,
    narrationPersonLine(p.narrationPerson),
    `境界：${Protagonist.formatRealm(p.realm)}`,
    `灵根：${Protagonist.formatLinggenElements(p.linggen)}`,
    `当前血量：${p.currentHp}/${p.maxHp}`,
    `当前法力：${p.currentMp}/${p.maxMp}`,
    locationHint,
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
    npcSection,
  ].join("\n");
}

export function buildStoryAndStateRequestPayload(input: StoryAndStateInput): JsonChatRequestPayload {
  const messages: ChatMessage[] = [];

  messages.push({ role: "system", content: STORY_AND_STATE_SYSTEM_PRESET });

  messages.push({
    role: "user",
    content: buildStoryAndStateUserContent(input),
  });

  for (const entry of input.chatHistory) {
    messages.push({ role: entry.role, content: entry.content });
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

export async function generateStoryAndState(input: StoryAndStateInput): Promise<StoryAndStateParsed> {
  const raw = await completeChatWithMessagesJson(buildStoryAndStateRequestPayload(input));
  return parseStoryAndStateAiResponse(raw);
}
