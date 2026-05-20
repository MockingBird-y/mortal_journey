/**
 * 开局首段剧情 + 初始状态合并生成：
 * 将 `init_preset` 的 system 与主角档案整理为 user，组装 `JsonChatRequestPayload` 并调用桥接层。
 * AI 单次返回全部 5 个标签（世界、正文、法宝、功法、储物袋），本模块统一解析。
 * 解析后直接产出 `itemInfo` 领域类型（TreasureItemDefinition / GongfaItemDefinition / InventoryStackItem …）。
 */

import { INIT_STORY_SYSTEM_PRESET } from "./init_preset";
import { completeChatWithMessagesJson, type JsonChatRequestPayload } from "./openAiChatBridge";
import { Protagonist } from "../role_core/Protagonist";
import { EQUIP_SLOT_COUNT, LINGQI_AFFINITY_BONUS } from "../role_core/types/playInfo";
import {
  createSpiritStoneInventoryStack,
  SPIRIT_STONE_TABLE_KEYS_ORDERED,
  type SpiritStoneName,
} from "../role_core/types/spiritStone";
import type {
  GongfaItemDefinition,
  ItemGrade,
  TreasureItemDefinition,
  TalismanItemDefinition,
  FormationItemDefinition,
  MaterialItemDefinition,
  MiscItemDefinition,
  CategorizedItemDefinition,
  GradeDropRate,
  LingQi,
} from "../role_core/types/itemInfo";
import { GRADE_DROP_TABLE } from "../role_core/types/itemInfo";
import type { InventoryStackItem, ProtagonistPlayInfo, GongfaSlotsState, EquippedSlotsState, NarrationPerson, TraitEntry } from "../role_core/types/playInfo";
import {
  TRIGGER_TIMING_KEYS,
  EFFECT_KEYS,
  COST_RESOURCE_KEYS,
  type TriggerTiming,
  type EffectKey,
  type CostResourceKey,
  type SpecialEffect,
  type EffectValueCategory,
  type SpecialEffectTarget,
  applyFunctionOverrides,
  computeEffectValue,
  computeCostValue,
  effectKeyToCategory,
  firstEffectKeyOfCategory,
  TREASURE_ALLOWED_TRIGGERS,
  GONGFA_ALLOWED_TRIGGERS,
  ITEM_TYPE_ALLOWED_EFFECTS,
} from "../role_core/types/special_effects";

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

// ── 工具函数 ──────────────────────────────────────────────────────────────

const VALID_BONUS_NAMES: ReadonlySet<string> = new Set(["体魄", "灵力", "护体", "神识", "身法", "会心"]);
const DEFAULT_BONUS_VALUE = 5;

const VALID_LING_QI: ReadonlySet<string> = new Set(["无", "金", "木", "水", "火", "土"]);

function parseLingQi(raw: unknown): LingQi {
  if (typeof raw !== "string") return "无";
  const v = raw.trim();
  return (VALID_LING_QI.has(v) ? v : "无") as LingQi;
}

/**
 * 将 AI 输出的 bonus 字段解析为属性加成对象。
 * AI 输出为字符串（如 `"会心"`），转为 `{ "会心": 5 }`。
 * 非 string 或不在六项之列时返回空对象。
 */
function parseBonusField(raw: unknown): Record<string, number> {
  if (typeof raw !== "string") return {};
  const name = raw.trim();
  if (!VALID_BONUS_NAMES.has(name)) return {};
  return { [name]: DEFAULT_BONUS_VALUE };
}

function extractTagContent(raw: string, openTag: string, closeTag: string): string {
  const i = raw.indexOf(openTag);
  if (i < 0) return "";
  const from = i + openTag.length;
  const j = raw.indexOf(closeTag, from);
  if (j < 0) return raw.slice(from).trim();
  return raw.slice(from, j).trim();
}

function sanitizeJsonLike(text: string): string {
  let s = text;
  s = s.replace(/\{"([^"]*)"\s*(?:,\s*"[^"]*")*\}/g, (m) => {
    const items: string[] = [];
    const re = /"([^"]*)"/g;
    let r: RegExpExecArray | null;
    while ((r = re.exec(m)) !== null) items.push('"' + r[1] + '"');
    return "[" + items.join(",") + "]";
  });
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

function tryParseJsonArray(text: string): unknown[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const tryParse = (src: string): unknown[] | null => {
    try {
      const parsed = JSON.parse(src);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  };
  let result = tryParse(trimmed);
  if (result) return result;
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) {
    const segment = trimmed.slice(start, end + 1);
    result = tryParse(segment);
    if (result) return result;
    result = tryParse(sanitizeJsonLike(segment));
    if (result) return result;
  }
  result = tryParse(sanitizeJsonLike(trimmed));
  if (result) return result;
  return null;
}

