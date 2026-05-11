/**
 * 角色领域模型 + 境界常量数据表。
 *
 * 结构：数据 → 类型 → 再导出
 *
 * - 数据：属性键/映射、游戏常量、境界数据表、品阶数据表
 * - 类型：基础属性、槽位状态、角色卡接口、UI 动作
 * - 导出：itemInfo 再导出、realmUtils 功能函数再导出
 */

import type {
  TreasureItemDefinition,
  GongfaItemDefinition,
  InventoryStackItem,
} from "./itemInfo";

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 属性键与映射
// ═══════════════════════════════════════════════════════════════════════════

export const PRIMARY_STAT_KEYS = [
  "physique",
  "spirit",
  "guard",
  "perception",
  "agility",
  "crit",
  "insight",
  "fortune",
] as const;

export type PrimaryStatKey = (typeof PRIMARY_STAT_KEYS)[number];

export const PRIMARY_STAT_KEY_TO_ZH: Readonly<Record<PrimaryStatKey, string>> = {
  physique: "体魄",
  spirit: "灵力",
  guard: "护体",
  perception: "神识",
  agility: "身法",
  crit: "会心",
  insight: "悟性",
  fortune: "气运",
};

/**
 * 主属性 → 派生属性映射表。
 * `PCT_DERIVED_KEYS` 内的键按百分比方式计算（基数 × (1 + 主属性 × 比例 ÷ 10000)），
 * 其余键按绝对值加算（主属性 × 比例 ÷ 100 取整）。
 * 例：体魄 100 点 → hp 基数放大 10%、recovery +10。
 */
export const PRIMARY_TO_DERIVED_MAP: Readonly<Record<PrimaryStatKey, ReadonlyArray<{ key: DerivedStatKey; per100: number }>>> = {
  physique: [{ key: "hp", per100: 10 }, { key: "recovery", per100: 10 }],
  spirit: [{ key: "mp", per100: 10 }, { key: "castSpeed", per100: 10 }],
  guard: [{ key: "pdef", per100: 10 }, { key: "mdef", per100: 10 }, { key: "controlResist", per100: 10 }],
  perception: [{ key: "penetration", per100: 10 }],
  agility: [{ key: "dodgeRate", per100: 10 }],
  crit: [{ key: "critRate", per100: 10 }, { key: "actionSpeed", per100: 10 }],
  insight: [{ key: "cultivationSpeed", per100: 10 }],
  fortune: [],
};

/** 按百分比计算的派生属性键（基数来自境界表，主属性对其做乘法放大） */
export const PCT_DERIVED_KEYS: ReadonlySet<string> = new Set(["hp", "mp", "pdef"]);

export const DERIVED_STAT_KEYS = [
  "hp",
  "mp",
  "patk",
  "matk",
  "pdef",
  "mdef",
  "penetration",
  "hitRate",
  "dodgeRate",
  "critRate",
  "critDmg",
  "recovery",
  "castSpeed",
  "actionSpeed",
  "effectChance",
  "cultivationSpeed",
  "controlResist",
  "fireDamage",
  "iceDamage",
  "poisonDamage",
  "lightningDamage",
] as const;

export type DerivedStatKey = (typeof DERIVED_STAT_KEYS)[number];

export const DERIVED_STAT_KEY_TO_ZH: Readonly<Record<DerivedStatKey, string>> = {
  hp: "血量",
  mp: "法力",
  patk: "物攻",
  matk: "法攻",
  pdef: "物防",
  mdef: "法防",
  penetration: "穿透",
  hitRate: "命中率",
  dodgeRate: "闪避率",
  critRate: "暴击率",
  critDmg: "暴击伤害",
  recovery: "恢复效果",
  castSpeed: "施法速度",
  actionSpeed: "行动速度",
  effectChance: "特效几率",
  cultivationSpeed: "修炼速率",
  controlResist: "控制抗性",
  fireDamage: "火伤",
  iceDamage: "冰伤",
  poisonDamage: "毒伤",
  lightningDamage: "雷伤",
};

/** 非境界派生属性的初始默认值（境界表不提供的属性按此初始化） */
export const DERIVED_STAT_DEFAULTS: Readonly<Partial<Record<DerivedStatKey, number>>> = {
  penetration: 0,
  hitRate: 100,
  dodgeRate: 0,
  critRate: 0,
  critDmg: 150,
  recovery: 100,
  castSpeed: 0,
  actionSpeed: 0,
  effectChance: 100,
  cultivationSpeed: 100,
  controlResist: 0,
  fireDamage: 0,
  iceDamage: 0,
  poisonDamage: 0,
  lightningDamage: 0,
};

