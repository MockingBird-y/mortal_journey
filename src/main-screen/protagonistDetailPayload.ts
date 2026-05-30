/**
 * @fileoverview 主角左栏详情弹窗内容，与 mortal_journey 中 `openItemDetailModal` /
 * `openTraitDetailModal` 的信息结构对齐。
 */

import type {
  CategorizedItemDefinition,
  ElixirItemDefinition,
  FormationItemDefinition,
  GongfaItemDefinition,
  InventoryStackItem,
  MaterialItemDefinition,
  MiscItemDefinition,
  SpiritStoneInventoryStack,
  TalismanItemDefinition,
  TreasureItemDefinition,
} from "../role_core/types/itemInfo";
import type { CultivationRealm, EquipSlotKey, TraitEntry } from "../role_core/types/playInfo";
import { BASE_STAT_KEYS, DERIVED_STAT_KEY_TO_ZH, getEquipBonusRealmRatio, getEquipBonusRatioWithAffinity, LINGQI_AFFINITY_BONUS, type PlayerBaseStats } from "../role_core/types/playInfo";
import type { ItemSpecialEffect } from "../role_core/types/special_effects";
import { lookupCostZh, lookupEffectZh, lookupTriggerZh } from "../role_core/types/special_effects";
import { gradeToTraitRarity } from "./protagonistPanelDisplay";

/**
 * 详情弹窗底部按钮所触发的动作；由 `protagonistManager.applyProtagonistDetailAction` 执行。
 */
export type ProtagonistDetailAction =
  | { id: "unequipWear"; equipSlot: EquipSlotKey }
  | { id: "unequipGongfa"; gongfaIndex: number }
  | { id: "equipWearFromBag"; inventoryIndex: number }
  | { id: "equipGongfaFromBag"; inventoryIndex: number };

/**
 * 详情弹窗底部的一个操作按钮。
 */
export interface ProtagonistDetailActionButton {
  /** 按钮文案。 */
  label: string;
  /** 点击后执行的动作。 */
  action: ProtagonistDetailAction;
  /** 是否为主按钮样式。 */
  primary?: boolean;
}

/**
 * 详情弹窗中的一段键值说明。
 */
export interface ProtagonistDetailSection {
  /** 段落标题（如「简介」「品级」）。 */
  label: string;
  /** 段落正文。 */
  text: string;
}

/**
 * 传给详情弹窗的完整展示数据。
 */
export interface ProtagonistDetailPayload {
  title: string;
  subtitle: string;
  sections: ProtagonistDetailSection[];
  dataRarity?: string;
  actions?: ProtagonistDetailActionButton[];
  /** 以两列网格布局展示 sections */
  gridSections?: boolean;
}

/**
 * 装备类详情所对应的来源：当前已穿戴槽位，或储物袋中的格子索引。
 */
export type WearableDetailSource =
  | { type: "equipped"; equipSlot: EquipSlotKey }
  | { type: "bag"; inventoryIndex: number };

/**
 * 功法详情所对应的来源：功法栏下标，或储物袋中的格子索引。
 */
export type GongfaDetailSource = { type: "bar"; gongfaIndex: number } | { type: "bag"; inventoryIndex: number };

/**
 * 若文本非空则构造一个详情段落，否则返回 `null`。
 *
 * @param label - 段落标题。
 * @param text - 原始文本、数字或空值。
 * @returns 有效段落对象，或内容为空时返回 `null`。
 */
function sec(label: string, text: string | number | undefined | null): ProtagonistDetailSection | null {
  if (text == null) return null;
  const t = typeof text === "string" ? text.trim() : String(text);
  if (t === "") return null;
  return { label, text: t };
}

/**
 * 将非空段落追加到数组中（内部复用 `sec`）。
 *
 * @param out - 目标段落数组（会被原地修改）。
 * @param label - 段落标题。
 * @param text - 原始文本、数字或空值。
 */
function pushSec(out: ProtagonistDetailSection[], label: string, text: string | number | undefined | null): void {
  const s = sec(label, text);
  if (s) out.push(s);
}

