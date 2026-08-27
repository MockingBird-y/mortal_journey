/**
 * 逆天改命随机词条池。
 *
 * 每条天赋 = 名称 + 描述 + 具体效果（{@link TraitEffect}）。
 * 效果分六类：灵石 / 材料 / 丹药 / 主属性加成 / 法宝 / 功法。
 * 天赋稀有度与物品品阶一一对应（见 {@link TRAIT_RARITY_TO_GRADE}），
 * 不同稀有度对应不同的数值量级与品阶。
 *
 * 主属性加成：每个稀有度下 8 个主属性各有专属单属性天赋（共 48 条），
 * 由 {@link defineStatTraits} 按命名表 + 量级表批量生成。
 *
 * 效果的解析与展示文案见 `./traitEffect.ts`。
 */

import type { TraitEffect, TraitEffectSpec } from "./traitEffect";
import type { ItemGrade } from "../role_core/types/itemInfo";
import type { PrimaryStatKey } from "../role_core/types/playInfo";
import { PRIMARY_STAT_KEYS } from "../role_core/types/playInfo";

/** 词条稀有度。 */
export type TraitRarity = "平庸" | "普通" | "稀有" | "史诗" | "传说" | "神迹";

/** 天赋类别键；即 {@link TRAIT_CATEGORIES} 的键。 */
export type TraitCategory = string;

/**
 * 天赋类别表：键为类别标识，值为购点界面上小板块的标题。
 * **表内顺序 = 界面上板块从上到下的排列顺序**，空板块（一条词条都没归入）不会渲染。
 *
 * 加一个新板块只需三步：
 *   1. 在本表加一行 `<新键>: "板块标题"`，位置决定它出现在第几块；
 *   2. 在词条行上写 `category: "<新键>"`（见文件末尾的 {@link traitSamplesExample}）；
 *   3. 若这批词条要用新的稀有度，去 {@link TRAIT_RARITY_COST} 补单价——
 *      **点数消耗只看稀有度，不看类别**。
 *
 * 前 8 个键沿用 `PrimaryStatKey`：{@link defineStatTraits} 生成的单属性加成天赋
 * 会自动把自己的主属性键当作类别，所以不用手写。
 * 没写 `category` 的词条一律落到 {@link DEFAULT_TRAIT_CATEGORY}。
 */
export const TRAIT_CATEGORIES: Readonly<Record<TraitCategory, string>> = {
  physique: "体魄",
  spirit: "灵力",
  strength: "劲力",
  perception: "神识",
  guard: "护体",
  resistance: "灵御",
  agility: "身法",
  insight: "悟性",
  fortune: "机缘",
  spiritStone:"灵石",
  materials: "材料",
  gongfa: "功法",
  elixir:"丹药",
  treasure:"法宝",
  special:"特殊",
  // ↓ 占位板块示例，词条见文件末尾的 traitSamplesExample；不需要时连同那段一起删掉。
  example: "占位板块",
};

/** 未标注类别的词条归入的兜底类别。 */
const DEFAULT_TRAIT_CATEGORY: TraitCategory = "fortune";

/**
 * 购点开局：各稀有度天赋的点数单价（占位数值，按需自行调整）。
 */
export const TRAIT_RARITY_COST: Readonly<Record<TraitRarity, number>> = {
  平庸: 5,
  普通: 10,
  稀有: 20,
  史诗: 35,
  传说: 50,
  神迹: 80,
};

/** 单条天赋样本：名称、稀有度、类别、描述、具体效果。 */
export interface TraitSample {
  name: string;
  rarity: TraitRarity;
  category: TraitCategory;
  desc: string;
  /** 单个效果，或多个不同 kind 的效果数组（逐条独立结算）。 */
  effect: TraitEffectSpec;
}

/**
 * 合并为 {@link TraitSample} 时使用的行数据（不含 `rarity`，由分组函数注入）。
 * `category` 缺省时落到 {@link DEFAULT_TRAIT_CATEGORY}。
 */
type TraitRow = Pick<TraitSample, "name" | "desc" | "effect"> & { category?: TraitCategory };

/**
 * 为同一稀有度下的多行批量补上 `rarity` 与缺省 `category` 字段。
 *
 * @param rarity 该组词条的稀有度。
 * @param rows 仅含名称、描述、效果（及可选类别）的行列表。
 * @return 只读的 {@link TraitSample} 列表。
 */
function defineTraits(rarity: TraitRarity, rows: readonly TraitRow[]): readonly TraitSample[] {
  return rows.map((row) => ({
    name: row.name,
    desc: row.desc,
    effect: row.effect,
    category: row.category ?? DEFAULT_TRAIT_CATEGORY,
    rarity,
  }));
}

