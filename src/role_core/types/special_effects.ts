/**
 * 按物品类型（法宝、功法、丹药、符箓、阵法）完全独立的效果定义。
 * 每种物品类型拥有自己的触发时机、效果键、消耗资源、持续回合与中文映射，
 * 不依赖共享总表，便于后续各类型独立扩展。
 */

/** 可携带特殊效果的物品种类标记 */
export type SpecialEffectTarget =
  | "法宝"
  | "功法"
  | "丹药"
  | "符箓"
  | "阵法";

/** 效果分类（中文） */
export type EffectCategory = "恢复" | "增益" | "减益" | "伤害";

/** 特效数值分类键（用于数值计算） */
export type EffectValueCategory = "recover" | "boost" | "reduce" | "damage";

// ═══════════════════════════════════════════════════════════════════════════
// 内部通用工具
// ═══════════════════════════════════════════════════════════════════════════

function matchKeyLoose<T extends string>(keys: readonly T[], s: string): T | undefined {
  const lower = s.toLowerCase();
  for (const k of keys) {
    if (k.toLowerCase() === lower) return k;
  }
  return undefined;
}

function categoryToValueCategory(cat: EffectCategory | undefined): EffectValueCategory {
  if (cat === "恢复") return "recover";
  if (cat === "增益") return "boost";
  if (cat === "减益") return "reduce";
  return "damage";
}

function firstKeyOfValueCategory<T extends string>(
  keys: readonly T[],
  catMap: Readonly<Record<string, EffectCategory>>,
  vc: EffectValueCategory,
): T {
  for (const k of keys) {
    if (categoryToValueCategory(catMap[k]) === vc) return k;
  }
  return keys[0];
}

interface NormalizeOpts<TTrigger extends string, TEffect extends string, TCost extends string> {
  raw: unknown;
  triggerKeys: readonly TTrigger[];
  defaultTrigger: TTrigger;
  effectKeys: readonly TEffect[];
  effectKeyToCategory: (label: TEffect) => EffectValueCategory;
  costKeys: readonly TCost[];
  defaultCost: TCost;
  grade?: string;
  affinityBonus?: number;
}

function normalizeGeneric<TTrigger extends string, TEffect extends string, TCost extends string>(
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
    effectValue = computeEffectValue(category, grade, trigger as string, Math.max(0, Math.floor(duration)), costResource as string, opts.affinityBonus);
  }
  if (grade && !costValueExplicit) {
    costValue = computeCostValue(costResource as string, grade);
  }

  return { trigger, effect: { label: effectLabel, value: effectValue }, duration, cost: { resource: costResource, value: costValue } };
}

// ═══════════════════════════════════════════════════════════════════════════
// 法宝
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

export const TREASURE_COST_KEYS = ["none", "mp", "hp"] as const;
export type TreasureCostKey = (typeof TREASURE_COST_KEYS)[number];
export const TREASURE_COST_TO_ZH: Readonly<Record<TreasureCostKey, string>> = {
  none: "无消耗",
  mp: "消耗法力",
  hp: "消耗血量",
};

export interface TreasureSpecialEffect {
  trigger: TreasureTriggerTiming;
  effect: { label: TreasureEffectKey; value: number };
  duration: number;
  cost: { resource: TreasureCostKey; value: number };
}

export const TREASURE_ALLOWED_TRIGGERS: ReadonlySet<string> = new Set<string>(TREASURE_TRIGGER_KEYS);
export const TREASURE_ALLOWED_EFFECT_CATEGORIES: ReadonlySet<EffectValueCategory> = new Set(["recover", "boost"] as const);

export function matchTreasureEffectKeyLoose(s: string): TreasureEffectKey | undefined {
  return matchKeyLoose(TREASURE_EFFECT_KEYS, s);
}

export function treasureEffectKeyToCategory(label: TreasureEffectKey): EffectValueCategory {
  return categoryToValueCategory(TREASURE_EFFECT_CATEGORY[label]);
}