/**
 * 将属性加成对象格式化为中文分号分隔的展示字符串。
 *
 * @param b - 键为属性名、值为加成的记录；无效时返回 `undefined`。
 * @returns 格式化后的文案，无有效项时返回 `undefined`。
 */
function formatZhBonus(b: Record<string, number> | undefined): string | undefined {
  if (!b || typeof b !== "object") return undefined;
  const parts = Object.entries(b).map(([k, v]) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const sign = v >= 0 ? "+" : "";
    return `${k} ${sign}${v}`;
  }).filter(Boolean) as string[];
  return parts.length ? parts.join("；") : undefined;
}

/**
 * 已佩戴 / 已上阵槽位：分别展示境界加成与灵根加成。
 * 例：「体魄 +5 (境界加成 +3；灵根加成 +1)」
 */
function formatZhBonusWithRealmEquip(
  b: Record<string, number> | undefined,
  realm: CultivationRealm,
  affinity?: boolean | null,
): string | undefined {
  if (!b || typeof b !== "object") return undefined;
  const realmRatio = getEquipBonusRealmRatio(realm.major, realm.minor);
  const parts = Object.entries(b).map(([k, v]) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const sign = v >= 0 ? "+" : "";
    let line = `${k} ${sign}${v}`;
    const extras: string[] = [];
    if (realmRatio !== 1) {
      const realmExtra = Math.trunc(v * (realmRatio - 1));
      const rs = realmExtra >= 0 ? "+" : "";
      extras.push(`境界加成 ${rs}${realmExtra}`);
    }
    if (affinity) {
      const affExtra = Math.trunc(v * realmRatio * LINGQI_AFFINITY_BONUS);
      const as2 = affExtra >= 0 ? "+" : "";
      extras.push(`灵根加成 ${as2}${affExtra}`);
    }
    if (extras.length) line += ` (${extras.join("；")})`;
    return line;
  }).filter(Boolean) as string[];
  return parts.length ? parts.join("；") : undefined;
}

/**
 * 将倍率对象格式化为「键 × 值」的中文分号分隔字符串。
 *
 * @param m - 键为维度名、值为倍率的记录；无效时返回 `undefined`。
 * @returns 格式化后的文案，无有效项时返回 `undefined`。
 */
function formatMagnification(m: Record<string, number> | undefined): string | undefined {
  if (!m || typeof m !== "object") return undefined;
  const parts = Object.entries(m).map(([k, v]) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    return `${k} ×${v}`;
  }).filter(Boolean) as string[];
  return parts.length ? parts.join("；") : undefined;
}

/**
 * 将物品的 `function`（SpecialEffect）格式化为多行中文展示文本。
 *
 * 输出示例（无灵根契合）：
 * ```
 * 触发条件：主动行为触发
 * 效果：恢复血量 +200（恢复）
 * 持续回合：3
 * 消耗：消耗法力 20
 * ```
 *
 * 输出示例（灵根契合）：
 * ```
 * 触发条件：主动行为触发
 * 效果：恢复血量 +200（恢复）(灵根加成 +60)
 * 持续回合：3
 * 消耗：消耗法力 20
 * ```
 */
function formatSpecialEffect(fn: ItemSpecialEffect | undefined, affinity?: boolean | null): string | undefined {
  if (!fn) return undefined;
  const lines: string[] = [];

  const triggerZh = lookupTriggerZh(fn.trigger as string);
  if (triggerZh) lines.push(`触发条件：${triggerZh}`);

  const effLabel = lookupEffectZh(fn.effect.label as string);
  if (effLabel) {
    const sign = fn.effect.value >= 0 ? "+" : "";
    let effLine = `效果：${effLabel} ${sign}${fn.effect.value}`;
    if (affinity) {
      const affExtra = Math.trunc(fn.effect.value * LINGQI_AFFINITY_BONUS);
      const as2 = affExtra >= 0 ? "+" : "";
      effLine += ` (灵根加成 ${as2}${affExtra})`;
    }
    lines.push(effLine);
  }

  if (typeof fn.duration === "number") {
    lines.push(fn.duration > 0 ? `持续回合：${fn.duration}` : "持续回合：即时生效");
  }

  const costZh = lookupCostZh(fn.cost.resource as string);
  if (costZh && fn.cost.resource !== "none") {
    lines.push(`消耗：${costZh} ${fn.cost.value}`);
  } else if (costZh) {
    lines.push(`消耗：${costZh}`);
  }

  return lines.length ? lines.join("\n") : undefined;
}

