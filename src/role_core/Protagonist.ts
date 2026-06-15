/**
 * @fileoverview 主角玩家类：聚合所有角色数据（境界/属性/HPMP/装备/功法/储物袋），
 * 提供统一的读写方法与派生计算。全局单例通过 `Protagonist.current` 访问（Vue ref）。
 *
 * 继承自 `Character` 基类，主角特有字段：修为/叙事人称/出身/天赋。
 */

import { ref, triggerRef, type Ref } from "vue";import type { FateChoiceResult } from "../fate_choice/types";
import type {
  CategorizedItemDefinition,
  GongfaItemDefinition,
  InventoryStackItem,
  TreasureItemDefinition,
} from "./types/itemInfo";
import type { TreasureSpecialEffect } from "./types/treasure";
import { rollTreasureFunction } from "./types/treasure";
import type { GongfaSpecialEffect, GongfaSystem } from "./types/gongfa";
import { rollGongfaFunction, normalizeGongfaSystem, normalizeGongfaRole } from "./types/gongfa";
import { GONGFA_GRADE_ATTRI_TABLE, rollGradeAttriValue } from "./types/gameConstants";

type SpecialEffect = TreasureSpecialEffect | GongfaSpecialEffect;

function migrateSpecialEffect(fn: any): any {
  if (!fn || typeof fn !== "object") return fn;
  if ("battleEffects" in fn || "modifiers" in fn) return fn;
  return fn;
}
import type {
  EquippedSlotsState,
  GongfaSlotsState,
  NarrationPerson,
  ProtagonistPlayInfo,
  TraitEntry,
  BreakthroughStatus,
  WorldLocation,
  PrimaryStatKey,
} from "./types/playInfo";
import {
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
  PRIMARY_STAT_KEYS,
  REALM_ORDER,
  SUB_STAGES,
  TABLE,
  realmStageIndex,
} from "./types/playInfo";
import {
  type SpiritStoneName,
} from "./types/spiritStone";
import type { ElixirItemDefinition } from "./types/elixir";
import { elixirEffectToStatKey, applyLinggenElixirBoost } from "./types/elixir";
import type { InitStateParsed } from "../ai/init_state_generate";
import type { StateParsed } from "../ai/state_generate";
import {
  buildEquippedSlotsFromParsed,
  buildGongfaSlotsFromParsed,
  buildInventoryFromParsed,
} from "../ai/init_state_generate";
import { Character } from "./Character";
import {
  DEFAULT_INVENTORY_SLOT_COUNT,
  INVENTORY_SLOT_EXPAND_STEP,
  compactInventorySlotsInPlace,
} from "./CharacterInventory";
import { isTreasureItem } from "./CharacterEquip";
import {
  getRealmPrimaryStats,
  getProtagonistNarrativeAge,
  getShouyuanForRealm,
  getMinNarrativeAgeForMajor,
  getMaxNarrativeAgeForMajor,
  parseWorldLocationFromDash,
  formatWorldLocationDash,
  isEmptyWorldLocation,
} from "./types/playInfo";
import { getCultivationRequired, addGongfaMasteryExp } from "./realmUtils";

const VALID_ITEM_TYPES: ReadonlySet<string> = new Set([
  "法宝", "功法", "丹药", "材料", "杂物",
]);

/** 主角玩家类：继承 Character，增加修为、叙事人称、出身、天赋等主角特有状态。 */
export class Protagonist extends Character {

  /**
   * 当前主角的全局单例（Vue ref）。
   * 在命运抉择确认时通过 `loadFromFateChoice` 写入，应用关闭时通过 `clear` 清空。
   */
  static current: Ref<Protagonist | null> = ref(null);

  static notifyChanged(): void {
    triggerRef(Protagonist.current);
  }

  /** 开局储物袋默认格数。 */
  static readonly DEFAULT_INVENTORY_SLOT_COUNT = DEFAULT_INVENTORY_SLOT_COUNT;

  /** 储物袋满时每次扩容的空位数。 */
  static readonly INVENTORY_SLOT_EXPAND_STEP = INVENTORY_SLOT_EXPAND_STEP;

