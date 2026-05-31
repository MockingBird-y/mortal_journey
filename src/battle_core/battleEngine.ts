import type {
  BattleCombatant,
  ActiveStatusEffect,
  BattleAction,
  BattleLogEntry,
  BattleLogType,
  PassiveTrigger,
  BattleSummon,
  BattleState,
} from "./battleTypes";

import {
  MECHANIC_META,
  GRADE_FLAT_POWER,
  GRADE_SCALING_POWER,
  SYSTEM_POWER_MULT,
  SYSTEM_DAMAGE_STAT,
  resolveMechanicRawValue,
} from "../role_core/types/combatMechanics";

import type {
  MechanicId,
  MechanicCategory,
  EffectTrigger,
  StatusId,
} from "../role_core/types/combatMechanics";

import type { ItemGrade } from "../role_core/types/itemInfo";
import type { GongfaSystem } from "../role_core/types/gongfa";
import { GRADE_INDEX } from "../role_core/types/gameConstants";
import type { PlayerBaseStats } from "../role_core/types/playInfo";

interface PassiveTriggerResult {
  trigger: PassiveTrigger;
  owner: BattleCombatant;
  value: number;
}

const REALM_SPELL_MP: Readonly<Record<string, number>> = {
  "练气": 10,
  "筑基": 20,
  "结丹": 40,
  "元婴": 80,
  "化神": 150,
};

export function getSpellMpCost(realmMajor: string): number {
  return REALM_SPELL_MP[realmMajor] ?? 10;
}

export function generateCombatantId(team: "ally" | "enemy", index: number): string {
  return `${team}_${index}`;
}

export function findCombatantById(id: string, allies: BattleCombatant[], enemies: BattleCombatant[]): BattleCombatant | undefined {
  return allies.find(c => c.id === id) ?? enemies.find(c => c.id === id);
}

export function getAliveAllies(team: BattleCombatant[]): BattleCombatant[] {
  return team.filter(c => !c.isDead);
}

export function getAliveEnemies(team: BattleCombatant[]): BattleCombatant[] {
  return team.filter(c => !c.isDead);
}

export function getEffectiveStat(combatant: BattleCombatant, stat: keyof PlayerBaseStats): number {
  const base = combatant.stats[stat] ?? 0;
  const mod = getBuffModifier(combatant, stat);
  return Math.max(0, Math.round(base + mod));
}

export function getBuffModifier(combatant: BattleCombatant, stat: string): number {
  let total = 0;
  for (const eff of combatant.activeEffects) {
    if (eff.isPercent) {
      const pctValue = eff.value * eff.stacks;
      total += combatant.stats[stat as keyof PlayerBaseStats] * pctValue / 100;
    } else {
      total += eff.value * eff.stacks;
    }
  }
  return total;
}

export function calcNormalAttackDamage(
  attacker: BattleCombatant,
  defender: BattleCombatant,
): { damage: number; isCrit: boolean; isMiss: boolean } {
  const hitRate = getEffectiveStat(attacker, "hitRate");
  const dodgeRate = getEffectiveStat(defender, "dodgeRate");
  const isMiss = Math.random() * 100 >= (hitRate - dodgeRate);
  if (isMiss) return { damage: 0, isCrit: false, isMiss: true };

  const patk = getEffectiveStat(attacker, "patk");
  const pdef = getEffectiveStat(defender, "pdef");
  const critRate = getEffectiveStat(attacker, "critRate");
  const isCrit = Math.random() * 100 < critRate;
  const critDmg = getEffectiveStat(attacker, "critDmg") / 100;

  const base = Math.max(1, patk - pdef * 0.5);
  const damage = Math.round(base * (isCrit ? critDmg : 1));
  return { damage: Math.max(1, damage), isCrit, isMiss: false };
}

export function calcMagicAttackDamage(
  attacker: BattleCombatant,
  defender: BattleCombatant,
): { damage: number; isCrit: boolean } {
  const matk = getEffectiveStat(attacker, "matk");
  const mdef = getEffectiveStat(defender, "mdef");
  const critRate = getEffectiveStat(attacker, "critRate");
  const isCrit = Math.random() * 100 < critRate;
  const critDmg = getEffectiveStat(attacker, "critDmg") / 100;

  const base = Math.max(1, matk * 1.2 - mdef * 0.5);
  const damage = Math.round(base * (isCrit ? critDmg : 1));
  return { damage: Math.max(1, damage), isCrit };
}

