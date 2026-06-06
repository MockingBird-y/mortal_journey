import type {
  BattleState,
  BattleCombatant,
  BattleAction,
  BattleLogEntry,
  BattlePhase,
  ActionContext,
  GongfaActionItem,
  ElixirActionItem,
  DamageType,
  EventContext,
  PassiveTrigger,
  BattleEngineLike,
} from "./types";

import type { BattleTriggerEntry } from "../ai/state_generate";
import type { PlayerBaseStats } from "../role_core/types/playInfo";
import type { ItemGrade } from "../role_core/types/itemInfo";
import type { GongfaSystem } from "../role_core/types/gongfa";

import { EventDispatcher } from "./EventDispatcher";
import { TurnManager } from "./TurnManager";
import { EffectManager } from "./EffectManager";
import { DamagePipeline } from "./DamagePipeline";
import { ConditionEvaluator } from "./ConditionEvaluator";
import { MechanicRegistry } from "./MechanicRegistry";
import { BattleAI } from "./BattleAI";
import * as formulas from "./formulas";

export class BattleEngine implements BattleEngineLike {
  readonly eventDispatcher = new EventDispatcher();
  readonly effectManager = new EffectManager(this.eventDispatcher);
  readonly damagePipeline = new DamagePipeline(this.effectManager, this.eventDispatcher);
  readonly conditionEvaluator = new ConditionEvaluator();
  readonly mechanicRegistry = new MechanicRegistry();

  private turnManager = new TurnManager();
  private ai = new BattleAI();

  state!: BattleState;
  private actedSet = new Set<string>();

  init(allies: BattleCombatant[], enemies: BattleCombatant[], triggerEntry: BattleTriggerEntry): void {
    this.state = {
      phase: "init",
      turn: 0,
      allies,
      enemies,
      turnOrder: [],
      currentActorId: null,
      log: [],
      triggerEntry,
      pendingAction: null,
      selectedTargetId: null,
      maxTurns: 30,
    };

    this.registerPassiveTriggers(allies, enemies);
    this.startBattle();
  }

  private registerPassiveTriggers(allies: BattleCombatant[], enemies: BattleCombatant[]): void {
    const all = [...allies, ...enemies];
    for (const c of all) {
      for (const trigger of c.passiveTriggers) {
        if (!trigger.component.mechanic) continue;

        const handler = this.mechanicRegistry.get(trigger.component.mechanic);
        if (!handler) continue;

        const triggerEvent = this.mapTriggerToEvent(trigger.component.trigger);
        if (!triggerEvent) continue;

        const capturedTrigger = trigger;
        const capturedHandler = handler;
        this.eventDispatcher.on(triggerEvent, (ctx: EventContext) => {
          const actor = ctx.actor ?? ctx.source ?? ctx.target;
          if (!actor) return;

          const actionCtx: ActionContext = {
            actor,
            action: ctx.action ?? { type: "normal_attack", targetId: "" },
            allies: ctx.allies,
            enemies: ctx.enemies,
            turn: ctx.turn,
            gongfaGrade: capturedTrigger.grade,
            gongfaSystem: capturedTrigger.system,
          };

          if (!this.conditionEvaluator.evaluate(capturedTrigger.component.condition, actionCtx)) return;

          const entries = capturedHandler.execute(actionCtx, this);
          this.addLogEntries(entries);
        });
      }
    }
  }

  private mapTriggerToEvent(trigger: string): import("./types").BattleEvent | null {
    switch (trigger) {
      case "on_attack": return "action_end";
      case "on_hit": return "damage_dealt";
      case "on_crit": return "crit";
      case "on_kill": return "kill";
      case "on_death": return "death";
      case "on_damaged": return "damage_taken";
      case "on_heal": return "heal";
      case "passive": return null;
      default: return null;
    }
  }