/**
 * 若物品携带 `function` 字段，则将其格式化后追加到详情段落数组中。
 *
 * @param out - 目标段落数组。
 * @param fn - 物品的特殊效果（可为 `undefined`）。
 */
function pushFunctionSection(out: ProtagonistDetailSection[], fn: ItemSpecialEffect | undefined, affinity?: boolean | null): void {
  const text = formatSpecialEffect(fn, affinity);
  if (text) pushSec(out, "功能", text);
}

/**
 * 根据天赋条目构建详情弹窗数据。
 *
 * @param t - 天赋条目；字符串视为仅名称的简项，对象则包含名称、稀有度与描述等。
 * @returns 弹窗载荷；`t` 为 `null`/`undefined` 时返回 `null`。
 */
export function buildTraitDetailPayload(t: TraitEntry): ProtagonistDetailPayload | null {
  if (t == null) return null;
  if (typeof t === "string") {
    return {
      title: t,
      subtitle: "天赋",
      sections: [{ label: "说明", text: t }],
    };
  }
  const sections: ProtagonistDetailSection[] = [];
  pushSec(sections, "简述", t.desc);
  const sub = t.rarity?.trim() ? `品质：${t.rarity.trim()}` : "天赋";
  return {
    title: t.name || "—",
    subtitle: sub,
    sections: sections.length ? sections : [{ label: "说明", text: "暂无描述。" }],
    dataRarity: t.rarity?.trim() || undefined,
  };
}

/**
 * 根据法宝定义生成副标题。
 *
 * @param it 法宝定义。
 * @returns 固定返回「法宝」。
 */
function wearableSubtitle(it: TreasureItemDefinition): string {
  return "法宝";
}

/**
 * 构建法宝的详情弹窗数据，并按来源附加「卸下」或「装备」操作。
 *
 * @param it 法宝物品定义。
 * @param source 可选来源：已装备槽位或储物袋索引；省略则无底部操作。
 * @param realm 可选境界（用于计算境界加成显示）。
 * @returns 完整的 `ProtagonistDetailPayload`。
 */
export function buildWearableDetailPayload(
  it: TreasureItemDefinition,
  source?: WearableDetailSource,
  realm?: CultivationRealm | null,
): ProtagonistDetailPayload {
  const sections: ProtagonistDetailSection[] = [];
  pushSec(sections, "简介", it.desc);
  pushSec(sections, "品级", it.grade);
  const bonus =
    source?.type === "equipped" && realm
      ? formatZhBonusWithRealmEquip(it.bonus as Record<string, number>, realm)
      : formatZhBonus(it.bonus as Record<string, number>);
  if (bonus) pushSec(sections, "属性加成", bonus);
  pushFunctionSection(sections, it.function);

  const actions: ProtagonistDetailActionButton[] = [];
  if (source?.type === "equipped") {
    actions.push({
      label: "卸下",
      primary: true,
      action: { id: "unequipWear", equipSlot: source.equipSlot },
    });
  } else if (source?.type === "bag") {
    actions.push({
      label: "装备",
      primary: true,
      action: { id: "equipWearFromBag", inventoryIndex: source.inventoryIndex },
    });
  }

  return {
    title: it.name,
    subtitle: wearableSubtitle(it),
    sections: sections.length ? sections : [{ label: "说明", text: "暂无信息。" }],
    dataRarity: gradeToTraitRarity(it.grade),
    actions: actions.length ? actions : undefined,
  };
}

