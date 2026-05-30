import {
  ELIXIR_GRADE_EFFECT_TABLE,
  ELIXIR_PERCENT_GRADE_THRESHOLD,
  GRADE_INDEX,
} from "./gameConstants";

export type ElixirEffectType =
  | "恢复血量" | "恢复法力"
  | "提升修为" | "提升寿元"
  | "提升体魄" | "提升灵力" | "提升劲力" | "提升护体" | "提升神识"
  | "提升身法" | "提升悟性" | "提升气运";

export const VALID_ELIXIR_EFFECT_TYPES: readonly ElixirEffectType[] = [
  "恢复血量", "恢复法力",
  "提升修为", "提升寿元",
  "提升体魄", "提升灵力", "提升劲力", "提升护体", "提升神识",
  "提升身法", "提升悟性", "提升气运",
];

export interface ElixirEffects {
  value: number;
  isPercent: boolean;
}

export function rollElixirValue(effectType: ElixirEffectType, grade: string): number {
  const arr = ELIXIR_GRADE_EFFECT_TABLE[effectType];
  if (!arr) return 1;
  const gradeIdx = GRADE_INDEX[grade] ?? 0;
  const [lo, hi] = arr[Math.min(gradeIdx, arr.length - 1)];
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function isElixirPercent(effectType: ElixirEffectType, grade: string): boolean {
  if (effectType !== "恢复血量" && effectType !== "恢复法力" && effectType !== "提升修为") return false;
  const gradeIdx = GRADE_INDEX[grade] ?? 0;
  return gradeIdx >= ELIXIR_PERCENT_GRADE_THRESHOLD;
}

export function parseElixirEffectType(raw: unknown): ElixirEffectType {
  if (typeof raw !== "string") return "恢复血量";
  const trimmed = raw.trim();
  if ((VALID_ELIXIR_EFFECT_TYPES as readonly string[]).includes(trimmed)) return trimmed as ElixirEffectType;
  return "恢复血量";
}

const ELIXIR_EFFECT_TO_STAT_KEY: Readonly<Record<string, string>> = {
  "提升体魄": "physique",
  "提升灵力": "spirit",
  "提升劲力": "strength",
  "提升神识": "perception",
  "提升护体": "guard",
  "提升身法": "agility",
  "提升悟性": "insight",
  "提升气运": "fortune",
};

export function elixirEffectToStatKey(effectType: ElixirEffectType): string | null {
  return ELIXIR_EFFECT_TO_STAT_KEY[effectType] ?? null;
}

export interface ElixirItemDefinition {
  itemType: "丹药";
  name: string;
  desc: string;
  grade: import("./itemInfo").ItemGrade;
  count: number;
  effectType: ElixirEffectType;
  effects: ElixirEffects;
}
