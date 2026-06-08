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
  SYSTEM_DAMAGE_STAT,
  calcComponentValue,
} from "../role_core/types/combatMechanics";
import type {
  EffectComponent,
  ScalingStatKey,
} from "../role_core/types/combatMechanics";

import type { ItemGrade } from "../role_core/types/itemInfo";
import type { GongfaSystem } from "../role_core/types/gongfa";
import { GRADE_INDEX } from "../role_core/types/gameConstants";
import { generateId } from "./formulas";
import type { BattleStatKey } from "./types";
import * as formulas from "./formulas";

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
        if (stat === "perception") return "magical";
      }
    }
  }
  return "physical";
}

function getGongfaDamageType(system?: GongfaSystem): DamageType {
  if (!system) return "physical";
  return SYSTEM_DAMAGE_STAT[system] === "perception" ? "magical" : "physical";
}

function calcDuration(grade: ItemGrade, base: number = 2): number {
  const idx = GRADE_INDEX[grade] ?? 0;
  return base + Math.floor(idx / 2);
}

function calcValue(ctx: ActionContext, engine: BattleEngineLike): number {
  const comp = ctx.currentComponent;
  if (!comp) return 0;
  return calcComponentValue(
    comp,
    stat => engine.getEffectiveStat(ctx.actor, stat as BattleStatKey),
    ctx.gongfaMastery,
  );
}

function getDuration(ctx: ActionContext, base: number = 2): number {
  const comp = ctx.currentComponent;
  return comp?.duration ?? calcDuration(ctx.gongfaGrade ?? "下品", base);
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

      ctx.currentComponent = comp;

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
    const rawDamage = calcValue(ctx, engine);
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
    engine.addSecondaryDamageLogs(result, ctx.actor, ctx.target, ctx.turn);
    return entries;
  },
};

const dmgAoeHandler: MechanicHandler = {
  mechanic: "dmg_aoe",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const entries: BattleLogEntry[] = [];
    const targets = ctx.enemies.filter(e => !e.isDead);
    const damageType = ctx.gongfaSystem ? getGongfaDamageType(ctx.gongfaSystem) : "magical";
    const rawDamage = calcValue(ctx, engine);
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
      engine.addSecondaryDamageLogs(result, ctx.actor, target, ctx.turn);
    }

    return entries;
  },
};

const dmgDotHandler: MechanicHandler = {
  mechanic: "dmg_dot",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const rawDamage = calcValue(ctx, engine);

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
    const rawValue = calcValue(ctx, engine);
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
    let rawDamage = calcValue(ctx, engine);

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
    engine.addSecondaryDamageLogs(result, ctx.actor, ctx.target, ctx.turn);
    return entries;
  },
};

