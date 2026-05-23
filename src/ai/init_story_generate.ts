/**
 * 开局首段剧情 + 初始状态合并生成：
 * 将 `init_preset` 的 system 与主角档案整理为 user，组装 `JsonChatRequestPayload` 并调用桥接层。
 * AI 单次返回全部 5 个标签（世界、正文、法宝、功法、储物袋），本模块统一解析。
 * 解析后直接产出 `itemInfo` 领域类型（TreasureItemDefinition / GongfaItemDefinition / InventoryStackItem …）。
 */

import { INIT_STORY_SYSTEM_PRESET } from "./init_preset";
import { completeChatWithMessagesJson, type JsonChatRequestPayload } from "./openAiChatBridge";
import { Protagonist } from "../role_core/Protagonist";
import { EQUIP_SLOT_COUNT } from "../role_core/types/playInfo";
import type { TreasureItemDefinition, GongfaItemDefinition, InventoryStackItem, ProtagonistPlayInfo, GongfaSlotsState, EquippedSlotsState, NarrationPerson, TraitEntry } from "../role_core/types/playInfo";
import type { SpiritStoneName } from "../role_core/types/spiritStone";
import type { NpcNearbyEntry } from "./storyAndState_generate";
import {
  safeStr,
  safeCount,
  rollGrade,
  parseLingQi,
  parseBonusField,
  parseTreasureBonusField,
  validateAiFunction,
  parseEquipObject,
  parseGongfaObject,
  parseStorageObject,
  TYPE_TO_ITEM_TYPE,
  VALID_BONUS_NAMES,
  GRADE_KEYS,
  spiritStoneAllowedUpTo,
  extractTagContent,
  tryParseJsonArray,
  TREASURE_TRIGGER_FALLBACK,
  GONGFA_TRIGGER_FALLBACK,
  effectKeysForType,
  costKeysForType,
  effectKeyToCategoryForType,
  triggerKeysForType,
  sanitizeJsonLike,
  VALID_LING_QI,
  VALID_DERIVED_BONUS_NAMES,
  VALID_DERIVED_BONUS_NAMES_ARR,
} from "./parseAiItem";
import { SPIRIT_STONE_TABLE_KEYS_ORDERED } from "../role_core/types/spiritStone";

/** 调用网关所需字段 + 生成参数 */
export interface InitStoryApiConfig {
  apiUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
}

export interface InitStoryGenerateInput extends InitStoryApiConfig {
  protagonist: ProtagonistPlayInfo;
  userStoryHint?: string;
}

const DEFAULT_INIT_STORY_TEMPERATURE = 0.55;
const DEFAULT_INIT_STORY_MAX_TOKENS = 16384;

// ── 标签常量 ──────────────────────────────────────────────────────────────

const MJ_STORY_BODY_OPEN = "<mj_story_body>";
const MJ_STORY_BODY_CLOSE = "</mj_story_body>";

const MJ_WORLD_BODY_OPEN = "<mj_world_body>";
const MJ_WORLD_BODY_CLOSE = "</mj_world_body>";

const MJ_EQUIP_BODY_OPEN = "<mj_equip_body>";
const MJ_EQUIP_BODY_CLOSE = "</mj_equip_body>";

const MJ_MAGIC_BODY_OPEN = "<mj_magic_body>";
const MJ_MAGIC_BODY_CLOSE = "</mj_magic_body>";

const MJ_STORAGE_BODY_OPEN = "<mj_storage_body>";
const MJ_STORAGE_BODY_CLOSE = "</mj_storage_body>";

const NPC_NEARBY_OPEN = "<NPC_NEARBY_TAG>";
const NPC_NEARBY_CLOSE = "</NPC_NEARBY_TAG>";

// ── 解析结果 ──────────────────────────────────────────────────────────────

export interface InitStoryParsed {
  storyBody: string;
  worldLocation: string;
}

export interface InitStateParsed {
  equips: TreasureItemDefinition[];
  gongfas: GongfaItemDefinition[];
  storage: InventoryStackItem[];
}

