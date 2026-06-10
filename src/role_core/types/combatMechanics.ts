/**
 * 战斗机制数据层：MechanicId + 品阶威力表 + powerKey 映射 + 效果组件系统。
 *
 * 核心概念：
 * - MechanicId：粗粒度机制分类（~42 种），法宝/功法共用
 * - EffectComponent：原子效果组件，每个组件有独立的 mechanic、trigger、desc
 * - 特殊效果 = 多个 EffectComponent 的组合，展示时逐组件解析数值后拼接
 */

import type { ItemGrade } from "./itemInfo";
import { GONGFA_MASTERY_COMBAT_MULT } from "./gameConstants";

// ═══════════════════════════════════════════════════════════════════════════
// 触发条件
// ═══════════════════════════════════════════════════════════════════════════

export type EffectTrigger =
  | "active"
  | "on_attack"
  | "on_hit"
  | "on_kill"
  | "on_crit"
  | "on_dodge"
  | "on_turn_start"
  | "on_turn_end"
  | "on_battle_start"
  | "on_fatal"
  | "passive";

// ═══════════════════════════════════════════════════════════════════════════
// 状态施加
// ═══════════════════════════════════════════════════════════════════════════

export type StatusId =
  | "poison"
  | "burn"
  | "shock"
  | "frost"
  | "corrode"
  | "thunder_seal"
  | "fire_seed"
  | "sword_intent";

// ═══════════════════════════════════════════════════════════════════════════
// 机制分类
// ═══════════════════════════════════════════════════════════════════════════

export type MechanicCategory =
  | "damage"
  | "buff"
  | "debuff"
  | "cc"
  | "heal"
  | "summon"
  | "utility";

// ═══════════════════════════════════════════════════════════════════════════
// 机制 ID（粗粒度）
// ═══════════════════════════════════════════════════════════════════════════

export const MECHANIC_IDS = [
  "dmg_single",
  "dmg_aoe",
  "dmg_dot",
  "dmg_dot_pct",
  "dmg_execute",
  "dmg_pierce",
  "buff_atk",
  "buff_def",
  "buff_crit",
  "buff_crit_dmg",
  "buff_speed",
  "buff_dodge",
  "buff_shield",
  "buff_stealth",
  "buff_stat",
  "buff_ramp",
  "debuff_def",
  "debuff_atk",
  "debuff_speed",
  "debuff_heal",
  "debuff_mp",
  "cc_freeze",
  "cc_stun",
  "cc_fear",
  "cc_root",
  "cc_silence",
  "heal_single",
  "heal_aoe",
  "heal_lifesteal",
  "heal_lifesteal_pct",
  "summon",
  "cleanse",
  "revive",
  "kill_bonus",
  "death_ward",
  "sacrifice",
  "extra_action",
  "reflect",
  "counter",
  "damage_share",
  "dispel",
  "debuff_mark",
] as const;

export type MechanicId = (typeof MECHANIC_IDS)[number];

// ═══════════════════════════════════════════════════════════════════════════
// 效果组件
// ═══════════════════════════════════════════════════════════════════════════

export type ScalingStatKey =
  | "strength" | "perception" | "guard" | "resistance"
  | "agility" | "physique" | "spirit"
  | "maxHp" | "maxMp";

export interface EffectComponent {
  mechanic?: MechanicId;
  status?: StatusId;
  trigger: EffectTrigger;
  condition?: string;
  desc: string;
  baseValue?: number;
  scalingRatio?: number;
  scalingStat?: ScalingStatKey;
  duration?: number;
  noMasteryScaling?: boolean;
}

export function calcComponentValue(
  comp: EffectComponent,
  getStat: (key: string) => number,
  mastery?: number,
): number {
  if (comp.baseValue == null) return 0;
  const base = comp.baseValue;
  const ratio = comp.scalingRatio ?? 0;
  const stat = comp.scalingStat ? getStat(comp.scalingStat) : 0;
  const raw = base + ratio * stat;
  if (comp.noMasteryScaling) return raw;
  const mult = mastery != null && mastery >= 1
    ? GONGFA_MASTERY_COMBAT_MULT[Math.min(mastery, GONGFA_MASTERY_COMBAT_MULT.length) - 1]
    : 1;
  return raw * mult;
}

