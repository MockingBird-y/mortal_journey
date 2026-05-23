import { INIT_STATE_SYSTEM_PRESET } from "./init_state_preset";
import { extractTagContent, tryParseJsonArray, parseEquipObject, parseGongfaObject, parseStorageObject, spiritStoneAllowedUpTo } from "./parseAiItem";
import { completeChatWithMessagesJson, type JsonChatRequestPayload } from "./openAiChatBridge";
import {
  EQUIP_SLOT_COUNT,
  REALM_ORDER,
  SUB_STAGES,
  type ProtagonistPlayInfo,
  type EquippedSlotsState,
  type GongfaSlotsState,
  type InventoryStackItem,
  type TreasureItemDefinition,
  type GongfaItemDefinition,
} from "../role_core/types/playInfo";
import { SPIRIT_STONE_TABLE_KEYS_ORDERED, type SpiritStoneName } from "../role_core/types/spiritStone";
import type { NpcNearbyEntry } from "./state_generate";

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
  storyBody: string;
  protagonist: ProtagonistPlayInfo;
}

export interface InitStateParsed {
  equips: TreasureItemDefinition[];
  gongfas: GongfaItemDefinition[];
  storage: InventoryStackItem[];
  worldLocation: string;
  currentHp: number;
  currentMp: number;
  spiritStones: { op: "add"; name: string; count: number }[];
  nearbyNpcs: NpcNearbyEntry[];
}

const DEFAULT_INIT_STATE_TEMPERATURE = 0.55;
const DEFAULT_INIT_STATE_MAX_TOKENS = 16384;

const MJ_WORLD_BODY_OPEN = "<mj_world_body>";
const MJ_WORLD_BODY_CLOSE = "</mj_world_body>";
const MJ_EQUIP_BODY_OPEN = "<mj_equip_body>";
const MJ_EQUIP_BODY_CLOSE = "</mj_equip_body>";
const MJ_MAGIC_BODY_OPEN = "<mj_magic_body>";
const MJ_MAGIC_BODY_CLOSE = "</mj_magic_body>";
const MJ_STORAGE_BODY_OPEN = "<mj_storage_body>";
const MJ_STORAGE_BODY_CLOSE = "</mj_storage_body>";
const TAG_USER_STATE_OPEN = "<USER_STATE_TAG>";
const TAG_USER_STATE_CLOSE = "</USER_STATE_TAG>";
const TAG_SPIRIT_STONE_OPEN = "<SPIRIT_STONE_TAG>";
const TAG_SPIRIT_STONE_CLOSE = "</SPIRIT_STONE_TAG>";
const TAG_NPC_NEARBY_OPEN = "<NPC_NEARBY_TAG>";
const TAG_NPC_NEARBY_CLOSE = "</NPC_NEARBY_TAG>";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const VALID_MAJOR_SET = new Set<string>(REALM_ORDER as readonly string[]);
const VALID_MINOR_SET = new Set<string>(SUB_STAGES as readonly string[]);

function sanitizeRealm(realm: unknown): { major: string; minor: string } {
  if (!realm || typeof realm !== "object") return { major: "练气", minor: "初期" };
  const r = realm as { major?: unknown; minor?: unknown };
  const major = typeof r.major === "string" ? r.major.trim() : "";
  const minor = typeof r.minor === "string" ? r.minor.trim() : "";
  return {
    major: VALID_MAJOR_SET.has(major) ? major : "练气",
    minor: VALID_MINOR_SET.has(minor) ? minor : "初期",
  };
}