export interface InitStoryFullResult {
  story: InitStoryParsed;
  state: InitStateParsed;
  nearbyNpcs: NpcNearbyEntry[];
}

// ── 解析 ──────────────────────────────────────────────────────────────────

export function extractMjWorldBody(raw: string): string {
  return extractTagContent(raw, MJ_WORLD_BODY_OPEN, MJ_WORLD_BODY_CLOSE);
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

export function parseInitStoryAiResponse(raw: string): InitStoryParsed {
  return {
    storyBody: extractMjStoryBody(raw),
    worldLocation: extractMjWorldBody(raw),
  };
}

export function parseInitStateAiResponse(raw: string, realmMajor: string, realmMinor: string, playerLinggen?: readonly string[] | null): InitStateParsed {
  const equipText = extractTagContent(raw, MJ_EQUIP_BODY_OPEN, MJ_EQUIP_BODY_CLOSE);
  const magicText = extractTagContent(raw, MJ_MAGIC_BODY_OPEN, MJ_MAGIC_BODY_CLOSE);
  const storageText = extractTagContent(raw, MJ_STORAGE_BODY_OPEN, MJ_STORAGE_BODY_CLOSE);

  const equipArr = tryParseJsonArray(equipText) ?? [];
  const magicArr = tryParseJsonArray(magicText) ?? [];
  const storageArr = tryParseJsonArray(storageText) ?? [];

  const equips: TreasureItemDefinition[] = equipArr.map((e: unknown) => parseEquipObject(e, realmMajor, realmMinor));

  const gongfas: GongfaItemDefinition[] = magicArr.map((e: unknown) => parseGongfaObject(e, realmMajor, realmMinor, playerLinggen));

  const storage: InventoryStackItem[] = storageArr
    .map((e: unknown) => parseStorageObject(e, realmMajor, realmMinor, playerLinggen))
    .filter((item): item is InventoryStackItem => item !== null);

  return { equips, gongfas, storage };
}

function parseInitNearbyNpcs(raw: string): NpcNearbyEntry[] {
  const text = extractTagContent(raw, NPC_NEARBY_OPEN, NPC_NEARBY_CLOSE);
  const arr = tryParseJsonArray(text) ?? [];
  return arr
    .map((e: unknown): NpcNearbyEntry | null => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const displayName = typeof o.displayName === "string" ? o.displayName.trim() : "";
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
      return {
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
        equippedSlots: Array.isArray(o.equippedSlots) ? o.equippedSlots : undefined,
        gongfaSlots: Array.isArray(o.gongfaSlots) ? o.gongfaSlots : undefined,
        inventorySlots: Array.isArray(o.inventorySlots) ? o.inventorySlots : undefined,
      } as NpcNearbyEntry;
    })
    .filter((e): e is NpcNearbyEntry => e !== null);
}

/** 解析 AI 完整返回：剧情 + 世界地点 + 开局状态 + NPC */
export function parseInitStoryFull(raw: string, realmMajor: string, realmMinor: string, playerLinggen?: readonly string[] | null): InitStoryFullResult {
  return {
    story: parseInitStoryAiResponse(raw),
    state: parseInitStateAiResponse(raw, realmMajor, realmMinor, playerLinggen),
    nearbyNpcs: parseInitNearbyNpcs(raw),
  };
}

// ── 状态构建 ──────────────────────────────────────────────────────────────

export function buildEquippedSlotsFromParsed(parsed: InitStateParsed): EquippedSlotsState {
  const slots: EquippedSlotsState = Array.from({ length: EQUIP_SLOT_COUNT }, () => null);
  for (const item of parsed.equips) {
    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx >= 0) slots[emptyIdx] = item;
  }
  return slots;
}

export function buildGongfaSlotsFromParsed(parsed: InitStateParsed): GongfaSlotsState {
  const slots: GongfaSlotsState = [null, null, null, null, null, null, null, null];
  for (const item of parsed.gongfas) {
    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx >= 0) slots[emptyIdx] = item;
  }
  return slots;
}