export function calcGongfaEffectValue(
  mechanic: MechanicId,
  grade: ItemGrade,
  system: GongfaSystem | undefined,
  attacker: BattleCombatant,
): number {
  const meta = MECHANIC_META[mechanic];
  if (!meta) return 0;

  if (meta.noStatScaling) {
    return GRADE_SCALING_POWER[grade]?.[meta.scalingPowerKey] ?? 0;
  }

  const derivedStats = {
    patk: getEffectiveStat(attacker, "patk"),
    matk: getEffectiveStat(attacker, "matk"),
    pdef: getEffectiveStat(attacker, "pdef"),
    mdef: getEffectiveStat(attacker, "mdef"),
  };

  const primaryStat = attacker.stats.cultivationSpeed;

  return resolveMechanicRawValue(mechanic, grade, primaryStat, system, derivedStats);
}

export function applyDamage(
  target: BattleCombatant,
  rawDamage: number,
): { damageDealt: number; shieldAbsorbed: number; killed: boolean } {
  let remaining = rawDamage;
  let shieldAbsorbed = 0;

  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
    shieldAbsorbed = absorbed;
  }

  const hpLoss = Math.min(target.currentHp, remaining);
  target.currentHp -= hpLoss;

  const killed = target.currentHp <= 0;
  if (killed) {
    target.isDead = true;
    target.currentHp = 0;
  }

  return { damageDealt: shieldAbsorbed + hpLoss, shieldAbsorbed, killed };
}

export function applyHeal(
  target: BattleCombatant,
  rawHeal: number,
): { healed: number } {
  const deficit = target.maxHp - target.currentHp;
  const healed = Math.min(deficit, Math.max(0, rawHeal));
  target.currentHp += healed;
  return { healed };
}

export function applyMpChange(
  target: BattleCombatant,
  delta: number,
): { changed: number } {
  const before = target.currentMp;
  target.currentMp = Math.max(0, Math.min(target.maxMp, target.currentMp + delta));
  return { changed: target.currentMp - before };
}

export function addStatusEffect(
  target: BattleCombatant,
  effect: ActiveStatusEffect,
): void {
  const existing = target.activeEffects.find(
    e => e.name === effect.name && e.mechanic === effect.mechanic,
  );

  if (existing) {
    if (effect.category === "cc") {
      const idx = target.activeEffects.indexOf(existing);
      target.activeEffects[idx] = effect;
    } else if (effect.canStack) {
      existing.stacks += 1;
      existing.remainingTurns = Math.max(existing.remainingTurns, effect.remainingTurns);
    } else {
      existing.remainingTurns = Math.max(existing.remainingTurns, effect.remainingTurns);
      existing.value = Math.max(existing.value, effect.value);
    }
  } else {
    target.activeEffects.push(effect);
  }
}

const DOT_STATUS_DAMAGE: Readonly<Partial<Record<StatusId, { pctMaxHp?: number; pctCurrentMp?: number; baseTurns?: number }>>> = {
  poison: { pctMaxHp: 3 },
  burn: { pctMaxHp: 5, baseTurns: 2 },
  corrode: { pctCurrentMp: 5 },
};