// ---------------------------------------------------------------------------
// 稀有度 → 物品品阶 映射（一一对应；天赋设计时的参考，解析器不依赖此表）
// ---------------------------------------------------------------------------

/** 天赋稀有度到物品品阶的固定映射。 */
export const TRAIT_RARITY_TO_GRADE: Readonly<Record<TraitRarity, ItemGrade>> = {
  平庸: "下品",
  普通: "中品",
  稀有: "上品",
  史诗: "极品",
  传说: "仙品",
  神迹: "神品",
};

// ---------------------------------------------------------------------------
// 主属性加成天赋：8 主属性 × 6 稀有度 = 48 条，按表批量生成
// ---------------------------------------------------------------------------

/**
 * 主属性天赋命名表：每个主属性一行，6 个名字依次对应 平庸→神迹。
 * 名字随稀有度递进，体现量级跃升。
 */

const STAT_TRAIT_NAMES: Readonly<Record<PrimaryStatKey, readonly string[]>> = {
  physique:   ["皮糙肉厚", "筋骨强健", "铜皮铁骨", "金刚之躯", "不灭宝体", "不朽金身"],
  spirit:     ["灵气微薄", "灵台初开", "灵根深厚", "法力浑厚", "灵台通明", "灵力无穷"],
  strength:   ["天生蛮力", "臂力过人", "力能扛鼎", "霸王之力", "摧山劲力", "擎天巨力"],
  perception: ["六识敏锐", "神识初成", "洞察秋毫", "神识广博", "神识通天", "洞明万物"],
  guard:      ["皮韧肉实", "护体有成", "护体真气", "护体罡气", "护体神光", "万法难伤"],
  resistance: ["略有灵御", "灵御初成", "御灵有道", "御法精深", "万法辟易", "诸邪不侵"],
  agility:    ["腿脚利索", "身法矫健", "动若脱兔", "身轻如燕", "疾如闪电", "瞬息千里"],
  insight:    ["略有慧根", "心思通透", "悟性颇高", "悟性超凡", "悟性逆天", "天纵奇才"],
};


/**
 * 主属性天赋风味描述表：每个主属性一行，6 段描述依次对应 平庸→神迹，
 * 随稀有度递进体现量级跃升。
 */

const STAT_TRAIT_FLAVOR: Readonly<Record<PrimaryStatKey, readonly string[]>> = {
  physique: [
    "自幼干惯粗活，皮肉比寻常人厚实几分，挨打也不太怕疼。",
    "天生筋骨强健，体魄胜过常人，寻常刀剑难伤分毫。",
    "修炼得法，练就一身铜皮铁骨，体魄浑厚远胜同侪。",
    "根骨奇佳，体若金刚不坏，刀枪不入、万法难侵。",
    "修成不灭宝体，体魄臻至化境，纵受重创亦能迅疾复原。",
    "铸就不朽金身，肉身近乎不朽，体魄之强举世无双。",
  ],
  spirit: [
    "丹田中灵气虽薄，却比寻常人充盈些许，根基尚可。",
    "灵台初开，灵力渐丰，法力绵长胜过同辈。",
    "灵根深厚，灵力浑厚充沛，施展法术游刃有余。",
    "法力浑厚如渊，绵绵不绝，纵连番施法亦不虞枯竭。",
    "灵台通明，灵力臻至化境，法力之深深不可测。",
    "灵力与天地相融，法力绵绵无穷、用之不竭。",
  ],
  strength: [
    "生来膀大腰圆，力气比寻常人大上几分。",
    "膂力过人，一拳能碎石裂木，劲力胜过常人。",
    "力能扛鼎，劲力雄浑，举手投足皆有千钧之势。",
    "身怀霸王之力，劲力霸悍无双，一拳击山裂石。",
    "劲力臻至化境，一拳之威可摧山岳、裂大地。",
    "拥有擎天之巨力，一拳可碎虚空、力能擎天。",
  ],
  perception: [
    "六识比常人敏锐几分，耳聪目明，少有疏漏。",
    "神识初成，能察觉周遭细微动静，胜过凡俗。",
    "神识广博，洞察秋毫，幻阵禁制之破绽无所遁形。",
    "神识广博无垠，方圆百里动静尽在掌握。",
    "神识通天彻地，纵隔千里亦能洞悉纤毫。",
    "神识洞明万物，天地间一切无所遁形。",
  ],
  guard: [
    "皮肉坚韧，比常人更能扛得住几下捶打。",
    "护体真气初成，刀剑加身亦能卸去几分力道。",
    "护体真气浑厚，寻常攻伐难以伤及根本。",
    "护体罡气护身，劲力难透、刀剑难破。",
    "护体神光流转周身，万法难侵、坚不可摧。",
    "护体之能臻至化境，肉身万法难伤、近乎不灭。",
  ],
  resistance: [
    "灵台略有灵韵，对法术侵蚀有几分天然抗性。",
    "灵御之能初成，能抵御寻常法术的侵扰。",
    "御灵有道，法术加身亦能化解大半。",
    "御法精深，纵是高阶法术亦难伤分毫。",
    "灵御臻至化境，万法辟易、邪祟难近。",
    "灵御通神，诸邪不侵、万法难侵。",
  ],
  agility: [
    "自小跑惯山路，腿脚比旁人灵快些许。",
    "身法矫健，进退自如，胜过寻常武人。",
    "动若脱兔，身形灵活，攻守之间占尽先机。",
    "身轻如燕，纵跃如飞，寻常手段难以触及。",
    "身法快如闪电，动若鬼魅，敌未及觉已然制敌。",
    "身法通神，瞬息千里、来去无踪。",
  ],
  insight: [
    "心思还算通透，学东西比旁人快上几分。",
    "心思通透，举一反三，悟性胜过同辈。",
    "悟性颇高，功法一通百通，修行事半功倍。",
    "悟性超凡脱俗，艰深功法亦可举重若轻。",
    "悟性逆天，纵是上古残卷亦能触类旁通。",
    "天纵奇才，一念通明、万法自悟。",
  ],
};

