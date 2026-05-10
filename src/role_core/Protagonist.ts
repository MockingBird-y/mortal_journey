/**
 * @fileoverview 主角玩家类：聚合所有角色数据（境界/属性/HPMP/装备/功法/储物袋），
 * 提供统一的读写方法与派生计算。全局单例通过 `Protagonist.current` 访问（Vue ref）。
 *
 * 储物袋操作见 `ProtagonistInventory.ts`；法宝/功法操作见 `ProtagonistEquip.ts`。
 */

import { ref, type Ref } from "vue";
import type { FateChoiceResult } from "../fate_choice/types";
import type {
  GongfaItemDefinition,
  InventoryStackItem,
  TreasureItemDefinition,
} from "./types/itemInfo";
import {
  PLAYER_STAT_BONUS_KEYS,
  type CultivationRealm,
  type EquippedSlotsState,
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
  type GongfaSlotsState,
  type NarrationPerson,
  type PlayerBaseStats,
  type ProtagonistPlayInfo,
  type TraitEntry,
  type EquipSlotKey,
  type ProtagonistDetailAction,
} from "./types/playInfo";
import { PLAYER_STAT_KEY_TO_ZH, type PlayerStatBonusKey } from "./types/playInfo";
import {
  getBaseStats,
  getEquipBonusRealmRatio,
  getProtagonistNarrativeAge,
  getShouyuanForRealm,
} from "./types/realm_state";
import {
  SPIRIT_STONE_TABLE_KEYS_ORDERED,
  type SpiritStoneName,
} from "./types/spiritStone";
import type { InitStateParsed } from "../ai/init_state_generate";
import type { StateParsed } from "../ai/state_generate";
import {
  buildEquippedSlotsFromParsed,
  buildGongfaSlotsFromParsed,
  buildInventoryFromParsed,
} from "../ai/init_state_generate";
import {
  DEFAULT_INVENTORY_SLOT_COUNT,
  INVENTORY_SLOT_EXPAND_STEP,
  setInventorySlot as invSetSlot,
  addToInventory as invAdd,
  addSpiritStone as invAddStone,
  removeSpiritStone as invRemoveStone,
} from "./ProtagonistInventory";
import {
  isTreasureItem,
  setGongfaSlot as eqSetGongfa,
  unequipGongfaToInventory as eqUnequipGf,
  equipGongfaFromInventory as eqEquipGf,
  setEquippedSlot as eqSetEquip,
  equipFromInventory as eqEquip,
  unequipToInventory as eqUnequip,
  applyDetailAction as eqApply,
} from "./ProtagonistEquip";

/** 主角玩家类：聚合境界、属性、法宝、功法、储物袋等全部角色状态。 */
export class Protagonist {

  /**
   * 当前主角的全局单例（Vue ref）。
   * 在命运抉择确认时通过 `loadFromFateChoice` 写入，应用关闭时通过 `clear` 清空。
   */
  static current: Ref<Protagonist | null> = ref(null);

  /** 开局储物袋默认格数。 */
  static readonly DEFAULT_INVENTORY_SLOT_COUNT = DEFAULT_INVENTORY_SLOT_COUNT;

  /** 储物袋满时每次扩容的空位数。 */
  static readonly INVENTORY_SLOT_EXPAND_STEP = INVENTORY_SLOT_EXPAND_STEP;

  /** 功法栏固定格数。 */
  static readonly GONGFA_SLOT_COUNT = GONGFA_SLOT_COUNT;

  /**
   * 将灵根元素数组格式化为无分隔拼接字符串，供 AI prompt 与 UI 展示。
   *
   * @param elements 灵根元素名列表（如 `["金","木"]`）。
   * @returns 拼接后的连续字符串；空数组时返回 `"—"`。
   */
  static formatLinggenElements(elements: string[]): string {
    const els = elements.map((e) => String(e).trim()).filter(Boolean);
    return els.length ? els.join("") : "—";
  }

  /**
   * 将境界对象格式化为单行展示文案（如 `"练气初期"`），供 AI prompt 与 UI 展示。
   *
   * @param realm 主角的 `realm` 字段。
   * @returns 境界文案；`major` 为空时返回 `"—"`。
   */
  static formatRealm(realm: CultivationRealm): string {
    const major = realm.major?.trim() || "—";
    const minor = realm.minor?.trim() || "";
    return minor ? `${major}${minor}` : major;
  }

