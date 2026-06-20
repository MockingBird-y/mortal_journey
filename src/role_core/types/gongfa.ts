import type { ItemBonusMap, ItemGrade } from "./itemInfo";
import type { PrimaryStatKey } from "./playInfo";
import { PRIMARY_STAT_KEY_TO_ZH } from "./playInfo";

export type GongfaScalingStat = PrimaryStatKey;

// ═══════════════════════════════════════════════════════════════════════════
// 功法体系
// ═══════════════════════════════════════════════════════════════════════════

export const GONGFA_SYSTEM_KEYS = [
  "通用",
  "剑修",
  "体修",
  "法修",
  "毒修",
] as const;
export type GongfaSystem = (typeof GONGFA_SYSTEM_KEYS)[number];

// ═══════════════════════════════════════════════════════════════════════════
// 层级数值系统
// 目录中写 [第1层, 第10层]，运行时线性插值生成 10 层
// ═══════════════════════════════════════════════════════════════════════════

export type LayerEndpoints = readonly [number, number];
export type LayerValue = number | LayerEndpoints;

export function expandTo10(endpoints: LayerEndpoints): readonly number[] {
  const [a, b] = endpoints;
  const result: number[] = [];
  for (let i = 0; i < 10; i++) {
    result.push(Math.round(a + (b - a) * i / 9));
  }
  return result;
}

export function atLayer(val: LayerValue, layer: number): number {
  if (typeof val === "number") return val;
  const arr = val.length === 2 ? expandTo10(val) : val;
  const idx = Math.max(0, Math.min(layer - 1, arr.length - 1));
  return arr[idx];
}

function expandTo10Float(endpoints: LayerEndpoints): readonly number[] {
  const [a, b] = endpoints;
  const result: number[] = [];
  for (let i = 0; i < 10; i++) {
    result.push(a + (b - a) * i / 9);
  }
  return result;
}

export function atLayerFloat(val: LayerValue, layer: number): number {
  if (typeof val === "number") return val;
  const arr = val.length === 2 ? expandTo10Float(val) : val;
  const idx = Math.max(0, Math.min(layer - 1, arr.length - 1));
  return arr[idx];
}

// ═══════════════════════════════════════════════════════════════════════════
// 功法战斗效果 — 与 battle_engine SkillEffect 一一对应
// 数值字段支持 [第1层, 第10层] 插值
//
// type 字段中文含义速查：
//   dealDamage        造成物理/法术伤害          value = baseValue + scalingRatio×scalingStat
//   dealDamageExecute 斩杀伤害（目标血量≤threshold% 时伤害+bonusPercent%）
//   dealDamagePierce  造成真实伤害（无视防御）
//   heal              恢复生命
//   lifesteal         造成伤害并吸取 damagePercent% 生命
//   applyModifier     施加修正（增减伤/暴击/速度等），持续 duration 回合，最多叠 maxStacks 层；targetSelf=true 作用于自身
//   applyCc           施加控制（freeze冰冻/stun眩晕/fear恐惧/confusion混乱/silence沉默/taunt嘲讽）
//   applyStatus       施加持续状态（poison中毒/burn灼烧/bleed流血/hpRegen生命恢复/mpDrain法力流失）
//   shield            开局获得护盾
//   counter           受击时反击
//   reflect           反弹 percent% 受到的伤害
//   damageShare       分摊 percent% 队友受到的伤害
//   deathWard         免死护盾：致命伤害时保留 1 点生命
//   extraAction       chance 概率获得额外行动
//   gaugeManipulate   操纵行动条（value>0 增加 / value<0 减少）
//   stealth           隐匿 duration 回合
//   cleanse           净化自身所有控制与持续伤害效果
//   dispel            驱散目标所有增益效果
//   revive            复活目标并恢复 hpPercent% 生命
//   summon            召唤物，按 trigger 触发，每回合造成 summonDamage 伤害
// ═══════════════════════════════════════════════════════════════════════════

export type GongfaBattleEffect =
  | { type: "dealDamage"; damageType: "physical" | "magical"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: GongfaScalingStat }
  | { type: "dealDamageExecute"; damageType: "physical" | "magical"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: GongfaScalingStat; threshold: number; bonusPercent: number }
  | { type: "dealDamagePierce"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: GongfaScalingStat }
  | { type: "heal"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: GongfaScalingStat }
  | { type: "lifesteal"; damageType: "physical" | "magical"; damagePercent: LayerValue }
  | { type: "applyModifier"; modifierType: string; value: LayerValue; duration: number; maxStacks: number; targetSelf?: boolean }
  | { type: "applyCc"; ccType: string; chance: LayerValue; duration: number }
  | { type: "applyStatus"; statusType: string; tickValue: LayerValue; isPercent: boolean; duration: number; maxStacks: number }
  | { type: "shield"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: GongfaScalingStat }
  | { type: "counter"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: GongfaScalingStat; duration: number }
  | { type: "reflect"; percent: LayerValue; duration: number }
  | { type: "damageShare"; percent: LayerValue; duration: number }
  | { type: "deathWard"; duration: number }
  | { type: "extraAction"; chance: number }
  | { type: "gaugeManipulate"; value: number }
  | { type: "stealth"; duration: number }
  | { type: "cleanse" }
  | { type: "dispel" }
  | { type: "revive"; hpPercent: number }
  | { type: "summon"; name: string; trigger: string; summonDamage: LayerValue; duration: number }
  ;

// ═══════════════════════════════════════════════════════════════════════════
// 特殊效果
// ═══════════════════════════════════════════════════════════════════════════

export type GongfaEffectType = "主动" | "被动";

export type GongfaRole = "攻击" | "辅助";