/**
 * 各稀有度下单属性加成的固定数值（平庸~神迹），取固定值、不做范围内随机。
 * 身法、悟性在 {@link defineStatTraits} 中自动取此值的一半。
 */
const STAT_VALUE_BY_RARITY: readonly number[] = [10, 20, 30, 40, 70, 100];

/** 主属性天赋生成所用的稀有度顺序（与 {@link STAT_VALUE_BY_RARITY} 索引对齐）。 */
const TRAIT_RARITY_ORDER_STAT: readonly TraitRarity[] = [
  "平庸",
  "普通",
  "稀有",
  "史诗",
  "传说",
  "神迹",
];

/**
 * 为指定稀有度生成 8 条单属性加成天赋行（每个主属性一条）。
 *
 * @param rarity 稀有度。
 * @return 8 条 {@link TraitRow}（不含 `rarity`，交由 {@link defineTraits} 注入）。
 */
function defineStatTraits(rarity: TraitRarity): readonly TraitRow[] {
  const idx = TRAIT_RARITY_ORDER_STAT.indexOf(rarity);
  const value = STAT_VALUE_BY_RARITY[idx];
  return PRIMARY_STAT_KEYS.map((key) => {
    const stats: Partial<Record<PrimaryStatKey, number>> = {};
    // 身法、悟性加成减半（量级低于其它主属性）
    const v = (key === "agility" || key === "insight") ? Math.floor(value / 2) : value;
    stats[key] = v;
    return {
      name: STAT_TRAIT_NAMES[key][idx],
      desc: STAT_TRAIT_FLAVOR[key][idx],
      category: key,
      effect: { kind: "statBonus", stats } as TraitEffect,
    };
  });
}

// ===========================================================================
// 天赋词条池
// 各稀有度：8 单属性加成 + 灵石/材料/丹药(不同效果)/法宝/功法(不同体系)
// ===========================================================================