export type ZhStatBonusMap = Partial<Record<string, number>>;

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 游戏常量
// ═══════════════════════════════════════════════════════════════════════════

export const EQUIP_SLOT_COUNT = 4;
export const GONGFA_SLOT_COUNT = 8;
export const BASE_STAT_KEYS = DERIVED_STAT_KEYS;

export const REALM_ORDER = ["练气", "筑基", "结丹", "元婴", "化神"] as const;
export type RealmMajor = (typeof REALM_ORDER)[number];

export const SUB_STAGES = ["初期", "中期", "后期"] as const;
export type RealmSubStage = (typeof SUB_STAGES)[number];

export type NarrationPerson = "first" | "second" | "third";

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 境界基础属性表（指数公式生成）
// ═══════════════════════════════════════════════════════════════════════════

export interface RealmBaseStatsRow {
  realm: string;
  stage: string;
  hp: number;
  mp: number;
  patk: number;
  matk: number;
  pdef: number;
  mdef: number;
}

const BASE_VALUES = {
  hp: 200, mp: 100, patk: 10, matk: 10, pdef: 5, mdef: 5,
};
const EXPONENT = 1.5;

export function realmStageIndex(realm: string, stage: string): number {
  const majorIdx = (REALM_ORDER as readonly string[]).indexOf(realm);
  if (majorIdx < 0) return 0;
  const minorIdx = (SUB_STAGES as readonly string[]).indexOf(stage);
  if (minorIdx < 0) return 0;
  return majorIdx * SUB_STAGES.length + minorIdx + 1;
}

function computeStats(level: number) {
  const factor = Math.pow(level, EXPONENT);
  return {
    hp: Math.round(BASE_VALUES.hp * factor),
    mp: Math.round(BASE_VALUES.mp * factor),
    patk: Math.round(BASE_VALUES.patk * factor),
    matk: Math.round(BASE_VALUES.matk * factor),
    pdef: Math.round(BASE_VALUES.pdef * factor),
    mdef: Math.round(BASE_VALUES.mdef * factor),
  };
}

export const TABLE: readonly RealmBaseStatsRow[] = (REALM_ORDER as readonly string[]).flatMap(
  (realm) =>
    (SUB_STAGES as readonly string[]).map((stage) => {
      const level = realmStageIndex(realm, stage);
      const stats = computeStats(level);
      return { realm, stage, ...stats };
    }),
);

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 修为需求表（几何增长：base × growth^(level-1)）
// ═══════════════════════════════════════════════════════════════════════════

const CULTIVATION_BASE = 1000;
const CULTIVATION_EXPONENT = 1.5;

function computeCultivation(level: number): number {
  return Math.round(CULTIVATION_BASE * Math.pow(level, CULTIVATION_EXPONENT));
}

export const CULTIVATION_VALUES: readonly number[] = Array.from(
  { length: REALM_ORDER.length * SUB_STAGES.length },
  (_, i) => computeCultivation(i + 1),
);

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 寿元表（按阶段索引）
// ═══════════════════════════════════════════════════════════════════════════

