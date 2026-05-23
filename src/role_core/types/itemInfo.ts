/**
 * 物品领域模型：法宝、功法、丹药、符箓、阵法、材料、杂物。
 * 储物袋单格为 discriminated union（`InventoryStackItem`），避免丹药带 magnification、功法带 recover 等混用。
 */

import type { SpiritStoneInventoryStack } from "./spiritStone";
import type { ZhStatBonusMap } from "./playInfo";
import type {
  TreasureSpecialEffect,
  GongfaSpecialEffect,
  ElixirSpecialEffect,
  TalismanSpecialEffect,
  FormationSpecialEffect,
} from "./special_effects";

// ---------------------------------------------------------------------------
// 共用枚举与基底
// ---------------------------------------------------------------------------

/** worldbook：品阶仅能为以下之一 */
export type ItemGrade = "下品" | "中品" | "上品" | "极品" | "仙品" | "神品";

/** 契合灵根：五行灵根之一 */
export type LingQi = "无" | "金" | "木" | "水" | "火" | "土";

/** 配置表或 AI 条目上的中文加成；允许表外键 */
export type ItemBonusMap = ZhStatBonusMap | Record<string, number>;

/** 普通丹药：按品阶生成的恢复量（无恢复的一侧填 0） */
export interface PillRecoverEffect {
  hp: number;
  mp: number;
}

/** 普通丹药效果 */
export interface ItemElixirEffects {
  recover: PillRecoverEffect;
}

/**
 * 各类物品的公共头（name 必填；`desc` 与 mortal_journey 储物袋格、describe 表一致）。
 */
export interface ItemDefinitionBase {
  name: string;
  desc: string;
  grade: ItemGrade;
  count: number;
}

// ---------------------------------------------------------------------------
// 法宝（武器 / 法器 / 防具 统一为法宝）
// ---------------------------------------------------------------------------

export interface TreasureItemDefinition extends ItemDefinitionBase {
  itemType: "法宝";
  function?: TreasureSpecialEffect;
}

// ---------------------------------------------------------------------------
// 功法（统一，不区分攻击/辅助）
// ---------------------------------------------------------------------------

export interface GongfaItemDefinition extends ItemDefinitionBase {
  itemType: "功法";
  bonus: ItemBonusMap;
  lingQi: LingQi;
  function?: GongfaSpecialEffect;
}

// ---------------------------------------------------------------------------
// 丹药
// ---------------------------------------------------------------------------

export interface ElixirItemDefinition extends ItemDefinitionBase {
  itemType: "丹药";
  effects: ItemElixirEffects;
  function?: ElixirSpecialEffect;
}

// ---------------------------------------------------------------------------
// 符箓与阵法
// ---------------------------------------------------------------------------

export interface TalismanItemDefinition extends ItemDefinitionBase {
  itemType: "符箓";
  function?: TalismanSpecialEffect;
}

export interface FormationItemDefinition extends ItemDefinitionBase {
  itemType: "阵法";
  function?: FormationSpecialEffect;
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
  | ElixirItemDefinition
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

// ---------------------------------------------------------------------------
// 品阶掉落概率表
// ---------------------------------------------------------------------------

/**
 * 单条品阶概率（百分比，0~100，可为小数；每行之和应为 100）。
 */
export interface GradeDropRate {
  下品: number;
  中品: number;
  上品: number;
  极品: number;
  仙品: number;
  神品: number;
}

export { GRADE_DROP_TABLE } from "./gameConstants";
