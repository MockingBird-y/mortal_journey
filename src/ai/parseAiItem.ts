import {
  TREASURE_BONUS_COUNT_BY_GRADE,
  rollGradeAttriValue,
  TREASURE_GRADE_ATTRI_TABLE,
  GONGFA_GRADE_ATTRI_TABLE,
} from "../role_core/types/playInfo";
import type { InventoryStackItem } from "../role_core/types/playInfo";
import {
  createSpiritStoneInventoryStack,
} from "../role_core/types/spiritStone";
import type {
  GongfaItemDefinition,
  ItemGrade,
  TreasureItemDefinition,
  MaterialItemDefinition,
  MiscItemDefinition,
  CategorizedItemDefinition,
  GradeDropRate,
} from "../role_core/types/itemInfo";
import { GRADE_DROP_TABLE } from "../role_core/types/itemInfo";
import {
  TREASURE_TRIGGER_KEYS,
  GONGFA_TRIGGER_KEYS,
  TREASURE_EFFECT_KEYS,
  GONGFA_EFFECT_KEYS,
  TREASURE_COST_KEYS,
  GONGFA_COST_KEYS,
  type SpecialEffect,
  type EffectValueCategory,
  type SpecialEffectTarget,
  applyTypedFunctionOverrides,
  computeEffectValue,
  computeCostValue,
  lookupEffectCategory,
  firstEffectKeyOfCategoryAcrossTypes,
  ITEM_TYPE_ALLOWED_EFFECTS,
  treasureEffectKeyToCategory,
  gongfaEffectKeyToCategory,
} from "../role_core/types/special_effects";
import {
  parseElixirEffectType,
  rollElixirValue,
  isElixirPercent,
  type ElixirEffectType,
} from "../role_core/types/elixir";

export const VALID_BONUS_NAMES: ReadonlySet<string> = new Set(Object.keys(GONGFA_GRADE_ATTRI_TABLE));

export const VALID_DERIVED_BONUS_NAMES = Object.keys(TREASURE_GRADE_ATTRI_TABLE);
export const VALID_DERIVED_BONUS_NAMES_ARR: readonly string[] = VALID_DERIVED_BONUS_NAMES;

export function parseBonusField(raw: unknown, grade: string): Record<string, number> {
  if (typeof raw !== "string") return {};
  const name = raw.trim();
  if (!VALID_BONUS_NAMES.has(name)) return {};
  return { [name]: rollGradeAttriValue(name, grade, GONGFA_GRADE_ATTRI_TABLE) };
}

export function parseTreasureBonusField(raw: unknown, grade: string): Record<string, number> {
  const totalCount = TREASURE_BONUS_COUNT_BY_GRADE[grade] ?? 1;
  const names: string[] = [];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (VALID_DERIVED_BONUS_NAMES.includes(trimmed)) names.push(trimmed);
  }
  while (names.length < totalCount) {
    names.push(VALID_DERIVED_BONUS_NAMES_ARR[Math.floor(Math.random() * VALID_DERIVED_BONUS_NAMES_ARR.length)]);
  }
  const result: Record<string, number> = {};
  for (const name of names) {
    const v = rollGradeAttriValue(name, grade, TREASURE_GRADE_ATTRI_TABLE);
    result[name] = (result[name] ?? 0) + v;
  }
  return result;
}

export function extractTagContent(raw: string, openTag: string, closeTag: string): string {
  const i = raw.indexOf(openTag);
  if (i < 0) return "";
  const from = i + openTag.length;
  const j = raw.indexOf(closeTag, from);
  if (j < 0) return raw.slice(from).trim();
  return raw.slice(from, j).trim();
}

export function sanitizeJsonLike(text: string): string {
  let s = text;
  s = s.replace(/\{"([^"]*)"\s*(?:,\s*"[^"]*")*\}/g, (m) => {
    const items: string[] = [];
    const re = /"([^"]*)"/g;
    let r: RegExpExecArray | null;
    while ((r = re.exec(m)) !== null) items.push('"' + r[1] + '"');
    return "[" + items.join(",") + "]";
  });
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

export function tryParseJsonArray(text: string): unknown[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const tryParse = (src: string): unknown[] | null => {
    try {
      const parsed = JSON.parse(src);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  };
  let result = tryParse(trimmed);
  if (result) return result;
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) {
    const segment = trimmed.slice(start, end + 1);
    result = tryParse(segment);
    if (result) return result;
    result = tryParse(sanitizeJsonLike(segment));
    if (result) return result;
  }
  result = tryParse(sanitizeJsonLike(trimmed));
  if (result) return result;
  return null;
}