  private startBattle(): void {
    this.state.phase = "running";
    this.eventDispatcher.emit("battle_start", {
      event: "battle_start",
      allies: this.state.allies,
      enemies: this.state.enemies,
      turn: 0,
    });
    this.nextTurn();
  }

  private nextTurn(): void {
    this.state.turn++;
    this.actedSet.clear();

    if (this.state.turn > this.state.maxTurns) {
      this.state.phase = "draw";
      this.emitBattleEnd();
      return;
    }

    const alive = this.getAllCombatants().filter(c => !c.isDead);
    this.turnManager.calculateOrder(alive);
    this.state.turnOrder = this.turnManager.getOrder().map(c => c.id);

    this.tickAllEffects();

    if (this.checkBattleEnd()) return;

    this.processNextActor();
  }

  private tickAllEffects(): void {
    const all = this.getAllCombatants();
    for (const c of all) {
      if (c.isDead) continue;
      const entries = this.effectManager.tickEffects(c, this.state.turn);
      this.addLogEntries(entries);
    }
  }

  private processNextActor(): void {
    const next = this.turnManager.getNextActor(this.actedSet);
    if (!next) {
      this.eventDispatcher.emit("turn_end", {
        event: "turn_end",
        allies: this.state.allies,
        enemies: this.state.enemies,
        turn: this.state.turn,
      });
      this.nextTurn();
      return;
    }

    this.state.currentActorId = next.id;

    if (next.isPlayerControlled && !this.isAiControlled(next)) {
      this.state.phase = "player_action";
      this.state.pendingAction = null;
      return;
    }

    this.executeAiTurn(next);
  }

  private isAiControlled(_combatant: BattleCombatant): boolean {
    return false;
  }

  private executeAiTurn(combatant: BattleCombatant): void {
    const action = this.ai.decide(combatant, this.state, this);
    if (!action) {
      this.actedSet.add(combatant.id);
      this.processNextActor();
      return;
    }

    this.executeAction(combatant, action);
    this.actedSet.add(combatant.id);

    if (this.checkBattleEnd()) return;
    this.processNextActor();
  }

  submitPlayerAction(action: BattleAction): void {
    const s = this.state;
    const actor = this.findCombatant(s.currentActorId ?? "");
    if (!actor) return;

    this.executeAction(actor, action);
    this.actedSet.add(actor.id);

    if (!this.checkBattleEnd()) {
      this.processNextActor();
    }
  }

  private executeAction(actor: BattleCombatant, action: BattleAction): void {
    this.eventDispatcher.emit("action_start", {
      event: "action_start",
      actor,
      allies: actor.team === "ally" ? this.state.allies : this.state.enemies,
      enemies: actor.team === "ally" ? this.state.enemies : this.state.allies,
      turn: this.state.turn,
    });

    switch (action.type) {
      case "normal_attack":
        this.executeNormalAttack(actor, action.targetId);
        break;
      case "magic_attack":
        this.executeMagicAttack(actor, action.targetId);
        break;
      case "gongfa":
        this.executeGongfa(actor, action.gongfaIndex, action.targetId);
        break;
      case "elixir":
        this.executeElixir(actor, (action as { type: "elixir"; elixirIndex: number }).elixirIndex);
        break;
      case "flee":
        this.executeFlee(actor);
        break;
    }

    this.tickSummons(actor);

    this.eventDispatcher.emit("action_end", {
      event: "action_end",
      actor,
      action,
      allies: actor.team === "ally" ? this.state.allies : this.state.enemies,
      enemies: actor.team === "ally" ? this.state.enemies : this.state.allies,
      turn: this.state.turn,
    });
  }