export interface GongfaSpecialEffect {
  name: string;
  intro: string;
  battleEffects: readonly GongfaBattleEffect[];
  type: GongfaEffectType;
  mpCost: LayerValue;
  cooldown: number;
  isAoE?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// 描述解析
// ═══════════════════════════════════════════════════════════════════════════

function bakeValue(
  eff: GongfaBattleEffect,
  getStat: (key: PrimaryStatKey) => number,
  masteryMult: number,
  layer: number,
): number | undefined {
  if ("baseValue" in eff && "scalingRatio" in eff && "scalingStat" in eff) {
    const bv = atLayer(eff.baseValue as LayerValue, layer);
    const sr = atLayerFloat(eff.scalingRatio as LayerValue, layer);
    const stat = getStat(eff.scalingStat);
    return Math.round((bv + sr * stat) * masteryMult);
  }
  return undefined;
}

const MODIFIER_LABELS: Record<string, string> = {
  damageDealt: "攻击伤害",
  physDamageDealt: "物理伤害",
  magDamageDealt: "法术伤害",
  damageTaken: "受到伤害",
  healReceived: "受到治疗",
  hpRecover: "生命恢复",
  mpRecover: "法力恢复",
  speed: "速度",
  critRate: "暴击率",
  critDmg: "暴击伤害",
  dodgeRate: "闪避率",
  lifesteal: "吸血",
  defensePenetration: "穿透",
  physDamageTaken: "物理减伤",
  magDamageTaken: "法术减伤",
  physDefensePenetration: "破甲",
  magDefensePenetration: "破法",
};

const STATUS_LABELS: Record<string, string> = {
  poison: "中毒",
  burn: "灼烧",
  bleed: "流血",
  hpRegen: "生命恢复",
  mpDrain: "法力流失",
};

const CC_LABELS: Record<string, string> = {
  freeze: "冰冻",
  stun: "眩晕",
  fear: "恐惧",
  confusion: "混乱",
  silence: "沉默",
  taunt: "嘲讽",
};

const DMG_TYPE_LABELS: Record<string, string> = {
  physical: "物理",
  magical: "法术",
};

function formatScaledValue(
  eff: GongfaBattleEffect,
  v: number | undefined,
  layer: number,
  showFormula: boolean = true,
): string {
  if (v == null) return "0";
  if (!showFormula) return String(v);
  if (!("scalingRatio" in eff) || !("scalingStat" in eff)) return String(v);
  const sr = atLayerFloat(eff.scalingRatio as LayerValue, layer);
  if (sr === 0) return String(v);
  const bv = atLayer(eff.baseValue as LayerValue, layer);
  const ss = (eff as { scalingStat: GongfaScalingStat }).scalingStat;
  const statLabel = PRIMARY_STAT_KEY_TO_ZH[ss] ?? ss;
  return `${v}（${bv} + ${Number(sr.toFixed(2))}×${statLabel}）`;
}

export function resolveGongfaBattleEffectDesc(
  eff: GongfaBattleEffect,
  getStat: (key: PrimaryStatKey) => number,
  masteryMult: number,
  layer: number,
  showFormula: boolean = true,
  selfByDefault: boolean = false,
  isAoE: boolean = false,
): string {
  const v = bakeValue(eff, getStat, masteryMult, layer);
  const sv = formatScaledValue(eff, v, layer, showFormula);
  const durLabel = (duration: number) =>
    selfByDefault ? "" : (duration >= 99 ? "（永久）" : `，持续${duration}回合`);

  switch (eff.type) {
    case "dealDamage": {
      const dt = DMG_TYPE_LABELS[eff.damageType] ?? "物理";
      return `造成${sv}点${isAoE ? "群体" : ""}${dt}伤害`;
    }
    case "dealDamageExecute": {
      const dt = DMG_TYPE_LABELS[eff.damageType] ?? "物理";
      return `造成${sv}点${isAoE ? "群体" : ""}${dt}伤害（目标低于${Math.round(eff.threshold * 100)}%血量时伤害+${eff.bonusPercent}%）`;
    }
    case "dealDamagePierce":
      return `造成${sv}点${isAoE ? "群体" : ""}真实伤害（无视防御）`;
    case "heal":
      return `${isAoE ? "群体" : ""}恢复${sv}点生命`;
    case "lifesteal": {
      const dt = DMG_TYPE_LABELS[eff.damageType] ?? "物理";
      const atkLabel = eff.damageType === "magical"
        ? PRIMARY_STAT_KEY_TO_ZH.perception
        : PRIMARY_STAT_KEY_TO_ZH.strength;
      const pct = atLayer(eff.damagePercent, layer);
      return `${isAoE ? "群体" : ""}造成${atkLabel}${pct}%的${dt}伤害，并恢复等量生命`;
    }
    case "applyModifier": {
      const label = MODIFIER_LABELS[eff.modifierType] ?? eff.modifierType;
      const val = atLayer(eff.value, layer);
      const sign = val > 0 ? "+" : "";
      const dur = durLabel(eff.duration);
      const stack = eff.maxStacks > 1 ? `（最多叠${eff.maxStacks}层）` : "";
      const target = isAoE
        ? (eff.targetSelf ? "全体我方" : "全体敌方")
        : ((eff.targetSelf || selfByDefault) ? "自身" : "目标");
      return `${target}${label}${sign}${val}%${dur}${stack}`;
    }
    case "applyCc": {
      const label = CC_LABELS[eff.ccType] ?? eff.ccType;
      const pct = atLayerFloat(eff.chance, layer);
      return `${isAoE ? "群体" : ""}${label}（${Math.round(pct * 100)}%概率），持续${eff.duration}回合`;
    }
    case "applyStatus": {
      const label = STATUS_LABELS[eff.statusType] ?? eff.statusType;
      const tick = atLayer(eff.tickValue, layer);
      const tickStr = eff.isPercent ? `最大生命${tick}%` : `${tick}点`;
      const stack = eff.maxStacks > 1 ? `（最多叠${eff.maxStacks}层）` : "";
      return `${isAoE ? "群体" : ""}每回合造成${tickStr}${label}伤害，持续${eff.duration}回合${stack}`;
    }
    case "shield":
      return `${isAoE ? "群体获得" : "开局获得"}${sv}点护盾`;
    case "counter": {
      const dur = durLabel(eff.duration);
      return `受击时反击${sv}点伤害${dur}`;
    }
    case "reflect": {
      const pct = atLayer(eff.percent, layer);
      const dur = durLabel(eff.duration);
      return `反弹${pct}%受到的伤害${dur}`;
    }
    case "damageShare": {
      const pct = atLayer(eff.percent, layer);
      const dur = durLabel(eff.duration);
      return `分摊${pct}%队友受到的伤害${dur}`;
    }
    case "deathWard": {
      const dur = durLabel(eff.duration);
      return `免死护盾：致命伤害时保留1点生命${dur}`;
    }
    case "extraAction":
      return `${Math.round(eff.chance * 100)}%概率获得额外行动`;
    case "gaugeManipulate":
      return eff.value > 0 ? `行动条增加${eff.value}` : `行动条减少${Math.abs(eff.value)}`;
    case "stealth":
      return `隐匿${eff.duration}回合`;
    case "cleanse":
      return "净化自身所有控制与持续伤害效果";
    case "dispel":
      return isAoE ? "群体驱散目标所有增益效果" : "驱散目标所有增益效果";
    case "revive":
      return `复活并恢复${eff.hpPercent}%生命`;
    case "summon": {
      const dmg = atLayer(eff.summonDamage, layer);
      return `召唤${eff.name}，每回合造成${dmg}点伤害，持续${eff.duration}回合`;
    }
  }
}

export function resolveGongfaEffectDisplay(
  fn: GongfaSpecialEffect,
  getStat: (key: PrimaryStatKey) => number,
  masteryMult: number,
  layer: number,
  cooldownReduce: number = 0,
): string {
  const parts = fn.battleEffects
    .map(e => resolveGongfaBattleEffectDesc(e, getStat, masteryMult, layer, true, fn.type === "被动", fn.isAoE === true))
    .join("；");
  const lines = [parts];
  const mp = atLayer(fn.mpCost, layer);
  if (mp > 0) lines.push(`法力消耗：${mp}`);
  if (fn.type === "主动") {
    const cd = Math.max(0, (fn.cooldown ?? 0) - cooldownReduce);
    lines.push(`冷却：${cd}回合`);
  }
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// 效果目录（按体系 × 品阶，每品阶3主动 + 1被动）
// 数值字段写 [第1层, 第10层]
// ═══════════════════════════════════════════════════════════════════════════

const GRADE_ORDER: readonly ItemGrade[] = ["下品", "中品", "上品", "极品", "仙品", "神品"];

export const GONGFA_EFFECT_CATALOG: Readonly<Record<GongfaSystem, Readonly<Record<ItemGrade, readonly GongfaSpecialEffect[]>>>> = {

  "通用": {
    "下品": [
      { name: "烈元术", intro: "上古力修一脉流传的入门杀伐之术，运转时掌心凝聚赤红元气", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [30, 500], scalingRatio: [0.5, 2.0], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "凝灵术", intro: "散修中广为流传的御气法门，可将丹田灵气凝作光弹激射而出", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [30, 500], scalingRatio: [0.5, 2.0], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "回春术", intro: "据传为上古药修所创，运转时掌心泛起温润青光，枯木亦能逢春", mpCost: [75, 500], cooldown: 1,
        battleEffects: [
          { type: "heal", baseValue: [50, 1000], scalingRatio: [0.4, 2.0], scalingStat: "physique" }
        ], type: "主动"
      },
      { name: "蚀骨法", intro: "源自南疆巫修残卷，施术时黑雾翻涌，所触之处金石皆朽", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [10, 300], scalingRatio: [0.3, 2.0], scalingStat: "spirit" },
          { type: "applyStatus", statusType: "poison", tickValue: [15, 150], isPercent: false, duration: 5, maxStacks: 99 }
        ], type: "主动"
      },
      { name: "养生诀", intro: "黄枫谷外门代代相传的吐纳根基，行功时气息绵长如春水", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "hpRecover", value: [1, 10], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "凝神诀", intro: "古修士静心石刻所载，修炼时灵台空明、神思澄澈", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageDealt", value: [5, 50], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "护体诀", intro: "据传得自上古力修遗刻，行功时周身浮起一层淡金气罩", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageTaken", value: [-5, -50], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "散灵术", intro: "散修御气小术，灵气四散激射、波及周遭敌寇", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [15, 250], scalingRatio: [0.25, 1.0], scalingStat: "spirit" }
        ], type: "主动", isAoE: true
      },
    ],
    "中品": [
      { name: "裂元术", intro: "烈元术深修而来的杀伐之术，出招时元气炸裂如雷", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [80, 700], scalingRatio: [0.7, 2.6], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "灵爆术", intro: "凝灵术演化而来的御气法门，灵气聚至极点后轰然炸开", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [80, 700], scalingRatio: [0.7, 2.6], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "净化术", intro: "据传源自上古净宗，施术时清辉洒落、涤荡邪秽", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "cleanse" }
        ], type: "主动"
      },
      { name: "定身术", intro: "散修中常见的禁制法门，中招者如陷泥沼、身不由己", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "applyCc", ccType: "stun", chance: [0.25, 0.45], duration: 1 }
        ], type: "主动"
      },
      { name: "灼烧术", intro: "南疆火修残卷所载，掌心凝聚赤焰，灼骨燃魂", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [70, 610], scalingRatio: [0.6, 2.6], scalingStat: "perception" },
          { type: "applyStatus", statusType: "burn", tickValue: [25, 260], isPercent: false, duration: 3, maxStacks: 3 }
        ], type: "主动"
      },
      { name: "回元功", intro: "上古丹修所传的养气法门，行功时丹田温热、灵气暗生", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "mpRecover", value: [2, 5], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "坚韧功", intro: "据传为上古蛮族力修遗刻，修炼后皮肉坚如老树虬根", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageTaken", value: [-17, -35], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "轻灵诀", intro: "散修身法残卷流传，运转时身轻如燕、踏风而行", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "speed", value: [6, 12], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "噬血功", intro: "传闻源自魔道血修，行功时血脉中隐隐有赤雾翻涌", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "lifesteal", value: [5, 9], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "灵爆环", intro: "凝灵聚爆演化而来的范围术法，环形灵波横扫全场", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [40, 350], scalingRatio: [0.35, 1.3], scalingStat: "perception" }
        ], type: "主动", isAoE: true
      },
    ],
    "上品": [
      { name: "斩魂术", intro: "上古力修杀伐秘术，出招时元气凝作一道灿白月牙", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [150, 1000], scalingRatio: [0.9, 3.2], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "爆元术", intro: "凝灵一脉深修而来的御气秘术，灵元沛然爆发如江河决堤", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [150, 1000], scalingRatio: [0.9, 3.2], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "驱散术", intro: "据传得自上古净宗真传，施术时清风拂过、万法皆散", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dispel" }
        ], type: "主动"
      },
      { name: "破虚法", intro: "传闻为太古剑仙顿悟所创，一击可破万象虚妄", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamagePierce", baseValue: [120, 830], scalingRatio: [0.6, 2.2], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "噬灵术", intro: "魔道修士秘传的夺气法门，施术时黑丝缠绕、蚕食神魂", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "lifesteal", damageType: "magical", damagePercent: [30, 50] },
          { type: "applyStatus", statusType: "mpDrain", tickValue: [3, 5], isPercent: false, duration: 3, maxStacks: 3 }
        ], type: "主动"
      },
      { name: "聚元诀", intro: "上古气修传承的增益法门，行功时周身灵气滚滚汇聚", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageDealt", value: [13, 23], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "physDamageDealt", value: [10, 16], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "magDamageDealt", value: [10, 16], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "明心诀", intro: "据传源自禅修一脉，修炼时心如止水、灵台映月", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "healReceived", value: [20, 33], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "hpRecover", value: [4, 7], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "灵动诀", intro: "散修身法精要，运转时身形缥缈、动若鬼魅", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "dodgeRate", value: [5, 10], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "speed", value: [8, 16], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "破甲诀", intro: "上古力修遗刻所载，行功时拳劲凝于一点、无坚不摧", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "defensePenetration", value: [8, 16], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "physDefensePenetration", value: [7, 13], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "magDefensePenetration", value: [7, 13], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "万煞术", intro: "上古术修秘传范围杀伐之术，万道煞气齐发、伤敌一片", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [75, 500], scalingRatio: [0.45, 1.6], scalingStat: "spirit" }
        ], type: "主动", isAoE: true
      },
    ],
    "极品": [
      { name: "破象术", intro: "上古力修至高杀伐秘术，出招时元气化作漫天拳影", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [250, 1500], scalingRatio: [1.1, 3.8], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "万象术", intro: "太古术修传承的御气秘术，灵元化作万象轰然而出", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [250, 1500], scalingRatio: [1.1, 3.8], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "还魂术", intro: "传闻为上古药修不传之秘，掌心青光一闪、可夺造化之机", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "revive", hpPercent: 50 }
        ], type: "主动"
      },
      { name: "斩仙法", intro: "上古剑仙顿悟所创的杀伐秘术，专寻破绽、一击毙命", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamageExecute", damageType: "physical", baseValue: [235, 1500], scalingRatio: [0.7, 3.2], scalingStat: "strength", threshold: 0.5, bonusPercent: 50 }
        ], type: "主动"
      },
      { name: "隐遁术", intro: "散修刺客秘传的身法门，身形没入虚空、悄无声息", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "stealth", duration: 2 },
          { type: "dealDamage", damageType: "physical", baseValue: [190, 1250], scalingRatio: [0.7, 3.2], scalingStat: "agility" }
        ], type: "主动"
      },
      { name: "金刚功", intro: "据传源自上古佛修，修炼时周身浮起金灿佛光、不坏不灭", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageTaken", value: [-29, -50], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "physDamageTaken", value: [-15, -26], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "灵盾诀", intro: "上古御气修士传承的护身法门，行功时身周浮起淡蓝灵罩", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageTaken", value: [-15, -26], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "hpRecover", value: [6, 9], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "归元诀", intro: "太古气修所悟养气秘法，行功时气血与灵元相互反哺", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "hpRecover", value: [7, 12], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "mpRecover", value: [7, 12], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "破军诀", intro: "传闻承自上古凶修，行功时杀意凝于眉心、招招致命", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "critRate", value: [12, 22], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "critDmg", value: [17, 32], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "反击诀", intro: "上古力修遗刻所载，受击时劲气反震、以牙还牙", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "counter", baseValue: [160, 1000], scalingRatio: [0.3, 1.6], scalingStat: "physique", duration: 99 }
        ], type: "被动"
      },
      { name: "焚野术", intro: "太古火修传承的范围禁术，天火倾泻、焚尽八方", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [125, 750], scalingRatio: [0.55, 1.9], scalingStat: "perception" }
        ], type: "主动", isAoE: true
      },
    ],
    "仙品": [
      { name: "归宗武诀", intro: "传闻承自上古万法宗主，出招时万象归一、势如天倾", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [380, 2000], scalingRatio: [1.3, 4.4], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "归宗法诀", intro: "上古万法宗真传御气秘术，灵元沛然、万法同源", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [380, 2000], scalingRatio: [1.3, 4.4], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "净天道法", intro: "据传悟自天道碎片，施术时清辉如雨、涤尽万邪", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "cleanse" },
          { type: "shield", baseValue: [300, 1600], scalingRatio: [0.4, 1.6], scalingStat: "resistance" }
        ], type: "主动"
      },
      { name: "封魔法", intro: "太古封修传承的禁制秘术，符文锁链缠绕、万法皆寂", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "applyCc", ccType: "silence", chance: [0.40, 0.60], duration: 2 },
          { type: "applyCc", ccType: "freeze", chance: [0.35, 0.55], duration: 1 }
        ], type: "主动"
      },
      { name: "神速术", intro: "传闻承自上古风修，运转时身形如电、快逾鬼魅", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "extraAction", chance: 0.15 },
          { type: "gaugeManipulate", value: -20 }
        ], type: "主动"
      },
      { name: "万象归元诀", intro: "太古气修至高心法，行功时万象灵气尽归丹田", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageDealt", value: [19, 32], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "damageTaken", value: [-24, -40], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "不灭道功", intro: "传闻为上古道修不传之秘，修炼后道韵护身、生机不灭", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "deathWard", duration: 99 },
          { type: "applyModifier", modifierType: "healReceived", value: [32, 56], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "灵天诀", intro: "承自上古风修真传，身法浑然天成、动若流云", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "dodgeRate", value: [10, 19], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "speed", value: [13, 24], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "舍生诀", intro: "传闻为上古义修所创，运转时与同道气血相连、生死与共", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "damageShare", percent: [30, 45], duration: 99 },
          { type: "applyModifier", modifierType: "damageTaken", value: [-24, -40], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "万象劫", intro: "万法宗真传范围秘术，万象灵劫轰然降临、席卷全场", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [190, 1000], scalingRatio: [0.65, 2.2], scalingStat: "spirit" }
        ], type: "主动", isAoE: true
      },
    ],
    "神品": [
      { name: "归一武诀", intro: "据传承自太古第一位力修，出招时万道拳意归一、碎裂虚空", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [500, 2500], scalingRatio: [1.5, 5.0], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "归一法诀", intro: "太古法祖真传御气秘术，灵元化作万道、轰然归一", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [500, 2500], scalingRatio: [1.5, 5.0], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "轮回术", intro: "传闻悟自轮回碎片，掌心光阴倒流、可逆转生死", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "revive", hpPercent: 70 },
          { type: "shield", baseValue: [625, 3100], scalingRatio: [0.4, 2.0], scalingStat: "guard" }
        ], type: "主动"
      },
      { name: "封魔大法", intro: "太古封修至高禁制，万千符文镇压、群魔束手", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "applyCc", ccType: "confusion", chance: [0.35, 0.55], duration: 2 },
          { type: "applyCc", ccType: "fear", chance: [0.35, 0.55], duration: 1 },
          { type: "applyCc", ccType: "taunt", chance: [0.45, 0.70], duration: 2 }
        ], type: "主动"
      },
      { name: "召灵法", intro: "上古魂修不传之秘，可召唤虚空中游离的灵体为己所用", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "summon", name: "灵体", trigger: "on_turn_end", summonDamage: [250, 1560], duration: 5 }
        ], type: "主动"
      },
      { name: "天道归身功", intro: "据传以天道碎片淬体而成，道韵流转周身、万法不侵", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageDealt", value: [27, 45], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "damageTaken", value: [-40, -50], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "hpRecover", value: [8, 12], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "不朽道功", intro: "传闻承自太古道祖，修炼后肉身不朽、生机永驻", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "deathWard", duration: 99 },
          { type: "reflect", percent: [20, 35], duration: 99 },
          { type: "applyModifier", modifierType: "healReceived", value: [45, 60], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "万法源诀", intro: "太古法祖所悟心法本源，行功时周身灵元生生不息", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageDealt", value: [36, 50], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "magDamageDealt", value: [27, 45], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "physDamageDealt", value: [27, 45], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "天机诀", intro: "传闻承自上古天机一脉，阵韵流转、攻守相生", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "counter", baseValue: [250, 1560], scalingRatio: [0.4, 1.8], scalingStat: "agility", duration: 99 },
          { type: "damageShare", percent: [25, 40], duration: 99 }
        ], type: "被动"
      },
      { name: "灭世劫", intro: "太古法祖至高范围禁术，灭世之力横扫寰宇、万法皆灭", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [250, 1250], scalingRatio: [0.75, 2.5], scalingStat: "perception" }
        ], type: "主动", isAoE: true
      },
    ],
  },

  "剑修": {
    "下品": [
      { name: "基础剑法", intro: "各派剑客入门必修的根本剑法，剑势端正、中正平和", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [25, 450], scalingRatio: [0.5, 2.0], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "追风剑法", intro: "散修剑客所创的追击剑法，出剑时剑光如风、连绵不绝", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [20, 375], scalingRatio: [0.3, 1.25], scalingStat: "strength" },
          { type: "applyModifier", modifierType: "critRate", value: [5, 25], duration: 3, maxStacks: 1, targetSelf: true }
        ], type: "主动"
      },
      { name: "破甲剑法", intro: "据传源自上古力修剑客，剑劲凝练、专破护身宝甲", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [20, 375], scalingRatio: [0.3, 1.25], scalingStat: "strength" },
          { type: "applyModifier", modifierType: "physDefensePenetration", value: [8, 30], duration: 2, maxStacks: 1, targetSelf: true }
        ], type: "主动"
      },
      { name: "凝剑诀", intro: "剑客入门所悟剑意心法，修炼时神识凝于一柄虚剑", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "critRate", value: [8, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "锐锋诀", intro: "散修剑客砥砺剑锋的辅助心法，行功时剑刃泛起冷芒", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "physDamageDealt", value: [5, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "疾风步法", intro: "据传承自上古风修剑客，运转时足下生风、身形如电", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "speed", value: [10, 30], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "横扫剑", intro: "各派剑客入门范围剑式，剑光横扫、伤及周遭", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [15, 225], scalingRatio: [0.25, 1.0], scalingStat: "strength" }
        ], type: "主动", isAoE: true
      }
    ],
    "中品": [
      { name: "疾风剑法", intro: "追风剑法深修而来的杀伐剑术，剑势如狂风骤雨", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [70, 630], scalingRatio: [0.7, 2.6], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "凌厉剑诀", intro: "散修刺客剑客秘传，一剑直指要害、凌厉无匹", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [53, 504], scalingRatio: [0.47, 1.82], scalingStat: "strength" },
          { type: "applyModifier", modifierType: "critRate", value: [10, 30], duration: 2, maxStacks: 1, targetSelf: true }
        ], type: "主动"
      },
      { name: "连环剑法", intro: "据传得自上古连环剑宗，剑光首尾相衔、绵绵不绝", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [44, 441], scalingRatio: [0.8, 2.5], scalingStat: "agility" },
          { type: "extraAction", chance: 0.30 }
        ], type: "主动"
      },
      { name: "剑心诀", intro: "上古剑仙顿悟所创心法，修炼时剑心空明、万剑由心", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "critRate", value: [8, 25], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "critDmg", value: [10, 50], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "穿云剑诀", intro: "传闻承自上古穿云剑仙，剑意可贯穿云霄、无远弗届", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "physDefensePenetration", value: [8, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "疾影诀", intro: "散修剑客身法残卷，运转时身形化作数道残影", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "speed", value: [8, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "剑气扫", intro: "追风剑法演化而来的范围剑术，剑气横扫全场", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [35, 315], scalingRatio: [0.35, 1.3], scalingStat: "strength" }
        ], type: "主动", isAoE: true
      }
    ],
    "上品": [
      { name: "万剑诀", intro: "上古剑宗镇派杀伐之术，出剑时万剑齐发、剑气冲霄", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [135, 900], scalingRatio: [0.9, 3.2], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "纵横剑诀", intro: "据传承自上古剑仙，剑气纵横交错、可斩虚空", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamagePierce", baseValue: [113, 720], scalingRatio: [0.6, 2.13], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "御剑术", intro: "上古剑仙根本御剑法门，可驱飞剑离手、千里取人", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "summon", name: "飞剑", trigger: "on_attack", summonDamage: [50, 500], duration: 5 }
        ], type: "主动"
      },
      { name: "无影剑诀", intro: "传闻为暗影剑仙所悟，剑意无形无影、杀机暗藏", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "critRate", value: [10, 25], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "critDmg", value: [15, 60], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "御风剑诀", intro: "上古风修剑客身法真传，运转时身随意动、动若长风", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "dodgeRate", value: [5, 20], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "speed", value: [10, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "反剑诀", intro: "据传承自上古守剑剑仙，受击时剑光反噬、以攻代守", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "counter", baseValue: [30, 300], scalingRatio: [0.24, 2.33], scalingStat: "agility", duration: 99 }
        ], type: "被动"
      },
      { name: "千剑诀", intro: "上古剑宗范围杀伐之术，千剑齐发、剑气冲霄", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [70, 550], scalingRatio: [0.45, 2.6], scalingStat: "strength" }
        ], type: "主动", isAoE: true
      }
    ],
    "极品": [
      { name: "天剑诀", intro: "上古天剑宗镇宗杀伐秘术，一剑引动九天剑气", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [225, 1350], scalingRatio: [1.1, 2.8], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "封喉剑诀", intro: "传闻为上古刺客剑仙所创，一剑封喉、十步杀人", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamageExecute", damageType: "physical", baseValue: [203, 1227], scalingRatio: [0.73, 2.53], scalingStat: "strength", threshold: 0.5, bonusPercent: 50 }
        ], type: "主动"
      },
      { name: "万剑归宗法", intro: "上古御剑宗至高心法，万剑听令、归宗而出", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "summon", name: "飞剑", trigger: "on_attack", summonDamage: [100, 1000], duration: 5 },
          { type: "extraAction", chance: 0.2 }
        ], type: "主动"
      },
      { name: "剑神功", intro: "据传悟自剑神残留剑意，修炼时周身剑韵流转", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "critRate", value: [15, 30], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "critDmg", value: [20, 70], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "破灭剑诀", intro: "上古毁灭剑仙传承，剑意所至、万物破灭", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "physDamageDealt", value: [10, 25], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "physDefensePenetration", value: [10, 30], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "疾电诀", intro: "传闻承自上古雷修剑客，身形快逾闪电、动若惊雷", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "speed", value: [15, 30], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "dodgeRate", value: [6, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "万剑横空", intro: "上古天剑宗范围秘术，万剑横空、剑气纵横", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [113, 675], scalingRatio: [0.55, 1.9], scalingStat: "strength" }
        ], type: "主动", isAoE: true
      }
    ],
    "仙品": [
      { name: "诛仙剑法", intro: "上古诛仙剑仙传承的杀伐秘术，剑光一闪、仙佛皆杀", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [340, 1800], scalingRatio: [1.0, 3.4], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "万杀剑诀", intro: "传闻为上古杀剑真传，一剑既出、万生皆灭", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamageExecute", damageType: "physical", baseValue: [283, 1680], scalingRatio: [0.85, 3.44], scalingStat: "strength", threshold: 0.4, bonusPercent: 60 },
          { type: "applyModifier", modifierType: "critRate", value: [15, 35], duration: 3, maxStacks: 1, targetSelf: true }
        ], type: "主动"
      },
      { name: "剑影遁法", intro: "上古暗影剑仙秘传身法，剑影随身、遁形无踪", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "stealth", duration: 2 },
          { type: "dealDamage", damageType: "physical", baseValue: [227, 1500], scalingRatio: [0.85, 3.44], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "归心剑诀", intro: "太古剑仙至高心法，万剑归心、剑意通神", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "critRate", value: [15, 28], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "critDmg", value: [25, 50], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "绝影诀", intro: "传闻承自上古绝影剑仙，身形绝于天地、无影可寻", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "dodgeRate", value: [8, 15], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "speed", value: [12, 20], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "无极剑诀", intro: "上古无极剑宗镇派心法，剑意无穷无尽、无极无终", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "physDamageDealt", value: [18, 30], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "damageDealt", value: [12, 20], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "万剑诛仙", intro: "诛仙剑仙范围秘术，万剑诛仙、剑光覆世", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [170, 900], scalingRatio: [0.75, 2.5], scalingStat: "strength" }
        ], type: "主动", isAoE: true
      }
    ],
    "神品": [
      { name: "开天剑法", intro: "据传承自太古开天剑祖，一剑可裂苍穹、开辟天地", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [450, 2250], scalingRatio: [1.5, 4.0], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "诛仙归宗法", intro: "诛仙剑仙至高传承，万剑归宗、诛仙灭佛", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [270, 1800], scalingRatio: [0.48, 3.08], scalingStat: "strength" },
          { type: "summon", name: "飞剑", trigger: "on_crit", summonDamage: [180, 1350], duration: 5 },
          { type: "extraAction", chance: 0.30 }
        ], type: "主动"
      },
      { name: "破法剑诀", intro: "太古剑祖顿悟所创，一剑破万法、万法皆空", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamagePierce", baseValue: [360, 2250], scalingRatio: [0.9, 3.33], scalingStat: "strength" },
          { type: "gaugeManipulate", value: -30 }
        ], type: "主动"
      },
      { name: "天道剑功", intro: "据传以天道碎片淬炼剑体而成，剑韵通天、万法不侵", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "critRate", value: [18, 45], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "critDmg", value: [30, 80], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "万速诀", intro: "传闻承自太古风修剑祖，身分万影、速逾鬼神", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "speed", value: [15, 35], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "dodgeRate", value: [10, 30], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "不灭剑诀", intro: "太古不灭剑宗传承，剑意不灭、斩尽万象", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "physDamageDealt", value: [20, 35], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "physDefensePenetration", value: [18, 30], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "damageDealt", value: [15, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "剑裂苍穹", intro: "太古剑祖范围禁术，剑气裂空、苍穹尽斩", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [225, 1125], scalingRatio: [0.75, 2.5], scalingStat: "strength" }
        ], type: "主动", isAoE: true
      }
    ],
  },

  "体修": {
    "下品": [
      { name: "碎岩功", intro: "各派外门弟子入门杀伐之术，一拳轰出、碎裂岩石", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [35, 600], scalingRatio: [0.4, 1.7], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "碎骨功", intro: "散修力士所传杀伐之术，拳劲透骨、骨裂如絮", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [28, 500], scalingRatio: [0.24, 1.06], scalingStat: "strength" },
          { type: "applyStatus", statusType: "bleed", tickValue: [20, 200], isPercent: false, duration: 3, maxStacks: 3 }
        ], type: "主动"
      },
      { name: "震山诀", intro: "据传承自上古力修，一击轰出、震慑心神", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [28, 500], scalingRatio: [0.24, 1.06], scalingStat: "strength" },
          { type: "applyCc", ccType: "stun", chance: [0.15, 0.30], duration: 1 }
        ], type: "主动"
      },
      { name: "铁壁功", intro: "上古力修遗刻所载护身法门，修炼时周身如铸铁壁", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageTaken", value: [-5, -20], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "蛮力诀", intro: "传闻源自上古蛮族力修，行功时气血翻涌、力大无穷", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageDealt", value: [5, 15], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "回春功", intro: "据传得自上古药修力修，行功时血脉温润、生机暗生", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "hpRecover", value: [1, 10], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "震地拳", intro: "外门弟子范围杀伐之术，一拳震地、波及周遭", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [18, 300], scalingRatio: [0.2, 0.85], scalingStat: "physique" }
        ], type: "主动", isAoE: true
      }
    ],
    "中品": [
      { name: "崩山诀", intro: "上古力修一脉传承的杀伐之术，一拳崩山、势若雷霆", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [95, 840], scalingRatio: [0.6, 2.2], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "碎脉功", intro: "散修力士秘传杀伐之术，拳劲入脉、血脉逆行", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [71, 672], scalingRatio: [0.3, 1.32], scalingStat: "strength" },
          { type: "applyStatus", statusType: "bleed", tickValue: [25, 336], isPercent: false, duration: 3, maxStacks: 5 }
        ], type: "主动"
      },
      { name: "擒拿功", intro: "据传承自上古擒龙力修，一握成擒、避无可避", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [59, 588], scalingRatio: [0.25, 1.1], scalingStat: "strength" },
          { type: "applyCc", ccType: "taunt", chance: [0.50, 0.80], duration: 2 }
        ], type: "主动"
      },
      { name: "金刚功", intro: "上古佛修力修传承，修炼时周身如金刚不坏", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageTaken", value: [-20, -40], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "噬血功", intro: "传闻源自魔道血修，行功时气血反哺、以血养身", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "lifesteal", value: [3, 10], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "体罡功", intro: "上古力修遗刻所载护身法门，行功时周身罡气流转", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "shield", baseValue: [50, 500], scalingRatio: [0.3, 1.1], scalingStat: "guard" }
        ], type: "被动"
      },
      { name: "崩地震", intro: "崩山诀演化而来的范围术法，震地震荡、伤敌一片", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [48, 420], scalingRatio: [0.3, 1.1], scalingStat: "physique" }
        ], type: "主动", isAoE: true
      }
    ],
    "上品": [
      { name: "投山诀", intro: "上古力修深修杀伐之术，可举山投掷、势若崩山", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [180, 1200], scalingRatio: [0.8, 2.7], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "嗜血功", intro: "魔道血修秘传杀伐之术，拳锋所触、吸血噬魂", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "lifesteal", damageType: "physical", damagePercent: [50, 100] }
        ], type: "主动"
      },
      { name: "霸王功", intro: "据传承自上古霸王力修，一拳霸道、震慑群敌", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [120, 800], scalingRatio: [0.27, 1.35], scalingStat: "strength" },
          { type: "applyCc", ccType: "stun", chance: [0.30, 0.55], duration: 1 },
          { type: "gaugeManipulate", value: -20 }
        ], type: "主动"
      },
      { name: "霸体功", intro: "上古力修顿悟所创护身法门，受击时罡气反震", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "counter", baseValue: [120, 960], scalingRatio: [0.3, 1.5], scalingStat: "physique", duration: 99 }
        ], type: "被动"
      },
      { name: "不屈功", intro: "传闻为上古不屈力修传承，行功时生机勃勃、百折不屈", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "hpRecover", value: [3, 10], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "healReceived", value: [15, 30], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "铁骨功", intro: "上古力修遗刻所载，修炼后骨如铁铸、皮如铜浇", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageTaken", value: [-10, -25], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "physDamageTaken", value: [-10, -25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "裂地罡", intro: "上古力修范围秘术，罡气裂地、震荡八方", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [90, 600], scalingRatio: [0.4, 1.35], scalingStat: "physique" }
        ], type: "主动", isAoE: true
      }
    ],
    "极品": [
      { name: "涅槃功", intro: "传闻承自上古涅槃力修，一拳浴火、焚尽万物", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [280, 1700], scalingRatio: [0.95, 3.2], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "天罡诀", intro: "上古星修力士传承杀伐之术，天罡之力、怒震八方", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [168, 1159], scalingRatio: [0.21, 1.07], scalingStat: "strength" },
          { type: "applyCc", ccType: "stun", chance: [0.35, 0.65], duration: 1 },
          { type: "gaugeManipulate", value: -30 }
        ], type: "主动"
      },
      { name: "斩魂功", intro: "据传得自上古斩魂力修，一击斩魂、专寻破绽", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamageExecute", damageType: "physical", baseValue: [210, 1391], scalingRatio: [0.42, 1.71], scalingStat: "strength", threshold: 0.5, bonusPercent: 50 }
        ], type: "主动"
      },
      { name: "不灭金身功", intro: "上古佛修力修至高护身法门，金身不灭、万法难伤", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "deathWard", duration: 99 },
          { type: "applyModifier", modifierType: "damageTaken", value: [-15, -45], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "反震功", intro: "据传承自上古反震力修，受击时劲气反弹、以彼之道", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "reflect", percent: [10, 30], duration: 99 },
          { type: "applyModifier", modifierType: "damageTaken", value: [-10, -20], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "舍身诀", intro: "上古义修力士所创，运转时为同道分伤、生死相托", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "damageShare", percent: [30, 50], duration: 99 },
          { type: "applyModifier", modifierType: "damageTaken", value: [-15, -25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "山崩诀", intro: "上古力修范围禁术，一击山崩、震慑群敌", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [140, 850], scalingRatio: [0.48, 1.6], scalingStat: "physique" }
        ], type: "主动", isAoE: true
      }
    ],
    "仙品": [
      { name: "怒目金刚功", intro: "上古佛修怒目金刚传承，一拳轰出、金身怒目", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [430, 2300], scalingRatio: [1.1, 3.7], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "碎空功", intro: "传闻承自太古灭世力修，一拳碎裂虚空、灭世灭生", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamageExecute", damageType: "physical", baseValue: [287, 1917], scalingRatio: [0.28, 1.44], scalingStat: "strength", threshold: 0.5, bonusPercent: 50 },
          { type: "applyModifier", modifierType: "damageDealt", value: [10, 20], duration: 2, maxStacks: 3, targetSelf: true }
        ], type: "主动"
      },
      { name: "吞天魔功", intro: "魔道血祖传承杀伐秘术，血雾吞天、噬血无量", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [287, 1917], scalingRatio: [0.44, 1.64], scalingStat: "strength" },
          { type: "lifesteal", damageType: "physical", damagePercent: [50, 100] }
        ], type: "主动"
      },
      { name: "万象归元功", intro: "太古力修至高心法，万象劲气归元、反哺己身", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "reflect", percent: [10, 50], duration: 99 },
          { type: "applyModifier", modifierType: "damageTaken", value: [-15, -30], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "不朽金身功", intro: "据传以不朽金液淬体，金身不朽、反震万击", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "deathWard", duration: 99 },
          { type: "counter", baseValue: [287, 1917], scalingRatio: [0.28, 1.64], scalingStat: "physique", duration: 99 }
        ], type: "被动"
      },
      { name: "狂战功", intro: "传闻承自上古狂战士，愈战愈狂、嗜血无忌", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageDealt", value: [15, 25], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "physDamageDealt", value: [15, 25], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "lifesteal", value: [5, 15], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "怒目震天", intro: "上古佛修力修范围秘术，怒目震天、金光四射", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [215, 1150], scalingRatio: [0.55, 1.85], scalingStat: "physique" }
        ], type: "主动", isAoE: true
      }
    ],
    "神品": [
      { name: "涅槃重生功", intro: "据传承自太古涅槃力祖，浴火重生、一拳焚天", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [600, 2800], scalingRatio: [1.3, 4.5], scalingStat: "strength" }
        ], type: "主动"
      },
      { name: "混沌灭世功", intro: "太古混沌力修至高杀伐之术，混沌之力、灭世灭生", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [360, 2240], scalingRatio: [0.42, 1.88], scalingStat: "strength" },
          { type: "applyStatus", statusType: "bleed", tickValue: [56, 448], isPercent: false, duration: 3, maxStacks: 5 },
          { type: "applyCc", ccType: "stun", chance: [0.40, 0.75], duration: 1 }
        ], type: "主动"
      },
      { name: "裂天诀", intro: "传闻承自太古裂天力祖，一拳天崩地裂、震碎虚空", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamageExecute", damageType: "physical", baseValue: [360, 1960], scalingRatio: [0.31, 1.5], scalingStat: "strength", threshold: 0.4, bonusPercent: 60 },
          { type: "applyCc", ccType: "stun", chance: [0.40, 0.70], duration: 1 },
          { type: "gaugeManipulate", value: -40 }
        ], type: "主动"
      },
      { name: "不朽功", intro: "据传以太古不朽之力淬体，肉身不朽、万击不侵", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "deathWard", duration: 99 },
          { type: "counter", baseValue: [360, 2240], scalingRatio: [0.26, 1.5], scalingStat: "strength", duration: 99 },
          { type: "reflect", percent: [20, 50], duration: 99 }
        ], type: "被动"
      },
      { name: "万劫功", intro: "太古力修至高护身法门，历经万劫、金刚不灭", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageTaken", value: [-35, -55], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "hpRecover", value: [6, 10], duration: 99, maxStacks: 1 },
          { type: "deathWard", duration: 99 }
        ], type: "被动"
      },
      { name: "混沌金身功", intro: "传闻承自太古混沌力祖，金身混沌、攻守兼备", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageDealt", value: [20, 35], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "damageTaken", value: [-20, -35], duration: 99, maxStacks: 1 },
          { type: "counter", baseValue: [240, 1680], scalingRatio: [0.26, 1.31], scalingStat: "strength", duration: 99 }
        ], type: "被动"
      },
      { name: "裂天地震", intro: "太古力祖范围禁术，一拳裂天、大地震荡", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "physical", baseValue: [300, 1400], scalingRatio: [0.65, 2.25], scalingStat: "physique" }
        ], type: "主动", isAoE: true
      }
    ],
  },

  "法修": {
    "下品": [
      { name: "法弹术", intro: "各派御气修士入门法门，可凝灵气为弹激射而出", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [25, 450], scalingRatio: [0.55, 2.2], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "火球术", intro: "散修火修残卷所载，掌心凝聚赤红火球、灼骨燃魂", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [20, 375], scalingRatio: [0.33, 1.38], scalingStat: "perception" },
          { type: "applyStatus", statusType: "burn", tickValue: [15, 150], isPercent: false, duration: 3, maxStacks: 3 }
        ], type: "主动"
      },
      { name: "寒冰刺术", intro: "据传承自上古冰修，指尖凝出冰刺、寒气逼人", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [20, 375], scalingRatio: [0.33, 1.38], scalingStat: "perception" },
          { type: "applyCc", ccType: "freeze", chance: [0.15, 0.30], duration: 1 }
        ], type: "主动"
      },
      { name: "灵甲术", intro: "上古御气修士护身法门，行功时身周浮起淡蓝灵甲", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "shield", baseValue: [40, 750], scalingRatio: [0.22, 1.38], scalingStat: "resistance" }
        ], type: "被动"
      },
      { name: "聚灵功", intro: "散修气修所悟增益法门，行功时周身灵气汇聚", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [8, 15], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "冥想术", intro: "据传源自上古禅修，静坐时灵台空明、灵气暗生", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "mpRecover", value: [2, 6], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "灵散术", intro: "御气修士入门范围术法，灵气四散、波及周遭", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [13, 225], scalingRatio: [0.28, 1.1], scalingStat: "perception" }
        ], type: "主动", isAoE: true
      }
    ],
    "中品": [
      { name: "灵海术", intro: "上古御气修士深修秘术，灵元化作怒涛冲击", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [70, 630], scalingRatio: [0.8, 2.9], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "灼魂术", intro: "魔道火修秘传杀伐之术，赤焰灼骨焚魂", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [53, 504], scalingRatio: [0.33, 1.74], scalingStat: "spirit" },
          { type: "applyStatus", statusType: "burn", tickValue: [25, 252], isPercent: false, duration: 3, maxStacks: 5 }
        ], type: "主动"
      },
      { name: "寂静术", intro: "据传承自上古寂灭修，施术时万籁俱寂、法术难施", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "applyCc", ccType: "silence", chance: [0.45, 0.70], duration: 2 },
          { type: "dealDamage", damageType: "magical", baseValue: [44, 441], scalingRatio: [0.27, 1.16], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "破法功", intro: "上古御气修士遗刻所载，行功时破法之韵流转周身", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDefensePenetration", value: [8, 15], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "寒冰功", intro: "据传承自上古冰修，修炼时周身寒霜凝结", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageTaken", value: [-10, -30], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "回流诀", intro: "散修气修所悟养气法门，行功时灵元往复回流", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "mpRecover", value: [3, 6], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "灵海潮", intro: "灵海术演化而来的范围术法，灵海潮涌、席卷全场", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [35, 315], scalingRatio: [0.4, 1.45], scalingStat: "perception" }
        ], type: "主动", isAoE: true
      }
    ],
    "上品": [
      { name: "爆元术", intro: "上古御气修士深修秘术，灵元爆发如江河决堤", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [135, 900], scalingRatio: [1.0, 3.5], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "冰封术", intro: "据传承自上古冰修真传，一念冰封万物、寒彻九幽", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "applyCc", ccType: "freeze", chance: [0.50, 0.80], duration: 2 },
          { type: "applyModifier", modifierType: "magDamageDealt", value: [15, 55], duration: 2, maxStacks: 1, targetSelf: true }
        ], type: "主动"
      },
      { name: "破灭术", intro: "上古毁灭术修传承杀伐之术，灵元所至、万物破灭", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [113, 720], scalingRatio: [0.53, 2.33], scalingStat: "perception" },
          { type: "applyModifier", modifierType: "magDefensePenetration", value: [15, 25], duration: 2, maxStacks: 1, targetSelf: true }
        ], type: "主动"
      },
      { name: "聚灵诀", intro: "上古御气修士阵韵所悟增益法门，行功时周身灵阵流转", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [15, 45], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "澎湃诀", intro: "据传承自上古气修真传，行功时灵元如潮澎湃", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "mpRecover", value: [4, 8], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "法盾术", intro: "上古御气修士护身法门深修，身周浮起厚实法盾", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "shield", baseValue: [169, 1080], scalingRatio: [0.33, 1.75], scalingStat: "resistance" }
        ], type: "被动"
      },
      { name: "爆元环", intro: "上古御气修士范围秘术，灵元爆环、横扫八方", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [68, 450], scalingRatio: [0.5, 1.75], scalingStat: "perception" }
        ], type: "主动", isAoE: true
      }
    ],
    "极品": [
      { name: "太虚术", intro: "上古太虚术修传承杀伐秘术，灵元凝为太虚法印", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [225, 1350], scalingRatio: [1.2, 4.2], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "雷火诀", intro: "据传承自上古雷火双修，雷火交织、焚天裂地", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [169, 1105], scalingRatio: [0.27, 1.68], scalingStat: "perception" },
          { type: "applyStatus", statusType: "burn", tickValue: [37, 307], isPercent: false, duration: 3, maxStacks: 5 },
          { type: "applyCc", ccType: "silence", chance: [0.30, 0.50], duration: 1 }
        ], type: "主动"
      },
      { name: "湮灭术", intro: "上古毁灭术修至高杀伐秘术，一击湮灭、归于虚无", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamageExecute", damageType: "magical", baseValue: [203, 1227], scalingRatio: [0.67, 2.8], scalingStat: "perception", threshold: 0.5, bonusPercent: 50 }
        ], type: "主动"
      },
      { name: "万法功", intro: "太古术修至高增益心法，行功时万法之韵流转", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [20, 50], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "magDefensePenetration", value: [10, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "无限诀", intro: "传闻承自上古气修真传，灵元生生不息、几近无限", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "mpRecover", value: [6, 10], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "冰心诀", intro: "据传源自上古冰修禅修，修炼时心如冰晶、万法难侵", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageTaken", value: [-20, -35], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "magDamageTaken", value: [-10, -18], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "太虚劫", intro: "上古太虚术修范围秘术，太虚法印、轰然倾覆", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [113, 675], scalingRatio: [0.6, 2.1], scalingStat: "perception" }
        ], type: "主动", isAoE: true
      }
    ],
    "仙品": [
      { name: "神机法", intro: "太古神机术修传承杀伐秘术，灵元暗合神机、变化莫测", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [340, 1800], scalingRatio: [1.4, 4.8], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "焚天术", intro: "上古火修至高杀伐秘术，赤焰焚天、万物成灰", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [283, 1680], scalingRatio: [0.56, 2.13], scalingStat: "perception" },
          { type: "applyStatus", statusType: "burn", tickValue: [48, 480], isPercent: false, duration: 4, maxStacks: 8 }
        ], type: "主动"
      },
      { name: "万象冰封术", intro: "据传承自上古冰祖，一念冰封万象、寒寂天地", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "applyCc", ccType: "freeze", chance: [0.60, 0.85], duration: 2 },
          { type: "gaugeManipulate", value: -30 },
          { type: "dealDamage", damageType: "magical", baseValue: [170, 1080], scalingRatio: [0.28, 1.07], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "法神功", intro: "传闻以法神之力淬体，行功时万法之韵护身", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [30, 55], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "magDefensePenetration", value: [20, 35], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "灵泉诀", intro: "上古气修所悟养气至高心法，丹田如灵泉涌动", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "mpRecover", value: [8, 10], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "法天功", intro: "据传悟自天道法则，行功时法韵镇身、巍然不动", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "damageTaken", value: [-20, -35], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "magDamageTaken", value: [-15, -35], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "speed", value: [8, 15], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "神机万象", intro: "太古神机术修范围秘术，神机万象、变化莫测", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [170, 900], scalingRatio: [0.7, 2.4], scalingStat: "perception" }
        ], type: "主动", isAoE: true
      }
    ],
    "神品": [
      { name: "万法源术", intro: "太古法祖真传杀伐秘术，灵元直指万法本源", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [450, 2300], scalingRatio: [1.7, 5.5], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "混元功", intro: "传闻承自太古混元法祖，一气混元、生生不息", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [360, 2070], scalingRatio: [0.41, 1.83], scalingStat: "perception" },
          { type: "lifesteal", damageType: "magical", damagePercent: [50, 80] },
          { type: "applyModifier", modifierType: "magDamageDealt", value: [30, 70], duration: 3, maxStacks: 3, targetSelf: true }
        ], type: "主动"
      },
      { name: "焚世诀", intro: "太古火祖至高杀伐秘术，天火降世、焚尽万物", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamageExecute", damageType: "magical", baseValue: [360, 2300], scalingRatio: [0.68, 2.75], scalingStat: "perception", threshold: 0.4, bonusPercent: 60 },
          { type: "applyStatus", statusType: "burn", tickValue: [46, 460], isPercent: false, duration: 4, maxStacks: 10 },
          { type: "applyCc", ccType: "silence", chance: [0.40, 0.65], duration: 1 }
        ], type: "主动"
      },
      { name: "法道至尊功", intro: "据传悟自法道至尊碎片，行功时万法臣服", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [25, 60], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "magDefensePenetration", value: [25, 50], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "damageDealt", value: [15, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "灵法天成功", intro: "传闻以天道灵法淬体，护身之法浑然天成", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "mpRecover", value: [10, 15], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "magDamageTaken", value: [-20, -35], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "法盾诀", intro: "太古御气修士至高护身法门，身周浮起万象法盾", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "shield", baseValue: [450, 2300], scalingRatio: [0.34, 1.83], scalingStat: "resistance" },
          { type: "applyModifier", modifierType: "magDamageTaken", value: [-15, -25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "万法寂灭", intro: "太古法祖范围禁术，万法寂灭、灵元覆世", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [225, 1150], scalingRatio: [0.85, 2.75], scalingStat: "perception" }
        ], type: "主动", isAoE: true
      }
    ],
  },

  "毒修": {
    "下品": [
      { name: "毒雾术", intro: "南疆蛊修入门杀伐之术，施术时毒雾弥漫、蚀肉销骨", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [25, 400], scalingRatio: [0.45, 1.8], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "蚀骨术", intro: "南疆巫修残卷所载，黑雾蚀骨、毒素侵心", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [20, 333], scalingRatio: [0.27, 1.13], scalingStat: "spirit" },
          { type: "applyStatus", statusType: "poison", tickValue: [1, 5], isPercent: true, duration: 5, maxStacks: 5 }
        ], type: "主动"
      },
      { name: "召虫术", intro: "南疆蛊修秘传御虫法门，可召唤毒虫助战", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "summon", name: "毒虫", trigger: "on_turn_start", summonDamage: [20, 333], duration: 5 }
        ], type: "主动"
      },
      { name: "毒体功", intro: "传闻承自南疆蛊修，行功时血脉中隐有毒素流转", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "lifesteal", value: [2, 10], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "蚀体功", intro: "南疆蛊修遗刻所载增益法门，行功时周身毒韵流转", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [8, 15], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "聚毒诀", intro: "南疆蛊修养毒法门，行功时丹田聚毒、毒力暗生", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "mpRecover", value: [2, 4], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "毒雾漫", intro: "南疆蛊修入门范围术法，毒雾弥漫、蚀肉销骨", mpCost: [50, 500], cooldown: 1,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [13, 200], scalingRatio: [0.23, 0.9], scalingStat: "spirit" }
        ], type: "主动", isAoE: true
      }
    ],
    "中品": [
      { name: "蛊毒术", intro: "南疆蛊修深修杀伐之术，施术时蛊虫携毒而出", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [65, 560], scalingRatio: [0.65, 2.3], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "腐蚀术", intro: "南疆巫修秘传杀伐之术，毒雾腐蚀、金石皆朽", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [49, 448], scalingRatio: [0.27, 1.38], scalingStat: "spirit" },
          { type: "applyStatus", statusType: "poison", tickValue: [1.5, 5.5], isPercent: true, duration: 5, maxStacks: 5 }
        ], type: "主动"
      },
      { name: "噬魂术", intro: "魔道毒道中人秘传，毒丝噬魂、令人心悸", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "applyStatus", statusType: "mpDrain", tickValue: [2, 8], isPercent: true, duration: 3, maxStacks: 3 },
          { type: "applyCc", ccType: "fear", chance: [0.30, 0.50], duration: 1 }
        ], type: "主动"
      },
      { name: "吸星毒功", intro: "传闻承自魔道蛊修，行功时吸星噬血、以毒养身", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "lifesteal", value: [5, 15], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "毒抗功", intro: "南疆蛊修遗刻所载，修炼后百毒不侵、生机暗养", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "healReceived", value: [15, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "毒力诀", intro: "南疆蛊修增益法门，行功时毒力充盈周身", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [10, 18], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "蛊毒潮", intro: "南疆蛊修范围术法，蛊毒成潮、席卷全场", mpCost: [75, 750], cooldown: 2,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [33, 280], scalingRatio: [0.33, 1.15], scalingStat: "spirit" }
        ], type: "主动", isAoE: true
      }
    ],
    "上品": [
      { name: "穿心毒术", intro: "南疆蛊修深修杀伐秘术，百毒穿心、毒贯全身", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [120, 800], scalingRatio: [0.8, 2.9], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "毒域术", intro: "南疆蛊修秘传禁制，毒域成笼、剧毒弥漫", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "applyStatus", statusType: "poison", tickValue: [2, 6], isPercent: true, duration: 5, maxStacks: 8 },
          { type: "applyStatus", statusType: "bleed", tickValue: [27, 267], isPercent: false, duration: 3, maxStacks: 5 }
        ], type: "主动"
      },
      { name: "幻毒术", intro: "南疆巫蛊秘传，毒气致幻、令人癫狂", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "applyCc", ccType: "confusion", chance: [0.40, 0.60], duration: 2 },
          { type: "applyCc", ccType: "fear", chance: [0.35, 0.55], duration: 1 },
          { type: "dealDamage", damageType: "magical", baseValue: [60, 427], scalingRatio: [0.21, 0.97], scalingStat: "spirit" }
        ], type: "主动"
      },
      { name: "万毒功", intro: "据传承自上古万毒蛊修，万毒不侵、噬血养身", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "lifesteal", value: [5, 20], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "healReceived", value: [15, 25], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "毒脉诀", intro: "南疆蛊修遗刻所载增益法门，毒脉流转周身", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [15, 25], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "mpRecover", value: [4, 6], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "毒云术", intro: "南疆蛊修范围秘术，毒云压顶、毒贯群敌", mpCost: [100, 1000], cooldown: 4,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [60, 400], scalingRatio: [0.4, 1.45], scalingStat: "spirit" }
        ], type: "主动", isAoE: true
      }
    ],
    "极品": [
      { name: "天毒术", intro: "南疆蛊修至高杀伐秘术，毒雾凝箭、穿心破体", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [200, 1250], scalingRatio: [1.0, 3.4], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "蚀魂毒术", intro: "传闻承自九幽蛊修，毒蚀神魂、九幽同悲", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [150, 1023], scalingRatio: [0.28, 1.36], scalingStat: "perception" },
          { type: "applyStatus", statusType: "poison", tickValue: [3, 7], isPercent: true, duration: 5, maxStacks: 10 },
          { type: "applyStatus", statusType: "mpDrain", tickValue: [5, 7], isPercent: true, duration: 3, maxStacks: 5 }
        ], type: "主动"
      },
      { name: "噬灵毒术", intro: "魔道蛊修秘传，蛊虫噬灵、毒血交加", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "lifesteal", damageType: "magical", damagePercent: [45, 65] },
          { type: "applyStatus", statusType: "poison", tickValue: [3, 7], isPercent: true, duration: 3, maxStacks: 5 }
        ], type: "主动"
      },
      { name: "万毒噬生功", intro: "太古蛊修至高心法，万毒噬生、反哺己身", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "lifesteal", value: [6, 22], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "healReceived", value: [20, 35], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "毒道至尊功", intro: "据传悟自毒道至尊碎片，行功时毒韵镇身、威压群伦", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [18, 30], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "damageDealt", value: [10, 18], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "血毒诀", intro: "南疆血蛊修秘传，血毒共鸣、相互反哺", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "lifesteal", value: [6, 18], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "mpRecover", value: [5, 8], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "天毒瘴", intro: "南疆蛊修范围禁术，天毒成瘴、弥漫八方", mpCost: [200, 2000], cooldown: 6,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [100, 625], scalingRatio: [0.5, 1.7], scalingStat: "spirit" }
        ], type: "主动", isAoE: true
      }
    ],
    "仙品": [
      { name: "灭世毒术", intro: "太古蛊修至高杀伐秘术，毒雾弥漫、灭世灭生", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [300, 1600], scalingRatio: [1.2, 4.0], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "毒龙诀", intro: "传闻承自太古毒龙，毒龙噬天、毒血交加", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [250, 1493], scalingRatio: [0.48, 1.78], scalingStat: "perception" },
          { type: "lifesteal", damageType: "magical", damagePercent: [50, 75] },
          { type: "applyStatus", statusType: "poison", tickValue: [4, 8], isPercent: true, duration: 5, maxStacks: 10 }
        ], type: "主动"
      },
      { name: "噬心蛊术", intro: "南疆蛊祖至高御虫秘术，万蛊噬心、防不胜防", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "applyStatus", statusType: "poison", tickValue: [4, 8], isPercent: true, duration: 5, maxStacks: 15 },
          { type: "applyStatus", statusType: "bleed", tickValue: [53, 533], isPercent: false, duration: 4, maxStacks: 8 },
          { type: "applyCc", ccType: "confusion", chance: [0.40, 0.60], duration: 2 }
        ], type: "主动"
      },
      { name: "不灭毒功", intro: "据传以太古不灭之毒淬体，毒身不灭、噬血养身", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "lifesteal", value: [6, 28], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "healReceived", value: [25, 40], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "毒皇功", intro: "传闻承自太古毒皇，行功时毒韵皇威、万毒臣服", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [22, 35], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "damageDealt", value: [12, 20], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "mpRecover", value: [8, 12], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "灭世毒瘴", intro: "太古蛊修范围秘术，灭世毒瘴、覆世灭生", mpCost: [300, 3000], cooldown: 8,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [150, 800], scalingRatio: [0.6, 2.0], scalingStat: "spirit" }
        ], type: "主动", isAoE: true
      }
    ],
    "神品": [
      { name: "天道灭毒法", intro: "据传悟自天道毒之碎片，毒雾降世、灭尽万物", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [400, 2100], scalingRatio: [1.35, 4.5], scalingStat: "perception" }
        ], type: "主动"
      },
      { name: "归宗毒法", intro: "太古毒祖至高杀伐秘术，万毒归宗、毒霸天下", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [280, 1890], scalingRatio: [0.43, 1.88], scalingStat: "perception" },
          { type: "applyStatus", statusType: "poison", tickValue: [5, 10], isPercent: true, duration: 5, maxStacks: 20 },
          { type: "applyStatus", statusType: "bleed", tickValue: [63, 630], isPercent: false, duration: 4, maxStacks: 10 },
          { type: "applyCc", ccType: "fear", chance: [0.45, 0.70], duration: 2 }
        ], type: "主动"
      },
      { name: "噬天蛊术", intro: "魔道毒祖秘传，蛊虫噬天、毒血蚀魂", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "lifesteal", damageType: "magical", damagePercent: [100, 200] },
          { type: "applyStatus", statusType: "poison", tickValue: [5, 10], isPercent: true, duration: 5, maxStacks: 15 },
          { type: "applyStatus", statusType: "mpDrain", tickValue: [5, 8], isPercent: true, duration: 3, maxStacks: 8 },
          { type: "applyCc", ccType: "confusion", chance: [0.40, 0.65], duration: 2 }
        ], type: "主动"
      },
      { name: "万毒不灭功", intro: "据传以太古万毒之力淬体，毒身不灭、万毒反哺", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "lifesteal", value: [8, 25], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "healReceived", value: [30, 50], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "mpRecover", value: [10, 15], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "天毒道功", intro: "传闻承自太古天毒道祖，毒道合一、攻守兼备", mpCost: 0, cooldown: 0,
        battleEffects: [
          { type: "applyModifier", modifierType: "magDamageDealt", value: [25, 40], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "damageDealt", value: [15, 25], duration: 99, maxStacks: 1 },
          { type: "applyModifier", modifierType: "lifesteal", value: [8, 22], duration: 99, maxStacks: 1 }
        ], type: "被动"
      },
      { name: "天毒归宗", intro: "太古毒祖范围禁术，万毒归宗、毒霸天下", mpCost: [500, 5000], cooldown: 10,
        battleEffects: [
          { type: "dealDamage", damageType: "magical", baseValue: [200, 1050], scalingRatio: [0.68, 2.25], scalingStat: "spirit" }
        ], type: "主动", isAoE: true
      }
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
// 随机分配
// ═══════════════════════════════════════════════════════════════════════════

