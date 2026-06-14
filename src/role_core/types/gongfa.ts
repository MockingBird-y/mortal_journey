import type { ItemBonusMap, ItemGrade } from "./itemInfo";

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

// ═══════════════════════════════════════════════════════════════════════════
// 功法战斗效果 — 与 battle_engine SkillEffect 一一对应
// 数值字段支持 [第1层, 第10层] 插值
// ═══════════════════════════════════════════════════════════════════════════

export type GongfaBattleEffect =
  | { type: "dealDamage"; damageType: "physical" | "magical"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: "strength" | "perception" }
  | { type: "dealDamageExecute"; damageType: "physical" | "magical"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: "strength" | "perception"; threshold: number; bonusPercent: number }
  | { type: "dealDamagePierce"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: "strength" | "perception" }
  | { type: "heal"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: "strength" | "perception" }
  | { type: "lifesteal"; damageType: "physical" | "magical"; damagePercent: LayerValue }
  | { type: "applyModifier"; modifierType: string; value: LayerValue; duration: number; maxStacks: number; targetSelf?: boolean }
  | { type: "applyCc"; ccType: string; chance: LayerValue; duration: number }
  | { type: "applyStatus"; statusType: string; tickValue: LayerValue; isPercent: boolean; duration: number; maxStacks: number }
  | { type: "shield"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: "strength" | "perception" }
  | { type: "counter"; baseValue: LayerValue; scalingRatio: LayerValue; scalingStat: "strength" | "perception"; duration: number }
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
  battleEffects: readonly GongfaBattleEffect[];
  type: GongfaEffectType;
  mpCost: LayerValue;
  cooldown: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 描述解析
// ═══════════════════════════════════════════════════════════════════════════