function safeStr(val: unknown, fallback: string): string {
  return typeof val === "string" && val.trim() ? val.trim() : fallback;
}

const GRADE_KEYS: readonly (keyof GradeDropRate)[] = ["下品", "中品", "上品", "极品", "仙品"];

/**
 * 根据主角境界从 `GRADE_DROP_TABLE` 按概率随机出一个品阶。
 * 查不到对应境界时 fallback 为 `"下品"`。
 */
function rollGrade(realmMajor: string, realmMinor: string): ItemGrade {
  const stage = GRADE_DROP_TABLE[realmMajor]?.[realmMinor];
  if (!stage) return "下品";
  const total = stage.下品 + stage.中品 + stage.上品 + stage.极品 + stage.仙品;
  if (total <= 0) return "下品";
  let roll = Math.random() * total;
  for (const key of GRADE_KEYS) {
    roll -= stage[key];
    if (roll <= 0) return key;
  }
  return "下品";
}

function safeCount(val: unknown): number {
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
}

function spiritStoneAllowedUpTo(realmMajor: string): SpiritStoneName {
  const mapping: Record<string, SpiritStoneName> = {
    "练气": "下品灵石",
    "筑基": "中品灵石",
    "结丹": "上品灵石",
    "元婴": "极品灵石",
    "化神": "仙品灵石",
  };
  return mapping[realmMajor] ?? "下品灵石";
}

/** 法宝 trigger 不合法时 fallback */
const TREASURE_TRIGGER_FALLBACK: TriggerTiming = "on_default";
/** 功法 trigger 不合法时 fallback */
const GONGFA_TRIGGER_FALLBACK: TriggerTiming = "on_attack";

/**
 * 校验并转换 AI 生成的 function 字段为 `SpecialEffect`。
 * 根据 itemType 校验 trigger 和 effect category，不合法时自动纠正。
 */
function validateAiFunction(raw: unknown, grade: string, itemType: string, affinityBonus?: number): SpecialEffect | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  let trigger = obj.trigger;
  if (typeof trigger !== "string" || !(TRIGGER_TIMING_KEYS as readonly string[]).includes(trigger)) {
    return null;
  }

  if (itemType === "法宝" && !TREASURE_ALLOWED_TRIGGERS.has(trigger)) {
    trigger = TREASURE_TRIGGER_FALLBACK;
  } else if (itemType === "功法" && !GONGFA_ALLOWED_TRIGGERS.has(trigger)) {
    trigger = GONGFA_TRIGGER_FALLBACK;
  }

  let effectLabel: EffectKey | null = null;
  const eff = obj.effect;
  if (typeof eff === "string") {
    if (!(EFFECT_KEYS as readonly string[]).includes(eff)) return null;
    effectLabel = eff as EffectKey;
  } else if (eff && typeof eff === "object") {
    const effObj = eff as Record<string, unknown>;
    const label = effObj.label;
    if (typeof label !== "string" || !(EFFECT_KEYS as readonly string[]).includes(label)) return null;
    effectLabel = label as EffectKey;
  } else {
    return null;
  }

  const category = effectKeyToCategory(effectLabel);
  const allowedEffects = ITEM_TYPE_ALLOWED_EFFECTS[itemType as SpecialEffectTarget];
  if (allowedEffects && !allowedEffects.has(category)) {
    const fallbackCat = Array.from(allowedEffects)[0];
    effectLabel = firstEffectKeyOfCategory(fallbackCat);
  }

  const dur = obj.duration;
  if (typeof dur !== "number" || !Number.isFinite(dur) || dur < 0) return null;

  let costResource: CostResourceKey | null = null;
  const cst = obj.cost;
  if (typeof cst === "string") {
    if (!(COST_RESOURCE_KEYS as readonly string[]).includes(cst)) return null;
    costResource = cst as CostResourceKey;
  } else if (cst && typeof cst === "object") {
    const cstObj = cst as Record<string, unknown>;
    const resource = cstObj.resource;
    if (typeof resource !== "string" || !(COST_RESOURCE_KEYS as readonly string[]).includes(resource)) return null;
    costResource = resource as CostResourceKey;
  } else {
    return null;
  }

  const finalCategory = effectKeyToCategory(effectLabel);
  const costStr = costResource as string;
  const effectValue = computeEffectValue(finalCategory, grade, trigger as string, Math.max(0, Math.floor(dur)), costStr, affinityBonus);
  const costValue = computeCostValue(costStr, grade);

  return {
    trigger: trigger as TriggerTiming,
    effect: { label: effectLabel, value: effectValue },
    duration: Math.max(0, Math.floor(dur)),
    cost: { resource: costResource, value: costValue },
  };
}

