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
  "体修",
  "法修",
  "毒系",
  "魔修",
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
  mpCost: number;
  cooldown: number;
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

  // ── 体修 ──────────────────────────────────────────────────────────────
  // 核心：高额血量/防御，被动反伤，替队友承伤，攻击获取护盾/防御
  "体修": {
    "下品": [
      { name: "震脉击", mpCost: 3, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 50, scalingRatio: 2.94, scalingStat: "strength" }, { mechanic: "buff_def", trigger: "active", desc: "攻击后提高{p}%护体", baseValue: 0.05, scalingRatio: 0, scalingStat: "strength" }], type: "主动" },
      { name: "铁膝撞", mpCost: 3, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 50, scalingRatio: 2.94, scalingStat: "strength" }, { mechanic: "buff_shield", trigger: "active", desc: "获取{n}点护盾", baseValue: 72, scalingRatio: 7.2, scalingStat: "guard" }], type: "主动" },
      { name: "崩山拳", mpCost: 3, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤，概率吸引敌人攻击自己", baseValue: 50, scalingRatio: 2.94, scalingStat: "strength" }], type: "主动" },
      { name: "铁骨", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_def", trigger: "passive", desc: "永久提高{n}点护体和灵御", baseValue: 30, scalingRatio: 1.76, scalingStat: "strength" }], type: "被动" },
    ],
    "中品": [
      { name: "霸体冲撞", mpCost: 6, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤并击退目标", baseValue: 100, scalingRatio: 1.33, scalingStat: "strength" }, { mechanic: "buff_shield", trigger: "active", desc: "自身获得{n}点护盾", baseValue: 144, scalingRatio: 3.2, scalingStat: "guard" }], type: "主动" },
      { name: "血燃拳", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命", baseValue: 0.08, scalingRatio: 0, scalingStat: "strength" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 100, scalingRatio: 1.33, scalingStat: "strength" }, { mechanic: "buff_def", trigger: "active", desc: "攻击后获取{p}%护体灵御", baseValue: 0.08, scalingRatio: 0, scalingStat: "strength" }], type: "主动" },
      { name: "裂地击", mpCost: 6, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物伤，吸引全体敌人攻击自己一回合", baseValue: 100, scalingRatio: 1.33, scalingStat: "strength" }], type: "主动" },
      { name: "反震体", mpCost: 0, cooldown: 0, components: [{ mechanic: "reflect", trigger: "on_hit", desc: "反弹{p}%伤害", baseValue: 0.08, scalingRatio: 0, scalingStat: "strength" }], type: "被动" },
    ],
    "上品": [
      { name: "山岳投", mpCost: 12, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 260, scalingRatio: 1.3, scalingStat: "strength" }], type: "主动" },
      { name: "不动明王拳", mpCost: 12, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 200, scalingRatio: 1, scalingStat: "strength" }, { mechanic: "damage_share", trigger: "active", desc: "数回合内替队友承受{p}%伤害", baseValue: 0.13, scalingRatio: 0, scalingStat: "strength" }], type: "主动" },
      { name: "金刚怒目", mpCost: 12, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 200, scalingRatio: 1, scalingStat: "strength" }, { mechanic: "buff_shield", trigger: "active", desc: "将造成伤害的一半转化为{n}点护盾", baseValue: 288, scalingRatio: 8, scalingStat: "guard" }], type: "主动" },
      { name: "金刚不坏", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_def", trigger: "passive", desc: "数回合内受到伤害降低{p}%", baseValue: 0.13, scalingRatio: 0, scalingStat: "strength" }], type: "被动" },
      { name: "涅槃之气", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_shield", trigger: "passive", desc: "获得{n}点护盾", baseValue: 288, scalingRatio: 8, scalingStat: "guard" }], type: "被动" },
    ],
    "极品": [
      { name: "不灭金身", mpCost: 24, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 400, scalingRatio: 0.63, scalingStat: "strength" }, { mechanic: "buff_shield", trigger: "active", desc: "将全部造成伤害转化为{n}点护盾", baseValue: 576, scalingRatio: 5.05, scalingStat: "guard" }], type: "主动" },
      { name: "天地崩", mpCost: 24, cooldown: 0, components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点物伤，吸引全体攻击自己", baseValue: 256, scalingRatio: 0.4, scalingStat: "strength" }], type: "主动" },
      { name: "涅槃击", mpCost: 24, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 560, scalingRatio: 0.88, scalingStat: "strength" }], type: "主动" },
      { name: "血战", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "劲力和护体提高{p}%", baseValue: 0.2, scalingRatio: 0, scalingStat: "strength" }], type: "被动" },
      { name: "铁山靠", mpCost: 0, cooldown: 0, components: [{ mechanic: "cc_stun", trigger: "on_hit", desc: "受到攻击时有{p}%概率眩晕攻击者", baseValue: 0.6 }], type: "被动" },
    ],
    "仙品": [
      { name: "九转天拳", mpCost: 50, cooldown: 0, components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点超高物伤", baseValue: 1080, scalingRatio: 0.86, scalingStat: "strength" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%防御", baseValue: 0.3, scalingRatio: 0, scalingStat: "strength" }, { mechanic: "buff_shield", trigger: "active", desc: "获得{n}点护盾", baseValue: 1152, scalingRatio: 5.12, scalingStat: "guard" }], type: "主动" },
      { name: "法相天地", mpCost: 50, cooldown: 0, components: [{ mechanic: "damage_share", trigger: "active", desc: "替全体队友承受{p}%伤害", baseValue: 0.3, scalingRatio: 0, scalingStat: "strength" }, { mechanic: "heal_single", trigger: "active", desc: "同时恢复自身{n}点生命", baseValue: 640, scalingRatio: 0.51, scalingStat: "perception" }], type: "主动" },
      { name: "金身怒目", mpCost: 50, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 800, scalingRatio: 0.64, scalingStat: "strength" }, { mechanic: "heal_single", trigger: "active", desc: "命中后恢复{n}点生命", baseValue: 640, scalingRatio: 0.51, scalingStat: "perception" }, { mechanic: "buff_def", trigger: "active", desc: "获取{p}%护体", baseValue: 0.3, scalingRatio: 0, scalingStat: "strength" }], type: "主动" },
      { name: "九转金身", mpCost: 0, cooldown: 0, components: [{ mechanic: "death_ward", trigger: "passive", desc: "数回合内受到伤害不会低于{n}点生命", baseValue: 640, scalingRatio: 0.51, scalingStat: "strength" }], type: "被动" },
      { name: "肉身成圣", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_def", trigger: "passive", desc: "所有防御属性提高{n}点", baseValue: 480, scalingRatio: 0.38, scalingStat: "strength" }], type: "被动" },
    ],
    "神品": [
      { name: "天地法相拳", mpCost: 100, cooldown: 3, components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点毁灭性物伤", baseValue: 1536, scalingRatio: 1.02, scalingStat: "strength" }, { mechanic: "buff_shield", trigger: "active", desc: "造成伤害全部转化为{n}点自身护盾", baseValue: 2304, scalingRatio: 8.53, scalingStat: "guard" }], type: "主动" },
      { name: "涅槃重生击", mpCost: 100, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 1600, scalingRatio: 1.07, scalingStat: "strength" }, { mechanic: "kill_bonus", trigger: "on_kill", condition: "若击杀目标", desc: "恢复{p}%生命", baseValue: 0.42, scalingRatio: 0, scalingStat: "strength" }], type: "主动" },
      { name: "万法不侵身", mpCost: 100, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点物理伤害", baseValue: 1600, scalingRatio: 1.07, scalingStat: "strength" }, { mechanic: "damage_share", trigger: "active", desc: "数回合内替全体队友承受{p}%伤害", baseValue: 0.42, scalingRatio: 0, scalingStat: "strength" }, { trigger: "passive", desc: "免疫特殊效果" }], type: "主动" },
      { name: "不朽", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_def", trigger: "passive", desc: "受到任何伤害不超过最大生命{p}%", baseValue: 0.42, scalingRatio: 0, scalingStat: "strength" }], type: "被动" },
    ],
  },

  // ── 法修 ──────────────────────────────────────────────────────────────
  // 核心：法攻/法力，打AOE法伤，频繁施法，施法链
  "法修": {
    "下品": [
      { name: "法弹术", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 50, scalingRatio: 2.94, scalingStat: "perception" }], type: "主动" },
      { name: "灵光弹", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 50, scalingRatio: 2.94, scalingStat: "perception" }], type: "主动" },
      { name: "灵压冲击", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 50, scalingRatio: 2.94, scalingStat: "perception" }], type: "主动" },
      { name: "法力流转", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "法力消耗降低{p}%", baseValue: 0.05, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
    ],
    "中品": [
      { name: "灵海冲击", mpCost: 30, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 130, scalingRatio: 1.73, scalingStat: "perception" }], type: "主动" },
      { name: "法力潮汐", mpCost: 30, cooldown: 0, components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点法术伤害", baseValue: 85, scalingRatio: 1.13, scalingStat: "perception" }, { mechanic: "buff_stat", trigger: "active", desc: "命中后恢复{p}%法力", baseValue: 0.08, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "灵能爆破", mpCost: 30, cooldown: 0, components: [{ mechanic: "buff_ramp", trigger: "active", desc: "每层增伤{p}%", baseValue: 0.08, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "灵台清明", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "释放技能时有{p}%概率不消耗法力", baseValue: 0.13, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
      { name: "法盾", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_shield", trigger: "active", desc: "消耗法力获得{n}点护盾", baseValue: 80, scalingRatio: 1.78, scalingStat: "guard" }], type: "被动" },
    ],
    "上品": [
      { name: "法相显化", mpCost: 60, cooldown: 0, components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点法术伤害", baseValue: 170, scalingRatio: 0.85, scalingStat: "perception" }, { mechanic: "buff_crit", trigger: "active", desc: "提高{p}%法术暴击率", baseValue: 0.13, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "灵元爆发", mpCost: 60, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 260, scalingRatio: 1.3, scalingStat: "perception" }], type: "主动" },
      { name: "法力洪流", mpCost: 60, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 200, scalingRatio: 1, scalingStat: "perception" }], type: "主动" },
      { name: "元神共振", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "法伤提升{p}%", baseValue: 0.13, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
    ],
    "极品": [
      { name: "太虚法印", mpCost: 120, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 400, scalingRatio: 0.63, scalingStat: "perception" }], type: "主动" },
      { name: "万法归一", mpCost: 120, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 400, scalingRatio: 0.63, scalingStat: "perception" }, { mechanic: "buff_ramp", trigger: "active", desc: "命中后下一次技能伤害提高{p}%", baseValue: 0.2, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "法则之雷", mpCost: 120, cooldown: 0, components: [{ mechanic: "dmg_pierce", trigger: "active", desc: "对全体敌人造成{n}点法术伤害", baseValue: 360, scalingRatio: 0.57, scalingStat: "perception" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%法防", baseValue: 0.2, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "天道法则", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "提供{n}点额外法攻", baseValue: 50, scalingRatio: 0.08, scalingStat: "perception" }], type: "被动" },
      { name: "法力暴走", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "技能伤害提高{p}%", baseValue: 0.2, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
    ],
    "仙品": [
      { name: "神机法", mpCost: 250, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤，必定触发附加效果", baseValue: 800, scalingRatio: 0.64, scalingStat: "perception" }], type: "主动" },
    ],
    "神品": [
      { name: "万法寂灭", mpCost: 500, cooldown: 3, components: [{ mechanic: "cc_silence", trigger: "active", desc: "{p}%概率封锁全场不能使用功法", baseValue: 0.9 }, { mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点法伤", baseValue: 1360, scalingRatio: 0.91, scalingStat: "perception" }], type: "主动" },
      { name: "万法之源", mpCost: 500, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤，概率触发所有已学功法效果", baseValue: 1600, scalingRatio: 1.07, scalingStat: "perception" }], type: "主动" },
      { name: "道法自然", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "法力永不低于{n}点", baseValue: 800, scalingRatio: 0.53, scalingStat: "perception" }], type: "被动" },
      { name: "天道推演", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "所有法系技能效果提升{p}%", baseValue: 0.42, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
    ],
  },

  // ── 毒系 ──────────────────────────────────────────────────────────────
  // 核心：中毒扣百分比生命，拖时间回血耗死敌人，持续伤害
  "毒系": {
    "下品": [
      { name: "毒手", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 50, scalingRatio: 2.94, scalingStat: "perception" }, { status: "poison", trigger: "active", desc: "附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "active", desc: "每回合扣除目标{p}%最大生命", baseValue: 0.02, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "蚀骨掌", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 50, scalingRatio: 2.94, scalingStat: "perception" }, { status: "poison", trigger: "active", desc: "附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "active", desc: "每回合扣除{p}%最大生命", baseValue: 0.02, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "debuff_def", trigger: "active", desc: "降低{p}%防御", baseValue: 0.05, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "毒雾弥漫", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 50, scalingRatio: 2.94, scalingStat: "perception" }, { status: "poison", trigger: "active", desc: "概率附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "active", desc: "每回合扣除目标{p}%最大生命", baseValue: 0.02, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "毒灵转生", mpCost: 0, cooldown: 0, components: [{ mechanic: "heal_single", trigger: "on_kill", desc: "恢复{n}点生命", baseValue: 40, scalingRatio: 2.35, scalingStat: "perception" }], type: "被动" },
      { name: "腐蚀之触", mpCost: 0, cooldown: 0, components: [{ mechanic: "debuff_heal", trigger: "on_attack", desc: "攻击自动降低敌方{p}%恢复效果", baseValue: 0.05, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
    ],
    "中品": [
      { name: "蛊毒针", mpCost: 30, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 100, scalingRatio: 1.33, scalingStat: "perception" }, { status: "poison", trigger: "active", desc: "附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "active", desc: "每回合扣除目标{p}%最大生命", baseValue: 0.03, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "腐血术", mpCost: 30, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 100, scalingRatio: 1.33, scalingStat: "perception" }, { status: "poison", trigger: "active", desc: "附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "active", desc: "每回合扣除{p}%最大生命", baseValue: 0.03, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "debuff_heal", trigger: "active", desc: "降低{p}%恢复效果", baseValue: 0.08, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "毒刃斩", mpCost: 30, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 100, scalingRatio: 1.33, scalingStat: "perception" }, { mechanic: "buff_atk", trigger: "active", desc: "额外增伤{p}%", baseValue: 0.11, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
    ],
    "上品": [
      { name: "毒丹爆", mpCost: 60, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点毒伤", baseValue: 260, scalingRatio: 1.3, scalingStat: "perception" }], type: "主动" },
      { name: "蛊虫噬心", mpCost: 60, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 200, scalingRatio: 1, scalingStat: "perception" }, { status: "poison", trigger: "active", desc: "附加中毒" }, { mechanic: "dmg_dot_pct", trigger: "active", desc: "每回合扣除{p}%最大生命", baseValue: 0.05, scalingRatio: 0, scalingStat: "perception" }, { trigger: "on_kill", desc: "击杀后扩散至其他敌人" }], type: "主动" },
      { name: "猛毒注入", mpCost: 0, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 200, scalingRatio: 1, scalingStat: "perception" }, { status: "poison", trigger: "active", desc: "附加强力中毒" }, { mechanic: "dmg_dot_pct", trigger: "active", desc: "每回合扣除{p}%最大生命，持续时间延长", baseValue: 0.05, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
      { name: "剧毒之躯", mpCost: 0, cooldown: 0, components: [{ status: "poison", trigger: "on_hit", condition: "受到近身攻击时", desc: "自动施加中毒" }], type: "被动" },
    ],
    "极品": [
      { name: "天毒降", mpCost: 120, cooldown: 0, components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点法术伤害", baseValue: 320, scalingRatio: 0.51, scalingStat: "perception" }, { status: "poison", trigger: "active", desc: "附加中毒" }], type: "主动" },
      { name: "万蛊噬心", mpCost: 120, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 400, scalingRatio: 0.63, scalingStat: "perception" }, { mechanic: "buff_atk", trigger: "active", desc: "受到的所有伤害提高{p}%", baseValue: 0.26, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "毒灵引爆", mpCost: 120, cooldown: 0, components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "造成{n}点法伤", baseValue: 416, scalingRatio: 0.66, scalingStat: "perception" }], type: "主动" },
      { name: "腐天", mpCost: 0, cooldown: 0, components: [{ mechanic: "dmg_dot_pct", trigger: "on_crit", desc: "额外扣除{p}%最大生命", baseValue: 0.1, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
      { name: "万毒化身", mpCost: 0, cooldown: 0, components: [{ trigger: "passive", desc: "自身免疫中毒" }, { mechanic: "buff_stat", trigger: "passive", desc: "增伤{p}%", baseValue: 0.26, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
    ],
    "仙品": [
      { name: "百毒灭世", mpCost: 250, cooldown: 2, components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点法伤，中毒效果翻倍", baseValue: 640, scalingRatio: 0.51, scalingStat: "perception" }], type: "主动" },
      { name: "不死蛊", mpCost: 250, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 800, scalingRatio: 0.64, scalingStat: "perception" }, { mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀目标恢复{n}点生命和法力", baseValue: 640, scalingRatio: 0.51, scalingStat: "perception" }], type: "主动" },
      { name: "化毒攻击", mpCost: 250, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 800, scalingRatio: 0.64, scalingStat: "perception" }, { status: "poison", trigger: "active", desc: "将自身所受伤害的{p}%转化为中毒施加", baseValue: 0.33, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
    ],
    "神品": [
      { name: "万毒归宗", mpCost: 500, cooldown: 3, components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "造成{n}点毁灭性法伤", baseValue: 2304, scalingRatio: 1.54, scalingStat: "perception" }], type: "主动" },
      { name: "死寂", mpCost: 500, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 1600, scalingRatio: 1.07, scalingStat: "perception" }, { mechanic: "dmg_execute", trigger: "active", desc: "目标生命低于50%时额外造成{n}点伤害", baseValue: 1600, scalingRatio: 1.07, scalingStat: "perception" }], type: "主动" },
      { name: "天地毒牢", mpCost: 500, cooldown: 3, components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "对全体造成{n}点法伤", baseValue: 1280, scalingRatio: 0.85, scalingStat: "perception" }], type: "主动" },
      { name: "毒仙之体", mpCost: 0, cooldown: 0, components: [{ trigger: "passive", desc: "免疫所有负面效果" }], type: "被动" },
    ],
  },

  // ── 魔修 ──────────────────────────────────────────────────────────────
  // 核心：消耗血量/法力/寿元换取增强，敌人死亡获得增益，自残流
  "魔修": {
    "下品": [
      { name: "炼血术", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命", baseValue: 0.09, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法术伤害", baseValue: 50, scalingRatio: 2.94, scalingStat: "perception" }], type: "主动" },
      { name: "噬魂爪", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法术伤害", baseValue: 50, scalingRatio: 2.94, scalingStat: "perception" }], type: "主动" },
      { name: "魔气弹", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法术伤害", baseValue: 50, scalingRatio: 2.94, scalingStat: "perception" }, { mechanic: "debuff_atk", trigger: "active", desc: "降低敌方{p}%法攻", baseValue: 0.05, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "魔体", mpCost: 0, cooldown: 0, components: [{ mechanic: "reflect", trigger: "on_hit", desc: "受到伤害时{p}%概率反弹", baseValue: 0.12, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
      { name: "吞噬", mpCost: 0, cooldown: 0, components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀敌人恢复{n}点生命和法力", baseValue: 40, scalingRatio: 2.35, scalingStat: "perception" }], type: "被动" },
    ],
    "中品": [
      { name: "献祭术", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命", baseValue: 0.13, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点超高暗属性法伤", baseValue: 150, scalingRatio: 2, scalingStat: "perception" }], type: "主动" },
      { name: "魔影突击", mpCost: 30, cooldown: 0, components: [{ mechanic: "summon", trigger: "active", desc: "召唤灵体，每回合自动攻击造成{n}点暗属性法伤", baseValue: 2, noMasteryScaling: true }], type: "主动" },
      { name: "噬魂术", mpCost: 30, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法伤，命中后恢复法力", baseValue: 100, scalingRatio: 1.33, scalingStat: "perception" }], type: "主动" },
      { name: "血契", mpCost: 0, cooldown: 0, components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "继承{n}点属性", baseValue: 80, scalingRatio: 1.07, scalingStat: "perception" }], type: "被动" },
      { name: "魔血沸腾", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "法攻提高{p}%", baseValue: 0.08, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
    ],
    "上品": [
      { name: "天魔爪", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命", baseValue: 0.18, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法术伤害", baseValue: 200, scalingRatio: 1, scalingStat: "perception" }, { mechanic: "cc_fear", trigger: "active", desc: "{p}%概率附加恐惧", baseValue: 0.45 }], type: "主动" },
      { name: "血魔突袭", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命和法力", baseValue: 0.18, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法术伤害", baseValue: 260, scalingRatio: 1.3, scalingStat: "perception" }], type: "主动" },
      { name: "魔威震慑", mpCost: 60, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法术伤害", baseValue: 200, scalingRatio: 1, scalingStat: "perception" }, { mechanic: "debuff_atk", trigger: "active", desc: "降低全体敌人{p}%攻击力", baseValue: 0.13, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "血魔之躯", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命", baseValue: 0.18, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "buff_def", trigger: "active", desc: "提高{n}点防御", baseValue: 80, scalingRatio: 0.4, scalingStat: "perception" }, { mechanic: "buff_atk", trigger: "active", desc: "提高{n}点攻击", baseValue: 80, scalingRatio: 0.4, scalingStat: "perception" }], type: "被动" },
      { name: "魔道轮回", mpCost: 0, cooldown: 0, components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "敌人死亡时恢复{n}点生命", baseValue: 160, scalingRatio: 0.8, scalingStat: "perception" }], type: "被动" },
    ],
    "极品": [
      { name: "血祭", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命", baseValue: 0.25, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "dmg_aoe", trigger: "active", desc: "对全体敌人造成{n}点暗属性法伤", baseValue: 320, scalingRatio: 0.51, scalingStat: "perception" }], type: "主动" },
      { name: "天魔附体", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命", baseValue: 0.25, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "buff_stat", trigger: "active", desc: "大幅提高{p}%属性", baseValue: 0.31, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法术伤害", baseValue: 400, scalingRatio: 0.63, scalingStat: "perception" }], type: "主动" },
      { name: "万魂噬", mpCost: 120, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法术伤害", baseValue: 400, scalingRatio: 0.63, scalingStat: "perception" }, { mechanic: "kill_bonus", trigger: "on_kill", desc: "敌人死亡时恢复{n}点法力", baseValue: 320, scalingRatio: 0.51, scalingStat: "perception" }], type: "主动" },
      { name: "轮回印", mpCost: 0, cooldown: 0, components: [{ mechanic: "summon", trigger: "active", desc: "召唤灵体，每回合自动攻击造成{n}点伤害", baseValue: 4, noMasteryScaling: true }], type: "被动" },
      { name: "天怒", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_ramp", trigger: "passive", desc: "伤害提高{p}%", baseValue: 0.2, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
    ],
    "仙品": [
      { name: "焚寿天魔", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%寿元", baseValue: 0.33, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "dmg_pierce", trigger: "active", desc: "造成{n}点暗属性法术伤害", baseValue: 720, scalingRatio: 0.58, scalingStat: "perception" }, { mechanic: "debuff_def", trigger: "active", desc: "无视{p}%防御", baseValue: 0.3, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "幽冥之门", mpCost: 250, cooldown: 0, components: [{ mechanic: "summon", trigger: "active", desc: "召唤灵体，每回合自动攻击造成{n}点暗属性法伤", baseValue: 5, noMasteryScaling: true }], type: "主动" },
      { name: "生死逆轮", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "交换{p}%生命与法力后", baseValue: 0.33, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点暗属性法术伤害", baseValue: 800, scalingRatio: 0.64, scalingStat: "perception" }], type: "主动" },
      { name: "魔道至尊", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "所有魔修技能伤害提高{p}%", baseValue: 0.3, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
      { name: "血海无量", mpCost: 0, cooldown: 0, components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "每次击杀永久提高{n}点生命上限", baseValue: 640, scalingRatio: 0.51, scalingStat: "perception" }], type: "被动" },
    ],
    "神品": [
      { name: "灭世", mpCost: 500, cooldown: 3, components: [{ mechanic: "dmg_aoe", trigger: "active", desc: "消耗全部法力对全场造成{n}点暗属性法伤", baseValue: 1280, scalingRatio: 0.85, scalingStat: "perception" }], type: "主动" },
      { name: "天魔解体", mpCost: 0, cooldown: 0, components: [{ mechanic: "sacrifice", trigger: "active", desc: "消耗{p}%生命", baseValue: 0.42, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "buff_stat", trigger: "active", desc: "提高{p}%属性", baseValue: 0.42, scalingRatio: 0, scalingStat: "perception" }, { mechanic: "dmg_single", trigger: "active", desc: "造成{n}点超高伤害", baseValue: 2400, scalingRatio: 1.6, scalingStat: "perception" }], type: "主动" },
      { name: "魔界降临", mpCost: 500, cooldown: 0, components: [{ mechanic: "dmg_dot", trigger: "active", desc: "消耗生命将战场化为魔域，每回合造成{n}点暗属性法伤", baseValue: 640, scalingRatio: 0.43, scalingStat: "perception" }], type: "主动" },
      { name: "噬魂", mpCost: 0, cooldown: 0, components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀一名敌方永久增加{n}点法攻", baseValue: 1280, scalingRatio: 0.85, scalingStat: "perception" }], type: "被动" },
    ],
  },

  // ── 木系 ──────────────────────────────────────────────────────────────
  // 核心：恢复血量和法力，给队友回血回蓝，奶妈
  "木系": {
    "下品": [
      { name: "回春术", mpCost: 15, cooldown: 0, components: [{ mechanic: "heal_single", trigger: "active", desc: "恢复自身{n}点生命", baseValue: 60, scalingRatio: 3.53, scalingStat: "perception" }], type: "主动" },
      { name: "木刺术", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 30, scalingRatio: 1.76, scalingStat: "perception" }], type: "主动" },
      { name: "藤蔓术", mpCost: 15, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 30, scalingRatio: 1.76, scalingStat: "perception" }, { mechanic: "cc_root", trigger: "active", desc: "{p}%概率禁锢目标", baseValue: 0.2 }], type: "主动" },
      { name: "生机", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "所有恢复效果提高{p}%", baseValue: 0.05, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
    ],
    "中品": [
      { name: "治愈术", mpCost: 30, cooldown: 0, components: [{ mechanic: "heal_single", trigger: "active", desc: "恢复自身或队友{n}点生命", baseValue: 120, scalingRatio: 1.6, scalingStat: "perception" }], type: "主动" },
      { name: "荆棘术", mpCost: 30, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 60, scalingRatio: 0.8, scalingStat: "perception" }, { mechanic: "counter", trigger: "on_hit", desc: "受到攻击时反伤{n}点", baseValue: 60, scalingRatio: 0.8, scalingStat: "perception" }], type: "主动" },
      { name: "花毒弹", mpCost: 30, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 60, scalingRatio: 0.8, scalingStat: "perception" }, { status: "poison", trigger: "active", desc: "附带中毒效果" }], type: "主动" },
      { name: "古木之力", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "最大生命值提高{p}%", baseValue: 0.08, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
    ],
    "上品": [
      { name: "万木生长", mpCost: 60, cooldown: 0, components: [{ mechanic: "heal_aoe", trigger: "active", desc: "恢复全队{n}点生命", baseValue: 192, scalingRatio: 0.96, scalingStat: "perception" }], type: "主动" },
      { name: "树界降诞", mpCost: 60, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 120, scalingRatio: 0.6, scalingStat: "perception" }, { mechanic: "buff_shield", trigger: "active", desc: "全队获得{n}点护盾", baseValue: 160, scalingRatio: 4.44, scalingStat: "guard" }], type: "主动" },
      { name: "生命汲取", mpCost: 60, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 120, scalingRatio: 0.6, scalingStat: "perception" }], type: "主动" },
    ],
    "极品": [
      { name: "古树降临", mpCost: 120, cooldown: 0, components: [{ mechanic: "summon", trigger: "active", desc: "召唤古树攻击造成{n}点法伤", baseValue: 160, scalingRatio: 0.25, scalingStat: "perception" }, { mechanic: "heal_aoe", trigger: "active", desc: "同时恢复全队{n}点生命", baseValue: 384, scalingRatio: 0.61, scalingStat: "perception" }], type: "主动" },
      { name: "枯荣轮转", mpCost: 120, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 288, scalingRatio: 0.45, scalingStat: "perception" }], type: "主动" },
      { name: "天地生根", mpCost: 120, cooldown: 0, components: [{ mechanic: "heal_aoe", trigger: "active", desc: "恢复全队{n}点生命且恢复量每回合递增", baseValue: 384, scalingRatio: 0.61, scalingStat: "perception" }], type: "主动" },
      { name: "万木之灵", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "提高自身恢复效果{p}%", baseValue: 0.2, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
      { name: "生命共享", mpCost: 0, cooldown: 0, components: [{ mechanic: "heal_single", trigger: "passive", desc: "恢复{n}点生命", baseValue: 480, scalingRatio: 0.76, scalingStat: "perception" }], type: "被动" },
    ],
    "仙品": [
      { name: "青帝长生诀", mpCost: 250, cooldown: 0, components: [{ mechanic: "heal_aoe", trigger: "active", desc: "恢复全队{n}点生命，恢复效果翻倍", baseValue: 768, scalingRatio: 0.61, scalingStat: "perception" }], type: "主动" },
      { name: "万木归春", mpCost: 250, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点法伤", baseValue: 480, scalingRatio: 0.38, scalingStat: "perception" }, { mechanic: "cleanse", trigger: "active", desc: "{p}%概率净化全队负面效果", baseValue: 0.33, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "枯木逢春", mpCost: 250, cooldown: 0, components: [{ mechanic: "heal_single", trigger: "active", desc: "恢复{n}点生命", baseValue: 1248, scalingRatio: 1, scalingStat: "perception" }], type: "主动" },
      { name: "生命之泉", mpCost: 0, cooldown: 0, components: [{ mechanic: "heal_aoe", trigger: "passive", desc: "恢复技能同时对全队生效，恢复{n}点生命", baseValue: 768, scalingRatio: 0.61, scalingStat: "perception" }], type: "被动" },
    ],
    "神品": [
      { name: "万物复苏", mpCost: 500, cooldown: 0, components: [{ mechanic: "revive", trigger: "active", desc: "复活已死亡队友并恢复{n}点生命", baseValue: 1920, scalingRatio: 1.28, scalingStat: "perception" }], type: "主动" },
      { name: "世界树", mpCost: 500, cooldown: 0, components: [{ mechanic: "heal_aoe", trigger: "active", desc: "恢复全队{n}点生命并永久提高全队属性", baseValue: 1536, scalingRatio: 1.02, scalingStat: "perception" }], type: "主动" },
      { name: "天地同春", mpCost: 500, cooldown: 0, components: [{ mechanic: "heal_aoe", trigger: "active", desc: "恢复全队{n}点生命", baseValue: 1536, scalingRatio: 1.02, scalingStat: "perception" }, { mechanic: "death_ward", trigger: "passive", desc: "全队受到致命伤时保留1点生命，持续{p}%回合", baseValue: 0.42, scalingRatio: 0, scalingStat: "perception" }], type: "主动" },
      { name: "万木之主", mpCost: 0, cooldown: 0, components: [{ mechanic: "buff_stat", trigger: "passive", desc: "全队所有恢复效果提高{p}%且不可被抑制", baseValue: 0.42, scalingRatio: 0, scalingStat: "perception" }], type: "被动" },
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
  if (effect.mpCost == null) {
    effect.mpCost = calcGongfaMpCost(effect, system, grade);
  }
  if (effect.cooldown == null) {
    effect.cooldown = 0;
  }
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

  return withMpCost({ name: "默认", mpCost: 500, cooldown: 0, components: [{ mechanic: "dmg_single", trigger: "active", desc: "造成{n}点伤害" }], type: "主动" }, system, grade);
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
