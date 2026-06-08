/**
 * 功法：物品定义 + 特殊效果（名称 + 效果组件 + 类型）。
 * 功法的 function 由系统根据体系（system）和品阶从效果目录中随机分配，不由 AI 生成。
 * 体系由 AI 输出，代码校验后用于效果池选取。
 */

import type { ItemBonusMap, ItemGrade } from "./itemInfo";
import type { EffectComponent } from "./combatMechanics";
import { GONGFA_MP_COST_BY_GRADE } from "./gameConstants";

// ═══════════════════════════════════════════════════════════════════════════
// 功法体系
// ═══════════════════════════════════════════════════════════════════════════

export const GONGFA_SYSTEM_KEYS = [
  "体修",
  "法修",
] as const;
export type GongfaSystem = (typeof GONGFA_SYSTEM_KEYS)[number];


// ═══════════════════════════════════════════════════════════════════════════
// 特殊效果
// ═══════════════════════════════════════════════════════════════════════════

export type GongfaEffectType = "主动" | "被动";

export type GongfaRole = "攻击" | "辅助";

export interface GongfaSpecialEffect {
  name: string;
  components: readonly EffectComponent[];
  type: GongfaEffectType;
  mpCost: number;
  cooldown: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 效果目录（按体系 × 品阶，每品阶5个效果：3主动 + 2被动）
// ═══════════════════════════════════════════════════════════════════════════

const GRADE_ORDER: readonly ItemGrade[] = ["下品", "中品", "上品", "极品", "仙品", "神品"];

const GRADE_EFFECT_ROLL_WEIGHTS: Readonly<Record<ItemGrade, readonly number[]>> = {
  "下品": [100],
  "中品": [75, 25],
  "上品": [50, 30, 20],
  "极品": [40, 30, 18, 12],
  "仙品": [35, 26, 18, 12, 9],
  "神品": [30, 24, 18, 13, 9, 6],
};

export const GONGFA_EFFECT_CATALOG: Readonly<Record<GongfaSystem, Readonly<Record<ItemGrade, readonly GongfaSpecialEffect[]>>>> = {

  "体修": {
    "下品": [
      { name: "震脉击", mpCost: 3, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 50, scalingRatio: 2.94, scalingStat: "strength" }], type: "主动" },
    ],
    "中品": [
      { name: "霸体冲撞", mpCost: 6, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 100, scalingRatio: 1.33, scalingStat: "strength" }], type: "主动" },
    ],
    "上品": [
      { name: "山岳投", mpCost: 12, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 260, scalingRatio: 1.3, scalingStat: "strength" }], type: "主动" },
    ],
    "极品": [
      { name: "涅槃击", mpCost: 24, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 560, scalingRatio: 0.88, scalingStat: "strength" }], type: "主动" },
    ],
    "仙品": [
      { name: "金身怒目", mpCost: 50, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 800, scalingRatio: 0.64, scalingStat: "strength" }], type: "主动" },
    ],
    "神品": [
      { name: "涅槃重生击", mpCost: 100, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 1600, scalingRatio: 1.07, scalingStat: "strength" }], type: "主动" },
    ],
  },

  "法修": {
    "下品": [
      { name: "法弹术", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 50, scalingRatio: 2.94, scalingStat: "perception" }], type: "主动" },
    ],
    "中品": [
      { name: "灵海冲击", mpCost: 30, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 130, scalingRatio: 1.73, scalingStat: "perception" }], type: "主动" },
    ],
    "上品": [
      { name: "灵元爆发", mpCost: 60, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 260, scalingRatio: 1.3, scalingStat: "perception" }], type: "主动" },
    ],
    "极品": [
      { name: "太虚法印", mpCost: 120, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 400, scalingRatio: 0.63, scalingStat: "perception" }], type: "主动" },
    ],
    "仙品": [
      { name: "神机法", mpCost: 250, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 800, scalingRatio: 0.64, scalingStat: "perception" }], type: "主动" },
    ],
    "神品": [
      { name: "万法之源", mpCost: 500, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 1600, scalingRatio: 1.07, scalingStat: "perception" }], type: "主动" },
    ],
  },

};

// ═══════════════════════════════════════════════════════════════════════════
// 体系校验
// ═══════════════════════════════════════════════════════════════════════════