export function tickStatusEffects(combatant: BattleCombatant, turn: number): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];
  const toRemove: number[] = [];

  for (let i = 0; i < combatant.activeEffects.length; i++) {
    const eff = combatant.activeEffects[i];

    if (eff.status && DOT_STATUS_DAMAGE[eff.status]) {
      const dotDef = DOT_STATUS_DAMAGE[eff.status]!;
      const stacks = eff.stacks || 1;

      if (dotDef.pctMaxHp) {
        const dmg = Math.round(combatant.maxHp * dotDef.pctMaxHp / 100 * stacks);
        const { damageDealt } = applyDamage(combatant, dmg);
        entries.push({
          turn,
          actorName: eff.name,
          action: "持续伤害",
          targetName: combatant.displayName,
          type: "dot",
          value: damageDealt,
          narrative: `${combatant.displayName}受到${eff.name}，损失${damageDealt}点生命`,
        });
      }

      if (dotDef.pctCurrentMp) {
        const mpLoss = Math.round(combatant.currentMp * dotDef.pctCurrentMp / 100 * stacks);
        applyMpChange(combatant, -mpLoss);
        entries.push({
          turn,
          actorName: eff.name,
          action: "法力侵蚀",
          targetName: combatant.displayName,
          type: "dot",
          value: mpLoss,
          narrative: `${combatant.displayName}受到${eff.name}，损失${mpLoss}点法力`,
        });
      }
    }

    eff.remainingTurns -= 1;
    if (eff.remainingTurns <= 0) {
      toRemove.push(i);
    }
  }

  for (let i = toRemove.length - 1; i >= 0; i--) {
    combatant.activeEffects.splice(toRemove[i], 1);
  }

  if (combatant.isDead) {
    entries.push({
      turn,
      actorName: combatant.displayName,
      action: "阵亡",
      type: "death",
      narrative: `${combatant.displayName}倒下了！`,
    });
  }

  return entries;
}

export function isActionPrevented(
  combatant: BattleCombatant,
): { prevented: boolean; reason?: string } {
  const ccEffects = combatant.activeEffects.filter(e => e.category === "cc");

  for (const eff of ccEffects) {
    if (eff.mechanic === "cc_stun" || eff.mechanic === "cc_freeze") {
      return { prevented: true, reason: eff.mechanic === "cc_stun" ? "眩晕中" : "冻结中" };
    }
  }

  return { prevented: false };
}

export function isSilenced(combatant: BattleCombatant): boolean {
  return combatant.activeEffects.some(e => e.mechanic === "cc_silence");
}

export function isFeared(combatant: BattleCombatant): boolean {
  return combatant.activeEffects.some(e => e.mechanic === "cc_fear");
}

export function isRooted(combatant: BattleCombatant): boolean {
  return combatant.activeEffects.some(e => e.mechanic === "cc_root");
}

export function checkPassiveTriggers(
  combatant: BattleCombatant,
  event: EffectTrigger,
  _context: {
    attacker?: BattleCombatant;
    target?: BattleCombatant;
    isCrit?: boolean;
    killed?: boolean;
  },
): PassiveTriggerResult[] {
  const results: PassiveTriggerResult[] = [];

  for (const pt of combatant.passiveTriggers) {
    if (pt.component.trigger !== event) continue;

    let value: number;
    if (pt.sourceType === "treasure") {
      const flatPower = GRADE_FLAT_POWER[pt.grade];
      const key = MECHANIC_META[pt.component.mechanic!]?.flatPowerKey ?? "flatDmg";
      value = flatPower?.[key as keyof typeof flatPower] ?? 0;
    } else {
      value = calcGongfaEffectValue(
        pt.component.mechanic!,
        pt.grade,
        pt.system,
        combatant,
      );
    }

    results.push({ trigger: pt, owner: combatant, value });
  }

  return results;
}

export function processSummons(
  combatant: BattleCombatant,
  enemies: BattleCombatant[],
  turn: number,
): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];
  const aliveEnemies = getAliveEnemies(enemies);
  if (aliveEnemies.length === 0) return entries;

  const toRemove: number[] = [];

  for (let i = 0; i < combatant.summons.length; i++) {
    const summon = combatant.summons[i];

    let target: BattleCombatant;
    if (summon.targetStrategy === "lowest_hp") {
      target = aliveEnemies.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
    } else {
      target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    }

    const { damageDealt, killed } = applyDamage(target, summon.damagePerTurn);
    entries.push({
      turn,
      actorName: summon.name,
      action: "自动攻击",
      targetName: target.displayName,
      type: "damage",
      value: damageDealt,
      narrative: `${summon.name}自动攻击${target.displayName}，造成${damageDealt}点伤害`,
    });

    if (killed) {
      entries.push({
        turn,
        actorName: target.displayName,
        action: "阵亡",
        type: "death",
        narrative: `${target.displayName}倒下了！`,
      });
    }

    summon.remainingTurns -= 1;
    if (summon.remainingTurns <= 0) {
      toRemove.push(i);
    }
  }

  for (let i = toRemove.length - 1; i >= 0; i--) {
    combatant.summons.splice(toRemove[i], 1);
  }

  return entries;
}

