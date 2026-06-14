import type { ItemGrade } from "./itemInfo";

// ═══════════════════════════════════════════════════════════════════════════
// 法宝特殊效果 — 百分比属性加成，直接映射战斗引擎 ModifierType
// ═══════════════════════════════════════════════════════════════════════════

export type TreasureModifierType =
  | "damageDealt"
  | "damageTaken"
  | "healReceived"
  | "mpRecover"
  | "speed"
  | "critRate"
  | "critDmg"
  | "dodgeRate";

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
  healReceived: "血量恢复",
  mpRecover: "法力恢复",
  speed: "速度",
  critRate: "暴击",
  critDmg: "暴伤",
  dodgeRate: "闪避",
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
  healReceived: { "下品": [1, 2],  "中品": [2, 3],   "上品": [3, 4],   "极品": [4, 6],   "仙品": [6, 8],   "神品": [8, 10] },
  mpRecover:    { "下品": [1, 2],  "中品": [2, 3],   "上品": [3, 4],   "极品": [4, 6],   "仙品": [6, 8],   "神品": [8, 10] },
  speed:        { "下品": [2, 4],  "中品": [3, 6],   "上品": [5, 9],   "极品": [7, 13],  "仙品": [10, 18], "神品": [15, 25] },
  critRate:     { "下品": [2, 4],  "中品": [3, 6],   "上品": [5, 9],   "极品": [8, 15],  "仙品": [12, 20], "神品": [15, 25] },
  critDmg:      { "下品": [4, 8],  "中品": [6, 12],  "上品": [10, 18], "极品": [15, 28], "仙品": [22, 38], "神品": [30, 50] },
  dodgeRate:    { "下品": [1, 3],  "中品": [2, 4],   "上品": [3, 6],   "极品": [5, 9],   "仙品": [6, 12],  "神品": [8, 15] },
};

// ═══════════════════════════════════════════════════════════════════════════
// 随机分配
// ═══════════════════════════════════════════════════════════════════════════

const MODIFIER_POOL: readonly TreasureModifierType[] = [
  "damageDealt", "damageTaken", "healReceived", "mpRecover",
  "speed", "critRate", "critDmg", "dodgeRate",
];

export function rollTreasureFunction(grade: ItemGrade): TreasureSpecialEffect {
  const count = GRADE_MODIFIER_COUNT[grade];
  const modifiers: TreasureModifier[] = [];

  for (let i = 0; i < count; i++) {
    const type = MODIFIER_POOL[Math.floor(Math.random() * MODIFIER_POOL.length)];
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
