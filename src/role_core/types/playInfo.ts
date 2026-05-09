/**
 * 角色「属性 · 装备 · 功法 · 储物袋」等领域模型。
 * 与 mortal_journey 中 MjCharacterSheet、MortalJourneyGame 槽位、PlayerBaseRuntime 面板属性对齐；
 * 主角主体为 `CharacterPlayInfoCommon`。
 * 本文件内接口字段均为必选（无 `?`），缺省语义用空串 / 0 / 空数组 / null 槽位表达。
 *
 * 物品与储物袋格的类型定义见 `itemInfo`；本文件在文末按相同模块顺序再导出，便于业务单点引用。
 */

export type NarrationPerson = "first" | "second" | "third";

import type {
  ArmorItemDefinition,
  FaqiItemDefinition,
  GongfaItemDefinition,
  InventoryStackItem,
  WeaponItemDefinition,
} from "./itemInfo";

// ---------------------------------------------------------------------------
// 属性键（原 zhPlayerStats）
// ---------------------------------------------------------------------------

export const PLAYER_STAT_BONUS_KEYS = [
  "hp",
  "mp",
  "patk",
  "pdef",
  "matk",
  "mdef",
  "sense",
  "luck",
  "dodge",
  "tenacity",
] as const;

export type PlayerStatBonusKey = (typeof PLAYER_STAT_BONUS_KEYS)[number];

export type ZhPlayerStatBonusKey =
  | "血量"
  | "法力"
  | "物攻"
  | "物防"
  | "法攻"
  | "法防"
  | "神识"
  | "气运"
  | "闪避"
  | "韧性";

export const PLAYER_STAT_KEY_TO_ZH: Readonly<Record<PlayerStatBonusKey, ZhPlayerStatBonusKey>> = {
  hp: "血量",
  mp: "法力",
  patk: "物攻",
  pdef: "物防",
  matk: "法攻",
  mdef: "法防",
  sense: "神识",
  luck: "气运",
  dodge: "闪避",
  tenacity: "韧性",
};

export type ZhStatBonusMap = Partial<Record<ZhPlayerStatBonusKey, number>>;

// ---------------------------------------------------------------------------
// 常量 · 境界 · 十维属性
// ---------------------------------------------------------------------------

/** 佩戴栏槽位数（武器 / 法器 / 防具），与 `EquippedSlotsState` 一致 */
export const EQUIP_SLOT_COUNT = 3;

/** 功法栏格数（如 2×4），与 `GongfaSlotsState` 长度一致 */
export const GONGFA_SLOT_COUNT = 8;

/** 十维属性（键集与 `PlayerStatBonusKey` / `PLAYER_STAT_BONUS_KEYS` 一致） */
export type PlayerBaseStats = Record<PlayerStatBonusKey, number>;

/** 境界：大境界 + 小境界 */
export interface CultivationRealm {
  major: string;
  minor: string;
}

// ---------------------------------------------------------------------------
// 槽位状态（佩戴 / 功法 / 储物袋 — 物品形态与 itemInfo 一致）
// ---------------------------------------------------------------------------

/**
 * 三佩戴槽：各槽位仅接受对应 `itemInfo` 装备分支；空位为 `null`。
 * （与 `WearableItemDefinition` 三支一一对应，按槽位收窄类型。）
 */
export interface EquippedSlotsState {
  weapon: WeaponItemDefinition | null;
  faqi: FaqiItemDefinition | null;
  armor: ArmorItemDefinition | null;
}

type Tuple8<T> = [T, T, T, T, T, T, T, T];

/** 功法栏单格；空位为 `null`（长度恒为 `GONGFA_SLOT_COUNT`） */
type GongfaSlotCell = GongfaItemDefinition | null;

export type GongfaSlotsState = Tuple8<GongfaSlotCell>;

// ---------------------------------------------------------------------------
// 词条（叙事）
// ---------------------------------------------------------------------------

/** 天赋 / 词条：剧情与 NPC 可能为字符串或结构化对象 */
export type TraitEntry =
  | string
  | {
      name: string;
      desc: string;
      rarity: string;
      locked: boolean;
    };

// ---------------------------------------------------------------------------
// 角色卡
// ---------------------------------------------------------------------------

/**
 * 主角档案主体：境界、属性、槽位等。
 * 不含 `isVisible` / `isDead` / `favorability`（这些仅用于周围人物卡）。
 */
export interface CharacterPlayInfoCommon {
  id: string;
  displayName: string;
  realm: CultivationRealm;
  playerBase: PlayerBaseStats;
  maxHp: number;
  maxMp: number;
  currentHp: number;
  currentMp: number;
  avatarUrl: string;
  gender: string;
  linggen: string[];
  age: number;
  shouyuan: number;
  /** 储物袋：每格 `InventoryStackItem | null`，与 `itemInfo` 联合一致 */
  inventorySlots: Array<InventoryStackItem | null>;
  gongfaSlots: GongfaSlotsState;
  equippedSlots: EquippedSlotsState;
}

/** 主角档案（`role` 固定为 `protagonist`） */
export interface ProtagonistPlayInfo extends CharacterPlayInfoCommon {
  role: "protagonist";
  /** 剧情叙事人称（命运抉择）；缺档旧存档解析时默认为第二人称 */
  narrationPerson: NarrationPerson;
  /** 命运抉择：出生地 / 出身地点 */
  birthPlace: string;
  /**
   * 命运抉择：出身叙述（预设卡片合并文案或自定义背景长文）。
   * 旧存档可无此字段，解析时回退空串。
   */
  originStory: string;
  traits: TraitEntry[];
  xiuwei: number;
}

// ---------------------------------------------------------------------------
// 自 itemInfo 再导出（模块顺序与 itemInfo.ts 一致）
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// UI 详情弹窗动作类型（原 protagonistDetailPayload.ts / protagonistPanelDisplay.ts）
// ---------------------------------------------------------------------------

export type EquipSlotKey = "weapon" | "faqi" | "armor";

export type ProtagonistDetailAction =
  | { id: "unequipWear"; equipSlot: EquipSlotKey }
  | { id: "unequipGongfa"; gongfaIndex: number }
  | { id: "equipWearFromBag"; inventoryIndex: number }
  | { id: "equipGongfaFromBag"; inventoryIndex: number };

export type {
  WearableItemDefinition,
  WeaponItemDefinition,
  FaqiItemDefinition,
  ArmorItemDefinition,
  AttackGongfaDefinition,
  AssistGongfaDefinition,
  GongfaItemDefinition,
  ElixirItemDefinition,
  BreakthroughElixirDefinition,
  PillItemDefinition,
  MaterialItemDefinition,
  MiscItemDefinition,
  CategorizedItemDefinition,
  SpiritStoneInventoryStack,
  WeaponBagStack,
  FaqiBagStack,
  ArmorBagStack,
  AttackGongfaBagStack,
  AssistGongfaBagStack,
  ElixirBagStack,
  BreakthroughElixirBagStack,
  MaterialBagStack,
  MiscBagStack,
  InventoryStackItem,
} from "./itemInfo";
