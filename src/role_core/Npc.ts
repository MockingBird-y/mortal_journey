import { Character } from "./Character";
import type {
  NpcPlayInfo,
  PowerTier,
  TraitEntry,
  EquippedSlotsState,
  GongfaSlotsState,
  PlayerBaseStats,
} from "./types/playInfo";
import {
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
} from "./types/playInfo";
import { DEFAULT_INVENTORY_SLOT_COUNT } from "./CharacterInventory";
import { getBaseStats, getShouyuanForRealm } from "./realmUtils";
import type { InventoryStackItem, TreasureItemDefinition, GongfaItemDefinition } from "./types/itemInfo";
import type { NpcNearbyEntry } from "../ai/storyAndState_generate";
import { parseEquipObject, parseGongfaObject, parseStorageObject, rollGrade, spiritStoneAllowedUpTo } from "../ai/parseAiItem";
import { SPIRIT_STONE_TABLE_KEYS_ORDERED, type SpiritStoneName } from "./types/spiritStone";

const VALID_POWER_TIERS = new Set<string>(["小怪", "精英怪", "小boss", "大boss", "普通NPC"]);

function parsePowerTier(raw: unknown): PowerTier {
  if (typeof raw === "string" && VALID_POWER_TIERS.has(raw)) return raw as PowerTier;
  return "普通NPC";
}

export class Npc extends Character {

  readonly role = "npc" as const;
  identity: string;
  favorability: number;
  isDead: boolean;
  powerTier: PowerTier;
  currentStageGoal: string;
  longTermGoal: string;
  hobby: string;
  fear: string;
  personality: string;
  traits: TraitEntry[];
  xiuwei: number;

  constructor(data: NpcPlayInfo) {
    super(data);
    this.identity = data.identity;
    this.favorability = data.favorability;
    this.isDead = data.isDead;
    this.powerTier = data.powerTier;
    this.currentStageGoal = data.currentStageGoal;
    this.longTermGoal = data.longTermGoal;
    this.hobby = data.hobby;
    this.fear = data.fear;
    this.personality = data.personality;
    this.traits = data.traits;
    this.xiuwei = data.xiuwei;
  }

  static fromAiData(entry: NpcNearbyEntry, protagonistLinggen?: string[]): Npc {
    const realmMajor = entry.realm?.major ?? "练气";
    const realmMinor = entry.realm?.minor ?? "初期";

    const equippedSlots: EquippedSlotsState = Array.from({ length: EQUIP_SLOT_COUNT }, () => null);
    if (Array.isArray(entry.equippedSlots)) {
      for (const raw of entry.equippedSlots) {
        if (!raw || typeof raw !== "object") continue;
        const emptyIdx = equippedSlots.findIndex(s => s === null);
        if (emptyIdx < 0) break;
        equippedSlots[emptyIdx] = parseEquipObject(raw, realmMajor, realmMinor);
      }
    }

    const gongfaSlots: GongfaSlotsState = [null, null, null, null, null, null, null, null];
    if (Array.isArray(entry.gongfaSlots)) {
      for (const raw of entry.gongfaSlots) {
        if (!raw || typeof raw !== "object") continue;
        const emptyIdx = gongfaSlots.findIndex(s => s === null);
        if (emptyIdx < 0) break;
        gongfaSlots[emptyIdx] = parseGongfaObject(raw, realmMajor, realmMinor, protagonistLinggen);
      }
    }

    const inventoryItems: InventoryStackItem[] = [];
    if (Array.isArray(entry.inventorySlots)) {
      for (const raw of entry.inventorySlots) {
        if (!raw || typeof raw !== "object") continue;
        const item = parseStorageObject(raw, realmMajor, realmMinor, protagonistLinggen);
        if (item) inventoryItems.push(item);
      }
    }
    const maxStone = spiritStoneAllowedUpTo(realmMajor);
    const maxIdx = SPIRIT_STONE_TABLE_KEYS_ORDERED.indexOf(maxStone);
    const filteredItems = inventoryItems.filter(item => {
      if ("type" in item && item.type === "灵石") {
        const idx = SPIRIT_STONE_TABLE_KEYS_ORDERED.indexOf(item.name as SpiritStoneName);
        return idx >= 0 && idx <= maxIdx;
      }
      return true;
    });
    const inventorySlots: Array<InventoryStackItem | null> = [
      ...filteredItems,
      ...Array.from({ length: Math.max(0, DEFAULT_INVENTORY_SLOT_COUNT - filteredItems.length) }, () => null),
    ];

    const baseStats = getBaseStats(realmMajor, realmMinor) ?? Character.emptyPlayerBase();
    const shouyuan = getShouyuanForRealm(realmMajor, realmMinor) ?? 100;

    const npcData: NpcPlayInfo = {
      role: "npc",
      id: `npc_${entry.displayName}`,
      displayName: entry.displayName,
      realm: { major: realmMajor, minor: realmMinor },
      playerBase: baseStats,
      maxHp: entry.maxHp ?? 100,
      maxMp: entry.maxMp ?? 50,
      currentHp: entry.currentHp ?? 100,
      currentMp: entry.currentMp ?? 50,
      avatarUrl: "",
      gender: entry.gender ?? "男",
      linggen: entry.linggen ?? [],
      age: entry.age ?? 0,
      shouyuan,
      inventorySlots,
      gongfaSlots,
      equippedSlots,
      identity: entry.identity ?? "",
      favorability: entry.favorability ?? 0,
      isDead: entry.isDead ?? false,
      powerTier: parsePowerTier(entry.powerTier),
      currentStageGoal: entry.currentStageGoal ?? "",
      longTermGoal: entry.longTermGoal ?? "",
      hobby: entry.hobby ?? "",
      fear: entry.fear ?? "",
      personality: entry.personality ?? "",
      traits: [],
      xiuwei: 0,
    };

    const npc = new Npc(npcData);

    const derived = npc.getDerivedStats();
    const capH = Math.max(1, Math.round(derived.hp));
    const capM = Math.max(1, Math.round(derived.mp));
    npc.maxHp = capH;
    npc.maxMp = capM;
    npc.currentHp = Math.max(0, Math.min(npc.currentHp, capH));
    npc.currentMp = Math.max(0, Math.min(npc.currentMp, capM));

    return npc;
  }