/** 平庸词条池（对应「下品」量级）。 */
export const traitSamplesPingyong = defineTraits("平庸", [
  { name: "囊中羞涩", category:"spiritStone",desc: "出身清贫，随身仅有几十颗灵石，聊作盘缠。", effect: { kind: "spiritStones", count: 20 } },
  { name: "意外之财", category:"spiritStone",desc: "行路时捡得一只旧钱袋，倒出几十颗灵石。", effect: { kind: "spiritStones", count: 80 } },
  { name: "采药童子", category:"materials",desc: "自幼随长辈进山采药，识得几味下品灵草。", effect: { kind: "materials", category: "药材", grade: "下品", count: 9 } },
  { name: "杂毒小囊", category:"materials",desc: "随身带着一只小布囊，装有几份山野采来的下品毒物草石。", effect: { kind: "materials", category: "毒物", grade: "下品", count: 9 } },
  { name: "粗铁碎石", category:"materials",desc: "行囊里收纳着几块下品矿石与旧料，勉强可充作锻造器材。", effect: { kind: "materials", category: "器材", grade: "下品", count: 9 } },
  { name: "野味干粮", category:"materials",desc: "包裹里备有几份初阶灵谷与干制野味，可供果腹烹饪。", effect: { kind: "materials", category: "食材", grade: "下品", count: 9 } },
  { name: "伤药一瓶", category:"elixir",desc: "怀中常备一瓶粗制的伤药，危急时可救急。", effect: { kind: "elixir", grade: "下品", count: 1, effectType: "恢复血量" } },
  { name: "凝气散方", category:"elixir",desc: "得来一散低阶丹方，服之可稍聚灵气。", effect: { kind: "elixir", grade: "下品", count: 1, effectType: "恢复法力" } },
  { name: "乡野把式", category:"gongfa",desc: "跟乡间老叟学过几手粗浅的通用吐纳法门。", effect: { kind: "gongfa", system: "通用", grade: "下品" } },
  { name: "打熬筋骨", category:"gongfa",desc: "年少时打熬过筋骨，习得一套外门体修把式。", effect: { kind: "gongfa", system: "体修", grade: "下品" } },
  { name: "剑道启蒙", category:"gongfa",desc: "年少时曾观摩剑客比斗，偷学了凡手基础剑招。", effect: { kind: "gongfa", system: "剑修", grade: "下品" } },
  { name: "灵气感应", category:"gongfa",desc: "天生对灵气有些感应，学过几手粗浅的法术。", effect: { kind: "gongfa", system: "法修", grade: "下品" } },
  { name: "蛇虫为伴", category:"gongfa",desc: "自幼与蛇虫为伴，懂得几手粗浅的下毒手法。", effect: { kind: "gongfa", system: "毒修", grade: "下品" } },
  { name: "采药学徒", category:"gongfa",desc: "曾在药铺做过学徒，识得几味疗伤灵药。", effect: { kind: "gongfa", system: "药修", grade: "下品" } },
  { name: "邪典残页", category:"gongfa",desc: "无意间拾得一张邪典残页，上面记载着以血催力的法门。", effect: { kind: "gongfa", system: "魔修", grade: "下品" } },
  ...defineStatTraits("平庸"),
]);

/** 普通词条池（对应「中品」量级）。 */
export const traitSamplesPutong = defineTraits("普通", [
  { name: "小有积蓄", category:"spiritStone",desc: "多年攒下些许身家，随身带有数百灵石。", effect: { kind: "spiritStones", count: 50 } },
  { name: "药田收成", category:"materials",desc: "家中有一小片灵药田，此番收成几份中品灵草。", effect: { kind: "materials", category: "药材", grade: "中品", count: 6 } },
  { name: "百毒囊袋", category:"materials",desc: "自密林深处收集到几份中品毒液与毒虫残蜕，毒性渐显。", effect: { kind: "materials", category: "毒物", grade: "中品", count: 6 } },
  { name: "精铁矿材", category:"materials",desc: "偶得几块中品百炼精铁与灵木干料，可用于打造趁手器物。", effect: { kind: "materials", category: "器材", grade: "中品", count: 6 } },
  { name: "灵谷鲜蔬", category:"materials",desc: "随身备有几份沾染了地脉灵气的中品食材，烹饪滋味颇佳。", effect: { kind: "materials", category: "食材", grade: "中品", count: 6 } },
  { name: "筑基丹方", category:"elixir",desc: "偶得一份筑基丹方，服之可助凝练真元、增进修为。", effect: { kind: "elixir", grade: "中品", count: 1, effectType: "提升修为" } },
  { name: "锻体秘方", category:"elixir",desc: "得传一份锻体丹方，服之可强筋健骨、增长体魄。", effect: { kind: "elixir", grade: "中品", count: 1, effectType: "提升体魄" } },
  { name: "通灵丹方", category:"elixir",desc: "手握一份通灵丹方，服之可通达灵台、增益灵力。", effect: { kind: "elixir", grade: "中品", count: 1, effectType: "提升灵力" } },
  { name: "家传法器", category:"treasure",desc: "祖上传下一件中品法器，虽不甚出众，却胜在顺手。", effect: { kind: "treasure", grade: "中品" } },
  { name: "入门剑诀", category:"gongfa",desc: "曾拜师学过一套入门剑诀，剑修之路初窥门径。", effect: { kind: "gongfa", system: "剑修", grade: "中品" } },
  { name: "御气初阶", category:"gongfa",desc: "得传一门中阶御气法门，法修根基渐成。", effect: { kind: "gongfa", system: "法修", grade: "中品" } },
  { name: "药道入门", category:"gongfa",desc: "曾随一位游方药师学过几年制药炼丹之道。", effect: { kind: "gongfa", system: "药修", grade: "中品" } },
  { name: "锻体入门", category:"gongfa",desc: "得传一套中阶锻体法门，筋骨愈发坚实。", effect: { kind: "gongfa", system: "体修", grade: "中品" } },
  { name: "蛊毒初识", category:"gongfa",desc: "偶遇南疆蛊师，学得几手施毒法门。", effect: { kind: "gongfa", system: "毒修", grade: "中品" } },
  { name: "魔气初染", category:"gongfa",desc: "在一处魔修遗迹中染得一丝魔气，悟得一门魔道法门。", effect: { kind: "gongfa", system: "魔修", grade: "中品" } },
  ...defineStatTraits("普通"),
]);