  /** 功法栏固定格数。 */
  static readonly GONGFA_SLOT_COUNT = GONGFA_SLOT_COUNT;

  // ===================================================================
  // 数据字段（主角特有）
  // ===================================================================

  readonly role = "protagonist" as const;
  /** 叙事人称（第一/第二/第三人称）。 */
  narrationPerson: NarrationPerson;
  /** 出生地点。 */
  birthPlace: WorldLocation;
  /** 出身故事。 */
  originStory: string;
  /** 天赋/词条列表。 */
  traits: TraitEntry[];
  /** 当前修为值。 */
  xiuwei: number;
  /** 当前小境界修为是否已圆满。 */
  realmComplete: boolean;
  /** 突破任务状态：idle=正常修炼, ready=修为圆满可尝试突破, in_quest=突破任务进行中。 */
  breakthroughStatus: BreakthroughStatus;

  /**
   * 从 `ProtagonistPlayInfo` 数据对象构造实例。
   *
   * @param data 符合 `playInfo` 规范的主角数据快照。
   */
  constructor(data: ProtagonistPlayInfo) {
    super(data);
    this.narrationPerson = data.narrationPerson;
    this.birthPlace = data.birthPlace;
    this.originStory = data.originStory;
    this.traits = data.traits;
    this.xiuwei = data.xiuwei;
    this.realmComplete = data.realmComplete;
    this.breakthroughStatus = data.breakthroughStatus ?? (data.realmComplete ? "ready" : "idle");
  }

  // ===================================================================
  // 修为
  // ===================================================================

  /**
   * 设置修为值；非有限数或负数时归零。
   *
   * @param n 修为值。
   */
  setXiuwei(n: number): void {
    this.xiuwei = typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
    Protagonist.notifyChanged();
  }

  addXiuwei(amount: number): void {
    if (this.realmComplete) return;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return;
    const cap = getCultivationRequired(this.realm.major, this.realm.minor);
    if (cap == null) {
      this.xiuwei += amount;
      Protagonist.notifyChanged();
      return;
    }
    this.xiuwei = Math.min(this.xiuwei + amount, cap);
    if (this.xiuwei >= cap) {
      this.xiuwei = cap;
      this.realmComplete = true;
      this.breakthroughStatus = "ready";
    }
    Protagonist.notifyChanged();
  }

  breakthrough(): boolean {
    if (!this.realmComplete) return false;
    const majorIdx = REALM_ORDER.indexOf(this.realm.major as typeof REALM_ORDER[number]);
    if (majorIdx < 0) return false;
    const minorIdx = SUB_STAGES.indexOf(this.realm.minor as typeof SUB_STAGES[number]);
    if (minorIdx < 0) return false;

    let nextMajor = this.realm.major;
    let nextMinor = this.realm.minor;

    if (minorIdx < SUB_STAGES.length - 1) {
      nextMinor = SUB_STAGES[minorIdx + 1];
    } else if (majorIdx < REALM_ORDER.length - 1) {
      nextMajor = REALM_ORDER[majorIdx + 1];
      nextMinor = SUB_STAGES[0];
    } else {
      return false;
    }

    this.realm = { major: nextMajor, minor: nextMinor };
    this.xiuwei = 0;
    this.realmComplete = false;
    this.breakthroughStatus = "idle";

    const newBase = getRealmPrimaryStats(nextMajor, nextMinor) ?? getRealmPrimaryStats("练气", "初期") ?? Character.emptyPrimaryStats();
    for (const k of PRIMARY_STAT_KEYS) {
      this.primaryStats[k] = newBase[k] ?? 0;
    }

    const { maxHp: capH, maxMp: capM } = this.computeMaxHpMp();
    this.maxHp = capH;
    this.maxMp = capM;
    this.currentHp = capH;
    this.currentMp = capM;

    const sy = getShouyuanForRealm(nextMajor, nextMinor);
    if (sy != null) this.shouyuan = sy;

    Protagonist.notifyChanged();
    return true;
  }

  // ===================================================================
  // Character mutator overrides — trigger reactivity after change
  // ===================================================================

  override setCurrentHpMp(currentHp: number, currentMp: number): void {
    super.setCurrentHpMp(currentHp, currentMp);
    Protagonist.notifyChanged();
  }