/**
 * 功法详情副标题（固定为「功法」）。
 *
 * @param gf - 功法物品定义；与 `wearableSubtitle` 对称保留参数，便于日后按类型扩展文案。
 * @returns 副标题字符串。
 */
function gongfaSubtitle(gf: GongfaItemDefinition): string {
  return `功法`;
}

/**
 * 构建功法物品的详情弹窗数据，并按来源附加「卸下」或「装备」操作。
 *
 * @param gf - 功法定义；攻击类会额外展示法力消耗与伤害倍率。
 * @param source - 可选来源：功法栏下标或储物袋索引；省略则无底部操作。
 * @returns 完整的 `ProtagonistDetailPayload`。
 */
export function buildGongfaDetailPayload(
  gf: GongfaItemDefinition,
  source?: GongfaDetailSource,
  realm?: CultivationRealm | null,
  playerLinggen?: readonly string[] | null,
): ProtagonistDetailPayload {
  const sections: ProtagonistDetailSection[] = [];
  const affinity = playerLinggen && gf.lingQi && gf.lingQi !== "无" && playerLinggen.includes(gf.lingQi);
  pushSec(sections, "契合灵根", gf.lingQi);
  pushSec(sections, "简介", gf.desc);
  pushSec(sections, "品级", gf.grade);
  const bonus =
    source?.type === "bar" && realm
      ? formatZhBonusWithRealmEquip(gf.bonus as Record<string, number>, realm, affinity)
      : formatZhBonus(gf.bonus as Record<string, number>);
  if (bonus) pushSec(sections, "修炼加成", bonus);
  pushFunctionSection(sections, gf.function, affinity);

  const actions: ProtagonistDetailActionButton[] = [];
  if (source?.type === "bar") {
    actions.push({
      label: "卸下",
      primary: true,
      action: { id: "unequipGongfa", gongfaIndex: source.gongfaIndex },
    });
  } else if (source?.type === "bag") {
    actions.push({
      label: "装备",
      primary: true,
      action: { id: "equipGongfaFromBag", inventoryIndex: source.inventoryIndex },
    });
  }

  return {
    title: gf.name,
    subtitle: gongfaSubtitle(gf),
    sections: sections.length ? sections : [{ label: "说明", text: "暂无信息。" }],
    dataRarity: gradeToTraitRarity(gf.grade),
    actions: actions.length ? actions : undefined,
  };
}

/**
 * 将丹药的恢复类效果格式化为简短中文（生命 / 法力）。
 *
 * @param el - 丹药定义，读取 `effects.recover`。
 * @returns 可读药效字符串；无有效恢复效果时返回 `undefined`。
 */
function formatRecover(el: ElixirItemDefinition): string | undefined {
  const r = el.effects?.recover;
  if (!r) return undefined;
  const hp = typeof r.hp === "number" && r.hp > 0 ? `生命 +${r.hp}` : "";
  const mp = typeof r.mp === "number" && r.mp > 0 ? `法力 +${r.mp}` : "";
  const parts = [hp, mp].filter(Boolean);
  return parts.length ? parts.join("，") : undefined;
}

/**
 * 根据储物袋单格堆叠数据构建详情弹窗：灵石、装备、功法、丹药、材料、杂物或兜底未知物品。
 *
 * @param cell - 灵石堆叠或带 `itemType` 的物品堆叠。
 * @param bagIndex - 储物袋中的格子索引；传入时装备 / 功法会带上「装备」动作，省略则仅展示信息。
 * @param linggen - 主角灵根数组；灵石修炼提示与折算依赖灵根种数。
 * @returns 对应类型的 `ProtagonistDetailPayload`。
 */
