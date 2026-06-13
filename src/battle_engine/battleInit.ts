import type { BattleCombatant, BattleSkill, BattleElixir, BattleEffect } from "./types";
import type { BattleTriggerEntry } from "../ai/state_generate";
import type { EquippedSlotsState, GongfaSlotsState, PrimaryStatKey } from "../role_core/types/playInfo";
import type { InventoryStackItem, ElixirItemDefinition } from "../role_core/types/itemInfo";
import type { EffectComponent } from "../role_core/types/combatMechanics";
import { protagonist } from "../role_core/Protagonist";
import { Npc } from "../role_core/Npc";
import { npcStore } from "../role_core/npcStore";
import { gameLog } from "../log/gameLog";
import { GONGFA_SLOT_COUNT, GONGFA_MASTERY_COMBAT_MULT } from "../role_core/types/gameConstants";
import { SYSTEM_DAMAGE_STAT } from "../role_core/types/combatMechanics";
import { generateId as generateEffectId } from "./formulas";
import type { ItemGrade } from "../role_core/types/itemInfo";

function generateId(team: "ally" | "enemy", index: number): string {
  return `${team}_${index}`;
}

function buildBattleSkills(gongfaSlots: GongfaSlotsState): BattleSkill[] {
  const skills: BattleSkill[] = [];
  for (const gf of gongfaSlots) {
    if (!gf || !gf.function) continue;
    if (gf.function.type !== "主动") continue;

    const masteryMult = gf.mastery != null && gf.mastery >= 1
      ? GONGFA_MASTERY_COMBAT_MULT[Math.min(gf.mastery, GONGFA_MASTERY_COMBAT_MULT.length) - 1]
      : 1.0;

    const system = gf.system as string | undefined;
    const isMagical = system ? SYSTEM_DAMAGE_STAT[system] === "perception" : false;

    const bakedComponents = gf.function.components.map(comp => {
      if (comp.noMasteryScaling || masteryMult === 1.0) return { ...comp };
      return {
        ...comp,
        baseValue: comp.baseValue != null ? Math.round(comp.baseValue * masteryMult) : undefined,
        scalingRatio: comp.scalingRatio != null ? comp.scalingRatio * masteryMult : undefined,
      };
    });

    const hasOffensive = bakedComponents.some(
      c => c.mechanic?.startsWith("dmg_") || c.mechanic?.startsWith("debuff_") || c.mechanic?.startsWith("cc_"),
    );

    const isAoE = bakedComponents.some(c => c.mechanic === "dmg_aoe");

    const effects = convertComponentsToSkillEffects(bakedComponents, system);

    skills.push({
      name: gf.name,
      desc: gf.function.components.map(c => c.desc ?? "").join("；"),
      mpCost: gf.function.mpCost ?? 0,
      actionCost: 100,
      cooldown: gf.function.cooldown ?? 0,
      needTarget: hasOffensive,
      targetTeam: hasOffensive ? "enemy" : "ally",
      isAoE,
      effects,
    });
  }
  return skills;
}

