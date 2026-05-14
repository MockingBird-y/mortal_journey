/**
 * 物品领域模型：法宝、攻击·辅助功法、丹药与突破丹药、材料、杂物。
 * 对齐 mortal_journey 中 worldbook（init_state_rules）、state_generate.ensureGeneratedItemStats、
 * normalizeBagItem 等口径。
 * 储物袋单格为 discriminated union（`InventoryStackItem`），避免丹药带 magnification、功法带 recover 等混用。
 */

import type { SpiritStoneInventoryStack } from "./spiritStone";
import type { ZhStatBonusMap } from "./playInfo";
import type { SpecialEffect } from "./special_effects";

// ---------------------------------------------------------------------------
// 共用枚举与基底
// ---------------------------------------------------------------------------

/** worldbook：品阶仅能为以下之一 */
export type ItemGrade = "下品" | "中品" | "上品" | "极品" | "仙品";

/** 配置表或 AI 条目上的中文加成；允许表外键 */
export type ItemBonusMap = ZhStatBonusMap | Record<string, number>;

/** 普通丹药：按品阶生成的恢复量（无恢复的一侧填 0） */
export interface PillRecoverEffect {
  hp: number;
  mp: number;
}

/** 突破丹药：大境界跃迁与成功率加成（chanceBonus 为比例，如 0.12 表示 +12%） */
export interface BreakthroughEffectEntry {
  from: string;
  to: string;
  chanceBonus: number;
}

/** 普通丹药效果 */
export interface ItemElixirEffects {
  recover: PillRecoverEffect;
}

/** 突破丹药专用效果 */
export interface BreakthroughElixirEffects {
  breakthrough: BreakthroughEffectEntry[];
}

/**
 * 各类物品的公共头（name 必填；`desc` 与 mortal_journey 储物袋格、describe 表一致）。
 */
export interface ItemDefinitionBase {
  name: string;
  desc: string;
  grade: ItemGrade;
  count: number;
  /** 特殊效果（法宝/功法/丹药/符箓/阵法可携带） */
  function?: SpecialEffect;
}

// ---------------------------------------------------------------------------
// 法宝（武器 / 法器 / 防具 统一为法宝）
// ---------------------------------------------------------------------------

export interface TreasureItemDefinition extends ItemDefinitionBase {
  itemType: "法宝";
}

// ---------------------------------------------------------------------------
// 功法（统一，不区分攻击/辅助）
// ---------------------------------------------------------------------------

export interface GongfaItemDefinition extends ItemDefinitionBase {
  itemType: "功法";
  bonus: ItemBonusMap;
}

// ---------------------------------------------------------------------------
// 丹药（含突破丹药）
// ---------------------------------------------------------------------------

export interface ElixirItemDefinition extends ItemDefinitionBase {
  itemType: "丹药";
  effects: ItemElixirEffects;
}

/**
 * AI 原始类型「突破丹药」；入库后常与 ElixirItemDefinition 一样标 type「丹药」并带 effects.breakthrough。
 */
export interface BreakthroughElixirDefinition extends ItemDefinitionBase {
  itemType: "突破丹药";
  /** 中品→练气筑基、上品→筑基结丹、极品→结丹元婴、仙品→元婴化神 */
  grade: ItemGrade;
  effects: BreakthroughElixirEffects;
}

export type PillItemDefinition = ElixirItemDefinition | BreakthroughElixirDefinition;

// ---------------------------------------------------------------------------
// 符箓与阵法
// ---------------------------------------------------------------------------

export interface TalismanItemDefinition extends ItemDefinitionBase {
  itemType: "符箓";
}

export interface FormationItemDefinition extends ItemDefinitionBase {
  itemType: "阵法";
}

// ---------------------------------------------------------------------------
// 材料与杂物
// ---------------------------------------------------------------------------

export interface MaterialItemDefinition extends ItemDefinitionBase {
  itemType: "材料";
}

export interface MiscItemDefinition extends ItemDefinitionBase {
  itemType: "杂物";
}

// ---------------------------------------------------------------------------
// 总联合（按大类区分）
// ---------------------------------------------------------------------------

export type CategorizedItemDefinition =
  | TreasureItemDefinition
  | GongfaItemDefinition
  | PillItemDefinition
  | TalismanItemDefinition
  | FormationItemDefinition
  | MaterialItemDefinition
  | MiscItemDefinition;

// ---------------------------------------------------------------------------
// 储物袋单格堆叠
// ---------------------------------------------------------------------------

/** 灵石堆叠类型见 `spiritStone.ts`（`createSpiritStoneInventoryStack` 等同模块）。 */
export type { SpiritStoneInventoryStack };

/**
 * 储物袋非灵石格与上方 `CategorizedItemDefinition` 同形，避免法宝/功法/丹药各写两套类型。
 * 下列别名仅语义提示，便于对照旧脚本里的「bag」命名。
 */
export type TreasureBagStack = TreasureItemDefinition;
export type GongfaBagStack = GongfaItemDefinition;
export type ElixirBagStack = ElixirItemDefinition;
export type BreakthroughElixirBagStack = BreakthroughElixirDefinition;
export type TalismanBagStack = TalismanItemDefinition;
export type FormationBagStack = FormationItemDefinition;
export type MaterialBagStack = MaterialItemDefinition;
export type MiscBagStack = MiscItemDefinition;

/**
 * 储物袋一格：灵石栈 + 与配置表一致的物品定义联合。
 * 判别：灵石用五档灵石名且 `type` 为「灵石」而无 `itemType`；其余用 `itemType` / `subtype`。
 */
export type InventoryStackItem =
  | SpiritStoneInventoryStack
  | CategorizedItemDefinition;
