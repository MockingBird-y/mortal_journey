import type {
  BattleState,
  BattleCombatant,
  BattleAction,
  BattleLogEntry,
  BattlePhase,
  ActionContext,
  ActionOptions,
  SkillActionItem,
  ElixirActionItem,
  BattleEngineLike,
} from "./types";

import { EventDispatcher } from "./EventDispatcher";
import { GaugeManager } from "./GaugeManager";
import { EffectManager } from "./EffectManager";
import { DamagePipeline } from "./DamagePipeline";
import { EffectHandler } from "./EffectHandler";
import { BattleAI } from "./BattleAI";
import { NORMAL_ATTACK_COST, ELIXIR_COST, GAUGE_MAX } from "./constants";

export class BattleEngine implements BattleEngineLike {
  readonly eventDispatcher = new EventDispatcher();
  readonly effectManager = new EffectManager();
  readonly gaugeManager = new GaugeManager();
  readonly damagePipeline = new DamagePipeline(this.effectManager, this.eventDispatcher);
  readonly effectHandler = new EffectHandler();

  private ai = new BattleAI();
  state!: BattleState;

  init(allies: BattleCombatant[], enemies: BattleCombatant[], triggerEntry: unknown): void {
    this.state = {
      phase: "init",
      actionCount: 0,
      allies,
      enemies,
      activeCombatantId: null,
      pendingAction: null,
      selectedTargetId: null,
      log: [],
      triggerEntry,
    };
    this.startBattle();
  }

  private startBattle(): void {
    this.state.phase = "running";
    this.eventDispatcher.emit("battle_start", {
      event: "battle_start", allies: this.state.allies, enemies: this.state.enemies, turn: 0,
    });
    this.processNextActor();
  }

  private processNextActor(): void {
    if (this.checkBattleEnd()) return;

    const actor = this.gaugeManager.advanceToNextActor(
      this.getAllCombatants(),
      (p) => {
        if (p.actionGauge >= GAUGE_MAX) {
          this.state.phase = "fled";
          this.addLog({
            turn: this.state.actionCount, actorName: p.name, action: "逃跑成功",
            type: "flee_success", narrative: `${p.name}成功逃离了战斗！`, team: p.team,
          });
          this.emitBattleEnd();
          return true;
        }
        return false;
      },
    );

    if (this.state.phase === "fled") return;
    if (!actor) return;

    this.state.activeCombatantId = actor.id;

    this.state.actionCount++;
    this.addLog({
      turn: this.state.actionCount, actorName: actor.name, action: "回合开始",
      type: "info", narrative: `─── ${actor.name}的回合 ───`, team: actor.team,
    });

    const tickEntries = this.effectManager.tickEffects(actor, this.state.actionCount);
    this.addLogEntries(tickEntries);

    this.tickCooldowns(actor);

    if (actor.isDead || this.checkBattleEnd()) return;

    if (!this.effectManager.canAct(actor)) {
      this.addLog({
        turn: this.state.actionCount, actorName: actor.name, action: "被控制",
        type: "info", narrative: `${actor.name}无法行动`, team: actor.team,
      });
      this.gaugeManager.consumeGauge(actor, GAUGE_MAX);
      this.processNextActor();
      return;
    }

    if (actor.isPlayerControlled) {
      this.state.phase = "playerAction";
      this.state.pendingAction = null;
      return;
    }

    this.executeAiTurn(actor);
  }

  private executeAiTurn(actor: BattleCombatant): void {
    const action = this.ai.decide(actor, this.state, this);
    if (!action) {
      this.gaugeManager.consumeGauge(actor, GAUGE_MAX);
      this.processNextActor();
      return;
    }

    this.executeAction(actor, action);

    if (this.checkBattleEnd()) return;

    this.triggerSummons(actor, "on_turn_end");
    this.processNextActor();
  }

  submitPlayerAction(action: BattleAction): void {
    const actor = this.findCombatant(this.state.activeCombatantId ?? "");
    if (!actor) return;

    this.executeAction(actor, action);

    if (!this.checkBattleEnd()) {
      this.triggerSummons(actor, "on_turn_end");
      this.processNextActor();
    }
  }