/** 稀有词条池（对应「上品」量级）。 */
export const traitSamplesXiyou = defineTraits("稀有", [
  { name: "灵石矿脉", category:"spiritStone",desc: "名下有一处小型灵石矿脉，变卖后得数百灵石。", effect: { kind: "spiritStones", count: 100 } },
  { name: "珍稀药草", category:"materials",desc: "机缘之下采得几份上品珍稀灵草，药香扑鼻。", effect: { kind: "materials", category: "药材", grade: "上品", count: 6 } },
  { name: "幽冥毒萃", category:"materials",desc: "在毒沼秘境中采得几份上品阴毒奇材，散发着森森寒意。", effect: { kind: "materials", category: "毒物", grade: "上品", count: 6 } },
  { name: "寒铁灵金", category:"materials",desc: "游历时寻得几份上品深海寒铁与星曜矿石，乃铸器良材。", effect: { kind: "materials", category: "器材", grade: "上品", count: 6 } },
  { name: "异兽珍馐", category:"materials",desc: "斩获并封存了几份上品妖兽里脊与灵芝仙笋，灵气醇厚。", effect: { kind: "materials", category: "食材", grade: "上品", count: 6 } },
  { name: "益寿丹方", category:"elixir",desc: "得一份上品益寿丹方，服之可延寿百年、固本培元。", effect: { kind: "elixir", grade: "上品", count: 1, effectType: "提升寿元" } },
  { name: "淬体秘药", category:"elixir",desc: "手中有一份上品淬体秘药，服之脱胎换骨、体魄大增。", effect: { kind: "elixir", grade: "上品", count: 1, effectType: "提升体魄" } },
  { name: "寻缘法器", category:"treasure",desc: "游历时寻得一件上品法器，灵光隐现，颇有不凡。", effect: { kind: "treasure", grade: "上品" } },
  { name: "剑意初成", category:"gongfa",desc: "于剑道颇有天赋，悟得一套上品剑诀，剑意初成。", effect: { kind: "gongfa", system: "剑修", grade: "上品" } },
  { name: "御气精进", category:"gongfa",desc: "法修一途精进神速，得一门上品御气秘术。", effect: { kind: "gongfa", system: "法修", grade: "上品" } },
  { name: "淬体有成", category:"gongfa",desc: "体修淬炼有成，习得一门上品体修秘法。", effect: { kind: "gongfa", system: "体修", grade: "上品" } },
  { name: "悬壶济世", category:"gongfa",desc: "得药道真传，习得一门上品药修秘术。", effect: { kind: "gongfa", system: "药修", grade: "上品" } },
  { name: "魔道初窥", category:"gongfa",desc: "偶得一本魔道残卷，习得一门上品魔修秘术。", effect: { kind: "gongfa", system: "魔修", grade: "上品" } },
  { name: "万蛊初成", category:"gongfa",desc: "得南疆蛊修真传，习得一门上品毒修秘术。", effect: { kind: "gongfa", system: "毒修", grade: "上品" } },
  ...defineStatTraits("稀有"),
]);

