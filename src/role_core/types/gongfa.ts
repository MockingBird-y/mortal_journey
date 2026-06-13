import type { ItemBonusMap, ItemGrade } from "./itemInfo";

// ═══════════════════════════════════════════════════════════════════════════
// 功法体系
// ═══════════════════════════════════════════════════════════════════════════

export const GONGFA_SYSTEM_KEYS = [
  "体修",
  "法修",
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
): string {
  if (v == null) return "0";
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
): string {
  const v = bakeValue(eff, getStat, masteryMult, layer);
  const sv = formatScaledValue(eff, v, layer);

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

  "体修": {
    "下品": [
      { name: "铁拳碎岩", mpCost: [3, 20], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [50, 600], scalingRatio: [1.0, 4.0], scalingStat: "strength" }], type: "主动" },
      { name: "铁壁功", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-15, -30], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "中品": [
      { name: "崩山击", mpCost: [8, 60], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [80, 1000], scalingRatio: [1.2, 5.0], scalingStat: "strength" }], type: "主动" },
      { name: "破甲击", mpCost: [10, 80], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [60, 800], scalingRatio: [0.8, 3.5], scalingStat: "strength" }, { type: "applyModifier", modifierType: "damageTaken", value: [25, 50], duration: 2, maxStacks: 1 }], type: "主动" },
      { name: "金刚体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-20, -40], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "上品": [
      { name: "山岳投", mpCost: [15, 120], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [120, 1500], scalingRatio: [1.5, 6.0], scalingStat: "strength" }], type: "主动" },
      { name: "碎脉击", mpCost: [18, 140], cooldown: 2, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [80, 1000], scalingRatio: [0.6, 3.0], scalingStat: "strength" }, { type: "applyStatus", statusType: "bleed", tickValue: [30, 400], isPercent: false, duration: 3, maxStacks: 5 }], type: "主动" },
      { name: "霸体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "counter", baseValue: [80, 1200], scalingRatio: [0.5, 4.0], scalingStat: "strength", duration: 99 }], type: "被动" },
    ],
    "极品": [
      { name: "涅槃击", mpCost: [30, 200], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [200, 2200], scalingRatio: [1.8, 7.5], scalingStat: "strength" }], type: "主动" },
      { name: "天罡怒", mpCost: [35, 240], cooldown: 3, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [120, 1500], scalingRatio: [0.4, 2.5], scalingStat: "strength" }, { type: "applyCc", ccType: "stun", chance: [0.35, 0.65], duration: 1 }, { type: "gaugeManipulate", value: -30 }], type: "主动" },
      { name: "不灭金身", mpCost: 0, cooldown: 0, battleEffects: [{ type: "deathWard", duration: 99 }, { type: "applyModifier", modifierType: "damageTaken", value: [-25, -45], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "仙品": [
      { name: "金身怒目", mpCost: [50, 300], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [300, 3000], scalingRatio: [2.0, 9.0], scalingStat: "strength" }], type: "主动" },
      { name: "灭世碎空拳", mpCost: [60, 360], cooldown: 4, battleEffects: [{ type: "dealDamageExecute", damageType: "physical", baseValue: [200, 2500], scalingRatio: [0.5, 3.5], scalingStat: "strength", threshold: 0.5, bonusPercent: 50 }, { type: "applyModifier", modifierType: "damageDealt", value: [30, 60], duration: 2, maxStacks: 3, targetSelf: true }], type: "主动" },
      { name: "万象归元", mpCost: 0, cooldown: 0, battleEffects: [{ type: "reflect", percent: [30, 50], duration: 99 }, { type: "applyModifier", modifierType: "damageTaken", value: [-15, -30], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "神品": [
      { name: "涅槃重生击", mpCost: [80, 500], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [500, 5000], scalingRatio: [2.5, 12.0], scalingStat: "strength" }], type: "主动" },
      { name: "混沌灭世击", mpCost: [100, 600], cooldown: 5, battleEffects: [{ type: "dealDamage", damageType: "physical", baseValue: [300, 4000], scalingRatio: [0.8, 5.0], scalingStat: "strength" }, { type: "applyStatus", statusType: "burn", tickValue: [100, 800], isPercent: false, duration: 3, maxStacks: 5 }, { type: "applyCc", ccType: "stun", chance: [0.40, 0.75], duration: 1 }], type: "主动" },
      { name: "不朽之躯", mpCost: 0, cooldown: 0, battleEffects: [{ type: "deathWard", duration: 99 }, { type: "counter", baseValue: [300, 4000], scalingRatio: [0.5, 4.0], scalingStat: "strength", duration: 99 }, { type: "reflect", percent: [20, 40], duration: 99 }], type: "被动" },
    ],
  },

  "法修": {
    "下品": [
      { name: "法弹术", mpCost: [10, 60], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [50, 600], scalingRatio: [1.0, 4.0], scalingStat: "perception" }], type: "主动" },
      { name: "灵甲术", mpCost: 0, cooldown: 0, battleEffects: [{ type: "shield", baseValue: [80, 1000], scalingRatio: [0.4, 2.5], scalingStat: "perception" }], type: "被动" },
    ],
    "中品": [
      { name: "灵海冲击", mpCost: [20, 120], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [80, 1000], scalingRatio: [1.2, 5.0], scalingStat: "perception" }], type: "主动" },
      { name: "灼魂术", mpCost: [25, 150], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [60, 800], scalingRatio: [0.5, 3.0], scalingStat: "perception" }, { type: "applyStatus", statusType: "burn", tickValue: [40, 400], isPercent: false, duration: 3, maxStacks: 5 }], type: "主动" },
      { name: "寒冰体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "damageTaken", value: [-15, -30], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "上品": [
      { name: "灵元爆发", mpCost: [40, 240], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [120, 1500], scalingRatio: [1.5, 6.0], scalingStat: "perception" }], type: "主动" },
      { name: "冰封禁制", mpCost: [35, 200], cooldown: 3, battleEffects: [{ type: "applyCc", ccType: "freeze", chance: [0.50, 0.80], duration: 2 }, { type: "applyModifier", modifierType: "magDamageDealt", value: [30, 55], duration: 2, maxStacks: 1, targetSelf: true }], type: "主动" },
      { name: "聚灵阵", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "magDamageDealt", value: [20, 45], duration: 99, maxStacks: 1 }], type: "被动" },
    ],
    "极品": [
      { name: "太虚法印", mpCost: [70, 400], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [200, 2200], scalingRatio: [1.8, 7.5], scalingStat: "perception" }], type: "主动" },
      { name: "雷火双诀", mpCost: [60, 360], cooldown: 3, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [150, 1800], scalingRatio: [0.4, 3.0], scalingStat: "perception" }, { type: "applyStatus", statusType: "burn", tickValue: [60, 500], isPercent: false, duration: 3, maxStacks: 5 }, { type: "applyStatus", statusType: "poison", tickValue: [5, 12], isPercent: true, duration: 3, maxStacks: 3 }], type: "主动" },
      { name: "五行护身", mpCost: 0, cooldown: 0, battleEffects: [{ type: "applyModifier", modifierType: "healReceived", value: [30, 55], duration: 99, maxStacks: 1 }, { type: "shield", baseValue: [300, 3000], scalingRatio: [0.5, 3.5], scalingStat: "perception" }], type: "被动" },
    ],
    "仙品": [
      { name: "神机法", mpCost: [100, 600], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [300, 3000], scalingRatio: [2.0, 9.0], scalingStat: "perception" }], type: "主动" },
      { name: "幽冥毒域", mpCost: [80, 480], cooldown: 4, battleEffects: [{ type: "applyStatus", statusType: "poison", tickValue: [8, 18], isPercent: true, duration: 4, maxStacks: 10 }, { type: "applyModifier", modifierType: "damageTaken", value: [25, 50], duration: 3, maxStacks: 5 }], type: "主动" },
      { name: "天机护盾", mpCost: 0, cooldown: 0, battleEffects: [{ type: "deathWard", duration: 99 }, { type: "shield", baseValue: [500, 5000], scalingRatio: [0.5, 4.0], scalingStat: "perception" }], type: "被动" },
    ],
    "神品": [
      { name: "万法之源", mpCost: [150, 800], cooldown: 0, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [500, 5000], scalingRatio: [2.5, 12.0], scalingStat: "perception" }], type: "主动" },
      { name: "混元一气", mpCost: [120, 720], cooldown: 5, battleEffects: [{ type: "dealDamage", damageType: "magical", baseValue: [400, 4500], scalingRatio: [0.6, 4.0], scalingStat: "perception" }, { type: "lifesteal", damageType: "magical", damagePercent: [50, 80] }, { type: "applyModifier", modifierType: "magDamageDealt", value: [40, 70], duration: 3, maxStacks: 3, targetSelf: true }], type: "主动" },
      { name: "太极护体", mpCost: 0, cooldown: 0, battleEffects: [{ type: "reflect", percent: [25, 45], duration: 99 }, { type: "applyModifier", modifierType: "damageTaken", value: [-30, -50], duration: 99, maxStacks: 1 }], type: "被动" },
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