function buildLogEntry(
  turn: number,
  actorName: string,
  action: string,
  type: BattleLogType,
  narrative: string,
  targetName?: string,
  value?: number,
  extra?: string,
): BattleLogEntry {
  return { turn, actorName, action, targetName, type, narrative, value, extra };
}

export function resolveNormalAttack(
  attacker: BattleCombatant,
  defender: BattleCombatant,
  turn: number,
): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];

  if (isFeared(attacker)) {
    return [buildLogEntry(turn, attacker.displayName, "普通攻击(恐惧)", "info",
      `${attacker.displayName}陷入恐惧，无法控制行动`)];
  }

  const { damage, isCrit, isMiss } = calcNormalAttackDamage(attacker, defender);

  if (isMiss) {
    entries.push(buildLogEntry(turn, attacker.displayName, "普通攻击", "miss",
      `${attacker.displayName}攻击${defender.displayName}，但被闪避了！`,
      defender.displayName));
    return entries;
  }

  const { damageDealt, killed } = applyDamage(defender, damage);

  const critExtra = isCrit ? "暴击！" : undefined;
  entries.push(buildLogEntry(turn, attacker.displayName, "普通攻击", isCrit ? "crit" : "damage",
    `${attacker.displayName}攻击${defender.displayName}，造成${damageDealt}点伤害${isCrit ? "（暴击！）" : ""}`,
    defender.displayName, damageDealt, critExtra));

  const passiveResults = checkPassiveTriggers(attacker, "on_attack", { attacker, target: defender, isCrit });
  for (const pr of passiveResults) {
    entries.push(buildLogEntry(turn, pr.trigger.sourceName, pr.trigger.effectName, "info",
      `${pr.trigger.sourceName}的${pr.trigger.effectName}触发！`, undefined, undefined));
  }

  if (killed) {
    entries.push(buildLogEntry(turn, defender.displayName, "阵亡", "death",
      `${defender.displayName}倒下了！`));

    const killPassives = checkPassiveTriggers(attacker, "on_kill", { attacker, target: defender, killed: true });
    for (const pr of killPassives) {
      entries.push(buildLogEntry(turn, pr.trigger.sourceName, pr.trigger.effectName, "info",
        `${pr.trigger.sourceName}的${pr.trigger.effectName}因击杀触发！`, undefined, undefined));
    }
  }

  return entries;
}

export function resolveMagicAttack(
  attacker: BattleCombatant,
  defender: BattleCombatant,
  turn: number,
): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];
  const mpCost = getSpellMpCost(attacker.realm.major);
  applyMpChange(attacker, -mpCost);

  const { damage, isCrit } = calcMagicAttackDamage(attacker, defender);
  const { damageDealt, killed } = applyDamage(defender, damage);

  const critExtra = isCrit ? "暴击！" : undefined;
  entries.push(buildLogEntry(turn, attacker.displayName, "法术攻击", isCrit ? "crit" : "damage",
    `${attacker.displayName}施展法术攻击${defender.displayName}，造成${damageDealt}点伤害${isCrit ? "（暴击！）" : ""}`,
    defender.displayName, damageDealt, critExtra));

  if (killed) {
    entries.push(buildLogEntry(turn, defender.displayName, "阵亡", "death",
      `${defender.displayName}倒下了！`));
  }

  return entries;
}

