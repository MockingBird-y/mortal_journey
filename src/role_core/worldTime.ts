/**
 * 修仙界「世界时间」：以结构化字段为唯一数据源，界面文案仅由格式化函数派生。
 *
 * 历法规则（简化）：每月固定 30 天，每年 12 月 = 360 天。
 */

export interface WorldTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * 世界时间增量。
 * - `years` / `months` / `days` 为**增量**（累加到当前时间）。
 * - `hour` 为**绝对值**（直接覆盖，用于剧情明确指出时辰的场景）。
 */
export interface TimeDelta {
  years?: number;
  months?: number;
  days?: number;
  hour?: number;
}

const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;

export function createDefaultWorldTime(): WorldTime {
  return { year: 1, month: 1, day: 1, hour: 9, minute: 0 };
}

export function cloneWorldTime(t: WorldTime): WorldTime {
  return {
    year: t.year,
    month: t.month,
    day: t.day,
    hour: t.hour,
    minute: t.minute,
  };
}

function pad2(n: number): string {
  return Math.max(0, Math.floor(n)).toString().padStart(2, "0");
}

function pad4(n: number): string {
  return Math.max(0, Math.floor(n)).toString().padStart(4, "0");
}

/** 例：`0001年01月01号 09:00`（仅展示用，不参与业务计算） */
export function formatWorldTimeZhDisplay(t: WorldTime): string {
  return `${pad4(t.year)}年${pad2(t.month)}月${pad2(t.day)}号 ${pad2(t.hour)}:${pad2(t.minute)}`;
}

/**
 * 自 `from` 到 `to` 经过的整年数（仅比较年分量；后续若需精确到月日可在此扩展）。
 * 用于：显示年龄 = 开局档案年龄 + 经过年数。
 */
export function calendarYearsElapsed(from: WorldTime, to: WorldTime): number {
  const d = to.year - from.year;
  return d > 0 ? d : 0;
}

export function addYearsToTime(t: WorldTime, years: number): WorldTime {
  if (!Number.isFinite(years) || years <= 0) return cloneWorldTime(t);
  return normalizeWorldTime({
    year: t.year + Math.floor(years),
    month: t.month,
    day: t.day,
    hour: t.hour,
    minute: t.minute,
  });
}

/**
 * 将溢出的天/月/年进位规范化。
 * 规则：每月 30 天，每年 12 月。
 */
export function normalizeWorldTime(t: WorldTime): WorldTime {
  let { year, month, day, hour, minute } = t;

  if (hour >= 24) {
    const extraDays = Math.floor(hour / 24);
    hour = hour % 24;
    day += extraDays;
  } else if (hour < 0) {
    hour = 0;
  }

  if (day > DAYS_PER_MONTH) {
    const extraMonths = Math.floor((day - 1) / DAYS_PER_MONTH);
    day = ((day - 1) % DAYS_PER_MONTH) + 1;
    month += extraMonths;
  } else if (day < 1) {
    day = 1;
  }

  if (month > MONTHS_PER_YEAR) {
    const extraYears = Math.floor((month - 1) / MONTHS_PER_YEAR);
    month = ((month - 1) % MONTHS_PER_YEAR) + 1;
    year += extraYears;
  } else if (month < 1) {
    month = 1;
  }

  year = Math.max(1, year);
  minute = Math.max(0, Math.min(59, minute));

  return { year, month, day, hour, minute };
}

/**
 * 增量式推进世界时间。
 * - `delta.years/months/days` 累加到当前时间。
 * - `delta.hour` 覆盖当前小时（用于剧情明确指出时辰）。
 * - 结果自动规范化（溢出进位）。
 */
export function advanceWorldTime(base: WorldTime, delta: TimeDelta): WorldTime {
  const years = (delta.years ?? 0);
  const months = (delta.months ?? 0);
  const days = (delta.days ?? 0);
  const hour = delta.hour;

  const raw: WorldTime = {
    year: base.year + years,
    month: base.month + months,
    day: base.day + days,
    hour: hour !== undefined ? hour : base.hour,
    minute: base.minute,
  };

  return normalizeWorldTime(raw);
}