  private executeAction(actor: BattleCombatant, action: BattleAction): void {
    this.eventDispatcher.emit("action_start", {
      event: "action_start", actor,
      allies: actor.team === "ally" ? this.state.allies : this.state.enemies,
      enemies: actor.team === "ally" ? this.state.enemies : this.state.allies,
      turn: this.state.actionCount,
    });

    this.resolveTargetOverride(actor, action);

    switch (action.type) {
      case "normalAttack":
        this.executeNormalAttack(actor, action.targetId);
        break;
      case "skill":
        this.executeSkill(actor, action.skillIndex, action.targetId);
        break;
      case "elixir":
        this.executeElixir(actor, action.elixirIndex);
        break;
      case "flee":
        this.executeFlee(actor);
        break;
    }

    this.eventDispatcher.emit("action_end", {
      event: "action_end", actor, action,
      allies: actor.team === "ally" ? this.state.allies : this.state.enemies,
      enemies: actor.team === "ally" ? this.state.enemies : this.state.allies,
      turn: this.state.actionCount,
    });
  }

  private resolveTargetOverride(actor: BattleCombatant, action: BattleAction): void {
    if (action.type === "flee" || action.type === "elixir") return;
    if (!("targetId" in action)) return;

    const taunt = this.effectManager.isTaunted(actor);
    if (taunt.taunted && taunt.tauntSourceId) {
      action.targetId = taunt.tauntSourceId;
      return;
    }

    if (this.effectManager.isFeared(actor)) {
      const allTargets = this.getAllCombatants().filter(c => !c.isDead && c.id !== actor.id);
      if (allTargets.length > 0) {
        action.targetId = allTargets[Math.floor(Math.random() * allTargets.length)].id;
      }
      return;
    }

    if (this.effectManager.isConfused(actor)) {
      const enemyTeam = actor.team === "ally" ? this.state.enemies : this.state.allies;
      const otherEnemies = enemyTeam.filter(c => !c.isDead && c.id !== actor.id);
      if (otherEnemies.length > 0) {
        action.targetId = otherEnemies[Math.floor(Math.random() * otherEnemies.length)].id;
      }
    }
  }

  private executeNormalAttack(actor: BattleCombatant, targetId: string): void {
    const target = this.findCombatant(targetId);
    if (!target || target.isDead) {
      this.addLog({ turn: this.state.actionCount, actorName: actor.name, action: "普通攻击", type: "miss", narrative: `${actor.name}的攻击落空了`, team: actor.team });
      this.gaugeManager.consumeGauge(actor, NORMAL_ATTACK_COST);
      return;
    }

    const rawDmg = actor.stats.physAttack;
    const result = this.damagePipeline.execute(
      { source: actor, target, rawDamage: rawDmg, damageType: "physical", isCrit: false },
      this.state.actionCount, this.state.allies, this.state.enemies,
    );

    if (result.dodged) {
      this.addLog({ turn: this.state.actionCount, actorName: actor.name, action: "普通攻击", targetName: target.name, type: "miss", narrative: `${target.name}闪避了${actor.name}的攻击`, team: actor.team });
      this.triggerSummons(actor, "on_dodge");
    } else {
      const isCrit = result.finalDamage > rawDmg;
      this.addLog({ turn: this.state.actionCount, actorName: actor.name, action: "普通攻击", targetName: target.name, type: isCrit ? "crit" : "damage", value: result.hpLost, narrative: `${actor.name}对${target.name}造成${result.hpLost}点物理伤害${isCrit ? "，暴击！" : ""}`, team: actor.team });
      if (result.killed) {
        this.addLog({ turn: this.state.actionCount, actorName: target.name, action: "阵亡", type: "death", narrative: `${target.name}被击败了！`, team: target.team });
        this.triggerSummons(actor, "on_kill");
      }
      this.triggerSummons(actor, "on_attack");
      this.addSecondaryDamageLogs(result, actor, target);
    }

    this.gaugeManager.consumeGauge(actor, NORMAL_ATTACK_COST);
  }

