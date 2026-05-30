/**
 * 特效共享工具 + 跨类型聚合 + re-export。
 * 各类型的专属定义在 treasure.ts / gongfa.ts / elixir.ts。
 */

import {
  TREASURE_TRIGGER_TO_ZH,
  TREASURE_EFFECT_TO_ZH,
  TREASURE_COST_TO_ZH,
  TREASURE_EFFECT_CATEGORY,
  TREASURE_ALLOWED_EFFECT_CATEGORIES,
  normalizeTreasureAiFunction,
  type TreasureSpecialEffect,
} from "./treasure";
import {
  GONGFA_TRIGGER_TO_ZH,
  GONGFA_EFFECT_TO_ZH,
  GONGFA_COST_TO_ZH,
  GONGFA_EFFECT_CATEGORY,
  GONGFA_ALLOWED_EFFECT_CATEGORIES,
  normalizeGongfaAiFunction,
  type GongfaSpecialEffect,
} from "./gongfa";


// re-export per-type modules (保持旧 import 路径兼容)
export {
  TREASURE_TRIGGER_KEYS, type TreasureTriggerTiming,
  TREASURE_TRIGGER_TO_ZH, TREASURE_TRIGGER_CATEGORY,
  TREASURE_EFFECT_KEYS, type TreasureEffectKey,
  TREASURE_EFFECT_TO_ZH, TREASURE_EFFECT_CATEGORY,
  TREASURE_COST_KEYS, type TreasureCostKey, TREASURE_COST_TO_ZH,
  type TreasureSpecialEffect,
  TREASURE_ALLOWED_TRIGGERS, TREASURE_ALLOWED_EFFECT_CATEGORIES,
  treasureEffectKeyToCategory, normalizeTreasureAiFunction,
} from "./treasure";

export {
  GONGFA_TRIGGER_KEYS, type GongfaTriggerTiming,
  GONGFA_TRIGGER_TO_ZH, GONGFA_TRIGGER_CATEGORY,
  GONGFA_EFFECT_KEYS, type GongfaEffectKey,
  GONGFA_EFFECT_TO_ZH, GONGFA_EFFECT_CATEGORY,
  GONGFA_COST_KEYS, type GongfaCostKey, GONGFA_COST_TO_ZH,
  type GongfaSpecialEffect,
  GONGFA_ALLOWED_TRIGGERS, GONGFA_ALLOWED_EFFECT_CATEGORIES,
  gongfaEffectKeyToCategory, normalizeGongfaAiFunction,
} from "./gongfa";

// ═══════════════════════════════════════════════════════════════════════════
// 共享类型
// ═══════════════════════════════════════════════════════════════════════════

/** 可携带特殊效果的物品种类标记 */
export type SpecialEffectTarget =
  | "法宝"
  | "功法";

/** 效果分类（中文） */
export type EffectCategory = "恢复" | "增益" | "减益" | "伤害";

/** 特效数值分类键（用于数值计算） */
export type EffectValueCategory = "recover" | "boost" | "reduce" | "damage";

// ═══════════════════════════════════════════════════════════════════════════
// 共享工具函数
// ═══════════════════════════════════════════════════════════════════════════

export function matchKeyLoose<T extends string>(keys: readonly T[], s: string): T | undefined {
  const lower = s.toLowerCase();
  for (const k of keys) {
    if (k.toLowerCase() === lower) return k;
  }
  return undefined;
}

export function categoryToValueCategory(cat: EffectCategory | undefined): EffectValueCategory {
  if (cat === "恢复") return "recover";
  if (cat === "增益") return "boost";
  if (cat === "减益") return "reduce";
  return "damage";
}

export function firstKeyOfValueCategory<T extends string>(
  keys: readonly T[],
  catMap: Readonly<Record<string, EffectCategory>>,
  vc: EffectValueCategory,
): T {
  for (const k of keys) {
    if (categoryToValueCategory(catMap[k]) === vc) return k;
  }
  return keys[0];
}

export interface NormalizeOpts<TTrigger extends string, TEffect extends string, TCost extends string> {
  raw: unknown;
  triggerKeys: readonly TTrigger[];
  defaultTrigger: TTrigger;
  effectKeys: readonly TEffect[];
  effectKeyToCategory: (label: TEffect) => EffectValueCategory;
  costKeys: readonly TCost[];
  defaultCost: TCost;
  grade?: string;
}