  mergeFromAi(entry: NpcNearbyEntry, protagonistLinggen?: string[]): void {
    if (this.isDead) return;

    if (entry.identity) this.identity = entry.identity;
    if (typeof entry.favorability === "number") this.favorability = Math.max(-99, Math.min(99, entry.favorability));
    if (entry.isDead === true) {
      this.isDead = true;
      this.currentHp = 0;
      return;
    }
    if (entry.currentStageGoal) this.currentStageGoal = entry.currentStageGoal;
    if (entry.longTermGoal) this.longTermGoal = entry.longTermGoal;
    if (entry.hobby) this.hobby = entry.hobby;
    if (entry.fear) this.fear = entry.fear;
    if (entry.personality) this.personality = entry.personality;
    if (typeof entry.currentHp === "number") this.currentHp = Math.max(0, Math.min(this.maxHp, Math.round(entry.currentHp)));
    if (typeof entry.currentMp === "number") this.currentMp = Math.max(0, Math.min(this.maxMp, Math.round(entry.currentMp)));

    const realmMajor = entry.realm?.major ?? this.realm.major;
    const realmMinor = entry.realm?.minor ?? this.realm.minor;

    if (Array.isArray(entry.equippedSlots) && entry.equippedSlots.length > 0) {
      const newSlots: EquippedSlotsState = Array.from({ length: EQUIP_SLOT_COUNT }, () => null);
      let idx = 0;
      for (const raw of entry.equippedSlots) {
        if (!raw || typeof raw !== "object") continue;
        if (idx >= EQUIP_SLOT_COUNT) break;
        newSlots[idx] = parseEquipObject(raw, realmMajor, realmMinor);
        idx++;
      }
      this.equippedSlots = newSlots;
    }

    if (Array.isArray(entry.gongfaSlots) && entry.gongfaSlots.length > 0) {
      const newSlots: GongfaSlotsState = [null, null, null, null, null, null, null, null];
      let idx = 0;
      for (const raw of entry.gongfaSlots) {
        if (!raw || typeof raw !== "object") continue;
        if (idx >= GONGFA_SLOT_COUNT) break;
        newSlots[idx] = parseGongfaObject(raw, realmMajor, realmMinor, protagonistLinggen);
        idx++;
      }
      this.gongfaSlots = newSlots;
    }

    if (Array.isArray(entry.inventorySlots) && entry.inventorySlots.length > 0) {
      const items: InventoryStackItem[] = [];
      for (const raw of entry.inventorySlots) {
        if (!raw || typeof raw !== "object") continue;
        const item = parseStorageObject(raw, realmMajor, realmMinor, protagonistLinggen);
        if (item) items.push(item);
      }
      this.inventorySlots = [
        ...items,
        ...Array.from({ length: Math.max(0, DEFAULT_INVENTORY_SLOT_COUNT - items.length) }, () => null),
      ];
    }

    const derived = this.getDerivedStats();
    this.maxHp = Math.max(1, Math.round(derived.hp));
    this.maxMp = Math.max(1, Math.round(derived.mp));
    this.currentHp = Math.min(this.currentHp, this.maxHp);
    this.currentMp = Math.min(this.currentMp, this.maxMp);
  }

