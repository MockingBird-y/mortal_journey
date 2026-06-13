import type {
  SkillEffect,
  SummonEffectPayload,
  BattleCombatant,
  BattleLogEntry,
  BattleEffect,
  BattleEngineLike,
  ActionContext,
  DamageType,
  ModifierType,
  CcType,
  StatusType,
  SummonTrigger,
} from "./types";
import { generateId } from "./formulas";
import { GAUGE_MAX, NORMAL_ATTACK_COST } from "./constants";

function log(
  turn: number, actorName: string, action: string, type: BattleLogEntry["type"],
  narrative: string, team?: "ally" | "enemy", targetName?: string, value?: number,
): BattleLogEntry {
  return { turn, actorName, action, type, narrative, team, targetName, value };
}

export class EffectHandler {

  executeEffects(
    effects: readonly SkillEffect[],
    ctx: ActionContext,
    engine: BattleEngineLike,
  ): BattleLogEntry[] {
    const entries: BattleLogEntry[] = [];
    for (const eff of effects) {
      entries.push(...this.executeOne(eff, ctx, engine));
    }
    return entries;
  }

  executeSummonEffect(
    payload: SummonEffectPayload,
    source: BattleCombatant,
    stacks: number,
    actionCount: number,
    allies: BattleCombatant[],
    enemies: BattleCombatant[],
    engine: BattleEngineLike,
  ): BattleLogEntry[] {
    const entries: BattleLogEntry[] = [];
    for (let s = 0; s < stacks; s++) {
      switch (payload.type) {
        case "dealDamage": {
          const targets = enemies.filter(e => !e.isDead);
          if (targets.length === 0) break;
          const target = targets[Math.floor(Math.random() * targets.length)];
          const result = engine.damagePipeline.execute(
            { source, target, rawDamage: payload.value, damageType: payload.damageType, isCrit: false },
            actionCount, allies, enemies,
          );
          entries.push(log(actionCount, source.name, "召唤物攻击", result.hpLost > 0 ? "damage" : "miss",
            `召唤物对${target.name}造成${result.hpLost}点伤害`, source.team, target.name, result.hpLost));
          if (result.killed) {
            entries.push(log(actionCount, target.name, "阵亡", "death", `${target.name}倒下了！`, target.team));
          }
          break;
        }
        case "heal": {
          const deficit = source.stats.maxHp - source.hp;
          const healed = Math.min(deficit, payload.value);
          if (healed > 0) {
            source.hp += healed;
            entries.push(log(actionCount, source.name, "召唤物治疗", "heal",
              `召唤物为${source.name}恢复${healed}点生命`, source.team, source.name, healed));
          }
          break;
        }
        case "healMp": {
          const deficit = source.stats.maxMp - source.mp;
          const restored = Math.min(deficit, payload.value);
          if (restored > 0) {
            source.mp += restored;
            entries.push(log(actionCount, source.name, "召唤物恢复法力", "heal",
              `召唤物为${source.name}恢复${restored}点法力`, source.team, source.name, restored));
          }
          break;
        }
        case "applyModifier": {
          engine.effectManager.addEffect(source, {
            id: generateId(), name: "召唤物增益", sourceId: source.id,
            category: "modifier", remainingDuration: payload.duration ?? 2,
            stacks: 1, maxStacks: 10,
            modifierType: payload.modifierType, modifierValue: payload.value,
          });
          entries.push(log(actionCount, source.name, "召唤物增益", "buff",
            `${source.name}获得召唤物增益效果`, source.team));
          break;
        }
        case "applyStatus": {
          const targets = enemies.filter(e => !e.isDead);
          if (targets.length === 0) break;
          const target = targets[Math.floor(Math.random() * targets.length)];
          engine.effectManager.addEffect(target, {
            id: generateId(), name: `召唤物${payload.statusType}`, sourceId: source.id,
            category: "dot", remainingDuration: payload.duration ?? 3,
            stacks: 1, maxStacks: payload.maxStacks ?? 5,
            tickValue: payload.tickValue, tickIsPercent: payload.isPercent,
            tickResource: "hp", statusType: payload.statusType,
          });
          entries.push(log(actionCount, source.name, `召唤物施加${payload.statusType}`, "debuff",
            `召唤物对${target.name}施加了${payload.statusType}`, source.team, target.name));
          break;
        }
      }
    }
    return entries;
  }