export function safeStr(val: unknown, fallback: string): string {
  return typeof val === "string" && val.trim() ? val.trim() : fallback;
}

export const GRADE_KEYS: readonly (keyof GradeDropRate)[] = ["下品", "中品", "上品", "极品", "仙品", "神品"];

export function rollGrade(realmMajor: string, realmMinor: string): ItemGrade {
  const stage = GRADE_DROP_TABLE[realmMajor]?.[realmMinor];
  if (!stage) return "下品";
  const total = stage.下品 + stage.中品 + stage.上品 + stage.极品 + stage.仙品 + stage.神品;
  if (total <= 0) return "下品";
  let roll = Math.random() * total;
  for (const key of GRADE_KEYS) {
    roll -= stage[key];
    if (roll <= 0) return key;
  }
  return "下品";
}

export function safeCount(val: unknown): number {
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
}

export const TREASURE_TRIGGER_FALLBACK = "on_hit_taken";
export const GONGFA_TRIGGER_FALLBACK = "on_attack";

export function effectKeysForType(itemType: string): readonly string[] {
  switch (itemType) {
    case "法宝": return TREASURE_EFFECT_KEYS;
    case "功法": return GONGFA_EFFECT_KEYS;
    default: return [];
  }
}

export function costKeysForType(itemType: string): readonly string[] {
  switch (itemType) {
    case "法宝": return TREASURE_COST_KEYS;
    case "功法": return GONGFA_COST_KEYS;
    default: return [];
  }
}

export function effectKeyToCategoryForType(effectLabel: string, itemType: string): EffectValueCategory {
  switch (itemType) {
    case "法宝": return treasureEffectKeyToCategory(effectLabel as typeof TREASURE_EFFECT_KEYS[number]);
    case "功法": return gongfaEffectKeyToCategory(effectLabel as typeof GONGFA_EFFECT_KEYS[number]);
    default: return lookupEffectCategory(effectLabel);
  }
}

export function triggerKeysForType(itemType: string): readonly string[] {
  switch (itemType) {
    case "法宝": return TREASURE_TRIGGER_KEYS;
    case "功法": return GONGFA_TRIGGER_KEYS;
    default: return [];
  }
}

export function validateAiFunction(raw: unknown, grade: string, itemType: string): SpecialEffect | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const allTriggers = [
    ...TREASURE_TRIGGER_KEYS, ...GONGFA_TRIGGER_KEYS,
  ];
  let trigger = obj.trigger;
  if (typeof trigger !== "string") return null;

  const validTriggers = triggerKeysForType(itemType);
  if (validTriggers.length > 0 && !validTriggers.includes(trigger)) {
    if (itemType === "法宝") trigger = TREASURE_TRIGGER_FALLBACK;
    else if (itemType === "功法") trigger = GONGFA_TRIGGER_FALLBACK;
    else return null;
  } else if (validTriggers.length === 0 && !(allTriggers as readonly string[]).includes(trigger)) {
    trigger = "on_attack";
  }

  const allowedEffectKeys = effectKeysForType(itemType);
  let effectLabel: string | null = null;
  const eff = obj.effect;
  if (typeof eff === "string") {
    if (!allowedEffectKeys.includes(eff)) return null;
    effectLabel = eff;
  } else if (eff && typeof eff === "object") {
    const effObj = eff as Record<string, unknown>;
    const label = effObj.label;
    if (typeof label !== "string" || !allowedEffectKeys.includes(label)) return null;
    effectLabel = label;
  } else {
    return null;
  }

  const category = effectKeyToCategoryForType(effectLabel, itemType);
  const allowedEffects = ITEM_TYPE_ALLOWED_EFFECTS[itemType as SpecialEffectTarget];
  if (allowedEffects && !allowedEffects.has(category)) {
    const fallbackCat = Array.from(allowedEffects)[0];
    effectLabel = firstEffectKeyOfCategoryAcrossTypes(fallbackCat);
  }

  const dur = obj.duration;
  if (typeof dur !== "number" || !Number.isFinite(dur) || dur < 0) return null;

  const allowedCostKeys = costKeysForType(itemType);
  let costResource: string | null = null;
  const cst = obj.cost;
  if (typeof cst === "string") {
    if (!allowedCostKeys.includes(cst)) return null;
    costResource = cst;
  } else if (cst && typeof cst === "object") {
    const cstObj = cst as Record<string, unknown>;
    const resource = cstObj.resource;
    if (typeof resource !== "string" || !allowedCostKeys.includes(resource)) return null;
    costResource = resource;
  } else {
    return null;
  }

  const finalCategory = effectKeyToCategoryForType(effectLabel, itemType);
  const effectValue = computeEffectValue(finalCategory, grade, trigger as string, Math.max(0, Math.floor(dur)), costResource);
  const costValue = computeCostValue(costResource, grade);

  return {
    trigger: trigger as never,
    effect: { label: effectLabel as never, value: effectValue },
    duration: Math.max(0, Math.floor(dur)),
    cost: { resource: costResource as never, value: costValue },
  };
}

