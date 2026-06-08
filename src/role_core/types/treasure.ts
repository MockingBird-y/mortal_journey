/**
 * 法宝：物品定义 + 特殊效果（名称 + 效果组件）。
 * 法宝的 function 由系统根据品阶从效果目录中随机分配，不由 AI 生成。
 */

import type { ItemGrade } from "./itemInfo";
import type { EffectComponent } from "./combatMechanics";

// ═══════════════════════════════════════════════════════════════════════════
// 特殊效果
// ═══════════════════════════════════════════════════════════════════════════

export interface TreasureSpecialEffect {
  name: string;
  components: readonly EffectComponent[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 效果目录（按品阶）
// ═══════════════════════════════════════════════════════════════════════════

export const TREASURE_EFFECT_CATALOG: Readonly<Record<ItemGrade, readonly TreasureSpecialEffect[]>> = {
  "下品": [
    { name: "碎甲", components: [{ mechanic: "debuff_def", trigger: "on_attack", desc: "攻击时降低敌人{p}%护体" }] },
    { name: "追击", components: [{ mechanic: "extra_action", trigger: "on_kill", desc: "击杀敌人后{p}%概率追加一次攻击" }] },
    { name: "韧骨", components: [{ mechanic: "buff_crit_dmg", trigger: "passive", desc: "减少受到的{p}%暴击伤害" }] },
    { name: "灼血", components: [{ mechanic: "dmg_dot", trigger: "on_attack", desc: "普通攻击附带{n}点持续伤害" }] },
    { name: "残兵", components: [{ mechanic: "dmg_execute", trigger: "on_attack", condition: "敌人生命低于50%", desc: "对低血量敌人伤害提高{n}点" }] },
    { name: "凝神", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "连续使用相同技能时", desc: "法力消耗降低{p}%" }] },
    { name: "破势", components: [{ mechanic: "dmg_single", trigger: "on_attack", condition: "目标满血时", desc: "攻击满血敌人时伤害提高{n}点" }] },
    { name: "敛息", components: [{ mechanic: "buff_stealth", trigger: "on_battle_start", desc: "第一回合有{p}%概率不会被选为首要攻击对象" }] },
  ],
  "中品": [
    { name: "养剑", components: [{ mechanic: "buff_ramp", trigger: "on_turn_start", desc: "每回合增加{p}%劲力，直到战斗结束" }] },
    { name: "回春", components: [{ mechanic: "heal_single", trigger: "passive", condition: "每损失一定生命", desc: "恢复{n}点生命" }] },
    { name: "逆脉", components: [{ mechanic: "sacrifice", trigger: "active", condition: "法力不足时", desc: "透支{p}%生命释放技能" }] },
    { name: "灵爆", components: [{ mechanic: "buff_atk", trigger: "passive", condition: "法力满时", desc: "技能伤害提升{p}%" }] },
    { name: "聚灵", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "周围敌人越多", desc: "法力恢复越高，最高{p}%" }] },
    { name: "识破", components: [{ mechanic: "counter", trigger: "on_hit", condition: "重复攻击自己的敌人", desc: "额外造成{n}点伤害" }] },
    { name: "夺势", components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀敌人后，获得其{p}%劲力神识直到战斗结束" }] },
    { name: "封喉", components: [
      { mechanic: "buff_crit", trigger: "on_attack", condition: "低生命敌人", desc: "必定暴击，暴击率提高{p}%" },
      { mechanic: "dmg_execute", trigger: "on_attack", condition: "低生命敌人", desc: "额外造成{n}点伤害" },
    ] },
  ],
  "上品": [
    { name: "剑心", components: [{ mechanic: "buff_ramp", trigger: "on_turn_start", condition: "未受到伤害时", desc: "攻击每回合提升{p}%" }] },
    { name: "道种", components: [{ mechanic: "buff_stat", trigger: "on_battle_start", desc: "战斗开始随机获得一种{p}%临时增益" }] },
    { name: "借命", components: [{ mechanic: "death_ward", trigger: "on_fatal", desc: "受到致命伤时有{p}%概率不死，并保留1点生命（每场一次）" }] },
    { name: "空蝉", components: [{ mechanic: "counter", trigger: "on_dodge", desc: "闪避攻击后，下一次攻击额外造成{n}点伤害" }] },
    { name: "共鸣", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "拥有相同灵根的队友", desc: "互相提升{p}%属性" }] },
    { name: "众生因果", components: [{ mechanic: "heal_lifesteal", trigger: "passive", desc: "敌人受到的治疗，{p}%会同步治疗你" }] },
    { name: "灵壳", components: [{ mechanic: "buff_shield", trigger: "passive", condition: "获得护盾时", desc: "额外获得{n}点防御" }] },
    { name: "反伤", components: [{ mechanic: "reflect", trigger: "on_hit", desc: "受到伤害时反弹{p}%" }] },
  ],
  "极品": [
    { name: "杀意", components: [{ mechanic: "buff_ramp", trigger: "on_attack", desc: "攻击次数越多，伤害越高，每次提升{p}%" }] },
    { name: "生命之种", components: [{ mechanic: "kill_bonus", trigger: "on_kill", desc: "击杀敌人，恢复自身和队友{p}%血量" }] },
    { name: "一击必杀", components: [{ mechanic: "dmg_execute", trigger: "on_attack", condition: "敌人境界低于自身", desc: "额外造成{n}点伤害" }] },
    { name: "魔心", components: [{ mechanic: "buff_crit", trigger: "passive", condition: "生命越低", desc: "暴击率越高，最高提升{p}%" }] },
    { name: "业火", components: [{ mechanic: "dmg_dot", trigger: "on_turn_start", desc: "敌人每次行动都会受到{n}点持续伤害" }] },
    { name: "献祭", components: [
      { mechanic: "sacrifice", trigger: "passive", desc: "永久降低{p}%生命上限" },
      { mechanic: "buff_atk", trigger: "passive", desc: "大幅提高攻击{p}%" },
    ] },
    { name: "黄泉", components: [{ mechanic: "dmg_execute", trigger: "on_attack", condition: "敌人生命越低", desc: "额外造成{n}点伤害" }] },
    { name: "万法归一", components: [{ mechanic: "buff_ramp", trigger: "on_attack", condition: "连续使用不同技能时", desc: "伤害每层提升{p}%" }] },
    { name: "瞬杀号", components: [{ mechanic: "buff_ramp", trigger: "on_attack", condition: "连续攻击同一目标时", desc: "暴击率每层提升{p}%" }] },
  ],
  "仙品": [
    { name: "噬灵", components: [{ mechanic: "heal_lifesteal", trigger: "on_attack", desc: "攻击附带{p}%吸血" }] },
    { name: "夺萃", components: [{ mechanic: "heal_lifesteal", trigger: "on_attack", desc: "造成伤害时恢复造成伤害的{p}%法力" }] },
    { name: "通灵", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "主角境界提升时", desc: "增加{p}%属性加成" }] },
    { name: "链接", components: [{ mechanic: "damage_share", trigger: "on_hit", desc: "自身受到的伤害{p}%均摊到队友身上" }] },
    { name: "城墙", components: [{ mechanic: "damage_share", trigger: "passive", desc: "分摊队友{p}%的伤害" }] },
    { name: "天演", components: [{ mechanic: "buff_stat", trigger: "on_turn_start", desc: "每回合随机强化{p}%的一种属性" }] },
    { name: "香火", components: [{ mechanic: "heal_single", trigger: "on_turn_start", condition: "存活队友越多", desc: "每名队友使自身恢复{n}点生命" }] },
  ],
  "神品": [
    { name: "血怒", components: [{ mechanic: "buff_ramp", trigger: "passive", condition: "血量越低", desc: "伤害越高，最高提升{p}%" }] },
    { name: "天道无情", components: [{ mechanic: "dmg_single", trigger: "on_attack", condition: "敌方生命越高", desc: "额外造成{n}点伤害" }] },
    { name: "众生愿", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "队友每少一人", desc: "自身属性提升{p}%" }] },
    { name: "虚实逆转", components: [{ mechanic: "buff_atk", trigger: "passive", condition: "受到的治疗", desc: "转化为{p}%攻击力" }] },
    { name: "红尘劫", components: [{ mechanic: "dmg_single", trigger: "on_attack", condition: "年龄占比寿元越少", desc: "额外造成{n}点伤害" }] },
    { name: "羽化", components: [{ mechanic: "buff_stat", trigger: "passive", condition: "每经历一场战斗", desc: "永久获得{p}%随机属性" }] },
    { name: "无畏", components: [
      { mechanic: "buff_def", trigger: "passive", condition: "敌人境界高于自身时", desc: "减伤{p}%" },
      { mechanic: "buff_atk", trigger: "passive", condition: "敌人境界高于自身时", desc: "增伤{p}%" },
    ] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 跨品阶加权随机分配
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

export function rollTreasureFunction(grade: ItemGrade): TreasureSpecialEffect {
  const gradeIdx = GRADE_ORDER.indexOf(grade);
  const weights = GRADE_EFFECT_ROLL_WEIGHTS[grade];

  const candidates: { pool: readonly TreasureSpecialEffect[]; weight: number }[] = [];
  for (let i = 0; i < weights.length; i++) {
    const sourceIdx = gradeIdx - i;
    if (sourceIdx < 0) break;
    const pool = TREASURE_EFFECT_CATALOG[GRADE_ORDER[sourceIdx]];
    if (pool.length > 0) {
      candidates.push({ pool, weight: weights[i] });
    }
  }

  if (candidates.length > 0) {
    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) return { ...c.pool[Math.floor(Math.random() * c.pool.length)] };
    }
    const last = candidates[candidates.length - 1];
    return { ...last.pool[Math.floor(Math.random() * last.pool.length)] };
  }

  return { ...TREASURE_EFFECT_CATALOG["下品"][0] };
}

// ═══════════════════════════════════════════════════════════════════════════
// 物品定义
// ═══════════════════════════════════════════════════════════════════════════

export interface TreasureItemDefinition {
  itemType: "法宝";
  name: string;
  desc: string;
  grade: ItemGrade;
  count: number;
  function?: TreasureSpecialEffect;
}
