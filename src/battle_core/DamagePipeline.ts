import type {
  DamageContext,
  DamageResult,
  BattleCombatant,
  BattleLogEntry,
} from "./types";
import type { EffectManager } from "./EffectManager";
import type { EventDispatcher } from "./EventDispatcher";
import * as formulas from "./formulas";
import type { PlayerBaseStats } from "../role_core/types/playInfo";

export class DamagePipeline {
  constructor(
    private effectManager: EffectManager,
    private dispatcher: EventDispatcher,
  ) {}

  execute(ctx: DamageContext, turn: number, allies: BattleCombatant[], enemies: BattleCombatant[]): DamageResult {
    const emptyResult: DamageResult = {
      finalDamage: 0,
      shieldAbsorbed: 0,
      hpLost: 0,
      killed: false,
      dodged: false,
      effectiveDefense: 0,
      reductionPercent: 0,
    };

    this.dispatcher.emit("pre_damage", {
      event: "pre_damage",
      source: ctx.source,
      target: ctx.target,
      turn,
      allies,
      enemies,
    });

    const hitRate = this.effectManager.getEffectiveStat(ctx.source, "hitRate");
    const dodgeRate = this.effectManager.getEffectiveStat(ctx.target, "dodgeRate");
    const dodged = !formulas.checkHit(hitRate, dodgeRate);

    if (dodged) {
      this.dispatcher.emit("dodge", {
        event: "dodge",
        source: ctx.source,
        target: ctx.target,
        turn,
        allies,
        enemies,
      });
      return { ...emptyResult, dodged: true };
    }

    let rawDamage = ctx.rawDamage;
    if (ctx.isCrit) {
      const critDmg = this.effectManager.getEffectiveStat(ctx.source, "critDmg");
      rawDamage = formulas.calcCritDamage(rawDamage, critDmg);
    }

    const defKey: keyof PlayerBaseStats = ctx.damageType === "physical" ? "pdef" : "mdef";
    const penKey: keyof PlayerBaseStats = ctx.damageType === "physical" ? "penetration" : "magicPenetration";
    const defense = this.effectManager.getEffectiveStat(ctx.target, defKey);
    const penRating = this.effectManager.getEffectiveStat(ctx.source, penKey);

    const effDef = formulas.calcEffectiveDefense(defense, penRating);
    const reduction = formulas.defenseToReduction(effDef);

    const finalDamage = formulas.calcFinalDamage(rawDamage, defense, penRating, ctx.damageType);

    let remaining = finalDamage;
    let shieldAbsorbed = 0;
    if (ctx.target.shield > 0) {
      const absorbed = Math.min(ctx.target.shield, remaining);
      ctx.target.shield -= absorbed;
      remaining -= absorbed;
      shieldAbsorbed = absorbed;
    }

    const hpLost = Math.min(ctx.target.currentHp, remaining);
    ctx.target.currentHp -= hpLost;

    let killed = false;
    if (ctx.target.currentHp <= 0) {
      ctx.target.currentHp = 0;

      this.dispatcher.emit("fatal", {
        event: "fatal",
        source: ctx.source,
        target: ctx.target,
        turn,
        allies,
        enemies,
      });

      if (ctx.target.currentHp <= 0) {
        killed = true;
        ctx.target.isDead = true;
      }
    }

    const result: DamageResult = {
      finalDamage,
      shieldAbsorbed,
      hpLost,
      killed,
      dodged: false,
      effectiveDefense: effDef,
      reductionPercent: reduction,
    };

    this.dispatcher.emit("damage_dealt", {
      event: "damage_dealt",
      source: ctx.source,
      target: ctx.target,
      damage: result,
      turn,
      allies,
      enemies,
    });

    this.dispatcher.emit("damage_taken", {
      event: "damage_taken",
      source: ctx.target,
      target: ctx.target,
      damage: result,
      turn,
      allies,
      enemies,
    });

    if (ctx.isCrit) {
      this.dispatcher.emit("crit", {
        event: "crit",
        source: ctx.source,
        target: ctx.target,
        damage: result,
        turn,
        allies,
        enemies,
      });
    }

    if (killed) {
      this.dispatcher.emit("kill", {
        event: "kill",
        source: ctx.source,
        target: ctx.target,
        turn,
        allies,
        enemies,
      });
      this.dispatcher.emit("death", {
        event: "death",
        target: ctx.target,
        turn,
        allies,
        enemies,
      });
    }

    return result;
  }
}