  // ===================================================================
  // 数据字段
  // ===================================================================

  readonly role = "protagonist" as const;
  /** 角色唯一标识。 */
  id: string;
  /** 显示名称。 */
  displayName: string;
  /** 叙事人称（第一/第二/第三人称）。 */
  narrationPerson: NarrationPerson;
  /** 出生地点。 */
  birthPlace: string;
  /** 出身故事。 */
  originStory: string;
  /** 头像 URL。 */
  avatarUrl: string;
  /** 性别。 */
  gender: string;
  /** 年龄（岁）。 */
  age: number;
  /** 寿元上限（岁）。 */
  shouyuan: number;
  /** 当前境界。 */
  realm: CultivationRealm;
  /** 当前修为值。 */
  xiuwei: number;
  /** 基础属性十维（境界表底数）。 */
  playerBase: PlayerBaseStats;
  /** 生命上限。 */
  maxHp: number;
  /** 法力上限。 */
  maxMp: number;
  /** 当前生命。 */
  currentHp: number;
  /** 当前法力。 */
  currentMp: number;
  /** 法宝栏（4 格统一法宝槽）。 */
  equippedSlots: EquippedSlotsState;
  /** 功法栏（8 格固定）。 */
  gongfaSlots: GongfaSlotsState;
  /** 储物袋格子列表。 */
  inventorySlots: Array<InventoryStackItem | null>;
  /** 天赋/词条列表。 */
  traits: TraitEntry[];
  /** 灵根元素列表。 */
  linggen: string[];

  /**
   * 从 `ProtagonistPlayInfo` 数据对象构造实例。
   *
   * @param data 符合 `playInfo` 规范的主角数据快照。
   */
  constructor(data: ProtagonistPlayInfo) {
    this.id = data.id;
    this.displayName = data.displayName;
    this.narrationPerson = data.narrationPerson;
    this.birthPlace = data.birthPlace;
    this.originStory = data.originStory;
    this.avatarUrl = data.avatarUrl;
    this.gender = data.gender;
    this.age = data.age;
    this.shouyuan = data.shouyuan;
    this.realm = data.realm;
    this.xiuwei = data.xiuwei;
    this.playerBase = data.playerBase;
    this.maxHp = data.maxHp;
    this.maxMp = data.maxMp;
    this.currentHp = data.currentHp;
    this.currentMp = data.currentMp;
    this.equippedSlots = data.equippedSlots;
    this.gongfaSlots = data.gongfaSlots;
    this.inventorySlots = data.inventorySlots;
    this.traits = data.traits;
    this.linggen = data.linggen;
  }

  // ===================================================================
  // 派生属性
  // ===================================================================

  /** 中文加成键 → 英文运行时属性键的正向映射（由 `PLAYER_STAT_KEY_TO_ZH` 逆推）。 */
  private static readonly ZH_BONUS_TO_PLAYER_KEY: Readonly<Record<string, PlayerStatBonusKey>> = (() => {
    const o: Record<string, PlayerStatBonusKey> = {};
    for (const en of PLAYER_STAT_BONUS_KEYS) {
      o[PLAYER_STAT_KEY_TO_ZH[en]] = en;
    }
    return o;
  })();

  /**
   * 获取境界表底数；若查表失败则回退为实例内存储的 `playerBase`。
   *
   * @returns 境界表行克隆或 `playerBase` 快照。
   */
  private realmTableBaseOrStored(): PlayerBaseStats {
    const fromTable = getBaseStats(this.realm.major, this.realm.minor);
    return fromTable ? { ...fromTable } : { ...this.playerBase };
  }

