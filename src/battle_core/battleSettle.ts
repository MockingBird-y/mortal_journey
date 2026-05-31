import type { BattleState, BattleResult, BattleCombatant } from "./battleTypes";
import { protagonist } from "../role_core/Protagonist";
import { npcStore } from "../role_core/npcStore";

export function settleBattle(state: BattleState): BattleResult {
  const protagonistCombatant = state.allies.find(a => a.isProtagonist);
  const elixirsUsed: { name: string; count: number }[] = [];
  const enemiesKilled: string[] = [];

  const elixirMap = new Map<string, number>();
  for (const ally of state.allies) {
    for (const el of ally.availableElixirs) {
      const original = el.count;
      if (original <= 0) continue;
      elixirMap.set(el.name, (elixirMap.get(el.name) ?? 0) + (1 - el.count > 0 ? 1 - el.count : 0));
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
      const hpPct = protagonistCombatant.maxHp > 0
        ? Math.round(protagonistCombatant.currentHp / protagonistCombatant.maxHp * 100)
        : 0;
      const mpPct = protagonistCombatant.maxMp > 0
        ? Math.round(protagonistCombatant.currentMp / protagonistCombatant.maxMp * 100)
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
      const hpPct = ally.maxHp > 0 ? Math.round(ally.currentHp / ally.maxHp * 100) : 0;
      const mpPct = ally.maxMp > 0 ? Math.round(ally.currentMp / ally.maxMp * 100) : 0;
      npc.setCurrentHpMp(
        Math.round(npc.maxHp * hpPct / 100),
        Math.round(npc.maxMp * mpPct / 100),
      );
    }
  }

  const outcome = state.phase === "victory" ? "victory"
    : state.phase === "defeat" ? "defeat"
    : state.phase === "fled" ? "fled"
    : "draw";

  return {
    outcome,
    turn: state.turn,
    protagonistHpPercent: protagonistCombatant ? Math.round(protagonistCombatant.currentHp / Math.max(1, protagonistCombatant.maxHp) * 100) : 0,
    protagonistMpPercent: protagonistCombatant ? Math.round(protagonistCombatant.currentMp / Math.max(1, protagonistCombatant.maxMp) * 100) : 0,
    elixirsUsed,
    enemiesKilled,
  };
}
