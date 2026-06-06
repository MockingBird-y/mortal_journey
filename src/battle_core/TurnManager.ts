import type { BattleCombatant } from "./types";

export class TurnManager {
  private turnOrder: BattleCombatant[] = [];

  calculateOrder(allCombatants: BattleCombatant[]): void {
    this.turnOrder = allCombatants
      .filter(c => !c.isDead)
      .sort((a, b) => {
        if (b.speed !== a.speed) return b.speed - a.speed;
        return Math.random() - 0.5;
      });
  }

  getOrder(): readonly BattleCombatant[] {
    return this.turnOrder;
  }

  getNextActor(actedSet: Set<string>): BattleCombatant | null {
    return this.turnOrder.find(c => !c.isDead && !actedSet.has(c.id)) ?? null;
  }

  getAliveCount(actedSet: Set<string>): number {
    return this.turnOrder.filter(c => !c.isDead && !actedSet.has(c.id)).length;
  }
}