function convertComponentsToSkillEffects(
  components: Array<EffectComponent & { baseValue?: number; scalingRatio?: number }>,
  system: string | undefined,
): import("./types").SkillEffect[] {
  const isMagical = system ? SYSTEM_DAMAGE_STAT[system] === "perception" : false;
  const damageType: import("./types").DamageType = isMagical ? "magical" : "physical";

  return components.map(comp => {
    const mechanic = comp.mechanic;
    if (!mechanic) {
      if (comp.status) {
        return convertStatusToSkillEffect(comp);
      }
      return { type: "shield" as const, value: 0 };
    }

    switch (mechanic) {
      case "dmg_single":
        return { type: "dealDamage" as const, damageType, value: comp.baseValue ?? 0 };
      case "dmg_aoe":
        return { type: "dealDamage" as const, damageType, value: comp.baseValue ?? 0 };
      case "dmg_dot":
        return { type: "applyStatus" as const, statusType: "burn" as const, tickValue: Math.round((comp.baseValue ?? 0) / 3), isPercent: false, duration: 3, maxStacks: 5 };
      case "dmg_dot_pct":
        return { type: "applyStatus" as const, statusType: "poison" as const, tickValue: comp.baseValue ? Math.round(comp.baseValue * 100) : 3, isPercent: true, duration: 3, maxStacks: 5 };
      case "dmg_execute":
        return { type: "dealDamageExecute" as const, damageType, value: comp.baseValue ?? 0, threshold: 0.5, bonusPercent: 50 };
      case "dmg_pierce":
        return { type: "dealDamagePierce" as const, value: comp.baseValue ?? 0 };
      case "buff_atk":
      case "buff_def":
      case "buff_crit":
      case "buff_crit_dmg":
      case "buff_speed":
      case "buff_dodge":
      case "buff_stat":
      case "buff_ramp": {
        const modifierMap: Record<string, import("./types").ModifierType> = {
          buff_atk: "damageDealt",
          buff_def: "damageTaken",
          buff_crit: "critRate",
          buff_crit_dmg: "critDmg",
          buff_speed: "speed",
          buff_dodge: "dodgeRate",
          buff_stat: "damageDealt",
          buff_ramp: "damageDealt",
        };
        return { type: "applyModifier" as const, modifierType: modifierMap[mechanic] ?? "damageDealt", value: (comp.baseValue ?? 0) * 100, duration: comp.duration ?? 2, maxStacks: mechanic === "buff_ramp" ? 10 : 1 };
      }
      case "buff_shield":
        return { type: "shield" as const, value: comp.baseValue ?? 0 };
      case "buff_stealth":
        return { type: "stealth" as const, duration: comp.duration ?? 1 };
      case "debuff_def":
        return { type: "applyModifier" as const, modifierType: "damageTaken" as const, value: -(comp.baseValue ?? 0) * 100, duration: comp.duration ?? 2, maxStacks: 1 };
      case "debuff_atk":
        return { type: "applyModifier" as const, modifierType: "damageDealt" as const, value: -(comp.baseValue ?? 0) * 100, duration: comp.duration ?? 2, maxStacks: 1 };
      case "debuff_speed":
        return { type: "applyModifier" as const, modifierType: "speed" as const, value: -(comp.baseValue ?? 0) * 100, duration: comp.duration ?? 2, maxStacks: 1 };
      case "debuff_heal":
        return { type: "applyStatus" as const, statusType: "burn" as const, tickValue: (comp.baseValue ?? 0) * 100, isPercent: true, duration: comp.duration ?? 2, maxStacks: 1 };
      case "debuff_mp":
        return { type: "applyStatus" as const, statusType: "mpDrain" as const, tickValue: (comp.baseValue ?? 0) * 100, isPercent: true, duration: comp.duration ?? 2, maxStacks: 1 };
      case "debuff_mark":
        return { type: "applyModifier" as const, modifierType: "damageTaken" as const, value: (comp.baseValue ?? 0) * 100, duration: comp.duration ?? 3, maxStacks: 5 };
      case "cc_freeze":
        return { type: "applyCc" as const, ccType: "freeze" as const, chance: comp.baseValue ?? 0.5, duration: comp.duration ?? 1 };
      case "cc_stun":
        return { type: "applyCc" as const, ccType: "stun" as const, chance: comp.baseValue ?? 0.5, duration: comp.duration ?? 1 };
      case "cc_fear":
        return { type: "applyCc" as const, ccType: "fear" as const, chance: comp.baseValue ?? 0.5, duration: comp.duration ?? 1 };
      case "cc_root":
        return { type: "applyCc" as const, ccType: "stun" as const, chance: comp.baseValue ?? 0.5, duration: comp.duration ?? 1 };
      case "cc_silence":
        return { type: "applyCc" as const, ccType: "silence" as const, chance: comp.baseValue ?? 0.5, duration: comp.duration ?? 1 };
      case "heal_single":
        return { type: "heal" as const, value: comp.baseValue ?? 0 };
      case "heal_aoe":
        return { type: "heal" as const, value: comp.baseValue ?? 0 };
      case "heal_lifesteal":
        return { type: "lifesteal" as const, damageType, damagePercent: 50 };
      case "heal_lifesteal_pct":
        return { type: "lifesteal" as const, damageType, damagePercent: 30 };
      case "summon":
        return { type: "summon" as const, name: "召唤物", trigger: "on_attack" as const, effect: { type: "dealDamage" as const, damageType: "physical" as const, value: comp.baseValue ?? 0 }, duration: 3 };
      case "cleanse":
        return { type: "cleanse" as const };
      case "revive":
        return { type: "revive" as const, hpPercent: (comp.baseValue ?? 30) * 100 };
      case "kill_bonus":
        return { type: "applyModifier" as const, modifierType: "damageDealt" as const, value: (comp.baseValue ?? 0) * 100, duration: 99, maxStacks: 99 };
      case "death_ward":
        return { type: "deathWard" as const, duration: comp.duration ?? 99 };
      case "sacrifice":
        return { type: "dealDamagePierce" as const, value: 0 };
      case "extra_action":
        return { type: "extraAction" as const, chance: comp.baseValue ?? 0.3 };
      case "reflect":
        return { type: "reflect" as const, percent: (comp.baseValue ?? 0) * 100, duration: 3 };
      case "counter":
        return { type: "counter" as const, damage: comp.baseValue ?? 0, duration: 2 };
      case "damage_share":
        return { type: "damageShare" as const, percent: (comp.baseValue ?? 0) * 100, duration: 3 };
      case "dispel":
        return { type: "dispel" as const };
      default:
        return { type: "shield" as const, value: 0 };
    }
  });
}