export function buildInventoryStackDetailPayload(
  cell: InventoryStackItem,
  bagIndex?: number,
  linggen?: string[],
): ProtagonistDetailPayload {
  if (!("itemType" in cell)) {
    const st = cell as SpiritStoneInventoryStack;
    const sections: ProtagonistDetailSection[] = [];
    pushSec(sections, "简介", st.desc);
    pushSec(sections, "持有数量", st.count);
    return {
      title: st.name,
      subtitle: `灵石`,
      sections: sections.length ? sections : [{ label: "说明", text: "—" }],
    };
  }

  const it = cell;
  switch (it.itemType) {
    case "法宝":
      return buildWearableDetailPayload(
        it,
        bagIndex != null ? { type: "bag", inventoryIndex: bagIndex } : undefined,
      );
    case "功法":
      return buildGongfaDetailPayload(
        it,
        bagIndex != null ? { type: "bag", inventoryIndex: bagIndex } : undefined,
        undefined,
        linggen,
      );
    case "丹药": {
      const pill = it as ElixirItemDefinition;
      const sections: ProtagonistDetailSection[] = [];
      pushSec(sections, "简介", pill.desc);
      pushSec(sections, "品级", pill.grade);
      const fx = formatRecover(pill);
      if (fx) pushSec(sections, "药效", fx);
      pushFunctionSection(sections, pill.function);
      pushSec(sections, "数量", pill.count);
      return {
        title: pill.name,
        subtitle: `丹药`,
        sections,
        dataRarity: gradeToTraitRarity(pill.grade),
      };
    }
    case "材料": {
      const m = it as MaterialItemDefinition;
      const sections: ProtagonistDetailSection[] = [];
      pushSec(sections, "简介", m.desc);
      pushSec(sections, "品级", m.grade);
      pushSec(sections, "数量", m.count);
      return {
        title: m.name,
        subtitle: `材料`,
        sections,
        dataRarity: gradeToTraitRarity(m.grade),
      };
    }
    case "杂物": {
      const misc = it as MiscItemDefinition;
      const sections: ProtagonistDetailSection[] = [];
      pushSec(sections, "简介", misc.desc);
      pushSec(sections, "品级", misc.grade);
      pushSec(sections, "数量", misc.count);
      return {
        title: misc.name,
        subtitle: `杂物`,
        sections,
        dataRarity: gradeToTraitRarity(misc.grade),
      };
    }
    case "符箓": {
      const tal = it as TalismanItemDefinition;
      const sections: ProtagonistDetailSection[] = [];
      pushSec(sections, "简介", tal.desc);
      pushSec(sections, "品级", tal.grade);
      pushFunctionSection(sections, tal.function);
      pushSec(sections, "数量", tal.count);
      return {
        title: tal.name,
        subtitle: "符箓",
        sections,
        dataRarity: gradeToTraitRarity(tal.grade),
      };
    }
    case "阵法": {
      const fm = it as FormationItemDefinition;
      const sections: ProtagonistDetailSection[] = [];
      pushSec(sections, "简介", fm.desc);
      pushSec(sections, "品级", fm.grade);
      pushFunctionSection(sections, fm.function);
      pushSec(sections, "数量", fm.count);
      return {
        title: fm.name,
        subtitle: "阵法",
        sections,
        dataRarity: gradeToTraitRarity(fm.grade),
      };
    }
    default: {
      const u = it as { name?: string; desc?: string; grade?: string; count?: number };
      return {
        title: u.name ?? "—",
        subtitle: "物品",
        sections: [{ label: "说明", text: u.desc ?? "—" }],
        dataRarity: u.grade ? gradeToTraitRarity(u.grade) : undefined,
      };
    }
  }
}

/**
 * 构建基础属性详情弹窗数据。
 *
 * @param playerBase 玩家当前基础属性（四维：血量/法力/物攻/防御）。
 * @returns 完整的 `ProtagonistDetailPayload`。
 */
export function buildBaseStatsPayload(playerBase: PlayerBaseStats): ProtagonistDetailPayload {
  const sections: ProtagonistDetailSection[] = [];
  for (const k of BASE_STAT_KEYS) {
    const zh = DERIVED_STAT_KEY_TO_ZH[k] ?? k;
    const v = playerBase[k];
    sections.push({ label: zh, text: String(typeof v === "number" ? Math.round(v) : v) });
  }
  return {
    title: "基础属性",
    subtitle: "",
    sections,
    gridSections: true,
  };
}
