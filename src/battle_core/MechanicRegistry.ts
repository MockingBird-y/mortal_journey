import type {
  MechanicHandler,
  ActionContext,
  BattleLogEntry,
  BattleEngineLike,
  ActiveStatusEffect,
  BattleSummon,
  DamageType,
} from "./types";

import type {
  MechanicId,
} from "../role_core/types/combatMechanics";

import {
  MECHANIC_META,
  GRADE_FLAT_POWER,
  GRADE_SCALING_POWER,
  SYSTEM_DAMAGE_STAT,
  SYSTEM_POWER_MULT,
  resolveMechanicRawValue,
} from "../role_core/types/combatMechanics";

import type { ItemGrade } from "../role_core/types/itemInfo";
import type { GongfaSystem } from "../role_core/types/gongfa";
import { GRADE_INDEX } from "../role_core/types/gameConstants";
import { generateId } from "./formulas";
import * as formulas from "./formulas";
import type { PlayerBaseStats } from "../role_core/types/playInfo";

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function log(
  turn: number,
  actorName: string,
  action: string,
  type: BattleLogEntry["type"],
  narrative: string,
  team?: "ally" | "enemy",
  targetName?: string,
  value?: number,
  extra?: string,
): BattleLogEntry {
  return { turn, actorName, action, type, narrative, team, targetName, value, extra };
}

function getDamageType(actor: ActionContext["actor"]): DamageType {
  if (actor.gongfaSlots) {
    for (const gf of actor.gongfaSlots) {
      if (gf?.system) {
        const stat = SYSTEM_DAMAGE_STAT[gf.system];
        if (stat === "matk") return "magical";
      }
    }
  }
  return "physical";
}

function getGongfaDamageType(system?: GongfaSystem): DamageType {
  if (!system) return "physical";
  return SYSTEM_DAMAGE_STAT[system] === "matk" ? "magical" : "physical";
}

function calcDuration(grade: ItemGrade, base: number = 2): number {
  const idx = GRADE_INDEX[grade] ?? 0;
  return base + Math.floor(idx / 2);
}

function calcRawDamage(
  mechanic: MechanicId,
  grade: ItemGrade,
  system: GongfaSystem | undefined,
  actor: ActionContext["actor"],
  engine: BattleEngineLike,
): number {
  const meta = MECHANIC_META[mechanic];
  if (!meta) return 0;

  if (meta.noStatScaling) {
    return GRADE_SCALING_POWER[grade]?.[meta.scalingPowerKey] ?? 0;
  }

  const derivedStats = {
    patk: engine.getEffectiveStat(actor, "patk"),
    matk: engine.getEffectiveStat(actor, "matk"),
    pdef: engine.getEffectiveStat(actor, "pdef"),
    mdef: engine.getEffectiveStat(actor, "mdef"),
  };

  const primaryStat = actor.stats.cultivationSpeed;
  return resolveMechanicRawValue(mechanic, grade, primaryStat, system, derivedStats);
}

// ═══════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════

export class MechanicRegistry {
  private handlers = new Map<MechanicId, MechanicHandler>();

  constructor() {
    this.registerAll();
  }

  get(mechanic: MechanicId): MechanicHandler | undefined {
    return this.handlers.get(mechanic);
  }

  executeComponents(
    components: readonly import("../role_core/types/combatMechanics").EffectComponent[],
    ctx: ActionContext,
    engine: BattleEngineLike,
  ): BattleLogEntry[] {
    const entries: BattleLogEntry[] = [];

    for (const comp of components) {
      if (!engine.conditionEvaluator.evaluate(comp.condition, ctx)) continue;

      if (!comp.mechanic) {
        if (comp.status) {
          entries.push(...applyStatusFromComponent(comp, ctx, engine));
        }
        continue;
      }

      const handler = this.handlers.get(comp.mechanic);
      if (handler) {
        entries.push(...handler.execute(ctx, engine));
      }
    }

    return entries;
  }