function convertStatusToSkillEffect(comp: EffectComponent): import("./types").SkillEffect {
  const statusMap: Record<string, import("./types").StatusType> = {
    poison: "poison",
    burn: "burn",
    corrode: "mpDrain",
    shock: "burn",
    frost: "burn",
    thunder_seal: "burn",
    fire_seed: "burn",
    sword_intent: "bleed",
  };
  const status = statusMap[comp.status ?? ""] ?? "burn";
  return { type: "applyStatus", statusType: status, tickValue: comp.baseValue ?? 3, isPercent: status === "poison", duration: comp.duration ?? 3, maxStacks: 5 };
}

function extractPassiveEffects(
  equippedSlots: EquippedSlotsState,
  gongfaSlots: GongfaSlotsState,
  combatantId: string,
): BattleEffect[] {
  const effects: BattleEffect[] = [];

  for (const tr of equippedSlots) {
    if (!tr || !tr.function) continue;
    for (const comp of tr.function.components) {
      if (comp.trigger === "active") continue;

      if (comp.mechanic) {
        const skillEffects = convertComponentsToSkillEffects([comp as any], undefined);
        for (const se of skillEffects) {
          effects.push(convertSkillEffectToBattleEffect(se, tr.function.name, combatantId, tr.grade));
        }
      }
    }
  }

  for (const gf of gongfaSlots) {
    if (!gf || !gf.function) continue;
    for (const comp of gf.function.components) {
      if (comp.trigger === "active") continue;

      if (comp.mechanic) {
        const skillEffects = convertComponentsToSkillEffects([comp as any], gf.system as string | undefined);
        for (const se of skillEffects) {
          effects.push(convertSkillEffectToBattleEffect(se, gf.function.name, combatantId, gf.grade));
        }
      }
    }
  }

  return effects;
}

function convertSkillEffectToBattleEffect(
  se: import("./types").SkillEffect,
  name: string,
  sourceId: string,
  grade: ItemGrade,
): BattleEffect {
  const base: BattleEffect = {
    id: generateEffectId(),
    name,
    sourceId,
    category: "special",
    remainingDuration: 2,
    stacks: 1,
    maxStacks: 1,
  };

  switch (se.type) {
    case "applyModifier":
      return { ...base, category: "modifier", modifierType: se.modifierType, modifierValue: se.value, remainingDuration: se.duration, maxStacks: se.maxStacks };
    case "applyCc":
      return { ...base, category: "cc", ccType: se.ccType, remainingDuration: se.duration };
    case "applyStatus":
      return { ...base, category: "dot", tickValue: se.tickValue, tickIsPercent: se.isPercent, tickResource: "hp", statusType: se.statusType, remainingDuration: se.duration, maxStacks: se.maxStacks };
    case "summon":
      return { ...base, category: "summon", summonTrigger: se.trigger, summonEffect: se.effect, remainingDuration: se.duration, maxStacks: Infinity };
    case "deathWard":
      return { ...base, specialType: "deathWard", remainingDuration: se.duration };
    case "counter":
      return { ...base, specialType: "counter", specialValue: se.damage, remainingDuration: se.duration };
    case "reflect":
      return { ...base, specialType: "reflect", specialValue: se.percent, remainingDuration: se.duration };
    case "damageShare":
      return { ...base, specialType: "damageShare", specialValue: se.percent, remainingDuration: se.duration };
    case "stealth":
      return { ...base, specialType: "stealth", remainingDuration: se.duration };
    case "shield":
      return { ...base, category: "modifier", modifierType: "damageTaken", modifierValue: 0, remainingDuration: 99 };
    default:
      return base;
  }
}