export const TYPE_TO_ITEM_TYPE: Record<string, CategorizedItemDefinition["itemType"]> = {
  "法宝": "法宝",
  "功法": "功法",
  "丹药": "丹药",
  "材料": "材料",
  "杂物": "杂物",
};

export function parseEquipObject(e: unknown, realmMajor: string, realmMinor: string): TreasureItemDefinition {
  const obj = e as Record<string, unknown>;
  const grade = rollGrade(realmMajor, realmMinor);
  return {
    itemType: "法宝",
    name: safeStr(obj.name, "未命名法宝"),
    desc: safeStr(obj.intro, ""),
    grade,
    count: 1,
    bonus: parseTreasureBonusField(obj.bonus, grade),
    function: applyTypedFunctionOverrides(validateAiFunction(obj.function, grade, "法宝") ?? undefined, "法宝"),
  };
}

export function parseGongfaObject(e: unknown, realmMajor: string, realmMinor: string, _playerLinggen?: readonly string[] | null): GongfaItemDefinition {
  const obj = e as Record<string, unknown>;
  const grade = rollGrade(realmMajor, realmMinor);
  return {
    itemType: "功法",
    name: safeStr(obj.name, "未命名功法"),
    desc: safeStr(obj.intro, ""),
    grade,
    count: 1,
    bonus: parseBonusField(obj.bonus, grade),
    function: applyTypedFunctionOverrides(validateAiFunction(obj.function, grade, "功法") ?? undefined, "功法"),
  };
}

export function parseStorageObject(e: unknown, realmMajor: string, realmMinor: string, _playerLinggen?: readonly string[] | null): InventoryStackItem | null {
  const obj = e as Record<string, unknown>;
  const typeStr = safeStr(obj.type, "杂物");

  if (typeStr === "灵石") {
    const count = safeCount(obj.count);
    if (count <= 0) return null;
    return createSpiritStoneInventoryStack(count);
  }

  const name = safeStr(obj.name, "未命名物品");
  const desc = safeStr(obj.intro, "");
  const grade = rollGrade(realmMajor, realmMinor);
  const count = safeCount(obj.count);
  const itemType = TYPE_TO_ITEM_TYPE[typeStr] ?? "杂物";
  if (itemType === "功法") {
    const fn = applyTypedFunctionOverrides(validateAiFunction(obj.function, grade, itemType) ?? undefined, "功法");
    return { itemType: "功法", name, desc, grade, count, bonus: parseBonusField(obj.bonus, grade), function: fn } as GongfaItemDefinition;
  }

  switch (itemType) {
    case "法宝": {
      const fn = applyTypedFunctionOverrides(validateAiFunction(obj.function, grade, "法宝") ?? undefined, "法宝");
      return { itemType: "法宝", name, desc, grade, count, bonus: parseTreasureBonusField(obj.bonus, grade), function: fn } as TreasureItemDefinition;
    }
    case "丹药": {
      const effectType = parseElixirEffectType(obj.effectType);
      const value = rollElixirValue(effectType, grade);
      return { itemType: "丹药" as const, name, desc, grade, count, effectType, effects: { value, isPercent: isElixirPercent(effectType, grade) } };
    }
    case "材料":
      return { itemType: "材料", name, desc, grade, count } as MaterialItemDefinition;
    case "杂物":
    default:
      return { itemType: "杂物", name, desc, grade, count } as MiscItemDefinition;
  }
}