  override setMaxHpMp(maxHp: number, maxMp: number): void {
    super.setMaxHpMp(maxHp, maxMp);
    Protagonist.notifyChanged();
  }

  override setRealm(major: string, minor: string): void {
    super.setRealm(major, minor);
    Protagonist.notifyChanged();
  }

  override setAge(age: number): void {
    super.setAge(age);
    Protagonist.notifyChanged();
  }

  override setShouyuan(n: number): void {
    super.setShouyuan(n);
    Protagonist.notifyChanged();
  }

  override setDisplayName(name: string): void {
    super.setDisplayName(name);
    Protagonist.notifyChanged();
  }

  override setAvatarUrl(url: string): void {
    super.setAvatarUrl(url);
    Protagonist.notifyChanged();
  }

  override patchPrimaryStats(partial: Partial<Record<PrimaryStatKey, number>>): void {
    super.patchPrimaryStats(partial);
    Protagonist.notifyChanged();
  }

  override setInventorySlot(index: number, item: InventoryStackItem | null): boolean {
    const result = super.setInventorySlot(index, item);
    Protagonist.notifyChanged();
    return result;
  }

  override addToInventory(item: InventoryStackItem): number {
    const result = super.addToInventory(item);
    Protagonist.notifyChanged();
    return result;
  }

  override addSpiritStone(name: import("./types/spiritStone").SpiritStoneName, count: number): void {
    super.addSpiritStone(name, count);
    Protagonist.notifyChanged();
  }

  override removeSpiritStone(name: import("./types/spiritStone").SpiritStoneName, count: number): void {
    super.removeSpiritStone(name, count);
    Protagonist.notifyChanged();
  }

  override setGongfaSlot(index: number, item: import("./types/itemInfo").GongfaItemDefinition | null): boolean {
    const result = super.setGongfaSlot(index, item);
    Protagonist.notifyChanged();
    return result;
  }

  override unequipGongfaToInventory(gongfaSlotIndex: number): boolean {
    const result = super.unequipGongfaToInventory(gongfaSlotIndex);
    Protagonist.notifyChanged();
    return result;
  }

  override equipGongfaFromInventory(inventoryIndex: number): boolean {
    const result = super.equipGongfaFromInventory(inventoryIndex);
    Protagonist.notifyChanged();
    return result;
  }

  override setEquippedSlot(slot: import("./types/playInfo").EquipSlotKey, item: import("./types/itemInfo").TreasureItemDefinition | null): boolean {
    const result = super.setEquippedSlot(slot, item);
    Protagonist.notifyChanged();
    return result;
  }

  override equipFromInventory(inventoryIndex: number): boolean {
    const result = super.equipFromInventory(inventoryIndex);
    Protagonist.notifyChanged();
    return result;
  }

  override unequipToInventory(slot: import("./types/playInfo").EquipSlotKey): boolean {
    const result = super.unequipToInventory(slot);
    Protagonist.notifyChanged();
    return result;
  }

  override applyDetailAction(a: import("./types/playInfo").ProtagonistDetailAction): boolean {
    if (a.id === "consumeElixir") {
      const result = this.consumeElixir(a.inventoryIndex);
      Protagonist.notifyChanged();
      return result;
    }
    const result = super.applyDetailAction(a);
    Protagonist.notifyChanged();
    return result;
  }

  // ===================================================================
  // 丹药服用
  // ===================================================================

  consumeElixir(cellIndex: number): boolean {
    const cell = this.inventorySlots[cellIndex];
    if (!cell || !("itemType" in cell) || cell.itemType !== "丹药") return false;
    const pill = cell as ElixirItemDefinition;
    const { effectType, effects } = pill;
    const { value, isPercent } = effects;

    const statKey = elixirEffectToStatKey(effectType);
    if (statKey) {
      this.elixirBonuses[statKey] = (this.elixirBonuses[statKey] ?? 0) + value;
    } else if (effectType === "恢复血量") {
      const amount = isPercent ? Math.round(this.maxHp * value / 100) : value;
      this.currentHp = Math.min(this.currentHp + amount, this.maxHp);
    } else if (effectType === "恢复法力") {
      const amount = isPercent ? Math.round(this.maxMp * value / 100) : value;
      this.currentMp = Math.min(this.currentMp + amount, this.maxMp);
    } else if (effectType === "提升修为") {
      this.addXiuwei(isPercent ? Math.round(this.maxHp * value / 100) : value);
    } else if (effectType === "提升寿元") {
      this.shouyuan += value;
    } else {
      return false;
    }

    pill.count -= 1;
    if (pill.count <= 0) {
      this.inventorySlots[cellIndex] = null;
    }
    Protagonist.notifyChanged();
    return true;
  }

