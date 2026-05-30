import type { InventoryStackItem } from "./types/itemInfo";
import type {
  CultivationRealm,
  EquippedSlotsState,
  GongfaSlotsState,
  PlayerBaseStats,
  EquipSlotKey,
  ProtagonistDetailAction,
  PrimaryStatKey,
  DerivedStatKey,
  CharacterPlayInfoCommon,
} from "./types/playInfo";
import {
  BASE_STAT_KEYS,
  DERIVED_STAT_DEFAULTS,
  DERIVED_STAT_KEY_TO_ZH,
  PRIMARY_STAT_KEYS,
  PRIMARY_STAT_KEY_TO_ZH,
  PRIMARY_TO_DERIVED_MAP,
  PCT_DERIVED_KEYS,
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
} from "./types/playInfo";
import {
  getBaseStats,
  getEquipBonusRealmRatio,
} from "./realmUtils";
import type { SpiritStoneName } from "./types/spiritStone";
import {
  DEFAULT_INVENTORY_SLOT_COUNT,
  INVENTORY_SLOT_EXPAND_STEP,
  setInventorySlot as invSetSlot,
  addToInventory as invAdd,
  addSpiritStone as invAddStone,
  removeSpiritStone as invRemoveStone,
} from "./CharacterInventory";
import {
  isTreasureItem,
  setGongfaSlot as eqSetGongfa,
  unequipGongfaToInventory as eqUnequipGf,
  equipGongfaFromInventory as eqEquipGf,
  setEquippedSlot as eqSetEquip,
  equipFromInventory as eqEquip,
  unequipToInventory as eqUnequip,
  applyDetailAction as eqApply,
} from "./CharacterEquip";

export class Character {

  id: string;
  displayName: string;
  realm: CultivationRealm;
  playerBase: PlayerBaseStats;
  maxHp: number;
  maxMp: number;
  currentHp: number;
  currentMp: number;
  avatarUrl: string;
  gender: string;
  linggen: string[];
  age: number;
  shouyuan: number;
  equippedSlots: EquippedSlotsState;
  gongfaSlots: GongfaSlotsState;
  inventorySlots: Array<InventoryStackItem | null>;

  constructor(data: CharacterPlayInfoCommon) {
    this.id = data.id;
    this.displayName = data.displayName;
    this.realm = data.realm;
    this.playerBase = data.playerBase;
    this.maxHp = data.maxHp;
    this.maxMp = data.maxMp;
    this.currentHp = data.currentHp;
    this.currentMp = data.currentMp;
    this.avatarUrl = data.avatarUrl;
    this.gender = data.gender;
    this.linggen = data.linggen;
    this.age = data.age;
    this.shouyuan = data.shouyuan;
    this.equippedSlots = data.equippedSlots;
    this.gongfaSlots = data.gongfaSlots;
    this.inventorySlots = data.inventorySlots;
  }

  // ===================================================================
  // 静态格式化
  // ===================================================================

  static formatLinggenElements(elements: string[]): string {
    const els = elements.map((e) => String(e).trim()).filter(Boolean);
    return els.length ? els.join("") : "—";
  }

  static formatRealm(realm: CultivationRealm): string {
    const major = realm.major?.trim() || "—";
    const minor = realm.minor?.trim() || "";
    return minor ? `${major}${minor}` : major;
  }

  // ===================================================================
  // 派生属性
  // ===================================================================

  protected static readonly ZH_BONUS_TO_PLAYER_KEY: Readonly<Record<string, PrimaryStatKey>> = (() => {
    const o: Record<string, PrimaryStatKey> = {};
    for (const en of Object.keys(PRIMARY_STAT_KEY_TO_ZH) as PrimaryStatKey[]) {
      o[PRIMARY_STAT_KEY_TO_ZH[en]] = en;
    }
    return o;
  })();

  protected static readonly ZH_DERIVED_TO_PLAYER_KEY: Readonly<Record<string, string>> = (() => {
    const o: Record<string, string> = {};
    for (const en of Object.keys(DERIVED_STAT_KEY_TO_ZH) as DerivedStatKey[]) {
      o[DERIVED_STAT_KEY_TO_ZH[en]] = en;
    }
    return o;
  })();