  toData(): NpcPlayInfo {
    const base = this.toCommonData();
    return {
      ...base,
      role: "npc",
      identity: this.identity,
      favorability: this.favorability,
      isDead: this.isDead,
      powerTier: this.powerTier,
      currentStageGoal: this.currentStageGoal,
      longTermGoal: this.longTermGoal,
      hobby: this.hobby,
      fear: this.fear,
      personality: this.personality,
      traits: this.traits,
      xiuwei: this.xiuwei,
    };
  }

  static fromData(data: NpcPlayInfo): Npc {
    return new Npc(data);
  }

  private static normalizeGongfaSlots(raw: unknown): GongfaSlotsState {
    const base: GongfaSlotsState = [null, null, null, null, null, null, null, null];
    if (!Array.isArray(raw)) return base;
    for (let i = 0; i < GONGFA_SLOT_COUNT; i++) {
      base[i] = (raw[i] ?? null) as GongfaItemDefinition | null;
    }
    return base;
  }

  private static normalizeEquippedSlots(raw: unknown): EquippedSlotsState {
    const slots: EquippedSlotsState = Array.from({ length: EQUIP_SLOT_COUNT }, () => null);
    if (!Array.isArray(raw)) return slots;
    for (let i = 0; i < EQUIP_SLOT_COUNT; i++) {
      const item = raw[i];
      if (item && typeof item === "object" && (item as Record<string, unknown>).itemType === "法宝") {
        slots[i] = item as TreasureItemDefinition;
      }
    }
    return slots;
  }

  static fromJson(input: string | unknown): Npc | null {
    let data: unknown = input;
    if (typeof input === "string") {
      try { data = JSON.parse(input); } catch { return null; }
    }
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    if (o.role !== "npc") return null;

    const realmRaw = o.realm;
    const major = realmRaw && typeof realmRaw === "object" && typeof (realmRaw as Record<string, unknown>).major === "string"
      ? String((realmRaw as Record<string, unknown>).major).trim() || "练气" : "练气";
    const minor = realmRaw && typeof realmRaw === "object" && typeof (realmRaw as Record<string, unknown>).minor === "string"
      ? String((realmRaw as Record<string, unknown>).minor).trim() || "初期" : "初期";

    const baseStats = getBaseStats(major, minor) ?? Character.emptyPlayerBase();
    const shouyuan = getShouyuanForRealm(major, minor) ?? 100;

    const npcData: NpcPlayInfo = {
      role: "npc",
      id: typeof o.id === "string" ? o.id : `npc_${o.displayName ?? "unknown"}`,
      displayName: typeof o.displayName === "string" ? o.displayName : "未知NPC",
      realm: { major, minor },
      playerBase: baseStats,
      maxHp: typeof o.maxHp === "number" ? o.maxHp : 100,
      maxMp: typeof o.maxMp === "number" ? o.maxMp : 50,
      currentHp: typeof o.currentHp === "number" ? o.currentHp : 100,
      currentMp: typeof o.currentMp === "number" ? o.currentMp : 50,
      avatarUrl: typeof o.avatarUrl === "string" ? o.avatarUrl : "",
      gender: typeof o.gender === "string" ? o.gender : "男",
      linggen: Array.isArray(o.linggen) ? o.linggen.map((x: unknown) => String(x)) : [],
      age: typeof o.age === "number" ? o.age : 0,
      shouyuan: typeof o.shouyuan === "number" ? o.shouyuan : shouyuan,
      inventorySlots: Array.isArray(o.inventorySlots) ? o.inventorySlots : Array.from({ length: DEFAULT_INVENTORY_SLOT_COUNT }, () => null),
      gongfaSlots: Npc.normalizeGongfaSlots(o.gongfaSlots),
      equippedSlots: Npc.normalizeEquippedSlots(o.equippedSlots),
      identity: typeof o.identity === "string" ? o.identity : "",
      favorability: typeof o.favorability === "number" ? o.favorability : 0,
      isDead: o.isDead === true,
      powerTier: parsePowerTier(o.powerTier),
      currentStageGoal: typeof o.currentStageGoal === "string" ? o.currentStageGoal : "",
      longTermGoal: typeof o.longTermGoal === "string" ? o.longTermGoal : "",
      hobby: typeof o.hobby === "string" ? o.hobby : "",
      fear: typeof o.fear === "string" ? o.fear : "",
      personality: typeof o.personality === "string" ? o.personality : "",
      traits: Array.isArray(o.traits) ? o.traits : [],
      xiuwei: typeof o.xiuwei === "number" ? o.xiuwei : 0,
    };

    return new Npc(npcData);
  }
}