  private executeOne(eff: SkillEffect, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const t = ctx.turn;
    switch (eff.type) {
      case "dealDamage": return this.doDamage(eff.damageType, eff.value, ctx, engine);
      case "dealDamageExecute": return this.doDamageExecute(eff, ctx, engine);
      case "dealDamagePierce": return this.doDamagePierce(eff.value, ctx, engine);
      case "heal": return this.doHeal(eff.value, ctx, engine);
      case "lifesteal": return this.doLifesteal(eff, ctx, engine);
      case "applyModifier": return this.doApplyModifier(eff, ctx, engine);
      case "applyCc": return this.doApplyCc(eff, ctx, engine);
      case "applyStatus": return this.doApplyStatus(eff, ctx, engine);
      case "summon": return this.doSummon(eff, ctx, engine);
      case "cleanse": return this.doCleanse(ctx, engine);
      case "dispel": return this.doDispel(ctx, engine);
      case "revive": return this.doRevive(eff.hpPercent, ctx, engine);
      case "deathWard": return this.doDeathWard(eff.duration, ctx, engine);
      case "extraAction": return this.doExtraAction(eff.chance, ctx, engine);
      case "counter": return this.doCounter(eff.damage, eff.duration, ctx, engine);
      case "reflect": return this.doReflect(eff.percent, eff.duration, ctx, engine);
      case "damageShare": return this.doDamageShare(eff.percent, eff.duration, ctx, engine);
      case "gaugeManipulate": return this.doGaugeManipulate(eff.value, ctx);
      case "shield": return this.doShield(eff.value, ctx, engine);
      case "stealth": return this.doStealth(eff.duration, ctx, engine);
    }
  }

  private doDamage(damageType: DamageType, value: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    const result = engine.damagePipeline.execute(
      { source: ctx.actor, target: ctx.target, rawDamage: value, damageType, isCrit: false },
      ctx.turn, ctx.allies, ctx.enemies,
    );
    const entries: BattleLogEntry[] = [];
    if (result.dodged) {
      entries.push(log(ctx.turn, ctx.actor.name, "攻击", "miss", `${ctx.target.name}闪避了${ctx.actor.name}的攻击`, ctx.actor.team, ctx.target.name));
    } else {
      const critText = result.finalDamage > value ? "，暴击！" : "";
      entries.push(log(ctx.turn, ctx.actor.name, "攻击", result.finalDamage > value ? "crit" : "damage",
        `${ctx.actor.name}对${ctx.target.name}造成${result.hpLost}点伤害${critText}`, ctx.actor.team, ctx.target.name, result.hpLost));
      if (result.killed) {
        entries.push(log(ctx.turn, ctx.target.name, "阵亡", "death", `${ctx.target.name}倒下了！`, ctx.target.team));
      }
    }
    this.addSecondaryLogs(result, ctx, entries);
    return entries;
  }

  private doDamageExecute(eff: SkillEffect & { type: "dealDamageExecute" }, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    let value = eff.value;
    const hpRatio = ctx.target.hp / ctx.target.stats.maxHp;
    let executed = false;
    if (hpRatio < eff.threshold) {
      value = Math.round(value * (1 + eff.bonusPercent / 100));
      executed = true;
    }
    const result = engine.damagePipeline.execute(
      { source: ctx.actor, target: ctx.target, rawDamage: value, damageType: eff.damageType, isCrit: false },
      ctx.turn, ctx.allies, ctx.enemies,
    );
    const entries: BattleLogEntry[] = [];
    entries.push(log(ctx.turn, ctx.actor.name, "斩杀攻击", "damage",
      `${ctx.actor.name}对${ctx.target.name}发动斩杀，造成${result.hpLost}点伤害${executed ? "（目标低血量，伤害提升！）" : ""}`,
      ctx.actor.team, ctx.target.name, result.hpLost));
    if (result.killed) {
      entries.push(log(ctx.turn, ctx.target.name, "阵亡", "death", `${ctx.target.name}倒下了！`, ctx.target.team));
    }
    this.addSecondaryLogs(result, ctx, entries);
    return entries;
  }