function extractRecoveryElixirs(inventorySlots: Array<InventoryStackItem | null>): BattleElixir[] {
  const result: BattleElixir[] = [];
  for (const slot of inventorySlots) {
    if (!slot) continue;
    if ("itemType" in slot && slot.itemType === "丹药" && "effectType" in slot
      && (slot.effectType === "恢复血量" || slot.effectType === "恢复法力")) {
      const el = slot as ElixirItemDefinition;
      result.push({
        name: el.name,
        desc: el.desc ?? "",
        effectType: el.effectType === "恢复血量" ? "healHp" : "healMp",
        value: el.effects?.value ?? 0,
        count: el.count,
      });
    }
  }
  return result;
}

function createProtagonistCombatant(): BattleCombatant | null {
  const p = protagonist.value;
  if (!p) return null;

  const primaryStats = p.getPrimaryStats();
  const skills = buildBattleSkills(p.gongfaSlots);
  const elixirs = extractRecoveryElixirs(p.inventorySlots);
  const passiveEffects: BattleEffect[] = [];

  return {
    id: generateId("ally", 0),
    name: p.displayName,
    team: "ally",
    isProtagonist: true,
    isPlayerControlled: true,

    stats: {
      maxHp: p.maxHp,
      maxMp: p.maxMp,
      speed: primaryStats.agility ?? 0,
      physAttack: primaryStats.strength ?? 0,
      magAttack: primaryStats.perception ?? 0,
      physDefense: primaryStats.guard ?? 0,
      magDefense: primaryStats.resistance ?? 0,
      critRate: 0,
      critDmg: 150,
    },

    hp: p.currentHp,
    mp: p.currentMp,
    shield: 0,
    actionGauge: 0,
    isDead: false,
    isFleeing: false,

    skills,
    cooldowns: new Array(Math.max(GONGFA_SLOT_COUNT, skills.length)).fill(0),
    elixirs,

    effects: passiveEffects,
    realm: { ...p.realm },
  };
}

function createNpcCombatant(npc: Npc, team: "ally" | "enemy", index: number): BattleCombatant {
  const primaryStats = npc.getPrimaryStats();
  const skills = buildBattleSkills(npc.gongfaSlots);
  const elixirs = extractRecoveryElixirs(npc.inventorySlots);

  return {
    id: generateId(team, index),
    name: npc.displayName,
    team,
    isProtagonist: false,
    isPlayerControlled: false,

    stats: {
      maxHp: npc.maxHp,
      maxMp: npc.maxMp,
      speed: primaryStats.agility ?? 0,
      physAttack: primaryStats.strength ?? 0,
      magAttack: primaryStats.perception ?? 0,
      physDefense: primaryStats.guard ?? 0,
      magDefense: primaryStats.resistance ?? 0,
      critRate: 0,
      critDmg: 150,
    },

    hp: npc.currentHp,
    mp: npc.currentMp,
    shield: 0,
    actionGauge: 0,
    isDead: false,
    isFleeing: false,

    skills,
    cooldowns: new Array(Math.max(GONGFA_SLOT_COUNT, skills.length)).fill(0),
    elixirs,

    effects: [],
    sourceNpcName: npc.displayName,
    realm: { ...npc.realm },
    powerTier: npc.powerTier,
    identity: npc.identity,
  };
}

export function createBattleCombatants(triggerEntry: BattleTriggerEntry): {
  allies: BattleCombatant[];
  enemies: BattleCombatant[];
} {
  const allies: BattleCombatant[] = [];
  const enemies: BattleCombatant[] = [];

  const protagonistCombatant = createProtagonistCombatant();
  if (protagonistCombatant) {
    allies.push(protagonistCombatant);
  }

  let allyIndex = 1;
  for (const ally of triggerEntry.allies) {
    if (ally.roleHint === "主角") continue;
    const npc = npcStore.getNpc(ally.displayName);
    if (!npc || npc.isDead) {
      gameLog.warn(`[initBattle] 友方NPC "${ally.displayName}" 未在npcStore中找到或已死亡`);
      continue;
    }
    if (allies.length >= 5) break;
    allies.push(createNpcCombatant(npc, "ally", allyIndex));
    allyIndex++;
  }

  let enemyIndex = 0;
  for (const enemy of triggerEntry.enemies) {
    const npc = npcStore.getNpc(enemy.displayName);
    if (!npc || npc.isDead) {
      gameLog.warn(`[initBattle] 敌方NPC "${enemy.displayName}" 未在npcStore中找到或已死亡`);
      continue;
    }
    if (enemies.length >= 5) break;
    enemies.push(createNpcCombatant(npc, "enemy", enemyIndex));
    enemyIndex++;
  }

  return { allies, enemies };
}
