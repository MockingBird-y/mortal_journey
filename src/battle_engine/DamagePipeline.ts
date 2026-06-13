import type {
  DamageContext,
  DamageResult,
  BattleCombatant,
} from "./types";
import type { EffectManager } from "./EffectManager";
import type { EventDispatcher } from "./EventDispatcher";
import { calcDefenseReduction, checkCrit, checkDodge } from "./formulas";

const EMPTY_RESULT: DamageResult = {
  finalDamage: 0,
  shieldAbsorbed: 0,
  hpLost: 0,
  killed: false,
  dodged: false,
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

  execute(
    ctx: DamageContext,
    actionCount: number,
    allies: BattleCombatant[],
    enemies: BattleCombatant[],
  ): DamageResult {
    this.dispatcher.emit("pre_damage", {
      event: "pre_damage", source: ctx.source, target: ctx.target, turn: actionCount, allies, enemies,
    });

    const dodgeRate = this.effectManager.getModifierTotal(ctx.target, "dodgeRate");
    if (checkDodge(dodgeRate)) {
      this.dispatcher.emit("dodge", {
        event: "dodge", source: ctx.source, target: ctx.target, turn: actionCount, allies, enemies,
      });
      return { ...EMPTY_RESULT, dodged: true };
    }

    let rawDamage = ctx.rawDamage;
    let actualCrit = ctx.isCrit;

    if (!actualCrit) {
      const critRate = ctx.source.stats.critRate + this.effectManager.getModifierTotal(ctx.source, "critRate");
      actualCrit = checkCrit(Math.max(0, critRate));
    }
    if (actualCrit) {
      const critDmg = ctx.source.stats.critDmg + this.effectManager.getModifierTotal(ctx.source, "critDmg");
      rawDamage = Math.round(rawDamage * critDmg / 100);
    }

    const defense = ctx.damageType === "physical" ? ctx.target.stats.physDefense
      : ctx.damageType === "magical" ? ctx.target.stats.magDefense
      : 0;
    let baseDamage = calcDefenseReduction(rawDamage, defense, ctx.damageType);

    const damageDealtGeneral = this.effectManager.getModifierTotal(ctx.source, "damageDealt");
    const damageDealtSpecific = ctx.damageType === "physical"
      ? this.effectManager.getModifierTotal(ctx.source, "physDamageDealt")
      : ctx.damageType === "magical"
        ? this.effectManager.getModifierTotal(ctx.source, "magDamageDealt")
        : 0;
    const dealtMult = 1 + (damageDealtGeneral + damageDealtSpecific) / 100;

    const damageTaken = this.effectManager.getModifierTotal(ctx.target, "damageTaken");
    const takenMult = 1 + damageTaken / 100;

    let finalDamage = Math.max(1, Math.round(baseDamage * dealtMult * takenMult));

    let remaining = finalDamage;
    let shieldAbsorbed = 0;
    if (ctx.target.shield > 0) {
      const absorbed = Math.min(ctx.target.shield, remaining);
      ctx.target.shield -= absorbed;
      remaining -= absorbed;
      shieldAbsorbed = absorbed;
    }

    const hpLost = Math.min(ctx.target.hp, remaining);
    ctx.target.hp -= hpLost;

    let killed = false;
    let deathWardTriggered = false;
    if (ctx.target.hp <= 0) {
      ctx.target.hp = 0;

      this.dispatcher.emit("fatal", {
        event: "fatal", source: ctx.source, target: ctx.target, turn: actionCount, allies, enemies,
      });

      if (this.effectManager.consumeDeathWard(ctx.target)) {
        ctx.target.hp = 1;
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

    if (!ctx.isReflected && hpLost > 0) {
      const reflectEffects = ctx.target.effects.filter(e => e.specialType === "reflect");
      for (const refl of reflectEffects) {
        const reflDmg = Math.max(1, Math.round(finalDamage * (refl.specialValue ?? 0) / 100));
        const sourceHpLost = Math.min(ctx.source.hp, reflDmg);
        ctx.source.hp -= sourceHpLost;
        reflectHpLost += sourceHpLost;
        if (ctx.source.hp <= 0) {
          ctx.source.hp = 0;
          ctx.source.isDead = true;
          reflectKilled = true;
          break;
        }
      }

      const counterEffects = ctx.target.effects.filter(e => e.specialType === "counter");
      for (const ctr of counterEffects) {
        const ctrDmg = Math.max(1, (ctr.specialValue ?? 0) * ctr.stacks);
        const sourceHpLost = Math.min(ctx.source.hp, ctrDmg);
        ctx.source.hp -= sourceHpLost;
        counterHpLost += sourceHpLost;
        if (ctx.source.hp <= 0) {
          ctx.source.hp = 0;
          ctx.source.isDead = true;
          counterKilled = true;
          break;
        }
      }

      const targetTeamAllies = ctx.target.team === "ally" ? allies : enemies;
      const damageShareHolders = targetTeamAllies.filter(a =>
        !a.isDead && a.id !== ctx.target.id && a.effects.some(e => e.specialType === "damageShare"),
      );
      if (damageShareHolders.length > 0) {
        let totalSharePct = 0;
        const holderShares: Array<{ combatant: BattleCombatant; pct: number }> = [];
        for (const holder of damageShareHolders) {
          const shareEffect = holder.effects.find(e => e.specialType === "damageShare")!;
          const pct = shareEffect.specialValue ?? 0;
          totalSharePct += pct;
          holderShares.push({ combatant: holder, pct });
        }
        totalSharePct = Math.min(totalSharePct, 50);
        const sharedTotal = Math.round(finalDamage * totalSharePct / 100);
        const refund = Math.min(hpLost, sharedTotal);
        if (refund > 0) {
          ctx.target.hp = Math.min(ctx.target.stats.maxHp, ctx.target.hp + refund);
          if (ctx.target.hp > 0) ctx.target.isDead = false;
        }
        for (const { combatant, pct } of holderShares) {
          const share = Math.round(sharedTotal * pct / totalSharePct);
          const lost = Math.min(combatant.hp, share);
          combatant.hp -= lost;
          const holderKilled = combatant.hp <= 0;
          if (holderKilled) {
            combatant.hp = 0;
            combatant.isDead = true;
          }
          sharedDamages.push({
            targetId: combatant.id,
            targetName: combatant.name,
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
      deathWardTriggered,
      reflectHpLost,
      reflectKilled,
      counterHpLost,
      counterKilled,
      sharedDamages,
    };

    this.dispatcher.emit("damage_dealt", {
      event: "damage_dealt", source: ctx.source, target: ctx.target, damage: result, turn: actionCount, allies, enemies,
    });
    this.dispatcher.emit("damage_taken", {
      event: "damage_taken", source: ctx.target, target: ctx.target, damage: result, turn: actionCount, allies, enemies,
    });
    if (actualCrit) {
      this.dispatcher.emit("crit", {
        event: "crit", source: ctx.source, target: ctx.target, damage: result, turn: actionCount, allies, enemies,
      });
    }
    if (killed) {
      this.dispatcher.emit("kill", {
        event: "kill", source: ctx.source, target: ctx.target, turn: actionCount, allies, enemies,
      });
      this.dispatcher.emit("death", {
        event: "death", target: ctx.target, turn: actionCount, allies, enemies,
      });
    }

    return result;
  }
}
