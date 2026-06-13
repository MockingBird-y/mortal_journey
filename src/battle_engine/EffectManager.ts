import type {
  BattleCombatant,
  BattleEffect,
  BattleLogEntry,
  EffectCategory,
  ModifierType,
  CcType,
} from "./types";
import { generateId } from "./formulas";

export class EffectManager {

  addEffect(target: BattleCombatant, effect: BattleEffect): void {
    const existing = this.findMatchingEffect(target, effect);
    if (existing) {
      if (effect.category === "cc") {
        const idx = target.effects.indexOf(existing);
        target.effects[idx] = effect;
      } else if (effect.maxStacks > 1 && existing.stacks < existing.maxStacks) {
        existing.stacks = Math.min(existing.maxStacks, existing.stacks + effect.stacks);
        existing.remainingDuration = Math.max(existing.remainingDuration, effect.remainingDuration);
      } else {
        existing.remainingDuration = Math.max(existing.remainingDuration, effect.remainingDuration);
        if (effect.modifierValue != null && existing.modifierValue != null) {
          existing.modifierValue = Math.max(existing.modifierValue, effect.modifierValue);
        }
      }
    } else {
      target.effects.push(effect);
    }
  }

  removeEffects(target: BattleCombatant, predicate: (e: BattleEffect) => boolean): number {
    let count = 0;
    for (let i = target.effects.length - 1; i >= 0; i--) {
      if (predicate(target.effects[i])) {
        target.effects.splice(i, 1);
        count++;
      }
    }
    return count;
  }

  tickEffects(combatant: BattleCombatant, actionCount: number): BattleLogEntry[] {
    const entries: BattleLogEntry[] = [];

    for (const eff of combatant.effects) {
      if (eff.category === "dot" && eff.tickValue != null && eff.tickValue > 0) {
        const stacks = eff.stacks || 1;
        let tickDmg: number;
        if (eff.tickIsPercent) {
          const base = eff.tickResource === "mp" ? combatant.mp : combatant.stats.maxHp;
          tickDmg = Math.round(base * eff.tickValue / 100 * stacks);
        } else {
          tickDmg = Math.round(eff.tickValue * stacks);
        }

        if (eff.tickResource === "mp") {
          const mpLoss = Math.min(combatant.mp, tickDmg);
          combatant.mp -= mpLoss;
          entries.push(this.logEntry(actionCount, eff.name, "持续法力损失", combatant.name, "dot", mpLoss,
            `${combatant.name}受到${eff.name}，损失${mpLoss}点法力`, combatant.team));
        } else {
          const hpLoss = Math.min(combatant.hp, tickDmg);
          combatant.hp -= hpLoss;
          entries.push(this.logEntry(actionCount, eff.name, "持续伤害", combatant.name, "dot", hpLoss,
            `${combatant.name}受到${eff.name}，损失${hpLoss}点生命`, combatant.team));
          if (combatant.hp <= 0) {
            combatant.hp = 0;
            combatant.isDead = true;
            entries.push(this.logEntry(actionCount, combatant.name, "阵亡", undefined, "death", undefined,
              `${combatant.name}倒下了！`, combatant.team));
          }
        }
      }

      if (eff.category === "hot" && eff.tickValue != null && eff.tickValue > 0) {
        const stacks = eff.stacks || 1;
        let healAmt: number;
        if (eff.tickIsPercent) {
          healAmt = Math.round(combatant.stats.maxHp * eff.tickValue / 100 * stacks);
        } else {
          healAmt = Math.round(eff.tickValue * stacks);
        }
        const deficit = combatant.stats.maxHp - combatant.hp;
        const healed = Math.min(deficit, healAmt);
        if (healed > 0) {
          combatant.hp += healed;
          entries.push(this.logEntry(actionCount, eff.name, "持续恢复", combatant.name, "heal", healed,
            `${combatant.name}受到${eff.name}，恢复${healed}点生命`, combatant.team));
        }
      }
    }

    for (let i = combatant.effects.length - 1; i >= 0; i--) {
      combatant.effects[i].remainingDuration--;
      if (combatant.effects[i].remainingDuration <= 0) {
        combatant.effects.splice(i, 1);
      }
    }

    return entries;
  }

