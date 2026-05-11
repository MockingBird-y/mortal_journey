/**
 * 特殊效果结构定义，供法宝、功法、丹药、符箓、阵法等物品使用。
 */

/**
 * 特殊效果条目。
 * 物品可携带零或多个特殊效果，在特定时机触发，产生数值效果并消耗资源。
 */
export interface SpecialEffect {
  /** 触发时机，如 `"activeUse"`、`"battleStart"`、`"hpHalf"` */
  trigger: TriggerTiming;
  /** 效果描述与数值，如 `{ label: "recoverHp", value: 200 }` */
  effect: SpecialEffectValue;
  /** 持续回合数；0 表示即时生效不持续 */
  duration: number;
  /** 消耗资源与数值，如 `{ resource: "mp", value: 20 }` */
  cost: CostResourceValue;
}

/** 效果/消耗键值对 */
export interface SpecialEffectValue {
  /** 效果或消耗的标识 */
  label: EffectKey;
  /** 对应的数值 */
  value: number;
}

/** 可携带特殊效果的物品种类标记 */
export type SpecialEffectTarget =
  | "法宝"
  | "功法"
  | "丹药"
  | "符箓"
  | "阵法";

// ═══════════════════════════════════════════════════════════════════════════
// 触发时机表
// ═══════════════════════════════════════════════════════════════════════════

/** 触发时机键（英文标识，供代码逻辑判断使用） */
export const TRIGGER_TIMING_KEYS = [
  "activeUse",
  "battleStart",
  "hpHalf",
  "hpCritical",
  "mpHalf",
  "mpCritical",
  "onHit",
  "default",
] as const;

export type TriggerTiming = (typeof TRIGGER_TIMING_KEYS)[number];

/** 触发时机英文 → 中文映射 */
export const TRIGGER_TIMING_TO_ZH: Readonly<Record<TriggerTiming, string>> = {
  activeUse: "主动使用",
  battleStart: "战斗开始时触发",
  hpHalf: "血量减半时触发",
  hpCritical: "血量见底时触发",
  mpHalf: "法力减半时触发",
  mpCritical: "法力见底时触发",
  onHit: "击中敌方时触发",
  default: "默认触发",
};

/** 触发时机分类 */
export const TRIGGER_TIMING_CATEGORY: Readonly<Record<TriggerTiming, "主动" | "被动" | "默认">> = {
  activeUse: "主动",
  battleStart: "被动",
  hpHalf: "被动",
  hpCritical: "被动",
  mpHalf: "被动",
  mpCritical: "被动",
  onHit: "被动",
  default: "默认",
};

// ═══════════════════════════════════════════════════════════════════════════
// 效果表
// ═══════════════════════════════════════════════════════════════════════════

/** 效果键（英文标识，供代码逻辑判断使用） */
export const EFFECT_KEYS = [
  // 恢复
  "recoverHp",
  "recoverMp",
  // 增加8维主属性
  "boostPhysique",
  "boostSpirit",
  "boostGuard",
  "boostPerception",
  "boostAgility",
  "boostCrit",
  "boostInsight",
  "boostFortune",
  // 增加派生属性
  "boostHp",
  "boostMp",
  "boostPatk",
  "boostMatk",
  "boostPdef",
  "boostMdef",
  "boostPenetration",
  "boostHitRate",
  "boostDodgeRate",
  "boostCritRate",
  "boostCritDmg",
  "boostRecovery",
  "boostCastSpeed",
  "boostActionSpeed",
  "boostEffectChance",
  "boostCultivationSpeed",
  "boostControlResist",
  "boostFireDamage",
  "boostIceDamage",
  "boostPoisonDamage",
  "boostLightningDamage",
  // 造成伤害
  "dealPhysicalDmg",
  "dealMagicDmg",
  "dealFireDmg",
  "dealIceDmg",
  "dealPoisonDmg",
  "dealLightningDmg",
] as const;

export type EffectKey = (typeof EFFECT_KEYS)[number];

/** 效果英文 → 中文映射 */
export const EFFECT_KEY_TO_ZH: Readonly<Record<EffectKey, string>> = {
  recoverHp: "恢复血量",
  recoverMp: "恢复法力",
  boostPhysique: "增加体魄",
  boostSpirit: "增加灵力",
  boostGuard: "增加护体",
  boostPerception: "增加神识",
  boostAgility: "增加身法",
  boostCrit: "增加会心",
  boostInsight: "增加悟性",
  boostFortune: "增加气运",
  boostHp: "增加血量",
  boostMp: "增加法力",
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
  boostCultivationSpeed: "增加修炼速率",
  boostControlResist: "增加控制抗性",
  boostFireDamage: "增加火伤",
  boostIceDamage: "增加冰伤",
  boostPoisonDamage: "增加毒伤",
  boostLightningDamage: "增加雷伤",
  dealPhysicalDmg: "造成物伤",
  dealMagicDmg: "造成法伤",
  dealFireDmg: "造成火伤",
  dealIceDmg: "造成冰伤",
  dealPoisonDmg: "造成毒伤",
  dealLightningDmg: "造成雷伤",
};

/** 效果分类 */
export type EffectCategory = "恢复" | "增益" | "伤害";

/** 效果键 → 分类映射 */
export const EFFECT_KEY_CATEGORY: Readonly<Record<EffectKey, EffectCategory>> = (() => {
  const o = {} as Record<string, EffectCategory>;
  for (const k of EFFECT_KEYS) {
    if (k.startsWith("recover")) o[k] = "恢复";
    else if (k.startsWith("boost")) o[k] = "增益";
    else o[k] = "伤害";
  }
  return o as Record<EffectKey, EffectCategory>;
})();

// ═══════════════════════════════════════════════════════════════════════════
// 消耗资源表
// ═══════════════════════════════════════════════════════════════════════════

/** 消耗资源键 */
export const COST_RESOURCE_KEYS = [
  "none",
  "mp",
  "hp",
] as const;

export type CostResourceKey = (typeof COST_RESOURCE_KEYS)[number];

/** 消耗资源英文 → 中文映射 */
export const COST_RESOURCE_TO_ZH: Readonly<Record<CostResourceKey, string>> = {
  none: "无消耗",
  mp: "消耗法力",
  hp: "消耗血量",
};

/** 消耗资源键值对 */
export interface CostResourceValue {
  /** 消耗的资源类型 */
  resource: CostResourceKey;
  /** 消耗数值 */
  value: number;
}
