/**
 * 法宝：物品定义 + 特殊效果。
 */

import type { ItemBonusMap } from "./itemInfo";
import type { EffectCategory, EffectValueCategory } from "./special_effects";
import {
  normalizeGeneric,
  categoryToValueCategory,
  computeEffectValue,
  computeCostValue,
} from "./special_effects";

// ═══════════════════════════════════════════════════════════════════════════
// 触发时机
// ═══════════════════════════════════════════════════════════════════════════

export const TREASURE_TRIGGER_KEYS = [
  "on_hit_taken",
  "on_turn_start",
  "on_low_hp",
  "on_low_mana",
  "on_full_mana",
  "on_crit",
  "on_dodge",
  "on_kill",
] as const;
export type TreasureTriggerTiming = (typeof TREASURE_TRIGGER_KEYS)[number];

export const TREASURE_TRIGGER_TO_ZH: Readonly<Record<TreasureTriggerTiming, string>> = {
  on_hit_taken: "受到攻击时",
  on_turn_start: "回合开始",
  on_low_hp: "低生命值",
  on_low_mana: "灵力不足",
  on_full_mana: "灵气满时",
  on_crit: "暴击时",
  on_dodge: "闪避时",
  on_kill: "击杀敌人",
};

export const TREASURE_TRIGGER_CATEGORY: Readonly<Record<TreasureTriggerTiming, "主动" | "被动" | "默认">> = {
  on_hit_taken: "被动",
  on_turn_start: "被动",
  on_low_hp: "被动",
  on_low_mana: "被动",
  on_full_mana: "被动",
  on_crit: "被动",
  on_dodge: "被动",
  on_kill: "被动",
};

// ═══════════════════════════════════════════════════════════════════════════
// 效果键
// ═══════════════════════════════════════════════════════════════════════════

export const TREASURE_EFFECT_KEYS = [
  "recoverHp", "recoverMp", "boostPatk", "boostMatk", "boostPdef", "boostMdef",
  "boostPenetration", "boostHitRate", "boostDodgeRate", "boostCritRate",
  "boostCritDmg", "boostRecovery", "boostCastSpeed", "boostActionSpeed",
  "boostEffectChance", "boostControlResist",
] as const;
export type TreasureEffectKey = (typeof TREASURE_EFFECT_KEYS)[number];

export const TREASURE_EFFECT_TO_ZH: Readonly<Record<TreasureEffectKey, string>> = {
  recoverHp: "恢复血量",
  recoverMp: "恢复法力",
  boostPatk: "增加物攻",
  boostMatk: "增加法攻",
  boostPdef: "增加物防",
  boostMdef: "增加法防",
  boostPenetration: "增加穿透",
  boostHitRate: "增加命中率",
  boostDodgeRate: "增加闪避率",
  boostCritRate: "增加暴击率",
  boostCritDmg: "增加暴击伤害",
  boostRecovery: "增加恢复效果",
  boostCastSpeed: "增加施法速度",
  boostActionSpeed: "增加行动速度",
  boostEffectChance: "增加特效几率",
  boostControlResist: "增加控制抗性",
};

export const TREASURE_EFFECT_CATEGORY: Readonly<Record<TreasureEffectKey, EffectCategory>> = {
  recoverHp: "恢复", recoverMp: "恢复", boostPatk: "增益", boostMatk: "增益",
  boostPdef: "增益", boostMdef: "增益", boostPenetration: "增益",
  boostHitRate: "增益", boostDodgeRate: "增益", boostCritRate: "增益",
  boostCritDmg: "增益", boostRecovery: "增益", boostCastSpeed: "增益",
  boostActionSpeed: "增益", boostEffectChance: "增益", boostControlResist: "增益",
};

// ═══════════════════════════════════════════════════════════════════════════
// 消耗资源
// ═══════════════════════════════════════════════════════════════════════════

export const TREASURE_COST_KEYS = ["none", "mp", "hp"] as const;
export type TreasureCostKey = (typeof TREASURE_COST_KEYS)[number];
export const TREASURE_COST_TO_ZH: Readonly<Record<TreasureCostKey, string>> = {
  none: "无消耗",
  mp: "消耗法力",
  hp: "消耗血量",
};

// ═══════════════════════════════════════════════════════════════════════════
// 特效接口与白名单
// ═══════════════════════════════════════════════════════════════════════════

export interface TreasureSpecialEffect {
  trigger: TreasureTriggerTiming;
  effect: { label: TreasureEffectKey; value: number };
  duration: number;
  cost: { resource: TreasureCostKey; value: number };
}

export const TREASURE_ALLOWED_TRIGGERS: ReadonlySet<string> = new Set<string>(TREASURE_TRIGGER_KEYS);
export const TREASURE_ALLOWED_EFFECT_CATEGORIES: ReadonlySet<EffectValueCategory> = new Set(["recover", "boost"] as const);

// ═══════════════════════════════════════════════════════════════════════════
// 效果辅助函数
// ═══════════════════════════════════════════════════════════════════════════

export function treasureEffectKeyToCategory(label: TreasureEffectKey): EffectValueCategory {
  return categoryToValueCategory(TREASURE_EFFECT_CATEGORY[label]);
}

export function normalizeTreasureAiFunction(raw: unknown, grade?: string): TreasureSpecialEffect | undefined {
  return normalizeGeneric({
    raw,
    triggerKeys: TREASURE_TRIGGER_KEYS,
    defaultTrigger: "on_hit_taken",
    effectKeys: TREASURE_EFFECT_KEYS,
    effectKeyToCategory: treasureEffectKeyToCategory,
    costKeys: TREASURE_COST_KEYS,
    defaultCost: "none",
    grade,
  }) as TreasureSpecialEffect | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// 物品定义
// ═══════════════════════════════════════════════════════════════════════════

export interface TreasureItemDefinition {
  itemType: "法宝";
  name: string;
  desc: string;
  grade: import("./itemInfo").ItemGrade;
  count: number;
  bonus: ItemBonusMap;
  function?: TreasureSpecialEffect;
}