  // ===================================================================
  // 突破任务状态
  // ===================================================================

  setBreakthroughStatus(status: BreakthroughStatus): void {
    this.breakthroughStatus = status;
    Protagonist.notifyChanged();
  }

  onBreakthroughFailed(): void {
    this.breakthroughStatus = "ready";
    Protagonist.notifyChanged();
  }

  isShouyuanExhausted(): boolean {
    return this.shouyuan <= 0;
  }

  applyGongfaMasteryExpChanges(changes: Array<{ gongfaName: string; masteryExpIncrease: number }>): void {
    for (const change of changes) {
      for (const slot of this.gongfaSlots) {
        if (slot && slot.name === change.gongfaName) {
          addGongfaMasteryExp(slot, change.masteryExpIncrease);
          break;
        }
      }
    }
    Protagonist.notifyChanged();
  }

  // ===================================================================
  // AI 开局状态应用
  // ===================================================================

  /**
   * 将 AI 开局状态解析结果应用到主角：写入装备、功法、储物袋，并重新推导 HP/MP 上限与当前值。
   *
   * @param parsed AI 开局状态解析结果（`InitStateParsed`）。
   */
  applyInitState(parsed: InitStateParsed): void {
    this.equippedSlots = buildEquippedSlotsFromParsed(parsed);
    this.gongfaSlots = buildGongfaSlotsFromParsed(parsed);
    this.inventorySlots = buildInventoryFromParsed(parsed, this.realm.major, DEFAULT_INVENTORY_SLOT_COUNT);
    for (const slot of this.inventorySlots) {
      if (slot) applyLinggenElixirBoost(slot, this.linggen, this.realm.major);
    }
    compactInventorySlotsInPlace(this);

    const { maxHp: capH, maxMp: capM } = this.computeMaxHpMp();
    this.maxHp = capH;
    this.maxMp = capM;
    this.currentHp = Math.max(0, Math.min(capH, Math.round(capH * parsed.hpPercent / 100)));
    this.currentMp = Math.max(0, Math.min(capM, Math.round(capM * parsed.mpPercent / 100)));

    if (typeof parsed.protagonistAge === "number" && parsed.protagonistAge > 0) {
      const minAge = getMinNarrativeAgeForMajor(this.realm.major);
      const maxAge = Math.min(this.shouyuan - 1, getMaxNarrativeAgeForMajor(this.realm.major));
      const clampedAge = Math.max(minAge, Math.min(maxAge, parsed.protagonistAge));
      this.setAge(clampedAge);
      this.ageConfirmed = true;
    } else {
      const minAge = getMinNarrativeAgeForMajor(this.realm.major);
      this.setAge(minAge);
      this.ageConfirmed = true;
    }

    Protagonist.notifyChanged();
  }