// ═══════════════════════════════════════════════════════════════════════════
// 法宝品阶 — 固定值表（纯被动，不随角色属性缩放）
// ═══════════════════════════════════════════════════════════════════════════

export interface GradeFlatPower {
  buffPct: number;
  reductionPct: number;
  flatDmg: number;
  flatHeal: number;
  flatShield: number;
  ccChance: number;
  specialPct: number;
}

export type FlatPowerKey = keyof GradeFlatPower;

export const GRADE_FLAT_POWER: Readonly<Record<ItemGrade, GradeFlatPower>> = {
  "下品": { buffPct: 0.05, reductionPct: 0.05, flatDmg: 50,   flatHeal: 50,   flatShield: 100,  ccChance: 0.15, specialPct: 0.05 },
  "中品": { buffPct: 0.08, reductionPct: 0.08, flatDmg: 120,  flatHeal: 120,  flatShield: 250,  ccChance: 0.25, specialPct: 0.08 },
  "上品": { buffPct: 0.12, reductionPct: 0.12, flatDmg: 250,  flatHeal: 250,  flatShield: 500,  ccChance: 0.35, specialPct: 0.12 },
  "极品": { buffPct: 0.18, reductionPct: 0.18, flatDmg: 500,  flatHeal: 500,  flatShield: 1000, ccChance: 0.50, specialPct: 0.18 },
  "仙品": { buffPct: 0.25, reductionPct: 0.25, flatDmg: 1000, flatHeal: 1000, flatShield: 2000, ccChance: 0.65, specialPct: 0.25 },
  "神品": { buffPct: 0.35, reductionPct: 0.35, flatDmg: 2000, flatHeal: 2000, flatShield: 4000, ccChance: 0.80, specialPct: 0.35 },
};

// ═══════════════════════════════════════════════════════════════════════════
// 功法体系 — 伤害属性映射 + 体系倍率
// ═══════════════════════════════════════════════════════════════════════════

export type DamageStatType = "strength" | "perception";

export const SYSTEM_DAMAGE_STAT: Readonly<Record<string, DamageStatType>> = {
  "剑系": "strength",
  "体修": "strength",
  "法修": "perception",
  "刺客系": "strength",
  "毒系": "perception",
  "魔修": "perception",
  "火系": "perception",
  "雷系": "perception",
  "冰系": "perception",
  "暗系": "strength",
  "风系": "strength",
  "木系": "perception",
};

export interface SystemPowerMult {
  dmg: number;
  heal: number;
  shield: number;
}

export const SYSTEM_POWER_MULT: Readonly<Record<string, SystemPowerMult>> = {
  "剑系":   { dmg: 1.2, heal: 0.5, shield: 0.5 },
  "体修":   { dmg: 0.7, heal: 0.8, shield: 1.5 },
  "法修":   { dmg: 1.3, heal: 0.8, shield: 0.5 },
  "刺客系": { dmg: 1.4, heal: 0.3, shield: 0.3 },
  "毒系":   { dmg: 0.9, heal: 0.5, shield: 0.3 },
  "魔修":   { dmg: 1.2, heal: 0.8, shield: 0.5 },
  "火系":   { dmg: 1.3, heal: 0.3, shield: 0.3 },
  "雷系":   { dmg: 1.2, heal: 0.5, shield: 0.5 },
  "冰系":   { dmg: 1.0, heal: 0.5, shield: 1.0 },
  "暗系":   { dmg: 1.1, heal: 0.5, shield: 0.3 },
  "风系":   { dmg: 1.1, heal: 0.5, shield: 0.5 },
  "木系":   { dmg: 0.6, heal: 1.5, shield: 1.0 },
};