const dmgPierceHandler: MechanicHandler = {
  mechanic: "dmg_pierce",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    const rawDamage = calcValue(ctx, engine);
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
    engine.addSecondaryDamageLogs(result, ctx.actor, ctx.target, ctx.turn);
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
      const rawValue = calcValue(ctx, engine);
      const pctValue = Math.round(rawValue * 100);
      const duration = getDuration(ctx);
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

const buffAtkHandler = makeBuffHandler("buff_atk", "strength", "攻击增益");
const buffDefHandler = makeBuffHandler("buff_def", "guard", "防御增益");
const buffCritHandler = makeBuffHandler("buff_crit", "critRate", "暴击增益");
const buffCritDmgHandler = makeBuffHandler("buff_crit_dmg", "critDmg", "暴击伤害增益");
const buffSpeedHandler = makeBuffHandler("buff_speed", "speed", "速度增益");
const buffDodgeHandler = makeBuffHandler("buff_dodge", "agility", "闪避增益");

const buffShieldHandler: MechanicHandler = {
  mechanic: "buff_shield",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcValue(ctx, engine);
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
    const rawValue = calcValue(ctx, engine);
    const duration = getDuration(ctx, 1);

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
    const rawValue = calcValue(ctx, engine);
    const pctValue = Math.round(rawValue * 100);
    const duration = getDuration(ctx);
    const target = ctx.target ?? ctx.actor;

    engine.effectManager.addEffect(target, {
      id: generateId(),
      name: "属性增益",
      sourceCombatantId: ctx.actor.id,
      mechanic: "buff_stat",
      category: "buff",
      statKey: "strength",
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
    const rawValue = calcValue(ctx, engine);
    const pctValue = Math.round(rawValue * 100);
    const duration = getDuration(ctx, 3);

    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(),
      name: "叠加增益",
      sourceCombatantId: ctx.actor.id,
      mechanic: "buff_ramp",
      category: "buff",
      statKey: "strength",
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
      const rawValue = calcValue(ctx, engine);
      const pctValue = Math.round(rawValue * 100);
      const duration = getDuration(ctx);

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

const debuffDefHandler = makeDebuffHandler("debuff_def", "guard", "降低防御");
const debuffAtkHandler = makeDebuffHandler("debuff_atk", "strength", "降低攻击");
const debuffSpeedHandler = makeDebuffHandler("debuff_speed", "speed", "降低速度");
const debuffHealHandler: MechanicHandler = {
  mechanic: "debuff_heal",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const rawValue = calcValue(ctx, engine);
    const tickPct = Math.round(rawValue * 100);
    const duration = getDuration(ctx);

    engine.effectManager.addEffect(ctx.target, {
      id: generateId(),
      name: "禁疗",
      sourceCombatantId: ctx.actor.id,
      mechanic: "debuff_heal",
      category: "debuff",
      value: tickPct,
      isPercent: true,
      remainingTurns: duration,
      stacks: 1,
      maxStacks: 1,
      canStack: false,
      tickValue: rawValue,
      tickIsPercent: true,
      tickStatKey: "currentHp",
    });

    return [log(ctx.turn, ctx.actor.displayName, "禁疗", "debuff",
      `${ctx.actor.displayName}对${ctx.target.displayName}施加禁疗，每回合损失${tickPct}%生命`,
      ctx.actor.team, ctx.target.displayName)];
  },
};

const debuffMpHandler: MechanicHandler = {
  mechanic: "debuff_mp",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const rawValue = calcValue(ctx, engine);
    const tickPct = Math.round(rawValue * 100);
    const duration = getDuration(ctx);

    engine.effectManager.addEffect(ctx.target, {
      id: generateId(),
      name: "蚀魔",
      sourceCombatantId: ctx.actor.id,
      mechanic: "debuff_mp",
      category: "debuff",
      value: tickPct,
      isPercent: true,
      remainingTurns: duration,
      stacks: 1,
      maxStacks: 1,
      canStack: false,
      tickValue: rawValue,
      tickIsPercent: true,
      tickStatKey: "currentMp",
    });

    return [log(ctx.turn, ctx.actor.displayName, "蚀魔", "debuff",
      `${ctx.actor.displayName}对${ctx.target.displayName}施加蚀魔，每回合损失${tickPct}%法力`,
      ctx.actor.team, ctx.target.displayName)];
  },
};

const debuffMarkHandler: MechanicHandler = {
  mechanic: "debuff_mark",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const rawValue = calcValue(ctx, engine);
    const pctValue = Math.round(rawValue * 100);
    const duration = getDuration(ctx, 3);

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
      const rawValue = calcValue(ctx, engine);
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
    const rawValue = calcValue(ctx, engine);
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
    const rawValue = calcValue(ctx, engine);
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
    const rawValue = calcValue(ctx, engine);
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
    engine.addSecondaryDamageLogs(result, ctx.actor, ctx.target, ctx.turn);

    return entries;
  },
};

const healLifestealPctHandler: MechanicHandler = {
  mechanic: "heal_lifesteal_pct",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    const entries: BattleLogEntry[] = [];
    const rawValue = calcValue(ctx, engine);
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
    engine.addSecondaryDamageLogs(result, ctx.actor, ctx.target, ctx.turn);

    return entries;
  },
};

// ═══════════════════════════════════════════════════════════════
// UTILITY HANDLERS
// ═══════════════════════════════════════════════════════════════

const summonHandler: MechanicHandler = {
  mechanic: "summon",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcValue(ctx, engine);

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

    const rawValue = calcValue(ctx, engine);
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
    const rawValue = calcValue(ctx, engine);
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
    const rawValue = calcValue(ctx, engine);

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
    const rawValue = calcValue(ctx, engine);
    const hpCost = Math.round(ctx.actor.currentHp * rawValue);
    ctx.actor.currentHp = Math.max(1, ctx.actor.currentHp - hpCost);

    return [log(ctx.turn, ctx.actor.displayName, "献祭", "info",
      `${ctx.actor.displayName}消耗${hpCost}点生命`, ctx.actor.team, ctx.actor.displayName, hpCost)];
  },
};

const extraActionHandler: MechanicHandler = {
  mechanic: "extra_action",
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const rawValue = calcValue(ctx, engine);

    if (Math.random() < rawValue) {
      engine.effectManager.addEffect(ctx.actor, {
        id: generateId(),
        name: "额外行动",
        sourceCombatantId: ctx.actor.id,
        mechanic: "extra_action",
        category: "special",
        value: 0,
        isPercent: false,
        remainingTurns: 1,
        stacks: 1,
        maxStacks: 1,
        canStack: false,
      });

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
    const rawValue = calcValue(ctx, engine);
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
    const rawValue = calcValue(ctx, engine);

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
    const rawValue = calcValue(ctx, engine);
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