export function resolveGongfaAction(
  actor: BattleCombatant,
  action: Extract<BattleAction, { type: "gongfa" }>,
  allies: BattleCombatant[],
  enemies: BattleCombatant[],
  turn: number,
): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];
  const gongfa = actor.gongfaSlots[action.gongfaIndex];
  if (!gongfa || !gongfa.function) return entries;

  const fn = gongfa.function;
  const mpCost = fn.mpCost ?? 0;
  applyMpChange(actor, -mpCost);

  entries.push(buildLogEntry(turn, actor.displayName, `${gongfa.name}·${fn.name}`, "info",
    `${actor.displayName}催动${gongfa.name}·${fn.name}！`));

  const allTargets = [...allies, ...enemies];
  const target = findCombatantById(action.targetId, allies, enemies);

  for (const component of fn.components) {
    if (!component.mechanic) continue;

    const meta = MECHANIC_META[component.mechanic];
    if (!meta) continue;

    const rawValue = calcGongfaEffectValue(component.mechanic, gongfa.grade, gongfa.system, actor);

    switch (meta.category) {
      case "damage":
      case "summon": {
        if (component.mechanic === "summon") {
          actor.summons.push({
            id: `${actor.id}_summon_${Date.now()}`,
            name: `${fn.name}·召唤`,
            ownerCombatantId: actor.id,
            damagePerTurn: Math.round(rawValue),
            remainingTurns: 3,
            targetStrategy: "random",
          });
          entries.push(buildLogEntry(turn, fn.name, "召唤", "summon",
            `${fn.name}召唤出灵体，每回合造成${Math.round(rawValue)}点伤害`));
        } else if (target && !target.isDead) {
          const defKey = gongfa.system && SYSTEM_DAMAGE_STAT[gongfa.system] === "matk" ? "mdef" : "pdef";
          const defValue = getEffectiveStat(target, defKey as keyof PlayerBaseStats);
          const finalDmg = Math.max(1, Math.round(rawValue - defValue * 0.3));
          const { damageDealt, killed } = applyDamage(target, finalDmg);
          entries.push(buildLogEntry(turn, actor.displayName, fn.name, "damage",
            `${actor.displayName}以${gongfa.name}对${target.displayName}造成${damageDealt}点伤害`,
            target.displayName, damageDealt));
          if (killed) {
            entries.push(buildLogEntry(turn, target.displayName, "阵亡", "death",
              `${target.displayName}倒下了！`));
          }
        }
        break;
      }
      case "heal": {
        if (component.mechanic === "heal_aoe" || component.mechanic === "heal_single") {
          const isAoe = component.mechanic === "heal_aoe";
          const healTargets = isAoe ? getAliveAllies(allies) : (target ? [target] : []);
          for (const ht of healTargets) {
            const { healed } = applyHeal(ht, Math.round(rawValue));
            entries.push(buildLogEntry(turn, actor.displayName, fn.name, "heal",
              `${actor.displayName}以${gongfa.name}为${ht.displayName}恢复${healed}点生命`,
              ht.displayName, healed));
          }
        } else if (component.mechanic === "heal_lifesteal" || component.mechanic === "heal_lifesteal_pct") {
          if (target && !target.isDead) {
            const dmgPct = component.mechanic === "heal_lifesteal_pct" ? 0.3 : 0.5;
            const dmgToTarget = Math.max(1, Math.round(rawValue * dmgPct));
            const { damageDealt, killed } = applyDamage(target, dmgToTarget);
            entries.push(buildLogEntry(turn, actor.displayName, fn.name, "damage",
              `${actor.displayName}以${gongfa.name}吸取${target.displayName}${damageDealt}点生命`,
              target.displayName, damageDealt));
            const { healed } = applyHeal(actor, damageDealt);
            if (healed > 0) {
              entries.push(buildLogEntry(turn, actor.displayName, fn.name, "heal",
                `${actor.displayName}恢复了${healed}点生命`, actor.displayName, healed));
            }
            if (killed) {
              entries.push(buildLogEntry(turn, target.displayName, "阵亡", "death",
                `${target.displayName}倒下了！`));
            }
          }
        }
        break;
      }
      case "buff": {
        const buffTargets = component.mechanic === "buff_shield"
          ? (target ? [target] : [actor])
          : [actor];
        for (const bt of buffTargets) {
          if (component.mechanic === "buff_shield") {
            const shieldAmt = Math.round(rawValue);
            bt.shield += shieldAmt;
            entries.push(buildLogEntry(turn, actor.displayName, fn.name, "shield",
              `${actor.displayName}以${gongfa.name}为${bt.displayName}增加${shieldAmt}点护盾`,
              bt.displayName, shieldAmt));
          } else {
            const pctValue = Math.round(rawValue * 100);
            const duration = 2 + Math.floor((GRADE_INDEX[gongfa.grade] ?? 0) / 2);
            addStatusEffect(bt, {
              id: `eff_${bt.id}_${Date.now()}`,
              name: meta.label,
              sourceCombatantId: actor.id,
              mechanic: component.mechanic,
              category: "buff",
              value: pctValue,
              isPercent: true,
              remainingTurns: duration,
              stacks: 1,
              canStack: false,
            });
            entries.push(buildLogEntry(turn, actor.displayName, fn.name, "buff",
              `${actor.displayName}以${gongfa.name}为${bt.displayName}施加${meta.label}${pctValue}%`,
              bt.displayName, pctValue));
          }
        }
        break;
      }
      case "debuff": {
        const debuffTargets = target ? [target] : [];
        for (const dt of debuffTargets) {
          const pctValue = Math.round(rawValue * 100);
          const duration = 2 + Math.floor((GRADE_INDEX[gongfa.grade] ?? 0) / 2);
          addStatusEffect(dt, {
            id: `eff_${dt.id}_${Date.now()}`,
            name: meta.label,
            sourceCombatantId: actor.id,
            mechanic: component.mechanic,
            category: "debuff",
            value: -pctValue,
            isPercent: true,
            remainingTurns: duration,
            stacks: 1,
            canStack: false,
          });
          entries.push(buildLogEntry(turn, actor.displayName, fn.name, "debuff",
            `${actor.displayName}以${gongfa.name}对${dt.displayName}施加${meta.label}${pctValue}%`,
            dt.displayName, pctValue));
        }
        break;
      }
      case "cc": {
        const ccTargets = target ? [target] : [];
        for (const ct of ccTargets) {
          const chance = rawValue;
          const hit = Math.random() < chance;
          if (hit) {
            const duration = 1 + Math.floor((GRADE_INDEX[gongfa.grade] ?? 0) / 3);
            addStatusEffect(ct, {
              id: `eff_${ct.id}_${Date.now()}`,
              name: meta.label,
              sourceCombatantId: actor.id,
              mechanic: component.mechanic,
              category: "cc",
              value: chance,
              isPercent: true,
              remainingTurns: duration,
              stacks: 1,
              canStack: false,
            });
            entries.push(buildLogEntry(turn, actor.displayName, fn.name, "cc",
              `${actor.displayName}以${gongfa.name}对${ct.displayName}施加${meta.label}！`,
              ct.displayName, undefined, meta.label));
          } else {
            entries.push(buildLogEntry(turn, actor.displayName, fn.name, "info",
              `${actor.displayName}以${gongfa.name}试图对${ct.displayName}施加${meta.label}，但被抵抗了`,
              ct.displayName));
          }
        }
        break;
      }
      case "utility": {
        if (component.mechanic === "extra_action") {
          const chance = rawValue;
          if (Math.random() < chance) {
            actor.actedThisTurn = false;
            entries.push(buildLogEntry(turn, actor.displayName, fn.name, "info",
              `${actor.displayName}以${gongfa.name}获得额外行动！`));
          }
        } else if (component.mechanic === "cleanse") {
          const ccEffects = actor.activeEffects.filter(e => e.category === "cc" || e.category === "debuff");
          if (ccEffects.length > 0) {
            for (const eff of ccEffects) {
              const idx = actor.activeEffects.indexOf(eff);
              if (idx >= 0) actor.activeEffects.splice(idx, 1);
            }
            entries.push(buildLogEntry(turn, actor.displayName, fn.name, "info",
              `${actor.displayName}以${gongfa.name}净化了${ccEffects.length}个负面效果`));
          }
        } else if (component.mechanic === "death_ward") {
          addStatusEffect(actor, {
            id: `eff_${actor.id}_ward_${Date.now()}`,
            name: "免死",
            sourceCombatantId: actor.id,
            mechanic: "death_ward",
            category: "buff",
            value: rawValue,
            isPercent: true,
            remainingTurns: 99,
            stacks: 1,
            canStack: false,
          });
          entries.push(buildLogEntry(turn, actor.displayName, fn.name, "buff",
            `${actor.displayName}以${gongfa.name}获得免死护盾`));
        } else if (component.mechanic === "reflect") {
          addStatusEffect(actor, {
            id: `eff_${actor.id}_reflect_${Date.now()}`,
            name: "反弹",
            sourceCombatantId: actor.id,
            mechanic: "reflect",
            category: "buff",
            value: rawValue * 100,
            isPercent: true,
            remainingTurns: 3,
            stacks: 1,
            canStack: false,
          });
          entries.push(buildLogEntry(turn, actor.displayName, fn.name, "buff",
            `${actor.displayName}以${gongfa.name}开启伤害反弹`));
        } else if (component.mechanic === "kill_bonus") {
          addStatusEffect(actor, {
            id: `eff_${actor.id}_killbonus_${Date.now()}`,
            name: "击杀增益",
            sourceCombatantId: actor.id,
            mechanic: "kill_bonus",
            category: "buff",
            value: rawValue * 100,
            isPercent: true,
            remainingTurns: 99,
            stacks: 1,
            canStack: true,
          });
          entries.push(buildLogEntry(turn, actor.displayName, fn.name, "buff",
            `${actor.displayName}以${gongfa.name}获得击杀增益效果`));
        } else if (component.mechanic === "counter") {
          addStatusEffect(actor, {
            id: `eff_${actor.id}_counter_${Date.now()}`,
            name: "反击",
            sourceCombatantId: actor.id,
            mechanic: "counter",
            category: "buff",
            value: rawValue,
            isPercent: false,
            remainingTurns: 2,
            stacks: 1,
            canStack: false,
          });
          entries.push(buildLogEntry(turn, actor.displayName, fn.name, "buff",
            `${actor.displayName}以${gongfa.name}进入反击姿态`));
        }
        break;
      }
    }
  }

  return entries;
}