  /**
   * 将 AI 剧情状态变更应用到主角：HP/MP 更新、灵石增减、物品添加/移除。
   *
   * @param state AI 状态生成解析结果（`StateParsed`）。
   */
  applyStateChanges(state: StateParsed): void {
    if (state.hpMp) {
      this.setCurrentHpMp(
        Math.round(this.maxHp * state.hpMp.hpPercent / 100),
        Math.round(this.maxMp * state.hpMp.mpPercent / 100),
      );
    }

    if (state.userState) {
      if (typeof state.userState.xiuweiIncrease === "number") {
        this.addXiuwei(state.userState.xiuweiIncrease);
      }
      if (state.userState.gongfaMasteryChanges
          && state.userState.gongfaMasteryChanges.length > 0) {
        this.applyGongfaMasteryExpChanges(state.userState.gongfaMasteryChanges);
        const totalMasteryExp = state.userState.gongfaMasteryChanges
          .reduce((sum, c) => sum + c.masteryExpIncrease, 0);
        this.addXiuwei(totalMasteryExp);
      }
    }

    if (state.breakthrough) {
      if (state.breakthrough.breakthroughQuestStart === true
          && this.breakthroughStatus === "ready") {
        this.setBreakthroughStatus("in_quest");
      }
      if (state.breakthrough.breakthroughFailed === true
          && this.breakthroughStatus === "in_quest") {
        this.onBreakthroughFailed();
      }
      if (state.breakthrough.realmBreakthrough === true) {
        this.breakthrough();
      }
    }

    for (const change of state.spiritStoneChanges) {
      if (change.op === "add") {
        this.addSpiritStone("灵石", change.count);
      } else if (change.op === "remove") {
        this.removeSpiritStone("灵石", change.count);
      }
    }

    for (const item of state.itemAdds) {
      if (item.type === "灵石") continue;
      const itemType = VALID_ITEM_TYPES.has(item.type) ? item.type as CategorizedItemDefinition["itemType"] : "杂物";
      let fn: SpecialEffect | undefined;
      const grade = item.grade as import("./types/itemInfo").ItemGrade;
      if (itemType === "法宝") {
        fn = rollTreasureFunction(grade);
      } else if (itemType === "功法") {
        const itemRec = item as unknown as Record<string, unknown>;
        const system = normalizeGongfaSystem(itemRec.system);
        const role = normalizeGongfaRole(itemRec.role);
        const bonusName = typeof itemRec.bonus === "string" ? itemRec.bonus.trim() : "";
        const validBonus = new Set(Object.keys(GONGFA_GRADE_ATTRI_TABLE));
        const bonus = validBonus.has(bonusName)
          ? { [bonusName]: rollGradeAttriValue(bonusName, grade, GONGFA_GRADE_ATTRI_TABLE) }
          : {};
        fn = rollGongfaFunction(system, grade, role);
        this.addToInventory({
          name: item.name,
          desc: item.intro,
          grade,
          count: item.count,
          itemType,
          system,
          role,
          mastery: 1,
          bonus,
          function: fn,
        } as InventoryStackItem);
        continue;
      }
      this.addToInventory({
        name: item.name,
        desc: item.intro,
        grade,
        count: item.count,
        itemType,
        ...(fn ? { function: fn } : {}),
      } as InventoryStackItem);
    }

    for (const item of state.itemRemoves) {
      let remaining = item.count;
      for (let i = 0; i < this.inventorySlots.length && remaining > 0; i++) {
        const cell = this.inventorySlots[i];
        if (!cell || !("name" in cell) || cell.name !== item.name) continue;
        const take = Math.min(remaining, cell.count);
        cell.count -= take;
        remaining -= take;
        if (cell.count <= 0) this.setInventorySlot(i, null);
      }
    }

    Protagonist.notifyChanged();
  }
  // ===================================================================

  /**
   * 导出为纯数据对象（`ProtagonistPlayInfo`），供 JSON 序列化等。
   *
   * @returns 与 `playInfo` 规范一致的纯数据快照。
   */
  toData(): ProtagonistPlayInfo {
    const base = this.toCommonData();
    return {
      ...base,
      role: "protagonist",
      narrationPerson: this.narrationPerson,
      birthPlace: this.birthPlace,
      originStory: this.originStory,
      traits: this.traits,
      xiuwei: this.xiuwei,
      realmComplete: this.realmComplete,
      breakthroughStatus: this.breakthroughStatus,
    };
  }

  /**
   * 将当前主角序列化为 JSON 字符串。
   *
   * @param pretty 为 `true` 时使用 2 空格缩进；默认不格式化。
   * @returns JSON 字符串。
   */
  toJsonString(pretty?: boolean): string {
    return pretty ? JSON.stringify(this.toData(), null, 2) : JSON.stringify(this.toData());
  }

  /**
   * 返回当前主角状态的深拷贝快照；对快照的修改不影响原实例。
   *
   * @returns 克隆后的 `Protagonist` 实例。
   */
  getSnapshot(): Protagonist {
    return Protagonist.fromData(this.toData());
  }