export function firstTreasureEffectKeyOfCategory(vc: EffectValueCategory): TreasureEffectKey {
  return firstKeyOfValueCategory(TREASURE_EFFECT_KEYS, TREASURE_EFFECT_CATEGORY, vc);
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
// 功法
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

export const GONGFA_COST_KEYS = ["none", "mp", "hp"] as const;
export type GongfaCostKey = (typeof GONGFA_COST_KEYS)[number];
export const GONGFA_COST_TO_ZH: Readonly<Record<GongfaCostKey, string>> = {
  none: "无消耗",
  mp: "消耗法力",
  hp: "消耗血量",
};

export interface GongfaSpecialEffect {
  trigger: GongfaTriggerTiming;
  effect: { label: GongfaEffectKey; value: number };
  duration: number;
  cost: { resource: GongfaCostKey; value: number };
}

export const GONGFA_ALLOWED_TRIGGERS: ReadonlySet<string> = new Set<string>(GONGFA_TRIGGER_KEYS);
export const GONGFA_ALLOWED_EFFECT_CATEGORIES: ReadonlySet<EffectValueCategory> = new Set(["boost", "damage"] as const);

export function matchGongfaEffectKeyLoose(s: string): GongfaEffectKey | undefined {
  return matchKeyLoose(GONGFA_EFFECT_KEYS, s);
}

export function gongfaEffectKeyToCategory(label: GongfaEffectKey): EffectValueCategory {
  return categoryToValueCategory(GONGFA_EFFECT_CATEGORY[label]);
}

export function firstGongfaEffectKeyOfCategory(vc: EffectValueCategory): GongfaEffectKey {
  return firstKeyOfValueCategory(GONGFA_EFFECT_KEYS, GONGFA_EFFECT_CATEGORY, vc);
}

export function normalizeGongfaAiFunction(raw: unknown, grade?: string, affinityBonus?: number): GongfaSpecialEffect | undefined {
  return normalizeGeneric({
    raw,
    triggerKeys: GONGFA_TRIGGER_KEYS,
    defaultTrigger: "on_attack",
    effectKeys: GONGFA_EFFECT_KEYS,
    effectKeyToCategory: gongfaEffectKeyToCategory,
    costKeys: GONGFA_COST_KEYS,
    defaultCost: "none",
    grade,
    affinityBonus,
  }) as GongfaSpecialEffect | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// 丹药
// ═══════════════════════════════════════════════════════════════════════════

export const ELIXIR_TRIGGER_KEYS = ["on_attack"] as const;
export type ElixirTriggerTiming = (typeof ELIXIR_TRIGGER_KEYS)[number];

export const ELIXIR_TRIGGER_TO_ZH: Readonly<Record<ElixirTriggerTiming, string>> = {
  on_attack: "主动触发",
};

export const ELIXIR_TRIGGER_CATEGORY: Readonly<Record<ElixirTriggerTiming, "主动" | "被动" | "默认">> = {
  on_attack: "主动",
};

export const ELIXIR_EFFECT_KEYS = [
  "recoverHp", "recoverMp",
  "boostPatk", "boostMatk", "boostPdef", "boostMdef",
] as const;
export type ElixirEffectKey = (typeof ELIXIR_EFFECT_KEYS)[number];

export const ELIXIR_EFFECT_TO_ZH: Readonly<Record<ElixirEffectKey, string>> = {
  recoverHp: "恢复血量",
  recoverMp: "恢复法力",
  boostPatk: "增加物攻",
  boostMatk: "增加法攻",
  boostPdef: "增加物防",
  boostMdef: "增加法防",
};

export const ELIXIR_EFFECT_CATEGORY: Readonly<Record<ElixirEffectKey, EffectCategory>> = {
  recoverHp: "恢复", recoverMp: "恢复",
  boostPatk: "增益", boostMatk: "增益", boostPdef: "增益", boostMdef: "增益",
};

export const ELIXIR_COST_KEYS = ["none"] as const;
export type ElixirCostKey = (typeof ELIXIR_COST_KEYS)[number];
export const ELIXIR_COST_TO_ZH: Readonly<Record<ElixirCostKey, string>> = {
  none: "无消耗",
};

export interface ElixirSpecialEffect {
  trigger: ElixirTriggerTiming;
  effect: { label: ElixirEffectKey; value: number };
  duration: number;
  cost: { resource: ElixirCostKey; value: number };
}

export const ELIXIR_ALLOWED_EFFECT_CATEGORIES: ReadonlySet<EffectValueCategory> = new Set(["recover", "boost"] as const);

export function matchElixirEffectKeyLoose(s: string): ElixirEffectKey | undefined {
  return matchKeyLoose(ELIXIR_EFFECT_KEYS, s);
}

export function elixirEffectKeyToCategory(label: ElixirEffectKey): EffectValueCategory {
  return categoryToValueCategory(ELIXIR_EFFECT_CATEGORY[label]);
}

export function firstElixirEffectKeyOfCategory(vc: EffectValueCategory): ElixirEffectKey {
  return firstKeyOfValueCategory(ELIXIR_EFFECT_KEYS, ELIXIR_EFFECT_CATEGORY, vc);
}

export function normalizeElixirAiFunction(raw: unknown, grade?: string): ElixirSpecialEffect | undefined {
  const result = normalizeGeneric({
    raw,
    triggerKeys: ELIXIR_TRIGGER_KEYS,
    defaultTrigger: "on_attack",
    effectKeys: ELIXIR_EFFECT_KEYS,
    effectKeyToCategory: elixirEffectKeyToCategory,
    costKeys: ELIXIR_COST_KEYS,
    defaultCost: "none",
    grade,
  });
  if (!result) return undefined;
  return {
    trigger: "on_attack",
    effect: result.effect,
    duration: result.duration,
    cost: { resource: "none", value: 0 },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 符箓
// ═══════════════════════════════════════════════════════════════════════════

export const TALISMAN_TRIGGER_KEYS = ["on_attack"] as const;
export type TalismanTriggerTiming = (typeof TALISMAN_TRIGGER_KEYS)[number];

export const TALISMAN_TRIGGER_TO_ZH: Readonly<Record<TalismanTriggerTiming, string>> = {
  on_attack: "主动触发",
};

export const TALISMAN_TRIGGER_CATEGORY: Readonly<Record<TalismanTriggerTiming, "主动" | "被动" | "默认">> = {
  on_attack: "主动",
};

export const TALISMAN_EFFECT_KEYS = [
  "dealPhysicalDmg", "dealMagicDmg",
  "dealFireDmg", "dealIceDmg", "dealPoisonDmg", "dealLightningDmg",
] as const;
export type TalismanEffectKey = (typeof TALISMAN_EFFECT_KEYS)[number];

export const TALISMAN_EFFECT_TO_ZH: Readonly<Record<TalismanEffectKey, string>> = {
  dealPhysicalDmg: "造成物伤",
  dealMagicDmg: "造成法伤",
  dealFireDmg: "造成火伤",
  dealIceDmg: "造成冰伤",
  dealPoisonDmg: "造成毒伤",
  dealLightningDmg: "造成雷伤",
};

export const TALISMAN_EFFECT_CATEGORY: Readonly<Record<TalismanEffectKey, EffectCategory>> = {
  dealPhysicalDmg: "伤害", dealMagicDmg: "伤害",
  dealFireDmg: "伤害", dealIceDmg: "伤害", dealPoisonDmg: "伤害", dealLightningDmg: "伤害",
};

export const TALISMAN_COST_KEYS = ["mp", "hp"] as const;
export type TalismanCostKey = (typeof TALISMAN_COST_KEYS)[number];
export const TALISMAN_COST_TO_ZH: Readonly<Record<TalismanCostKey, string>> = {
  mp: "消耗法力",
  hp: "消耗血量",
};

export interface TalismanSpecialEffect {
  trigger: TalismanTriggerTiming;
  effect: { label: TalismanEffectKey; value: number };
  duration: number;
  cost: { resource: TalismanCostKey; value: number };
}

export const TALISMAN_ALLOWED_EFFECT_CATEGORIES: ReadonlySet<EffectValueCategory> = new Set(["damage"] as const);

export function matchTalismanEffectKeyLoose(s: string): TalismanEffectKey | undefined {
  return matchKeyLoose(TALISMAN_EFFECT_KEYS, s);
}

export function talismanEffectKeyToCategory(label: TalismanEffectKey): EffectValueCategory {
  return categoryToValueCategory(TALISMAN_EFFECT_CATEGORY[label]);
}

export function firstTalismanEffectKeyOfCategory(vc: EffectValueCategory): TalismanEffectKey {
  return firstKeyOfValueCategory(TALISMAN_EFFECT_KEYS, TALISMAN_EFFECT_CATEGORY, vc);
}

export function normalizeTalismanAiFunction(raw: unknown, grade?: string): TalismanSpecialEffect | undefined {
  const result = normalizeGeneric({
    raw,
    triggerKeys: TALISMAN_TRIGGER_KEYS,
    defaultTrigger: "on_attack",
    effectKeys: TALISMAN_EFFECT_KEYS,
    effectKeyToCategory: talismanEffectKeyToCategory,
    costKeys: TALISMAN_COST_KEYS,
    defaultCost: "mp",
    grade,
  });
  if (!result) return undefined;
  return {
    trigger: "on_attack",
    effect: result.effect,
    duration: result.duration,
    cost: result.cost,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 阵法
// ═══════════════════════════════════════════════════════════════════════════

export const FORMATION_TRIGGER_KEYS = ["on_attack"] as const;
export type FormationTriggerTiming = (typeof FORMATION_TRIGGER_KEYS)[number];

export const FORMATION_TRIGGER_TO_ZH: Readonly<Record<FormationTriggerTiming, string>> = {
  on_attack: "主动触发",
};

export const FORMATION_TRIGGER_CATEGORY: Readonly<Record<FormationTriggerTiming, "主动" | "被动" | "默认">> = {
  on_attack: "主动",
};

export const FORMATION_EFFECT_KEYS = [
  "recoverHp", "recoverMp", "boostPatk", "boostMatk", "boostPdef", "boostMdef",
  "boostPenetration", "boostHitRate", "boostDodgeRate", "boostCritRate",
  "boostCritDmg", "boostRecovery", "boostCastSpeed", "boostActionSpeed",
  "boostEffectChance", "boostControlResist",
  "reducePatk", "reduceMatk", "reducePdef", "reduceMdef",
  "reducePenetration", "reduceHitRate", "reduceDodgeRate", "reduceCritRate",
  "reduceCritDmg", "reduceRecovery", "reduceCastSpeed", "reduceActionSpeed",
  "reduceEffectChance", "reduceControlResist",
] as const;
export type FormationEffectKey = (typeof FORMATION_EFFECT_KEYS)[number];

export const FORMATION_EFFECT_TO_ZH: Readonly<Record<FormationEffectKey, string>> = {
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
};

export const FORMATION_EFFECT_CATEGORY: Readonly<Record<FormationEffectKey, EffectCategory>> = {
  recoverHp: "恢复", recoverMp: "恢复", boostPatk: "增益", boostMatk: "增益",
  boostPdef: "增益", boostMdef: "增益", boostPenetration: "增益",
  boostHitRate: "增益", boostDodgeRate: "增益", boostCritRate: "增益",
  boostCritDmg: "增益", boostRecovery: "增益", boostCastSpeed: "增益",
  boostActionSpeed: "增益", boostEffectChance: "增益", boostControlResist: "增益",
  reducePatk: "减益", reduceMatk: "减益",
  reducePdef: "减益", reduceMdef: "减益", reducePenetration: "减益",
  reduceHitRate: "减益", reduceDodgeRate: "减益", reduceCritRate: "减益",
  reduceCritDmg: "减益", reduceRecovery: "减益", reduceCastSpeed: "减益",
  reduceActionSpeed: "减益", reduceEffectChance: "减益", reduceControlResist: "减益",
};

export const FORMATION_COST_KEYS = ["mp", "hp"] as const;
export type FormationCostKey = (typeof FORMATION_COST_KEYS)[number];
export const FORMATION_COST_TO_ZH: Readonly<Record<FormationCostKey, string>> = {
  mp: "消耗法力",
  hp: "消耗血量",
};

export interface FormationSpecialEffect {
  trigger: FormationTriggerTiming;
  effect: { label: FormationEffectKey; value: number };
  duration: number;
  cost: { resource: FormationCostKey; value: number };
}

export const FORMATION_ALLOWED_EFFECT_CATEGORIES: ReadonlySet<EffectValueCategory> = new Set(["recover", "boost", "reduce"] as const);

export function matchFormationEffectKeyLoose(s: string): FormationEffectKey | undefined {
  return matchKeyLoose(FORMATION_EFFECT_KEYS, s);
}

export function formationEffectKeyToCategory(label: FormationEffectKey): EffectValueCategory {
  return categoryToValueCategory(FORMATION_EFFECT_CATEGORY[label]);
}

export function firstFormationEffectKeyOfCategory(vc: EffectValueCategory): FormationEffectKey {
  return firstKeyOfValueCategory(FORMATION_EFFECT_KEYS, FORMATION_EFFECT_CATEGORY, vc);
}

export function normalizeFormationAiFunction(raw: unknown, grade?: string): FormationSpecialEffect | undefined {
  const result = normalizeGeneric({
    raw,
    triggerKeys: FORMATION_TRIGGER_KEYS,
    defaultTrigger: "on_attack",
    effectKeys: FORMATION_EFFECT_KEYS,
    effectKeyToCategory: formationEffectKeyToCategory,
    costKeys: FORMATION_COST_KEYS,
    defaultCost: "mp",
    grade,
  });
  if (!result) return undefined;
  return {
    trigger: "on_attack",
    effect: result.effect,
    duration: result.duration,
    cost: result.cost,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 跨类型工具
// ═══════════════════════════════════════════════════════════════════════════

/** 所有物品类型的特殊效果联合 */
export type ItemSpecialEffect =
  | TreasureSpecialEffect
  | GongfaSpecialEffect
  | ElixirSpecialEffect
  | TalismanSpecialEffect
  | FormationSpecialEffect;

/** 通用类型别名，供不关心具体类型的消费者使用 */
export type SpecialEffect = ItemSpecialEffect;

/** 物品类型 → 对应的 SpecialEffect 类型映射 */
export interface TypedEffectMap {
  法宝: TreasureSpecialEffect;
  功法: GongfaSpecialEffect;
  丹药: ElixirSpecialEffect;
  符箓: TalismanSpecialEffect;
  阵法: FormationSpecialEffect;
}

// ── 跨类型中文查找（合并所有类型的映射） ──

const ALL_TRIGGER_TO_ZH: Readonly<Record<string, string>> = {
  ...TREASURE_TRIGGER_TO_ZH,
  ...GONGFA_TRIGGER_TO_ZH,
  ...ELIXIR_TRIGGER_TO_ZH,
  ...TALISMAN_TRIGGER_TO_ZH,
  ...FORMATION_TRIGGER_TO_ZH,
};

const ALL_EFFECT_TO_ZH: Readonly<Record<string, string>> = {
  ...TREASURE_EFFECT_TO_ZH,
  ...GONGFA_EFFECT_TO_ZH,
  ...ELIXIR_EFFECT_TO_ZH,
  ...TALISMAN_EFFECT_TO_ZH,
  ...FORMATION_EFFECT_TO_ZH,
};

const ALL_COST_TO_ZH: Readonly<Record<string, string>> = {
  ...TREASURE_COST_TO_ZH,
  ...GONGFA_COST_TO_ZH,
  ...ELIXIR_COST_TO_ZH,
  ...TALISMAN_COST_TO_ZH,
  ...FORMATION_COST_TO_ZH,
};

const ALL_EFFECT_CATEGORY: Readonly<Record<string, EffectCategory>> = {
  ...TREASURE_EFFECT_CATEGORY,
  ...GONGFA_EFFECT_CATEGORY,
  ...ELIXIR_EFFECT_CATEGORY,
  ...TALISMAN_EFFECT_CATEGORY,
  ...FORMATION_EFFECT_CATEGORY,
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
  丹药: ELIXIR_ALLOWED_EFFECT_CATEGORIES,
  符箓: TALISMAN_ALLOWED_EFFECT_CATEGORIES,
  阵法: FORMATION_ALLOWED_EFFECT_CATEGORIES,
};

// ── 按物品类型分发 AI 归一化 ──

export function normalizeTypedAiFunction(
  raw: unknown,
  itemType: SpecialEffectTarget,
  grade?: string,
  affinityBonus?: number,
): ItemSpecialEffect | undefined {
  switch (itemType) {
    case "法宝": return normalizeTreasureAiFunction(raw, grade);
    case "功法": return normalizeGongfaAiFunction(raw, grade, affinityBonus);
    case "丹药": return normalizeElixirAiFunction(raw, grade);
    case "符箓": return normalizeTalismanAiFunction(raw, grade);
    case "阵法": return normalizeFormationAiFunction(raw, grade);
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
  丹药: { trigger: "on_attack", cost: "none" },
  符箓: { trigger: "on_attack" },
  阵法: { trigger: "on_attack" },
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

export function computeCostValue(costResource: string, grade: string): number {
  const arr = COST_BASE_VALUES[costResource];
  if (!arr) return 0;
  const gradeIdx = GRADE_INDEX[grade] ?? 0;
  const [lo, hi] = arr[Math.min(gradeIdx, arr.length - 1)];
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
