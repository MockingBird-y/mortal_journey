import type {
  BattleCombatant,
  ActiveStatusEffect,
  BattleLogEntry,
  BattleStatKey,
} from "./types";
import type { PrimaryStatKey } from "../role_core/types/playInfo";
import type { EventDispatcher } from "./EventDispatcher";
import { generateId } from "./formulas";
import type { MechanicId } from "../role_core/types/combatMechanics";

export class EffectManager {
  constructor(private dispatcher: EventDispatcher) {}

  addEffect(target: BattleCombatant, effect: ActiveStatusEffect): void {
    const existing = target.activeEffects.find(
      e => e.name === effect.name && e.mechanic === effect.mechanic,
    );

    if (existing) {
      if (effect.category === "cc") {
        const idx = target.activeEffects.indexOf(existing);
        target.activeEffects[idx] = effect;
      } else if (effect.canStack && existing.stacks < existing.maxStacks) {
        existing.stacks = Math.min(existing.maxStacks, existing.stacks + effect.stacks);
        existing.remainingTurns = Math.max(existing.remainingTurns, effect.remainingTurns);
      } else {
        existing.remainingTurns = Math.max(existing.remainingTurns, effect.remainingTurns);
        existing.value = Math.max(existing.value, effect.value);
      }
    } else {
      target.activeEffects.push(effect);
    }

    const evt = effect.category === "buff" || effect.category === "hot"
      ? "buff_applied"
      : "debuff_applied";
    this.dispatcher.emit(evt, {
      event: evt,
      target,
      turn: 0,
      allies: [],
      enemies: [],
    });
  }

  removeEffects(
    target: BattleCombatant,
    predicate: (e: ActiveStatusEffect) => boolean,
  ): number {
    let count = 0;
    for (let i = target.activeEffects.length - 1; i >= 0; i--) {
      if (predicate(target.activeEffects[i])) {
        target.activeEffects.splice(i, 1);
        count++;
      }
    }
    return count;
  }

  tickEffects(combatant: BattleCombatant, turn: number): BattleLogEntry[] {
    const entries: BattleLogEntry[] = [];

    for (let i = combatant.activeEffects.length - 1; i >= 0; i--) {
      const eff = combatant.activeEffects[i];

      if (eff.category === "dot" && eff.tickValue != null && eff.tickValue > 0) {
        const stacks = eff.stacks || 1;
        let tickDmg: number;

        if (eff.tickIsPercent && eff.tickStatKey) {
          const base = eff.tickStatKey === "maxHp"
            ? combatant.maxHp
            : eff.tickStatKey === "currentMp"
              ? combatant.currentMp
              : combatant.currentHp;
          tickDmg = Math.round(base * eff.tickValue / 100 * stacks);
        } else {
          tickDmg = Math.round(eff.tickValue * stacks);
        }

        const hpLoss = Math.min(combatant.currentHp, tickDmg);
        combatant.currentHp -= hpLoss;

        entries.push({
          turn,
          actorName: eff.name,
          action: "持续伤害",
          targetName: combatant.displayName,
          type: "dot",
          value: hpLoss,
          narrative: `${combatant.displayName}受到${eff.name}，损失${hpLoss}点生命`,
          team: combatant.team,
        });

        if (combatant.currentHp <= 0) {
          combatant.isDead = true;
          combatant.currentHp = 0;
          entries.push({
            turn,
            actorName: combatant.displayName,
            action: "阵亡",
            type: "death",
            narrative: `${combatant.displayName}倒下了！`,
            team: combatant.team,
          });
        }
      }

      if (eff.category === "hot" && eff.tickValue != null && eff.tickValue > 0) {
        const stacks = eff.stacks || 1;
        let healAmt: number;

        if (eff.tickIsPercent) {
          healAmt = Math.round(combatant.maxHp * eff.tickValue / 100 * stacks);
        } else {
          healAmt = Math.round(eff.tickValue * stacks);
        }

        const deficit = combatant.maxHp - combatant.currentHp;
        const healed = Math.min(deficit, healAmt);
        if (healed > 0) {
          combatant.currentHp += healed;
          entries.push({
            turn,
            actorName: eff.name,
            action: "持续恢复",
            targetName: combatant.displayName,
            type: "heal",
            value: healed,
            narrative: `${combatant.displayName}受到${eff.name}，恢复${healed}点生命`,
            team: combatant.team,
          });
        }
      }

      eff.remainingTurns -= 1;
      if (eff.remainingTurns <= 0) {
        combatant.activeEffects.splice(i, 1);
      }
    }

    return entries;
  }

