/**
 * 境界相关功能函数：主属性查询、修为需求、寿元、叙事年龄等。
 * 类型和常量数据表定义在 `types/playInfo.ts`。
 */

import type { PrimaryStatKey } from "./types/playInfo";
import type { GongfaItemDefinition } from "./types/itemInfo";
import {
  TABLE,
  REALM_ORDER,
  CULTIVATION_VALUES,
  SHOUYUAN_VALUES,
  MIN_NARRATIVE_AGE_BY_MAJOR,
  MAX_NARRATIVE_AGE_BY_MAJOR,
  GONGFA_MASTERY_THRESHOLDS,
  realmStageIndex,
  type RealmPrimaryStatsRow,
  type RealmMajor,
} from "./types/playInfo";

let _byKey: Record<string, RealmPrimaryStatsRow> | null = null;

function getByKey(): Record<string, RealmPrimaryStatsRow> {
  if (!_byKey) {
    _byKey = {};
    for (const row of TABLE) {
      _byKey[row.realm + "\u0001" + row.stage] = row;
    }
  }
  return _byKey;
}

function clonePrimaryStatsFromRow(row: RealmPrimaryStatsRow): Record<PrimaryStatKey, number> {
  return {
    physique: row.physique,
    spirit: row.spirit,
    strength: row.strength,
    perception: row.perception,
    guard: row.guard,
    resistance: row.resistance,
    agility: row.agility,
    insight: row.insight,
  };
}

export function getRealmPrimaryStats(realm: string, stage?: string | null): Record<PrimaryStatKey, number> | null {
  if (realm == null || realm === "" || stage == null || stage === "") return null;
  const row = getByKey()[realm + "\u0001" + stage];
  return row ? clonePrimaryStatsFromRow(row) : null;
}

export function getRow(realm: string, stage?: string | null): RealmPrimaryStatsRow | null {
  if (realm == null || realm === "" || stage == null || stage === "") return null;
  const r = getByKey()[realm + "\u0001" + stage];
  return r ? { ...r } : null;
}

export function hasRow(realm: string, stage?: string | null): boolean {
  return getRow(realm, stage) != null;
}

export function getTable(): readonly RealmPrimaryStatsRow[] {
  return TABLE;
}

export function getCultivationRequired(realm: string, stage?: string | null): number | null {
  if (realm == null || realm === "" || stage == null || stage === "") return null;
  const idx = realmStageIndex(realm, stage) - 1;
  if (idx < 0 || idx >= CULTIVATION_VALUES.length) return null;
  return CULTIVATION_VALUES[idx];
}

export function getShouyuanForRealm(realm: string, stage?: string | null): number | null {
  if (realm == null || realm === "" || stage == null || stage === "") return null;
  const idx = realmStageIndex(realm, stage) - 1;
  if (idx < 0 || idx >= SHOUYUAN_VALUES.length) return null;
  return SHOUYUAN_VALUES[idx];
}

export function getMinNarrativeAgeForMajor(major: string): number {
  let m = major != null ? String(major).trim() : "";
  if (m.endsWith("期")) m = m.slice(0, -1).trim();
  if (Object.prototype.hasOwnProperty.call(MIN_NARRATIVE_AGE_BY_MAJOR, m)) {
    return MIN_NARRATIVE_AGE_BY_MAJOR[m]!;
  }
  return MIN_NARRATIVE_AGE_BY_MAJOR.练气;
}

export function getMaxNarrativeAgeForMajor(major: string): number {
  let m = major != null ? String(major).trim() : "";
  if (m.endsWith("期")) m = m.slice(0, -1).trim();
  if (Object.prototype.hasOwnProperty.call(MAX_NARRATIVE_AGE_BY_MAJOR, m)) {
    return MAX_NARRATIVE_AGE_BY_MAJOR[m]!;
  }
  return MAX_NARRATIVE_AGE_BY_MAJOR.练气;
}

export interface CustomBirthSlice {
  background?: string;
  realmMajor?: string;
}

export interface FateChoiceSliceForAge {
  customBirth?: CustomBirthSlice;
  realm?: { major?: string };
}

export interface GameSliceForNarrativeAge {
  age?: number;
  realm?: { major?: string };
  fateChoice?: FateChoiceSliceForAge;
}

export function customBirthBackgroundImpliesAgeException(
  fc: FateChoiceSliceForAge | null | undefined,
): boolean {
  try {
    const cb = fc?.customBirth;
    if (!cb || typeof cb.background !== "string") return false;
    return /灌(?:\u9876|\u9802)|催熟|夺舍|透支/.test(cb.background);
  } catch {
    return false;
  }
}

export function resolveEffectiveMajorForNarrativeAge(
  fc: FateChoiceSliceForAge | null | undefined,
  G: GameSliceForNarrativeAge | null | undefined,
): string {
  const r = (G && G.realm) || (fc && fc.realm) || {};
  const majFromRealm = r.major != null ? String(r.major).trim() : "";
  const majFromCB =
    fc?.customBirth?.realmMajor != null ? String(fc.customBirth.realmMajor).trim() : "";

  function rank(mm: string): number {
    if (!mm) return -1;
    const idx = REALM_ORDER.indexOf(mm as RealmMajor);
    return idx >= 0 ? idx : -1;
  }
  const a = rank(majFromRealm);
  const b = rank(majFromCB);
  if (b > a && majFromCB) return majFromCB;
  if (majFromRealm) return majFromRealm;
  return majFromCB || "练气";
}

export function getProtagonistNarrativeAge(
  G: GameSliceForNarrativeAge | null | undefined,
  fc?: FateChoiceSliceForAge | null,
  options?: { defaultAge?: number },
): number {
  const g = G && typeof G === "object" ? G : {};
  const fc0 = fc != null ? fc : g.fateChoice;
  let defAge = 16;
  if (typeof options?.defaultAge === "number" && isFinite(options.defaultAge)) {
    defAge = Math.max(0, Math.floor(options.defaultAge));
  }
  const base =
    typeof g.age === "number" && isFinite(g.age) ? Math.max(0, Math.floor(g.age)) : defAge;
  if (customBirthBackgroundImpliesAgeException(fc0)) return base;
  const maj = resolveEffectiveMajorForNarrativeAge(fc0, g);
  const floor = getMinNarrativeAgeForMajor(maj);
  return Math.max(base, floor);
}

export function getGongfaMasteryThreshold(masteryLevel: number): number {
  if (masteryLevel < 1 || masteryLevel >= 10) return Infinity;
  return GONGFA_MASTERY_THRESHOLDS[masteryLevel - 1];
}

export function addGongfaMasteryExp(
  gongfa: GongfaItemDefinition,
  expIncrease: number,
): { leveledUp: boolean; newMastery: number } {
  if (expIncrease <= 0) return { leveledUp: false, newMastery: gongfa.mastery ?? 1 };

  let mastery = gongfa.mastery ?? 1;
  let exp = gongfa.masteryExp ?? 0;

  if (mastery >= 10) {
    gongfa.masteryExp = exp;
    return { leveledUp: false, newMastery: 10 };
  }

  exp += expIncrease;
  let leveledUp = false;

  while (mastery < 10) {
    const threshold = getGongfaMasteryThreshold(mastery);
    if (exp < threshold) break;
    exp -= threshold;
    mastery++;
    leveledUp = true;
  }

  if (mastery >= 10) {
    mastery = 10;
    exp = 0;
  }

  gongfa.mastery = mastery;
  gongfa.masteryExp = exp;

  return { leveledUp, newMastery: mastery };
}
