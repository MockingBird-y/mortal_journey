/**
 * 角色领域模型 + 境界常量数据表。
 *
 * 结构：数据 → 类型 → 再导出
 *
 * - 数据：属性键/映射（具体数值见 gameConstants.ts）
 * - 类型：基础属性、槽位状态、角色卡接口、UI 动作
 * - 导出：itemInfo 再导出、realmUtils 功能函数再导出、gameConstants 再导出
 */

import type {
  TreasureItemDefinition,
  GongfaItemDefinition,
  InventoryStackItem,
} from "./itemInfo";

import {
  BASE_VALUES,
  EXPONENT,
  CULTIVATION_BASE,
  CULTIVATION_EXPONENT,
  SHOUYUAN_VALUES,
  EQUIP_BONUS_RATIOS,
  LINGQI_AFFINITY_BONUS,
  DERIVED_STAT_DEFAULTS,
  PRIMARY_TO_DERIVED_MAP,
  PCT_DERIVED_KEYS,
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
  ITEM_GRADE_ATTRI_TABLE,
  MIN_NARRATIVE_AGE_BY_MAJOR,
} from "./gameConstants";

export {
  BASE_VALUES,
  EXPONENT,
  CULTIVATION_BASE,
  CULTIVATION_EXPONENT,
  SHOUYUAN_VALUES,
  EQUIP_BONUS_RATIOS,
  LINGQI_AFFINITY_BONUS,
  DERIVED_STAT_DEFAULTS,
  PRIMARY_TO_DERIVED_MAP,
  PCT_DERIVED_KEYS,
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
  ITEM_GRADE_ATTRI_TABLE,
  MIN_NARRATIVE_AGE_BY_MAJOR,
};

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

export const PRIMARY_STAT_KEY_DESC: Readonly<Record<PrimaryStatKey, string>> = {
  physique: "影响生命值上限与每回合恢复量",
  spirit: "影响法力值上限与施法速度",
  guard: "影响物理防御、法术防御与控制抗性",
  perception: "影响命中率与暴击伤害",
  agility: "影响闪避率与行动速度",
  crit: "影响暴击率与特效触发几率",
  insight: "影响修炼速度与功法领悟效率",
  fortune: "影响物品掉落品质与随机事件收益",
};

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
  "controlResist",
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
  controlResist: "控制抗性",
};

export type ZhStatBonusMap = Partial<Record<string, number>>;

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 游戏常量（结构部分）
// ═══════════════════════════════════════════════════════════════════════════

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

function computeCultivation(level: number): number {
  return Math.round(CULTIVATION_BASE * Math.pow(level, CULTIVATION_EXPONENT));
}

export const CULTIVATION_VALUES: readonly number[] = Array.from(
  { length: REALM_ORDER.length * SUB_STAGES.length },
  (_, i) => computeCultivation(i + 1),
);

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
  MaterialItemDefinition,
  MiscItemDefinition,
  CategorizedItemDefinition,
  SpiritStoneInventoryStack,
  TreasureBagStack,
  GongfaBagStack,
  ElixirBagStack,
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
  getEquipBonusRatioWithAffinity,
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