/** AI 返回的 type 字段 → itemInfo 的 itemType 映射 */
const TYPE_TO_ITEM_TYPE: Record<string, CategorizedItemDefinition["itemType"]> = {
  "法宝": "法宝",
  "功法": "功法",
  "丹药": "丹药",
  "符箓": "符箓",
  "阵法": "阵法",
  "材料": "材料",
  "杂物": "杂物",
};

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

function parseEquipObject(e: unknown, realmMajor: string, realmMinor: string): TreasureItemDefinition {
  const obj = e as Record<string, unknown>;
  const grade = rollGrade(realmMajor, realmMinor);
  return {
    itemType: "法宝",
    name: safeStr(obj.name, "未命名法宝"),
    desc: safeStr(obj.intro, ""),
    grade,
    count: 1,
    function: applyFunctionOverrides(validateAiFunction(obj.function, grade, "法宝") ?? undefined, "法宝"),
  };
}

function parseGongfaObject(e: unknown, realmMajor: string, realmMinor: string, playerLinggen?: readonly string[] | null): GongfaItemDefinition {
  const obj = e as Record<string, unknown>;
  const grade = rollGrade(realmMajor, realmMinor);
  const lingQi = parseLingQi(obj.lingQi);
  const affinity = playerLinggen && lingQi && lingQi !== "无" && playerLinggen.includes(lingQi)
    ? LINGQI_AFFINITY_BONUS : undefined;
  return {
    itemType: "功法",
    name: safeStr(obj.name, "未命名功法"),
    lingQi,
    desc: safeStr(obj.intro, ""),
    grade,
    count: 1,
    bonus: parseBonusField(obj.bonus),
    function: applyFunctionOverrides(validateAiFunction(obj.function, grade, "功法", affinity) ?? undefined, "功法"),
  };
}

function parseStorageObject(e: unknown, realmMajor: string, realmMinor: string, playerLinggen?: readonly string[] | null): InventoryStackItem | null {
  const obj = e as Record<string, unknown>;
  const typeStr = safeStr(obj.type, "杂物");

  if (typeStr === "灵石") {
    const name = safeStr(obj.name, "下品灵石") as SpiritStoneName;
    const count = safeCount(obj.count);
    if (count <= 0) return null;
    return createSpiritStoneInventoryStack(name, count);
  }

  const name = safeStr(obj.name, "未命名物品");
  const desc = safeStr(obj.intro, "");
  const grade = rollGrade(realmMajor, realmMinor);
  const count = safeCount(obj.count);
  const itemType = TYPE_TO_ITEM_TYPE[typeStr] ?? "杂物";
  let affinity: number | undefined;
  if (itemType === "功法") {
    const lingQi = parseLingQi(obj.lingQi);
    if (playerLinggen && lingQi && lingQi !== "无" && playerLinggen.includes(lingQi)) {
      affinity = LINGQI_AFFINITY_BONUS;
    }
    const fn = applyFunctionOverrides(validateAiFunction(obj.function, grade, itemType, affinity) ?? undefined, itemType);
    return { itemType: "功法", name, lingQi, desc, grade, count, bonus: parseBonusField(obj.bonus), function: fn } as GongfaItemDefinition;
  }
  const fn = applyFunctionOverrides(validateAiFunction(obj.function, grade, itemType) ?? undefined, itemType);

  switch (itemType) {
    case "法宝":
      return { itemType: "法宝", name, desc, grade, count, function: fn } as TreasureItemDefinition;
    case "符箓":
      return { itemType: "符箓", name, desc, grade, count, function: fn } as TalismanItemDefinition;
    case "阵法":
      return { itemType: "阵法", name, desc, grade, count, function: fn } as FormationItemDefinition;
    case "丹药":
      return { itemType: "丹药", name, desc, grade, count, effects: { recover: { hp: 0, mp: 0 } }, function: fn };
    case "材料":
      return { itemType: "材料", name, desc, grade, count, function: fn } as MaterialItemDefinition;
    case "杂物":
    default:
      return { itemType: "杂物", name, desc, grade, count, function: fn } as MiscItemDefinition;
  }
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

/** 解析 AI 完整返回：剧情 + 世界地点 + 开局状态 */
export function parseInitStoryFull(raw: string, realmMajor: string, realmMinor: string, playerLinggen?: readonly string[] | null): InitStoryFullResult {
  return {
    story: parseInitStoryAiResponse(raw),
    state: parseInitStateAiResponse(raw, realmMajor, realmMinor, playerLinggen),
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