  private registerAll(): void {
    const handlers: MechanicHandler[] = [
      // ── damage ──
      dmgSingleHandler,
      dmgAoeHandler,
      dmgDotHandler,
      dmgDotPctHandler,
      dmgExecuteHandler,
      dmgPierceHandler,
      // ── buff ──
      buffAtkHandler,
      buffDefHandler,
      buffCritHandler,
      buffCritDmgHandler,
      buffSpeedHandler,
      buffDodgeHandler,
      buffShieldHandler,
      buffStealthHandler,
      buffStatHandler,
      buffRampHandler,
      // ── debuff ──
      debuffDefHandler,
      debuffAtkHandler,
      debuffSpeedHandler,
      debuffHealHandler,
      debuffMpHandler,
      debuffMarkHandler,
      // ── cc ──
      ccFreezeHandler,
      ccStunHandler,
      ccFearHandler,
      ccRootHandler,
      ccSilenceHandler,
      // ── heal ──
      healSingleHandler,
      healAoeHandler,
      healLifestealHandler,
      healLifestealPctHandler,
      // ── utility ──
      summonHandler,
      cleanseHandler,
      reviveHandler,
      killBonusHandler,
      deathWardHandler,
      sacrificeHandler,
      extraActionHandler,
      reflectHandler,
      counterHandler,
      damageShareHandler,
      dispelHandler,
    ];

    for (const h of handlers) {
      this.handlers.set(h.mechanic, h);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 状态施加辅助
// ═══════════════════════════════════════════════════════════════

function applyStatusFromComponent(
  comp: import("../role_core/types/combatMechanics").EffectComponent,
  ctx: ActionContext,
  engine: BattleEngineLike,
): BattleLogEntry[] {
  if (!comp.status || !ctx.target) return [];
  const entries: BattleLogEntry[] = [];

  const dotDamageMap: Record<string, { pctMaxHp?: number; pctCurrentMp?: number }> = {
    poison: { pctMaxHp: 3 },
    burn: { pctMaxHp: 5 },
    corrode: { pctCurrentMp: 5 },
    shock: {},
    frost: {},
    thunder_seal: {},
    fire_seed: {},
    sword_intent: {},
  };

  const dotDef = dotDamageMap[comp.status] ?? {};
  const tickValue = dotDef.pctMaxHp ?? dotDef.pctCurrentMp ?? 0;
  const tickIsPercent = tickValue > 0;
  const tickStatKey = dotDef.pctMaxHp ? "maxHp" as const
    : dotDef.pctCurrentMp ? "currentMp" as const
    : undefined;

  engine.effectManager.addEffect(ctx.target, {
    id: generateId(),
    name: comp.status,
    sourceCombatantId: ctx.actor.id,
    status: comp.status,
    category: tickValue > 0 ? "dot" : "special",
    value: 0,
    isPercent: false,
    remainingTurns: 3,
    stacks: 1,
    maxStacks: 10,
    canStack: true,
    tickValue,
    tickIsPercent,
    tickStatKey,
  });

  entries.push(log(ctx.turn, ctx.actor.displayName, `施加${comp.status}`, "debuff",
    `${ctx.actor.displayName}对${ctx.target.displayName}施加了${comp.status}`,
    ctx.actor.team, ctx.target.displayName));

  return entries;
}

// ═══════════════════════════════════════════════════════════════
// DAMAGE HANDLERS
// ═══════════════════════════════════════════════════════════════

const dmgSingleHandler: MechanicHandler = {
  mechanic: "dmg_single",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    const damageType = ctx.gongfaSystem ? getGongfaDamageType(ctx.gongfaSystem) : getDamageType(ctx.actor);
    const rawDamage = calcRawDamage("dmg_single", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const isCrit = formulas.checkCrit(engine.getEffectiveStat(ctx.actor, "critRate"));

    const result = engine.damagePipeline.execute(
      { source: ctx.actor, target: ctx.target, rawDamage, damageType, isCrit },
      ctx.turn, ctx.allies, ctx.enemies,
    );

    const entries: BattleLogEntry[] = [];
    if (result.dodged) {
      entries.push(log(ctx.turn, ctx.actor.displayName, "攻击", "miss",
        `${ctx.actor.displayName}攻击${ctx.target.displayName}，但被闪避了！`,
        ctx.actor.team, ctx.target.displayName));
      return entries;
    }

    entries.push(log(ctx.turn, ctx.actor.displayName, "攻击", isCrit ? "crit" : "damage",
      `${ctx.actor.displayName}对${ctx.target.displayName}造成${result.finalDamage}点伤害${isCrit ? "（暴击！）" : ""}`,
      ctx.actor.team, ctx.target.displayName, result.finalDamage, isCrit ? "暴击！" : undefined));

    if (result.killed) {
      entries.push(log(ctx.turn, ctx.target.displayName, "阵亡", "death",
        `${ctx.target.displayName}倒下了！`, ctx.target.team));
    }
    return entries;
  },
};

const dmgAoeHandler: MechanicHandler = {
  mechanic: "dmg_aoe",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const entries: BattleLogEntry[] = [];
    const targets = ctx.enemies.filter(e => !e.isDead);
    const damageType = ctx.gongfaSystem ? getGongfaDamageType(ctx.gongfaSystem) : "magical";
    const rawDamage = calcRawDamage("dmg_aoe", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    let totalDamage = 0;

    for (const target of targets) {
      const isCrit = formulas.checkCrit(engine.getEffectiveStat(ctx.actor, "critRate"));
      const result = engine.damagePipeline.execute(
        { source: ctx.actor, target, rawDamage, damageType, isCrit },
        ctx.turn, ctx.allies, ctx.enemies,
      );
      totalDamage += result.finalDamage;

      entries.push(log(ctx.turn, ctx.actor.displayName, "群体攻击", isCrit ? "crit" : "damage",
        `${ctx.actor.displayName}对${target.displayName}造成${result.finalDamage}点伤害`,
        ctx.actor.team, target.displayName, result.finalDamage));

      if (result.killed) {
        entries.push(log(ctx.turn, target.displayName, "阵亡", "death",
          `${target.displayName}倒下了！`, target.team));
      }
    }

    return entries;
  },
};

const dmgDotHandler: MechanicHandler = {
  mechanic: "dmg_dot",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const rawDamage = calcRawDamage("dmg_dot", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);

    engine.effectManager.addEffect(ctx.target, {
      id: generateId(),
      name: "持续伤害",
      sourceCombatantId: ctx.actor.id,
      mechanic: "dmg_dot",
      category: "dot",
      value: 0,
      isPercent: false,
      remainingTurns: 3,
      stacks: 1,
      maxStacks: 1,
      canStack: false,
      tickValue: Math.round(rawDamage / 3),
      tickIsPercent: false,
      tickStatKey: "currentHp",
    });

    return [log(ctx.turn, ctx.actor.displayName, "施加持续伤害", "debuff",
      `${ctx.actor.displayName}对${ctx.target.displayName}施加持续伤害，每回合${Math.round(rawDamage / 3)}点`,
      ctx.actor.team, ctx.target.displayName)];
  },
};

const dmgDotPctHandler: MechanicHandler = {
  mechanic: "dmg_dot_pct",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const rawValue = calcRawDamage("dmg_dot_pct", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const pctPerTurn = Math.round(rawValue * 100);

    engine.effectManager.addEffect(ctx.target, {
      id: generateId(),
      name: "百分比持续伤害",
      sourceCombatantId: ctx.actor.id,
      mechanic: "dmg_dot_pct",
      category: "dot",
      value: 0,
      isPercent: false,
      remainingTurns: 3,
      stacks: 1,
      maxStacks: 10,
      canStack: true,
      tickValue: pctPerTurn,
      tickIsPercent: true,
      tickStatKey: "maxHp",
    });

    return [log(ctx.turn, ctx.actor.displayName, "施加持续伤害", "debuff",
      `${ctx.actor.displayName}对${ctx.target.displayName}施加持续伤害，每回合扣除${pctPerTurn}%最大生命`,
      ctx.actor.team, ctx.target.displayName)];
  },
};

const dmgExecuteHandler: MechanicHandler = {
  mechanic: "dmg_execute",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    const damageType = ctx.gongfaSystem ? getGongfaDamageType(ctx.gongfaSystem) : getDamageType(ctx.actor);
    let rawDamage = calcRawDamage("dmg_execute", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);

    const hpRatio = ctx.target.currentHp / ctx.target.maxHp;
    if (hpRatio < 0.5) {
      rawDamage = Math.round(rawDamage * 1.5);
    }

    const isCrit = formulas.checkCrit(engine.getEffectiveStat(ctx.actor, "critRate"));
    const result = engine.damagePipeline.execute(
      { source: ctx.actor, target: ctx.target, rawDamage, damageType, isCrit },
      ctx.turn, ctx.allies, ctx.enemies,
    );

    const entries: BattleLogEntry[] = [];
    entries.push(log(ctx.turn, ctx.actor.displayName, "斩杀攻击", isCrit ? "crit" : "damage",
      `${ctx.actor.displayName}对${ctx.target.displayName}发动斩杀，造成${result.finalDamage}点伤害${hpRatio < 0.5 ? "（目标低血量，伤害提升！）" : ""}`,
      ctx.actor.team, ctx.target.displayName, result.finalDamage));

    if (result.killed) {
      entries.push(log(ctx.turn, ctx.target.displayName, "阵亡", "death",
        `${ctx.target.displayName}倒下了！`, ctx.target.team));
    }
    return entries;
  },
};

const dmgPierceHandler: MechanicHandler = {
  mechanic: "dmg_pierce",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    const rawDamage = calcRawDamage("dmg_pierce", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const isCrit = formulas.checkCrit(engine.getEffectiveStat(ctx.actor, "critRate"));

    const result = engine.damagePipeline.execute(
      { source: ctx.actor, target: ctx.target, rawDamage, damageType: "true", isCrit },
      ctx.turn, ctx.allies, ctx.enemies,
    );

    const entries: BattleLogEntry[] = [];
    entries.push(log(ctx.turn, ctx.actor.displayName, "穿透攻击", isCrit ? "crit" : "damage",
      `${ctx.actor.displayName}对${ctx.target.displayName}造成${result.finalDamage}点穿透伤害`,
      ctx.actor.team, ctx.target.displayName, result.finalDamage));

    if (result.killed) {
      entries.push(log(ctx.turn, ctx.target.displayName, "阵亡", "death",
        `${ctx.target.displayName}倒下了！`, ctx.target.team));
    }
    return entries;
  },
};

// ═══════════════════════════════════════════════════════════════
// BUFF HANDLERS
// ═══════════════════════════════════════════════════════════════

function makeBuffHandler(
  mechanic: MechanicId,
  statKey: string,
  label: string,
): MechanicHandler {
  return {
    mechanic,
    execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
      const rawValue = calcRawDamage(mechanic, ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
      const pctValue = Math.round(rawValue * 100);
      const duration = calcDuration(ctx.gongfaGrade ?? "下品");
      const target = ctx.target ?? ctx.actor;

      engine.effectManager.addEffect(target, {
        id: generateId(),
        name: label,
        sourceCombatantId: ctx.actor.id,
        mechanic,
        category: "buff",
        statKey,
        value: pctValue,
        isPercent: true,
        remainingTurns: duration,
        stacks: 1,
        maxStacks: 1,
        canStack: false,
      });

      return [log(ctx.turn, ctx.actor.displayName, label, "buff",
        `${ctx.actor.displayName}为${target.displayName}施加${label}${pctValue}%`,
        ctx.actor.team, target.displayName)];
    },
  };
}

const buffAtkHandler = makeBuffHandler("buff_atk", "patk", "攻击增益");
const buffDefHandler = makeBuffHandler("buff_def", "pdef", "防御增益");
const buffCritHandler = makeBuffHandler("buff_crit", "critRate", "暴击增益");
const buffCritDmgHandler = makeBuffHandler("buff_crit_dmg", "critDmg", "暴击伤害增益");
const buffSpeedHandler = makeBuffHandler("buff_speed", "speed", "速度增益");
const buffDodgeHandler = makeBuffHandler("buff_dodge", "dodgeRate", "闪避增益");

const buffShieldHandler: MechanicHandler = {
  mechanic: "buff_shield",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("buff_shield", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const shieldAmt = Math.round(rawValue);
    const target = ctx.target ?? ctx.actor;
    target.shield += shieldAmt;

    return [log(ctx.turn, ctx.actor.displayName, "护盾", "shield",
      `${ctx.actor.displayName}为${target.displayName}增加${shieldAmt}点护盾`,
      ctx.actor.team, target.displayName, shieldAmt)];
  },
};

const buffStealthHandler: MechanicHandler = {
  mechanic: "buff_stealth",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("buff_stealth", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const duration = calcDuration(ctx.gongfaGrade ?? "下品", 1);

    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(),
      name: "隐匿",
      sourceCombatantId: ctx.actor.id,
      mechanic: "buff_stealth",
      category: "buff",
      value: Math.round(rawValue * 100),
      isPercent: true,
      remainingTurns: duration,
      stacks: 1,
      maxStacks: 1,
      canStack: false,
    });

