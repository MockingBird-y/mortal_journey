import type { DamageType } from "./types";

export const DEFENSE_FACTOR = 500;
export const PENETRATION_FACTOR = 500;

export function penetrationToPercent(penRating: number): number {
  if (penRating <= 0) return 0;
  return penRating / (penRating + PENETRATION_FACTOR);
}

export function defenseToReduction(defense: number): number {
  if (defense <= 0) return 0;
  return defense / (defense + DEFENSE_FACTOR);
}

export function calcEffectiveDefense(defense: number, penRating: number): number {
  const penPct = penetrationToPercent(penRating);
  return Math.max(0, defense * (1 - penPct));
}

export function calcFinalDamage(
  rawDamage: number,
  defense: number,
  penRating: number,
  damageType: DamageType,
): number {
  if (damageType === "true") return Math.max(1, Math.round(rawDamage));
  const effDef = calcEffectiveDefense(defense, penRating);
  const reduction = defenseToReduction(effDef);
  return Math.max(1, Math.round(rawDamage * (1 - reduction)));
}

export function calcRawDamage(stat: number, multiplier: number = 1): number {
  return Math.max(1, Math.round(stat * multiplier));
}

export function calcDodgeRate(agility: number): number {
  return Math.min(80, agility * 0.3);
}

export function checkHit(hitRate: number, dodgeRate: number): boolean {
  return Math.random() * 100 < hitRate - dodgeRate;
}

export function checkCrit(critRate: number): boolean {
  return Math.random() * 100 < critRate;
}

export function calcCritDamage(baseDamage: number, critDmg: number): number {
  return Math.round(baseDamage * critDmg / 100);
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