/** 史诗词条池（对应「极品」量级）。 */
export const traitSamplesShishi = defineTraits("史诗", [
  { name: "家底丰厚", category:"spiritStone",desc: "家底殷实，随身的储物袋中沉甸甸满是灵石。", effect: { kind: "spiritStones", count: 200 } },
  { name: "灵药满匣", category:"materials",desc: "怀揣一只满载极品灵药的药匣，药香四溢。", effect: { kind: "materials", category: "药材", grade: "极品", count: 3 } },
  { name: "九幽煞髓", category:"materials",desc: "怀揣一只封灵玉匣，内盛几份极品地煞奇毒，触之即溃经脉。", effect: { kind: "materials", category: "毒物", grade: "极品", count: 3 } },
  { name: "天外玄晶", category:"materials",desc: "机缘所得几块极品玄天精金与凤栖灵木，灵光流转不息。", effect: { kind: "materials", category: "器材", grade: "极品", count: 3 } },
  { name: "龙髓凤胶", category:"materials",desc: "珍藏着几份极品大妖精华与万年地乳，乃世间难寻的顶级食材。", effect: { kind: "materials", category: "食材", grade: "极品", count: 3 } },
  { name: "凝煞丹方", category:"elixir",desc: "得一份极品凝煞丹方，服之修为大涨、直指金丹。", effect: { kind: "elixir", grade: "极品", count: 1, effectType: "提升修为" } },
  { name: "明心秘药", category:"elixir",desc: "手中有一份极品明心丹方，服之灵台洞开、悟性暴涨。", effect: { kind: "elixir", grade: "极品", count: 1, effectType: "提升悟性" } },
  { name: "机缘法宝", category:"treasure",desc: "大机缘之下得了一件极品法宝，灵韵深远、威能不凡。", effect: { kind: "treasure", grade: "极品" } },
  { name: "剑道小成", category:"gongfa",desc: "剑道已臻小成，习得一门极品剑修秘术。", effect: { kind: "gongfa", system: "剑修", grade: "极品" } },
  { name: "法力精深", category:"gongfa",desc: "法修造诣精深，得一门极品法修秘术真传。", effect: { kind: "gongfa", system: "法修", grade: "极品" } },
  { name: "体修大成", category:"gongfa",desc: "体修淬炼大成，习得一门极品体修秘法。", effect: { kind: "gongfa", system: "体修", grade: "极品" } },
  { name: "魔力深修", category:"gongfa",desc: "魔道造诣精深，得一门极品魔修秘术真传。", effect: { kind: "gongfa", system: "魔修", grade: "极品" } },
  { name: "万毒噬心", category:"gongfa",desc: "得万毒谷真传，习得一门极品毒修秘术。", effect: { kind: "gongfa", system: "毒修", grade: "极品" } },
  { name: "丹道大成", category:"gongfa",desc: "丹道造诣大成，习得一门极品药修秘术。", effect: { kind: "gongfa", system: "药修", grade: "极品" } },
  ...defineStatTraits("史诗"),
]);

/** 传说词条池（对应「仙品」量级）。 */
export const traitSamplesChuanshuo = defineTraits("传说", [
  { name: "灵石宝库", category:"spiritStone",desc: "继承了一处上古灵石宝库，一夜之间富甲一方。", effect: { kind: "spiritStones", count: 500 } },
  { name: "仙草灵根", category:"materials",desc: "于秘境中采得几株仙品灵根，仙气氤氲不散。", effect: { kind: "materials", category: "药材", grade: "仙品", count: 3 } },
  { name: "黄泉仙蛊", category:"materials",desc: "自上古仙冢中起获几份仙品剧毒本源，仙人沾染亦生机涣散。", effect: { kind: "materials", category: "毒物", grade: "仙品", count: 3 } },
  { name: "九天仙金", category:"materials",desc: "继承了一处仙家矿藏，得几块仙品混元神铁与大罗仙金。", effect: { kind: "materials", category: "器材", grade: "仙品", count: 3 } },
  { name: "蟠桃玉髓", category:"materials",desc: "于仙山胜地摘得几份仙品灵根灵肉，烹之香飘九霄、灵光漫溢。", effect: { kind: "materials", category: "食材", grade: "仙品", count: 3 } },
  { name: "元婴丹方", category:"elixir",desc: "得一份仙品元婴丹方，服之一粒抵数十年苦修。", effect: { kind: "elixir", grade: "仙品", count: 1, effectType: "提升修为" } },
  { name: "松鹤秘药", category:"elixir",desc: "手中有一份仙品松鹤丹方，服之寿逾千载、松鹤延年。", effect: { kind: "elixir", grade: "仙品", count: 1, effectType: "提升寿元" } },
  { name: "仙家遗宝", category:"treasure",desc: "有缘得了一件仙家遗落的命名法宝，仙韵流转、威力惊人。", effect: { kind: "treasure", grade: "仙品" } },
  { name: "诛仙剑意", category:"gongfa",desc: "承上古诛仙剑仙一脉传承，悟得一门仙品剑诀。", effect: { kind: "gongfa", system: "剑修", grade: "仙品" } },
  { name: "万法归宗", category:"gongfa",desc: "得万法宗真传，习得一门仙品法修秘术。", effect: { kind: "gongfa", system: "法修", grade: "仙品" } },
  { name: "金刚不坏", category:"gongfa",desc: "承上古佛修力修传承，习得一门仙品体修秘法。", effect: { kind: "gongfa", system: "体修", grade: "仙品" } },
  { name: "天毒秘法", category:"gongfa",desc: "得南疆蛊祖真传，习得一门仙品毒修秘术。", effect: { kind: "gongfa", system: "毒修", grade: "仙品" } },
  { name: "药王传承", category:"gongfa",desc: "得上古药王真传，习得一门仙品药修秘术。", effect: { kind: "gongfa", system: "药修", grade: "仙品" } },
  { name: "天魔血祭", category:"gongfa",desc: "得上古天魔一脉传承，习得一门仙品魔修秘术。", effect: { kind: "gongfa", system: "魔修", grade: "仙品" } },
  ...defineStatTraits("传说"),
]);

