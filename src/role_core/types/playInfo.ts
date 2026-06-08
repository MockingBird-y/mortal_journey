/**
 * 角色领域模型 + 境界常量数据表。
 *
 * 结构：数据 → 类型 → 再导出
 *
 * - 数据：属性键/映射（具体数值见 gameConstants.ts）
 * - 类型：主属性、槽位状态、角色卡接口、UI 动作
 * - 导出：itemInfo 再导出、realmUtils 功能函数再导出、gameConstants 再导出
 */

import type {
  TreasureItemDefinition,
  GongfaItemDefinition,
  InventoryStackItem,
} from "./itemInfo";
import type { WorldLocation } from "./worldLocation";

import {
  REALM_PRIMARY_STATS_TABLE,
  CULTIVATION_VALUES_TABLE,
  SHOUYUAN_VALUES,
  EQUIP_BONUS_RATIOS,
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
  GONGFA_GRADE_ATTRI_TABLE,
  MIN_NARRATIVE_AGE_BY_MAJOR,
  MAX_NARRATIVE_AGE_BY_MAJOR,
  rollGradeAttriValue,
  CULTIVATION_SPEED_TABLE,
  GONGFA_GRADE_CULTIVATION_MULT,
  LINGGEN_CULTIVATION_MULT,
  GONGFA_MASTERY_THRESHOLDS,
  GONGFA_MASTERY_EXP_PER_YEAR,
} from "./gameConstants";

export {
  REALM_PRIMARY_STATS_TABLE,
  CULTIVATION_VALUES_TABLE,
  SHOUYUAN_VALUES,
  EQUIP_BONUS_RATIOS,
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
  GONGFA_GRADE_ATTRI_TABLE,
  MIN_NARRATIVE_AGE_BY_MAJOR,
  MAX_NARRATIVE_AGE_BY_MAJOR,
  rollGradeAttriValue,
  CULTIVATION_SPEED_TABLE,
  GONGFA_GRADE_CULTIVATION_MULT,
  LINGGEN_CULTIVATION_MULT,
  GONGFA_MASTERY_THRESHOLDS,
  GONGFA_MASTERY_EXP_PER_YEAR,
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
  "resistance",
  "agility",
  "insight",
] as const;

export type PrimaryStatKey = (typeof PRIMARY_STAT_KEYS)[number];

export const PRIMARY_STAT_KEY_TO_ZH: Readonly<Record<PrimaryStatKey, string>> = {
  physique: "体魄",
  spirit: "灵力",
  strength: "劲力",
  perception: "神识",
  guard: "护体",
  resistance: "灵御",
  agility: "身法",
  insight: "悟性",
};

export const PRIMARY_STAT_KEY_DESC: Readonly<Record<PrimaryStatKey, string>> = {
  physique: "增加血量",
  spirit: "增加法力",
  strength: "提高造成的物伤",
  perception: "提高造成的法伤",
  guard: "提高对物伤的抵抗率",
  resistance: "提高对法伤的抵抗率",
  agility: "增加闪避的几率，并决定先手和逃跑几率",
  insight: "增加修炼速度，修炼功法耗时更少",
};

export type ZhStatBonusMap = Partial<Record<string, number>>;

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 游戏常量（结构部分）
// ═══════════════════════════════════════════════════════════════════════════

export const REALM_ORDER = ["练气", "筑基", "结丹", "元婴", "化神"] as const;
export type RealmMajor = (typeof REALM_ORDER)[number];

export const SUB_STAGES = ["初期", "中期", "后期"] as const;
export type RealmSubStage = (typeof SUB_STAGES)[number];

export type NarrationPerson = "first" | "second" | "third";

export type BreakthroughStatus = "idle" | "ready" | "in_quest";

// ═══════════════════════════════════════════════════════════════════════════
// 一、数据 — 境界主属性表
// ═══════════════════════════════════════════════════════════════════════════

export interface RealmPrimaryStatsRow {
  realm: string;
  stage: string;
  hp: number;
  mp: number;
  physique: number;
  spirit: number;
  strength: number;
  perception: number;
  guard: number;
  resistance: number;
  agility: number;
  insight: number;
}

export function realmStageIndex(realm: string, stage: string): number {
  const majorIdx = (REALM_ORDER as readonly string[]).indexOf(realm);
  if (majorIdx < 0) return 0;
  const minorIdx = (SUB_STAGES as readonly string[]).indexOf(stage);
  if (minorIdx < 0) return 0;
  return majorIdx * SUB_STAGES.length + minorIdx + 1;
}

export const TABLE: readonly RealmPrimaryStatsRow[] = (REALM_ORDER as readonly string[]).flatMap(
  (realm) =>
    (SUB_STAGES as readonly string[]).map((stage, minorIdx) => {
      const majorIdx = (REALM_ORDER as readonly string[]).indexOf(realm);
      const idx = majorIdx * SUB_STAGES.length + minorIdx;
      const row = REALM_PRIMARY_STATS_TABLE[Math.min(idx, REALM_PRIMARY_STATS_TABLE.length - 1)];
      return {
        realm, stage,
        hp: row.hp, mp: row.mp,
        physique: row.physique, spirit: row.spirit,
        strength: row.strength, perception: row.perception,
        guard: row.guard, resistance: row.resistance,
        agility: row.agility, insight: row.insight,
      };
    }),
);

export const CULTIVATION_VALUES: readonly number[] = CULTIVATION_VALUES_TABLE;

// ═══════════════════════════════════════════════════════════════════════════
// 二、结构 — 类型与接口
// ═══════════════════════════════════════════════════════════════════════════

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
    };

export interface CharacterPlayInfoCommon {
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
  inventorySlots: Array<InventoryStackItem | null>;
  gongfaSlots: GongfaSlotsState;
  equippedSlots: EquippedSlotsState;
  elixirBonuses?: Record<string, number>;
}

export interface ProtagonistPlayInfo extends CharacterPlayInfoCommon {
  role: "protagonist";
  narrationPerson: NarrationPerson;
  birthPlace: WorldLocation;
  originStory: string;
  traits: TraitEntry[];
  xiuwei: number;
  realmComplete: boolean;
  breakthroughStatus: BreakthroughStatus;
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
  | { id: "consumeElixir"; inventoryIndex: number }
  | { id: "cultivateGongfa"; gongfaIndex: number };

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
  getRealmPrimaryStats,
  getEquipBonusRealmRatio,
  getProtagonistNarrativeAge,
  getShouyuanForRealm,
  getCultivationRequired,
  getRow,
  hasRow,
  getTable,
  getMinNarrativeAgeForMajor,
  getMaxNarrativeAgeForMajor,
  customBirthBackgroundImpliesAgeException,
  resolveEffectiveMajorForNarrativeAge,
} from "../realmUtils";

export type {
  CustomBirthSlice,
  FateChoiceSliceForAge,
  GameSliceForNarrativeAge,
} from "../realmUtils";

export type { WorldLocation } from "./worldLocation";
export {
  formatWorldLocation,
  formatWorldLocationDash,
  parseWorldLocationFromDash,
  isWorldLocationEqual,
  isEmptyWorldLocation,
} from "./worldLocation";