  /**
   * 将物品 `bonus`（中文键）按境界倍率加算到目标 `PlayerBaseStats` 上。
   * 与 `getEquipBonusRealmRatio` 搭配：每项按 `Math.trunc(value × ratio)` 累加。
   *
   * @param target 被原地累加的十维对象。
   * @param bonus 装备或功法的 `bonus` 对象；`undefined` 或非对象时无操作。
   * @param realmRatio 境界倍率；默认 `1`（不乘）。
   */
  private static addZhItemBonusInto(
    target: PlayerBaseStats,
    bonus: Record<string, number> | undefined,
    realmRatio = 1,
  ): void {
    if (!bonus || typeof bonus !== "object") return;
    const r = typeof realmRatio === "number" && Number.isFinite(realmRatio) && realmRatio > 0 ? realmRatio : 1;
    for (const [zh, v] of Object.entries(bonus)) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const key = Protagonist.ZH_BONUS_TO_PLAYER_KEY[zh];
      if (!key) continue;
      target[key] += Math.trunc(v * r);
    }
  }

  /**
   * 将三佩戴槽与功法栏中所有物品的 `bonus` 累加到目标 `PlayerBaseStats`。
   * 每项均按当前境界的装备倍率计算。
   *
   * @param target 被原地累加的十维对象。
   */
  private addEquippedAndGongfaBonuses(target: PlayerBaseStats): void {
    const ratio = getEquipBonusRealmRatio(this.realm.major, this.realm.minor);
    for (const eq of this.equippedSlots) {
      if (eq) Protagonist.addZhItemBonusInto(target, eq.bonus, ratio);
    }
    for (const gf of this.gongfaSlots) {
      if (gf) Protagonist.addZhItemBonusInto(target, gf.bonus, ratio);
    }
  }

  /**
   * 角色面板应展示的十维最终值：境界底数 + 装备/功法平面加成。
   *
   * @returns 新 `PlayerBaseStats` 对象。
   */
  getDerivedStats(): PlayerBaseStats {
    const merged = this.realmTableBaseOrStored();
    this.addEquippedAndGongfaBonuses(merged);
    return merged;
  }

  // ===================================================================
  // 生命 / 法力（HP / MP）
  // ===================================================================

  /**
   * 设置当前生命与法力，并分别裁剪到 `[0, max]` 区间。
   *
   * @param currentHp 当前生命（会被四舍五入为整数）。
   * @param currentMp 当前法力（会被四舍五入为整数）。
   */
  setCurrentHpMp(currentHp: number, currentMp: number): void {
    const maxH = Math.max(1, this.maxHp);
    const maxM = Math.max(1, this.maxMp);
    this.currentHp = Math.max(0, Math.min(maxH, Math.round(currentHp)));
    this.currentMp = Math.max(0, Math.min(maxM, Math.round(currentMp)));
  }

  /**
   * 设置生命与法力上限（至少为 1），并将当前值裁剪到不超过新上限。
   *
   * @param maxHp 最大生命。
   * @param maxMp 最大法力。
   */
  setMaxHpMp(maxHp: number, maxMp: number): void {
    this.maxHp = Math.max(1, Math.floor(maxHp));
    this.maxMp = Math.max(1, Math.floor(maxMp));
    this.currentHp = Math.min(this.currentHp, this.maxHp);
    this.currentMp = Math.min(this.currentMp, this.maxMp);
  }

  // ===================================================================
  // 境界 · 修为 · 年龄 · 寿元
  // ===================================================================

  /**
   * 设置境界大、小阶段；空白字符串时回退到 `"练气"` / `"初期"`。
   *
   * @param major 大境界名称（如 `"筑基"`）。
   * @param minor 小阶段名称（如 `"中期"`）。
   */
  setRealm(major: string, minor: string): void {
    this.realm = {
      major: major.trim() || "练气",
      minor: minor.trim() || "初期",
    };
  }

  /**
   * 设置修为值；非有限数或负数时归零。
   *
   * @param n 修为值。
   */
  setXiuwei(n: number): void {
    this.xiuwei = typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  /**
   * 设置年龄；非有限数时保持不变。
   *
   * @param age 年龄（岁）。
   */
  setAge(age: number): void {
    this.age = typeof age === "number" && Number.isFinite(age) ? Math.max(0, Math.floor(age)) : this.age;
  }

  /**
   * 设置寿元；非有限数时保持不变。
   *
   * @param n 寿元（岁）。
   */
  setShouyuan(n: number): void {
    this.shouyuan = typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : this.shouyuan;
  }

  /**
   * 设置显示名称；空白时回退为 `"未命名"`。
   *
   * @param name 显示名。
   */
  setDisplayName(name: string): void {
    this.displayName = String(name).trim() || "未命名";
  }

  /**
   * 设置头像 URL；`null`/`undefined` 时存为空串。
   *
   * @param url 头像地址字符串。
   */
  setAvatarUrl(url: string): void {
    this.avatarUrl = url != null ? String(url) : "";
  }

  /**
   * 合并更新 `playerBase` 中出现在 `PLAYER_STAT_BONUS_KEYS` 内的数值字段。
   *
   * @param partial 仅需覆盖的键值对；不在十维键集中的键会被静默忽略。
   */
  patchPlayerBase(partial: Partial<PlayerBaseStats>): void {
    for (const k of PLAYER_STAT_BONUS_KEYS) {
      if (Object.prototype.hasOwnProperty.call(partial, k)) {
        const v = partial[k];
        if (typeof v === "number" && Number.isFinite(v)) this.playerBase[k] = v;
      }
    }
  }

  // ===================================================================
  // 储物袋（委托给 ProtagonistInventory）
  // ===================================================================

  /**
   * 写入储物袋指定格；写入后自动整理（前移空位、收缩行数）。
   *
   * @param index 格子下标。
   * @param item 堆叠物品或 `null`（清空该格）。
   * @returns 下标合法且已写入时为 `true`。
   */
  setInventorySlot(index: number, item: InventoryStackItem | null): boolean {
    return invSetSlot(this, index, item);
  }

  /**
   * 将物品放入第一个空格；袋满时自动扩容一行后再放。
   *
   * @param item 储物堆叠项。
   * @returns 放入的格子下标；扩容后仍失败时为 `-1`。
   */
  addToInventory(item: InventoryStackItem): number {
    return invAdd(this, item);
  }

  // ===================================================================
  // 灵石（委托给 ProtagonistInventory）
  // ===================================================================

  /**
   * 向储物袋中添加灵石；若已有同名灵石堆叠则累加数量，否则在首位空槽创建新堆叠。
   *
   * @param name 灵石种类键。
   * @param count 增加的颗数。
   */
  addSpiritStone(name: SpiritStoneName, count: number): void {
    invAddStone(this, name, count);
  }

  /**
   * 从储物袋中扣除灵石；按堆叠逐格扣减，数量不足时仅扣到零并输出警告。
   *
   * @param name 灵石种类键。
   * @param count 需要扣除的颗数。
   */
  removeSpiritStone(name: SpiritStoneName, count: number): void {
    invRemoveStone(this, name, count);
  }

  // ===================================================================
  // 功法（委托给 ProtagonistEquip）
  // ===================================================================

  /**
   * 写入功法栏指定格。
   *
   * @param index 功法栏下标（`[0, GONGFA_SLOT_COUNT)`）。
   * @param item 功法定义或 `null`（清空）。
   * @returns 下标合法且已写入时为 `true`。
   */
  setGongfaSlot(index: number, item: GongfaItemDefinition | null): boolean {
    return eqSetGongfa(this, index, item);
  }

  /**
   * 将功法栏指定格的功法卸下放入储物袋首个空位；袋满时自动扩容。
   *
   * @param gongfaSlotIndex 功法栏下标。
   * @returns 成功移入（或该格本就为空）时为 `true`。
   */
  unequipGongfaToInventory(gongfaSlotIndex: number): boolean {
    return eqUnequipGf(this, gongfaSlotIndex);
  }

  /**
   * 从储物袋指定格取出功法装备到首个空功法格。
   *
   * @param inventoryIndex 储物袋下标。
   * @returns 装备成功时为 `true`；栏满或该格非功法时为 `false`。
   */
  equipGongfaFromInventory(inventoryIndex: number): boolean {
    return eqEquipGf(this, inventoryIndex);
  }

  // ===================================================================
  // 穿戴（委托给 ProtagonistEquip）
  // ===================================================================

  /**
   * 直接设置法宝栏指定格的物品。
   *
   * @param slot 法宝栏下标（`0 ~ EQUIP_SLOT_COUNT-1`）。
   * @param item 法宝实例或 `null`（卸下）。
   * @returns 下标合法且已写入时为 `true`。
   */
  setEquippedSlot(slot: EquipSlotKey, item: TreasureItemDefinition | null): boolean {
    return eqSetEquip(this, slot, item);
  }

  /**
   * 从储物袋指定格装备法宝到第一个空法宝格；若法宝栏已满则交换到袋中该格。
   *
   * @param inventoryIndex 储物袋下标。
   * @returns 装备成功时为 `true`。
   */
  equipFromInventory(inventoryIndex: number): boolean {
    return eqEquip(this, inventoryIndex);
  }

  /**
   * 将法宝栏指定格的物品卸下放入储物袋首个空位；袋满时自动扩容。
   *
   * @param slot 法宝栏下标。
   * @returns 槽为空（视为成功）或成功放入时为 `true`。
   */
  unequipToInventory(slot: EquipSlotKey): boolean {
    return eqUnequip(this, slot);
  }

  // ===================================================================
  // 详情弹窗动作
  // ===================================================================

  /**
   * 执行主角详情弹窗底部按钮对应的法宝/功法装卸逻辑。
   *
   * @param a 详情弹窗动作判别联合。
   * @returns 操作成功时为 `true`。
   */
  applyDetailAction(a: ProtagonistDetailAction): boolean {
    return eqApply(this, a);
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

    const derived = this.getDerivedStats();
    const capH = Math.max(1, Math.round(derived.hp));
    const capM = Math.max(1, Math.round(derived.mp));
    this.maxHp = capH;
    this.maxMp = capM;
    this.currentHp = capH;
    this.currentMp = capM;
  }

  /**
   * 将 AI 剧情状态变更应用到主角：HP/MP 更新、灵石增减、物品添加/移除。
   *
   * @param state AI 状态生成解析结果（`StateParsed`）。
   */
  applyStateChanges(state: StateParsed): void {
    if (state.userState) {
      this.setCurrentHpMp(state.userState.currentHp, state.userState.currentMp);
    }

    for (const change of state.spiritStoneChanges) {
      if (!SPIRIT_STONE_TABLE_KEYS_ORDERED.includes(change.name as SpiritStoneName)) continue;
      if (change.op === "add") {
        this.addSpiritStone(change.name as SpiritStoneName, change.count);
      } else if (change.op === "remove") {
        this.removeSpiritStone(change.name as SpiritStoneName, change.count);
      }
    }

    for (const item of state.itemAdds) {
      if (item.type === "灵石") continue;
      this.addToInventory({
        name: item.name,
        desc: item.intro,
        grade: item.grade as "下品" | "中品" | "上品" | "极品" | "仙品",
        count: item.count,
        itemType: "杂物",
      } as any);
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
  }

  // ===================================================================
  // 序列化
  // ===================================================================

  /**
   * 导出为纯数据对象（`ProtagonistPlayInfo`），供 JSON 序列化等。
   *
   * @returns 与 `playInfo` 规范一致的纯数据快照。
   */
  toData(): ProtagonistPlayInfo {
    return {
      role: "protagonist",
      id: this.id,
      displayName: this.displayName,
      narrationPerson: this.narrationPerson,
      birthPlace: this.birthPlace,
      originStory: this.originStory,
      avatarUrl: this.avatarUrl,
      gender: this.gender,
      age: this.age,
      shouyuan: this.shouyuan,
      realm: this.realm,
      xiuwei: this.xiuwei,
      playerBase: this.playerBase,
      maxHp: this.maxHp,
      maxMp: this.maxMp,
      currentHp: this.currentHp,
      currentMp: this.currentMp,
      equippedSlots: this.equippedSlots,
      gongfaSlots: this.gongfaSlots,
      inventorySlots: this.inventorySlots,
      traits: this.traits,
      linggen: this.linggen,
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

    const pbRaw = o.playerBase;
    const base = Protagonist.emptyPlayerBase();
    if (pbRaw && typeof pbRaw === "object") {
      const pbo = pbRaw as Record<string, number>;
      for (const k of PLAYER_STAT_BONUS_KEYS) {
        const v = pbo[k];
        if (typeof v === "number" && Number.isFinite(v)) base[k] = v;
      }
    }

    const maxHp = typeof o.maxHp === "number" && Number.isFinite(o.maxHp) ? Math.max(1, Math.floor(o.maxHp)) : Math.max(1, base.hp);
    const maxMp = typeof o.maxMp === "number" && Number.isFinite(o.maxMp) ? Math.max(1, Math.floor(o.maxMp)) : Math.max(1, base.mp);
    const currentHp = typeof o.currentHp === "number" && Number.isFinite(o.currentHp) ? Math.max(0, Math.round(o.currentHp)) : maxHp;
    const currentMp = typeof o.currentMp === "number" && Number.isFinite(o.currentMp) ? Math.max(0, Math.round(o.currentMp)) : maxMp;

    const eq = o.equippedSlots;
    let equippedSlots: EquippedSlotsState = Array.from({ length: EQUIP_SLOT_COUNT }, () => null);
    if (Array.isArray(eq)) {
      for (let i = 0; i < EQUIP_SLOT_COUNT; i++) {
        const raw = eq[i];
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
        equippedSlots[i] = isTreasureItem(legacy[i]) ? legacy[i] as TreasureItemDefinition : null;
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
      birthPlace: typeof o.birthPlace === "string" ? o.birthPlace : "",
      originStory: typeof o.originStory === "string" ? o.originStory : "",
      realm: { major, minor },
      playerBase: { ...base },
      maxHp,
      maxMp,
      currentHp: Math.min(currentHp, maxHp),
      currentMp: Math.min(currentMp, maxMp),
      avatarUrl: typeof o.avatarUrl === "string" ? o.avatarUrl : "",
      gender: typeof o.gender === "string" ? o.gender : "",
      linggen: Array.isArray(o.linggen) ? o.linggen.map((x) => String(x)) : [],
      age: typeof o.age === "number" && Number.isFinite(o.age) ? Math.max(0, Math.floor(o.age)) : 16,
      shouyuan: typeof o.shouyuan === "number" && Number.isFinite(o.shouyuan) ? Math.max(0, Math.floor(o.shouyuan)) : 100,
      inventorySlots: Protagonist.normalizeInventorySlots(o.inventorySlots),
      gongfaSlots: Protagonist.normalizeGongfaSlots(o.gongfaSlots),
      equippedSlots,
      traits: Array.isArray(o.traits) ? (o.traits as TraitEntry[]) : [],
      xiuwei: typeof o.xiuwei === "number" && Number.isFinite(o.xiuwei) ? Math.max(0, o.xiuwei) : 0,
    });
  }

  /**
   * 根据命运抉择结果构造主角实例：境界、属性、年龄、寿元均从查表推导；槽位初始为空。
   * HP/MP 上限会再调用 `getDerivedStats` 对齐境界 + 灵根推导值。
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

    const pb = getBaseStats(major, minor) ?? getBaseStats("练气", "初期") ?? Protagonist.emptyPlayerBase();
    const maxHp = Math.max(1, pb.hp);
    const maxMp = Math.max(1, pb.mp);
    const sy = getShouyuanForRealm(major, minor) ?? getShouyuanForRealm("练气", "初期") ?? 100;

    const age = getProtagonistNarrativeAge(
      { realm: { major }, age: undefined },
      { realm: { major } },
      { defaultAge: 16 },
    );

    const traits = fc.traits.map((t) => ({
      name: t.name,
      desc: t.desc,
      rarity: t.rarity,
      locked: t.locked,
    }));

    const p = new Protagonist({
      role: "protagonist",
      id: "protagonist",
      displayName: basics.playerName.trim() || "未命名",
      narrationPerson: basics.narrationPerson,
      birthPlace: basics.birthPlace.trim(),
      originStory: basics.originStory.trim(),
      realm: { major, minor },
      playerBase: { ...pb },
      maxHp,
      maxMp,
      currentHp: maxHp,
      currentMp: maxMp,
      avatarUrl: "",
      gender: basics.gender,
      linggen: basics.linggen.slice(),
      age,
      shouyuan: sy,
      inventorySlots: Array.from({ length: DEFAULT_INVENTORY_SLOT_COUNT }, () => null),
      gongfaSlots: [null, null, null, null, null, null, null, null],
      equippedSlots: Array.from({ length: EQUIP_SLOT_COUNT }, () => null),
      traits,
      xiuwei: 0,
    });

    const derived = p.getDerivedStats();
    const capH = Math.max(1, Math.round(derived.hp));
    const capM = Math.max(1, Math.round(derived.mp));
    p.maxHp = capH;
    p.maxMp = capM;
    p.currentHp = capH;
    p.currentMp = capM;

    return p;
  }

  // ===================================================================
  // 静态工具方法
  // ===================================================================

  /**
   * 构造各项为 0 的十维属性占位对象。
   *
   * @returns 全零 `PlayerBaseStats`。
   */
  private static emptyPlayerBase(): PlayerBaseStats {
    const o: Record<string, number> = {};
    for (const k of PLAYER_STAT_BONUS_KEYS) o[k] = 0;
    return o as PlayerBaseStats;
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
      base[i] = (raw[i] ?? null) as GongfaItemDefinition | null;
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
    return raw.map((x) => (x == null ? null : (x as InventoryStackItem)));
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
