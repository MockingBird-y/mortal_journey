/**
 * 境界相关功能函数：基础属性查询、修为需求、寿元、叙事年龄等。
 * 类型和常量数据表定义在 `types/playInfo.ts`。
 */

import type { PlayerBaseStats } from "./types/playInfo";
import {
  TABLE,
  REALM_ORDER,
  BASE_STAT_KEYS,
  DERIVED_STAT_DEFAULTS,
  CULTIVATION_VALUES,
  SHOUYUAN_VALUES,
  EQUIP_BONUS_RATIOS,
  MIN_NARRATIVE_AGE_BY_MAJOR,
  realmStageIndex,
  type RealmBaseStatsRow,
  type RealmMajor,
} from "./types/playInfo";

/**
 * 境界表按 realm+"\\x01"+stage 键的惰性索引缓存。
 * 由于存在 `playInfo.ts` ↔ `realmUtils.ts` 的循环导入，不能
 * 在模块顶层直接构建，须延迟到首次访问时初始化。
 */
let _byKey: Record<string, RealmBaseStatsRow> | null = null;

/**
 * 获取（惰性构建）境界表索引。
 * @returns 以 realm+"\\x01"+stage 为键的行映射对象。
 * @private
 */
function getByKey(): Record<string, RealmBaseStatsRow> {
  if (!_byKey) {
    _byKey = {};
    for (const row of TABLE) {
      _byKey[row.realm + "\u0001" + row.stage] = row;
    }
  }
  return _byKey;
}

/**
 * 查询境界装备倍率。
 *
 * @param major 大境界，如 `"练气"`。
 * @param minor 小境界，如 `"初期"`。
 * @returns 对应境界的装备加成倍率；查询失败或参数为空时返回 `1`。
 */
export function getEquipBonusRealmRatio(
  major: string | null | undefined,
  minor: string | null | undefined,
): number {
  if (major == null || major === "" || minor == null || minor === "") return 1;
  const idx = realmStageIndex(String(major).trim(), String(minor).trim()) - 1;
  if (idx < 0 || idx >= EQUIP_BONUS_RATIOS.length) return 1;
  const n = EQUIP_BONUS_RATIOS[idx];
  return typeof n === "number" && isFinite(n) && n > 0 ? n : 1;
}

/**
 * 从境界表行克隆为 `PlayerBaseStats`。
 *
 * 遍历 `BASE_STAT_KEYS`（当前为 14 维派生属性），
 * 若键在境界表行中存在则取值，否则取 `DERIVED_STAT_DEFAULTS` 中的默认值
 * （未配置默认值的回退为 0）。
 * 意味着 hp/mp/patk/matk/pdef/mdef 由境界表提供，
 * 其余 10 维按各自配置的默认值初始化，后续由法宝/功法加成。
 *
 * @param row 境界表行。
 * @returns 完整的 `PlayerBaseStats` 对象。
 * @private
 */
function cloneStatsFromRow(row: RealmBaseStatsRow): PlayerBaseStats {
  const result: Record<string, number> = {};
  const rowObj = row as unknown as Record<string, number>;
  for (const k of BASE_STAT_KEYS) {
    result[k] = k in rowObj ? rowObj[k] : (DERIVED_STAT_DEFAULTS[k as keyof typeof DERIVED_STAT_DEFAULTS] ?? 0);
  }
  return result as unknown as PlayerBaseStats;
}

/**
 * 查询某境界阶段的基础属性（14 维，非境界属性取默认值）。
 *
 * @param realm 大境界。
 * @param stage 小境界，可省略。
 * @returns `PlayerBaseStats` 对象；查不到时返回 `null`。
 */
export function getBaseStats(realm: string, stage?: string | null): PlayerBaseStats | null {
  if (realm == null || realm === "" || stage == null || stage === "") return null;
  const row = getByKey()[realm + "\u0001" + stage];
  return row ? cloneStatsFromRow(row) : null;
}

/**
 * 查询境界表的原始行对象（仅含 realm/stage/hp/mp）。
 *
 * @param realm 大境界。
 * @param stage 小境界，可省略。
 * @returns 境界表行克隆；查不到时返回 `null`。
 */
export function getRow(realm: string, stage?: string | null): RealmBaseStatsRow | null {
  if (realm == null || realm === "" || stage == null || stage === "") return null;
  const r = getByKey()[realm + "\u0001" + stage];
  return r
    ? { realm: r.realm, stage: r.stage, hp: r.hp, mp: r.mp }
    : null;
}

/**
 * 检测境界表是否存在指定行。
 *
 * @param realm 大境界。
 * @param stage 小境界，可省略。
 * @returns 存在则返回 `true`。
 */