function bakeValue(
  eff: GongfaBattleEffect,
  getStat: (key: "strength" | "perception") => number,
  masteryMult: number,
  layer: number,
): number | undefined {
  if ("baseValue" in eff && "scalingRatio" in eff && "scalingStat" in eff) {
    const bv = atLayer(eff.baseValue as LayerValue, layer);
    const sr = atLayer(eff.scalingRatio as LayerValue, layer);
    const stat = getStat(eff.scalingStat as "strength" | "perception");
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

const STAT_LABELS: Record<string, string> = {
  strength: "劲力",
  perception: "神识",
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
  const sr = atLayer(eff.scalingRatio as LayerValue, layer);
  if (sr === 0) return String(v);
  const bv = atLayer(eff.baseValue as LayerValue, layer);
  const ss = (eff as { scalingStat: "strength" | "perception" }).scalingStat;
  const statLabel = STAT_LABELS[ss] ?? ss;
  return `${v}（${bv} + ${sr}×${statLabel}）`;
}

export function resolveGongfaBattleEffectDesc(
  eff: GongfaBattleEffect,
  getStat: (key: "strength" | "perception") => number,
  masteryMult: number,
  layer: number,
  showFormula: boolean = true,
): string {
  const v = bakeValue(eff, getStat, masteryMult, layer);
  const sv = formatScaledValue(eff, v, layer, showFormula);

  switch (eff.type) {
    case "dealDamage": {
      const dt = DMG_TYPE_LABELS[eff.damageType] ?? "物理";
      return `造成${sv}点${dt}伤害`;
    }
    case "dealDamageExecute": {
      const dt = DMG_TYPE_LABELS[eff.damageType] ?? "物理";
      return `造成${sv}点${dt}伤害（目标低于${Math.round(eff.threshold * 100)}%血量时伤害+${eff.bonusPercent}%）`;
    }
    case "dealDamagePierce":
      return `造成${sv}点真实伤害（无视防御）`;
    case "heal":
      return `恢复${sv}点生命`;
    case "lifesteal": {
      const dt = DMG_TYPE_LABELS[eff.damageType] ?? "物理";
      const pct = atLayer(eff.damagePercent, layer);
      return `造成${dt}伤害并吸取${pct}%生命`;
    }
    case "applyModifier": {
      const label = MODIFIER_LABELS[eff.modifierType] ?? eff.modifierType;
      const val = atLayer(eff.value, layer);
      const sign = val > 0 ? "+" : "";
      const dur = eff.duration >= 99 ? "（永久）" : `，持续${eff.duration}回合`;
      const stack = eff.maxStacks > 1 ? `（最多叠${eff.maxStacks}层）` : "";
      const target = eff.targetSelf ? "自身" : "目标";
      return `${target}${label}${sign}${val}%${dur}${stack}`;
    }
    case "applyCc": {
      const label = CC_LABELS[eff.ccType] ?? eff.ccType;
      const pct = atLayer(eff.chance, layer);
      return `${label}目标（${Math.round(pct * 100)}%概率），持续${eff.duration}回合`;
    }
    case "applyStatus": {
      const label = STATUS_LABELS[eff.statusType] ?? eff.statusType;
      const tick = atLayer(eff.tickValue, layer);
      const tickStr = eff.isPercent ? `最大生命${tick}%` : `${tick}点`;
      const stack = eff.maxStacks > 1 ? `（最多叠${eff.maxStacks}层）` : "";
      return `每回合造成${tickStr}${label}伤害，持续${eff.duration}回合${stack}`;
    }
    case "shield":
      return `开局获得${sv}点护盾`;
    case "counter": {
      const dur = eff.duration >= 99 ? "（永久）" : `，持续${eff.duration}回合`;
      return `受击时反击${sv}点伤害${dur}`;
    }
    case "reflect": {
      const pct = atLayer(eff.percent, layer);
      const dur = eff.duration >= 99 ? "（永久）" : `，持续${eff.duration}回合`;
      return `反弹${pct}%受到的伤害${dur}`;
    }
    case "damageShare": {
      const pct = atLayer(eff.percent, layer);
      const dur = eff.duration >= 99 ? "（永久）" : `，持续${eff.duration}回合`;
      return `分摊${pct}%队友受到的伤害${dur}`;
    }
    case "deathWard": {
      const dur = eff.duration >= 99 ? "（永久）" : `，持续${eff.duration}回合`;
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
      return "驱散目标所有增益效果";
    case "revive":
      return `复活目标并恢复${eff.hpPercent}%生命`;
    case "summon": {
      const dmg = atLayer(eff.summonDamage, layer);
      return `召唤${eff.name}，每回合造成${dmg}点伤害，持续${eff.duration}回合`;
    }
  }
}

export function resolveGongfaEffectDisplay(
  fn: GongfaSpecialEffect,
  getStat: (key: "strength" | "perception") => number,
  masteryMult: number,
  layer: number,
): string {
  const parts = fn.battleEffects
    .map(e => resolveGongfaBattleEffectDesc(e, getStat, masteryMult, layer))
    .join("；");
  const mp = atLayer(fn.mpCost, layer);
  if (mp > 0) {
    return parts + `\n法力消耗：${mp}`;
  }
  return parts;
}

// ═══════════════════════════════════════════════════════════════════════════
// 效果目录（按体系 × 品阶，每品阶3主动 + 1被动）
// 数值字段写 [第1层, 第10层]
// ═══════════════════════════════════════════════════════════════════════════

const GRADE_ORDER: readonly ItemGrade[] = ["下品", "中品", "上品", "极品", "仙品", "神品"];

export const GONGFA_EFFECT_CATALOG: Readonly<Record<GongfaSystem, Readonly<Record<ItemGrade, readonly GongfaSpecialEffect[]>>>> = {

  "通用": {
    "下品": [
      { name: "元气斩", mpCost: [5, 30], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [40, 500], scalingRatio: [0.8, 3.0], scalingStat: "strength" }], type: "主动" },
      { name: "灵气弹", mpCost: [5, 30], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [40, 500], scalingRatio: [0.8, 3.0], scalingStat: "perception" }], type: "主动" },
      { name: "回春术", mpCost: [8, 50], cooldown: 0, battleEffects: [{ type: "heal", baseValue: [50, 600], scalingRatio: [0.4, 2.0], scalingStat: "perception" }], type: "主动" },
      { name: "腐蚀术", mpCost: [8, 50], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [30, 400], scalingRatio: [0.5, 2.0], scalingStat: "perception" }, { type: "applyStatus", statusType: "poison", tickValue: [15, 150], isPercent: false, duration: 3, maxStacks: 3 }, { type: "applyStatus", statusType: "bleed", tickValue: [15, 150], isPercent: false, duration: 3, maxStacks: 3 }], type: "主动" },
      { name: "养生诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "hpRecover", value: [2, 4], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "凝神诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageDealt", value: [6, 12], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "护体诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-12, -25], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "再生体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyStatus", statusType: "hpRegen", tickValue: [2, 4], isPercent: true, duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "中品": [
      { name: "元气破", mpCost: [10, 70], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [60, 800], scalingRatio: [1.0, 4.0], scalingStat: "strength" }], type: "主动" },
      { name: "灵爆术", mpCost: [10, 70], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [60, 800], scalingRatio: [1.0, 4.0], scalingStat: "perception" }], type: "主动" },
      { name: "净化术", mpCost: [12, 80], cooldown: 1, battleEffects: [{ type: "cleanse" }], type: "主动" },
      { name: "定身术", mpCost: [12, 80], cooldown: 1, battleEffects: [{ type: "applyCc", ccType: "stun", chance: [0.25, 0.45], duration: 1 }], type: "主动" },
      { name: "灼烧术", mpCost: [12, 80], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [50, 700], scalingRatio: [0.6, 2.5], scalingStat: "perception" }, { type: "applyStatus", statusType: "burn", tickValue: [30, 300], isPercent: false, duration: 3, maxStacks: 3 }], type: "主动" },
      { name: "回元体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "mpRecover", value: [2, 4], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "坚韧体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-15, -30], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "轻灵诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "speed", value: [5, 10], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "吸血体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "lifesteal", value: [4, 8], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "上品": [
      { name: "元气斩魂", mpCost: [18, 130], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [100, 1200], scalingRatio: [1.2, 5.0], scalingStat: "strength" }], type: "主动" },
      { name: "灵元爆发", mpCost: [18, 130], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [100, 1200], scalingRatio: [1.2, 5.0], scalingStat: "perception" }], type: "主动" },
      { name: "驱散术", mpCost: [20, 140], cooldown: 2, battleEffects: [{ type: "dispel" }], type: "主动" },
      { name: "真实打击", mpCost: [18, 130], cooldown: 1, battleEffects: [{ type: "dealDamagePierce", baseValue: [80, 1000], scalingRatio: [0.8, 3.5], scalingStat: "strength" }], type: "主动" },
      { name: "嗜灵术", mpCost: [20, 140], cooldown: 1, battleEffects: [{ type: "lifesteal", damageType: "magical", damagePercent: [30, 50] }, { type: "applyStatus", statusType: "mpDrain", tickValue: [4, 6], isPercent: false, duration: 3, maxStacks: 3 }], type: "主动" },
      { name: "聚元诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageDealt", value: [10, 18], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "physDamageDealt", value: [8, 12], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "magDamageDealt", value: [8, 12], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "明心诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "healReceived", value: [15, 25], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "hpRecover", value: [3, 5], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "灵动诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "dodgeRate", value: [4, 8], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "speed", value: [6, 12], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "破甲诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "defensePenetration", value: [6, 12], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "physDefensePenetration", value: [5, 10], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "magDefensePenetration", value: [5, 10], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "极品": [
      { name: "万象破", mpCost: [35, 220], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [160, 1800], scalingRatio: [1.5, 6.0], scalingStat: "strength" }], type: "主动" },
      { name: "万象术", mpCost: [35, 220], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [160, 1800], scalingRatio: [1.5, 6.0], scalingStat: "perception" }], type: "主动" },
      { name: "起死回生", mpCost: [50, 300], cooldown: 4, battleEffects: [{ type: "revive", hpPercent: 50 }], type: "主动" },
      { name: "斩杀术", mpCost: [38, 240], cooldown: 2, battleEffects: [{ type: "dealDamageExecute", damageType: "physical", baseValue: [150, 1800], scalingRatio: [1.0, 5.0], scalingStat: "strength", threshold: 0.5, bonusPercent: 50 }], type: "主动" },
      { name: "隐遁术", mpCost: [40, 260], cooldown: 3, battleEffects: [{ type: "stealth", duration: 2 }, { type: "dealDamage", damageType: "physical", baseValue: [120, 1500], scalingRatio: [1.0, 5.0], scalingStat: "strength" }], type: "主动" },
      { name: "金刚护体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-20, -35], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "physDamageTaken", value: [-10, -18], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "灵盾护体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageTaken", value: [-10, -18], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "hpRecover", value: [4, 6], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "归元诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "hpRecover", value: [5, 8], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "mpRecover", value: [5, 8], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "暴击诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "critRate", value: [8, 15], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "critDmg", value: [12, 22], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "反击阵", mpCost: 0, cooldown: 0, battleEffects: [{ type: "counter", baseValue: [100, 1200], scalingRatio: [0.4, 2.5], scalingStat: "strength", duration: 99 }], type: "被动" },
    ],
    "仙品": [
      { name: "万法归宗·武", mpCost: [55, 340], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [250, 2500], scalingRatio: [1.8, 8.0], scalingStat: "strength" }], type: "主动" },
      { name: "万法归宗·法", mpCost: [55, 340], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [250, 2500], scalingRatio: [1.8, 8.0], scalingStat: "perception" }], type: "主动" },
      { name: "天道净化", mpCost: [60, 360], cooldown: 3, battleEffects: [{ type: "cleanse" }, { type: "shield", baseValue: [200, 2000], scalingRatio: [0.5, 3.0], scalingStat: "perception" }], type: "主动" },
      { name: "万法封印", mpCost: [60, 360], cooldown: 3, battleEffects: [{ type: "applyCc", ccType: "silence", chance: [0.40, 0.60], duration: 2 }, { type: "applyCc", ccType: "freeze", chance: [0.35, 0.55], duration: 1 }], type: "主动" },
      { name: "神速术", mpCost: [55, 340], cooldown: 3, battleEffects: [{ type: "extraAction", chance: 0.15 }, { type: "gaugeManipulate", value: -20 }], type: "主动" },
      { name: "万象归元", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageDealt", value: [12, 20], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "damageTaken", value: [-15, -25], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "不灭道体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "deathWard", duration: 99 }, { type: "applyModifier", modifierType: "healReceived", value: [20, 35], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "灵动天成", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "dodgeRate", value: [6, 12], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "speed", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "舍生阵", mpCost: 0, cooldown: 0, battleEffects: [{ type: "damageShare", percent: [30, 45], duration: 99 }, { type: "applyModifier", modifierType: "damageTaken", value: [-15, -25], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "神品": [
      { name: "万道归一·武", mpCost: [90, 550], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [400, 4000], scalingRatio: [2.0, 10.0], scalingStat: "strength" }], type: "主动" },
      { name: "万道归一·法", mpCost: [90, 550], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [400, 4000], scalingRatio: [2.0, 10.0], scalingStat: "perception" }], type: "主动" },
      { name: "轮回逆转", mpCost: [120, 700], cooldown: 5, battleEffects: [{ type: "revive", hpPercent: 70 }, { type: "shield", baseValue: [500, 5000], scalingRatio: [0.5, 4.0], scalingStat: "perception" }], type: "主动" },
      { name: "万道封魔", mpCost: [110, 660], cooldown: 4, battleEffects: [{ type: "applyCc", ccType: "confusion", chance: [0.35, 0.55], duration: 2 }, { type: "applyCc", ccType: "fear", chance: [0.35, 0.55], duration: 1 }, { type: "applyCc", ccType: "taunt", chance: [0.45, 0.70], duration: 2 }], type: "主动" },
      { name: "万灵召唤", mpCost: [100, 600], cooldown: 4, battleEffects: [{ type: "summon", name: "灵体", trigger: "on_turn_end", summonDamage: [200, 2500], duration: 5 }], type: "主动" },
      { name: "天道法身", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageDealt", value: [15, 25], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "damageTaken", value: [-25, -40], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "hpRecover", value: [5, 8], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "不朽道体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "deathWard", duration: 99 }, { type: "reflect", percent: [20, 35], duration: 99 }, { type: "applyModifier", modifierType: "healReceived", value: [25, 40], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "万法之源", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageDealt", value: [20, 30], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "magDamageDealt", value: [15, 25], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "physDamageDealt", value: [15, 25], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "天机阵", mpCost: 0, cooldown: 0, battleEffects: [{ type: "counter", baseValue: [200, 2500], scalingRatio: [0.5, 3.5], scalingStat: "strength", duration: 99 }, { type: "damageShare", percent: [25, 40], duration: 99 }], type: "被动" },
    ],
  },

  "剑修": {
    "下品": [
      { name: "基础剑法", mpCost: [3, 20], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [50, 600], scalingRatio: [1.0, 4.0], scalingStat: "strength" }], type: "主动" },
      { name: "追风剑", mpCost: [5, 30], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [40, 500], scalingRatio: [0.6, 2.5], scalingStat: "strength" }, { type: "applyModifier", modifierType: "critRate", value: [8, 15], duration: 2, maxStacks: 1, targetSelf: true }], type: "主动" },
      { name: "破甲剑", mpCost: [4, 25], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [40, 500], scalingRatio: [0.6, 2.5], scalingStat: "strength" }, { type: "applyModifier", modifierType: "physDefensePenetration", value: [10, 20], duration: 2, maxStacks: 1, targetSelf: true }], type: "主动" },
      { name: "剑意", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "critRate", value: [5, 10], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "利刃", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "physDamageDealt", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "疾风步", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "speed", value: [5, 10], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "中品": [
      { name: "疾风剑", mpCost: [8, 60], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [80, 1000], scalingRatio: [1.2, 5.0], scalingStat: "strength" }], type: "主动" },
      { name: "致命突刺", mpCost: [10, 70], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [60, 800], scalingRatio: [0.8, 3.5], scalingStat: "strength" }, { type: "applyModifier", modifierType: "critRate", value: [10, 18], duration: 2, maxStacks: 1, targetSelf: true }], type: "主动" },
      { name: "连环剑", mpCost: [10, 80], cooldown: 1, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [50, 700], scalingRatio: [0.5, 2.5], scalingStat: "strength" }, { type: "extraAction", chance: 0.10 }], type: "主动" },
      { name: "剑心通明", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "critRate", value: [8, 15], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "critDmg", value: [10, 20], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "穿云剑意", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "physDefensePenetration", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "疾影", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "speed", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "上品": [
      { name: "万剑诀", mpCost: [15, 120], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [120, 1500], scalingRatio: [1.5, 6.0], scalingStat: "strength" }], type: "主动" },
      { name: "剑气纵横", mpCost: [15, 120], cooldown: 1, battleEffects: [{ type: "dealDamagePierce", baseValue: [100, 1200], scalingRatio: [1.0, 4.0], scalingStat: "strength" }], type: "主动" },
      { name: "御剑术", mpCost: [18, 130], cooldown: 2, battleEffects: [{ type: "summon", name: "飞剑", trigger: "on_attack", summonDamage: [60, 800], duration: 3 }], type: "主动" },
      { name: "无影剑意", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "critRate", value: [10, 20], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "critDmg", value: [15, 30], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "身法如风", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "dodgeRate", value: [5, 10], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "speed", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "反击剑", mpCost: 0, cooldown: 0, battleEffects: [{ type: "counter", baseValue: [60, 800], scalingRatio: [0.4, 2.5], scalingStat: "strength", duration: 99 }], type: "被动" },
    ],
    "极品": [
      { name: "天剑诀", mpCost: [30, 200], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [200, 2200], scalingRatio: [1.8, 7.5], scalingStat: "strength" }], type: "主动" },
      { name: "一剑封喉", mpCost: [32, 210], cooldown: 2, battleEffects: [{ type: "dealDamageExecute", damageType: "physical", baseValue: [180, 2000], scalingRatio: [1.2, 5.0], scalingStat: "strength", threshold: 0.5, bonusPercent: 50 }], type: "主动" },
      { name: "御剑·万剑归宗", mpCost: [38, 250], cooldown: 3, battleEffects: [{ type: "summon", name: "飞剑", trigger: "on_attack", summonDamage: [120, 1500], duration: 4 }, { type: "extraAction", chance: 0.15 }], type: "主动" },
      { name: "剑神之体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "critRate", value: [12, 22], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "critDmg", value: [20, 40], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "破灭剑意", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "physDamageDealt", value: [15, 25], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "physDefensePenetration", value: [12, 22], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "疾电", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "speed", value: [12, 22], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "dodgeRate", value: [6, 12], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "仙品": [
      { name: "诛仙剑", mpCost: [50, 300], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [300, 3000], scalingRatio: [2.0, 9.0], scalingStat: "strength" }], type: "主动" },
      { name: "一剑万杀", mpCost: [55, 340], cooldown: 3, battleEffects: [{ type: "dealDamageExecute", damageType: "physical", baseValue: [250, 2800], scalingRatio: [1.0, 5.0], scalingStat: "strength", threshold: 0.4, bonusPercent: 60 }, { type: "applyModifier", modifierType: "critRate", value: [15, 25], duration: 2, maxStacks: 1, targetSelf: true }], type: "主动" },
      { name: "剑影遁形", mpCost: [50, 320], cooldown: 3, battleEffects: [{ type: "stealth", duration: 2 }, { type: "dealDamage", damageType: "physical", baseValue: [200, 2500], scalingRatio: [1.0, 5.0], scalingStat: "strength" }], type: "主动" },
      { name: "万剑归心", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "critRate", value: [15, 28], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "critDmg", value: [25, 50], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "绝影", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "dodgeRate", value: [8, 15], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "speed", value: [12, 20], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "无极剑意", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "physDamageDealt", value: [18, 30], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "damageDealt", value: [12, 20], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "神品": [
      { name: "开天一剑", mpCost: [80, 500], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [500, 5000], scalingRatio: [2.5, 12.0], scalingStat: "strength" }], type: "主动" },
      { name: "诛仙·万剑归宗", mpCost: [100, 600], cooldown: 4, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [300, 4000], scalingRatio: [0.8, 5.0], scalingStat: "strength" }, { type: "summon", name: "飞剑", trigger: "on_crit", summonDamage: [200, 3000], duration: 4 }, { type: "extraAction", chance: 0.20 }], type: "主动" },
      { name: "一剑破万法", mpCost: [100, 600], cooldown: 3, battleEffects: [{ type: "dealDamagePierce", baseValue: [400, 5000], scalingRatio: [1.5, 8.0], scalingStat: "strength" }, { type: "gaugeManipulate", value: -30 }], type: "主动" },
      { name: "天道剑体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "critRate", value: [18, 35], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "critDmg", value: [30, 60], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "万速之影", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "speed", value: [15, 28], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "dodgeRate", value: [10, 20], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "不灭剑意", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "physDamageDealt", value: [20, 35], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "physDefensePenetration", value: [18, 30], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "damageDealt", value: [15, 25], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
  },

  "体修": {
    "下品": [
      { name: "铁拳碎岩", mpCost: [3, 20], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [50, 600], scalingRatio: [1.0, 4.0], scalingStat: "strength" }], type: "主动" },
      { name: "碎骨拳", mpCost: [5, 30], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [40, 500], scalingRatio: [0.6, 2.5], scalingStat: "strength" }, { type: "applyStatus", statusType: "bleed", tickValue: [20, 200], isPercent: false, duration: 3, maxStacks: 3 }], type: "主动" },
      { name: "震击", mpCost: [4, 25], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [40, 500], scalingRatio: [0.6, 2.5], scalingStat: "strength" }, { type: "applyCc", ccType: "stun", chance: [0.15, 0.30], duration: 1 }], type: "主动" },
      { name: "铁壁功", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-15, -30], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "蛮力诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageDealt", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "回春体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "hpRecover", value: [2, 4], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "中品": [
      { name: "崩山击", mpCost: [8, 60], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [80, 1000], scalingRatio: [1.2, 5.0], scalingStat: "strength" }], type: "主动" },
      { name: "碎脉击", mpCost: [10, 80], cooldown: 2, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [60, 800], scalingRatio: [0.6, 3.0], scalingStat: "strength" }, { type: "applyStatus", statusType: "bleed", tickValue: [30, 400], isPercent: false, duration: 3, maxStacks: 5 }], type: "主动" },
      { name: "擒拿手", mpCost: [10, 70], cooldown: 1, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [50, 700], scalingRatio: [0.5, 2.5], scalingStat: "strength" }, { type: "applyCc", ccType: "taunt", chance: [0.50, 0.80], duration: 2 }], type: "主动" },
      { name: "金刚体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-20, -40], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "吸血功", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "lifesteal", value: [5, 10], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "体罡", mpCost: 0, cooldown: 0, battleEffects: [{ type: "shield", baseValue: [80, 1000], scalingRatio: [0.4, 2.5], scalingStat: "strength" }], type: "被动" },
    ],
    "上品": [
      { name: "山岳投", mpCost: [15, 120], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [120, 1500], scalingRatio: [1.5, 6.0], scalingStat: "strength" }], type: "主动" },
      { name: "嗜血重击", mpCost: [15, 120], cooldown: 0, battleEffects: [{ type: "lifesteal", damageType: "physical", damagePercent: [40, 60] }], type: "主动" },
      { name: "霸王击", mpCost: [18, 140], cooldown: 2, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [80, 1000], scalingRatio: [0.5, 3.0], scalingStat: "strength" }, { type: "applyCc", ccType: "stun", chance: [0.30, 0.55], duration: 1 }, { type: "gaugeManipulate", value: -20 }], type: "主动" },
      { name: "霸体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "counter", baseValue: [80, 1200], scalingRatio: [0.5, 4.0], scalingStat: "strength", duration: 99 }], type: "被动" },
      { name: "不屈之躯", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "hpRecover", value: [4, 7], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "healReceived", value: [15, 30], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "铁骨铜皮", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-15, -25], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "physDamageTaken", value: [-10, -20], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "极品": [
      { name: "涅槃击", mpCost: [30, 200], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [200, 2200], scalingRatio: [1.8, 7.5], scalingStat: "strength" }], type: "主动" },
      { name: "天罡怒", mpCost: [35, 240], cooldown: 3, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [120, 1500], scalingRatio: [0.4, 2.5], scalingStat: "strength" }, { type: "applyCc", ccType: "stun", chance: [0.35, 0.65], duration: 1 }, { type: "gaugeManipulate", value: -30 }], type: "主动" },
      { name: "斩魂击", mpCost: [35, 220], cooldown: 2, battleEffects: [{ type: "dealDamageExecute", damageType: "physical", baseValue: [150, 1800], scalingRatio: [0.8, 4.0], scalingStat: "strength", threshold: 0.5, bonusPercent: 50 }], type: "主动" },
      { name: "不灭金身", mpCost: 0, cooldown: 0, battleEffects: [{ type: "deathWard", duration: 99 }, { type: "applyModifier", modifierType: "damageTaken", value: [-25, -45], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "反震体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "reflect", percent: [25, 40], duration: 99 }, { type: "applyModifier", modifierType: "damageTaken", value: [-10, -20], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "舍身诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "damageShare", percent: [30, 50], duration: 99 }, { type: "applyModifier", modifierType: "damageTaken", value: [-15, -25], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "仙品": [
      { name: "金身怒目", mpCost: [50, 300], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [300, 3000], scalingRatio: [2.0, 9.0], scalingStat: "strength" }], type: "主动" },
      { name: "灭世碎空拳", mpCost: [60, 360], cooldown: 4, battleEffects: [{ type: "dealDamageExecute", damageType: "physical", baseValue: [200, 2500], scalingRatio: [0.5, 3.5], scalingStat: "strength", threshold: 0.5, bonusPercent: 50 }, { type: "applyModifier", modifierType: "damageDealt", value: [30, 60], duration: 2, maxStacks: 3, targetSelf: true }], type: "主动" },
      { name: "血魔吞天", mpCost: [55, 340], cooldown: 3, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [200, 2500], scalingRatio: [0.8, 4.0], scalingStat: "strength" }, { type: "lifesteal", damageType: "physical", damagePercent: [50, 75] }], type: "主动" },
      { name: "万象归元", mpCost: 0, cooldown: 0, battleEffects: [{ type: "reflect", percent: [30, 50], duration: 99 }, { type: "applyModifier", modifierType: "damageTaken", value: [-15, -30], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "不朽金身", mpCost: 0, cooldown: 0, battleEffects: [{ type: "deathWard", duration: 99 }, { type: "counter", baseValue: [200, 2500], scalingRatio: [0.5, 4.0], scalingStat: "strength", duration: 99 }], type: "被动" },
      { name: "狂战之躯", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageDealt", value: [15, 25], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "physDamageDealt", value: [15, 25], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "lifesteal", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "神品": [
      { name: "涅槃重生击", mpCost: [80, 500], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [500, 5000], scalingRatio: [2.5, 12.0], scalingStat: "strength" }], type: "主动" },
      { name: "混沌灭世击", mpCost: [100, 600], cooldown: 5, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [300, 4000], scalingRatio: [0.8, 5.0], scalingStat: "strength" }, { type: "applyStatus", statusType: "bleed", tickValue: [100, 800], isPercent: false, duration: 3, maxStacks: 5 }, { type: "applyCc", ccType: "stun", chance: [0.40, 0.75], duration: 1 }], type: "主动" },
      { name: "天崩地裂", mpCost: [100, 600], cooldown: 4, battleEffects: [{ type: "dealDamageExecute", damageType: "physical", baseValue: [300, 3500], scalingRatio: [0.6, 4.0], scalingStat: "strength", threshold: 0.4, bonusPercent: 60 }, { type: "applyCc", ccType: "stun", chance: [0.40, 0.70], duration: 1 }, { type: "gaugeManipulate", value: -40 }], type: "主动" },
      { name: "不朽之躯", mpCost: 0, cooldown: 0, battleEffects: [{ type: "deathWard", duration: 99 }, { type: "counter", baseValue: [300, 4000], scalingRatio: [0.5, 4.0], scalingStat: "strength", duration: 99 }, { type: "reflect", percent: [20, 40], duration: 99 }], type: "被动" },
      { name: "万劫不灭", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-35, -55], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "hpRecover", value: [6, 10], duration: 99, maxStacks: 1 }, { type: "deathWard", duration: 99 }], type: "被动" },
      { name: "混沌金身", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageDealt", value: [20, 35], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "damageTaken", value: [-20, -35], duration: 99, maxStacks: 1 }, { type: "counter", baseValue: [200, 3000], scalingRatio: [0.5, 3.5], scalingStat: "strength", duration: 99 }], type: "被动" },
    ],
  },

  "法修": {
    "下品": [
      { name: "法弹术", mpCost: [10, 60], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [50, 600], scalingRatio: [1.0, 4.0], scalingStat: "perception" }], type: "主动" },
      { name: "火球术", mpCost: [8, 50], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [40, 500], scalingRatio: [0.6, 2.5], scalingStat: "perception" }, { type: "applyStatus", statusType: "burn", tickValue: [20, 200], isPercent: false, duration: 3, maxStacks: 3 }], type: "主动" },
      { name: "寒冰刺", mpCost: [8, 50], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [40, 500], scalingRatio: [0.6, 2.5], scalingStat: "perception" }, { type: "applyCc", ccType: "freeze", chance: [0.15, 0.30], duration: 1 }], type: "主动" },
      { name: "灵甲术", mpCost: 0, cooldown: 0, battleEffects: [{ type: "shield", baseValue: [80, 1000], scalingRatio: [0.4, 2.5], scalingStat: "perception" }], type: "被动" },
      { name: "聚灵体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "冥想", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "mpRecover", value: [2, 4], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "中品": [
      { name: "灵海冲击", mpCost: [20, 120], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [80, 1000], scalingRatio: [1.2, 5.0], scalingStat: "perception" }], type: "主动" },
      { name: "灼魂术", mpCost: [25, 150], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [60, 800], scalingRatio: [0.5, 3.0], scalingStat: "perception" }, { type: "applyStatus", statusType: "burn", tickValue: [40, 400], isPercent: false, duration: 3, maxStacks: 5 }], type: "主动" },
      { name: "寂静术", mpCost: [20, 130], cooldown: 1, battleEffects: [{ type: "applyCc", ccType: "silence", chance: [0.45, 0.70], duration: 2 }, { type: "dealDamage", damageType: "magical", baseValue: [50, 700], scalingRatio: [0.4, 2.0], scalingStat: "perception" }], type: "主动" },
      { name: "破法体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDefensePenetration", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "寒冰体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-15, -30], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "法力回流", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "mpRecover", value: [3, 5], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "上品": [
      { name: "灵元爆发", mpCost: [40, 240], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [120, 1500], scalingRatio: [1.5, 6.0], scalingStat: "perception" }], type: "主动" },
      { name: "冰封禁制", mpCost: [35, 200], cooldown: 3, battleEffects: [{ type: "applyCc", ccType: "freeze", chance: [0.50, 0.80], duration: 2 }, { type: "applyModifier", modifierType: "magDamageDealt", value: [30, 55], duration: 2, maxStacks: 1, targetSelf: true }], type: "主动" },
      { name: "破灭术", mpCost: [35, 220], cooldown: 1, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [100, 1200], scalingRatio: [0.8, 4.0], scalingStat: "perception" }, { type: "applyModifier", modifierType: "magDefensePenetration", value: [15, 25], duration: 2, maxStacks: 1, targetSelf: true }], type: "主动" },
      { name: "聚灵阵", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [20, 45], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "法力澎湃", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "mpRecover", value: [5, 8], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "法盾强化", mpCost: 0, cooldown: 0, battleEffects: [{ type: "shield", baseValue: [150, 1800], scalingRatio: [0.5, 3.0], scalingStat: "perception" }], type: "被动" },
    ],
    "极品": [
      { name: "太虚法印", mpCost: [70, 400], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [200, 2200], scalingRatio: [1.8, 7.5], scalingStat: "perception" }], type: "主动" },
      { name: "雷火双诀", mpCost: [60, 360], cooldown: 3, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [150, 1800], scalingRatio: [0.4, 3.0], scalingStat: "perception" }, { type: "applyStatus", statusType: "burn", tickValue: [60, 500], isPercent: false, duration: 3, maxStacks: 5 }, { type: "applyCc", ccType: "silence", chance: [0.30, 0.50], duration: 1 }], type: "主动" },
      { name: "湮灭术", mpCost: [65, 380], cooldown: 2, battleEffects: [{ type: "dealDamageExecute", damageType: "magical", baseValue: [180, 2000], scalingRatio: [1.0, 5.0], scalingStat: "perception", threshold: 0.5, bonusPercent: 50 }], type: "主动" },
      { name: "万法之体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [25, 50], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "magDefensePenetration", value: [15, 25], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "法力无限", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "mpRecover", value: [8, 12], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "冰心诀", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-20, -35], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "magDamageTaken", value: [-10, -18], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "仙品": [
      { name: "神机法", mpCost: [100, 600], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [300, 3000], scalingRatio: [2.0, 9.0], scalingStat: "perception" }], type: "主动" },
      { name: "焚天烈焰", mpCost: [90, 520], cooldown: 3, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [250, 2800], scalingRatio: [0.8, 4.0], scalingStat: "perception" }, { type: "applyStatus", statusType: "burn", tickValue: [80, 800], isPercent: false, duration: 4, maxStacks: 8 }], type: "主动" },
      { name: "万象冰封", mpCost: [85, 500], cooldown: 4, battleEffects: [{ type: "applyCc", ccType: "freeze", chance: [0.60, 0.85], duration: 2 }, { type: "gaugeManipulate", value: -30 }, { type: "dealDamage", damageType: "magical", baseValue: [150, 1800], scalingRatio: [0.4, 2.0], scalingStat: "perception" }], type: "主动" },
      { name: "法神之体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [30, 55], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "magDefensePenetration", value: [20, 35], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "灵泉", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "mpRecover", value: [10, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "法天象地", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-20, -35], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "magDamageTaken", value: [-15, -25], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "speed", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "神品": [
      { name: "万法之源", mpCost: [150, 800], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [500, 5000], scalingRatio: [2.5, 12.0], scalingStat: "perception" }], type: "主动" },
      { name: "混元一气", mpCost: [120, 720], cooldown: 5, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [400, 4500], scalingRatio: [0.6, 4.0], scalingStat: "perception" }, { type: "lifesteal", damageType: "magical", damagePercent: [50, 80] }, { type: "applyModifier", modifierType: "magDamageDealt", value: [40, 70], duration: 3, maxStacks: 3, targetSelf: true }], type: "主动" },
      { name: "天火焚世", mpCost: [130, 760], cooldown: 4, battleEffects: [{ type: "dealDamageExecute", damageType: "magical", baseValue: [400, 5000], scalingRatio: [1.0, 6.0], scalingStat: "perception", threshold: 0.4, bonusPercent: 60 }, { type: "applyStatus", statusType: "burn", tickValue: [100, 1000], isPercent: false, duration: 4, maxStacks: 10 }, { type: "applyCc", ccType: "silence", chance: [0.40, 0.65], duration: 1 }], type: "主动" },
      { name: "法道至尊", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [35, 60], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "magDefensePenetration", value: [25, 40], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "damageDealt", value: [15, 25], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "灵法天成", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "mpRecover", value: [12, 18], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "magDamageTaken", value: [-20, -35], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "万象法盾", mpCost: 0, cooldown: 0, battleEffects: [{ type: "shield", baseValue: [500, 5000], scalingRatio: [0.5, 4.0], scalingStat: "perception" }, { type: "applyModifier", modifierType: "magDamageTaken", value: [-15, -25], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
  },

  "毒修": {
    "下品": [
      { name: "毒雾术", mpCost: [10, 60], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [50, 600], scalingRatio: [1.0, 4.0], scalingStat: "perception" }], type: "主动" },
      { name: "蚀骨毒", mpCost: [8, 50], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [40, 500], scalingRatio: [0.6, 2.5], scalingStat: "perception" }, { type: "applyStatus", statusType: "poison", tickValue: [20, 200], isPercent: false, duration: 3, maxStacks: 3 }], type: "主动" },
      { name: "毒虫召唤", mpCost: [8, 50], cooldown: 1, battleEffects: [{ type: "summon", name: "毒虫", trigger: "on_turn_start", summonDamage: [40, 500], duration: 3 }], type: "主动" },
      { name: "毒体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "lifesteal", value: [5, 10], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "蚀体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "聚毒", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "mpRecover", value: [2, 4], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "中品": [
      { name: "蛊毒术", mpCost: [20, 120], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [80, 1000], scalingRatio: [1.2, 5.0], scalingStat: "perception" }], type: "主动" },
      { name: "腐蚀毒", mpCost: [22, 140], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [60, 800], scalingRatio: [0.5, 3.0], scalingStat: "perception" }, { type: "applyStatus", statusType: "poison", tickValue: [30, 400], isPercent: false, duration: 3, maxStacks: 5 }], type: "主动" },
      { name: "噬魂毒", mpCost: [20, 130], cooldown: 1, battleEffects: [{ type: "applyStatus", statusType: "mpDrain", tickValue: [5, 8], isPercent: false, duration: 3, maxStacks: 3 }, { type: "applyCc", ccType: "fear", chance: [0.30, 0.50], duration: 1 }], type: "主动" },
      { name: "吸星毒体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "lifesteal", value: [8, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "毒抗体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "healReceived", value: [15, 25], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "毒力充沛", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [10, 18], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "上品": [
      { name: "百毒穿心", mpCost: [40, 240], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [120, 1500], scalingRatio: [1.5, 6.0], scalingStat: "perception" }], type: "主动" },
      { name: "剧毒之域", mpCost: [38, 230], cooldown: 3, battleEffects: [{ type: "applyStatus", statusType: "poison", tickValue: [5, 12], isPercent: true, duration: 4, maxStacks: 8 }, { type: "applyStatus", statusType: "bleed", tickValue: [50, 500], isPercent: false, duration: 3, maxStacks: 5 }], type: "主动" },
      { name: "幻毒术", mpCost: [35, 220], cooldown: 2, battleEffects: [{ type: "applyCc", ccType: "confusion", chance: [0.40, 0.60], duration: 2 }, { type: "applyCc", ccType: "fear", chance: [0.35, 0.55], duration: 1 }, { type: "dealDamage", damageType: "magical", baseValue: [60, 800], scalingRatio: [0.4, 2.0], scalingStat: "perception" }], type: "主动" },
      { name: "万毒不侵", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "lifesteal", value: [10, 18], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "healReceived", value: [15, 25], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "毒脉", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [15, 25], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "mpRecover", value: [4, 6], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "蛊虫巢", mpCost: 0, cooldown: 0, battleEffects: [{ type: "summon", name: "毒虫", trigger: "on_attack", summonDamage: [80, 1000], duration: 4 }], type: "被动" },
    ],
    "极品": [
      { name: "天毒破", mpCost: [70, 400], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [200, 2200], scalingRatio: [1.8, 7.5], scalingStat: "perception" }], type: "主动" },
      { name: "九幽蚀魂", mpCost: [65, 380], cooldown: 3, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [150, 1800], scalingRatio: [0.5, 3.0], scalingStat: "perception" }, { type: "applyStatus", statusType: "poison", tickValue: [8, 18], isPercent: true, duration: 4, maxStacks: 10 }, { type: "applyStatus", statusType: "mpDrain", tickValue: [8, 12], isPercent: false, duration: 3, maxStacks: 5 }], type: "主动" },
      { name: "噬灵毒蛊", mpCost: [60, 360], cooldown: 2, battleEffects: [{ type: "lifesteal", damageType: "magical", damagePercent: [45, 65] }, { type: "applyStatus", statusType: "poison", tickValue: [6, 14], isPercent: true, duration: 3, maxStacks: 5 }], type: "主动" },
      { name: "万毒之体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "lifesteal", value: [12, 22], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "healReceived", value: [20, 35], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "毒道至尊", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [18, 30], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "damageDealt", value: [10, 18], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "血毒共鸣", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "lifesteal", value: [10, 18], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "mpRecover", value: [5, 8], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "仙品": [
      { name: "天毒灭世", mpCost: [100, 600], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [300, 3000], scalingRatio: [2.0, 9.0], scalingStat: "perception" }], type: "主动" },
      { name: "毒龙噬天", mpCost: [90, 520], cooldown: 3, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [250, 2800], scalingRatio: [0.8, 4.0], scalingStat: "perception" }, { type: "lifesteal", damageType: "magical", damagePercent: [50, 75] }, { type: "applyStatus", statusType: "poison", tickValue: [10, 22], isPercent: true, duration: 4, maxStacks: 12 }], type: "主动" },
      { name: "万蛊噬心", mpCost: [85, 500], cooldown: 4, battleEffects: [{ type: "applyStatus", statusType: "poison", tickValue: [12, 25], isPercent: true, duration: 5, maxStacks: 15 }, { type: "applyStatus", statusType: "bleed", tickValue: [100, 1000], isPercent: false, duration: 4, maxStacks: 8 }, { type: "applyCc", ccType: "confusion", chance: [0.40, 0.60], duration: 2 }], type: "主动" },
      { name: "不灭毒体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "lifesteal", value: [15, 28], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "healReceived", value: [25, 40], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "毒皇之体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [22, 35], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "damageDealt", value: [12, 20], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "mpRecover", value: [8, 12], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "万蛊之巢", mpCost: 0, cooldown: 0, battleEffects: [{ type: "summon", name: "毒虫", trigger: "on_turn_start", summonDamage: [200, 2500], duration: 5 }], type: "被动" },
    ],
    "神品": [
      { name: "天道毒灭", mpCost: [150, 800], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [500, 5000], scalingRatio: [2.5, 12.0], scalingStat: "perception" }], type: "主动" },
      { name: "万毒归宗", mpCost: [130, 760], cooldown: 4, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [350, 4500], scalingRatio: [0.8, 5.0], scalingStat: "perception" }, { type: "applyStatus", statusType: "poison", tickValue: [15, 30], isPercent: true, duration: 5, maxStacks: 20 }, { type: "applyStatus", statusType: "bleed", tickValue: [150, 1500], isPercent: false, duration: 4, maxStacks: 10 }, { type: "applyCc", ccType: "fear", chance: [0.45, 0.70], duration: 2 }], type: "主动" },
      { name: "噬天毒蛊", mpCost: [120, 720], cooldown: 4, battleEffects: [{ type: "lifesteal", damageType: "magical", damagePercent: [60, 85] }, { type: "applyStatus", statusType: "poison", tickValue: [12, 28], isPercent: true, duration: 5, maxStacks: 15 }, { type: "applyStatus", statusType: "mpDrain", tickValue: [12, 18], isPercent: false, duration: 3, maxStacks: 8 }, { type: "applyCc", ccType: "confusion", chance: [0.40, 0.65], duration: 2 }], type: "主动" },
      { name: "万毒不灭体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "lifesteal", value: [18, 35], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "healReceived", value: [30, 50], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "mpRecover", value: [10, 15], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "天毒道体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [25, 40], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "damageDealt", value: [15, 25], duration: 99, maxStacks: 1 }, { type: "applyModifier", modifierType: "lifesteal", value: [12, 22], duration: 99, maxStacks: 1 }], type: "被动" },
      { name: "万蛊天巢", mpCost: 0, cooldown: 0, battleEffects: [{ type: "summon", name: "毒虫", trigger: "on_turn_start", summonDamage: [300, 4000], duration: 5 }, { type: "summon", name: "毒虫", trigger: "on_attack", summonDamage: [200, 3000], duration: 5 }], type: "被动" },
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

  return { name: "默认", mpCost: [10, 50], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [50, 500], scalingRatio: [1.0, 4.0], scalingStat: "strength" }], type: "主动" };
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