  // ===================================================================
  // 静态工厂方法
  // ===================================================================

  /**
   * 从纯数据对象构造 `Protagonist` 实例。
   *
   * @param data 符合 `playInfo` 规范的对象。
   * @returns 新实例。
   */
  static fromData(data: ProtagonistPlayInfo): Protagonist {
    return new Protagonist(data);
  }

  /**
   * 从 JSON 字符串或已解析对象规范化构造 `Protagonist`；解析失败或 `role` 非 `"protagonist"` 时返回 `null`。
   *
   * @param input JSON 字符串或已解析对象。
   * @returns 规范化的 `Protagonist` 实例；失败时为 `null`。
   */
  static fromJson(input: string | unknown): Protagonist | null {
    let data: unknown = input;
    if (typeof input === "string") {
      try {
        data = JSON.parse(input) as unknown;
      } catch {
        return null;
      }
    }
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    if (o.role !== "protagonist") return null;

    const realmRaw = o.realm;
    const major =
      realmRaw && typeof realmRaw === "object" && typeof (realmRaw as { major?: unknown }).major === "string"
        ? String((realmRaw as { major: string }).major).trim() || "练气"
        : "练气";
    const minor =
      realmRaw && typeof realmRaw === "object" && typeof (realmRaw as { minor?: unknown }).minor === "string"
        ? String((realmRaw as { minor: string }).minor).trim() || "初期"
        : "初期";

    const psRaw = o.primaryStats;
    const base = Protagonist.emptyPrimaryStats();
    if (psRaw && typeof psRaw === "object") {
      const pso = psRaw as Record<string, number>;
      for (const k of PRIMARY_STAT_KEYS) {
        const v = pso[k];
        if (typeof v === "number" && Number.isFinite(v)) base[k] = v;
      }
    }

    const maxHp = typeof o.maxHp === "number" && Number.isFinite(o.maxHp) ? Math.max(1, Math.floor(o.maxHp)) : 100;
    const maxMp = typeof o.maxMp === "number" && Number.isFinite(o.maxMp) ? Math.max(1, Math.floor(o.maxMp)) : 50;
    const currentHp = typeof o.currentHp === "number" && Number.isFinite(o.currentHp) ? Math.max(0, Math.round(o.currentHp)) : maxHp;
    const currentMp = typeof o.currentMp === "number" && Number.isFinite(o.currentMp) ? Math.max(0, Math.round(o.currentMp)) : maxMp;

    const eq = o.equippedSlots;
    let equippedSlots: EquippedSlotsState = Array.from({ length: EQUIP_SLOT_COUNT }, () => null);
    if (Array.isArray(eq)) {
      for (let i = 0; i < EQUIP_SLOT_COUNT; i++) {
        const raw = eq[i];
        if (raw && typeof raw === "object" && "function" in (raw as any)) {
          (raw as any).function = migrateSpecialEffect((raw as any).function);
        }
        equippedSlots[i] = isTreasureItem(raw) ? raw as TreasureItemDefinition : null;
      }
    } else if (eq && typeof eq === "object") {
      const e = eq as Record<string, unknown>;
      const legacy: unknown[] = [
        e.weapon,
        e.faqi,
        e.armor,
      ];
      for (let i = 0; i < Math.min(legacy.length, EQUIP_SLOT_COUNT); i++) {
        const raw = legacy[i];
        if (raw && typeof raw === "object" && "function" in (raw as any)) {
          (raw as any).function = migrateSpecialEffect((raw as any).function);
        }
        equippedSlots[i] = isTreasureItem(raw) ? raw as TreasureItemDefinition : null;
      }
    }

    const npRaw = o.narrationPerson;
    const narrationPerson: NarrationPerson =
      npRaw === "first" || npRaw === "second" || npRaw === "third" ? npRaw : "second";

    return new Protagonist({
      role: "protagonist",
      id: typeof o.id === "string" && o.id.trim() !== "" ? o.id.trim() : "protagonist",
      displayName: typeof o.displayName === "string" ? o.displayName : "未命名",
      narrationPerson,
      birthPlace: typeof o.birthPlace === "string"
        ? (parseWorldLocationFromDash(o.birthPlace) ?? { region: "", country: "", area: "", detail: o.birthPlace })
        : (o.birthPlace && typeof o.birthPlace === "object" ? o.birthPlace as WorldLocation : { region: "", country: "", area: "", detail: "" }),
      originStory: typeof o.originStory === "string" ? o.originStory : "",
      realm: { major, minor },
      primaryStats: { ...base },
      maxHp,
      maxMp,
      currentHp: Math.min(currentHp, maxHp),
      currentMp: Math.min(currentMp, maxMp),
      avatarUrl: typeof o.avatarUrl === "string" ? o.avatarUrl : "",
      gender: typeof o.gender === "string" ? o.gender : "",
      linggen: Array.isArray(o.linggen) ? o.linggen.map((x) => String(x)) : [],
      age: typeof o.age === "number" && Number.isFinite(o.age) ? Math.max(0, Math.floor(o.age)) : 16,
      ageConfirmed: typeof o.ageConfirmed === "boolean" ? o.ageConfirmed : false,
      shouyuan: typeof o.shouyuan === "number" && Number.isFinite(o.shouyuan) ? Math.max(0, Math.floor(o.shouyuan)) : 100,
      inventorySlots: Protagonist.normalizeInventorySlots(o.inventorySlots),
      gongfaSlots: Protagonist.normalizeGongfaSlots(o.gongfaSlots),
      equippedSlots,
      traits: Array.isArray(o.traits) ? (o.traits as TraitEntry[]) : [],
      xiuwei: typeof o.xiuwei === "number" && Number.isFinite(o.xiuwei) ? Math.max(0, o.xiuwei) : 0,
      realmComplete: o.realmComplete === true,
      breakthroughStatus: Protagonist.normalizeBreakthroughStatus(o.breakthroughStatus, o.realmComplete === true),
    });
  }