/** 神迹词条池（对应「神品」量级）。 */
export const traitSamplesShenji = defineTraits("神迹", [
  { name: "富可敌国", category:"spiritStone",desc: "坐拥一处上古神石宝库，灵石之多富可敌国。", effect: { kind: "spiritStones", count: 1000 } },
  { name: "神材天降", category:"materials",desc: "天降一份神品天材，神韵流转、近乎不朽。", effect: { kind: "materials", category: "药材", grade: "神品", count: 3 } },
  { name: "寂灭神煞", category:"materials",desc: "天降几份孕育自混沌初开的神品寂灭毒源，道韵崩坏、无物不化。", effect: { kind: "materials", category: "毒物", grade: "神品", count: 3 } },
  { name: "鸿蒙神铁", category:"materials",desc: "手握几块太古神明开天遗留的神品神石精粹，可铸灭世神器。", effect: { kind: "materials", category: "器材", grade: "神品", count: 3 } },
  { name: "混沌道宴", category:"materials",desc: "坐拥几份神品天地母气灵肉与造化神果，食之如纳诸天道韵。", effect: { kind: "materials", category: "食材", grade: "神品", count: 3 } },
  { name: "造化神丹", category:"elixir",desc: "得一颗夺天地造化的神品神丹，一步登天、修为暴涨。", effect: { kind: "elixir", grade: "神品", count: 1, effectType: "提升修为" } },
  { name: "与天同寿", category:"elixir",desc: "手中有一颗神品与天同寿丹，服之寿元无穷、近乎不死。", effect: { kind: "elixir", grade: "神品", count: 1, effectType: "提升寿元" } },
  { name: "神界至宝", category:"treasure",desc: "有缘得了一件神界流传的命名至宝，神光万丈、举世无双。", effect: { kind: "treasure", grade: "神品" } },
  { name: "开天剑法", category:"gongfa",desc: "承太古开天剑祖一脉真传，习得一门神品剑诀。", effect: { kind: "gongfa", system: "剑修", grade: "神品" } },
  { name: "万法源流", category:"gongfa",desc: "得太古法祖真传，习得一门神品法修秘术。", effect: { kind: "gongfa", system: "法修", grade: "神品" } },
  { name: "不灭金身", category:"gongfa",desc: "承太古力祖真传，习得一门神品体修秘法，金身不灭。", effect: { kind: "gongfa", system: "体修", grade: "神品" } },
  { name: "天毒归宗", category:"gongfa",desc: "得太古毒祖真传，习得一门神品毒修秘术。", effect: { kind: "gongfa", system: "毒修", grade: "神品" } },
  { name: "天魔降世", category:"gongfa",desc: "得太古魔祖真传，习得一门神品魔修秘术。", effect: { kind: "gongfa", system: "魔修", grade: "神品" } },
  { name: "造化丹道", category:"gongfa",desc: "得太古药祖真传，习得一门神品药修秘术。", effect: { kind: "gongfa", system: "药修", grade: "神品" } },
  ...defineStatTraits("神迹"),
]);

// ===========================================================================
// 占位板块示例：如何新增一个横向小板块
// ===========================================================================

/**
 * 占位示例：一个自定义类别的词条组。
 *
 * 要点：
 *   - `category: "example"` 必须能在 {@link TRAIT_CATEGORIES} 里查到，
 *     否则这条词条会**从购点界面上彻底消失**（分组时被过滤掉）——这是最容易踩的坑。
 *   - 同一组里可以混不同稀有度；界面按 {@link TRAIT_RARITY_ORDER}（平庸→神迹）从左到右排。
 *   - 点数消耗取自 {@link TRAIT_RARITY_COST}[稀有度]，与类别无关。想让某档更贵/更便宜，
 *     改那张表；想让单条词条脱离稀有度定价，跟我说，加个逐条 `cost` 覆写是三行的事。
 *   - `name` 是购点界面的去重键与选中判定依据，**全表不可重名**。
 *   - `effect` 六选一：spiritStones / materials / elixir / statBonus / treasure / gongfa，
 *     字段形状见 `./traitEffect.ts` 的 `TraitEffect`。
 *
 * 不需要时把本段与 {@link TRAIT_CATEGORIES} 里的 `example` 行一起删掉即可。
 */