export function resolveElixirAction(
  actor: BattleCombatant,
  action: Extract<BattleAction, { type: "elixir" }>,
  turn: number,
): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];
  const elixir = actor.availableElixirs[action.elixirIndex];
  if (!elixir) return entries;

  const { effectType, effects } = elixir;
  const value = effects.value;

  if (effectType === "恢复血量") {
    if (effects.isPercent) {
      const healAmt = Math.round(actor.maxHp * value / 100);
      const { healed } = applyHeal(actor, healAmt);
      entries.push(buildLogEntry(turn, actor.displayName, `服用${elixir.name}`, "heal",
        `${actor.displayName}服用${elixir.name}，恢复${healed}点生命`,
        actor.displayName, healed));
    } else {
      const { healed } = applyHeal(actor, value);
      entries.push(buildLogEntry(turn, actor.displayName, `服用${elixir.name}`, "heal",
        `${actor.displayName}服用${elixir.name}，恢复${healed}点生命`,
        actor.displayName, healed));
    }
  } else if (effectType === "恢复法力") {
    if (effects.isPercent) {
      const mpAmt = Math.round(actor.maxMp * value / 100);
      const { changed } = applyMpChange(actor, mpAmt);
      entries.push(buildLogEntry(turn, actor.displayName, `服用${elixir.name}`, "heal",
        `${actor.displayName}服用${elixir.name}，恢复${changed}点法力`,
        actor.displayName, changed));
    } else {
      const { changed } = applyMpChange(actor, value);
      entries.push(buildLogEntry(turn, actor.displayName, `服用${elixir.name}`, "heal",
        `${actor.displayName}服用${elixir.name}，恢复${changed}点法力`,
        actor.displayName, changed));
    }
  }

  elixir.count -= 1;
  return entries;
}