  /**
   * 根据命运抉择结果构造主角实例：境界、属性、年龄、寿元均从查表推导；槽位初始为空。
   * HP/MP 上限会再调用 `computeMaxHpMp` 对齐境界 + 主属性推导值。
   *
   * @param fc 命运抉择结果。
   * @returns 新 `Protagonist` 实例。
   */
  static fromFateChoice(fc: FateChoiceResult): Protagonist {
    const { basics } = fc;
    const major = basics.realmMajor.trim() || "练气";
    const minor = (basics.realmMinor != null && String(basics.realmMinor).trim() !== ""
      ? String(basics.realmMinor).trim()
      : "初期") as string;

    const pb = getRealmPrimaryStats(major, minor) ?? getRealmPrimaryStats("练气", "初期") ?? Character.emptyPrimaryStats();
    const sy = getShouyuanForRealm(major, minor) ?? getShouyuanForRealm("练气", "初期") ?? 100;

    const realmRow = (() => {
      for (const row of TABLE) {
        if (row.realm === major && row.stage === minor) return row;
      }
      return TABLE[0];
    })();
    const maxHp = Math.max(1, Math.round((realmRow.hp + pb.physique * 10) * (1 + pb.physique / 1000)));
    const maxMp = Math.max(1, Math.round((realmRow.mp + pb.spirit * 10) * (1 + pb.spirit / 1000)));

    const age = getProtagonistNarrativeAge(
      { realm: { major }, age: undefined },
      { realm: { major } },
      { defaultAge: 16 },
    );

    const traits = fc.traits.map((t) => ({
      name: t.name,
      desc: t.desc,
      rarity: t.rarity,
    }));

    const p = new Protagonist({
      role: "protagonist",
      id: "protagonist",
      displayName: basics.playerName.trim() || "未命名",
      narrationPerson: basics.narrationPerson,
      birthPlace: basics.birthPlace,
      originStory: basics.originStory.trim(),
      realm: { major, minor },
      primaryStats: { ...pb },
      maxHp,
      maxMp,
      currentHp: maxHp,
      currentMp: maxMp,
      avatarUrl: "",
      gender: basics.gender,
      linggen: basics.linggen.slice(),
      age,
      ageConfirmed: false,
      shouyuan: sy,
      inventorySlots: Array.from({ length: DEFAULT_INVENTORY_SLOT_COUNT }, () => null),
      gongfaSlots: [null, null, null, null, null, null, null, null],
      equippedSlots: Array.from({ length: EQUIP_SLOT_COUNT }, () => null),
      traits,
      xiuwei: 0,
      realmComplete: false,
      breakthroughStatus: "idle",
    });

    const { maxHp: capH, maxMp: capM } = p.computeMaxHpMp();
    p.maxHp = capH;
    p.maxMp = capM;
    p.currentHp = capH;
    p.currentMp = capM;

    return p;
  }