    return [log(ctx.turn, ctx.actor.displayName, "隐匿", "buff",
      `${ctx.actor.displayName}进入隐匿状态`, ctx.actor.team)];
  },
};

const buffStatHandler: MechanicHandler = {
  mechanic: "buff_stat",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("buff_stat", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const pctValue = Math.round(rawValue * 100);
    const duration = calcDuration(ctx.gongfaGrade ?? "下品");
    const target = ctx.target ?? ctx.actor;

    engine.effectManager.addEffect(target, {
      id: generateId(),
      name: "属性增益",
      sourceCombatantId: ctx.actor.id,
      mechanic: "buff_stat",
      category: "buff",
      statKey: "patk",
      value: pctValue,
      isPercent: true,
      remainingTurns: duration,
      stacks: 1,
      maxStacks: 1,
      canStack: false,
    });

    return [log(ctx.turn, ctx.actor.displayName, "属性增益", "buff",
      `${ctx.actor.displayName}获得${pctValue}%属性增益`, ctx.actor.team)];
  },
};

const buffRampHandler: MechanicHandler = {
  mechanic: "buff_ramp",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("buff_ramp", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const pctValue = Math.round(rawValue * 100);
    const duration = calcDuration(ctx.gongfaGrade ?? "下品", 3);

    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(),
      name: "叠加增益",
      sourceCombatantId: ctx.actor.id,
      mechanic: "buff_ramp",
      category: "buff",
      statKey: "patk",
      value: pctValue,
      isPercent: true,
      remainingTurns: duration,
      stacks: 1,
      maxStacks: 10,
      canStack: true,
    });

    return [log(ctx.turn, ctx.actor.displayName, "叠加增益", "buff",
      `${ctx.actor.displayName}获得叠加增益，当前1层${pctValue}%`, ctx.actor.team)];
  },
};

