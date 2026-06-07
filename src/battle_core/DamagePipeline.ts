import type {
  DamageContext,
  DamageResult,
  BattleCombatant,
} from "./types";
import type { EffectManager } from "./EffectManager";
import type { EventDispatcher } from "./EventDispatcher";
import * as formulas from "./formulas";
import type { PlayerBaseStats } from "../role_core/types/playInfo";

const EMPTY_RESULT: DamageResult = {
  finalDamage: 0,
  shieldAbsorbed: 0,
  hpLost: 0,
  killed: false,
  dodged: false,
  effectiveDefense: 0,
  reductionPercent: 0,
  markBonus: 0,
  deathWardTriggered: false,
  reflectHpLost: 0,
  reflectKilled: false,
  counterHpLost: 0,
  counterKilled: false,
  sharedDamages: [],
};

export class DamagePipeline {
  constructor(
    private effectManager: EffectManager,
    private dispatcher: EventDispatcher,
  ) {}

  execute(ctx: DamageContext, turn: number, allies: BattleCombatant[], enemies: BattleCombatant[]): DamageResult {
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
      return { ...EMPTY_RESULT, dodged: true };
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

    let finalDamage = formulas.calcFinalDamage(rawDamage, defense, penRating, ctx.damageType);

    const markBonus = this.effectManager.getMarkAmplification(ctx.target);
    if (markBonus > 0) {
      finalDamage = Math.max(1, Math.round(finalDamage * (1 + markBonus / 100)));
    }

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
    let deathWardTriggered = false;
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

      if (this.effectManager.consumeEffect(ctx.target, "death_ward")) {
        ctx.target.currentHp = 1;
        deathWardTriggered = true;
      } else {
        killed = true;
        ctx.target.isDead = true;
      }
    }

    let reflectHpLost = 0;
    let reflectKilled = false;
    let counterHpLost = 0;
    let counterKilled = false;
    const sharedDamages: DamageResult["sharedDamages"] = [];

    if (!ctx.isReflected) {
      const reflectEffects = ctx.target.activeEffects.filter(e => e.mechanic === "reflect");
      for (const refl of reflectEffects) {
        const reflDmg = Math.max(1, Math.round(finalDamage * refl.value / 100));
        const sourceHpLost = Math.min(ctx.source.currentHp, reflDmg);
        ctx.source.currentHp -= sourceHpLost;
        reflectHpLost += sourceHpLost;
        if (ctx.source.currentHp <= 0) {
          ctx.source.currentHp = 0;
          ctx.source.isDead = true;
          reflectKilled = true;
          break;
        }
      }

      const counterEffects = ctx.target.activeEffects.filter(e => e.mechanic === "counter");
      for (const ctr of counterEffects) {
        const ctrDmg = Math.max(1, ctr.value * ctr.stacks);
        const sourceHpLost = Math.min(ctx.source.currentHp, ctrDmg);
        ctx.source.currentHp -= sourceHpLost;
        counterHpLost += sourceHpLost;
        if (ctx.source.currentHp <= 0) {
          ctx.source.currentHp = 0;
          ctx.source.isDead = true;
          counterKilled = true;
          break;
        }
      }

      const targetTeamAllies = ctx.target.team === "ally" ? allies : enemies;
      const damageShareHolders = targetTeamAllies.filter(a =>
        !a.isDead && a.id !== ctx.target.id &&
        a.activeEffects.some(e => e.mechanic === "damage_share"),
      );
      if (damageShareHolders.length > 0) {
        let totalSharePct = 0;
        const holderShares: Array<{ combatant: BattleCombatant; pct: number }> = [];
        for (const holder of damageShareHolders) {
          const shareEffect = holder.activeEffects.find(e => e.mechanic === "damage_share")!;
          const pct = shareEffect.value;
          totalSharePct += pct;
          holderShares.push({ combatant: holder, pct });
        }
        totalSharePct = Math.min(totalSharePct, 50);
        const sharedTotal = Math.round(finalDamage * totalSharePct / 100);
        const refund = Math.min(hpLost, sharedTotal);
        if (refund > 0) {
          ctx.target.currentHp = Math.min(ctx.target.maxHp, ctx.target.currentHp + refund);
          if (ctx.target.currentHp > 0) {
            ctx.target.isDead = false;
          }
        }
        for (const { combatant, pct } of holderShares) {
          const share = Math.round(sharedTotal * pct / totalSharePct);
          const lost = Math.min(combatant.currentHp, share);
          combatant.currentHp -= lost;
          const holderKilled = combatant.currentHp <= 0;
          if (holderKilled) {
            combatant.currentHp = 0;
            combatant.isDead = true;
          }
          sharedDamages.push({
            targetId: combatant.id,
            targetName: combatant.displayName,
            hpLost: lost,
            killed: holderKilled,
          });
        }
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
      markBonus,
      deathWardTriggered,
      reflectHpLost,
      reflectKilled,
      counterHpLost,
      counterKilled,
      sharedDamages,
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
