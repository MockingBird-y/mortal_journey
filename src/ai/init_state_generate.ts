import { INIT_STORY_SYSTEM_PRESET } from "./init_state";
import { completeChatWithMessagesJson, type JsonChatRequestPayload } from "./openAiChatBridge";
import { Protagonist } from "../role_core/Protagonist";
import { ITEM_GRADE_ATTRI_TABLE } from "../role_core/types/playInfo";
import {
  createSpiritStoneInventoryStack,
  SPIRIT_STONE_TABLE_KEYS_ORDERED,
  type SpiritStoneName,
} from "../role_core/types/spiritStone";
import type {
  GongfaItemDefinition,
  BreakthroughElixirDefinition,
  ElixirItemDefinition,
  ItemGrade,
  MaterialItemDefinition,
  MiscItemDefinition,
  TreasureItemDefinition,
} from "../role_core/types/itemInfo";
import type { InventoryStackItem, ProtagonistPlayInfo, GongfaSlotsState, EquippedSlotsState } from "../role_core/types/playInfo";
import { EQUIP_SLOT_COUNT, PRIMARY_STAT_KEY_TO_ZH, PRIMARY_STAT_KEYS } from "../role_core/types/playInfo";

export interface InitStateApiConfig {
  apiUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
}

export interface InitStateGenerateInput extends InitStateApiConfig {
  protagonist: ProtagonistPlayInfo;
  storyBody: string;
}

const DEFAULT_INIT_STATE_TEMPERATURE = 0.55;
const DEFAULT_INIT_STATE_MAX_TOKENS = 16384;

