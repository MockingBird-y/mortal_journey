import type { InventoryStackItem } from "./types/itemInfo";
import type {
  CultivationRealm,
  EquippedSlotsState,
  GongfaSlotsState,
  EquipSlotKey,
  ProtagonistDetailAction,
  PrimaryStatKey,
  CharacterPlayInfoCommon,
} from "./types/playInfo";
import {
  PRIMARY_STAT_KEYS,
  PRIMARY_STAT_KEY_TO_ZH,
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
  TABLE,
} from "./types/playInfo";
import {
  getRealmPrimaryStats,
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

const HP_PER_PHYSIQUE = 10;
const MP_PER_SPIRIT = 10;

export class Character {

  id: string;
  displayName: string;
  realm: CultivationRealm;
  primaryStats: Record<PrimaryStatKey, number>;
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
  elixirBonuses: Record<string, number>;

  constructor(data: CharacterPlayInfoCommon) {
    this.id = data.id;
    this.displayName = data.displayName;
    this.realm = data.realm;
    this.primaryStats = { ...data.primaryStats };
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
    this.elixirBonuses = data.elixirBonuses ? { ...data.elixirBonuses } : {};
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
  // 主属性计算
  // ===================================================================

  protected static readonly ZH_BONUS_TO_PRIMARY_KEY: Readonly<Record<string, PrimaryStatKey>> = (() => {
    const o: Record<string, PrimaryStatKey> = {};
    for (const en of Object.keys(PRIMARY_STAT_KEY_TO_ZH) as PrimaryStatKey[]) {
      o[PRIMARY_STAT_KEY_TO_ZH[en]] = en;
    }
    return o;
  })();

  protected realmTableBaseOrStored(): Record<PrimaryStatKey, number> {
    const fromTable = getRealmPrimaryStats(this.realm.major, this.realm.minor);
    return fromTable ? { ...fromTable } : { ...this.primaryStats };
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
      const key = Character.ZH_BONUS_TO_PRIMARY_KEY[zh];
      if (!key) continue;
      target[key] = (target[key] ?? 0) + Math.trunc(v * r);
    }
  }

  protected collectPrimaryBonuses(): Record<string, number> {
    const base = this.realmTableBaseOrStored();
    const primaryStats: Record<string, number> = {};
    for (const k of PRIMARY_STAT_KEYS) {
      primaryStats[k] = base[k] ?? 0;
    }
    for (const gf of this.gongfaSlots) {
      if (!gf) continue;
      const mastery = gf.mastery ?? 1;
      const masteryMult = 0.5 + (mastery - 1) * 0.28;
      const adjusted: Record<string, number> = {};
      for (const [k, v] of Object.entries(gf.bonus as Record<string, number>)) {
        if (typeof v === "number" && Number.isFinite(v)) {
          adjusted[k] = Math.trunc(v * masteryMult);
        }
      }
      Character.addZhItemBonusInto(primaryStats, adjusted);
    }
    for (const [k, v] of Object.entries(this.elixirBonuses)) {
      if (typeof v === "number" && v !== 0) primaryStats[k] = (primaryStats[k] ?? 0) + v;
    }
    return primaryStats;
  }

  getComputedPrimaryStats(): Readonly<Record<PrimaryStatKey, number>> {
    return this.collectPrimaryBonuses() as Readonly<Record<PrimaryStatKey, number>>;
  }

  getPrimaryStats(): Readonly<Record<PrimaryStatKey, number>> {
    return this.getComputedPrimaryStats();
  }

  computeMaxHpMp(): { maxHp: number; maxMp: number } {
    const stats = this.getComputedPrimaryStats();
    const realmRow = this.getRealmRow();
    const baseHp = realmRow?.hp ?? 200;
    const baseMp = realmRow?.mp ?? 100;
    const maxHp = Math.max(1, Math.round(baseHp * (1 + (stats.physique * HP_PER_PHYSIQUE) / 10000)));
    const maxMp = Math.max(1, Math.round(baseMp * (1 + (stats.spirit * MP_PER_SPIRIT) / 10000)));
    return { maxHp, maxMp };
  }

  protected getRealmRow(): { hp: number; mp: number } | null {
    for (const row of TABLE) {
      if (row.realm === this.realm.major && row.stage === this.realm.minor) {
        return row;
      }
    }
    return null;
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

  patchPrimaryStats(partial: Partial<Record<PrimaryStatKey, number>>): void {
    for (const k of PRIMARY_STAT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(partial, k)) {
        const v = partial[k];
        if (typeof v === "number" && Number.isFinite(v)) this.primaryStats[k] = v;
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
      primaryStats: { ...this.primaryStats },
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
      elixirBonuses: this.elixirBonuses,
    };
  }

  // ===================================================================
  // 静态工具方法
  // ===================================================================

  protected static emptyPrimaryStats(): Record<PrimaryStatKey, number> {
    const o: Record<string, number> = {};
    for (const k of PRIMARY_STAT_KEYS) {
      o[k] = 0;
    }
    return o as Record<PrimaryStatKey, number>;
  }
}
