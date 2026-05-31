/**
 * 功法：物品定义 + 特殊效果（名称 + 效果组件 + 类型）。
 * 功法的 function 由系统根据体系（system）和品阶从效果目录中随机分配，不由 AI 生成。
 * 体系由 AI 输出，代码校验后用于效果池选取。
 */

import type { ItemBonusMap, ItemGrade } from "./itemInfo";
import type { EffectComponent } from "./combatMechanics";
import { GONGFA_MP_COST_BY_GRADE } from "./gameConstants";

// ═══════════════════════════════════════════════════════════════════════════
// 功法体系
// ═══════════════════════════════════════════════════════════════════════════

export const GONGFA_SYSTEM_KEYS = [
  "剑系",
  "体修",
  "法修",
  "刺客系",
  "毒系",
  "魔修",
  "火系",
  "雷系",
  "冰系",
  "暗系",
  "风系",
  "木系",
] as const;
export type GongfaSystem = (typeof GONGFA_SYSTEM_KEYS)[number];


// ═══════════════════════════════════════════════════════════════════════════
// 特殊效果
// ═══════════════════════════════════════════════════════════════════════════

export type GongfaEffectType = "主动" | "被动";

export type GongfaRole = "攻击" | "辅助";

export interface GongfaSpecialEffect {
  name: string;
  components: readonly EffectComponent[];
  type: GongfaEffectType;
  mpCost?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 效果目录（按体系 × 品阶，每品阶5个效果：3主动 + 2被动）
// ═══════════════════════════════════════════════════════════════════════════

const GRADE_ORDER: readonly ItemGrade[] = ["下品", "中品", "上品", "极品", "仙品", "神品"];

const GRADE_EFFECT_ROLL_WEIGHTS: Readonly<Record<ItemGrade, readonly number[]>> = {
  "下品": [100],
  "中品": [75, 25],
  "上品": [50, 30, 20],
  "极品": [40, 30, 18, 12],
  "仙品": [35, 26, 18, 12, 9],
  "神品": [30, 24, 18, 13, 9, 6],
};

export const GONGFA_EFFECT_CATALOG: Readonly<Record<GongfaSystem, Readonly<Record<ItemGrade, readonly GongfaSpecialEffect[]>>>> = {

  // ── 剑系 ──────────────────────────────────────────────────────────────
  // 核心：召唤飞剑自动攻击，物攻/暴击/暴击伤害
  "剑系": {
    "下品": [
      { name: "飞剑召唤", components: [{ mechanic: "summon", trigger: "active", desc: "召唤1把飞剑，每回合自动攻击造成{n}点物伤" }], type: "主动" },
      { name: "剑气斩", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "释放剑气造成{n}点物伤" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%防御" }], type: "主动" },
      { name: "御剑突刺", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "buff_crit", trigger: "active", desc: "暴击率提高{p}%" }], type: "主动" },
      { name: "剑心初悟", components: [{ status: "sword_intent", trigger: "on_attack", desc: "每次攻击叠加剑意" }, { mechanic: "buff_ramp", trigger: "passive", desc: "每层提升{p}%暴击伤害" }], type: "被动" },
      { name: "飞剑共鸣", components: [{ mechanic: "buff_crit", trigger: "passive", condition: "飞剑数量越多", desc: "暴击率提高{p}%" }], type: "被动" },
    ],
    "中品": [
      { name: "追魂剑", components: [{ mechanic: "dmg_execute", trigger: "active", condition: "优先攻击低血量敌人", desc: "造成{n}点物伤" }], type: "主动" },
      { name: "剑阵", components: [{ mechanic: "summon", trigger: "active", desc: "召唤3柄飞剑每回合随机攻击造成{n}点物伤" }], type: "主动" },
      { name: "连环剑", components: [{ mechanic: "extra_action", trigger: "active", desc: "连续攻击两次，每次造成{n}点物伤" }], type: "主动" },
      { name: "剑意凝聚", components: [{ status: "sword_intent", trigger: "on_crit", desc: "暴击获得剑意" }, { mechanic: "buff_ramp", trigger: "passive", desc: "每层提升{p}%暴击伤害，每10层获得1柄飞剑" }], type: "被动" },
      { name: "锋芒", components: [{ mechanic: "buff_crit_dmg", trigger: "passive", desc: "飞剑攻击的暴击伤害提高{p}%" }], type: "被动" },
    ],
    "上品": [
      { name: "万剑诀", components: [{ mechanic: "dmg_single", trigger: "active", desc: "发射所有飞剑攻击目标，每柄飞剑造成{n}点物伤" }], type: "主动" },
      { name: "回旋剑", components: [{ mechanic: "extra_action", trigger: "active", desc: "飞剑攻击后有{p}%概率返回再攻击一次" }], type: "主动" },
      { name: "剑意斩", components: [{ mechanic: "dmg_single", trigger: "active", condition: "消耗全部剑意", desc: "造成{n}点物伤，剑意越多伤害越高" }], type: "主动" },
      { name: "百步飞剑", components: [{ mechanic: "dmg_pierce", trigger: "on_attack", desc: "飞剑攻击附带穿透造成{n}点物伤" }], type: "被动" },
      { name: "剑意如虹", components: [{ mechanic: "buff_ramp", trigger: "passive", condition: "剑意叠满时", desc: "下一次飞剑攻击暴击伤害提高{p}%" }], type: "被动" },
    ],
    "极品": [
      { name: "斩天拔剑术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "蓄力一回合，下回合造成{n}点单体物伤" }], type: "主动" },
      { name: "万剑归宗", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "所有飞剑同时对全体敌人发动攻击，造成{n}点物伤" }], type: "主动" },
      { name: "天地剑气", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点剑气伤害，每把飞剑追加一道剑气" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%防御" }], type: "主动" },
      { name: "千机剑匣", components: [{ mechanic: "summon", trigger: "on_battle_start", desc: "战斗开始自动召唤{n}把飞剑" }], type: "被动" },
      { name: "剑域", components: [{ mechanic: "extra_action", trigger: "on_turn_start", condition: "领域内每把飞剑", desc: "每回合有{p}%概率额外攻击一次" }], type: "被动" },
    ],
    "仙品": [
      { name: "诛仙剑", components: [{ mechanic: "dmg_execute", trigger: "active", desc: "所有飞剑集中攻击一个目标，造成{n}点物伤，有概率斩杀低血量敌人" }], type: "主动" },
      { name: "剑道化身", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "释放剑气穿透一列敌人，造成{n}点物伤，每把飞剑额外追加一次穿透" }], type: "主动" },
      { name: "天剑", components: [{ mechanic: "dmg_single", trigger: "active", desc: "对单体造成{n}点毁灭性物伤，暴击必定命中" }], type: "主动" },
      { name: "剑意通明", components: [{ mechanic: "buff_crit", trigger: "passive", desc: "飞剑攻击暴击率提高{p}%" }], type: "被动" },
      { name: "无剑之境", components: [{ mechanic: "dmg_single", trigger: "passive", desc: "无需飞剑也能造成{n}点等量剑气伤害" }], type: "被动" },
    ],
    "神品": [
      { name: "诛仙剑阵", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "全体飞剑连续攻击，每柄飞剑造成{n}点物伤" }], type: "主动" },
      { name: "天人合一", components: [{ mechanic: "dmg_pierce", trigger: "active", condition: "消耗全部剑意", desc: "对单体造成{n}点毁灭性物伤" }, { mechanic: "debuff_def", trigger: "active", condition: "消耗全部剑意", desc: "无视{p}%防御" }], type: "主动" },
      { name: "万剑朝宗", components: [{ mechanic: "dmg_aoe", trigger: "active", condition: "飞剑数量越多伤害越高", desc: "对全体敌人造成{n}点物伤" }], type: "主动" },
      { name: "剑心", components: [{ mechanic: "buff_crit_dmg", trigger: "passive", desc: "修炼剑系功法，暴击伤害永久提高{p}%" }], type: "被动" },
      { name: "剑道真解", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "所有剑系技能效果提升{p}%，飞剑数量上限提高" }], type: "被动" },
    ],
  },

  // ── 体修 ──────────────────────────────────────────────────────────────
  // 核心：高额血量/防御，被动反伤，替队友承伤，攻击获取护盾/防御
  "体修": {
    "下品": [
      { name: "震脉击", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "buff_def", trigger: "active", desc: "攻击后提高{p}%物防" }], type: "主动" },
      { name: "铁膝撞", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "buff_shield", trigger: "active", desc: "获取{n}点护盾" }], type: "主动" },
      { name: "崩山拳", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤，概率吸引敌人攻击自己" }], type: "主动" },
      { name: "铁骨", components: [{ mechanic: "buff_def", trigger: "passive", desc: "永久提高{n}点物防和法防" }], type: "被动" },
      { name: "护脉", components: [{ mechanic: "buff_shield", trigger: "on_turn_start", desc: "每回合自动获得{n}点护盾" }], type: "被动" },
    ],
    "中品": [
      { name: "霸体冲撞", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤并击退目标" }, { mechanic: "buff_shield", trigger: "active", desc: "自身获得{n}点护盾" }], type: "主动" },
      { name: "血燃拳", components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "buff_def", trigger: "active", desc: "攻击后获取{p}%物防法防" }], type: "主动" },
      { name: "裂地击", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤，吸引全体敌人攻击自己一回合" }], type: "主动" },
      { name: "铁壁", components: [{ mechanic: "buff_shield", trigger: "on_fatal", desc: "受到致命伤时获得{n}点护盾" }], type: "被动" },
      { name: "反震体", components: [{ mechanic: "reflect", trigger: "on_hit", condition: "近身攻击", desc: "受到近身攻击时反弹{p}%伤害" }], type: "被动" },
    ],
    "上品": [
      { name: "山岳投", components: [{ mechanic: "dmg_single", trigger: "active", condition: "根据自身护盾值", desc: "造成{n}点物伤并附加额外伤害" }], type: "主动" },
      { name: "不动明王拳", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "damage_share", trigger: "active", desc: "数回合内替队友承受{p}%伤害" }], type: "主动" },
      { name: "金刚怒目", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "buff_shield", trigger: "active", desc: "将造成伤害的一半转化为{n}点护盾" }], type: "主动" },
      { name: "金刚不坏", components: [{ mechanic: "buff_def", trigger: "passive", desc: "数回合内受到伤害降低{p}%" }], type: "被动" },
      { name: "涅槃之气", components: [{ mechanic: "buff_shield", trigger: "passive", condition: "每损失一定比例生命", desc: "获得{n}点护盾" }], type: "被动" },
    ],
    "极品": [
      { name: "不灭金身", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "buff_shield", trigger: "active", desc: "将全部造成伤害转化为{n}点护盾" }], type: "主动" },
      { name: "天地崩", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点物伤，吸引全体攻击自己" }], type: "主动" },
      { name: "涅槃击", components: [{ mechanic: "dmg_single", trigger: "active", condition: "消耗全部护盾", desc: "造成{n}点物伤，护盾越多伤害越高" }], type: "主动" },
      { name: "血战", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "生命低于一定比例时", desc: "物攻和物防提高{p}%" }], type: "被动" },
      { name: "铁山靠", components: [{ mechanic: "cc_stun", trigger: "on_hit", desc: "受到攻击时有{p}%概率眩晕攻击者" }], type: "被动" },
    ],
    "仙品": [
      { name: "九转天拳", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点超高物伤" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%防御" }, { mechanic: "buff_shield", trigger: "active", desc: "获得{n}点护盾" }], type: "主动" },
      { name: "法相天地", components: [{ mechanic: "damage_share", trigger: "active", desc: "替全体队友承受{p}%伤害" }, { mechanic: "heal_single", trigger: "active", desc: "同时恢复自身{n}点生命" }], type: "主动" },
      { name: "金身怒目", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "heal_single", trigger: "active", desc: "命中后恢复{n}点生命" }, { mechanic: "buff_def", trigger: "active", desc: "获取{p}%物防" }], type: "主动" },
      { name: "九转金身", components: [{ mechanic: "death_ward", trigger: "passive", desc: "数回合内受到伤害不会低于{n}点生命" }], type: "被动" },
      { name: "肉身成圣", components: [{ mechanic: "buff_def", trigger: "passive", desc: "所有防御属性提高{n}点" }], type: "被动" },
    ],
    "神品": [
      { name: "天地法相拳", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点毁灭性物伤" }, { mechanic: "buff_shield", trigger: "active", desc: "造成伤害全部转化为{n}点自身护盾" }], type: "主动" },
      { name: "涅槃重生击", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "kill_bonus", trigger: "on_kill", condition: "若击杀目标", desc: "恢复{p}%生命" }], type: "主动" },
      { name: "万法不侵身", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "damage_share", trigger: "active", desc: "数回合内替全体队友承受{p}%伤害" }, { trigger: "passive", desc: "免疫特殊效果" }], type: "主动" },
      { name: "不朽", components: [{ mechanic: "buff_def", trigger: "passive", desc: "受到任何伤害不超过最大生命{p}%" }], type: "被动" },
      { name: "天地同寿", components: [{ mechanic: "death_ward", trigger: "on_fatal", desc: "受到致命伤时免疫并恢复{n}点生命，每场战斗限一次" }], type: "被动" },
    ],
  },

  // ── 法修 ──────────────────────────────────────────────────────────────
  // 核心：法攻/法力，打AOE法伤，频繁施法，施法链
  "法修": {
    "下品": [
      { name: "法弹术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }], type: "主动" },
      { name: "灵光弹", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤，减少随机技能冷却" }], type: "主动" },
      { name: "灵压冲击", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤，额外附加法力值一定比例伤害" }], type: "主动" },
      { name: "聚灵术", components: [{ mechanic: "buff_stat", trigger: "on_turn_start", desc: "每回合恢复{n}点法力" }], type: "被动" },
      { name: "法力流转", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "法力消耗降低{p}%" }], type: "被动" },
    ],
    "中品": [
      { name: "灵海冲击", components: [{ mechanic: "dmg_single", trigger: "active", condition: "法力越高伤害越高", desc: "造成{n}点法伤" }], type: "主动" },
      { name: "法力潮汐", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点法伤" }, { mechanic: "buff_stat", trigger: "active", desc: "命中后恢复{p}%法力" }], type: "主动" },
      { name: "灵能爆破", components: [{ mechanic: "buff_ramp", trigger: "active", condition: "连续释放同类技能", desc: "每层增伤{p}%" }], type: "主动" },
      { name: "灵台清明", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "释放技能时有{p}%概率不消耗法力" }], type: "被动" },
      { name: "法盾", components: [{ mechanic: "buff_shield", trigger: "active", desc: "消耗法力获得{n}点护盾" }], type: "被动" },
    ],
    "上品": [
      { name: "法相显化", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点法伤" }, { mechanic: "buff_crit", trigger: "active", desc: "提高{p}%法术暴击率" }], type: "主动" },
      { name: "灵元爆发", components: [{ mechanic: "dmg_single", trigger: "active", desc: "消耗大量法力造成{n}点高额法伤" }], type: "主动" },
      { name: "法力洪流", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤，额外附加法力消耗比例的伤害" }], type: "主动" },
      { name: "元神共振", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "法力高于80%时", desc: "法伤提升{p}%" }], type: "被动" },
      { name: "聚灵阵", components: [{ mechanic: "buff_stat", trigger: "on_turn_start", condition: "法力越高恢复越多", desc: "每回合恢复{n}点法力" }], type: "被动" },
    ],
    "极品": [
      { name: "太虚法印", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤，释放时概率不进入冷却" }], type: "主动" },
      { name: "万法归一", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { mechanic: "buff_ramp", trigger: "active", desc: "命中后下一次技能伤害提高{p}%" }], type: "主动" },
      { name: "法则之雷", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "对全体敌人造成{n}点法伤" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%法防" }], type: "主动" },
      { name: "天道法则", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "每种不同体系功法", desc: "提供{n}点额外法攻" }], type: "被动" },
      { name: "法力暴走", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "法力低于20%时", desc: "技能伤害提高{p}%" }], type: "被动" },
    ],
    "仙品": [
      { name: "天衍术", components: [{ mechanic: "extra_action", trigger: "active", desc: "复制敌方最近释放的技能进行攻击，造成{n}点法伤" }], type: "主动" },
      { name: "一念三千", components: [{ mechanic: "extra_action", trigger: "active", desc: "造成{n}点法伤，下一次技能额外释放两次" }], type: "主动" },
      { name: "神机法", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤，必定触发附加效果" }], type: "主动" },
      { name: "法则篡改", components: [{ mechanic: "extra_action", trigger: "passive", desc: "随机重置{n}个技能冷却" }], type: "被动" },
      { name: "须弥芥子", components: [{ mechanic: "extra_action", trigger: "passive", desc: "储存一次技能，下次释放时双重施法，额外造成{n}点法伤" }], type: "被动" },
    ],
    "神品": [
      { name: "万法寂灭", components: [{ mechanic: "cc_silence", trigger: "active", desc: "{p}%概率封锁全场不能使用功法" }, { mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点法伤" }], type: "主动" },
      { name: "言出法随", components: [{ mechanic: "extra_action", trigger: "active", desc: "造成{n}点超高法伤，下一回合所有技能无冷却无消耗" }], type: "主动" },
      { name: "万法之源", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤，概率触发所有已学功法效果" }], type: "主动" },
      { name: "道法自然", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "法力永不低于{n}点" }], type: "被动" },
      { name: "天道推演", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "所有法系技能效果提升{p}%" }], type: "被动" },
    ],
  },

  // ── 刺客系 ────────────────────────────────────────────────────────────
  // 核心：物攻/闪避/穿透，隐匿规避攻击，破防专克防御流，闪避反击
  "刺客系": {
    "下品": [
      { name: "暗器投掷", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤，降低被攻击概率" }], type: "主动" },
      { name: "要害突刺", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点穿透物伤" }], type: "主动" },
      { name: "疾风刃", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "buff_dodge", trigger: "active", desc: "提升{p}%闪避率" }], type: "主动" },
      { name: "潜影", components: [{ mechanic: "buff_stealth", trigger: "passive", desc: "隐匿{p}%概率不被攻击" }], type: "被动" },
      { name: "敏锐", components: [{ mechanic: "buff_crit", trigger: "passive", desc: "暴击率永久提高{p}%" }], type: "被动" },
    ],
    "中品": [
      { name: "背刺", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点穿透物伤" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%防御" }], type: "主动" },
      { name: "破甲突袭", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "debuff_def", trigger: "active", desc: "降低目标{p}%防御" }], type: "主动" },
      { name: "闪避反击", components: [{ mechanic: "counter", trigger: "on_dodge", desc: "闪避后{p}%概率追加一次攻击" }], type: "主动" },
      { name: "影分身", components: [{ mechanic: "summon", trigger: "passive", desc: "自动召唤{n}个分身吸引攻击" }], type: "被动" },
      { name: "破盾", components: [{ mechanic: "dmg_pierce", trigger: "on_attack", condition: "对护盾敌人", desc: "额外造成{n}点穿透伤害" }], type: "被动" },
    ],
    "上品": [
      { name: "致命暗杀", components: [{ mechanic: "dmg_single", trigger: "active", condition: "隐匿状态下", desc: "造成{n}点物伤，必定暴击" }], type: "主动" },
      { name: "幻影连刺", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成多段物伤，每段{n}点穿透伤害" }], type: "主动" },
      { name: "处刑斩", components: [{ mechanic: "dmg_pierce", trigger: "active", condition: "对护盾目标", desc: "造成{n}点穿透物伤，伤害翻倍" }], type: "主动" },
      { name: "夜行", components: [{ mechanic: "buff_stealth", trigger: "on_battle_start", desc: "战斗开始自动进入隐匿，{p}%概率不被发现" }], type: "被动" },
      { name: "影遁", components: [{ mechanic: "buff_stealth", trigger: "on_hit", desc: "受到攻击时{p}%概率进入隐匿" }], type: "被动" },
    ],
    "极品": [
      { name: "一击必杀", components: [{ mechanic: "dmg_pierce", trigger: "active", condition: "隐匿状态下", desc: "造成{n}点穿透物伤" }, { mechanic: "debuff_def", trigger: "active", condition: "隐匿状态下", desc: "无视{p}%防御和护盾" }], type: "主动" },
      { name: "千面杀", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤，命中后重置技能冷却并进入隐匿" }], type: "主动" },
      { name: "封脉刺", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "debuff_def", trigger: "active", desc: "降低目标{p}%防御和法防" }], type: "主动" },
      { name: "影杀", components: [{ mechanic: "buff_stealth", trigger: "on_kill", desc: "击杀目标后{p}%概率立即进入隐匿" }], type: "被动" },
      { name: "灭口", components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀目标时恢复{n}点法力" }], type: "被动" },
    ],
    "仙品": [
      { name: "鬼神刺", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点穿透物伤" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%防御，对护盾目标额外增伤" }], type: "主动" },
      { name: "无声杀", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "cc_stun", trigger: "active", desc: "{p}%概率使目标无法行动一回合" }], type: "主动" },
      { name: "十步杀", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀后永久提高{n}点物攻和穿透" }], type: "主动" },
      { name: "绝影", components: [{ mechanic: "buff_stealth", trigger: "passive", condition: "隐匿时", desc: "{p}%概率无法被任何手段侦测" }], type: "被动" },
      { name: "影武者", components: [{ mechanic: "death_ward", trigger: "on_fatal", desc: "受到致命伤时{p}%概率与影分身互换位置" }], type: "被动" },
    ],
    "神品": [
      { name: "斩因果", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点穿透物伤" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%防御和所有减伤效果" }], type: "主动" },
      { name: "一刃断魂", components: [{ mechanic: "dmg_execute", trigger: "active", desc: "造成{n}点物伤，附带即死效果，对强敌改为超高伤害" }], type: "主动" },
      { name: "影界暗杀", components: [{ mechanic: "extra_action", trigger: "active", desc: "进入影界连续行动{n}次，每次造成穿透物伤" }], type: "主动" },
      { name: "暗影主宰", components: [{ mechanic: "buff_stealth", trigger: "passive", desc: "永久隐匿，攻击后{p}%概率保持隐匿" }], type: "被动" },
      { name: "诛杀令", components: [{ mechanic: "debuff_mark", trigger: "active", desc: "标记一名敌人，对其所有伤害提高{p}%" }], type: "被动" },
    ],
  },

  // ── 毒系 ──────────────────────────────────────────────────────────────
  // 核心：中毒扣百分比生命，拖时间回血耗死敌人，持续伤害
  "毒系": {
    "下品": [
      { name: "毒手", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { status: "poison", trigger: "active", desc: "附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "on_turn_start", desc: "每回合扣除目标{p}%最大生命" }], type: "主动" },
      { name: "蚀骨掌", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { status: "poison", trigger: "active", desc: "附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "on_turn_start", desc: "每回合扣除{p}%最大生命" }, { mechanic: "debuff_def", trigger: "active", desc: "降低{p}%防御" }], type: "主动" },
      { name: "毒雾弥漫", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { status: "poison", trigger: "active", desc: "概率附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "on_turn_start", desc: "每回合扣除目标{p}%最大生命" }], type: "主动" },
      { name: "毒灵转生", components: [{ mechanic: "heal_single", trigger: "on_kill", condition: "中毒敌人死亡时", desc: "恢复{n}点生命" }], type: "被动" },
      { name: "腐蚀之触", components: [{ mechanic: "debuff_heal", trigger: "on_attack", desc: "攻击自动降低敌方{p}%恢复效果" }], type: "被动" },
    ],
    "中品": [
      { name: "蛊毒针", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { status: "poison", trigger: "active", desc: "附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "on_turn_start", desc: "每回合扣除目标{p}%最大生命，层数越高扣血越多" }], type: "主动" },
      { name: "腐血术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { status: "poison", trigger: "active", desc: "附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "on_turn_start", desc: "每回合扣除{p}%最大生命" }, { mechanic: "debuff_heal", trigger: "active", desc: "降低{p}%恢复效果" }], type: "主动" },
      { name: "毒刃斩", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { mechanic: "buff_atk", trigger: "active", condition: "已中毒目标", desc: "额外增伤{p}%" }], type: "主动" },
      { name: "蛊毒", components: [{ mechanic: "dmg_dot_pct", trigger: "on_turn_start", condition: "中毒每层", desc: "额外扣除{p}%最大生命" }], type: "被动" },
      { name: "毒愈", components: [{ mechanic: "heal_lifesteal_pct", trigger: "passive", condition: "敌人因中毒受到伤害时", desc: "恢复{p}%伤害的生命" }], type: "被动" },
    ],
    "上品": [
      { name: "毒丹爆", components: [{ mechanic: "dmg_single", trigger: "active", condition: "引爆目标所有中毒层数", desc: "造成{n}点毒伤" }], type: "主动" },
      { name: "蛊虫噬心", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { status: "poison", trigger: "active", desc: "附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "on_turn_start", desc: "每回合扣除{p}%最大生命" }, { trigger: "on_kill", desc: "击杀后扩散至其他敌人" }], type: "主动" },
      { name: "猛毒注入", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { status: "poison", trigger: "active", desc: "附加强力中毒" }, { mechanic: "dmg_dot_pct", trigger: "on_turn_start", desc: "每回合扣除{p}%最大生命，持续时间延长" }], type: "被动" },
      { name: "剧毒之躯", components: [{ status: "poison", trigger: "on_hit", condition: "受到近身攻击时", desc: "自动施加中毒" }, { mechanic: "dmg_dot_pct", trigger: "on_turn_start", desc: "每回合扣除攻击者{p}%最大生命" }], type: "被动" },
      { name: "毒蚀", components: [{ mechanic: "debuff_atk", trigger: "on_turn_start", condition: "中毒目标", desc: "每回合自动降低{p}%攻击力" }], type: "被动" },
    ],
    "极品": [
      { name: "天毒降", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点法伤" }, { status: "poison", trigger: "active", desc: "附加中毒" }], type: "主动" },
      { name: "万蛊噬心", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { mechanic: "buff_atk", trigger: "active", condition: "中毒目标", desc: "受到的所有伤害提高{p}%" }], type: "主动" },
      { name: "毒灵引爆", components: [{ mechanic: "dmg_aoe", trigger: "active", condition: "引爆全场中毒", desc: "造成{n}点法伤，层数越高伤害越高" }], type: "主动" },
      { name: "腐天", components: [{ mechanic: "dmg_dot_pct", trigger: "on_crit", condition: "中毒伤害暴击时", desc: "额外扣除{p}%最大生命" }], type: "被动" },
      { name: "万毒化身", components: [{ trigger: "passive", desc: "自身免疫中毒" }, { mechanic: "buff_stat", trigger: "passive", condition: "根据敌方中毒人数", desc: "增伤{p}%" }], type: "被动" },
    ],
    "仙品": [
      { name: "百毒灭世", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点法伤，中毒效果翻倍" }], type: "主动" },
      { name: "不死蛊", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀目标恢复{n}点生命和法力" }], type: "主动" },
      { name: "化毒攻击", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { status: "poison", trigger: "active", desc: "将自身所受伤害的{p}%转化为中毒施加" }], type: "主动" },
      { name: "毒域", components: [{ status: "poison", trigger: "on_turn_start", desc: "全体敌人每回合自动叠加中毒" }, { mechanic: "dmg_dot_pct", trigger: "on_turn_start", desc: "扣除{p}%最大生命" }], type: "被动" },
      { name: "毒尊", components: [{ mechanic: "dmg_dot_pct", trigger: "on_turn_start", desc: "中毒层数无上限，每层扣除{p}%最大生命" }], type: "被动" },
    ],
    "神品": [
      { name: "万毒归宗", components: [{ mechanic: "dmg_aoe", trigger: "active", condition: "引爆全场中毒", desc: "造成{n}点毁灭性法伤" }], type: "主动" },
      { name: "死寂", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { mechanic: "dmg_execute", trigger: "active", condition: "中毒层数满的敌人", desc: "直接被击杀，额外造成{n}点伤害" }], type: "主动" },
      { name: "天地毒牢", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点法伤" }, { status: "poison", trigger: "on_turn_start", desc: "敌人无法清除中毒且每回合叠加" }], type: "主动" },
      { name: "毒仙之体", components: [{ trigger: "passive", desc: "免疫所有负面效果" }, { mechanic: "heal_lifesteal_pct", trigger: "passive", condition: "敌人中毒时", desc: "恢复{p}%伤害的生命" }], type: "被动" },
      { name: "毒愈天成", components: [{ mechanic: "heal_lifesteal_pct", trigger: "passive", condition: "敌人中毒伤害", desc: "{p}%永久恢复自身生命" }], type: "被动" },
    ],
  },

  // ── 魔修 ──────────────────────────────────────────────────────────────
  // 核心：消耗血量/法力/寿元换取增强，敌人死亡获得增益，自残流
  "魔修": {
    "下品": [
      { name: "炼血术", components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法伤" }], type: "主动" },
      { name: "噬魂爪", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法伤" }, { mechanic: "heal_lifesteal_pct", trigger: "active", desc: "恢复{p}%伤害的生命" }], type: "主动" },
      { name: "魔气弹", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法伤" }, { mechanic: "debuff_atk", trigger: "active", desc: "降低敌方{p}%法攻" }], type: "主动" },
      { name: "魔体", components: [{ mechanic: "reflect", trigger: "on_hit", desc: "受到伤害时{p}%概率反弹" }], type: "被动" },
      { name: "吞噬", components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀敌人恢复{n}点生命和法力" }], type: "被动" },
    ],
    "中品": [
      { name: "献祭术", components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点超高暗属性法伤" }], type: "主动" },
      { name: "魔影突击", components: [{ mechanic: "summon", trigger: "active", desc: "消耗法力召唤{n}个魔影攻击，造成暗属性法伤" }], type: "主动" },
      { name: "噬魂术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法伤，命中后恢复法力" }], type: "主动" },
      { name: "血契", components: [{ mechanic: "kill_bonus", trigger: "on_kill", condition: "队友死亡时", desc: "继承{n}点属性" }], type: "被动" },
      { name: "魔血沸腾", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "生命越低", desc: "法攻提高{p}%" }], type: "被动" },
    ],
    "上品": [
      { name: "天魔爪", components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法伤" }, { mechanic: "cc_fear", trigger: "active", desc: "{p}%概率附加恐惧" }], type: "主动" },
      { name: "血魔突袭", components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命和法力" }, { mechanic: "dmg_single", trigger: "active", condition: "生命越低伤害越高", desc: "造成{n}点暗属性法伤" }], type: "主动" },
      { name: "魔威震慑", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法伤" }, { mechanic: "debuff_atk", trigger: "active", desc: "降低全体敌人{p}%攻击力" }], type: "主动" },
      { name: "血魔之躯", components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命" }, { mechanic: "buff_def", trigger: "active", desc: "提高{n}点防御" }, { mechanic: "buff_atk", trigger: "active", desc: "提高{n}点攻击" }], type: "被动" },
      { name: "魔道轮回", components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "敌人死亡时恢复{n}点生命" }], type: "被动" },
    ],
    "极品": [
      { name: "血祭", components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命" }, { mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点暗属性法伤" }], type: "主动" },
      { name: "天魔附体", components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命" }, { mechanic: "buff_stat", trigger: "active", desc: "大幅提高{p}%属性" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法伤" }], type: "主动" },
      { name: "万魂噬", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法伤" }, { mechanic: "kill_bonus", trigger: "on_kill", desc: "敌人死亡时恢复{n}点法力" }], type: "主动" },
      { name: "轮回印", components: [{ mechanic: "summon", trigger: "active", desc: "队友死亡后化为魂体继续战斗{n}回合" }], type: "被动" },
      { name: "天怒", components: [{ mechanic: "buff_ramp", trigger: "passive", condition: "敌人越多", desc: "伤害提高{p}%" }], type: "被动" },
    ],
    "仙品": [
      { name: "焚寿天魔", components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%寿元" }, { mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点暗属性法伤" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%防御" }], type: "主动" },
      { name: "幽冥之门", components: [{ mechanic: "summon", trigger: "active", desc: "消耗法力召唤{n}个幽冥使者攻击，造成暗属性法伤" }], type: "主动" },
      { name: "生死逆轮", components: [{ mechanic: "sacrifice", trigger: "active", desc: "交换{p}%生命与法力后" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法伤" }], type: "主动" },
      { name: "魔道至尊", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "所有魔修技能伤害提高{p}%" }], type: "被动" },
      { name: "血海无量", components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "每次击杀永久提高{n}点生命上限" }], type: "被动" },
    ],
    "神品": [
      { name: "灭世", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "消耗全部法力对全场造成{n}点暗属性法伤" }], type: "主动" },
      { name: "天魔解体", components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命" }, { mechanic: "buff_stat", trigger: "active", desc: "提高{p}%属性" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点超高伤害" }], type: "主动" },
      { name: "魔界降临", components: [{ mechanic: "dmg_dot", trigger: "active", desc: "消耗生命将战场化为魔域，每回合造成{n}点暗属性法伤" }], type: "主动" },
      { name: "不死魔躯", components: [{ mechanic: "death_ward", trigger: "on_fatal", desc: "受到致命伤时消耗法力抵消，恢复{n}点生命" }], type: "被动" },
      { name: "噬魂", components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀一名敌方永久增加{n}点法攻" }], type: "被动" },
    ],
  },

  // ── 火系 ──────────────────────────────────────────────────────────────
  // 核心：纯爆发流，灼烧真实伤害，短时高伤，和毒系相反
  "火系": {
    "下品": [
      { name: "火球术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点火伤" }], type: "主动" },
      { name: "点燃", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点火伤" }, { status: "burn", trigger: "active", desc: "附加灼烧" }, { mechanic: "dmg_dot", trigger: "on_turn_start", desc: "每回合造成{n}点真实伤害" }], type: "主动" },
      { name: "炽焰斩", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点火伤" }, { mechanic: "buff_atk", trigger: "active", desc: "提高自身{p}%火系伤害" }], type: "主动" },
      { name: "火灵感知", components: [{ mechanic: "buff_atk", trigger: "passive", desc: "火系功法伤害提高{p}%" }], type: "被动" },
      { name: "灼烧体质", components: [{ status: "burn", trigger: "on_attack", mechanic: "extra_action", desc: "攻击时{p}%概率点燃目标" }], type: "被动" },
    ],
    "中品": [
      { name: "烈火术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点火伤，攻击随机目标两次" }], type: "主动" },
      { name: "爆炎弹", components: [{ mechanic: "dmg_single", trigger: "active", condition: "对灼烧目标", desc: "造成{n}点火伤，额外增伤" }], type: "主动" },
      { name: "烈焰风暴", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对目标及周围敌人造成{n}点火伤" }], type: "主动" },
      { name: "火种", components: [{ status: "fire_seed", trigger: "on_attack", mechanic: "extra_action", desc: "攻击{p}%概率叠加火种" }], type: "被动" },
      { name: "炎爆", components: [{ mechanic: "dmg_aoe", trigger: "on_kill", condition: "击杀燃烧中的敌人时", desc: "对周围造成{n}点火伤" }], type: "被动" },
    ],
    "上品": [
      { name: "赤炎领域", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点火伤" }, { status: "burn", trigger: "active", desc: "附加灼烧" }, { mechanic: "dmg_dot", trigger: "on_turn_start", desc: "每回合造成{n}点真实伤害" }], type: "主动" },
      { name: "焚身焰", components: [{ mechanic: "dmg_single", trigger: "active", condition: "敌人灼烧层数越高", desc: "造成{n}点火伤，伤害越高" }], type: "主动" },
      { name: "火灵附体", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点火伤" }, { mechanic: "buff_atk", trigger: "active", desc: "命中后提高{p}%法攻" }], type: "主动" },
      { name: "烈焰印记", components: [{ status: "burn", trigger: "on_attack", desc: "攻击附加火焰印记" }, { mechanic: "dmg_dot", trigger: "passive", condition: "印记叠满", desc: "爆炸造成{n}点真实伤害" }], type: "被动" },
      { name: "炎魔之体", components: [{ mechanic: "heal_single", trigger: "on_hit", condition: "受到火系伤害时", desc: "恢复{p}%生命" }], type: "被动" },
    ],
    "极品": [
      { name: "天火降世", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点火伤" }], type: "主动" },
      { name: "九阳真火", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点火伤" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%法防" }], type: "主动" },
      { name: "炎爆术", components: [{ mechanic: "dmg_aoe", trigger: "active", condition: "引爆所有灼烧和火种", desc: "造成{n}点火伤" }], type: "主动" },
      { name: "不灭之焰", components: [{ mechanic: "dmg_dot", trigger: "on_turn_start", desc: "灼烧效果不会自然消退，每回合造成{n}点真实伤害" }], type: "被动" },
      { name: "焚天之怒", components: [{ mechanic: "buff_crit", trigger: "passive", desc: "火伤暴击率提高{p}%，暴击时造成额外爆炸" }], type: "被动" },
    ],
    "仙品": [
      { name: "三昧真火", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点火伤，灼烧为真实伤害且无法驱散" }], type: "主动" },
      { name: "凤凰焚天", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点火伤" }, { mechanic: "revive", trigger: "on_fatal", desc: "受到致命伤时化为火焰重生，恢复{n}点生命" }], type: "主动" },
      { name: "炼狱之焰", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点火伤" }, { mechanic: "buff_ramp", trigger: "on_turn_start", condition: "灼烧目标", desc: "每回合受到的火伤递增{p}%" }], type: "主动" },
      { name: "火神降临", components: [{ mechanic: "buff_crit", trigger: "passive", desc: "火伤暴击率提高{p}%" }], type: "被动" },
      { name: "火眼金睛", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "攻击必定命中且无视{p}%火抗" }], type: "被动" },
    ],
    "神品": [
      { name: "焚天煮海", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点真实火伤" }], type: "主动" },
      { name: "创世之焰", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点火伤" }, { mechanic: "dmg_execute", trigger: "active", condition: "低血量敌人", desc: "{p}%概率直接焚毁" }], type: "主动" },
      { name: "不死鸟", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点火伤" }, { mechanic: "revive", trigger: "on_fatal", desc: "死亡时爆炸对全体造成{n}点火伤后复活" }], type: "主动" },
      { name: "不灭火种", components: [{ status: "fire_seed", trigger: "on_kill", condition: "敌方死亡时", desc: "火种自动转移至其他敌人" }, { mechanic: "buff_ramp", trigger: "passive", desc: "叠加伤害提高{p}%" }], type: "被动" },
      { name: "炎帝降临", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "所有火系效果范围扩大至全体，灼烧伤害提高{p}%" }], type: "被动" },
    ],
  },

  // ── 雷系 ──────────────────────────────────────────────────────────────
  // 核心：感电流，伤害溅射到其他敌人，法攻/法力/防御
  "雷系": {
    "下品": [
      { name: "落雷术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点雷伤，溅射到周围敌人" }], type: "主动" },
      { name: "电弧击", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "造成{n}点雷伤" }, { mechanic: "extra_action", trigger: "active", desc: "{p}%概率连锁弹射多个目标" }], type: "主动" },
      { name: "麻痹雷", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点雷伤" }, { mechanic: "debuff_speed", trigger: "active", desc: "降低目标{p}%速度" }], type: "主动" },
      { name: "雷光", components: [{ status: "shock", trigger: "on_attack", mechanic: "extra_action", desc: "攻击时{p}%概率附加感电" }], type: "被动" },
      { name: "引雷", components: [{ mechanic: "dmg_single", trigger: "on_attack", condition: "对感电目标", desc: "造成额外{n}点雷伤" }], type: "被动" },
    ],
    "中品": [
      { name: "雷链", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "造成{n}点雷伤，弹射到多个目标" }], type: "主动" },
      { name: "惊雷斩", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点雷伤" }, { mechanic: "dmg_single", trigger: "on_crit", desc: "暴击时额外溅射{n}点雷伤" }], type: "主动" },
      { name: "奔雷击", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "造成{n}点雷伤，溅射到周围所有敌人" }], type: "主动" },
      { name: "雷印", components: [{ status: "thunder_seal", trigger: "on_attack", desc: "攻击自动附加雷印" }, { mechanic: "buff_ramp", trigger: "passive", desc: "每层提高{p}%伤害" }], type: "被动" },
      { name: "雷光护盾", components: [{ mechanic: "buff_shield", trigger: "active", desc: "获得{n}点护盾" }, { mechanic: "dmg_single", trigger: "on_hit", desc: "受击时自动释放电弧溅射，造成{n}点雷伤" }], type: "被动" },
    ],
    "上品": [
      { name: "雷暴", components: [{ mechanic: "dmg_aoe", trigger: "active", condition: "引爆全部雷印", desc: "造成{n}点雷伤，溅射到周围敌人" }], type: "主动" },
      { name: "天雷护体", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点雷伤" }, { mechanic: "counter", trigger: "on_hit", desc: "受到攻击时反击溅射{n}点雷伤" }], type: "主动" },
      { name: "雷帝之怒", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点雷伤" }, { mechanic: "buff_ramp", trigger: "active", condition: "感电目标", desc: "溅射伤害提高{p}%" }], type: "主动" },
      { name: "紫霄神雷", components: [{ mechanic: "buff_crit", trigger: "passive", desc: "暴击率提高{p}%，暴击时溅射范围扩大" }], type: "被动" },
      { name: "连环雷印", components: [{ status: "thunder_seal", trigger: "passive", condition: "引爆雷印时", desc: "对周围敌人也附加雷印" }, { mechanic: "buff_ramp", trigger: "passive", desc: "每层提高{p}%伤害" }], type: "被动" },
    ],
    "极品": [
      { name: "雷霆万钧", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "造成{n}点雷伤，对全体敌人造成溅射伤害" }], type: "主动" },
      { name: "雷狱", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点雷伤" }, { status: "shock", trigger: "on_turn_start", desc: "持续叠加感电" }], type: "主动" },
      { name: "雷帝法相", components: [{ mechanic: "dmg_aoe", trigger: "active", condition: "引爆雷印", desc: "造成{n}点雷伤" }, { mechanic: "dmg_aoe", trigger: "active", desc: "额外召唤落雷溅射，造成{n}点雷伤" }], type: "主动" },
      { name: "雷劫", components: [{ mechanic: "dmg_aoe", trigger: "on_turn_start", desc: "周期性随机劈落雷霆造成{n}点雷伤，溅射附近敌人" }], type: "被动" },
      { name: "雷神怒", components: [{ mechanic: "buff_crit_dmg", trigger: "passive", desc: "暴击伤害提高{p}%，溅射伤害也享受暴击加成" }], type: "被动" },
    ],
    "仙品": [
      { name: "九霄神雷", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点雷伤，溅射全体" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%法防" }], type: "主动" },
      { name: "天雷化身", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点雷伤" }, { mechanic: "counter", trigger: "on_hit", desc: "免疫感电且受击自动反击溅射{n}点落雷" }], type: "主动" },
      { name: "紫霄领域", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点雷伤" }, { trigger: "passive", desc: "领域内敌人无法闪避" }, { mechanic: "dmg_dot", trigger: "on_turn_start", desc: "持续受{n}点雷伤" }], type: "主动" },
      { name: "雷神之眼", components: [{ status: "thunder_seal", trigger: "on_crit", desc: "暴击时额外叠加雷印" }], type: "被动" },
      { name: "雷道真意", components: [{ mechanic: "buff_stat", trigger: "on_crit", desc: "暴击时恢复{n}点法力" }], type: "被动" },
    ],
    "神品": [
      { name: "天罚", components: [{ mechanic: "dmg_aoe", trigger: "active", condition: "对生命最高目标", desc: "降下神雷造成{n}点雷伤，溅射全体敌人" }], type: "主动" },
      { name: "灭世雷霆", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点雷伤" }, { status: "shock", trigger: "active", desc: "全部附加感电" }], type: "主动" },
      { name: "雷道至高", components: [{ mechanic: "dmg_aoe", trigger: "active", condition: "引爆全场雷印", desc: "造成{n}点雷伤，引爆后重新叠加" }], type: "主动" },
      { name: "雷帝降世", components: [{ mechanic: "buff_crit", trigger: "passive", desc: "所有雷系技能暴击率提高{p}%" }], type: "被动" },
      { name: "万雷归宗", components: [{ mechanic: "extra_action", trigger: "passive", condition: "释放雷系技能后", desc: "{p}%概率自动追加一次溅射雷击" }], type: "被动" },
    ],
  },

  // ── 冰系 ──────────────────────────────────────────────────────────────
  // 核心：控制流，冻结敌人使其不能行动，对冻结目标增伤减防
  "冰系": {
    "下品": [
      { name: "冰锥术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { mechanic: "cc_freeze", trigger: "active", desc: "{p}%概率冻结目标" }], type: "主动" },
      { name: "寒气冲击", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { mechanic: "debuff_speed", trigger: "active", desc: "降低目标{p}%速度" }], type: "主动" },
      { name: "冰凌刺", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { status: "frost", trigger: "active", mechanic: "extra_action", desc: "{p}%概率附加寒霜" }], type: "主动" },
      { name: "冰甲", components: [{ mechanic: "buff_def", trigger: "on_turn_start", desc: "每回合自动提高{p}%防御" }], type: "被动" },
      { name: "凝冰", components: [{ mechanic: "dmg_single", trigger: "on_attack", condition: "对冻结目标", desc: "造成额外{n}点冰伤" }], type: "被动" },
    ],
    "中品": [
      { name: "冰封术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { mechanic: "cc_freeze", trigger: "active", desc: "{p}%概率冻结目标" }], type: "主动" },
      { name: "寒冰箭", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { status: "frost", trigger: "active", desc: "叠加寒霜" }, { mechanic: "debuff_def", trigger: "active", condition: "冻结目标", desc: "降低{p}%防御" }], type: "主动" },
      { name: "冰刺突", components: [{ mechanic: "dmg_single", trigger: "active", condition: "对冻结目标", desc: "造成{n}点冰伤，双倍伤害" }], type: "主动" },
      { name: "冰棱护甲", components: [{ mechanic: "buff_shield", trigger: "active", desc: "获得{n}点护盾" }, { mechanic: "debuff_speed", trigger: "on_hit", condition: "护盾存在时", desc: "降低攻击者{p}%速度" }], type: "被动" },
      { name: "寒霜", components: [{ mechanic: "debuff_atk", trigger: "on_turn_start", condition: "寒霜目标", desc: "每回合自动降低{p}%攻击" }], type: "被动" },
    ],
    "上品": [
      { name: "霜寒领域", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点冰伤" }, { mechanic: "debuff_speed", trigger: "on_turn_start", desc: "持续降低{p}%速度" }, { status: "frost", trigger: "on_turn_start", desc: "叠加寒霜" }], type: "主动" },
      { name: "极寒冰棺", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { mechanic: "cc_freeze", trigger: "active", desc: "必定冻结目标且冻结时间延长，冻结概率{p}%" }], type: "主动" },
      { name: "凛冬之息", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { mechanic: "buff_stat", trigger: "active", condition: "命中冻结目标", desc: "恢复{p}%法力" }], type: "主动" },
      { name: "冰晶护体", components: [{ mechanic: "buff_shield", trigger: "on_hit", desc: "受到攻击自动获得{n}点护盾" }], type: "被动" },
      { name: "冰魄", components: [{ mechanic: "buff_ramp", trigger: "passive", desc: "寒霜叠加速度提高{p}%" }], type: "被动" },
    ],
    "极品": [
      { name: "冰河时代", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点冰伤" }, { mechanic: "cc_freeze", trigger: "active", desc: "{p}%概率冻结" }], type: "主动" },
      { name: "冰爆术", components: [{ mechanic: "dmg_aoe", trigger: "active", condition: "引爆所有寒霜层数", desc: "造成{n}点冰伤，冻结目标额外增伤" }], type: "主动" },
      { name: "绝对零度", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { mechanic: "buff_atk", trigger: "active", condition: "冻结目标", desc: "受到的伤害提高{p}%" }], type: "主动" },
      { name: "永冻之息", components: [{ mechanic: "cc_freeze", trigger: "passive", desc: "冻结目标无法被任何效果解除，冻结概率{p}%" }], type: "被动" },
      { name: "冰魄真元", components: [{ mechanic: "heal_single", trigger: "on_attack", condition: "每次冻结敌人时", desc: "恢复{n}点生命" }], type: "被动" },
    ],
    "仙品": [
      { name: "冰皇降世", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { mechanic: "cc_freeze", trigger: "active", desc: "{p}%概率直接冻结全体敌人" }], type: "主动" },
      { name: "万古寒气", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点冰伤" }, { status: "frost", trigger: "passive", desc: "敌人寒霜不会消退" }], type: "主动" },
      { name: "冰心诀", components: [{ mechanic: "dmg_single", trigger: "active", condition: "法力越高冰系伤害越高", desc: "造成{n}点冰伤" }], type: "主动" },
      { name: "太阴寒气", components: [{ mechanic: "cc_freeze", trigger: "passive", desc: "{p}%概率冻结且无法被驱散" }], type: "被动" },
      { name: "玄冰真体", components: [{ trigger: "passive", desc: "免疫冻结效果" }], type: "被动" },
    ],
    "神品": [
      { name: "冰封天地", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点冰伤并冻结数回合" }], type: "主动" },
      { name: "绝对冰域", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { mechanic: "debuff_speed", trigger: "passive", condition: "领域内敌人", desc: "速度降低{p}%" }], type: "主动" },
      { name: "冰道至尊", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点冰伤" }, { mechanic: "buff_atk", trigger: "active", condition: "冻结目标", desc: "受到的所有伤害提高{p}%" }], type: "主动" },
      { name: "永冻之域", components: [{ mechanic: "dmg_single", trigger: "on_attack", condition: "冻结敌人时", desc: "追加{n}点伤害" }], type: "被动" },
      { name: "万古寒狱", components: [{ status: "frost", trigger: "on_turn_start", desc: "全场敌人持续叠加寒霜" }, { mechanic: "buff_ramp", trigger: "on_turn_start", desc: "每层增加{p}%减速效果" }], type: "被动" },
    ],
  },

  // ── 暗系 ──────────────────────────────────────────────────────────────
  // 核心：减益敌人，降低恢复/法力/防御，削弱型
  "暗系": {
    "下品": [
      { name: "暗影箭", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "debuff_def", trigger: "active", desc: "降低目标{p}%防御" }], type: "主动" },
      { name: "腐蚀弹", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "debuff_def", trigger: "active", desc: "降低目标{p}%法防" }], type: "主动" },
      { name: "暗影缠身", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { status: "corrode", trigger: "active", desc: "概率附加暗蚀（降低恢复效果）" }], type: "主动" },
      { name: "夜幕", components: [{ mechanic: "debuff_atk", trigger: "passive", desc: "自动降低敌方{p}%命中" }], type: "被动" },
      { name: "窥命", components: [{ mechanic: "dmg_single", trigger: "on_attack", condition: "对暗蚀目标", desc: "造成额外{n}点伤害" }], type: "被动" },
    ],
    "中品": [
      { name: "暗蚀弹", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "debuff_heal", trigger: "active", desc: "降低目标{p}%恢复效果" }, { mechanic: "debuff_mp", trigger: "active", desc: "降低目标{p}%法力" }], type: "主动" },
      { name: "噬影击", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "heal_lifesteal_pct", trigger: "active", desc: "恢复造成伤害{p}%的生命" }], type: "主动" },
      { name: "吞灵术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "debuff_mp", trigger: "active", desc: "吸取目标{p}%法力" }], type: "主动" },
      { name: "灵魂侵蚀", components: [{ mechanic: "debuff_heal", trigger: "on_attack", desc: "攻击自动降低敌方{p}%恢复效果" }], type: "被动" },
      { name: "暗影缠缚", components: [{ status: "corrode", trigger: "passive", desc: "暗蚀效果可叠加" }], type: "被动" },
    ],
    "上品": [
      { name: "影缚术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "cc_root", trigger: "active", desc: "{p}%概率禁锢目标" }, { mechanic: "debuff_def", trigger: "active", desc: "降低{p}%全属性" }], type: "主动" },
      { name: "暗影洪流", components: [{ mechanic: "dmg_single", trigger: "active", condition: "暗蚀层数越高", desc: "造成{n}点物伤，伤害越高" }], type: "主动" },
      { name: "暗杀术", components: [{ mechanic: "dmg_single", trigger: "active", condition: "暗蚀层数满时", desc: "造成{n}点巨额物伤" }], type: "主动" },
      { name: "暗域", components: [{ mechanic: "debuff_atk", trigger: "on_turn_start", desc: "敌方命中持续降低{p}%" }], type: "被动" },
      { name: "幽魂", components: [{ mechanic: "summon", trigger: "on_kill", desc: "死亡单位化为幽魂攻击敌人，造成{n}点伤害" }], type: "被动" },
    ],
    "极品": [
      { name: "死亡宣告", components: [{ mechanic: "dmg_execute", trigger: "active", condition: "低血量敌人", desc: "造成{n}点物伤，目标生命越低伤害越高" }], type: "主动" },
      { name: "暗月降临", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点物伤" }, { status: "corrode", trigger: "active", desc: "附加暗蚀" }, { mechanic: "debuff_mp", trigger: "active", desc: "降低{p}%法力" }], type: "主动" },
      { name: "灵魂收割", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀目标恢复{p}%生命法力" }], type: "主动" },
      { name: "暗影吞噬", components: [{ mechanic: "dispel", trigger: "passive", desc: "{p}%概率吸收敌方增益转化为自身属性" }], type: "被动" },
      { name: "永夜之幕", components: [{ mechanic: "debuff_atk", trigger: "passive", desc: "全体敌人命中降低{p}%" }], type: "被动" },
    ],
    "仙品": [
      { name: "暗影之主", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "heal_lifesteal_pct", trigger: "active", desc: "偷取造成伤害{p}%的生命和法力" }], type: "主动" },
      { name: "冥界之门", components: [{ mechanic: "summon", trigger: "active", desc: "召唤暗影生物攻击，造成{n}点物伤" }], type: "主动" },
      { name: "暗道真意", components: [{ mechanic: "dmg_single", trigger: "active", condition: "敌方每有一个负面效果", desc: "造成{n}点物伤，额外增伤" }], type: "主动" },
      { name: "永夜", components: [{ mechanic: "dispel", trigger: "passive", desc: "{p}%概率使敌方无法获得增益" }], type: "被动" },
      { name: "虚无化身", components: [{ mechanic: "buff_dodge", trigger: "on_hit", desc: "受到攻击时{p}%概率闪避" }], type: "被动" },
    ],
    "神品": [
      { name: "万影噬天", components: [{ mechanic: "dmg_aoe", trigger: "active", condition: "引爆全场暗蚀", desc: "造成{n}点毁灭性物伤" }], type: "主动" },
      { name: "灭世暗影", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "debuff_mp", trigger: "active", desc: "降低全体敌人{p}%最大生命值和法力" }], type: "主动" },
      { name: "寂灭", components: [{ mechanic: "dmg_execute", trigger: "active", condition: "目标生命越低", desc: "造成{n}点超高物伤" }], type: "主动" },
      { name: "归墟", components: [{ trigger: "passive", desc: "死亡敌人无法被复活" }, { mechanic: "debuff_heal", trigger: "passive", desc: "敌方恢复效果降低{p}%" }], type: "被动" },
      { name: "虚无之主", components: [{ mechanic: "buff_dodge", trigger: "passive", desc: "{p}%概率完全免疫任何伤害" }], type: "被动" },
    ],
  },

  // ── 风系 ──────────────────────────────────────────────────────────────
  // 核心：攻击附带伤害，可配合中毒灼烧感电，物攻/闪避/暴击
  "风系": {
    "下品": [
      { name: "风刃", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤，附带额外伤害" }], type: "主动" },
      { name: "轻身击", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "buff_dodge", trigger: "active", desc: "提升自身{p}%闪避率" }], type: "主动" },
      { name: "微风斩", components: [{ mechanic: "dmg_single", trigger: "active", condition: "附带目标已有负面效果的额外伤害", desc: "造成{n}点物伤" }], type: "主动" },
      { name: "风之感知", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "永久提高{p}%命中" }], type: "被动" },
      { name: "微风", components: [{ mechanic: "buff_speed", trigger: "on_dodge", desc: "闪避后速度提高{p}%" }], type: "被动" },
    ],
    "中品": [
      { name: "疾风连斩", components: [{ mechanic: "extra_action", trigger: "active", desc: "{p}%概率连续攻击两次，每次造成{n}点物伤并附带额外伤害" }], type: "主动" },
      { name: "风刃乱舞", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对随机目标发射多道风刃造成{n}点物伤，触发敌方所有负面效果" }], type: "主动" },
      { name: "风缚术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "debuff_speed", trigger: "active", desc: "降低敌方{p}%速度" }], type: "主动" },
      { name: "风灵", components: [{ mechanic: "buff_stat", trigger: "on_dodge", desc: "闪避后自动恢复{n}点法力" }], type: "被动" },
      { name: "旋风", components: [{ mechanic: "dmg_single", trigger: "on_attack", desc: "攻击时概率附带额外{n}点风属性伤害" }], type: "被动" },
    ],
    "上品": [
      { name: "飓风", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点物伤，附带额外伤害触发敌方灼烧中毒感电" }], type: "主动" },
      { name: "风神之翼", components: [{ mechanic: "extra_action", trigger: "on_dodge", desc: "闪避后{p}%概率追加一次附带伤害的攻击" }], type: "主动" },
      { name: "风压斩", components: [{ mechanic: "dmg_single", trigger: "active", condition: "速度高于敌方时", desc: "造成{n}点物伤，伤害提高" }], type: "主动" },
      { name: "风暴之眼", components: [{ mechanic: "buff_crit", trigger: "passive", desc: "暴击率提高{p}%" }], type: "被动" },
      { name: "御风诀", components: [{ mechanic: "extra_action", trigger: "passive", desc: "额外行动概率提高{p}%" }], type: "被动" },
    ],
    "极品": [
      { name: "龙卷", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "持续对全体敌人造成{n}点物伤，附带伤害递增" }], type: "主动" },
      { name: "天风斩", components: [{ mechanic: "extra_action", trigger: "on_attack", desc: "每次攻击{p}%概率追加附带伤害的额外攻击" }], type: "主动" },
      { name: "暴风领域", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "debuff_speed", trigger: "passive", condition: "领域内敌方", desc: "速度降低{p}%" }], type: "主动" },
      { name: "风神祝福", components: [{ mechanic: "buff_speed", trigger: "passive", desc: "速度永久提高{p}%" }], type: "被动" },
      { name: "风怒", components: [{ mechanic: "buff_ramp", trigger: "on_attack", condition: "攻击次数越多", desc: "每层提高{p}%伤害" }], type: "被动" },
    ],
    "仙品": [
      { name: "青冥罡风", components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点物伤，附带伤害触发所有敌方负面效果" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%防御" }], type: "主动" },
      { name: "天人乘风", components: [{ mechanic: "extra_action", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "extra_action", trigger: "passive", desc: "行动后{p}%概率获得额外行动" }], type: "主动" },
      { name: "罡风护体", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤" }, { mechanic: "counter", trigger: "on_hit", desc: "受击时自动释放风刃反击，造成{n}点伤害" }], type: "主动" },
      { name: "风遁", components: [{ mechanic: "buff_stealth", trigger: "active", desc: "无法被选中数回合，期间闪避率提高{p}%" }], type: "被动" },
      { name: "风神之体", components: [{ mechanic: "buff_dodge", trigger: "passive", desc: "闪避率提高{p}%且闪避时恢复生命" }], type: "被动" },
    ],
    "神品": [
      { name: "九天风灾", components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全场造成{n}点毁灭性物伤，触发所有敌方灼烧中毒感电" }], type: "主动" },
      { name: "风之极意", components: [{ mechanic: "dmg_single", trigger: "active", condition: "速度差越大伤害越高，无上限", desc: "造成{n}点物伤" }], type: "主动" },
      { name: "万物随风", components: [{ mechanic: "extra_action", trigger: "on_turn_start", desc: "每回合{p}%概率额外行动一次" }], type: "主动" },
      { name: "天道罡风", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "所有风系技能范围扩大至全体，伤害提高{p}%" }], type: "被动" },
      { name: "风神领域", components: [{ mechanic: "extra_action", trigger: "on_turn_end", desc: "行动后{p}%概率再次行动" }], type: "被动" },
    ],
  },

  // ── 木系 ──────────────────────────────────────────────────────────────
  // 核心：恢复血量和法力，给队友回血回蓝，奶妈
  "木系": {
    "下品": [
      { name: "回春术", components: [{ mechanic: "heal_single", trigger: "active", desc: "恢复自身{n}点生命" }], type: "主动" },
      { name: "木刺术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }], type: "主动" },
      { name: "藤蔓术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { mechanic: "cc_root", trigger: "active", desc: "{p}%概率禁锢目标" }], type: "主动" },
      { name: "生机", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "所有恢复效果提高{p}%" }], type: "被动" },
      { name: "藤甲", components: [{ mechanic: "buff_shield", trigger: "on_turn_start", desc: "每回合自动获得{n}点护盾" }], type: "被动" },
    ],
    "中品": [
      { name: "治愈术", components: [{ mechanic: "heal_single", trigger: "active", desc: "恢复自身或队友{n}点生命" }], type: "主动" },
      { name: "荆棘术", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { mechanic: "counter", trigger: "on_hit", desc: "受到攻击时反伤{n}点" }], type: "主动" },
      { name: "花毒弹", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { status: "poison", trigger: "active", desc: "附带中毒效果" }], type: "主动" },
      { name: "木灵", components: [{ mechanic: "heal_single", trigger: "on_turn_end", desc: "回合结束自动恢复{n}点生命" }], type: "被动" },
      { name: "古木之力", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "最大生命值提高{p}%" }], type: "被动" },
    ],
    "上品": [
      { name: "万木生长", components: [{ mechanic: "heal_aoe", trigger: "active", desc: "恢复全队{n}点生命" }], type: "主动" },
      { name: "树界降诞", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { mechanic: "buff_shield", trigger: "active", desc: "全队获得{n}点护盾" }], type: "主动" },
      { name: "生命汲取", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { mechanic: "heal_lifesteal_pct", trigger: "active", desc: "恢复造成伤害{p}%的生命" }], type: "主动" },
      { name: "木遁", components: [{ mechanic: "buff_dodge", trigger: "on_fatal", desc: "受到致命伤时{p}%概率闪避" }], type: "被动" },
      { name: "生命之种", components: [{ mechanic: "heal_single", trigger: "on_turn_start", condition: "自动恢复生命最低的队友", desc: "恢复{n}点生命" }], type: "被动" },
    ],
    "极品": [
      { name: "古树降临", components: [{ mechanic: "summon", trigger: "active", desc: "召唤古树攻击造成{n}点法伤" }, { mechanic: "heal_aoe", trigger: "active", desc: "同时恢复全队{n}点生命" }], type: "主动" },
      { name: "枯荣轮转", components: [{ mechanic: "dmg_single", trigger: "active", condition: "损失生命越多", desc: "造成{n}点法伤，伤害越高" }], type: "主动" },
      { name: "天地生根", components: [{ mechanic: "heal_aoe", trigger: "active", desc: "恢复全队{n}点生命且恢复量每回合递增" }], type: "主动" },
      { name: "万木之灵", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "每有一名存活队友", desc: "提高自身恢复效果{p}%" }], type: "被动" },
      { name: "生命共享", components: [{ mechanic: "heal_single", trigger: "passive", condition: "队友恢复时", desc: "自身同步恢复{n}点生命" }], type: "被动" },
    ],
    "仙品": [
      { name: "青帝长生诀", components: [{ mechanic: "heal_aoe", trigger: "active", desc: "恢复全队{n}点生命，恢复效果翻倍" }], type: "主动" },
      { name: "万木归春", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤" }, { mechanic: "cleanse", trigger: "active", desc: "{p}%概率净化全队负面效果" }], type: "主动" },
      { name: "枯木逢春", components: [{ mechanic: "heal_single", trigger: "active", condition: "自身生命越低恢复量越高", desc: "恢复{n}点生命" }], type: "主动" },
      { name: "不死青木", components: [{ mechanic: "death_ward", trigger: "on_fatal", desc: "{p}%概率受到致命伤时保留1点生命" }], type: "被动" },
      { name: "生命之泉", components: [{ mechanic: "heal_aoe", trigger: "passive", desc: "恢复技能同时对全队生效，恢复{n}点生命" }], type: "被动" },
    ],
    "神品": [
      { name: "万物复苏", components: [{ mechanic: "revive", trigger: "active", desc: "复活已死亡队友并恢复{n}点生命" }], type: "主动" },
      { name: "世界树", components: [{ mechanic: "heal_aoe", trigger: "active", desc: "恢复全队{n}点生命并永久提高全队属性" }], type: "主动" },
      { name: "天地同春", components: [{ mechanic: "heal_aoe", trigger: "active", desc: "恢复全队{n}点生命" }, { mechanic: "death_ward", trigger: "passive", desc: "全队受到致命伤时保留1点生命，持续{p}%回合" }], type: "主动" },
      { name: "长生道体", components: [{ mechanic: "heal_aoe", trigger: "on_turn_start", desc: "全队每回合恢复{n}点生命" }], type: "被动" },
      { name: "万木之主", components: [{ mechanic: "buff_stat", trigger: "passive", desc: "全队所有恢复效果提高{p}%且不可被抑制" }], type: "被动" },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 体系校验
// ═══════════════════════════════════════════════════════════════════════════

export function normalizeGongfaSystem(raw: unknown): GongfaSystem {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if ((GONGFA_SYSTEM_KEYS as readonly string[]).includes(trimmed)) {
      return trimmed as GongfaSystem;
    }
  }
  return GONGFA_SYSTEM_KEYS[Math.floor(Math.random() * GONGFA_SYSTEM_KEYS.length)];
}

// ═══════════════════════════════════════════════════════════════════════════
// 角色定位校验
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_TO_EFFECT_TYPE: Record<GongfaRole, GongfaEffectType> = {
  "攻击": "主动",
  "辅助": "被动",
};

export function normalizeGongfaRole(raw: unknown): GongfaRole | undefined {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "攻击" || trimmed === "辅助") return trimmed;
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// 法力消耗计算
// ═══════════════════════════════════════════════════════════════════════════

const TI_XIU_MP_COST_RATIO = 0.2;

export function calcGongfaMpCost(
  effect: { type: GongfaEffectType; components: readonly EffectComponent[] },
  system: GongfaSystem,
  grade: ItemGrade,
): number {
  if (effect.type === "被动") return 0;

  if (effect.components.some(c => c.mechanic === "sacrifice")) return 0;

  const gradeIdx = GRADE_ORDER.indexOf(grade);
  const base = GONGFA_MP_COST_BY_GRADE[Math.max(0, Math.min(gradeIdx, GONGFA_MP_COST_BY_GRADE.length - 1))];

  if (system === "体修") return Math.round(base * TI_XIU_MP_COST_RATIO);

  return base;
}

function pickFromPool(pool: readonly GongfaSpecialEffect[]): GongfaSpecialEffect {
  return { ...pool[Math.floor(Math.random() * pool.length)] };
}

function withMpCost(effect: GongfaSpecialEffect, system: GongfaSystem, grade: ItemGrade): GongfaSpecialEffect {
  effect.mpCost = calcGongfaMpCost(effect, system, grade);
  return effect;
}

function filterPool(pool: readonly GongfaSpecialEffect[], effectType?: GongfaEffectType): readonly GongfaSpecialEffect[] {
  if (!effectType) return pool;
  const filtered = pool.filter(e => e.type === effectType);
  return filtered.length > 0 ? filtered : pool;
}

export function rollGongfaFunction(system: GongfaSystem, grade: ItemGrade, role?: GongfaRole): GongfaSpecialEffect {
  const systemCatalog = GONGFA_EFFECT_CATALOG[system];
  const gradeIdx = GRADE_ORDER.indexOf(grade);
  const effectType = role ? ROLE_TO_EFFECT_TYPE[role] : undefined;
  const weights = GRADE_EFFECT_ROLL_WEIGHTS[grade];

  const candidates: { pool: readonly GongfaSpecialEffect[]; weight: number }[] = [];
  for (let i = 0; i < weights.length; i++) {
    const sourceIdx = gradeIdx - i;
    if (sourceIdx < 0) break;
    const pool = filterPool(systemCatalog[GRADE_ORDER[sourceIdx]], effectType);
    if (pool.length > 0) {
      candidates.push({ pool, weight: weights[i] });
    }
  }

  if (candidates.length > 0) {
    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) return withMpCost(pickFromPool(c.pool), system, grade);
    }
    return withMpCost(pickFromPool(candidates[candidates.length - 1].pool), system, grade);
  }

  for (const sys of Object.values(GONGFA_EFFECT_CATALOG)) {
    for (const g of GRADE_ORDER) {
      const fallbackPool = filterPool(sys[g], effectType);
      if (fallbackPool.length > 0) return withMpCost(pickFromPool(fallbackPool), system, grade);
    }
  }

  for (const sys of Object.values(GONGFA_EFFECT_CATALOG)) {
    for (const g of GRADE_ORDER) {
      if (sys[g].length > 0) return withMpCost(pickFromPool(sys[g]), system, grade);
    }
  }

  return withMpCost({ name: "默认", components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点伤害" }], type: "主动" }, system, grade);
}

// ═══════════════════════════════════════════════════════════════════════════
// 物品定义
// ═══════════════════════════════════════════════════════════════════════════

export interface GongfaItemDefinition {
  itemType: "功法";
  name: string;
  desc: string;
  grade: ItemGrade;
  count: number;
  bonus: ItemBonusMap;
  system?: GongfaSystem;
  role?: GongfaRole;
  function?: GongfaSpecialEffect;
  mastery?: number;
  masteryExp?: number;
}