export function normalizeGeneric<TTrigger extends string, TEffect extends string, TCost extends string>(
  opts: NormalizeOpts<TTrigger, TEffect, TCost>,
): { trigger: TTrigger; effect: { label: TEffect; value: number }; duration: number; cost: { resource: TCost; value: number } } | undefined {
  const { raw } = opts;
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;

  const rawTrigger = typeof o.trigger === "string" ? o.trigger.trim() : "";
  const trigger = (opts.triggerKeys as readonly string[]).includes(rawTrigger)
    ? (rawTrigger as TTrigger)
    : opts.defaultTrigger;

  let effectLabel: TEffect | undefined;
  let effectValueExplicit = false;
  let effectValue = 1;
  const rawEffect = o.effect;
  if (typeof rawEffect === "string") {
    effectLabel = matchKeyLoose(opts.effectKeys, rawEffect);
  } else if (rawEffect && typeof rawEffect === "object") {
    const eo = rawEffect as Record<string, unknown>;
    if (typeof eo.label === "string") {
      effectLabel = matchKeyLoose(opts.effectKeys, eo.label);
    }
    if (typeof eo.value === "number" && Number.isFinite(eo.value)) {
      effectValue = eo.value;
      effectValueExplicit = true;
    }
  }
  if (!effectLabel) return undefined;

  const rawDuration = o.duration;
  const duration = typeof rawDuration === "number" && Number.isFinite(rawDuration) ? rawDuration : 0;

  let costResource: TCost = opts.defaultCost;
  let costValueExplicit = false;
  let costValue = 0;
  const rawCost = o.cost;
  if (typeof rawCost === "string") {
    const matched = matchKeyLoose(opts.costKeys, rawCost);
    if (matched) costResource = matched;
    costValue = costResource !== opts.defaultCost ? 1 : 0;
  } else if (rawCost && typeof rawCost === "object") {
    const co = rawCost as Record<string, unknown>;
    if (typeof co.resource === "string") {
      const matched = matchKeyLoose(opts.costKeys, co.resource);
      if (matched) costResource = matched;
    }
    if (typeof co.value === "number" && Number.isFinite(co.value)) {
      costValue = co.value;
      costValueExplicit = true;
    } else {
      costValue = costResource !== opts.defaultCost ? 1 : 0;
    }
  }

  const grade = opts.grade;
  if (grade && !effectValueExplicit) {
    const category = opts.effectKeyToCategory(effectLabel);
    effectValue = computeEffectValue(category, grade, trigger as string, Math.max(0, Math.floor(duration)), costResource as string);
  }
  if (grade && !costValueExplicit) {
    costValue = computeCostValue(costResource as string, grade);
  }

  return { trigger, effect: { label: effectLabel, value: effectValue }, duration, cost: { resource: costResource, value: costValue } };
}

// ═══════════════════════════════════════════════════════════════════════════
// 品阶与数值体系（各类型共用）
// ═══════════════════════════════════════════════════════════════════════════

export {
  GRADE_INDEX,
  EFFECT_BASE_VALUES,
  TRIGGER_VALUE_MULTIPLIER,
  DURATION_PER_TURN_FACTORS,
  COST_VALUE_MULTIPLIER,
  COST_BASE_VALUES,
} from "./gameConstants";

import {
  GRADE_INDEX,
  EFFECT_BASE_VALUES,
  TRIGGER_VALUE_MULTIPLIER,
  DURATION_PER_TURN_FACTORS,
  COST_VALUE_MULTIPLIER,
  COST_BASE_VALUES,
} from "./gameConstants";

export function lookupDurationFactor(duration: number): number {
  let factor = DURATION_PER_TURN_FACTORS[0][1];
  for (const [threshold, f] of DURATION_PER_TURN_FACTORS) {
    if (duration >= threshold) factor = f;
    else break;
  }
  return factor;
}

export function computeEffectValue(
  category: EffectValueCategory,
  grade: string,
  trigger: string,
  duration: number,
  costResource: string,
): number {
  const baseArr = EFFECT_BASE_VALUES[category];
  const gradeIdx = GRADE_INDEX[grade] ?? 0;
  const [lo, hi] = baseArr[Math.min(gradeIdx, baseArr.length - 1)];
  const base = lo + Math.floor(Math.random() * (hi - lo + 1));
  const triggerMul = TRIGGER_VALUE_MULTIPLIER[trigger] ?? 1.0;
  const durFactor = lookupDurationFactor(duration);
  const costMul = COST_VALUE_MULTIPLIER[costResource] ?? 1.0;
  return Math.max(1, Math.floor(base * triggerMul * durFactor * costMul));
}

