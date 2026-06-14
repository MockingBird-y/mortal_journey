import type { ItemGrade } from "./itemInfo";

// ═══════════════════════════════════════════════════════════════════════════
// 法宝特殊效果 — 百分比属性加成，直接映射战斗引擎 ModifierType
// ═══════════════════════════════════════════════════════════════════════════

export type TreasureModifierType =
  | "damageDealt"
  | "damageTaken"
  | "hpRecover"
  | "mpRecover"
  | "speed"
  | "critRate"
  | "critDmg"
  | "dodgeRate"
  | "lifesteal"
  | "defensePenetration"
  | "physDamageDealt"
  | "magDamageDealt"
  | "physDamageTaken"
  | "magDamageTaken"
  | "physDefensePenetration"
  | "magDefensePenetration";

export interface TreasureModifier {
  modifierType: TreasureModifierType;
  value: number;
}

export interface TreasureSpecialEffect {
  name: string;
  modifiers: readonly TreasureModifier[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 展示名称
// ═══════════════════════════════════════════════════════════════════════════

export const TREASURE_MODIFIER_NAMES: Readonly<Record<TreasureModifierType, string>> = {
  damageDealt: "增伤",
  damageTaken: "减伤",
  hpRecover: "血量恢复",
  mpRecover: "法力恢复",
  speed: "速度",
  critRate: "暴击",
  critDmg: "暴伤",
  dodgeRate: "闪避",
  lifesteal: "吸血",
  defensePenetration: "穿透",
  physDamageDealt: "物理增伤",
  magDamageDealt: "法术增伤",
  physDamageTaken: "物理减伤",
  magDamageTaken: "法术减伤",
  physDefensePenetration: "破甲",
  magDefensePenetration: "破法",
};

// ═══════════════════════════════════════════════════════════════════════════
// 品阶效果数量
// ═══════════════════════════════════════════════════════════════════════════

const GRADE_MODIFIER_COUNT: Readonly<Record<ItemGrade, number>> = {
  "下品": 1,
  "中品": 2,
  "上品": 2,
  "极品": 3,
  "仙品": 3,
  "神品": 4,
};

// ═══════════════════════════════════════════════════════════════════════════
// 每个类型 × 每个品阶的 [min%, max%] 范围
// ═══════════════════════════════════════════════════════════════════════════

const MODIFIER_VALUE_RANGES: Readonly<Record<TreasureModifierType, Readonly<Record<ItemGrade, readonly [number, number]>>>> = {
  damageDealt:  { "下品": [2, 4],  "中品": [3, 6],   "上品": [5, 9],   "极品": [7, 13],  "仙品": [10, 16], "神品": [12, 20] },
  damageTaken:  { "下品": [1, 2],  "中品": [1, 3],   "上品": [2, 4],   "极品": [3, 6],   "仙品": [5, 8],   "神品": [6, 10] },
  hpRecover:   { "下品": [1, 2],  "中品": [2, 3],   "上品": [3, 4],   "极品": [4, 6],   "仙品": [6, 8],   "神品": [8, 10] },
  mpRecover:    { "下品": [1, 2],  "中品": [2, 3],   "上品": [3, 4],   "极品": [4, 6],   "仙品": [6, 8],   "神品": [8, 10] },
  speed:        { "下品": [2, 4],  "中品": [3, 6],   "上品": [5, 9],   "极品": [7, 13],  "仙品": [10, 18], "神品": [15, 25] },
  critRate:     { "下品": [2, 4],  "中品": [3, 6],   "上品": [5, 9],   "极品": [8, 15],  "仙品": [12, 20], "神品": [15, 25] },
  critDmg:      { "下品": [4, 8],  "中品": [6, 12],  "上品": [10, 18], "极品": [15, 28], "仙品": [22, 38], "神品": [30, 50] },
  dodgeRate:    { "下品": [1, 3],  "中品": [2, 4],   "上品": [3, 6],   "极品": [5, 9],   "仙品": [6, 12],  "神品": [8, 15] },
  lifesteal:          { "下品": [1, 2],  "中品": [2, 3],   "上品": [3, 4],   "极品": [4, 6],   "仙品": [5, 7],   "神品": [6, 8] },
  defensePenetration: { "下品": [2, 4],  "中品": [3, 6],   "上品": [5, 9],   "极品": [7, 13],  "仙品": [10, 16], "神品": [12, 20] },
  physDamageDealt:          { "下品": [3, 6],  "中品": [5, 9],   "上品": [7, 13],  "极品": [11, 19], "仙品": [15, 24], "神品": [18, 30] },
  magDamageDealt:           { "下品": [3, 6],  "中品": [5, 9],   "上品": [7, 13],  "极品": [11, 19], "仙品": [15, 24], "神品": [18, 30] },
  physDamageTaken:          { "下品": [2, 3],  "中品": [2, 4],   "上品": [3, 6],   "极品": [5, 9],   "仙品": [7, 12],  "神品": [9, 15] },
  magDamageTaken:           { "下品": [2, 3],  "中品": [2, 4],   "上品": [3, 6],   "极品": [5, 9],   "仙品": [7, 12],  "神品": [9, 15] },
  physDefensePenetration:   { "下品": [3, 6],  "中品": [5, 9],   "上品": [7, 13],  "极品": [11, 19], "仙品": [15, 24], "神品": [18, 30] },
  magDefensePenetration:    { "下品": [3, 6],  "中品": [5, 9],   "上品": [7, 13],  "极品": [11, 19], "仙品": [15, 24], "神品": [18, 30] },
};

// ═══════════════════════════════════════════════════════════════════════════
// 加权随机池（通用属性高权重，专用属性低权重）
// ═══════════════════════════════════════════════════════════════════════════

const MODIFIER_WEIGHTS: Readonly<Record<TreasureModifierType, number>> = {
  damageDealt: 3, damageTaken: 3, hpRecover: 2, mpRecover: 2,
  speed: 2, critRate: 2, critDmg: 2, dodgeRate: 2,
  lifesteal: 1, defensePenetration: 1,
  physDamageDealt: 1, magDamageDealt: 1,
  physDamageTaken: 1, magDamageTaken: 1,
  physDefensePenetration: 1, magDefensePenetration: 1,
};

const WEIGHTED_POOL: readonly TreasureModifierType[] = (() => {
  const pool: TreasureModifierType[] = [];
  for (const [type, weight] of Object.entries(MODIFIER_WEIGHTS) as [TreasureModifierType, number][]) {
    for (let i = 0; i < weight; i++) pool.push(type);
  }
  return pool;
})();

export function rollTreasureFunction(grade: ItemGrade): TreasureSpecialEffect {
  const count = GRADE_MODIFIER_COUNT[grade];
  const modifiers: TreasureModifier[] = [];
  const usedTypes = new Set<TreasureModifierType>();

  for (let i = 0; i < count; i++) {
    let type: TreasureModifierType;
    let attempts = 0;
    do {
      type = WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];
      attempts++;
    } while (usedTypes.has(type) && attempts < 20);
    usedTypes.add(type);

    const [lo, hi] = MODIFIER_VALUE_RANGES[type][grade];
    const value = lo + Math.floor(Math.random() * (hi - lo + 1));
    modifiers.push({ modifierType: type, value });
  }

  const name = modifiers
    .map(m => `${TREASURE_MODIFIER_NAMES[m.modifierType]}+${m.value}%`)
    .join(" ");

  return { name, modifiers };
}

// ═══════════════════════════════════════════════════════════════════════════
// 物品定义
// ═══════════════════════════════════════════════════════════════════════════

export interface TreasureItemDefinition {
  itemType: "法宝";
  name: string;
  desc: string;
  grade: ItemGrade;
  count: number;
  function?: TreasureSpecialEffect;
}
