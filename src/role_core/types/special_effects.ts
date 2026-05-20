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

/** 将 EffectKey 映射到英文分类键 */
export function effectKeyToCategory(label: EffectKey): EffectValueCategory {
  const cat = EFFECT_KEY_CATEGORY[label];
  if (cat === "恢复") return "recover";
  if (cat === "增益") return "boost";
  if (cat === "减益") return "reduce";
  return "damage";
}

/** 取指定分类下的第一个 EffectKey（用作 fallback） */
export function firstEffectKeyOfCategory(category: EffectValueCategory): EffectKey {
  for (const k of EFFECT_KEYS) {
    if (effectKeyToCategory(k) === category) return k;
  }
  return "boostPatk";
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

/** 法宝允许的触发方式：被动 + 默认 */
export const TREASURE_ALLOWED_TRIGGERS: ReadonlySet<string> = new Set([
  "on_default",
  "on_hit_taken",
  "on_turn_start",
  "on_low_hp",
  "on_low_mana",
  "on_full_mana",
  "on_crit",
  "on_dodge",
  "on_kill",
]);

/** 功法允许的触发方式：主动 */
export const GONGFA_ALLOWED_TRIGGERS: ReadonlySet<string> = new Set([
  "on_attack",
  "on_skill_cast",
]);

/**
 * 各物品类型允许的效果分类白名单
 *
 * - 法宝：仅增益（被动装备，自动触发属性提升）
 * - 功法：增益 + 伤害（主动技能，攻击或自我强化）
 * - 丹药：恢复 + 增益（消耗品，回血回蓝或临战强化）
 * - 符箓：仅伤害（消耗品，纯伤害输出）
 * - 阵法：增益 + 减益（战术型，强化己方/削弱敌方）
 */
export const ITEM_TYPE_ALLOWED_EFFECTS: Readonly<Record<SpecialEffectTarget, ReadonlySet<EffectValueCategory>>> = {
  法宝: new Set(["boost"] as const),
  功法: new Set(["boost", "damage"] as const),
  丹药: new Set(["recover", "boost"] as const),
  符箓: new Set(["damage"] as const),
  阵法: new Set(["boost", "reduce"] as const),
};

/** 各物品类型的 function 约束配置表；增删约束只改此处。 */
export const ITEM_TYPE_FUNCTION_OVERRIDES: Readonly<
  Record<SpecialEffectTarget, FunctionOverride>
> = {
  法宝: {},
  功法: {},
  丹药: { trigger: "on_attack", cost: "none" },
  符箓: { trigger: "on_attack" },
  阵法: { trigger: "on_attack"},
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

// ═══════════════════════════════════════════════════════════════════════════
// 特效数值体系
// ═══════════════════════════════════════════════════════════════════════════

/** 品阶 → 数组索引 */
export const GRADE_INDEX: Readonly<Record<string, number>> = {
  "下品": 0,
  "中品": 1,
  "上品": 2,
  "极品": 3,
  "仙品": 4,
  "神品": 5,
};

/** 特效数值分类键（与 effect label 前缀对齐） */
export type EffectValueCategory = "recover" | "boost" | "reduce" | "damage";

/**
 * 特效基础数值区间表（效果分类 × 品阶）
 * 索引：[下品, 中品, 上品, 极品, 仙品, 神品]
 * 每项为 [min, max]，生成时在此区间内随机取整
 *
 * 设计思路：
 * - recover：恢复类数值较高，直接回血回蓝，玩家感知强
 * - damage：伤害类中等偏高，需要体现打击感
 * - boost / reduce：增减益适中，属性调整是百分比/叠加效果
 * - 区间约为基准值 ±30%，同品阶物品之间有差异感
 */
export const EFFECT_BASE_VALUES: Readonly<Record<EffectValueCategory, readonly (readonly [number, number])[]>> = {
  recover: [[20, 40], [40, 80], [80, 160], [140, 260], [250, 460], [420, 780]],
  damage:  [[10, 20], [20, 40], [40, 80],  [70, 130],  [120, 220], [200, 360]],
  boost:   [[3, 7],   [7, 13],  [14, 26],  [24, 46],   [38, 72],   [56, 104]],
  reduce:  [[3, 7],   [7, 13],  [14, 26],  [24, 46],   [38, 72],   [56, 104]],
};

/**
 * 触发方式倍率
 *
 * - 主动触发 (on_attack / on_skill_cast)：基准 1.0，玩家主动控制，稳定触发
 * - 默认触发 (on_default)：0.7，无需任何条件，常驻生效需降低
 * - 被动·低风险 (on_turn_start / on_full_mana)：0.9-1.0，条件宽松
 * - 被动·中风险 (on_hit_taken / on_crit / on_dodge / on_kill)：1.1-1.2，需要特定场景
 * - 被动·高风险 (on_low_hp / on_low_mana)：1.3，危险状态才触发，给予补偿
 */
export const TRIGGER_VALUE_MULTIPLIER: Readonly<Record<string, number>> = {
  on_attack: 1.0,
  on_skill_cast: 1.0,
  on_default: 0.7,
  on_turn_start: 0.9,
  on_full_mana: 1.0,
  on_hit_taken: 1.1,
  on_crit: 1.2,
  on_dodge: 1.2,
  on_kill: 1.2,
  on_low_hp: 1.3,
  on_low_mana: 1.3,
};

/**
 * 持续回合衰减因子表
 * 每组 [回合数阈值, 每回合因子]
 * 查表取 ≤ duration 的最大阈值
 *
 * 设计思路：
 * - 即时 (duration=0)：完整数值 1.0
 * - 持续越长，每回合数值越低，但总量（per_turn × duration）越高
 *   例：3回合 → 0.40/回合 × 3 = 总量 1.20
 *        5回合 → 0.30/回合 × 5 = 总量 1.50
 *       10回合 → 0.20/回合 × 10 = 总量 2.00
 */
export const DURATION_PER_TURN_FACTORS: readonly (readonly [number, number])[] = [
  [0, 1.00],
  [1, 0.65],
  [2, 0.50],
  [3, 0.40],
  [5, 0.30],
  [10, 0.20],
] as const;

/**
 * 消耗方式倍率
 *
 * - none：基准 1.0，无代价
 * - mp：1.3，消耗法力资源，常见消耗方式
 * - hp：1.5，消耗生命，高风险高回报
 */
export const COST_VALUE_MULTIPLIER: Readonly<Record<string, number>> = {
  none: 1.0,
  mp: 1.3,
  hp: 1.5,
};

/**
 * 消耗基础数值表（消耗类型 × 品阶）
 * 索引：[下品, 中品, 上品, 极品, 仙品, 神品]
 *
 * 设计思路：
 * - hp 消耗约为 mp 的 1.5-2 倍（生命更珍贵）
 * - 高品阶消耗更多资源，与效果强度正比
 */
export const COST_BASE_VALUES: Readonly<Record<string, readonly number[]>> = {
  mp: [10, 20, 40, 70, 120, 200],
  hp: [20, 40, 80, 140, 240, 400],
};

/** 根据持续回合查衰减因子 */
export function lookupDurationFactor(duration: number): number {
  let factor = DURATION_PER_TURN_FACTORS[0][1];
  for (const [threshold, f] of DURATION_PER_TURN_FACTORS) {
    if (duration >= threshold) factor = f;
    else break;
  }
  return factor;
}

/**
 * 计算特效效果的最终数值
 *
 * 公式：floor(randomBase × triggerMul × durationFactor × costMul × affinityMul)
 * randomBase 从 EFFECT_BASE_VALUES 区间内随机取整
 * affinityMul 灵根契合时为 1.3，否则为 1.0
 * 最小值为 1
 */
export function computeEffectValue(
  category: EffectValueCategory,
  grade: string,
  trigger: string,
  duration: number,
  costResource: string,
  affinityBonus?: number,
): number {
  const baseArr = EFFECT_BASE_VALUES[category];
  const gradeIdx = GRADE_INDEX[grade] ?? 0;
  const [lo, hi] = baseArr[Math.min(gradeIdx, baseArr.length - 1)];
  const base = lo + Math.floor(Math.random() * (hi - lo + 1));
  const triggerMul = TRIGGER_VALUE_MULTIPLIER[trigger] ?? 1.0;
  const durFactor = lookupDurationFactor(duration);
  const costMul = COST_VALUE_MULTIPLIER[costResource] ?? 1.0;
  const affMul = affinityBonus != null && affinityBonus > 0 ? (1 + affinityBonus) : 1.0;
  return Math.max(1, Math.floor(base * triggerMul * durFactor * costMul * affMul));
}

/** 计算特效消耗的数值 */
export function computeCostValue(costResource: string, grade: string): number {
  const arr = COST_BASE_VALUES[costResource];
  if (!arr) return 0;
  const gradeIdx = GRADE_INDEX[grade] ?? 0;
  return arr[Math.min(gradeIdx, arr.length - 1)];
}