export interface DerivedStatValues {
  strength: number;
  perception: number;
  guard: number;
  resistance: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 功法品阶 — 缩放倍率表（effectValue = scalingStat × scalingPower × systemMult）
// ═══════════════════════════════════════════════════════════════════════════

export interface GradeScalingPower {
  dmgMult: number;
  healMult: number;
  buffMult: number;
  debuffMult: number;
  ccChance: number;
  specialMult: number;
}

export type ScalingPowerKey = keyof GradeScalingPower;

export const GRADE_SCALING_POWER: Readonly<Record<ItemGrade, GradeScalingPower>> = {
  "下品": { dmgMult: 1.0, healMult: 0.5, buffMult: 0.05, debuffMult: 0.05, ccChance: 0.20, specialMult: 0.10 },
  "中品": { dmgMult: 1.5, healMult: 0.8, buffMult: 0.08, debuffMult: 0.08, ccChance: 0.30, specialMult: 0.15 },
  "上品": { dmgMult: 2.2, healMult: 1.2, buffMult: 0.12, debuffMult: 0.12, ccChance: 0.45, specialMult: 0.22 },
  "极品": { dmgMult: 3.2, healMult: 1.8, buffMult: 0.18, debuffMult: 0.18, ccChance: 0.60, specialMult: 0.30 },
  "仙品": { dmgMult: 4.5, healMult: 2.5, buffMult: 0.25, debuffMult: 0.25, ccChance: 0.75, specialMult: 0.40 },
  "神品": { dmgMult: 6.0, healMult: 3.5, buffMult: 0.35, debuffMult: 0.35, ccChance: 0.90, specialMult: 0.50 },
};

// ═══════════════════════════════════════════════════════════════════════════
// 机制元数据（含 powerKey 映射）
//
// flatPowerKey    → 战斗引擎查 GRADE_FLAT_POWER[grade][key]  得法宝数值
// scalingPowerKey → 战斗引擎查 GRADE_SCALING_POWER[grade][key] 得功法数值
//   功法最终数值 = primaryStat × scalingPower
// ═══════════════════════════════════════════════════════════════════════════

export interface MechanicMeta {
  category: MechanicCategory;
  label: string;
  flatPowerKey: FlatPowerKey;
  scalingPowerKey: ScalingPowerKey;
  /** 若 true，功法缩放时不乘主属性，直接用 scalingPowerKey 的原始值（如 ccChance 概率） */
  noStatScaling?: boolean;
}

export const MECHANIC_META: Readonly<Record<MechanicId, MechanicMeta>> = {
  // ── damage ────────────────────────────────────────────────────────────
  dmg_single:       { category: "damage",  label: "单体伤害",       flatPowerKey: "flatDmg",      scalingPowerKey: "dmgMult" },
  dmg_aoe:          { category: "damage",  label: "群体伤害",       flatPowerKey: "flatDmg",      scalingPowerKey: "dmgMult" },
  dmg_dot:          { category: "damage",  label: "持续伤害",       flatPowerKey: "flatDmg",      scalingPowerKey: "dmgMult" },
  dmg_dot_pct:      { category: "damage",  label: "百分比持续伤害", flatPowerKey: "reductionPct",  scalingPowerKey: "debuffMult" },
  dmg_execute:      { category: "damage",  label: "斩杀伤害",       flatPowerKey: "flatDmg",      scalingPowerKey: "dmgMult" },
  dmg_pierce:       { category: "damage",  label: "穿透伤害",       flatPowerKey: "flatDmg",      scalingPowerKey: "dmgMult" },
  // ── buff ──────────────────────────────────────────────────────────────
  buff_atk:         { category: "buff",    label: "攻击增益",       flatPowerKey: "buffPct",      scalingPowerKey: "buffMult" },
  buff_def:         { category: "buff",    label: "防御增益",       flatPowerKey: "buffPct",      scalingPowerKey: "buffMult" },
  buff_crit:        { category: "buff",    label: "暴击增益",       flatPowerKey: "buffPct",      scalingPowerKey: "buffMult" },
  buff_crit_dmg:    { category: "buff",    label: "暴击伤害增益",   flatPowerKey: "buffPct",      scalingPowerKey: "buffMult" },
  buff_speed:       { category: "buff",    label: "速度增益",       flatPowerKey: "buffPct",      scalingPowerKey: "buffMult" },
  buff_dodge:       { category: "buff",    label: "闪避增益",       flatPowerKey: "buffPct",      scalingPowerKey: "buffMult" },
  buff_shield:      { category: "buff",    label: "护盾",           flatPowerKey: "flatShield",   scalingPowerKey: "buffMult" },
  buff_stealth:     { category: "buff",    label: "隐匿",           flatPowerKey: "specialPct",   scalingPowerKey: "specialMult" },
  buff_stat:        { category: "buff",    label: "属性增益",       flatPowerKey: "buffPct",      scalingPowerKey: "buffMult" },
  buff_ramp:        { category: "buff",    label: "叠加增益",       flatPowerKey: "buffPct",      scalingPowerKey: "buffMult" },
  // ── debuff ────────────────────────────────────────────────────────────
  debuff_def:       { category: "debuff",  label: "降低防御",       flatPowerKey: "reductionPct", scalingPowerKey: "debuffMult" },
  debuff_atk:       { category: "debuff",  label: "降低攻击",       flatPowerKey: "reductionPct", scalingPowerKey: "debuffMult" },
  debuff_speed:     { category: "debuff",  label: "降低速度",       flatPowerKey: "reductionPct", scalingPowerKey: "debuffMult" },
  debuff_heal:      { category: "debuff",  label: "降低恢复",       flatPowerKey: "reductionPct", scalingPowerKey: "debuffMult" },
  debuff_mp:        { category: "debuff",  label: "削减法力",       flatPowerKey: "reductionPct", scalingPowerKey: "debuffMult" },
  debuff_mark:      { category: "debuff",  label: "标记",           flatPowerKey: "specialPct",   scalingPowerKey: "debuffMult" },
  // ── cc ────────────────────────────────────────────────────────────────
  cc_freeze:        { category: "cc",      label: "冻结",           flatPowerKey: "ccChance",     scalingPowerKey: "ccChance",  noStatScaling: true },
  cc_stun:          { category: "cc",      label: "眩晕",           flatPowerKey: "ccChance",     scalingPowerKey: "ccChance",  noStatScaling: true },
  cc_fear:          { category: "cc",      label: "恐惧",           flatPowerKey: "ccChance",     scalingPowerKey: "ccChance",  noStatScaling: true },
  cc_root:          { category: "cc",      label: "禁锢",           flatPowerKey: "ccChance",     scalingPowerKey: "ccChance",  noStatScaling: true },
  cc_silence:       { category: "cc",      label: "沉默",           flatPowerKey: "ccChance",     scalingPowerKey: "ccChance",  noStatScaling: true },
  // ── heal ──────────────────────────────────────────────────────────────
  heal_single:      { category: "heal",    label: "单体恢复",       flatPowerKey: "flatHeal",     scalingPowerKey: "healMult" },
  heal_aoe:         { category: "heal",    label: "群体恢复",       flatPowerKey: "flatHeal",     scalingPowerKey: "healMult" },
  heal_lifesteal:   { category: "heal",    label: "生命偷取",       flatPowerKey: "specialPct",   scalingPowerKey: "healMult" },
  heal_lifesteal_pct: { category: "heal",  label: "百分比吸血",     flatPowerKey: "reductionPct", scalingPowerKey: "debuffMult" },
  // ── summon ────────────────────────────────────────────────────────────
  summon:           { category: "summon",  label: "召唤",           flatPowerKey: "flatDmg",      scalingPowerKey: "dmgMult" },
  // ── utility ───────────────────────────────────────────────────────────
  cleanse:          { category: "utility", label: "净化",           flatPowerKey: "flatHeal",     scalingPowerKey: "healMult" },
  revive:           { category: "utility", label: "复活",           flatPowerKey: "flatHeal",     scalingPowerKey: "healMult" },
  kill_bonus:       { category: "utility", label: "击杀增益",       flatPowerKey: "specialPct",   scalingPowerKey: "specialMult" },
  death_ward:       { category: "utility", label: "免死",           flatPowerKey: "specialPct",   scalingPowerKey: "specialMult" },
  sacrifice:        { category: "utility", label: "献祭",           flatPowerKey: "specialPct",   scalingPowerKey: "specialMult" },
  extra_action:     { category: "utility", label: "额外行动",       flatPowerKey: "specialPct",   scalingPowerKey: "specialMult" },
  reflect:          { category: "utility", label: "反弹",           flatPowerKey: "specialPct",   scalingPowerKey: "specialMult" },
  counter:          { category: "utility", label: "反击",           flatPowerKey: "flatDmg",      scalingPowerKey: "dmgMult" },
  damage_share:     { category: "utility", label: "伤害分摊",       flatPowerKey: "specialPct",   scalingPowerKey: "specialMult" },
  dispel:           { category: "utility", label: "驱散",           flatPowerKey: "specialPct",   scalingPowerKey: "specialMult" },
};

// ═══════════════════════════════════════════════════════════════════════════
// 数值解析 + 描述模板渲染
//
// {n} → 绝对数值（整数）
// {p} → 百分比（×100 取整）
//
// 法宝：primaryStat 不传，查 GRADE_FLAT_POWER
// 功法（damage/heal/shield）：derivedStat × scalingPower × systemMult
// 功法（buff/debuff/cc/utility）：primaryStat × scalingPower（不变）
// ═══════════════════════════════════════════════════════════════════════════

const PCT_KEYS: ReadonlySet<string> = new Set([
  "buffPct", "reductionPct", "specialPct", "ccChance",
]);

const DAMAGE_CATEGORIES: ReadonlySet<MechanicCategory> = new Set(["damage", "summon"]);

function pickScalingStat(
  mechanic: MechanicId,
  meta: MechanicMeta,
  primaryStat: number,
  system: string | undefined,
  derivedStats: DerivedStatValues | undefined,
): { statValue: number; systemMult: number; statLabel: string } {
  if (system && derivedStats) {
    const sysMult = SYSTEM_POWER_MULT[system];
    if (DAMAGE_CATEGORIES.has(meta.category)) {
      const dmgStat = SYSTEM_DAMAGE_STAT[system] ?? "strength";
      return {
        statValue: derivedStats[dmgStat],
        systemMult: sysMult?.dmg ?? 1.0,
        statLabel: dmgStat === "strength" ? "劲力" : "神识",
      };
    }
    if (meta.category === "heal") {
      return {
        statValue: derivedStats.perception,
        systemMult: sysMult?.heal ?? 1.0,
        statLabel: "神识",
      };
    }
    if (mechanic === "buff_shield") {
      return {
        statValue: derivedStats.guard,
        systemMult: sysMult?.shield ?? 1.0,
        statLabel: "护体",
      };
    }
  }
  return { statValue: primaryStat, systemMult: 1.0, statLabel: "" };
}

export function resolveMechanicRawValue(
  mechanic: MechanicId,
  grade: ItemGrade,
  primaryStat?: number,
  system?: string,
  derivedStats?: DerivedStatValues,
  baseOverride?: number,
): number {
  if (baseOverride != null) return baseOverride;
  const meta = MECHANIC_META[mechanic];
  if (primaryStat == null) {
    return GRADE_FLAT_POWER[grade][meta.flatPowerKey];
  }
  if (meta.noStatScaling) {
    return GRADE_SCALING_POWER[grade][meta.scalingPowerKey];
  }
  const { statValue, systemMult } = pickScalingStat(mechanic, meta, primaryStat, system, derivedStats);
  const scaling = GRADE_SCALING_POWER[grade][meta.scalingPowerKey];
  return statValue * scaling * systemMult;
}

function formatValue(raw: number, powerKey: string): string {
  if (PCT_KEYS.has(powerKey)) {
    return String(Math.round(raw * 100));
  }
  return String(Math.round(raw));
}

function buildFormulaSuffix(
  mechanic: MechanicId,
  meta: MechanicMeta,
  grade: ItemGrade,
  primaryStat: number | undefined,
  statName: string | undefined,
  system: string | undefined,
  derivedStats: DerivedStatValues | undefined,
): string {
  if (primaryStat == null || meta.noStatScaling) return "";
  const { systemMult, statLabel } = pickScalingStat(mechanic, meta, primaryStat, system, derivedStats);
  const displayStat = statLabel || statName;
  if (!displayStat) return "";
  const scaling = GRADE_SCALING_POWER[grade][meta.scalingPowerKey];
  const combined = scaling * systemMult;
  const multStr = `${parseFloat(combined.toFixed(2))}×`;
  return `(${multStr}${displayStat})`;
}

const SCALING_STAT_ZH: Record<string, string> = {
  strength: "劲力",
  perception: "神识",
  guard: "护体",
  resistance: "灵御",
  agility: "身法",
  physique: "体魄",
  spirit: "灵力",
  maxHp: "血量",
  maxMp: "法力",
};

export function resolveComponentDesc(
  component: EffectComponent,
  grade: ItemGrade,
  primaryStat?: number,
  statName?: string,
  system?: string,
  derivedStats?: DerivedStatValues,
  mastery?: number,
): string {
  if (!component.mechanic) return component.desc;

  const meta = MECHANIC_META[component.mechanic];
  const isPct = PCT_KEYS.has(meta.scalingPowerKey);

  let raw: number;
  let formulaStr: string | undefined;
  if (component.baseValue != null) {
    const getStat = (key: string) => {
      if (!derivedStats) return primaryStat ?? 0;
      const d = derivedStats as unknown as Record<string, number>;
      return d[key] ?? primaryStat ?? 0;
    };
    raw = calcComponentValue(component, getStat, mastery);
    const ratio = component.scalingRatio ?? 0;
    const sStat = component.scalingStat;
    if (sStat && ratio !== 0) {
      const sZh = SCALING_STAT_ZH[sStat] ?? sStat;
      const rStr = ratio === 1 ? "" : (Number.isInteger(ratio) ? String(ratio) : String(ratio));
      formulaStr = `${component.baseValue}+${rStr}×${sZh}`;
    }
  } else {
    raw = resolveMechanicRawValue(component.mechanic, grade, primaryStat, system, derivedStats);
    const masteryMult = mastery != null && mastery >= 1
      ? GONGFA_MASTERY_COMBAT_MULT[Math.min(mastery, GONGFA_MASTERY_COMBAT_MULT.length) - 1]
      : 1.0;
    raw = raw * masteryMult;
  }

  const formatted = isPct ? String(Math.round(raw * 100)) : String(Math.round(raw));
  const display = formulaStr ? `${formatted}(${formulaStr})` : formatted;

  let result = component.desc;
  if (result.includes("{n}")) {
    result = result.replace(/{n}/g, display);
  }
  if (result.includes("{p}")) {
    result = result.replace(/{p}/g, display);
  }
  return result;
}

export function resolveEffectDisplay(
  effect: { components: readonly EffectComponent[] },
  grade: ItemGrade,
  primaryStat?: number,
  statName?: string,
  system?: string,
  derivedStats?: DerivedStatValues,
  mastery?: number,
): string {
  return effect.components
    .map(c => resolveComponentDesc(c, grade, primaryStat, statName, system, derivedStats, mastery))
    .join("，");
}

/** @deprecated 使用 resolveComponentDesc / resolveEffectDisplay 代替 */
export function resolveEffectDesc(
  template: string,
  mechanic: MechanicId,
  grade: ItemGrade,
  primaryStat?: number,
): string {
  const meta = MECHANIC_META[mechanic];
  const raw = resolveMechanicRawValue(mechanic, grade, primaryStat);

  let powerKey: string;
  if (primaryStat != null) {
    powerKey = meta.scalingPowerKey;
  } else {
    powerKey = meta.flatPowerKey;
  }
  const formatted = formatValue(raw, powerKey);

  let result = template;
  if (result.includes("{n}")) {
    result = result.replace(/{n}/g, formatted);
  }
  if (result.includes("{p}")) {
    result = result.replace(/{p}/g, formatted);
  }
  return result;
}