  private doDamagePierce(value: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    const result = engine.damagePipeline.execute(
      { source: ctx.actor, target: ctx.target, rawDamage: value, damageType: "true", isCrit: false },
      ctx.turn, ctx.allies, ctx.enemies,
    );
    const entries: BattleLogEntry[] = [];
    entries.push(log(ctx.turn, ctx.actor.name, "穿透攻击", "damage",
      `${ctx.actor.name}对${ctx.target.name}造成${result.hpLost}点穿透伤害`, ctx.actor.team, ctx.target.name, result.hpLost));
    if (result.killed) {
      entries.push(log(ctx.turn, ctx.target.name, "阵亡", "death", `${ctx.target.name}倒下了！`, ctx.target.team));
    }
    this.addSecondaryLogs(result, ctx, entries);
    return entries;
  }

  private doHeal(value: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const target = ctx.target ?? ctx.actor;
    const healMult = 1 + engine.effectManager.getModifierTotal(target, "healReceived") / 100;
    const healed = engine.applyHeal(target, Math.round(value * healMult));
    return [log(ctx.turn, ctx.actor.name, "治疗", "heal",
      `${ctx.actor.name}为${target.name}恢复${healed}点生命`, ctx.actor.team, target.name, healed)];
  }

  private doLifesteal(eff: SkillEffect & { type: "lifesteal" }, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target || ctx.target.isDead) return [];
    const entries: BattleLogEntry[] = [];
    const dmgValue = Math.max(1, Math.round(ctx.actor.stats.physAttack * eff.damagePercent / 100));
    const result = engine.damagePipeline.execute(
      { source: ctx.actor, target: ctx.target, rawDamage: dmgValue, damageType: eff.damageType, isCrit: false },
      ctx.turn, ctx.allies, ctx.enemies,
    );
    entries.push(log(ctx.turn, ctx.actor.name, "生命偷取", "damage",
      `${ctx.actor.name}吸取${ctx.target.name}${result.hpLost}点生命`, ctx.actor.team, ctx.target.name, result.hpLost));
    const healed = engine.applyHeal(ctx.actor, result.hpLost);
    if (healed > 0) {
      entries.push(log(ctx.turn, ctx.actor.name, "吸血恢复", "heal",
        `${ctx.actor.name}恢复${healed}点生命`, ctx.actor.team, ctx.actor.name, healed));
    }
    if (result.killed) {
      entries.push(log(ctx.turn, ctx.target.name, "阵亡", "death", `${ctx.target.name}倒下了！`, ctx.target.team));
    }
    this.addSecondaryLogs(result, ctx, entries);
    return entries;
  }

  private doApplyModifier(eff: SkillEffect & { type: "applyModifier" }, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const target = eff.targetSelf ? ctx.actor : (ctx.target ?? ctx.actor);
    const isPositive = eff.value > 0;
    engine.effectManager.addEffect(target, {
      id: generateId(), name: `${eff.modifierType}效果`, sourceId: ctx.actor.id,
      category: "modifier", remainingDuration: eff.duration,
      stacks: 1, maxStacks: eff.maxStacks,
      modifierType: eff.modifierType, modifierValue: eff.value,
    });
    const pctText = `${Math.abs(eff.value)}%`;
    return [log(ctx.turn, ctx.actor.name, isPositive ? "增益" : "减益", isPositive ? "buff" : "debuff",
      `${ctx.actor.name}对${target.name}施加${isPositive ? "增益" : "减益"}：${eff.modifierType} ${pctText}`,
      ctx.actor.team, target.name)];
  }

  private doApplyCc(eff: SkillEffect & { type: "applyCc" }, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const hit = Math.random() < eff.chance;
    if (!hit) {
      return [log(ctx.turn, ctx.actor.name, eff.ccType, "info",
        `${ctx.actor.name}试图对${ctx.target.name}施加${eff.ccType}，但被抵抗了`, ctx.actor.team, ctx.target.name)];
    }

    if (eff.ccType === "freeze") {
      ctx.target.actionGauge = 0;
      return [log(ctx.turn, ctx.actor.name, "冰冻", "cc",
        `${ctx.actor.name}冰冻了${ctx.target.name}，行动条清零！`, ctx.actor.team, ctx.target.name)];
    }

    engine.effectManager.addEffect(ctx.target, {
      id: generateId(), name: eff.ccType, sourceId: ctx.actor.id,
      category: "cc", remainingDuration: eff.duration,
      stacks: 1, maxStacks: 1,
      ccType: eff.ccType,
    });

    return [log(ctx.turn, ctx.actor.name, eff.ccType, "cc",
      `${ctx.actor.name}对${ctx.target.name}施加了${eff.ccType}`, ctx.actor.team, ctx.target.name)];
  }

  private doApplyStatus(eff: SkillEffect & { type: "applyStatus" }, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const isDoT = eff.statusType === "poison" || eff.statusType === "burn" || eff.statusType === "bleed" || eff.statusType === "mpDrain";
    engine.effectManager.addEffect(ctx.target, {
      id: generateId(), name: eff.statusType, sourceId: ctx.actor.id,
      category: isDoT ? "dot" : "hot", remainingDuration: eff.duration,
      stacks: 1, maxStacks: eff.maxStacks,
      tickValue: eff.tickValue, tickIsPercent: eff.isPercent,
      tickResource: eff.statusType === "mpDrain" ? "mp" : "hp",
      statusType: eff.statusType,
    });
    return [log(ctx.turn, ctx.actor.name, `施加${eff.statusType}`, isDoT ? "debuff" : "buff",
      `${ctx.actor.name}对${ctx.target.name}施加了${eff.statusType}`, ctx.actor.team, ctx.target.name)];
  }

  private doSummon(eff: SkillEffect & { type: "summon" }, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(), name: eff.name, sourceId: ctx.actor.id,
      category: "summon", remainingDuration: eff.duration,
      stacks: 1, maxStacks: Infinity,
      summonTrigger: eff.trigger, summonEffect: eff.effect,
    });
    return [log(ctx.turn, ctx.actor.name, "召唤", "summon",
      `${ctx.actor.name}召唤了${eff.name}`, ctx.actor.team)];
  }

  private doCleanse(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const target = ctx.target ?? ctx.actor;
    const removed = engine.effectManager.removeEffects(target, e => e.category === "cc" || e.category === "dot");
    if (removed > 0) {
      return [log(ctx.turn, ctx.actor.name, "净化", "buff",
        `${ctx.actor.name}净化了${target.name}的${removed}个负面效果`, ctx.actor.team, target.name)];
    }
    return [log(ctx.turn, ctx.actor.name, "净化", "info",
      `${ctx.actor.name}尝试净化，但没有可移除的效果`, ctx.actor.team)];
  }

  private doDispel(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (!ctx.target) return [];
    const removed = engine.effectManager.removeEffects(ctx.target, e => e.category === "modifier" || e.category === "hot");
    if (removed > 0) {
      return [log(ctx.turn, ctx.actor.name, "驱散", "debuff",
        `${ctx.actor.name}驱散了${ctx.target.name}的${removed}个增益效果`, ctx.actor.team, ctx.target.name)];
    }
    return [log(ctx.turn, ctx.actor.name, "驱散", "info",
      `${ctx.actor.name}尝试驱散，但没有可移除的效果`, ctx.actor.team)];
  }

  private doRevive(hpPercent: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const target = ctx.target ?? ctx.actor;
    if (!target.isDead) {
      return [log(ctx.turn, ctx.actor.name, "复活", "info",
        `${target.name}未阵亡，无需复活`, ctx.actor.team)];
    }
    target.isDead = false;
    target.hp = Math.min(target.stats.maxHp, Math.round(target.stats.maxHp * hpPercent / 100));
    return [log(ctx.turn, ctx.actor.name, "复活", "heal",
      `${target.name}被复活，恢复${target.hp}点生命`, ctx.actor.team, target.name, target.hp)];
  }

  private doDeathWard(duration: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(), name: "免死护盾", sourceId: ctx.actor.id,
      category: "special", remainingDuration: duration,
      stacks: 1, maxStacks: 1,
      specialType: "deathWard",
    });
    return [log(ctx.turn, ctx.actor.name, "免死护盾", "buff",
      `${ctx.actor.name}获得免死护盾`, ctx.actor.team)];
  }

  private doExtraAction(chance: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    if (Math.random() < chance) {
      ctx.actor.actionGauge += GAUGE_MAX - NORMAL_ATTACK_COST;
      return [log(ctx.turn, ctx.actor.name, "额外行动", "buff",
        `${ctx.actor.name}获得额外行动！`, ctx.actor.team)];
    }
    return [log(ctx.turn, ctx.actor.name, "额外行动", "info",
      `${ctx.actor.name}未能触发额外行动`, ctx.actor.team)];
  }

  private doCounter(damage: number, duration: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(), name: "反击", sourceId: ctx.actor.id,
      category: "special", remainingDuration: duration,
      stacks: 1, maxStacks: 1,
      specialType: "counter", specialValue: damage,
    });
    return [log(ctx.turn, ctx.actor.name, "反击", "buff",
      `${ctx.actor.name}进入反击姿态`, ctx.actor.team)];
  }

  private doReflect(percent: number, duration: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(), name: "反弹", sourceId: ctx.actor.id,
      category: "special", remainingDuration: duration,
      stacks: 1, maxStacks: 1,
      specialType: "reflect", specialValue: percent,
    });
    return [log(ctx.turn, ctx.actor.name, "反弹", "buff",
      `${ctx.actor.name}开启伤害反弹${percent}%`, ctx.actor.team)];
  }

  private doDamageShare(percent: number, duration: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(), name: "伤害分摊", sourceId: ctx.actor.id,
      category: "special", remainingDuration: duration,
      stacks: 1, maxStacks: 1,
      specialType: "damageShare", specialValue: percent,
    });
    return [log(ctx.turn, ctx.actor.name, "伤害分摊", "buff",
      `${ctx.actor.name}开启伤害分摊${percent}%`, ctx.actor.team)];
  }

  private doGaugeManipulate(value: number, ctx: ActionContext): BattleLogEntry[] {
    if (!ctx.target) return [];
    ctx.target.actionGauge = Math.max(0, Math.min(GAUGE_MAX * 2, ctx.target.actionGauge + value));
    const action = value > 0 ? "行动条增加" : "行动条减少";
    return [log(ctx.turn, ctx.actor.name, action, "gauge",
      `${ctx.actor.name}对${ctx.target.name}的${action}了${Math.abs(value)}点`, ctx.actor.team, ctx.target.name)];
  }

  private doShield(value: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    const target = ctx.target ?? ctx.actor;
    target.shield += value;
    return [log(ctx.turn, ctx.actor.name, "护盾", "shield",
      `${ctx.actor.name}为${target.name}增加${value}点护盾`, ctx.actor.team, target.name, value)];
  }

  private doStealth(duration: number, ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[] {
    engine.effectManager.addEffect(ctx.actor, {
      id: generateId(), name: "隐匿", sourceId: ctx.actor.id,
      category: "special", remainingDuration: duration,
      stacks: 1, maxStacks: 1,
      specialType: "stealth",
    });
    return [log(ctx.turn, ctx.actor.name, "隐匿", "buff",
      `${ctx.actor.name}进入隐匿状态`, ctx.actor.team)];
  }

  private addSecondaryLogs(result: import("./types").DamageResult, ctx: ActionContext, entries: BattleLogEntry[]): void {
    if (result.reflectHpLost > 0) {
      entries.push(log(ctx.turn, ctx.target!.name, "反伤", "damage",
        `${ctx.target!.name}的反伤对${ctx.actor.name}造成${result.reflectHpLost}点伤害`, ctx.target!.team, ctx.actor.name, result.reflectHpLost));
      if (result.reflectKilled) {
        entries.push(log(ctx.turn, ctx.actor.name, "阵亡", "death", `${ctx.actor.name}被反伤击败了！`, ctx.actor.team));
      }
    }
    if (result.counterHpLost > 0) {
      entries.push(log(ctx.turn, ctx.target!.name, "反击", "damage",
        `${ctx.target!.name}的反击对${ctx.actor.name}造成${result.counterHpLost}点伤害`, ctx.target!.team, ctx.actor.name, result.counterHpLost));
      if (result.counterKilled) {
        entries.push(log(ctx.turn, ctx.actor.name, "阵亡", "death", `${ctx.actor.name}被反击击败了！`, ctx.actor.team));
      }
    }
    for (const sd of result.sharedDamages) {
      entries.push(log(ctx.turn, ctx.actor.name, "分摊伤害", "damage",
        `${sd.targetName}分摊了${sd.hpLost}点伤害`, ctx.target!.team, sd.targetName, sd.hpLost));
      if (sd.killed) {
        entries.push(log(ctx.turn, sd.targetName, "阵亡", "death", `${sd.targetName}被分摊伤害击败了！`, ctx.target!.team));
      }
    }
  }
}