  private executeNormalAttack(actor: BattleCombatant, targetId: string): void {
    const target = this.findCombatant(targetId);
    if (!target || target.isDead) {
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "普通攻击", type: "miss", narrative: `${actor.displayName}的攻击落空了`, team: actor.team });
      return;
    }

    const patk = this.getEffectiveStat(actor, "patk");
    const rawDmg = formulas.calcNormalAttackRaw(patk);
    const critRate = this.getEffectiveStat(actor, "critRate");
    const isCrit = formulas.checkCrit(critRate);

    const result = this.damagePipeline.execute(
      { source: actor, target, rawDamage: rawDmg, damageType: "physical", isCrit },
      this.state.turn,
      this.state.allies,
      this.state.enemies,
    );

    if (result.dodged) {
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "普通攻击", targetName: target.displayName, type: "miss", narrative: `${target.displayName}闪避了${actor.displayName}的攻击`, team: actor.team });
    } else {
      const critText = isCrit ? "，暴击！" : "";
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "普通攻击", targetName: target.displayName, type: isCrit ? "crit" : "damage", value: result.hpLost, narrative: `${actor.displayName}对${target.displayName}造成${result.hpLost}点物理伤害${critText}`, team: actor.team });
      if (result.killed) {
        this.addLog({ turn: this.state.turn, actorName: target.displayName, action: "阵亡", type: "death", narrative: `${target.displayName}被击败了！`, team: target.team });
      }
    }
  }

  private executeMagicAttack(actor: BattleCombatant, targetId: string): void {
    const target = this.findCombatant(targetId);
    if (!target || target.isDead) {
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "法术攻击", type: "miss", narrative: `${actor.displayName}的法术攻击落空了`, team: actor.team });
      return;
    }

    const matk = this.getEffectiveStat(actor, "matk");
    const rawDmg = formulas.calcMagicAttackRaw(matk);
    const critRate = this.getEffectiveStat(actor, "critRate");
    const isCrit = formulas.checkCrit(critRate);
    const mpCost = Math.round(actor.maxMp * 0.05);
    const actualMp = this.applyMpChange(actor, -mpCost);

    if (actualMp >= 0 && mpCost > 0) {
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "消耗法力", type: "info", value: mpCost, narrative: `${actor.displayName}消耗${mpCost}点法力`, team: actor.team });
    }

    const result = this.damagePipeline.execute(
      { source: actor, target, rawDamage: rawDmg, damageType: "magical", isCrit },
      this.state.turn,
      this.state.allies,
      this.state.enemies,
    );

    if (result.dodged) {
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "法术攻击", targetName: target.displayName, type: "miss", narrative: `${target.displayName}闪避了${actor.displayName}的法术`, team: actor.team });
    } else {
      const critText = isCrit ? "，暴击！" : "";
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "法术攻击", targetName: target.displayName, type: isCrit ? "crit" : "damage", value: result.hpLost, narrative: `${actor.displayName}对${target.displayName}造成${result.hpLost}点法术伤害${critText}`, team: actor.team });
      if (result.killed) {
        this.addLog({ turn: this.state.turn, actorName: target.displayName, action: "阵亡", type: "death", narrative: `${target.displayName}被击败了！`, team: target.team });
      }
    }
  }

  private executeGongfa(actor: BattleCombatant, gongfaIndex: number, targetId: string): void {
    const gf = actor.gongfaSlots[gongfaIndex];
    if (!gf || !gf.function) {
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "功法", type: "info", narrative: `${actor.displayName}尝试使用功法但失败了`, team: actor.team });
      return;
    }

    if (actor.cooldowns[gongfaIndex] > 0) {
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "功法冷却中", type: "info", narrative: `${gf.name}正在冷却中（剩余${actor.cooldowns[gongfaIndex]}回合）`, team: actor.team });
      return;
    }

    const mpCost = gf.function.mpCost ?? 0;
    if (mpCost > 0) {
      const actualMp = this.applyMpChange(actor, -mpCost);
      if (actor.currentMp < 0) {
        actor.currentMp = 0;
      }
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "消耗法力", type: "info", value: mpCost, narrative: `${actor.displayName}消耗${mpCost}点法力`, team: actor.team });
    }

    const target = this.findCombatant(targetId);
    const ctx: ActionContext = {
      actor,
      action: { type: "gongfa", gongfaIndex, targetId },
      allies: actor.team === "ally" ? this.state.allies : this.state.enemies,
      enemies: actor.team === "ally" ? this.state.enemies : this.state.allies,
      turn: this.state.turn,
      target,
      gongfaGrade: gf.grade,
      gongfaSystem: gf.system as GongfaSystem | undefined,
    };

    const entries = this.mechanicRegistry.executeComponents(gf.function.components, ctx, this);
    this.addLogEntries(entries);

    const cooldown = gf.function.cooldown ?? 0;
    if (cooldown > 0) {
      actor.cooldowns[gongfaIndex] = cooldown;
    }
  }

  private executeElixir(actor: BattleCombatant, elixirIndex: number): void {
    const elixir = actor.availableElixirs[elixirIndex];
    if (!elixir || elixir.count <= 0) return;

    elixir.count--;

    const healAmount = elixir.effects.value ?? 0;

    if (elixir.effectType === "恢复血量") {
      const healed = this.applyHeal(actor, healAmount);
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "使用丹药", targetName: actor.displayName, type: "heal", value: healed, narrative: `${actor.displayName}使用${elixir.name}，恢复${healed}点生命`, team: actor.team });
    } else if (elixir.effectType === "恢复法力") {
      const restored = this.applyMpChange(actor, healAmount);
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "使用丹药", targetName: actor.displayName, type: "heal", value: restored, narrative: `${actor.displayName}使用${elixir.name}，恢复${restored}点法力`, team: actor.team });
    } else {
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "使用丹药", targetName: actor.displayName, type: "info", narrative: `${actor.displayName}使用了${elixir.name}`, team: actor.team });
    }
  }

  private executeFlee(actor: BattleCombatant): void {
    const fleeChance = actor.isProtagonist ? 0.5 : 0.3;
    if (Math.random() < fleeChance) {
      this.state.phase = "fled";
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "逃跑", type: "flee_success", narrative: `${actor.displayName}成功逃离了战斗！`, team: actor.team });
      this.emitBattleEnd();
    } else {
      this.addLog({ turn: this.state.turn, actorName: actor.displayName, action: "逃跑失败", type: "flee_fail", narrative: `${actor.displayName}逃跑失败！`, team: actor.team });
    }
  }

  private tickSummons(actor: BattleCombatant): void {
    for (let i = actor.summons.length - 1; i >= 0; i--) {
      const summon = actor.summons[i];
      summon.remainingTurns--;
      if (summon.remainingTurns <= 0) {
        actor.summons.splice(i, 1);
        continue;
      }

      const enemies = actor.team === "ally" ? this.state.enemies : this.state.allies;
      const aliveEnemies = enemies.filter(e => !e.isDead);
      if (aliveEnemies.length === 0) continue;

      let target: BattleCombatant;
      if (summon.targetStrategy === "lowest_hp") {
        target = aliveEnemies.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
      } else {
        target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      }

      const rawDmg = summon.damagePerTurn;
      const result = this.damagePipeline.execute(
        { source: actor, target, rawDamage: rawDmg, damageType: "physical", isCrit: false },
        this.state.turn,
        this.state.allies,
        this.state.enemies,
      );

      this.addLog({ turn: this.state.turn, actorName: summon.name, action: "飞剑攻击", targetName: target.displayName, type: "damage", value: result.hpLost, narrative: `${summon.name}对${target.displayName}造成${result.hpLost}点伤害`, team: actor.team });
    }
  }

  private checkBattleEnd(): boolean {
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
    if (this.state.phase === "fled") {
      return true;
    }

    return false;
  }

  private emitBattleEnd(): void {
    this.eventDispatcher.emit("battle_end", {
      event: "battle_end",
      allies: this.state.allies,
      enemies: this.state.enemies,
      turn: this.state.turn,
    });
  }

  getPlayerActionOptions(): {
    canNormalAttack: boolean;
    canMagicAttack: boolean;
    gongfaItems: GongfaActionItem[];
    elixirItems: ElixirActionItem[];
    canFlee: boolean;
  } {
    const s = this.state;
    const actor = this.findCombatant(s.currentActorId ?? "");
    if (!actor || actor.isDead) {
      return { canNormalAttack: false, canMagicAttack: false, gongfaItems: [], elixirItems: [], canFlee: false };
    }

    const canAct = this.effectManager.canAct(actor);
    if (!canAct.canAct) {
      return { canNormalAttack: false, canMagicAttack: false, gongfaItems: [], elixirItems: [], canFlee: false };
    }

    const canUseSkills = this.effectManager.canUseSkills(actor);

    const gongfaItems: GongfaActionItem[] = [];
    if (canUseSkills) {
      for (let i = 0; i < actor.gongfaSlots.length; i++) {
        const gf = actor.gongfaSlots[i];
        if (!gf || !gf.function) continue;
        if (actor.cooldowns[i] > 0) continue;
        if ((gf.function.mpCost ?? 0) > actor.currentMp) continue;

        const hasOffensive = gf.function.components.some(
          c => c.mechanic?.startsWith("dmg_") || c.mechanic?.startsWith("debuff_") || c.mechanic?.startsWith("cc_"),
        );

        gongfaItems.push({
          gongfaIndex: i,
          name: gf.name,
          mpCost: gf.function.mpCost ?? 0,
          needTarget: hasOffensive,
          targetTeam: hasOffensive ? "enemy" : "ally",
          description: gf.function.components.map(c => c.desc ?? "").join("；"),
          cooldown: actor.cooldowns[i],
        });
      }
    }

    const elixirItems: ElixirActionItem[] = [];
    for (let i = 0; i < actor.availableElixirs.length; i++) {
      const el = actor.availableElixirs[i];
      if (!el || el.count <= 0) continue;
      elixirItems.push({
        elixirIndex: i,
        name: el.name,
        effectType: el.effectType,
        count: el.count,
        description: el.desc ?? "",
      });
    }

    return {
      canNormalAttack: true,
      canMagicAttack: actor.currentMp >= Math.round(actor.maxMp * 0.05),
      gongfaItems,
      elixirItems,
      canFlee: true,
    };
  }

  getEffectiveStat(combatant: BattleCombatant, stat: keyof PlayerBaseStats): number {
    return this.effectManager.getEffectiveStat(combatant, stat);
  }

  addLog(entry: BattleLogEntry): void {
    this.state.log.push(entry);
  }

  addLogEntries(entries: BattleLogEntry[]): void {
    this.state.log.push(...entries);
  }

  findCombatant(id: string): BattleCombatant | undefined {
    return this.getAllCombatants().find(c => c.id === id);
  }

  getAllCombatants(): BattleCombatant[] {
    return [...this.state.allies, ...this.state.enemies];
  }

  applyMpChange(target: BattleCombatant, delta: number): number {
    target.currentMp = Math.max(0, Math.min(target.maxMp, target.currentMp + delta));
    return target.currentMp;
  }

  applyHeal(target: BattleCombatant, rawHeal: number): number {
    const deficit = target.maxHp - target.currentHp;
    const healed = Math.min(deficit, rawHeal);
    target.currentHp += healed;

    this.eventDispatcher.emit("heal", {
      event: "heal",
      target,
      allies: target.team === "ally" ? this.state.allies : this.state.enemies,
      enemies: target.team === "ally" ? this.state.enemies : this.state.allies,
      turn: this.state.turn,
    });

    return healed;
  }

  tickCooldowns(combatant: BattleCombatant): void {
    for (let i = 0; i < combatant.cooldowns.length; i++) {
      if (combatant.cooldowns[i] > 0) {
        combatant.cooldowns[i]--;
      }
    }
  }
}