// ═══════════════════════════════════════════════════════════════
// DEBUFF HANDLERS
// ═══════════════════════════════════════════════════════════════

function makeDebuffHandler(
  mechanic: MechanicId,
  statKey: string,
  label: string,
): MechanicHandler {
  return {
    mechanic,
    execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
      if (!ctx.target) return [];
      const rawValue = calcRawDamage(mechanic, ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
      const pctValue = Math.round(rawValue * 100);
      const duration = calcDuration(ctx.gongfaGrade ?? "下品");

      engine.effectManager.addEffect(ctx.target, {
        id: generateId(),
        name: label,
        sourceCombatantId: ctx.actor.id,
        mechanic,
        category: "debuff",
        statKey,
        value: -pctValue,
        isPercent: true,
        remainingTurns: duration,
        stacks: 1,
        maxStacks: 1,
        canStack: false,
      });

      return [log(ctx.turn, ctx.actor.displayName, label, "debuff",
        `${ctx.actor.displayName}对${ctx.target.displayName}施加${label}${pctValue}%`,
        ctx.actor.team, ctx.target.displayName)];
    },
  };
}

const debuffDefHandler = makeDebuffHandler("debuff_def", "pdef", "降低防御");
const debuffAtkHandler = makeDebuffHandler("debuff_atk", "patk", "降低攻击");
const debuffSpeedHandler = makeDebuffHandler("debuff_speed", "speed", "降低速度");
const debuffHealHandler = makeDebuffHandler("debuff_heal", "hpRecovery", "降低恢复");
const debuffMpHandler = makeDebuffHandler("debuff_mp", "mpRecovery", "削减法力");

