/**
 * 特殊效果结构定义，供法宝、功法、丹药、符箓、阵法等物品使用。
 */

/**
 * 特殊效果条目。
 * 物品可携带零或多个特殊效果，在特定时机触发，产生数值效果并消耗资源。
 */
export interface SpecialEffect {
  /** 触发时机，如 `"on_attack"`、`"on_hit_taken"`、`"on_turn_start"` */
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
  "on_attack",
  "on_skill_cast",
  "on_crit",
  "on_dodge",
  "on_hit_taken",
  "on_turn_start",
  "on_low_hp",
  "on_low_mana",
  "on_full_mana",
  "on_kill",
  "on_default",
] as const;

export type TriggerTiming = (typeof TRIGGER_TIMING_KEYS)[number];

/** 触发时机英文 → 中文映射 */
export const TRIGGER_TIMING_TO_ZH: Readonly<Record<TriggerTiming, string>> = {
  on_attack: "主动触发",
  on_skill_cast: "释放技能时",
  on_crit: "暴击时",
  on_dodge: "闪避时",
  on_hit_taken: "受到攻击时",
  on_turn_start: "回合开始",
  on_low_hp: "低生命值",
  on_low_mana: "灵力不足",
  on_full_mana: "灵气满时",
  on_kill: "击杀敌人",
  on_default: "默认触发",
};

/** 触发时机分类 */
export const TRIGGER_TIMING_CATEGORY: Readonly<Record<TriggerTiming, "主动" | "被动" | "默认">> = {
  on_attack: "主动",
  on_skill_cast: "主动",
  on_crit: "被动",
  on_dodge: "被动",
  on_hit_taken: "被动",
  on_turn_start: "被动",
  on_low_hp: "被动",
  on_low_mana: "被动",
  on_full_mana: "被动",
  on_kill: "被动",
  on_default: "默认",
};

// ═══════════════════════════════════════════════════════════════════════════
// 效果表
// ═══════════════════════════════════════════════════════════════════════════

/** 效果键（英文标识，供代码逻辑判断使用） */
export const EFFECT_KEYS = [
  // 恢复
  "recoverHp",
  "recoverMp",
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
  // 减少派生属性
  "reduceHp",
  "reduceMp",
  "reducePatk",
  "reduceMatk",
  "reducePdef",
  "reduceMdef",
  "reducePenetration",
  "reduceHitRate",
  "reduceDodgeRate",
  "reduceCritRate",
  "reduceCritDmg",
  "reduceRecovery",
  "reduceCastSpeed",
  "reduceActionSpeed",
  "reduceEffectChance",
  "reduceCultivationSpeed",
  "reduceControlResist",
  "reduceFireDamage",
  "reduceIceDamage",
  "reducePoisonDamage",
  "reduceLightningDamage",
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
  reduceHp: "减少血量",
  reduceMp: "减少法力",
  reducePatk: "减少物攻",
  reduceMatk: "减少法攻",
  reducePdef: "减少物防",
  reduceMdef: "减少法防",
  reducePenetration: "减少穿透",
  reduceHitRate: "减少命中率",
  reduceDodgeRate: "减少闪避率",
  reduceCritRate: "减少暴击率",
  reduceCritDmg: "减少暴击伤害",
  reduceRecovery: "减少恢复效果",
  reduceCastSpeed: "减少施法速度",
  reduceActionSpeed: "减少行动速度",
  reduceEffectChance: "减少特效几率",
  reduceCultivationSpeed: "减少修炼速率",
  reduceControlResist: "减少控制抗性",
  reduceFireDamage: "减少火伤",
  reduceIceDamage: "减少冰伤",
  reducePoisonDamage: "减少毒伤",
  reduceLightningDamage: "减少雷伤",
  dealPhysicalDmg: "造成物伤",
  dealMagicDmg: "造成法伤",
  dealFireDmg: "造成火伤",
  dealIceDmg: "造成冰伤",
  dealPoisonDmg: "造成毒伤",
  dealLightningDmg: "造成雷伤",
};

/** 效果分类 */
export type EffectCategory = "恢复" | "增益" | "减益" | "伤害";