export function buildInventoryFromParsed(parsed: InitStateParsed, realmMajor: string, slotCount: number): Array<InventoryStackItem | null> {
  const maxStone = spiritStoneAllowedUpTo(realmMajor);
  const maxIdx = SPIRIT_STONE_TABLE_KEYS_ORDERED.indexOf(maxStone);
  const items: InventoryStackItem[] = [];
  for (const item of parsed.storage) {
    if ("type" in item && item.type === "灵石") {
      const stoneIdx = SPIRIT_STONE_TABLE_KEYS_ORDERED.indexOf(item.name as SpiritStoneName);
      if (stoneIdx >= 0 && stoneIdx <= maxIdx) {
        items.push(item);
      }
    } else {
      items.push(item);
    }
  }
  const rest = Math.max(0, slotCount - items.length);
  return [...items, ...Array.from({ length: rest }, () => null)];
}

// ── user 内容 ─────────────────────────────────────────────────────────────

function narrationPersonLine(person: NarrationPerson): string {
  switch (person) {
    case "first":
      return "叙事人称：第一人称——以主角口吻，用「我」「我们」等叙述，不得全程改用第二人称「你」。";
    case "third":
      return "叙事人称：第三人称——以旁观视角写主角，用「他/她」或其姓名指代主角，不要用「你」指玩家。";
    case "second":
    default:
      return "叙事人称：第二人称——面向玩家，将主角作为「你」「您」书写，不要用「我」代主角。";
  }
}

function formatTraitLine(t: TraitEntry): string {
  if (typeof t === "string") return t.trim() || "（未命名天赋）";
  const name = t.name?.trim() || "—";
  const d = t.desc?.trim();
  return d ? `${name}：${d}` : name;
}

export function buildInitStoryUserContent(protagonist: ProtagonistPlayInfo, userStoryHint?: string): string {
  const p = protagonist;
  const place = p.birthPlace?.trim() || "—";
  const origin = p.originStory?.trim() || "—";
  const hint =
    userStoryHint != null && String(userStoryHint).trim() !== ""
      ? `\n【玩家对开局的补充说明】\n${String(userStoryHint).trim()}\n`
      : "";
  return [
    "【开局摘要 · 请据此撰写首段剧情】",
    "",
    `姓名：${p.displayName}`,
    `性别：${p.gender || "—"}`,
    narrationPersonLine(p.narrationPerson),
    `境界：${Protagonist.formatRealm(p.realm)}`,
    `灵根：${Protagonist.formatLinggenElements(p.linggen)}`,
    `出身地点：${place}`,
    "",
    "【出身情况】",
    origin,
    "",
    hint,
    "",
  ].join("\n");
}

// ── 请求组装 ──────────────────────────────────────────────────────────────

export function buildInitStoryRequestPayload(input: InitStoryGenerateInput): JsonChatRequestPayload {
  const userContent = buildInitStoryUserContent(input.protagonist, input.userStoryHint);
  return {
    apiUrl: input.apiUrl,
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      { role: "system", content: INIT_STORY_SYSTEM_PRESET },
      { role: "user", content: userContent },
    ],
    temperature: DEFAULT_INIT_STORY_TEMPERATURE,
    max_tokens: DEFAULT_INIT_STORY_MAX_TOKENS,
    requestTimeoutMs: input.requestTimeoutMs,
    signal: input.signal,
  };
}

// ── 调用 ──────────────────────────────────────────────────────────────────

/** 请求 AI 生成开局剧情 + 初始状态，返回完整解析结果 */
export async function generateInitStory(input: InitStoryGenerateInput): Promise<InitStoryFullResult> {
  const raw = await completeChatWithMessagesJson(buildInitStoryRequestPayload(input));
  const r = input.protagonist.realm;
  return parseInitStoryFull(raw, r.major, r.minor, input.protagonist.linggen);
}
