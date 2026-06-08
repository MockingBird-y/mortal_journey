import type {
  BattleCombatant,
  PassiveTrigger,
} from "./types";

import type { BattleTriggerEntry } from "../ai/state_generate";
import type { EquippedSlotsState, GongfaSlotsState } from "../role_core/types/playInfo";
import type { ElixirItemDefinition, InventoryStackItem } from "../role_core/types/itemInfo";
import type { EffectComponent } from "../role_core/types/combatMechanics";
import type { PrimaryStatKey } from "../role_core/types/playInfo";
import { protagonist } from "../role_core/Protagonist";
import { Npc } from "../role_core/Npc";
import { npcStore } from "../role_core/npcStore";
import { gameLog } from "../log/gameLog";
import { GONGFA_SLOT_COUNT } from "../role_core/types/gameConstants";
import { calcDodgeRate } from "./formulas";

function generateCombatantId(team: "ally" | "enemy", index: number): string {
  return `${team}_${index}`;
}

function extractPassiveTriggers(
  equippedSlots: EquippedSlotsState,
  gongfaSlots: GongfaSlotsState,
): PassiveTrigger[] {
  const triggers: PassiveTrigger[] = [];

  for (const tr of equippedSlots) {
    if (!tr || !tr.function) continue;
    for (const comp of tr.function.components) {
      if (comp.trigger !== "active") {
        triggers.push({
          sourceType: "treasure",
          sourceName: tr.name,
          effectName: tr.function.name,
          component: comp,
          grade: tr.grade,
        });
      }
    }
  }

    for (const gf of gongfaSlots) {
      if (!gf || !gf.function) continue;
      for (const comp of gf.function.components) {
        if (comp.trigger !== "active") {
          triggers.push({
            sourceType: "gongfa",
            sourceName: gf.name,
            effectName: gf.function.name,
            component: comp,
            grade: gf.grade,
            system: gf.system as import("../role_core/types/gongfa").GongfaSystem | undefined,
            mastery: gf.mastery ?? 1,
          });
        }
      }
    }

  return triggers;
}

function extractRecoveryElixirs(inventorySlots: Array<InventoryStackItem | null>): ElixirItemDefinition[] {
  const result: ElixirItemDefinition[] = [];
  for (const slot of inventorySlots) {
    if (!slot) continue;
    if ("itemType" in slot && slot.itemType === "丹药" && "effectType" in slot
      && (slot.effectType === "恢复血量" || slot.effectType === "恢复法力")) {
      result.push({ ...(slot as ElixirItemDefinition) });
    }
  }
  return result;
}

function createProtagonistCombatant(): BattleCombatant | null {
  const p = protagonist.value;
  if (!p) return null;

  const primaryStats = p.getPrimaryStats();
  const stats: Record<PrimaryStatKey, number> = { ...primaryStats };
  const elixirs = extractRecoveryElixirs(p.inventorySlots);
  const passiveTriggers = extractPassiveTriggers(p.equippedSlots, p.gongfaSlots);

  return {
    id: generateCombatantId("ally", 0),
    displayName: p.displayName,
    team: "ally",
    isProtagonist: true,
    isPlayerControlled: true,
    stats,
    combatStats: { critRate: 0, critDmg: 150 },
    speed: stats.agility ?? 0,
    currentHp: p.currentHp,
    maxHp: p.maxHp,
    currentMp: p.currentMp,
    maxMp: p.maxMp,
    equippedSlots: p.equippedSlots.map(tr => tr ? { ...tr, function: tr.function ? { ...tr.function } : undefined } : null) as EquippedSlotsState,
    gongfaSlots: p.gongfaSlots.map(gf => gf ? { ...gf, bonus: { ...gf.bonus }, function: gf.function ? { ...gf.function } : undefined } : null) as import("../role_core/types/playInfo").GongfaSlotsState,
    availableElixirs: elixirs,
    activeEffects: [],
    shield: 0,
    isDead: false,
    passiveTriggers,
    summons: [],
    realm: { ...p.realm },
    cooldowns: new Array(GONGFA_SLOT_COUNT).fill(0),
  };
}

function createNpcCombatant(
  npc: Npc,
  team: "ally" | "enemy",
  index: number,
): BattleCombatant {
  const primaryStats = npc.getPrimaryStats();
  const stats: Record<PrimaryStatKey, number> = { ...primaryStats };
  const elixirs = extractRecoveryElixirs(npc.inventorySlots);
  const passiveTriggers = extractPassiveTriggers(npc.equippedSlots, npc.gongfaSlots);

  return {
    id: generateCombatantId(team, index),
    displayName: npc.displayName,
    team,
    isProtagonist: false,
    isPlayerControlled: false,
    stats,
    combatStats: { critRate: 0, critDmg: 150 },
    speed: stats.agility ?? 0,
    currentHp: npc.currentHp,
    maxHp: npc.maxHp,
    currentMp: npc.currentMp,
    maxMp: npc.maxMp,
    equippedSlots: npc.equippedSlots.map(tr => tr ? { ...tr, function: tr.function ? { ...tr.function } : undefined } : null) as EquippedSlotsState,
    gongfaSlots: npc.gongfaSlots.map(gf => gf ? { ...gf, bonus: { ...gf.bonus }, function: gf.function ? { ...gf.function } : undefined } : null) as import("../role_core/types/playInfo").GongfaSlotsState,
    availableElixirs: elixirs,
    activeEffects: [],
    shield: 0,
    isDead: false,
    passiveTriggers,
    sourceNpcName: npc.displayName,
    summons: [],
    realm: { ...npc.realm },
    powerTier: npc.powerTier,
    identity: npc.identity,
    cooldowns: new Array(GONGFA_SLOT_COUNT).fill(0),
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