const debuffMarkHandler: MechanicHandler = {
  mechanic: "debuff_mark",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const rawValue = calcRawDamage("debuff_mark", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const pctValue = Math.round(rawValue * 100);
    const duration = calcDuration(ctx.gongfaGrade ?? "下品", 3);

    engine.effectManager.addEffect(ctx.target, {
      id: generateId(),
      name: "标记",
      sourceCombatantId: ctx.actor.id,
      mechanic: "debuff_mark",
      category: "debuff",
      value: pctValue,
      isPercent: true,
      remainingTurns: duration,
      stacks: 1,
      maxStacks: 1,
      canStack: false,
    });

    return [log(ctx.turn, ctx.actor.displayName, "标记", "debuff",
      `${ctx.actor.displayName}标记了${ctx.target.displayName}，受到伤害提高${pctValue}%`,
      ctx.actor.team, ctx.target.displayName)];
  },
};

// ═══════════════════════════════════════════════════════════════
// CC HANDLERS
// ═══════════════════════════════════════════════════════════════

function makeCcHandler(
  mechanic: MechanicId,
  label: string,
): MechanicHandler {
  return {
    mechanic,
    execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
      if (!ctx.target) return [];
      const rawValue = calcRawDamage(mechanic, ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
      const chance = rawValue;
      const hit = Math.random() < chance;

      if (hit) {
        const duration = 1 + Math.floor((GRADE_INDEX[ctx.gongfaGrade ?? "下品"] ?? 0) / 3);
        engine.effectManager.addEffect(ctx.target, {
          id: generateId(),
          name: label,
          sourceCombatantId: ctx.actor.id,
          mechanic,
          category: "cc",
          value: chance,
          isPercent: true,
          remainingTurns: duration,
          stacks: 1,
          maxStacks: 1,
          canStack: false,
        });

        return [log(ctx.turn, ctx.actor.displayName, label, "cc",
          `${ctx.actor.displayName}对${ctx.target.displayName}施加${label}`,
          ctx.actor.team, ctx.target.displayName)];
      }

      return [log(ctx.turn, ctx.actor.displayName, label, "info",
        `${ctx.actor.displayName}试图对${ctx.target.displayName}施加${label}，但被抵抗了`,
        ctx.actor.team, ctx.target.displayName)];
    },
  };
}