function parseInitNearbyNpcs(raw: string): NpcNearbyEntry[] {
  const text = extractTagContent(raw, TAG_NPC_NEARBY_OPEN, TAG_NPC_NEARBY_CLOSE);
  const arr = tryParseJsonArray(text) ?? [];
  return arr
    .map((e: unknown): NpcNearbyEntry | null => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const displayName = typeof o.displayName === "string" ? o.displayName.trim() : "";
      if (!displayName) return null;
      const realm = sanitizeRealm(o.realm);
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

export function parseInitStateAiResponse(raw: string, realmMajor: string, realmMinor: string, playerLinggen?: readonly string[] | null): InitStateParsed {
  const worldLocation = (() => {
    const s = raw == null ? "" : String(raw);
    const i = s.indexOf(MJ_WORLD_BODY_OPEN);
    if (i < 0) return "";
    const from = i + MJ_WORLD_BODY_OPEN.length;
    const j = s.indexOf(MJ_WORLD_BODY_CLOSE, from);
    if (j < 0) return s.slice(from).trim();
    return s.slice(from, j).trim();
  })();

  const equipText = extractTagContent(raw, MJ_EQUIP_BODY_OPEN, MJ_EQUIP_BODY_CLOSE);
  const magicText = extractTagContent(raw, MJ_MAGIC_BODY_OPEN, MJ_MAGIC_BODY_CLOSE);
  const storageText = extractTagContent(raw, MJ_STORAGE_BODY_OPEN, MJ_STORAGE_BODY_CLOSE);
  const userStateText = extractTagContent(raw, TAG_USER_STATE_OPEN, TAG_USER_STATE_CLOSE);
  const spiritStoneText = extractTagContent(raw, TAG_SPIRIT_STONE_OPEN, TAG_SPIRIT_STONE_CLOSE);

  const equipArr = tryParseJsonArray(equipText) ?? [];
  const magicArr = tryParseJsonArray(magicText) ?? [];
  const storageArr = tryParseJsonArray(storageText) ?? [];

  const equips: TreasureItemDefinition[] = equipArr.map((e: unknown) => parseEquipObject(e, realmMajor, realmMinor));
  const gongfas: GongfaItemDefinition[] = magicArr.map((e: unknown) => parseGongfaObject(e, realmMajor, realmMinor, playerLinggen));
  const storage: InventoryStackItem[] = storageArr
    .map((e: unknown) => parseStorageObject(e, realmMajor, realmMinor, playerLinggen))
    .filter((item): item is InventoryStackItem => item !== null);

  let currentHp = 0;
  let currentMp = 0;
  if (userStateText) {
    const obj = safeJsonParse(userStateText);
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      currentHp = typeof o.currentHp === "number" ? Math.round(o.currentHp) : 0;
      currentMp = typeof o.currentMp === "number" ? Math.round(o.currentMp) : 0;
    }
  }

  const stoneArr = tryParseJsonArray(spiritStoneText) ?? [];
  const spiritStones: { op: "add"; name: string; count: number }[] = stoneArr
    .map((e: unknown) => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const name = String(o.name || "").trim();
      const count = typeof o.count === "number" ? Math.max(1, Math.floor(o.count)) : 1;
      if (!name) return null;
      return { op: "add" as const, name, count };
    })
    .filter((c): c is { op: "add"; name: string; count: number } => c !== null);

  const nearbyNpcs = parseInitNearbyNpcs(raw);

  return { equips, gongfas, storage, worldLocation, currentHp, currentMp, spiritStones, nearbyNpcs };
}

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

function buildInitStateUserContent(input: InitStateGenerateInput): string {
  const p = input.protagonist;
  return [
    "【开局剧情正文】",
    input.storyBody,
    "",
    "【主角初始状态】",
    `姓名：${p.displayName}`,
    `性别：${p.gender || "—"}`,
    `境界：${p.realm.major}${p.realm.minor}`,
    `灵根：${p.linggen.join("") || "无"}`,
    `出身地点：${p.birthPlace || "—"}`,
    "",
  ].join("\n");
}

export async function generateInitState(input: InitStateGenerateInput): Promise<InitStateParsed> {
  const messages = [
    { role: "system" as const, content: INIT_STATE_SYSTEM_PRESET },
    { role: "user" as const, content: buildInitStateUserContent(input) },
  ];

  const payload: JsonChatRequestPayload = {
    apiUrl: input.apiUrl,
    apiKey: input.apiKey,
    model: input.model,
    messages,
    temperature: input.temperature ?? DEFAULT_INIT_STATE_TEMPERATURE,
    max_tokens: input.max_tokens ?? DEFAULT_INIT_STATE_MAX_TOKENS,
    requestTimeoutMs: input.requestTimeoutMs,
    signal: input.signal,
  };

  const raw = await completeChatWithMessagesJson(payload);
  const r = input.protagonist.realm;
  return parseInitStateAiResponse(raw, r.major, r.minor, input.protagonist.linggen);
}
