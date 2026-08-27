/**
 * 主角的扮演向软属性：【魅力】与【名声】。
 *
 * 两者都**不参与任何战斗结算**，只用于剧情演出与界面展示。
 * 每项由两部分组成：
 *   - 数值：唯一真相。开局购点给出初值，之后由 AI 以增量方式改动（见 `state_preset.ts`）。
 *   - 档位名：数值的纯函数，查 {@link CHARM_TIERS} / {@link FAME_TIERS} 得出，永远与数值同步。
 * 另有一句 AI 自由撰写的具体描述存在主角身上（`charmDesc` / `fameDesc`），
 * 与档位名并列展示，二者互不覆盖。
 */

/** 魅力取值范围。 */
export const CHARM_MIN = 0;
export const CHARM_MAX = 100;

/** 名声取值范围；负值代表恶名。 */
export const FAME_MIN = -100;
export const FAME_MAX = 100;

/** 一档：`min` 为该档的数值下界（含），`label` 为档位名。 */
export interface RoleplayStatTier {
  min: number;
  label: string;
}

/** AI 单轮可提交的魅力/名声增量与描述改写。 */
export interface RoleplayStatChange {
  charmChange?: number;
  charmDesc?: string;
  fameChange?: number;
  fameDesc?: string;
}

/**
 * 魅力档位表。每 10 点一档，按 `min` 从低到高排列；100 点归入最高档。
 * 增删档位只改这张表即可，界面与 AI 提示词都跟着走。
 */
export const CHARM_TIERS: readonly RoleplayStatTier[] = [
  { min: 0, label: "貌陋形丑" },
  { min: 10, label: "貌寝平庸" },
  { min: 20, label: "尘俗之姿" },
  { min: 30, label: "五官端正" },
  { min: 40, label: "神采清朗" },
  { min: 50, label: "风姿特秀" },
  { min: 60, label: "出尘脱俗" },
  { min: 70, label: "仙风道骨" },
  { min: 80, label: "绝代风华" },
  { min: 90, label: "倾世仙姿" },
];

/**
 * 名声档位表。每 10 点一档，负值段为恶名；100 点归入最高档。
 */
export const FAME_TIERS: readonly RoleplayStatTier[] = [
  { min: -100, label: "灭世魔头" },
  { min: -90, label: "万劫巨凶" },
  { min: -80, label: "举世皆敌" },
  { min: -70, label: "血海煞星" },
  { min: -60, label: "恶名昭彰" },
  { min: -50, label: "凶名在外" },
  { min: -40, label: "宗门叛逆" },
  { min: -30, label: "市井恶霸" },
  { min: -20, label: "微有劣迹" },
  { min: -10, label: "隐忍不显" },
  { min: 0, label: "籍籍无名" },
  { min: 10, label: "初露锋芒" },
  { min: 20, label: "小有名气" },
  { min: 30, label: "乡邻称颂" },
  { min: 40, label: "声名鹊起" },
  { min: 50, label: "威名赫赫" },
  { min: 60, label: "名动八荒" },
  { min: 70, label: "仁德无双" },
  { min: 80, label: "当世圣贤" },
  { min: 90, label: "万古流芳" },
];

/**
 * 把数值夹到区间内并取整。
 *
 * @param value 原始值（可能来自存档或 AI，未必是合法数字）。
 * @param min 下界。
 * @param max 上界。
 * @returns 区间内的整数；非数字按 0 处理后再夹。
 */
export function clampRoleplayStat(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(min, Math.min(max, n));
}

/**
 * 查档位名：取最后一个 `min <= value` 的档。
 *
 * @param tiers 档位表，需按 `min` 升序。
 * @param value 当前数值。
 * @returns 档位名；表为空时返回空串。
 */
export function roleplayStatTierLabel(tiers: readonly RoleplayStatTier[], value: number): string {
  let label = tiers.length ? tiers[0]!.label : "";
  for (const tier of tiers) {
    if (value >= tier.min) label = tier.label;
    else break;
  }
  return label;
}

/** 魅力档位名。 */
export function charmTierLabel(value: number): string {
  return roleplayStatTierLabel(CHARM_TIERS, value);
}

/** 名声档位名。 */
export function fameTierLabel(value: number): string {
  return roleplayStatTierLabel(FAME_TIERS, value);
}

/**
 * 单轮增量的绝对值上限。AI 只负责"这件事让名声涨还是跌"，量级由这里兜底，
 * 防止一轮直接拉满（与 `xiuweiIncrease` 同一套"AI 定性、硬编码定量"的思路）。
 */
export const ROLEPLAY_CHANGE_MAX_PER_TURN = 10;

/** AI 自由描述的长度上限（超出截断，防止把提示词撑爆）。 */
export const ROLEPLAY_DESC_MAX_LEN = 40;

/**
 * 规范化一句 AI 写的描述：去首尾空白并截断。
 *
 * @param raw 未知来源的值。
 * @returns 规范化后的描述；非字符串或空白时为空串。
 */
export function normalizeRoleplayDesc(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, ROLEPLAY_DESC_MAX_LEN);
}