const ccFreezeHandler = makeCcHandler("cc_freeze", "冻结");
const ccStunHandler = makeCcHandler("cc_stun", "眩晕");
const ccFearHandler = makeCcHandler("cc_fear", "恐惧");
const ccRootHandler = makeCcHandler("cc_root", "禁锢");
const ccSilenceHandler = makeCcHandler("cc_silence", "沉默");

// ═══════════════════════════════════════════════════════════════
// HEAL HANDLERS
// ═══════════════════════════════════════════════════════════════

const healSingleHandler: MechanicHandler = {
  mechanic: "heal_single",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("heal_single", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const target = ctx.target ?? ctx.actor;
    const healed = engine.applyHeal(target, Math.round(rawValue));

    return [log(ctx.turn, ctx.actor.displayName, "治疗", "heal",
      `${ctx.actor.displayName}为${target.displayName}恢复${healed}点生命`,
      ctx.actor.team, target.displayName, healed)];
  },
};

const healAoeHandler: MechanicHandler = {
  mechanic: "heal_aoe",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const entries: BattleLogEntry[] = [];
    const rawValue = calcRawDamage("heal_aoe", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const targets = ctx.allies.filter(a => !a.isDead);
    let totalHealed = 0;

    for (const t of targets) {
      const healed = engine.applyHeal(t, Math.round(rawValue));
      totalHealed += healed;
      entries.push(log(ctx.turn, ctx.actor.displayName, "群体治疗", "heal",
        `${ctx.actor.displayName}为${t.displayName}恢复${healed}点生命`,
        ctx.actor.team, t.displayName, healed));
    }

    return entries;
  },
};

const healLifestealHandler: MechanicHandler = {
  mechanic: "heal_lifesteal",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    const entries: BattleLogEntry[] = [];
    const rawValue = calcRawDamage("heal_lifesteal", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const damageType = ctx.gongfaSystem ? getGongfaDamageType(ctx.gongfaSystem) : getDamageType(ctx.actor);
    const dmgToTarget = Math.max(1, Math.round(rawValue * 0.5));

    const result = engine.damagePipeline.execute(
      { source: ctx.actor, target: ctx.target, rawDamage: dmgToTarget, damageType, isCrit: false },
      ctx.turn, ctx.allies, ctx.enemies,
    );

    entries.push(log(ctx.turn, ctx.actor.displayName, "生命偷取", "damage",
      `${ctx.actor.displayName}吸取${ctx.target.displayName}${result.finalDamage}点生命`,
      ctx.actor.team, ctx.target.displayName, result.finalDamage));

    const healed = engine.applyHeal(ctx.actor, result.finalDamage);
    if (healed > 0) {
      entries.push(log(ctx.turn, ctx.actor.displayName, "吸血恢复", "heal",
        `${ctx.actor.displayName}恢复${healed}点生命`, ctx.actor.team, ctx.actor.displayName, healed));
    }

    if (result.killed) {
      entries.push(log(ctx.turn, ctx.target.displayName, "阵亡", "death",
        `${ctx.target.displayName}倒下了！`, ctx.target.team));
    }

    return entries;
  },
};