  protected realmTableBaseOrStored(): PlayerBaseStats {
    const fromTable = getBaseStats(this.realm.major, this.realm.minor);
    return fromTable ? { ...fromTable } : { ...this.playerBase };
  }

  private static addZhItemBonusInto(
    target: Record<string, number>,
    bonus: Record<string, number | undefined> | undefined,
    realmRatio = 1,
  ): void {
    if (!bonus || typeof bonus !== "object") return;
    const r = typeof realmRatio === "number" && Number.isFinite(realmRatio) && realmRatio > 0 ? realmRatio : 1;
    for (const [zh, v] of Object.entries(bonus)) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const key = Character.ZH_BONUS_TO_PLAYER_KEY[zh];
      if (!key) continue;
      target[key] = (target[key] ?? 0) + Math.trunc(v * r);
    }
  }

  protected collectPrimaryBonuses(): Record<string, number> {
    const primaryStats: Record<string, number> = {};
    const ratio = getEquipBonusRealmRatio(this.realm.major, this.realm.minor);
    for (const gf of this.gongfaSlots) {
      if (!gf) continue;
      Character.addZhItemBonusInto(primaryStats, gf.bonus, ratio);
    }
    return primaryStats;
  }

  protected applyTreasureBonuses(target: PlayerBaseStats): void {
    const ratio = getEquipBonusRealmRatio(this.realm.major, this.realm.minor);
    const t = target as Record<string, number>;
    for (const tr of this.equippedSlots) {
      if (!tr) continue;
      const bonus = tr.bonus;
      if (!bonus || typeof bonus !== "object") continue;
      for (const [zh, v] of Object.entries(bonus)) {
        if (typeof v !== "number" || !Number.isFinite(v)) continue;
        const key = Character.ZH_DERIVED_TO_PLAYER_KEY[zh];
        if (!key) continue;
        t[key] = (t[key] ?? 0) + Math.trunc(v * ratio);
      }
    }
  }

  private static applyPrimaryToDerived(
    primaryStats: Record<string, number>,
    target: PlayerBaseStats,
  ): void {
    const t = target as Record<string, number>;
    for (const pk of PRIMARY_STAT_KEYS) {
      const statValue = primaryStats[pk];
      if (typeof statValue !== "number" || statValue <= 0) continue;
      const entries = PRIMARY_TO_DERIVED_MAP[pk];
      for (const entry of entries) {
        const factor = (statValue * entry.per100) / 100;
        if (PCT_DERIVED_KEYS.has(entry.key)) {
          t[entry.key] = Math.round(t[entry.key] * (1 + factor / 100));
        } else {
          t[entry.key] += Math.round(factor);
        }
      }
    }
  }

  getDerivedStats(): PlayerBaseStats {
    const merged = this.realmTableBaseOrStored();
    const primaryStats = this.collectPrimaryBonuses();
    Character.applyPrimaryToDerived(primaryStats, merged);
    this.applyTreasureBonuses(merged);
    return merged;
  }

  getPrimaryStats(): Readonly<Record<PrimaryStatKey, number>> {
    const bonuses = this.collectPrimaryBonuses();
    const result: Record<string, number> = {};
    for (const k of PRIMARY_STAT_KEYS) {
      result[k] = bonuses[k] ?? 0;
    }
    return result as Readonly<Record<PrimaryStatKey, number>>;
  }

  // ===================================================================
  // 生命 / 法力（HP / MP）
  // ===================================================================

  setCurrentHpMp(currentHp: number, currentMp: number): void {
    const maxH = Math.max(1, this.maxHp);
    const maxM = Math.max(1, this.maxMp);
    this.currentHp = Math.max(0, Math.min(maxH, Math.round(currentHp)));
    this.currentMp = Math.max(0, Math.min(maxM, Math.round(currentMp)));
  }

  setMaxHpMp(maxHp: number, maxMp: number): void {
    this.maxHp = Math.max(1, Math.floor(maxHp));
    this.maxMp = Math.max(1, Math.floor(maxMp));
    this.currentHp = Math.min(this.currentHp, this.maxHp);
    this.currentMp = Math.min(this.currentMp, this.maxMp);
  }

  // ===================================================================
  // 境界 · 年龄 · 寿元 · 名称 · 头像 · 属性
  // ===================================================================

  setRealm(major: string, minor: string): void {
    this.realm = {
      major: major.trim() || "练气",
      minor: minor.trim() || "初期",
    };
  }

  setAge(age: number): void {
    this.age = typeof age === "number" && Number.isFinite(age) ? Math.max(0, Math.floor(age)) : this.age;
  }

  setShouyuan(n: number): void {
    this.shouyuan = typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : this.shouyuan;
  }

  setDisplayName(name: string): void {
    this.displayName = String(name).trim() || "未命名";
  }

  setAvatarUrl(url: string): void {
    this.avatarUrl = url != null ? String(url) : "";
  }

  patchPlayerBase(partial: Partial<PlayerBaseStats>): void {
    for (const k of BASE_STAT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(partial, k)) {
        const v = partial[k];
        if (typeof v === "number" && Number.isFinite(v)) this.playerBase[k] = v;
      }
    }
  }

  // ===================================================================
  // 储物袋（委托给 CharacterInventory）
  // ===================================================================

  setInventorySlot(index: number, item: InventoryStackItem | null): boolean {
    return invSetSlot(this, index, item);
  }

  addToInventory(item: InventoryStackItem): number {
    return invAdd(this, item);
  }

  // ===================================================================
  // 灵石（委托给 CharacterInventory）
  // ===================================================================

  addSpiritStone(name: SpiritStoneName, count: number): void {
    invAddStone(this, count);
  }

  removeSpiritStone(name: SpiritStoneName, count: number): void {
    invRemoveStone(this, count);
  }

  // ===================================================================
  // 功法（委托给 CharacterEquip）
  // ===================================================================

  setGongfaSlot(index: number, item: import("./types/itemInfo").GongfaItemDefinition | null): boolean {
    return eqSetGongfa(this, index, item);
  }

  unequipGongfaToInventory(gongfaSlotIndex: number): boolean {
    return eqUnequipGf(this, gongfaSlotIndex);
  }

  equipGongfaFromInventory(inventoryIndex: number): boolean {
    return eqEquipGf(this, inventoryIndex);
  }

  // ===================================================================
  // 穿戴（委托给 CharacterEquip）
  // ===================================================================

  setEquippedSlot(slot: EquipSlotKey, item: import("./types/itemInfo").TreasureItemDefinition | null): boolean {
    return eqSetEquip(this, slot, item);
  }

  equipFromInventory(inventoryIndex: number): boolean {
    return eqEquip(this, inventoryIndex);
  }

  unequipToInventory(slot: EquipSlotKey): boolean {
    return eqUnequip(this, slot);
  }

  // ===================================================================
  // 详情弹窗动作
  // ===================================================================

  applyDetailAction(a: ProtagonistDetailAction): boolean {
    return eqApply(this, a);
  }

  // ===================================================================
  // 序列化
  // ===================================================================

  toCommonData(): CharacterPlayInfoCommon {
    return {
      id: this.id,
      displayName: this.displayName,
      realm: this.realm,
      playerBase: this.playerBase,
      maxHp: this.maxHp,
      maxMp: this.maxMp,
      currentHp: this.currentHp,
      currentMp: this.currentMp,
      avatarUrl: this.avatarUrl,
      gender: this.gender,
      linggen: this.linggen,
      age: this.age,
      shouyuan: this.shouyuan,
      equippedSlots: this.equippedSlots,
      gongfaSlots: this.gongfaSlots,
      inventorySlots: this.inventorySlots,
    };
  }

  // ===================================================================
  // 静态工具方法
  // ===================================================================

  protected static emptyPlayerBase(): PlayerBaseStats {
    const o: Record<string, number> = {};
    for (const k of BASE_STAT_KEYS) {
      o[k] = (DERIVED_STAT_DEFAULTS as Record<string, number | undefined>)[k] ?? 0;
    }
    return o as PlayerBaseStats;
  }
}