const GRADE_ORDER: readonly ItemGrade[] = ["下品", "中品", "上品", "极品", "仙品"];
const REALM_GRADE_MAP: Record<string, ItemGrade> = {
  "练气": "下品",
  "筑基": "中品",
  "结丹": "上品",
  "元婴": "极品",
  "化神": "仙品",
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getGradeRow(grade: string) {
  return ITEM_GRADE_ATTRI_TABLE.find(r => r.grade === grade) ?? ITEM_GRADE_ATTRI_TABLE[0];
}

interface AiEquipItem {
  type: string;
  name: string;
  intro: string;
  grade: string;
  bonus: string[] | Record<string, number>;
}

interface AiGongfaItem {
  type: string;
  name: string;
  intro: string;
  grade: string;
  bonus: string[] | Record<string, number>;
}

interface AiStorageItem {
  type: string;
  name: string;
  intro?: string;
  grade?: string;
  count: number;
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

function safeGrade(val: unknown, fallback: ItemGrade): ItemGrade {
  if (typeof val === "string" && GRADE_ORDER.includes(val as ItemGrade)) return val as ItemGrade;
  return fallback;
}

function safeCount(val: unknown): number {
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
}

function normalizeBonus(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(s => String(s)).filter(Boolean);
  if (typeof raw === "object" && raw !== null) return Object.keys(raw);
  return [];
}

function buildTreasure(item: AiEquipItem): TreasureItemDefinition {
  return {
    name: item.name,
    desc: item.intro,
    grade: item.grade as ItemGrade,
    count: 1,
    itemType: "法宝",
  };
}

const ALL_PRIMARY_ZH: string[] = PRIMARY_STAT_KEYS.map(k => PRIMARY_STAT_KEY_TO_ZH[k]);

function pickRandomPrimaryStats(count: number): string[] {
  const shuffled = [...ALL_PRIMARY_ZH].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generatePrimaryBonusForGrade(grade: string, zhStats: string[]): Record<string, number> {
  const row = getGradeRow(grade);
  const bonus: Record<string, number> = {};
  for (const zhKey of zhStats) {
    const lo = 1;
    const hi = Math.max(lo, Math.round((row.hp[0] + row.hp[1]) / 8));
    bonus[zhKey] = randInt(lo, Math.max(lo, hi));
  }
  return bonus;
}

function buildGongfa(item: AiGongfaItem): GongfaItemDefinition {
  const aiNames = normalizeBonus(item.bonus);
  let statNames: string[];
  if (aiNames.length > 0) {
    const valid = aiNames.filter(n => ALL_PRIMARY_ZH.includes(n));
    statNames = valid.length > 0 ? valid.slice(0, 2) : pickRandomPrimaryStats(2);
  } else {
    statNames = pickRandomPrimaryStats(2);
  }
  return {
    name: item.name,
    desc: item.intro,
    grade: item.grade as ItemGrade,
    count: 1,
    itemType: "功法",
    bonus: generatePrimaryBonusForGrade(item.grade, statNames),
  };
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

function buildSpiritStone(name: string, count: number): InventoryStackItem | null {
  if (!SPIRIT_STONE_TABLE_KEYS_ORDERED.includes(name as SpiritStoneName)) return null;
  return createSpiritStoneInventoryStack(name as SpiritStoneName, count);
}

function buildElixir(item: AiStorageItem): ElixirItemDefinition {
  return {
    name: item.name,
    desc: item.intro ?? "",
    grade: (item.grade ?? "下品") as ItemGrade,
    count: item.count,
    itemType: "丹药",
    effects: {
      recover: {
        hp: randInt(20, 80),
        mp: randInt(5, 30),
      },
    },
  };
}

function buildMaterial(item: AiStorageItem): MaterialItemDefinition {
  return {
    name: item.name,
    desc: item.intro ?? "",
    grade: (item.grade ?? "下品") as ItemGrade,
    count: item.count,
    itemType: "材料",
  };
}

function buildMisc(item: AiStorageItem): MiscItemDefinition {
  return {
    name: item.name,
    desc: item.intro ?? "",
    grade: (item.grade ?? "下品") as ItemGrade,
    count: item.count,
    itemType: "杂物",
  };
}

function buildStorageItem(item: AiStorageItem): InventoryStackItem | null {
  switch (item.type) {
    case "灵石":
      return buildSpiritStone(item.name, item.count);
    case "丹药":
      return buildElixir(item);
    case "材料":
      return buildMaterial(item);
    case "杂物":
      return buildMisc(item);
    default:
      return buildMisc({ ...item, type: "杂物" });
  }
}

export interface InitStateParsed {
  equips: AiEquipItem[];
  gongfas: AiGongfaItem[];
  storage: AiStorageItem[];
}

export function parseInitStateAiResponse(raw: string): InitStateParsed {
  const equipText = extractTagContent(raw, "<equip_body>", "</equip_body>");
  const magicText = extractTagContent(raw, "<magic_body>", "</magic_body>");
  const storageText = extractTagContent(raw, "<storage_body>", "</storage_body>");

  const equipArr = tryParseJsonArray(equipText) ?? [];
  const magicArr = tryParseJsonArray(magicText) ?? [];
  const storageArr = tryParseJsonArray(storageText) ?? [];

  const equips: AiEquipItem[] = equipArr.map((e: unknown) => {
    const obj = e as Record<string, unknown>;
    return {
      type: safeStr(obj.type, "武器"),
      name: safeStr(obj.name, "未命名装备"),
      intro: safeStr(obj.intro, ""),
      grade: safeGrade(obj.grade, "下品"),
      bonus: (Array.isArray(obj.bonus) || (typeof obj.bonus === "object" && obj.bonus !== null)) ? obj.bonus as string[] | Record<string, number> : [] as string[],
    };
  });

  const gongfas: AiGongfaItem[] = magicArr.map((e: unknown) => {
    const obj = e as Record<string, unknown>;
    return {
      type: safeStr(obj.type, "攻击功法"),
      name: safeStr(obj.name, "未命名功法"),
      intro: safeStr(obj.intro, ""),
      grade: safeGrade(obj.grade, "下品"),
      bonus: (Array.isArray(obj.bonus) || (typeof obj.bonus === "object" && obj.bonus !== null)) ? obj.bonus as string[] | Record<string, number> : [] as string[],
    };
  });

  const storage: AiStorageItem[] = storageArr.map((e: unknown) => {
    const obj = e as Record<string, unknown>;
    return {
      type: safeStr(obj.type, "杂物"),
      name: safeStr(obj.name, "未命名物品"),
      intro: typeof obj.intro === "string" ? obj.intro : undefined,
      grade: typeof obj.grade === "string" ? obj.grade : undefined,
      count: safeCount(obj.count),
    };
  });

  return { equips, gongfas, storage };
}

export function buildEquippedSlotsFromParsed(parsed: InitStateParsed): EquippedSlotsState {
  const slots: EquippedSlotsState = Array.from({ length: EQUIP_SLOT_COUNT }, () => null);

  for (const item of parsed.equips) {
    const treasure = buildTreasure(item);
    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx >= 0) {
      slots[emptyIdx] = treasure;
    }
  }

  return slots;
}

export function buildGongfaSlotsFromParsed(parsed: InitStateParsed): GongfaSlotsState {
  const slots: GongfaSlotsState = [null, null, null, null, null, null, null, null];

  for (const item of parsed.gongfas) {
    const gf = buildGongfa(item);
    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx >= 0) {
      slots[emptyIdx] = gf;
    }
  }

  return slots;
}

export function buildInventoryFromParsed(parsed: InitStateParsed, realmMajor: string, slotCount: number): Array<InventoryStackItem | null> {
  const maxStone = spiritStoneAllowedUpTo(realmMajor);
  const maxIdx = SPIRIT_STONE_TABLE_KEYS_ORDERED.indexOf(maxStone);

  const items: InventoryStackItem[] = [];

  for (const item of parsed.storage) {
    if (item.count <= 0) continue;
    if (item.type === "灵石") {
      const stoneIdx = SPIRIT_STONE_TABLE_KEYS_ORDERED.indexOf(item.name as SpiritStoneName);
      if (stoneIdx >= 0 && stoneIdx <= maxIdx) {
        const stack = buildSpiritStone(item.name, item.count);
        if (stack) items.push(stack);
      }
    } else {
      const stack = buildStorageItem(item);
      if (stack) items.push(stack);
    }
  }

  const rest = Math.max(0, slotCount - items.length);
  return [...items, ...Array.from({ length: rest }, () => null)];
}

function buildInitStateUserContent(protagonist: ProtagonistPlayInfo, storyBody: string): string {
  const p = protagonist;
  return [
    "【开局配置生成请求】",
    "",
    `姓名：${p.displayName}`,
    `性别：${p.gender || "—"}`,
    `境界：${Protagonist.formatRealm(p.realm)}`,
    `灵根：${Protagonist.formatLinggenElements(p.linggen)}`,
    `出身地点：${p.birthPlace?.trim() || "—"}`,
    "",
    "【出身情况】",
    p.originStory?.trim() || "—",
    "",
    "【开局剧情】",
    storyBody,
  ].join("\n");
}

export function buildInitStateRequestPayload(input: InitStateGenerateInput): JsonChatRequestPayload {
  const userContent = buildInitStateUserContent(input.protagonist, input.storyBody);
  return {
    apiUrl: input.apiUrl,
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      { role: "system", content: INIT_STORY_SYSTEM_PRESET },
      { role: "user", content: userContent },
    ],
    temperature: DEFAULT_INIT_STATE_TEMPERATURE,
    max_tokens: DEFAULT_INIT_STATE_MAX_TOKENS,
    requestTimeoutMs: input.requestTimeoutMs,
    signal: input.signal,
  };
}

export async function generateInitState(input: InitStateGenerateInput): Promise<InitStateParsed> {
  const raw = await completeChatWithMessagesJson(buildInitStateRequestPayload(input));
  return parseInitStateAiResponse(raw);
}
