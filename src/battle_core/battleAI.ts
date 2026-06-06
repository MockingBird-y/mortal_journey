import type {
  BattleState,
  BattleCombatant,
  BattleAction,
  BattleEngineLike,
} from "./types";

export class BattleAI {
  decide(actor: BattleCombatant, state: BattleState, engine: BattleEngineLike): BattleAction | null {
    const enemies = actor.team === "ally" ? state.enemies : state.allies;
    const aliveEnemies = enemies.filter(e => !e.isDead);
    if (aliveEnemies.length === 0) return null;

    const canAct = engine.effectManager.canAct(actor);
    if (!canAct.canAct) return null;

    const canUseSkills = engine.effectManager.canUseSkills(actor);

    if (canUseSkills) {
      const gongfaAction = this.trySelectGongfa(actor, state, engine, aliveEnemies);
      if (gongfaAction) return gongfaAction;
    }

    if (actor.currentMp >= Math.round(actor.maxMp * 0.05) && Math.random() < 0.3) {
      const target = this.selectTarget(aliveEnemies);
      if (target) return { type: "magic_attack", targetId: target.id };
    }

    const target = this.selectTarget(aliveEnemies);
    if (target) return { type: "normal_attack", targetId: target.id };

    return null;
  }

  private trySelectGongfa(
    actor: BattleCombatant,
    state: BattleState,
    engine: BattleEngineLike,
    aliveEnemies: BattleCombatant[],
  ): BattleAction | null {
    for (let i = 0; i < actor.gongfaSlots.length; i++) {
      const gf = actor.gongfaSlots[i];
      if (!gf || !gf.function) continue;
      if (actor.cooldowns[i] > 0) continue;
      if ((gf.function.mpCost ?? 0) > actor.currentMp) continue;

      if (gf.function.type === "被动") continue;

      const hasOffensive = gf.function.components.some(
        c => c.mechanic?.startsWith("dmg_") || c.mechanic?.startsWith("debuff_") || c.mechanic?.startsWith("cc_"),
      );

      if (hasOffensive && aliveEnemies.length > 0) {
        const target = this.selectTarget(aliveEnemies);
        if (target) return { type: "gongfa", gongfaIndex: i, targetId: target.id };
      } else {
        const allies = actor.team === "ally" ? state.allies : state.enemies;
        const self = allies.find(a => a.id === actor.id);
        return { type: "gongfa", gongfaIndex: i, targetId: self?.id ?? actor.id };
      }
    }

    return null;
  }

  private selectTarget(aliveEnemies: BattleCombatant[]): BattleCombatant | null {
    if (aliveEnemies.length === 0) return null;
    const lowestHp = aliveEnemies.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
    if (Math.random() < 0.6) return lowestHp;
    return aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
  }
}