export function resolveFlee(
  actor: BattleCombatant,
  enemies: BattleCombatant[],
  turn: number,
): { entries: BattleLogEntry[]; success: boolean } {
  if (isRooted(actor)) {
    return {
      entries: [buildLogEntry(turn, actor.displayName, "逃跑", "info",
        `${actor.displayName}被禁锢，无法逃跑！`)],
      success: false,
    };
  }

  const aliveEnemies = getAliveEnemies(enemies);
  const avgEnemySpeed = aliveEnemies.length > 0
    ? aliveEnemies.reduce((sum, e) => sum + getEffectiveStat(e, "critRate"), 0) / aliveEnemies.length
    : 0;
  const fleeChance = Math.min(90, Math.max(10, getEffectiveStat(actor, "dodgeRate") - avgEnemySpeed));
  const success = Math.random() * 100 < fleeChance;

  if (success) {
    return {
      entries: [buildLogEntry(turn, actor.displayName, "逃跑", "flee_success",
        `${actor.displayName}成功脱离战斗！`)],
      success: true,
    };
  }

  return {
    entries: [buildLogEntry(turn, actor.displayName, "逃跑", "flee_fail",
      `${actor.displayName}试图逃跑，但被拦住了！`)],
    success: false,
  };
}

export function resolveAction(
  action: BattleAction,
  actor: BattleCombatant,
  allies: BattleCombatant[],
  enemies: BattleCombatant[],
  turn: number,
): { entries: BattleLogEntry[]; fled: boolean } {
  switch (action.type) {
    case "normal_attack": {
      const target = findCombatantById(action.targetId, allies, enemies);
      if (!target || target.isDead) return { entries: [], fled: false };
      return { entries: resolveNormalAttack(actor, target, turn), fled: false };
    }
    case "magic_attack": {
      const target = findCombatantById(action.targetId, allies, enemies);
      if (!target || target.isDead) return { entries: [], fled: false };
      return { entries: resolveMagicAttack(actor, target, turn), fled: false };
    }
    case "gongfa": {
      return { entries: resolveGongfaAction(actor, action, allies, enemies, turn), fled: false };
    }
    case "elixir": {
      return { entries: resolveElixirAction(actor, action, turn), fled: false };
    }
    case "flee": {
      const result = resolveFlee(actor, enemies, turn);
      return { entries: result.entries, fled: result.success };
    }
  }
}