const healLifestealPctHandler: MechanicHandler = {
  mechanic: "heal_lifesteal_pct",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    const entries: BattleLogEntry[] = [];
    const rawValue = calcRawDamage("heal_lifesteal_pct", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const damageType = ctx.gongfaSystem ? getGongfaDamageType(ctx.gongfaSystem) : getDamageType(ctx.actor);
    const dmgToTarget = Math.max(1, Math.round(rawValue * 0.3));

    const result = engine.damagePipeline.execute(
      { source: ctx.actor, target: ctx.target, rawDamage: dmgToTarget, damageType, isCrit: false },
      ctx.turn, ctx.allies, ctx.enemies,
    );

    entries.push(log(ctx.turn, ctx.actor.displayName, "百分比吸血", "damage",
      `${ctx.actor.displayName}吸取${ctx.target.displayName}${result.finalDamage}点生命`,
      ctx.actor.team, ctx.target.displayName, result.finalDamage));

    const healed = engine.applyHeal(ctx.actor, result.finalDamage);
    if (healed > 0) {
      entries.push(log(ctx.turn, ctx.actor.displayName, "吸血恢复", "heal",
        `${ctx.actor.displayName}恢复${healed}点生命`, ctx.actor.team, ctx.actor.displayName, healed));
    }

    if (result.killed) {
      entries.push(log(ctx.turn, ctx.target.displayName, "阵亡", "death",
        `${ctx.target.displayName}倒下了！`, ctx.target.team));
    }

    return entries;
  },
};

// ═══════════════════════════════════════════════════════════════
// UTILITY HANDLERS
// ═══════════════════════════════════════════════════════════════

const summonHandler: MechanicHandler = {
  mechanic: "summon",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("summon", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);

    const summon: BattleSummon = {
      id: generateId(),
      name: `${ctx.actor.displayName}的召唤物`,
      ownerCombatantId: ctx.actor.id,
      damagePerTurn: Math.round(rawValue),
      remainingTurns: 3,
      targetStrategy: "random",
    };

    ctx.actor.summons.push(summon);

    return [log(ctx.turn, ctx.actor.displayName, "召唤", "summon",
      `${ctx.actor.displayName}召唤灵体，每回合造成${Math.round(rawValue)}点伤害`,
      ctx.actor.team)];
  },
};

const cleanseHandler: MechanicHandler = {
  mechanic: "cleanse",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const target = ctx.target ?? ctx.actor;
    const removed = engine.effectManager.removeEffects(target,
      e => e.category === "cc" || e.category === "debuff");

    if (removed > 0) {
      return [log(ctx.turn, ctx.actor.displayName, "净化", "buff",
        `${ctx.actor.displayName}净化了${target.displayName}的${removed}个负面效果`,
        ctx.actor.team, target.displayName)];
    }
    return [log(ctx.turn, ctx.actor.displayName, "净化", "info",
      `${ctx.actor.displayName}尝试净化，但没有可移除的效果`, ctx.actor.team)];
  },
};

const reviveHandler: MechanicHandler = {
  mechanic: "revive",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const target = ctx.target ?? ctx.actor;
    if (!target.isDead) {
      return [log(ctx.turn, ctx.actor.displayName, "复活", "info",
        `${target.displayName}未阵亡，无需复活`, ctx.actor.team)];
    }

    const rawValue = calcRawDamage("revive", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    target.isDead = false;
    target.currentHp = Math.min(target.maxHp, Math.round(rawValue));

    return [log(ctx.turn, ctx.actor.displayName, "复活", "heal",
      `${target.displayName}被复活，恢复${target.currentHp}点生命`,
      ctx.actor.team, target.displayName, target.currentHp)];
  },
};

const killBonusHandler: MechanicHandler = {
  mechanic: "kill_bonus",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("kill_bonus", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const pctValue = Math.round(rawValue * 100);

    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(),
      name: "击杀增益",
      sourceCombatantId: ctx.actor.id,
      mechanic: "kill_bonus",
      category: "buff",
      value: pctValue,
      isPercent: true,
      remainingTurns: 99,
      stacks: 1,
      maxStacks: 99,
      canStack: true,
    });

    return [log(ctx.turn, ctx.actor.displayName, "击杀增益", "buff",
      `${ctx.actor.displayName}获得击杀增益效果`, ctx.actor.team)];
  },
};