  private executeSkill(actor: BattleCombatant, skillIndex: number, targetId: string): void {
    const skill = actor.skills[skillIndex];
    if (!skill) {
      this.addLog({ turn: this.state.actionCount, actorName: actor.name, action: "技能", type: "info", narrative: `${actor.name}尝试使用技能但失败了`, team: actor.team });
      return;
    }

    if (actor.cooldowns[skillIndex] > 0) {
      this.addLog({ turn: this.state.actionCount, actorName: actor.name, action: "技能冷却中", type: "info", narrative: `${skill.name}正在冷却中（剩余${actor.cooldowns[skillIndex]}回合）`, team: actor.team });
      return;
    }

    if (skill.mpCost > 0) {
      this.applyMpChange(actor, -skill.mpCost);
      this.addLog({ turn: this.state.actionCount, actorName: actor.name, action: "消耗法力", type: "info", value: skill.mpCost, narrative: `${actor.name}消耗${skill.mpCost}点法力`, team: actor.team });
    }

    const target = this.findCombatant(targetId);
    const ctx: ActionContext = {
      actor, action: { type: "skill", skillIndex, targetId },
      allies: actor.team === "ally" ? this.state.allies : this.state.enemies,
      enemies: actor.team === "ally" ? this.state.enemies : this.state.allies,
      turn: this.state.actionCount, target,
    };

    if (skill.isAoE && skill.needTarget) {
      const targets = (skill.targetTeam === "enemy" ? ctx.enemies : ctx.allies).filter(c => !c.isDead);
      for (const t of targets) {
        ctx.target = t;
        const entries = this.effectHandler.executeEffects(skill.effects, ctx, this);
        this.addLogEntries(entries);
      }
    } else {
      const entries = this.effectHandler.executeEffects(skill.effects, ctx, this);
      this.addLogEntries(entries);
    }

    if (skill.cooldown > 0) {
      actor.cooldowns[skillIndex] = skill.cooldown;
    }

    this.gaugeManager.consumeGauge(actor, skill.actionCost);
  }

  private executeElixir(actor: BattleCombatant, elixirIndex: number): void {
    const elixir = actor.elixirs[elixirIndex];
    if (!elixir || elixir.count <= 0) return;

    elixir.count--;

    const healMult = 1 + this.effectManager.getModifierTotal(actor, "healReceived") / 100;

    if (elixir.effectType === "healHp") {
      const healed = this.applyHeal(actor, Math.round(elixir.value * healMult));
      this.addLog({ turn: this.state.actionCount, actorName: actor.name, action: "使用丹药", targetName: actor.name, type: "heal", value: healed, narrative: `${actor.name}使用${elixir.name}，恢复${healed}点生命`, team: actor.team });
    } else if (elixir.effectType === "healMp") {
      const restored = this.applyMpChange(actor, elixir.value);
      this.addLog({ turn: this.state.actionCount, actorName: actor.name, action: "使用丹药", targetName: actor.name, type: "heal", value: restored, narrative: `${actor.name}使用${elixir.name}，恢复${restored}点法力`, team: actor.team });
    }

    this.gaugeManager.consumeGauge(actor, ELIXIR_COST);
  }

  private executeFlee(actor: BattleCombatant): void {
    if (!actor.isProtagonist) {
      this.addLog({ turn: this.state.actionCount, actorName: actor.name, action: "逃跑失败", type: "flee_fail", narrative: `${actor.name}无法逃跑！`, team: actor.team });
      this.gaugeManager.consumeGauge(actor, GAUGE_MAX);
      return;
    }

    actor.isFleeing = true;
    this.gaugeManager.resetGauge(actor);
    this.addLog({ turn: this.state.actionCount, actorName: actor.name, action: "开始逃跑", type: "info", narrative: `${actor.name}开始蓄力逃跑，行动条从零开始累积…`, team: actor.team });
  }

  private triggerSummons(actor: BattleCombatant, trigger: string): void {
    const summons = this.effectManager.getSummonEffects(actor, trigger);
    for (const summon of summons) {
      if (!summon.summonEffect) continue;
      const entries = this.effectHandler.executeSummonEffect(
        summon.summonEffect, actor, summon.stacks,
        this.state.actionCount, this.state.allies, this.state.enemies, this,
      );
      this.addLogEntries(entries);
      if (this.checkBattleEnd()) return;
    }
  }

  private checkBattleEnd(): boolean {
    if (this.state.phase === "fled") return true;

    const alliesAlive = this.state.allies.some(a => !a.isDead);
    const enemiesAlive = this.state.enemies.some(e => !e.isDead);

    if (!enemiesAlive) {
      this.state.phase = "victory";
      this.emitBattleEnd();
      return true;
    }
    if (!alliesAlive) {
      this.state.phase = "defeat";
      this.emitBattleEnd();
      return true;
    }
    return false;
  }

  private emitBattleEnd(): void {
    this.eventDispatcher.emit("battle_end", {
      event: "battle_end", allies: this.state.allies, enemies: this.state.enemies, turn: this.state.actionCount,
    });
  }

