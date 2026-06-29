import { Character, normalizeElixirBonuses } from "./Character";
import type {
  NpcPlayInfo,
  PowerTier,
  TraitEntry,
  EquippedSlotsState,
  GongfaSlotsState,
  NpcPresence,
} from "./types/playInfo";
import {
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
} from "./types/playInfo";
import { DEFAULT_INVENTORY_SLOT_COUNT, compactInventorySlotsInPlace } from "./CharacterInventory";
import { getRealmPrimaryStats, getShouyuanForRealm, applyNpcGongfaMasteryByRealm } from "./realmUtils";
import type { InventoryStackItem, TreasureItemDefinition, GongfaItemDefinition } from "./types/itemInfo";
import type { NpcNearbyEntry } from "../ai/state_generate";
import { parseEquipObject, parseGongfaObject, parseStorageObject } from "../ai/parseAiItem";
import { resolveNpcId } from "./npcId";
import type { WorldLocation } from "./types/worldLocation";
import type { WorldTime } from "./worldTime";
import { createDefaultWorldTime, cloneWorldTime, ensureWorldTime } from "./worldTime";
import { gameLog } from "../log/gameLog";

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
  /** 当前所在地点（权威位置字段，由状态 AI 维护）。 */
  currentLocation: WorldLocation | null;
  /** 在场状态机：active/dormant/departed/dead。 */
  presence: NpcPresence;
  /** 上次被主角见到的世界时间。 */
  lastSeenWorldTime: WorldTime;
  /** 累计相遇次数。 */
  encounterCount: number;

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
    this.currentLocation = data.currentLocation ?? null;
    this.presence = data.presence ?? (data.isDead ? "dead" : "dormant");
    this.lastSeenWorldTime = data.lastSeenWorldTime
      ? cloneWorldTime(data.lastSeenWorldTime)
      : createDefaultWorldTime();
    this.encounterCount = typeof data.encounterCount === "number" ? data.encounterCount : 0;
  }

  static fromAiData(
    entry: NpcNearbyEntry,
    protagonistLinggen?: string[],
    currentLocation?: WorldLocation | null,
    currentWorldTime?: WorldTime | null,
  ): Npc {
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
    // NPC 功法层数按境界修为总量均分推算，使其与境界匹配（而非一律 1 层）。
    applyNpcGongfaMasteryByRealm(gongfaSlots, realmMajor, realmMinor);

    const inventoryItems: InventoryStackItem[] = [];
    if (Array.isArray(entry.inventorySlots)) {
      for (const raw of entry.inventorySlots) {
        if (!raw || typeof raw !== "object") continue;
        const item = parseStorageObject(raw, realmMajor, realmMinor, protagonistLinggen);
        if (item) inventoryItems.push(item);
      }
    }
    const inventorySlots: Array<InventoryStackItem | null> = [
      ...inventoryItems,
      ...Array.from({ length: Math.max(0, DEFAULT_INVENTORY_SLOT_COUNT - inventoryItems.length) }, () => null),
    ];

    const baseStats = getRealmPrimaryStats(realmMajor, realmMinor) ?? Character.emptyPrimaryStats();
    const shouyuan = getShouyuanForRealm(realmMajor, realmMinor) ?? 100;

    const npcId = resolveNpcId(entry.npcId, entry.displayName, entry.identity ?? "", currentLocation);

    const npcData: NpcPlayInfo = {
      role: "npc",
      id: npcId,
      displayName: entry.displayName,
      realm: { major: realmMajor, minor: realmMinor },
      primaryStats: baseStats,
      maxHp: 100,
      maxMp: 50,
      currentHp: 100,
      currentMp: 50,
      avatarUrl: "",
      gender: entry.gender ?? "男",
      linggen: entry.linggen ?? [],
      age: entry.age ?? 0,
      ageConfirmed: true,
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
      currentLocation: entry.currentLocation ? { ...entry.currentLocation } : (currentLocation ? { ...currentLocation } : null),
      presence: "active",
      lastSeenWorldTime: currentWorldTime ? cloneWorldTime(currentWorldTime) : createDefaultWorldTime(),
      encounterCount: 1,
    };

    const npc = new Npc(npcData);
    compactInventorySlotsInPlace(npc);

    const { maxHp: capH, maxMp: capM } = npc.computeMaxHpMp();
    npc.maxHp = capH;
    npc.maxMp = capM;
    const hpPct = typeof entry.hpPercent === "number" && entry.hpPercent >= 0 && entry.hpPercent <= 100 ? entry.hpPercent : 100;
    const mpPct = typeof entry.mpPercent === "number" && entry.mpPercent >= 0 && entry.mpPercent <= 100 ? entry.mpPercent : 100;
    npc.currentHp = Math.max(0, Math.min(capH, Math.round(capH * hpPct / 100)));
    npc.currentMp = Math.max(0, Math.min(capM, Math.round(capM * mpPct / 100)));

    return npc;
  }

  /**
   * 合并 AI 返回的 nearbyNpcs 条目到已有 NPC。
   *
   * 【白名单策略 · 严格事件驱动】
   * - dynamic 层（identity/favorability/goals/hobby/fear/personality/hp/mp/isDead）：
   *   AI 可自由更新，非空即覆盖。
   * - 核心层（realm/equippedSlots/gongfaSlots/inventorySlots）：**默认完全忽略**，
   *   即便 AI 返回了也不动。核心层变化必须走显式的 `<MJ_NPC_CORE_CHANGE_TAG>`
   *   事件通道（由 npcStore.applyNpcUpdates 统一应用），以此杜绝「数据漂移」。
   *   检测到 AI 违规返回核心字段时会告警，便于定位 prompt 问题。
   * - 不重算 maxHp/maxMp：核心层未变 ⇒ 主属性未变 ⇒ 上限稳定。
   */
  mergeFromAi(entry: NpcNearbyEntry, _protagonistLinggen?: string[]): void {
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
    // 位置字段：每次合并更新（信任 AI 的 currentLocation 输出；未给则保留旧值）。
    if (entry.currentLocation) this.currentLocation = { ...entry.currentLocation };
    if (typeof entry.hpPercent === "number") {
      this.currentHp = Math.max(0, Math.min(this.maxHp, Math.round(this.maxHp * entry.hpPercent / 100)));
    }
    if (typeof entry.mpPercent === "number") {
      this.currentMp = Math.max(0, Math.min(this.maxMp, Math.round(this.maxMp * entry.mpPercent / 100)));
    }

    // 核心层：默认忽略。AI 若返回了核心字段，告警提示其改用 <MJ_NPC_CORE_CHANGE_TAG>。
    const realmChanged = entry.realm && (entry.realm.major || entry.realm.minor)
      && (entry.realm.major !== this.realm.major || entry.realm.minor !== this.realm.minor);
    if (realmChanged) {
      gameLog.warn(
        `[Npc.mergeFromAi] 忽略 ${this.displayName} 的境界变更（${this.realm.major}${this.realm.minor}→${entry.realm?.major}${entry.realm?.minor}）。突破须走 <MJ_NPC_CORE_CHANGE_TAG> 事件。`,
      );
    }
    if (Array.isArray(entry.equippedSlots) && entry.equippedSlots.length > 0) {
      gameLog.warn(`[Npc.mergeFromAi] 忽略 ${this.displayName} 的 equippedSlots 变更（须走核心变更事件）。`);
    }
    if (Array.isArray(entry.gongfaSlots) && entry.gongfaSlots.length > 0) {
      gameLog.warn(`[Npc.mergeFromAi] 忽略 ${this.displayName} 的 gongfaSlots 变更（须走核心变更事件）。`);
    }
    if (Array.isArray(entry.inventorySlots) && entry.inventorySlots.length > 0) {
      gameLog.warn(`[Npc.mergeFromAi] 忽略 ${this.displayName} 的 inventorySlots 变更（须走核心变更事件）。`);
    }
  }

  /**
   * 核心层整体替换（重评估专用）。
   *
   * 当主角长时间（≥ {@link NPC_REEVALUATION_THRESHOLD_YEARS}）未见到某 NPC 后重新回到
   * 其归属地点，前端会批量请求 AI 推进这些 NPC 的境界/装备/功法，再用本方法把演进结果
   * 整体写回。这是「严格事件驱动」策略的受控例外——低频、批量、整体性更新，与 AI 实时
   * 声明的单点事件不同。
   *
   * identity/性格/目标等 dynamic 字段保持不变，只替换核心战斗数据。
   */
  applyReevaluation(entry: NpcNearbyEntry, protagonistLinggen?: string[]): void {
    if (this.isDead) return;

    if (entry.realm) {
      this.setRealm(entry.realm.major || this.realm.major, entry.realm.minor || this.realm.minor);
    }

    if (Array.isArray(entry.equippedSlots) && entry.equippedSlots.length > 0) {
      const newSlots: EquippedSlotsState = Array.from({ length: EQUIP_SLOT_COUNT }, () => null);
      let idx = 0;
      for (const raw of entry.equippedSlots) {
        if (!raw || typeof raw !== "object") continue;
        if (idx >= EQUIP_SLOT_COUNT) break;
        newSlots[idx] = parseEquipObject(raw, this.realm.major, this.realm.minor);
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
        newSlots[idx] = parseGongfaObject(raw, this.realm.major, this.realm.minor, protagonistLinggen);
        idx++;
      }
      // 重评估后境界可能提升，功法层数按新境界重新推算。
      applyNpcGongfaMasteryByRealm(newSlots, this.realm.major, this.realm.minor);
      this.gongfaSlots = newSlots;
    }

    if (Array.isArray(entry.inventorySlots) && entry.inventorySlots.length > 0) {
      const items: InventoryStackItem[] = [];
      for (const raw of entry.inventorySlots) {
        if (!raw || typeof raw !== "object") continue;
        const item = parseStorageObject(raw, this.realm.major, this.realm.minor, protagonistLinggen);
        if (item) items.push(item);
      }
      this.inventorySlots = [
        ...items,
        ...Array.from({ length: Math.max(0, DEFAULT_INVENTORY_SLOT_COUNT - items.length) }, () => null),
      ];
      compactInventorySlotsInPlace(this);
    }

    const { maxHp, maxMp } = this.computeMaxHpMp();
    this.setMaxHpMp(maxHp, maxMp);
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
      currentLocation: this.currentLocation ? { ...this.currentLocation } : null,
      presence: this.presence,
      lastSeenWorldTime: cloneWorldTime(this.lastSeenWorldTime),
      encounterCount: this.encounterCount,
    };
  }

  static fromData(data: NpcPlayInfo): Npc {
    return new Npc(data);
  }

  private static normalizeGongfaSlots(raw: unknown): GongfaSlotsState {
    const base: GongfaSlotsState = [null, null, null, null, null, null, null, null];
    if (!Array.isArray(raw)) return base;
    for (let i = 0; i < GONGFA_SLOT_COUNT; i++) {
      const item = (raw[i] ?? null) as GongfaItemDefinition | null;
      base[i] = item;
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

    const baseStats = getRealmPrimaryStats(major, minor) ?? Character.emptyPrimaryStats();
    const shouyuan = getShouyuanForRealm(major, minor) ?? 100;

    const npcData: NpcPlayInfo = {
      role: "npc",
      id: typeof o.id === "string" ? o.id : `npc_${o.displayName ?? "unknown"}`,
      displayName: typeof o.displayName === "string" ? o.displayName : "未知NPC",
      realm: { major, minor },
      primaryStats: baseStats,
      maxHp: typeof o.maxHp === "number" ? o.maxHp : 100,
      maxMp: typeof o.maxMp === "number" ? o.maxMp : 50,
      currentHp: typeof o.currentHp === "number" ? o.currentHp : 100,
      currentMp: typeof o.currentMp === "number" ? o.currentMp : 50,
      avatarUrl: typeof o.avatarUrl === "string" ? o.avatarUrl : "",
      gender: typeof o.gender === "string" ? o.gender : "男",
      linggen: Array.isArray(o.linggen) ? o.linggen.map((x: unknown) => String(x)) : [],
      age: typeof o.age === "number" ? o.age : 0,
      ageConfirmed: typeof o.ageConfirmed === "boolean" ? o.ageConfirmed : true,
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
      currentLocation: o.currentLocation && typeof o.currentLocation === "object"
        ? { ...(o.currentLocation as WorldLocation) }
        : null,
      presence: typeof o.presence === "string"
        ? (o.presence as NpcPresence)
        : (o.isDead === true ? "dead" : "dormant"),
      lastSeenWorldTime: o.lastSeenWorldTime && typeof o.lastSeenWorldTime === "object"
        ? ensureWorldTime(o.lastSeenWorldTime as WorldTime)
        : createDefaultWorldTime(),
      encounterCount: typeof o.encounterCount === "number" ? o.encounterCount : 0,
      elixirBonuses: normalizeElixirBonuses(o.elixirBonuses),
    };

    return new Npc(npcData);
  }
}