const deathWardHandler: MechanicHandler = {
  mechanic: "death_ward",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("death_ward", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);

    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(),
      name: "免死",
      sourceCombatantId: ctx.actor.id,
      mechanic: "death_ward",
      category: "buff",
      value: rawValue,
      isPercent: true,
      remainingTurns: 99,
      stacks: 1,
      maxStacks: 1,
      canStack: false,
    });

    return [log(ctx.turn, ctx.actor.displayName, "免死护盾", "buff",
      `${ctx.actor.displayName}获得免死护盾`, ctx.actor.team)];
  },
};

const sacrificeHandler: MechanicHandler = {
  mechanic: "sacrifice",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("sacrifice", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const hpCost = Math.round(ctx.actor.currentHp * rawValue);
    ctx.actor.currentHp = Math.max(1, ctx.actor.currentHp - hpCost);

    return [log(ctx.turn, ctx.actor.displayName, "献祭", "info",
      `${ctx.actor.displayName}消耗${hpCost}点生命`, ctx.actor.team, ctx.actor.displayName, hpCost)];
  },
};

const extraActionHandler: MechanicHandler = {
  mechanic: "extra_action",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("extra_action", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);

    if (Math.random() < rawValue) {
      return [log(ctx.turn, ctx.actor.displayName, "额外行动", "buff",
        `${ctx.actor.displayName}获得额外行动！`, ctx.actor.team)];
    }

    return [log(ctx.turn, ctx.actor.displayName, "额外行动", "info",
      `${ctx.actor.displayName}未能触发额外行动`, ctx.actor.team)];
  },
};

const reflectHandler: MechanicHandler = {
  mechanic: "reflect",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("reflect", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const pctValue = Math.round(rawValue * 100);

    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(),
      name: "反弹",
      sourceCombatantId: ctx.actor.id,
      mechanic: "reflect",
      category: "buff",
      value: pctValue,
      isPercent: true,
      remainingTurns: 3,
      stacks: 1,
      maxStacks: 1,
      canStack: false,
    });

    return [log(ctx.turn, ctx.actor.displayName, "反弹", "buff",
      `${ctx.actor.displayName}开启伤害反弹${pctValue}%`, ctx.actor.team)];
  },
};

const counterHandler: MechanicHandler = {
  mechanic: "counter",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("counter", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);

    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(),
      name: "反击",
      sourceCombatantId: ctx.actor.id,
      mechanic: "counter",
      category: "buff",
      value: Math.round(rawValue),
      isPercent: false,
      remainingTurns: 2,
      stacks: 1,
      maxStacks: 1,
      canStack: false,
    });

    return [log(ctx.turn, ctx.actor.displayName, "反击", "buff",
      `${ctx.actor.displayName}进入反击姿态`, ctx.actor.team)];
  },
};

const damageShareHandler: MechanicHandler = {
  mechanic: "damage_share",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcRawDamage("damage_share", ctx.gongfaGrade ?? "下品", ctx.gongfaSystem, ctx.actor, engine);
    const pctValue = Math.round(rawValue * 100);

    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(),
      name: "伤害分摊",
      sourceCombatantId: ctx.actor.id,
      mechanic: "damage_share",
      category: "buff",
      value: pctValue,
      isPercent: true,
      remainingTurns: 3,
      stacks: 1,
      maxStacks: 1,
      canStack: false,
    });

    return [log(ctx.turn, ctx.actor.displayName, "伤害分摊", "buff",
      `${ctx.actor.displayName}开启伤害分摊${pctValue}%`, ctx.actor.team)];
  },
};

const dispelHandler: MechanicHandler = {
  mechanic: "dispel",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const removed = engine.effectManager.removeEffects(ctx.target,
      e => e.category === "buff");

    if (removed > 0) {
      return [log(ctx.turn, ctx.actor.displayName, "驱散", "debuff",
        `${ctx.actor.displayName}驱散了${ctx.target.displayName}的${removed}个增益效果`,
        ctx.actor.team, ctx.target.displayName)];
    }
    return [log(ctx.turn, ctx.actor.displayName, "驱散", "info",
      `${ctx.actor.displayName}尝试驱散，但没有可移除的效果`, ctx.actor.team)];
  },
};