export function hasRow(realm: string, stage?: string | null): boolean {
  return getRow(realm, stage) != null;
}

/**
 * 获取完整的境界基础属性表（所有境界 × 所有小阶段的 `RealmBaseStatsRow` 数组）。
 *
 * @returns 只读境界表数组。
 */
export function getTable(): readonly RealmBaseStatsRow[] {
  return TABLE;
}

/**
 * 查询某境界阶段突破所需的修为值。
 *
 * @param realm 大境界。
 * @param stage 小境界，可省略。
 * @returns 修为值；查不到时返回 `null`。
 */
export function getCultivationRequired(realm: string, stage?: string | null): number | null {
  if (realm == null || realm === "" || stage == null || stage === "") return null;
  const idx = realmStageIndex(realm, stage) - 1;
  if (idx < 0 || idx >= CULTIVATION_VALUES.length) return null;
  return CULTIVATION_VALUES[idx];
}

/**
 * 查询某境界阶段的寿元上限。
 *
 * @param realm 大境界。
 * @param stage 小境界，可省略。
 * @returns 寿元（岁）；查不到时返回 `null`。
 */
export function getShouyuanForRealm(realm: string, stage?: string | null): number | null {
  if (realm == null || realm === "" || stage == null || stage === "") return null;
  const idx = realmStageIndex(realm, stage) - 1;
  if (idx < 0 || idx >= SHOUYUAN_VALUES.length) return null;
  return SHOUYUAN_VALUES[idx];
}

/**
 * 查询某大境界对应的叙事年龄下限。
 *
 * 输入的 `major` 字符串会去除结尾的 `"期"` 后缀并在
 * `MIN_NARRATIVE_AGE_BY_MAJOR` 中查找；查不到则回退为练气下限。
 *
 * @param major 大境界字符串，如 `"练气"` 或 `"筑基期"`。
 * @returns 该境界的叙事年龄下限（岁）。
 */
export function getMinNarrativeAgeForMajor(major: string): number {
  let m = major != null ? String(major).trim() : "";
  if (m.endsWith("期")) m = m.slice(0, -1).trim();
  if (Object.prototype.hasOwnProperty.call(MIN_NARRATIVE_AGE_BY_MAJOR, m)) {
    return MIN_NARRATIVE_AGE_BY_MAJOR[m]!;
  }
  return MIN_NARRATIVE_AGE_BY_MAJOR.练气;
}

/**
 * 叙事年龄计算中表示自定义出身的数据切片。
 */
export interface CustomBirthSlice {
  /** 出身背景文案。 */
  background?: string;
  /** 自定义出身指定的大境界。 */
  realmMajor?: string;
}

/**
 * 叙事年龄计算中表示命运抉择的数据切片。
 */
export interface FateChoiceSliceForAge {
  /** 自定义出身（命运抉择）。 */
  customBirth?: CustomBirthSlice;
  /** 命运抉择选择的境界。 */
  realm?: { major?: string };
}

/**
 * 叙事年龄计算中表示游戏运行时状态的切片。
 */
export interface GameSliceForNarrativeAge {
  /** 当前年龄。 */
  age?: number;
  /** 当前境界。 */
  realm?: { major?: string };
  /** 命运抉择信息。 */
  fateChoice?: FateChoiceSliceForAge;
}

/**
 * 检测命运抉择中的出身背景是否触发年龄例外。
 *
 * 若出身背景包含 "灌顶"、"催熟"、"夺舍"、"透支" 等关键词，
 * 则年龄不受境界下限约束。
 *
 * @param fc 命运抉择年龄切片。
 * @returns 触发例外时返回 `true`。
 */
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

/**
 * 解析叙事年龄计算中应使用的大境界。
 *
 * 优先取 `GameSliceForNarrativeAge.realm.major`，其次取
 * `FateChoiceSliceForAge.customBirth.realmMajor`，
 * 两者均无时返回 `"练气"`。
 * 若自定义出身的境界严格高于游戏运行时境界，则采用后者。
 *
 * @param fc 命运抉择年龄切片。
 * @param G 游戏运行时状态切片。
 * @returns 解析后的大境界字符串。
 */
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

/**
 * 计算主角的叙事年龄。
 *
 * 默认年龄（`options.defaultAge`）与游戏运行时年龄中取较大值作为基数，
 * 再与解析有效大境界后的叙事年龄下限比较取最大值。
 * 若出身背景触发年龄例外，则直接返回基数。
 *
 * @param G 游戏运行时状态切片。
 * @param fc 命运抉择年龄切片，可选；若省略则从 `G.fateChoice` 读取。
 * @param options 可选配置，可提供 `defaultAge`（默认 16）。
 * @returns 叙事年龄（整数，≥0）。
 */
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