  getPlayerActionOptions(): ActionOptions {
    const actor = this.findCombatant(this.state.activeCombatantId ?? "");
    if (!actor || actor.isDead) {
      return { canNormalAttack: false, canFlee: false, skills: [], elixirs: [] };
    }

    const canAct = this.effectManager.canAct(actor);
    if (!canAct) {
      return { canNormalAttack: false, canFlee: false, skills: [], elixirs: [] };
    }

    const canUseSkills = this.effectManager.canUseSkills(actor);

    const skills: SkillActionItem[] = [];
    if (canUseSkills) {
      for (let i = 0; i < actor.skills.length; i++) {
        const skill = actor.skills[i];
        if (actor.cooldowns[i] > 0) continue;
        if (skill.mpCost > actor.mp) continue;

        skills.push({
          skillIndex: i,
          name: skill.name,
          mpCost: skill.mpCost,
          needTarget: skill.needTarget,
          targetTeam: skill.targetTeam,
          description: skill.desc,
          cooldown: actor.cooldowns[i],
        });
      }
    }

    const elixirs: ElixirActionItem[] = [];
    for (let i = 0; i < actor.elixirs.length; i++) {
      const el = actor.elixirs[i];
      if (!el || el.count <= 0) continue;
      elixirs.push({
        elixirIndex: i,
        name: el.name,
        effectType: el.effectType,
        value: el.value,
        count: el.count,
        description: el.desc,
      });
    }

    return {
      canNormalAttack: true,
      canFlee: actor.isProtagonist,
      skills,
      elixirs,
    };
  }

  private tickCooldowns(combatant: BattleCombatant): void {
    for (let i = 0; i < combatant.cooldowns.length; i++) {
      if (combatant.cooldowns[i] > 0) {
        combatant.cooldowns[i]--;
      }
    }
  }

  addLog(entry: BattleLogEntry): void {
    this.state.log.push(entry);
  }

  addLogEntries(entries: BattleLogEntry[]): void {
    this.state.log.push(...entries);
  }

  addSecondaryDamageLogs(result: import("./types").DamageResult, source: BattleCombatant, target: BattleCombatant, turn?: number): void {
    const t = turn ?? this.state.actionCount;
    if (result.reflectHpLost > 0) {
      this.addLog({ turn: t, actorName: target.name, action: "反伤", targetName: source.name, type: "damage", value: result.reflectHpLost, narrative: `${target.name}的反伤对${source.name}造成${result.reflectHpLost}点伤害`, team: target.team });
      if (result.reflectKilled) {
        this.addLog({ turn: t, actorName: source.name, action: "阵亡", type: "death", narrative: `${source.name}被反伤击败了！`, team: source.team });
      }
    }
    if (result.counterHpLost > 0) {
      this.addLog({ turn: t, actorName: target.name, action: "反击", targetName: source.name, type: "damage", value: result.counterHpLost, narrative: `${target.name}的反击对${source.name}造成${result.counterHpLost}点伤害`, team: target.team });
      if (result.counterKilled) {
        this.addLog({ turn: t, actorName: source.name, action: "阵亡", type: "death", narrative: `${source.name}被反击击败了！`, team: source.team });
      }
    }
    for (const sd of result.sharedDamages) {
      this.addLog({ turn: t, actorName: source.name, action: "分摊伤害", targetName: sd.targetName, type: "damage", value: sd.hpLost, narrative: `${sd.targetName}分摊了${sd.hpLost}点伤害`, team: target.team });
      if (sd.killed) {
        this.addLog({ turn: t, actorName: sd.targetName, action: "阵亡", type: "death", narrative: `${sd.targetName}被分摊伤害击败了！`, team: target.team });
      }
    }
  }

  findCombatant(id: string): BattleCombatant | undefined {
    return this.getAllCombatants().find(c => c.id === id);
  }

  getAllCombatants(): BattleCombatant[] {
    return [...this.state.allies, ...this.state.enemies];
  }

  applyMpChange(target: BattleCombatant, delta: number): number {
    target.mp = Math.max(0, Math.min(target.stats.maxMp, target.mp + delta));
    return target.mp;
  }

  applyHeal(target: BattleCombatant, rawHeal: number): number {
    const deficit = target.stats.maxHp - target.hp;
    const healed = Math.min(deficit, rawHeal);
    target.hp += healed;

    this.eventDispatcher.emit("heal", {
      event: "heal", target,
      allies: target.team === "ally" ? this.state.allies : this.state.enemies,
      enemies: target.team === "ally" ? this.state.enemies : this.state.allies,
      turn: this.state.actionCount,
    });

    return healed;
  }
}
