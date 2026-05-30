import { STATE_SYSTEM_PRESET } from "./state_preset";
import { extractTagContent, tryParseJsonArray } from "./parseAiItem";
import {
  completeChatWithMessagesJson,
  type JsonChatRequestPayload,
} from "./openAiChatBridge";
import {
  REALM_ORDER,
  SUB_STAGES,
  type ProtagonistPlayInfo,
  type EquippedSlotsState,
  type GongfaSlotsState,
  type InventoryStackItem,
} from "../role_core/types/playInfo";

export interface StateGenerateInput {
  apiUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
  storyBody: string;
  protagonist: ProtagonistPlayInfo;
  currentWorldLocation?: string;
  npcSnapshot?: string;
}

export interface UserStateChange {
  hpPercent: number;
  mpPercent: number;
  xiuweiIncrease?: number;
  realmBreakthrough?: boolean;
}

export interface SpiritStoneChange {
  op: "add" | "remove";
  count: number;
}

export interface ItemAddEntry {
  type: string;
  name: string;
  intro: string;
  grade: string;
  bonus?: string[] | Record<string, number>;
  count: number;
  system?: unknown;
  role?: unknown;
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
  hpPercent: number;
  mpPercent: number;
  equippedSlots?: unknown[];
  gongfaSlots?: unknown[];
  inventorySlots?: unknown[];
  [key: string]: unknown;
}

export interface StateParsed {
  worldLocation: string;
  userState: UserStateChange | null;
  spiritStoneChanges: SpiritStoneChange[];
  itemAdds: ItemAddEntry[];
  itemRemoves: ItemRemoveEntry[];
  nearbyNpcs: NpcNearbyEntry[];
}

const DEFAULT_TEMPERATURE = 0.55;
const DEFAULT_MAX_TOKENS = 16384;

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

function extractWorldBody(raw: string): string {
  const s = raw == null ? "" : String(raw);
  const i = s.indexOf(MJ_WORLD_BODY_OPEN);
  if (i < 0) return "";
  const from = i + MJ_WORLD_BODY_OPEN.length;
  const j = s.indexOf(MJ_WORLD_BODY_CLOSE, from);
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

function parseNearbyNpcs(raw: string): NpcNearbyEntry[] {
  const text = extractTagContent(raw, TAG_NPC_NEARBY_OPEN, TAG_NPC_NEARBY_CLOSE);
  const arr = tryParseJsonArray(text) ?? [];
  return arr
    .map((e: unknown): NpcNearbyEntry | null => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const displayName = String(o.displayName || "").trim();
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
        hpPercent: typeof o.hpPercent === "number" ? Math.max(0, Math.min(100, Math.round(o.hpPercent))) : 100,
        mpPercent: typeof o.mpPercent === "number" ? Math.max(0, Math.min(100, Math.round(o.mpPercent))) : 100,
        equippedSlots: Array.isArray(o.equippedSlots) ? o.equippedSlots : undefined,
        gongfaSlots: Array.isArray(o.gongfaSlots) ? o.gongfaSlots : undefined,
        inventorySlots: Array.isArray(o.inventorySlots) ? o.inventorySlots : undefined,
      };
    })
    .filter((e): e is NpcNearbyEntry => e !== null);
}

export function parseStateAiResponse(raw: string): StateParsed {
  const worldLocation = extractWorldBody(raw);

  const userStateText = extractTagContent(raw, TAG_USER_STATE_OPEN, TAG_USER_STATE_CLOSE);
  const spiritStoneText = extractTagContent(raw, TAG_SPIRIT_STONE_OPEN, TAG_SPIRIT_STONE_CLOSE);
  const itemAddText = extractTagContent(raw, TAG_ITEM_ADD_OPEN, TAG_ITEM_ADD_CLOSE);
  const itemRemoveText = extractTagContent(raw, TAG_ITEM_REMOVE_OPEN, TAG_ITEM_REMOVE_CLOSE);

  let userState: UserStateChange | null = null;
  if (userStateText) {
    const obj = safeJsonParse(userStateText);
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      const hpPercent = typeof o.hpPercent === "number" ? Math.max(0, Math.min(100, Math.round(o.hpPercent))) : 100;
      const mpPercent = typeof o.mpPercent === "number" ? Math.max(0, Math.min(100, Math.round(o.mpPercent))) : 100;
      const xiuweiIncrease = typeof o.xiuweiIncrease === "number" ? Math.max(0, Math.floor(o.xiuweiIncrease)) : undefined;
      const realmBreakthrough = o.realmBreakthrough === true ? true : undefined;
      userState = { hpPercent, mpPercent, xiuweiIncrease, realmBreakthrough };
    }
  }

  const stoneArr = tryParseJsonArray(spiritStoneText) ?? [];
  const spiritStoneChanges: SpiritStoneChange[] = stoneArr
    .map((e: unknown) => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const op = String(o.op || "").trim();
      if (op !== "add" && op !== "remove") return null;
      const count = typeof o.count === "number" ? Math.max(1, Math.floor(o.count)) : 1;
      return { op, count } as SpiritStoneChange;
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
        type, name, intro, grade, bonus, count,
        ...(o.system != null ? { system: o.system } : {}),
        ...(o.role != null ? { role: o.role } : {}),
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
    worldLocation,
    userState,
    spiritStoneChanges,
    itemAdds,
    itemRemoves,
    nearbyNpcs,
  };
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

function buildStateUserContent(input: StateGenerateInput): string {
  const p = input.protagonist;

  const npcSection = input.npcSnapshot?.trim()
    ? `\n【当前场景NPC】\n${input.npcSnapshot.trim()}\n`
    : "";

  const locationHint = input.currentWorldLocation?.trim()
    ? `\n当前世界地点：${input.currentWorldLocation.trim()}`
    : "";

  return [
    "【剧情正文】",
    input.storyBody,
    "",
    "【主角当前状态】",
    `姓名：${p.displayName}`,
    `境界：${p.realm.major}${p.realm.minor}${p.realmComplete ? "·圆满" : ""}`,
    `修为状态：${p.realmComplete ? "修为已圆满，可突破" : "修为未圆满"}`,
    `当前血量：${p.currentHp}/${p.maxHp}`,
    `当前法力：${p.currentMp}/${p.maxMp}`,
    `灵根：${(p as { linggen?: string[] }).linggen?.join("") || "无"}`,
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
    npcSection,
  ].join("\n");
}

export async function generateState(input: StateGenerateInput): Promise<StateParsed> {
  const messages = [
    { role: "system" as const, content: STATE_SYSTEM_PRESET },
    { role: "user" as const, content: buildStateUserContent(input) },
  ];

  const payload: JsonChatRequestPayload = {
    apiUrl: input.apiUrl,
    apiKey: input.apiKey,
    model: input.model,
    messages,
    temperature: input.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: input.max_tokens ?? DEFAULT_MAX_TOKENS,
    requestTimeoutMs: input.requestTimeoutMs,
    signal: input.signal,
  };

  const raw = await completeChatWithMessagesJson(payload);
  return parseStateAiResponse(raw);
}