  // ===================================================================
  // 静态工具方法
  // ===================================================================

  private static normalizeBreakthroughStatus(raw: unknown, realmComplete: boolean): BreakthroughStatus {
    if (raw === "in_quest") return "in_quest";
    if (raw === "ready") return "ready";
    if (raw === "idle") return "idle";
    return realmComplete ? "ready" : "idle";
  }

  /**
   * 将存档中的功法栏数组规范为固定长度、逐项可为 `null`。
   *
   * @param raw 从 JSON 读入的未知值。
   * @returns 长度等于 `GONGFA_SLOT_COUNT` 的功法栏数组。
   */
  private static normalizeGongfaSlots(raw: unknown): GongfaSlotsState {
    const base: GongfaSlotsState = [null, null, null, null, null, null, null, null];
    if (!Array.isArray(raw)) return base;
    for (let i = 0; i < GONGFA_SLOT_COUNT; i++) {
      const item = raw[i] ?? null;
      if (item && typeof item === "object" && "function" in (item as any)) {
        const o = item as any;
        o.function = migrateSpecialEffect(o.function);
      }
      if (item && typeof item === "object" && (item as any).itemType === "功法" && typeof (item as any).mastery !== "number") {
        (item as any).mastery = 1;
      }
      base[i] = item as GongfaItemDefinition | null;
    }
    return base;
  }

  /**
   * 将存档中的储物袋数组规范为 `InventoryStackItem | null` 列表。
   *
   * @param raw 从 JSON 读入的未知值。
   * @returns 规范化的储物格数组；非法输入时返回空数组。
   */
  private static normalizeInventorySlots(raw: unknown): Array<InventoryStackItem | null> {
    if (!Array.isArray(raw)) {
      return Array.from({ length: DEFAULT_INVENTORY_SLOT_COUNT }, () => null);
    }
    const result = raw.map((x) => {
      if (x == null) return null;
      const item = x as any;
      if (item && typeof item === "object" && "function" in item) {
        item.function = migrateSpecialEffect(item.function);
      }
      if (item && typeof item === "object" && item.itemType === "功法" && typeof item.mastery !== "number") {
        item.mastery = 1;
      }
      return item as InventoryStackItem;
    });
    const carrier = { inventorySlots: result };
    compactInventorySlotsInPlace(carrier);
    return carrier.inventorySlots;
  }

  // ===================================================================
  // 全局单例操作
  // ===================================================================

  /**
   * 将当前实例设为全局单例；UI 通过 `Protagonist.current` / `protagonist` ref 订阅。
   */
  setAsCurrent(): void {
    Protagonist.current.value = this;
  }

  /**
   * 从 JSON 字符串或对象解析并设为全局单例。
   *
   * @param input 与 `fromJson` 相同的输入参数。
   * @returns 解析成功且已设置为 `true`；失败为 `false`。
   */
  static loadFromJson(input: string | unknown): boolean {
    const p = Protagonist.fromJson(input);
    if (!p) return false;
    p.setAsCurrent();
    return true;
  }

  /**
   * 根据命运抉择结果创建主角并设为全局单例。
   *
   * @param fc 命运抉择结果。
   */
  static loadFromFateChoice(fc: FateChoiceResult): void {
    const p = Protagonist.fromFateChoice(fc);
    p.setAsCurrent();
  }

  /**
   * 清空全局单例，将 `Protagonist.current` 置为 `null`。
   */
  static clear(): void {
    Protagonist.current.value = null;
  }
}

/** 当前主角全局单例（Vue ref）。等同于 `Protagonist.current`。 */
export const protagonist: Ref<Protagonist | null> = Protagonist.current;