  getModifierTotal(combatant: BattleCombatant, type: ModifierType): number {
    return combatant.effects
      .filter(e => e.category === "modifier" && e.modifierType === type)
      .reduce((sum, e) => sum + (e.modifierValue ?? 0) * e.stacks, 0);
  }

  canAct(combatant: BattleCombatant): boolean {
    return !combatant.effects.some(e => e.category === "cc" && (e.ccType === "stun"));
  }

  canUseSkills(combatant: BattleCombatant): boolean {
    return !combatant.effects.some(e => e.category === "cc" && e.ccType === "silence");
  }

  isFeared(combatant: BattleCombatant): boolean {
    return combatant.effects.some(e => e.category === "cc" && e.ccType === "fear");
  }

  isConfused(combatant: BattleCombatant): boolean {
    return combatant.effects.some(e => e.category === "cc" && e.ccType === "confusion");
  }

  isTaunted(combatant: BattleCombatant): { taunted: boolean; tauntSourceId?: string } {
    const taunt = combatant.effects.find(e => e.category === "cc" && e.ccType === "taunt");
    if (!taunt) return { taunted: false };
    return { taunted: true, tauntSourceId: taunt.sourceId };
  }

  hasStealth(combatant: BattleCombatant): boolean {
    return combatant.effects.some(e => e.specialType === "stealth");
  }

  hasDeathWard(combatant: BattleCombatant): boolean {
    return combatant.effects.some(e => e.specialType === "deathWard");
  }

  consumeDeathWard(combatant: BattleCombatant): boolean {
    const idx = combatant.effects.findIndex(e => e.specialType === "deathWard");
    if (idx >= 0) {
      combatant.effects.splice(idx, 1);
      return true;
    }
    return false;
  }

  consumeCcType(combatant: BattleCombatant, ccType: CcType): boolean {
    const idx = combatant.effects.findIndex(e => e.category === "cc" && e.ccType === ccType);
    if (idx >= 0) {
      combatant.effects.splice(idx, 1);
      return true;
    }
    return false;
  }

  getSummonEffects(combatant: BattleCombatant, trigger: string): BattleEffect[] {
    return combatant.effects.filter(e => e.category === "summon" && e.summonTrigger === trigger);
  }

  makeEffect(overrides: Partial<BattleEffect> & Pick<BattleEffect, "name" | "sourceId" | "category">): BattleEffect {
    return {
      id: generateId(),
      remainingDuration: 2,
      stacks: 1,
      maxStacks: 1,
      ...overrides,
    };
  }

  private findMatchingEffect(target: BattleCombatant, effect: BattleEffect): BattleEffect | undefined {
    if (effect.category === "cc") {
      return target.effects.find(e => e.category === "cc" && e.ccType === effect.ccType);
    }
    if (effect.category === "modifier") {
      return target.effects.find(e => e.category === "modifier" && e.modifierType === effect.modifierType && e.name === effect.name);
    }
    if (effect.category === "summon") {
      return target.effects.find(e => e.category === "summon" && e.name === effect.name);
    }
    if (effect.category === "dot" || effect.category === "hot") {
      return target.effects.find(e => e.category === effect.category && e.statusType === effect.statusType && e.name === effect.name);
    }
    return target.effects.find(e => e.name === effect.name && e.specialType === effect.specialType);
  }

  private logEntry(
    turn: number, actorName: string, action: string, targetName: string | undefined,
    type: BattleLogEntry["type"], value: number | undefined, narrative: string, team?: "ally" | "enemy",
  ): BattleLogEntry {
    return { turn, actorName, action, targetName, type, value, narrative, team };
  }
}