export function computeCostValue(costResource: string, grade: string): number {
  const arr = COST_BASE_VALUES[costResource];
  if (!arr) return 0;
  const gradeIdx = GRADE_INDEX[grade] ?? 0;
  const [lo, hi] = arr[Math.min(gradeIdx, arr.length - 1)];
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// ═══════════════════════════════════════════════════════════════════════════
// 跨类型聚合
// ═══════════════════════════════════════════════════════════════════════════

/** 所有物品类型的特殊效果联合 */
export type ItemSpecialEffect =
  | TreasureSpecialEffect
  | GongfaSpecialEffect;

/** 通用类型别名，供不关心具体类型的消费者使用 */
export type SpecialEffect = ItemSpecialEffect;

/** 物品类型 → 对应的 SpecialEffect 类型映射 */
export interface TypedEffectMap {
  法宝: TreasureSpecialEffect;
  功法: GongfaSpecialEffect;
}

// ── 跨类型中文查找（合并所有类型的映射） ──

const ALL_TRIGGER_TO_ZH: Readonly<Record<string, string>> = {
  ...TREASURE_TRIGGER_TO_ZH,
  ...GONGFA_TRIGGER_TO_ZH,
};

const ALL_EFFECT_TO_ZH: Readonly<Record<string, string>> = {
  ...TREASURE_EFFECT_TO_ZH,
  ...GONGFA_EFFECT_TO_ZH,
};

const ALL_COST_TO_ZH: Readonly<Record<string, string>> = {
  ...TREASURE_COST_TO_ZH,
  ...GONGFA_COST_TO_ZH,
};

const ALL_EFFECT_CATEGORY: Readonly<Record<string, EffectCategory>> = {
  ...TREASURE_EFFECT_CATEGORY,
  ...GONGFA_EFFECT_CATEGORY,
};

export function lookupTriggerZh(trigger: string): string {
  return ALL_TRIGGER_TO_ZH[trigger] ?? trigger;
}

export function lookupEffectZh(label: string): string {
  return ALL_EFFECT_TO_ZH[label] ?? label;
}

export function lookupCostZh(resource: string): string {
  return ALL_COST_TO_ZH[resource] ?? resource;
}

export function lookupEffectCategory(label: string): EffectValueCategory {
  return categoryToValueCategory(ALL_EFFECT_CATEGORY[label]);
}

export function firstEffectKeyOfCategoryAcrossTypes(vc: EffectValueCategory): string {
  for (const k of Object.keys(ALL_EFFECT_CATEGORY)) {
    if (categoryToValueCategory(ALL_EFFECT_CATEGORY[k]) === vc) return k;
  }
  return "boostPatk";
}

// ── 各类型允许的效果分类白名单 ──

export const ITEM_TYPE_ALLOWED_EFFECTS: Readonly<Record<SpecialEffectTarget, ReadonlySet<EffectValueCategory>>> = {
  法宝: TREASURE_ALLOWED_EFFECT_CATEGORIES,
  功法: GONGFA_ALLOWED_EFFECT_CATEGORIES,
};

// ── 按物品类型分发 AI 归一化 ──

export function normalizeTypedAiFunction(
  raw: unknown,
  itemType: SpecialEffectTarget,
  grade?: string,
): ItemSpecialEffect | undefined {
  switch (itemType) {
    case "法宝": return normalizeTreasureAiFunction(raw, grade);
    case "功法": return normalizeGongfaAiFunction(raw, grade);
    default: return undefined;
  }
}

// ── 按物品类型强制覆盖 function 字段 ──

export interface FunctionOverride {
  trigger?: string;
  cost?: string;
  duration?: number;
}

export const ITEM_TYPE_FUNCTION_OVERRIDES: Readonly<
  Record<SpecialEffectTarget, FunctionOverride>
> = {
  法宝: {},
  功法: {},
};

export function applyFunctionOverrides(
  fn: SpecialEffect | undefined,
  itemType: string,
): SpecialEffect | undefined {
  if (!fn) return fn;
  const override = ITEM_TYPE_FUNCTION_OVERRIDES[itemType as SpecialEffectTarget];
  if (!override) return fn;
  const newTrigger = override.trigger ?? fn.trigger;
  const newDuration = override.duration ?? fn.duration;
  const newCost = override.cost != null
    ? { resource: override.cost as typeof fn.cost.resource, value: 0 }
    : fn.cost;
  return {
    trigger: newTrigger,
    effect: fn.effect,
    duration: newDuration,
    cost: newCost,
  } as SpecialEffect;
}

export function applyTypedFunctionOverrides<T extends SpecialEffectTarget>(
  fn: SpecialEffect | undefined,
  itemType: T,
): TypedEffectMap[T] | undefined {
  return applyFunctionOverrides(fn, itemType) as TypedEffectMap[T] | undefined;
}