function pickFromPool(pool: readonly GongfaSpecialEffect[]): GongfaSpecialEffect {
  return { ...pool[Math.floor(Math.random() * pool.length)] };
}

function filterPool(pool: readonly GongfaSpecialEffect[], effectType?: GongfaEffectType): readonly GongfaSpecialEffect[] {
  if (!effectType) return pool;
  const filtered = pool.filter(e => e.type === effectType);
  return filtered.length > 0 ? filtered : pool;
}

export function rollGongfaFunction(system: GongfaSystem, grade: ItemGrade, role?: GongfaRole): GongfaSpecialEffect {
  const systemCatalog = GONGFA_EFFECT_CATALOG[system];
  const effectType = role ? ROLE_TO_EFFECT_TYPE[role] : undefined;

  const pool = filterPool(systemCatalog[grade], effectType);
  if (pool.length > 0) return pickFromPool(pool);

  for (const sys of Object.values(GONGFA_EFFECT_CATALOG)) {
    for (const g of GRADE_ORDER) {
      const fallbackPool = filterPool(sys[g], effectType);
      if (fallbackPool.length > 0) return pickFromPool(fallbackPool);
    }
  }

  for (const sys of Object.values(GONGFA_EFFECT_CATALOG)) {
    for (const g of GRADE_ORDER) {
      if (sys[g].length > 0) return pickFromPool(sys[g]);
    }
  }

  return { name: "默认功法", intro: "来历不明的基础修行法门，运转时丹田微微发热", mpCost: [10, 50], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [50, 500], scalingRatio: [1.0, 4.0], scalingStat: "strength" }], type: "主动" };
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