export function processTurnStart(
  allies: BattleCombatant[],
  enemies: BattleCombatant[],
  turn: number,
): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];
  const all = [...allies, ...enemies];

  for (const c of all) {
    if (c.isDead) continue;

    const startPassives = checkPassiveTriggers(c, "on_turn_start", {});
    for (const pr of startPassives) {
      entries.push(buildLogEntry(turn, pr.trigger.sourceName, pr.trigger.effectName, "info",
        `${c.displayName}的${pr.trigger.sourceName}触发${pr.trigger.effectName}`));
    }

    const dotEntries = tickStatusEffects(c, turn);
    entries.push(...dotEntries);

    const summonEntries = processSummons(c, c.team === "ally" ? enemies : allies, turn);
    entries.push(...summonEntries);
  }

  return entries;
}

export function processTurnEnd(
  allies: BattleCombatant[],
  enemies: BattleCombatant[],
  turn: number,
): BattleLogEntry[] {
  const entries: BattleLogEntry[] = [];
  const all = [...allies, ...enemies];

  for (const c of all) {
    if (c.isDead) continue;

    c.actedThisTurn = false;

    const endPassives = checkPassiveTriggers(c, "on_turn_end", {});
    for (const pr of endPassives) {
      entries.push(buildLogEntry(turn, pr.trigger.sourceName, pr.trigger.effectName, "info",
        `${c.displayName}的${pr.trigger.sourceName}触发${pr.trigger.effectName}`));
    }

    if (c.shield > 0) {
      const shieldEffects = c.activeEffects.filter(e => e.mechanic === "buff_shield");
      if (shieldEffects.length === 0) {
        c.shield = Math.max(0, c.shield - Math.round(c.shield * 0.5));
      }
    }
  }

  return entries;
}

export function checkBattleEnd(
  state: BattleState,
): { ended: boolean; outcome: "victory" | "defeat" | "draw" | null } {
  const allEnemiesDead = state.enemies.every(e => e.isDead);
  if (allEnemiesDead) return { ended: true, outcome: "victory" };

  const protagonist = state.allies.find(a => a.isProtagonist);
  if (protagonist?.isDead) return { ended: true, outcome: "defeat" };

  if (state.turn > state.maxTurns) return { ended: true, outcome: "draw" };

  return { ended: false, outcome: null };
}