export function normalizeGongfaSystem(raw: unknown): GongfaSystem {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if ((GONGFA_SYSTEM_KEYS as readonly string[]).includes(trimmed)) {
      return trimmed as GongfaSystem;
    }
  }
  return GONGFA_SYSTEM_KEYS[Math.floor(Math.random() * GONGFA_SYSTEM_KEYS.length)];
}

// ═══════════════════════════════════════════════════════════════════════════
// 角色定位校验
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_TO_EFFECT_TYPE: Record<GongfaRole, GongfaEffectType> = {
  "攻击": "主动",
  "辅助": "被动",
};

export function normalizeGongfaRole(raw: unknown): GongfaRole | undefined {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "攻击" || trimmed === "辅助") return trimmed;
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// 法力消耗计算
// ═══════════════════════════════════════════════════════════════════════════

const TI_XIU_MP_COST_RATIO = 0.2;

export function calcGongfaMpCost(
  effect: { type: GongfaEffectType; components: readonly EffectComponent[] },
  system: GongfaSystem,
  grade: ItemGrade,
): number {
  if (effect.type === "被动") return 0;

  if (effect.components.some(c => c.mechanic === "sacrifice")) return 0;

  const gradeIdx = GRADE_ORDER.indexOf(grade);
  const base = GONGFA_MP_COST_BY_GRADE[Math.max(0, Math.min(gradeIdx, GONGFA_MP_COST_BY_GRADE.length - 1))];

  if (system === "体修") return Math.round(base * TI_XIU_MP_COST_RATIO);

  return base;
}

function pickFromPool(pool: readonly GongfaSpecialEffect[]): GongfaSpecialEffect {
  return { ...pool[Math.floor(Math.random() * pool.length)] };
}

function withMpCost(effect: GongfaSpecialEffect, system: GongfaSystem, grade: ItemGrade): GongfaSpecialEffect {
  if (effect.mpCost == null) {
    effect.mpCost = calcGongfaMpCost(effect, system, grade);
  }
  if (effect.cooldown == null) {
    effect.cooldown = 0;
  }
  return effect;
}

function filterPool(pool: readonly GongfaSpecialEffect[], effectType?: GongfaEffectType): readonly GongfaSpecialEffect[] {
  if (!effectType) return pool;
  const filtered = pool.filter(e => e.type === effectType);
  return filtered.length > 0 ? filtered : pool;
}

export function rollGongfaFunction(system: GongfaSystem, grade: ItemGrade, role?: GongfaRole): GongfaSpecialEffect {
  const systemCatalog = GONGFA_EFFECT_CATALOG[system];
  const gradeIdx = GRADE_ORDER.indexOf(grade);
  const effectType = role ? ROLE_TO_EFFECT_TYPE[role] : undefined;
  const weights = GRADE_EFFECT_ROLL_WEIGHTS[grade];

  const candidates: { pool: readonly GongfaSpecialEffect[]; weight: number }[] = [];
  for (let i = 0; i < weights.length; i++) {
    const sourceIdx = gradeIdx - i;
    if (sourceIdx < 0) break;
    const pool = filterPool(systemCatalog[GRADE_ORDER[sourceIdx]], effectType);
    if (pool.length > 0) {
      candidates.push({ pool, weight: weights[i] });
    }
  }

  if (candidates.length > 0) {
    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) return withMpCost(pickFromPool(c.pool), system, grade);
    }
    return withMpCost(pickFromPool(candidates[candidates.length - 1].pool), system, grade);
  }

  for (const sys of Object.values(GONGFA_EFFECT_CATALOG)) {
    for (const g of GRADE_ORDER) {
      const fallbackPool = filterPool(sys[g], effectType);
      if (fallbackPool.length > 0) return withMpCost(pickFromPool(fallbackPool), system, grade);
    }
  }

  for (const sys of Object.values(GONGFA_EFFECT_CATALOG)) {
    for (const g of GRADE_ORDER) {
      if (sys[g].length > 0) return withMpCost(pickFromPool(sys[g]), system, grade);
    }
  }

  return withMpCost({ name: "默认", mpCost: 500, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点伤害" }], type: "主动" }, system, grade);
}

// ═══════════════════════════════════════════════════════════════════════════
// 物品定义
// ═══════════════════════════════════════════════════════════════════════════

export interface GongfaItemDefinition {
  itemType: "功法";
  name: string;
  desc: string;
  grade: ItemGrade;
  count: number;
  bonus: ItemBonusMap;
  system?: GongfaSystem;
  role?: GongfaRole;
  function?: GongfaSpecialEffect;
  mastery?: number;
  masteryExp?: number;
}