/** 效果键 → 分类映射 */
export const EFFECT_KEY_CATEGORY: Readonly<Record<EffectKey, EffectCategory>> = (() => {
  const o = {} as Record<string, EffectCategory>;
  for (const k of EFFECT_KEYS) {
    if (k.startsWith("recover")) o[k] = "恢复";
    else if (k.startsWith("reduce")) o[k] = "减益";
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

// ═══════════════════════════════════════════════════════════════════════════
// 物品类型 function 强制约束
// ═══════════════════════════════════════════════════════════════════════════

/** 物品类型的 function 字段强制约束；配置表中指定的字段会覆盖 AI 原值。 */
export interface FunctionOverride {
  trigger?: TriggerTiming;
  cost?: CostResourceKey;
  duration?: number;
}

/** 各物品类型的 function 约束配置表；增删约束只改此处。 */
export const ITEM_TYPE_FUNCTION_OVERRIDES: Readonly<
  Record<SpecialEffectTarget, FunctionOverride>
> = {
  法宝: {},
  功法: {},
  丹药: { trigger: "on_attack", cost: "none" },
  符箓: { trigger: "on_attack" },
  阵法: { trigger: "on_attack", duration: 5 },
};

/**
 * 按物品类型强制覆盖 `function` 字段。
 * 配置表中指定的字段会无条件覆盖，未指定的字段保留原值。
 *
 * @param fn 已归一化的 `SpecialEffect`。
 * @param itemType 物品类型（如 `"丹药"`）。
 * @returns 覆盖后的 `SpecialEffect`；`fn` 为 `undefined` 时原样返回。
 */
export function applyFunctionOverrides(
  fn: SpecialEffect | undefined,
  itemType: string,
): SpecialEffect | undefined {
  if (!fn) return fn;
  const override = ITEM_TYPE_FUNCTION_OVERRIDES[itemType as SpecialEffectTarget];
  if (!override) return fn;
  return {
    trigger: override.trigger ?? fn.trigger,
    effect: fn.effect,
    duration: override.duration ?? fn.duration,
    cost: override.cost != null
      ? { resource: override.cost, value: 0 }
      : fn.cost,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AI 输出归一化
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 大小写不敏感匹配 `EffectKey`；匹配不到时返回 `undefined`。
 *
 * @param s AI 输出的原始效果字符串。
 */
export function matchEffectKeyLoose(s: string): EffectKey | undefined {
  const lower = s.toLowerCase();
  for (const k of EFFECT_KEYS) {
    if (k.toLowerCase() === lower) return k;
  }
  return undefined;
}

/**
 * 大小写不敏感匹配 `CostResourceKey`；匹配不到时 fallback 为 `"none"`。
 *
 * @param s AI 输出的原始消耗资源字符串。
 */
export function matchCostResourceLoose(s: string): CostResourceKey {
  const lower = s.toLowerCase().trim();
  for (const k of COST_RESOURCE_KEYS) {
    if (k.toLowerCase() === lower) return k;
  }
  return "none";
}

/**
 * 将 AI 原始 `function` 字段归一化为 `SpecialEffect`。
 *
 * AI 输出格式（无具体数值）：
 * ```json
 * { "trigger": "on_attack", "effect": "dealMagicDmg", "duration": 0, "cost": "mp" }
 * ```
 *
 * 归一化规则：
 * - `trigger`：精确匹配 `TRIGGER_TIMING_KEYS`，不匹配则 fallback `"on_default"`
 * - `effect`：字符串做大小写不敏感匹配；对象则校验 `label`；`value` 用常量 `1`
 * - `duration`：取原值，非数字时默认 `0`
 * - `cost`：字符串匹配 `CostResourceKey`，`value` 用常量 `1`；对象则校验 `resource`
 *
 * @param raw AI 原始 function 字段（`unknown`）。
 * @returns 归一化后的 `SpecialEffect`，无法识别时返回 `undefined`。
 */
export function normalizeAiFunction(raw: unknown): SpecialEffect | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;

  const rawTrigger = typeof o.trigger === "string" ? o.trigger.trim() : "";
  const trigger = (TRIGGER_TIMING_KEYS as readonly string[]).includes(rawTrigger)
    ? (rawTrigger as TriggerTiming)
    : "on_default";

  let effectLabel: EffectKey | undefined;
  let effectValue = 1;
  const rawEffect = o.effect;
  if (typeof rawEffect === "string") {
    effectLabel = matchEffectKeyLoose(rawEffect);
  } else if (rawEffect && typeof rawEffect === "object") {
    const eo = rawEffect as Record<string, unknown>;
    if (typeof eo.label === "string") {
      effectLabel = matchEffectKeyLoose(eo.label);
    }
    if (typeof eo.value === "number" && Number.isFinite(eo.value)) {
      effectValue = eo.value;
    }
  }
  if (!effectLabel) return undefined;

  const rawDuration = o.duration;
  const duration = typeof rawDuration === "number" && Number.isFinite(rawDuration) ? rawDuration : 0;

  let costResource: CostResourceKey = "none";
  let costValue = 0;
  const rawCost = o.cost;
  if (typeof rawCost === "string") {
    costResource = matchCostResourceLoose(rawCost);
    costValue = costResource !== "none" ? 1 : 0;
  } else if (rawCost && typeof rawCost === "object") {
    const co = rawCost as Record<string, unknown>;
    if (typeof co.resource === "string") {
      costResource = matchCostResourceLoose(co.resource);
    }
    if (typeof co.value === "number" && Number.isFinite(co.value)) {
      costValue = co.value;
    } else {
      costValue = costResource !== "none" ? 1 : 0;
    }
  }

  return {
    trigger,
    effect: { label: effectLabel, value: effectValue },
    duration,
    cost: { resource: costResource, value: costValue },
  };
}
