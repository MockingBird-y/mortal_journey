/**
 * 功法：物品定义 + 特殊效果。
 */

import type { ItemBonusMap } from "./itemInfo";
import type { EffectCategory, EffectValueCategory } from "./special_effects";
import {
  normalizeGeneric,
  categoryToValueCategory,
} from "./special_effects";

// ═══════════════════════════════════════════════════════════════════════════
// 触发时机
// ═══════════════════════════════════════════════════════════════════════════

export const GONGFA_TRIGGER_KEYS = [
  "on_attack",
  "on_skill_cast",
  "on_default",
] as const;
export type GongfaTriggerTiming = (typeof GONGFA_TRIGGER_KEYS)[number];

export const GONGFA_TRIGGER_TO_ZH: Readonly<Record<GongfaTriggerTiming, string>> = {
  on_attack: "主动触发",
  on_skill_cast: "释放技能时",
  on_default: "默认触发",
};

export const GONGFA_TRIGGER_CATEGORY: Readonly<Record<GongfaTriggerTiming, "主动" | "被动" | "默认">> = {
  on_attack: "主动",
  on_skill_cast: "主动",
  on_default: "默认",
};

// ═══════════════════════════════════════════════════════════════════════════
// 效果键
// ═══════════════════════════════════════════════════════════════════════════

export const GONGFA_EFFECT_KEYS = [
  "boostPenetration", "boostHitRate", "boostDodgeRate", "boostCritRate",
  "boostCritDmg",
  "dealPhysicalDmg", "dealMagicDmg",
  "dealFireDmg", "dealIceDmg", "dealPoisonDmg", "dealLightningDmg",
] as const;
export type GongfaEffectKey = (typeof GONGFA_EFFECT_KEYS)[number];

export const GONGFA_EFFECT_TO_ZH: Readonly<Record<GongfaEffectKey, string>> = {
  boostPenetration: "增加穿透",
  boostHitRate: "增加命中率",
  boostDodgeRate: "增加闪避率",
  boostCritRate: "增加暴击率",
  boostCritDmg: "增加暴击伤害",
  dealPhysicalDmg: "造成物伤",
  dealMagicDmg: "造成法伤",
  dealFireDmg: "造成火伤",
  dealIceDmg: "造成冰伤",
  dealPoisonDmg: "造成毒伤",
  dealLightningDmg: "造成雷伤",
};

export const GONGFA_EFFECT_CATEGORY: Readonly<Record<GongfaEffectKey, EffectCategory>> = {
  boostPenetration: "增益", boostHitRate: "增益", boostDodgeRate: "增益",
  boostCritRate: "增益", boostCritDmg: "增益",
  dealPhysicalDmg: "伤害", dealMagicDmg: "伤害",
  dealFireDmg: "伤害", dealIceDmg: "伤害", dealPoisonDmg: "伤害", dealLightningDmg: "伤害",
};

// ═══════════════════════════════════════════════════════════════════════════
// 消耗资源
// ═══════════════════════════════════════════════════════════════════════════

export const GONGFA_COST_KEYS = ["none", "mp", "hp"] as const;
export type GongfaCostKey = (typeof GONGFA_COST_KEYS)[number];
export const GONGFA_COST_TO_ZH: Readonly<Record<GongfaCostKey, string>> = {
  none: "无消耗",
  mp: "消耗法力",
  hp: "消耗血量",
};

// ═══════════════════════════════════════════════════════════════════════════
// 特效接口与白名单
// ═══════════════════════════════════════════════════════════════════════════

export interface GongfaSpecialEffect {
  trigger: GongfaTriggerTiming;
  effect: { label: GongfaEffectKey; value: number };
  duration: number;
  cost: { resource: GongfaCostKey; value: number };
}

export const GONGFA_ALLOWED_TRIGGERS: ReadonlySet<string> = new Set<string>(GONGFA_TRIGGER_KEYS);
export const GONGFA_ALLOWED_EFFECT_CATEGORIES: ReadonlySet<EffectValueCategory> = new Set(["boost", "damage"] as const);

// ═══════════════════════════════════════════════════════════════════════════
// 效果辅助函数
// ═══════════════════════════════════════════════════════════════════════════

export function gongfaEffectKeyToCategory(label: GongfaEffectKey): EffectValueCategory {
  return categoryToValueCategory(GONGFA_EFFECT_CATEGORY[label]);
}

export function normalizeGongfaAiFunction(raw: unknown, grade?: string): GongfaSpecialEffect | undefined {
  return normalizeGeneric({
    raw,
    triggerKeys: GONGFA_TRIGGER_KEYS,
    defaultTrigger: "on_attack",
    effectKeys: GONGFA_EFFECT_KEYS,
    effectKeyToCategory: gongfaEffectKeyToCategory,
    costKeys: GONGFA_COST_KEYS,
    defaultCost: "none",
    grade,
  }) as GongfaSpecialEffect | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// 物品定义
// ═══════════════════════════════════════════════════════════════════════════

export interface GongfaItemDefinition {
  itemType: "功法";
  name: string;
  desc: string;
  grade: import("./itemInfo").ItemGrade;
  count: number;
  bonus: ItemBonusMap;
  function?: GongfaSpecialEffect;
}