  canAct(combatant: BattleCombatant): { canAct: boolean; reason?: string } {
    for (const eff of combatant.activeEffects) {
      if (eff.category !== "cc") continue;
      if (eff.mechanic === "cc_stun" || eff.mechanic === "cc_freeze" || eff.mechanic === "cc_root") {
        return { canAct: false, reason: eff.mechanic === "cc_stun" ? "眩晕中" : eff.mechanic === "cc_freeze" ? "冻结中" : "禁锢中" };
      }
    }
    return { canAct: true };
  }

  canUseSkills(combatant: BattleCombatant): boolean {
    return !combatant.activeEffects.some(e => e.mechanic === "cc_silence");
  }

  canMove(combatant: BattleCombatant): boolean {
    return !combatant.activeEffects.some(e => e.mechanic === "cc_root");
  }

  isFeared(combatant: BattleCombatant): boolean {
    return combatant.activeEffects.some(e => e.mechanic === "cc_fear");
  }

  hasStealth(combatant: BattleCombatant): boolean {
    return combatant.activeEffects.some(e => e.mechanic === "buff_stealth");
  }

  hasStatus(combatant: BattleCombatant, statusId: string): boolean {
    return combatant.activeEffects.some(e => e.status === statusId);
  }

  hasMechanic(combatant: BattleCombatant, mechanic: MechanicId): boolean {
    return combatant.activeEffects.some(e => e.mechanic === mechanic);
  }

  getMarkAmplification(combatant: BattleCombatant): number {
    let total = 0;
    for (const eff of combatant.activeEffects) {
      if (eff.mechanic === "debuff_mark") {
        total += eff.value * eff.stacks;
      }
    }
    return total;
  }

  consumeEffect(combatant: BattleCombatant, mechanic: MechanicId): boolean {
    const idx = combatant.activeEffects.findIndex(e => e.mechanic === mechanic);
    if (idx !== -1) {
      combatant.activeEffects.splice(idx, 1);
      return true;
    }
    return false;
  }

  getEffectiveStat(combatant: BattleCombatant, stat: BattleStatKey): number {
    const primaryKeys = new Set<string>(["physique", "spirit", "strength", "perception", "guard", "resistance", "agility", "insight"]);
    let base: number;
    if (primaryKeys.has(stat)) {
      base = combatant.stats[stat as PrimaryStatKey] ?? 0;
    } else {
      base = combatant.combatStats[stat as keyof typeof combatant.combatStats] ?? 0;
    }
    let flatMod = 0;
    let pctMod = 0;

    for (const eff of combatant.activeEffects) {
      if (eff.statKey !== stat) continue;
      if (eff.isPercent) {
        pctMod += eff.value * eff.stacks;
      } else {
        flatMod += eff.value * eff.stacks;
      }
    }

    return Math.max(0, Math.round((base + flatMod) * (1 + pctMod / 100)));
  }

  getSpeed(combatant: BattleCombatant): number {
    let speed = combatant.speed;
    for (const eff of combatant.activeEffects) {
      if (eff.statKey === "speed") {
        if (eff.isPercent) {
          speed = Math.round(speed * (1 + eff.value * eff.stacks / 100));
        } else {
          speed += eff.value * eff.stacks;
        }
      }
    }
    return Math.max(1, speed);
  }
}
