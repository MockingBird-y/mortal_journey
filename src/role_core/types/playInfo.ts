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
  REALM_BASE_STATS_TABLE,
  CULTIVATION_VALUES_TABLE,
  SHOUYUAN_VALUES,
  EQUIP_BONUS_RATIOS,
  DERIVED_STAT_DEFAULTS,
  PRIMARY_TO_DERIVED_MAP,
  PCT_DERIVED_KEYS,
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
  GONGFA_GRADE_ATTRI_TABLE,
  TREASURE_GRADE_ATTRI_TABLE,
  MIN_NARRATIVE_AGE_BY_MAJOR,
  TREASURE_BONUS_COUNT_BY_GRADE,
  rollGradeAttriValue,
} from "./gameConstants";

export {
  REALM_BASE_STATS_TABLE,
  CULTIVATION_VALUES_TABLE,
  SHOUYUAN_VALUES,
  EQUIP_BONUS_RATIOS,
  DERIVED_STAT_DEFAULTS,
  PRIMARY_TO_DERIVED_MAP,
  PCT_DERIVED_KEYS,
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
  GONGFA_GRADE_ATTRI_TABLE,
  TREASURE_GRADE_ATTRI_TABLE,
  MIN_NARRATIVE_AGE_BY_MAJOR,
  TREASURE_BONUS_COUNT_BY_GRADE,
  rollGradeAttriValue,
};

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 属性键与映射
// ═══════════════════════════════════════════════════════════════════════════

export const PRIMARY_STAT_KEYS = [
  "physique",
  "spirit",
  "strength",
  "perception",
  "guard",
  "agility",
  "insight",
  "fortune",
] as const;

export type PrimaryStatKey = (typeof PRIMARY_STAT_KEYS)[number];

export const PRIMARY_STAT_KEY_TO_ZH: Readonly<Record<PrimaryStatKey, string>> = {
  physique: "体魄",
  spirit: "灵力",
  strength: "劲力",
  perception: "神识",
  guard: "护体",
  agility: "身法",
  insight: "悟性",
  fortune: "气运",
};

export const PRIMARY_STAT_KEY_DESC: Readonly<Record<PrimaryStatKey, string>> = {
  physique: "增加血量",
  spirit: "增加法力",
  strength: "增加物攻",
  perception: "增加法攻",
  guard: "增加物防法防",
  agility: "增加闪避率",
  insight: "增加修炼速度，修炼功法所需灵石更少",
  fortune: "增加幸运值，更高概率获取高品阶物品",
};

export const DERIVED_STAT_KEYS = [
  "hp",
  "mp",
  "hpRecovery",
  "mpRecovery",
  "patk",
  "matk",
  "pdef",
  "mdef",
  "penetration",
  "magicPenetration",
  "hitRate",
  "dodgeRate",
  "critRate",
  "critDmg",
] as const;

export type DerivedStatKey = (typeof DERIVED_STAT_KEYS)[number];

export const DERIVED_STAT_KEY_TO_ZH: Readonly<Record<DerivedStatKey, string>> = {
  hp: "血量",
  mp: "法力",
  hpRecovery: "生命回复",
  mpRecovery: "法力回复",
  patk: "物攻",
  matk: "法攻",
  pdef: "物防",
  mdef: "法防",
  penetration: "物伤穿透",
  magicPenetration: "法伤穿透",
  hitRate: "命中率",
  dodgeRate: "闪避率",
  critRate: "暴击率",
  critDmg: "暴击伤害",
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
}

export function realmStageIndex(realm: string, stage: string): number {
  const majorIdx = (REALM_ORDER as readonly string[]).indexOf(realm);
  if (majorIdx < 0) return 0;
  const minorIdx = (SUB_STAGES as readonly string[]).indexOf(stage);
  if (minorIdx < 0) return 0;
  return majorIdx * SUB_STAGES.length + minorIdx + 1;
}

export const TABLE: readonly RealmBaseStatsRow[] = (REALM_ORDER as readonly string[]).flatMap(
  (realm) =>
    (SUB_STAGES as readonly string[]).map((stage, minorIdx) => {
      const majorIdx = (REALM_ORDER as readonly string[]).indexOf(realm);
      const idx = majorIdx * SUB_STAGES.length + minorIdx;
      const row = REALM_BASE_STATS_TABLE[Math.min(idx, REALM_BASE_STATS_TABLE.length - 1)];
      return { realm, stage, hp: row.hp, mp: row.mp };
    }),
);

export const CULTIVATION_VALUES: readonly number[] = CULTIVATION_VALUES_TABLE;

// ═══════════════════════════════════════════════════════════════════════════
// 二、结构 — 类型与接口
// ═══════════════════════════════════════════════════════════════════════════

export type PlayerBaseStats = {
  hp: number;
  mp: number;
  hpRecovery: number;
  mpRecovery: number;
  patk: number;
  matk: number;
  pdef: number;
  mdef: number;
  penetration: number;
  magicPenetration: number;
  hitRate: number;
  dodgeRate: number;
  critRate: number;
  critDmg: number;
  cultivationSpeed: number;
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
  elixirBonuses?: Record<string, number>;
}

export interface ProtagonistPlayInfo extends CharacterPlayInfoCommon {
  role: "protagonist";
  narrationPerson: NarrationPerson;
  birthPlace: string;
  originStory: string;
  traits: TraitEntry[];
  xiuwei: number;
  realmComplete: boolean;
}

export type PowerTier = "小怪" | "精英怪" | "小boss" | "大boss" | "普通NPC";

export interface NpcPlayInfo extends CharacterPlayInfoCommon {
  role: "npc";
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
}

export type EquipSlotKey = number;

export type ProtagonistDetailAction =
  | { id: "unequipWear"; equipSlot: EquipSlotKey }
  | { id: "unequipGongfa"; gongfaIndex: number }
  | { id: "equipWearFromBag"; inventoryIndex: number }
  | { id: "equipGongfaFromBag"; inventoryIndex: number }
  | { id: "consumeElixir"; inventoryIndex: number };

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
