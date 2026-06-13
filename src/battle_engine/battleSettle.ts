import type { BattleState, BattleResult, BattleCombatant, BattleOutcome } from "./types";
import { protagonist } from "../role_core/Protagonist";
import { npcStore } from "../role_core/npcStore";
import type { BattleTriggerEntry } from "../ai/state_generate";

export function settleBattle(state: BattleState): BattleResult {
  const trigger = state.triggerEntry as BattleTriggerEntry;
  const protagonistCombatant = state.allies.find(a => a.isProtagonist);
  const elixirsUsed: { name: string; count: number }[] = [];
  const enemiesKilled: string[] = [];

  const elixirMap = new Map<string, number>();
  for (const ally of state.allies) {
    for (const el of ally.elixirs) {
      const original = el.count;
      if (original <= 0) continue;
      const used = (elixirMap.get(el.name) ?? 0) + (original > el.count ? original - el.count : 0);
      elixirMap.set(el.name, used);
    }
  }
  for (const [name, count] of elixirMap) {
    if (count > 0) elixirsUsed.push({ name, count });
  }

  for (const enemy of state.enemies) {
    if (enemy.isDead && enemy.sourceNpcName) {
      enemiesKilled.push(enemy.sourceNpcName);
    }
  }

  const p = protagonist.value;
  if (p && protagonistCombatant) {
    if (state.phase === "defeat") {
      p.setCurrentHpMp(1, Math.max(0, Math.round(p.maxMp * 0.1)));
    } else {
      const hpPct = protagonistCombatant.stats.maxHp > 0
        ? Math.round(protagonistCombatant.hp / protagonistCombatant.stats.maxHp * 100)
        : 0;
      const mpPct = protagonistCombatant.stats.maxMp > 0
        ? Math.round(protagonistCombatant.mp / protagonistCombatant.stats.maxMp * 100)
        : 0;
      p.setCurrentHpMp(
        Math.round(p.maxHp * hpPct / 100),
        Math.round(p.maxMp * mpPct / 100),
      );
    }
  }

  if (elixirsUsed.length > 0 && p) {
    for (const used of elixirsUsed) {
      let remaining = used.count;
      for (let i = 0; i < p.inventorySlots.length && remaining > 0; i++) {
        const slot = p.inventorySlots[i];
        if (!slot || !("name" in slot) || slot.name !== used.name) continue;
        const take = Math.min(remaining, slot.count);
        slot.count -= take;
        remaining -= take;
        if (slot.count <= 0) p.setInventorySlot(i, null);
      }
    }
  }

  for (const enemy of state.enemies) {
    if (enemy.isDead && enemy.sourceNpcName) {
      const npc = npcStore.getNpc(enemy.sourceNpcName);
      if (npc) {
        npc.isDead = true;
      }
    }
  }

  for (const ally of state.allies) {
    if (ally.isProtagonist || !ally.sourceNpcName) continue;
    const npc = npcStore.getNpc(ally.sourceNpcName);
    if (!npc) continue;

    if (ally.isDead) {
      npc.isDead = true;
    } else {
      const hpPct = ally.stats.maxHp > 0 ? Math.round(ally.hp / ally.stats.maxHp * 100) : 0;
      const mpPct = ally.stats.maxMp > 0 ? Math.round(ally.mp / ally.stats.maxMp * 100) : 0;
      npc.setCurrentHpMp(
        Math.round(npc.maxHp * hpPct / 100),
        Math.round(npc.maxMp * mpPct / 100),
      );
    }
  }

  const outcome: BattleOutcome = state.phase === "victory" ? "victory"
    : state.phase === "defeat" ? "defeat"
    : state.phase === "fled" ? "fled"
    : "fled";

  return {
    outcome,
    actionCount: state.actionCount,
    protagonistHpPercent: protagonistCombatant ? Math.round(protagonistCombatant.hp / Math.max(1, protagonistCombatant.stats.maxHp) * 100) : 0,
    protagonistMpPercent: protagonistCombatant ? Math.round(protagonistCombatant.mp / Math.max(1, protagonistCombatant.stats.maxMp) * 100) : 0,
    elixirsUsed,
    enemiesKilled,
    triggerReason: trigger.triggerReason,
    allyNames: trigger.allies.map(a => a.displayName),
    enemyNames: trigger.enemies.map(e => e.displayName),
    triggerKind: trigger.triggerKind,
  };
}