export const SHOUYUAN_VALUES = [
  100, 110, 120,
  200, 225, 250,
  500, 550, 600,
  1000, 1250, 1500,
  2000, 2500, 3000,
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 装备倍率表（按阶段索引）
// ═══════════════════════════════════════════════════════════════════════════

export const EQUIP_BONUS_RATIOS = [
  1.1, 1.25, 1.5,
  2.5, 3.0, 3.5,
  5.5, 6.0, 6.5,
  8.5, 9.0, 9.5,
  10.0, 12.5, 15.0,
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 品阶属性表
// ═══════════════════════════════════════════════════════════════════════════

export interface ItemGradeAttriRow {
  grade: string,
  hp: [number, number],
  mp: [number, number],
  patk: [number, number],
  pdef: [number, number],
  matk: [number, number],
  mdef: [number, number],
  sense: [number, number],
  luck: [number, number],
  dodge: [number, number],
  tenacity: [number, number],
}

export const ITEM_GRADE_ATTRI_TABLE = [
  { grade: "下品", hp: [50, 100], mp: [5, 10], patk: [5, 10], pdef: [5, 10], matk: [5, 10], mdef: [5, 10],
    sense: [5, 10], luck: [5, 10], dodge: [5, 10], tenacity: [5, 10] },
  { grade: "中品", hp: [100, 200], mp: [10, 20], patk: [10, 20], pdef: [10, 20], matk: [10, 20], mdef: [10, 20],
    sense: [10, 20], luck: [10, 20], dodge: [10, 20], tenacity: [10, 20] },
  { grade: "上品", hp: [200, 300], mp: [20, 30], patk: [20, 30], pdef: [20, 30], matk: [20, 30], mdef: [20, 30],
    sense: [20, 30], luck: [20, 30], dodge: [20, 30], tenacity: [20, 30] },
  { grade: "极品", hp: [300, 400], mp: [30, 40], patk: [30, 40], pdef: [30, 40], matk: [30, 40], mdef: [30, 40],
    sense: [30, 40], luck: [30, 40], dodge: [30, 40], tenacity: [30, 40] },
  { grade: "仙品", hp: [400, 500], mp: [40, 50], patk: [40, 50], pdef: [40, 50], matk: [40, 50], mdef: [40, 50],
    sense: [40, 50], luck: [40, 50], dodge: [40, 50], tenacity: [40, 50] },
] as const satisfies readonly ItemGradeAttriRow[];

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 叙事年龄下限
// ═══════════════════════════════════════════════════════════════════════════

export const MIN_NARRATIVE_AGE_BY_MAJOR: Readonly<Record<string, number>> = {
  练气: 16,
  筑基: 100,
  结丹: 200,
  元婴: 500,
  化神: 1000,
};

// ═══════════════════════════════════════════════════════════════════════════
// 二、结构 — 类型与接口
// ═══════════════════════════════════════════════════════════════════════════

export type PlayerBaseStats = {
  hp: number;
  mp: number;
  patk: number;
  matk: number;
  pdef: number;
  mdef: number;
  penetration: number;
  hitRate: number;
  dodgeRate: number;
  critRate: number;
  critDmg: number;
  recovery: number;
  castSpeed: number;
  actionSpeed: number;
  effectChance: number;
  cultivationSpeed: number;
  controlResist: number;
  fireDamage: number;
  iceDamage: number;
  poisonDamage: number;
  lightningDamage: number;
};

export interface CultivationRealm {
  major: string;
  minor: string;
}

export type EquippedSlotsState = Array<TreasureItemDefinition | null>;

type Tuple8<T> = [T, T, T, T, T, T, T, T];
type GongfaSlotCell = GongfaItemDefinition | null;

export type GongfaSlotsState = Tuple8<GongfaSlotCell>;

export type TraitEntry =
  | string
  | {
      name: string;
      desc: string;
      rarity: string;
      locked: boolean;
    };

export interface CharacterPlayInfoCommon {
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
  inventorySlots: Array<InventoryStackItem | null>;
  gongfaSlots: GongfaSlotsState;
  equippedSlots: EquippedSlotsState;
}

export interface ProtagonistPlayInfo extends CharacterPlayInfoCommon {
  role: "protagonist";
  narrationPerson: NarrationPerson;
  birthPlace: string;
  originStory: string;
  traits: TraitEntry[];
  xiuwei: number;
}

export type EquipSlotKey = number;

export type ProtagonistDetailAction =
  | { id: "unequipWear"; equipSlot: EquipSlotKey }
  | { id: "unequipGongfa"; gongfaIndex: number }
  | { id: "equipWearFromBag"; inventoryIndex: number }
  | { id: "equipGongfaFromBag"; inventoryIndex: number };

// ═══════════════════════════════════════════════════════════════════════════
// 三、导出 — itemInfo 再导出
// ═══════════════════════════════════════════════════════════════════════════

export type {
  TreasureItemDefinition,
  GongfaItemDefinition,
  ElixirItemDefinition,
  BreakthroughElixirDefinition,
  PillItemDefinition,
  MaterialItemDefinition,
  MiscItemDefinition,
  CategorizedItemDefinition,
  SpiritStoneInventoryStack,
  TreasureBagStack,
  GongfaBagStack,
  ElixirBagStack,
  BreakthroughElixirBagStack,
  MaterialBagStack,
  MiscBagStack,
  InventoryStackItem,
} from "./itemInfo";

// ═══════════════════════════════════════════════════════════════════════════
// 三、导出 — realmUtils 功能函数再导出
// ═══════════════════════════════════════════════════════════════════════════

export {
  getBaseStats,
  getEquipBonusRealmRatio,
  getProtagonistNarrativeAge,
  getShouyuanForRealm,
  getCultivationRequired,
  getRow,
  hasRow,
  getTable,
  getMinNarrativeAgeForMajor,
  customBirthBackgroundImpliesAgeException,
  resolveEffectiveMajorForNarrativeAge,
} from "../realmUtils";

export type {
  CustomBirthSlice,
  FateChoiceSliceForAge,
  GameSliceForNarrativeAge,
} from "../realmUtils";