export const traitSamplesExample: readonly TraitSample[] = [
  ...defineTraits("史诗", [
    {
      name: "异瞳",
      category: "special",
      desc: "双眸生具异色，摄人心魄，引得旁人频频侧目。",
      effect: { kind: "roleplayBonus", charm:15,fame:-5 },
    },
  ]),
    ...defineTraits("史诗", [
    {
      name: "白发",
      category: "special",
      desc: "三千青丝化霜雪，风姿绝尘，亦易受世俗侧目排斥。",
      effect: {kind: "roleplayBonus", charm:30,fame:-10 },

    },
  ]),
  ...defineTraits("传说", [
    {
      name: "天生剑骨",
      category: "special",
      desc: "天生骨骼如剑胎铮鸣，灵气流转锐不可当",
      effect: {
        kind: "combatModifier",
        modifiers: [
          { type: "critRate", value: 20 },
          { type: "critDmg", value: 30 },
        ],
      },
    },
  ]),
  ...defineTraits("传说", [
    {
      name: "天煞孤星",
      category: "special",
      desc: "命格带煞注定孤苦，常引灾厄降临身侧之人。",
      effect: [
        {
        kind: "combatModifier",
        modifiers: [
          { type: "damageDealt", value: 30 },
        ],
      },
      {
        kind:"roleplayBonus",fame: -10
      },
    ]
    },
  ]),
  // ↓ 多效果示例：`effect` 写成数组即可挂多个不同 kind，逐条独立结算、互不影响。
  //   同 kind 也能重复出现（两条 statBonus 会累加）。单个效果仍可直接写对象，两种写法都支持。
  ...defineTraits("神迹", [
    {
      name: "占位·多效果示例",
      category: "",
      desc: "占位：同时给灵石、主属性、战斗修正与扮演属性的示例词条。",
      effect: [
        { kind: "spiritStones", count: 500 },
        { kind: "statBonus", stats: { insight: 30, perception: 20 } },
        { kind: "combatModifier", modifiers: [{ type: "critRate", value: 10 }] },
        { kind: "roleplayBonus", charm: 10, fame: 10 },
      ],
    },
  ]),

];

// ---------------------------------------------------------------------------
// 稀有度展示与合并顺序（从低到高）
// ---------------------------------------------------------------------------

/** 稀有度展示与合并顺序（从低到高）。 */
export const TRAIT_RARITY_ORDER: readonly TraitRarity[] = TRAIT_RARITY_ORDER_STAT;

/** 按稀有度索引的只读映射，便于按档筛选或权重抽样。 */
export const traitsByRarity: Record<TraitRarity, readonly TraitSample[]> = {
  平庸: traitSamplesPingyong,
  普通: traitSamplesPutong,
  稀有: traitSamplesXiyou,
  史诗: traitSamplesShishi,
  传说: traitSamplesChuanshuo,
  神迹: traitSamplesShenji,
};

/**
 * 全量词条池：按 {@link TRAIT_RARITY_ORDER} 拼接各档。
 */
/**
 * 自定义类别的附加词条组。新写一整组词条（如 {@link traitSamplesExample}）后
 * 把它加进这个数组，就会自动并入 {@link traitSamples}、随机抽取池与购点界面。
 *
 * 按稀有度组织的六个主池走 {@link traitsByRarity}，不必在这里重复登记。
 */
const EXTRA_TRAIT_GROUPS: readonly (readonly TraitSample[])[] = [traitSamplesExample];

export const traitSamples: readonly TraitSample[] = [
  ...TRAIT_RARITY_ORDER.flatMap((r) => [...traitsByRarity[r]]),
  ...EXTRA_TRAIT_GROUPS.flat(),
];

/** 购点界面上的一个类别小板块。 */
export interface TraitCategoryGroup {
  key: TraitCategory;
  title: string;
  traits: readonly TraitSample[];
}

/**
 * 按 {@link TRAIT_CATEGORIES} 的键顺序分组的词条池，供购点界面逐块渲染。
 * 组内按稀有度从低到高排（不依赖词条在源文件里的书写顺序）；空类别不出现。
 *
 * 注意：`category` 不在 {@link TRAIT_CATEGORIES} 里的词条不会归入任何一组，
 * 也就不会出现在购点界面上——新加类别时别忘了先登记键。
 */
export const traitsByCategory: readonly TraitCategoryGroup[] = Object.keys(TRAIT_CATEGORIES)
  .map((key) => ({
    key,
    title: TRAIT_CATEGORIES[key]!,
    traits: traitSamples
      .filter((t) => t.category === key)
      .sort((a, b) => TRAIT_RARITY_ORDER.indexOf(a.rarity) - TRAIT_RARITY_ORDER.indexOf(b.rarity)),
  }))
  .filter((g) => g.traits.length > 0);

/**
 * 与主工程 `global.MjTraitSamples` 同构的只读别名，便于对照旧脚本命名。
 */
export const MjTraitSamples = traitSamples;
