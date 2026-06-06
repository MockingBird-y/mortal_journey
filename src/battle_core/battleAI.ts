import type {
  BattleCombatant,
  GongfaActionItem,
  ElixirActionItem,
  BattleAction,
} from "./battleTypes";

import {
  getAliveEnemies,
  isActionPrevented,
  isSilenced,
} from "./battleEngine";

function selectWeakestEnemy(enemies: BattleCombatant[]): BattleCombatant | null {
  const alive = getAliveEnemies(enemies);
  if (alive.length === 0) return null;
  return alive.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
}

function selectRandomEnemy(enemies: BattleCombatant[]): BattleCombatant | null {
  const alive = getAliveEnemies(enemies);
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}

function selectTargetByPowerTier(
  actor: BattleCombatant,
  enemies: BattleCombatant[],
  allies: BattleCombatant[],
): BattleCombatant | null {
  const tier = actor.powerTier ?? "普通NPC";
  const alive = getAliveEnemies(enemies);
  if (alive.length === 0) return null;

  switch (tier) {
    case "大boss":
    case "小boss": {
      const protagonist = allies.find(a => a.isProtagonist && !a.isDead);
      if (protagonist) return protagonist;
      return selectWeakestEnemy(enemies);
    }
    case "精英怪":
      return selectWeakestEnemy(enemies);
    default:
      return selectRandomEnemy(enemies);
  }
}

function findActiveGongfaOptions(actor: BattleCombatant): GongfaActionItem[] {
  const items: GongfaActionItem[] = [];
  for (let i = 0; i < actor.gongfaSlots.length; i++) {
    const gf = actor.gongfaSlots[i];
    if (!gf || !gf.function || gf.function.type !== "主动") continue;
    if (actor.currentMp < (gf.function.mpCost ?? 0)) continue;

    const hasOffensive = gf.function.components.some(c => {
      if (!c.mechanic) return false;
      return c.mechanic.startsWith("dmg_") || c.mechanic.startsWith("debuff_") || c.mechanic.startsWith("cc_");
    });

    items.push({
      gongfaIndex: i,
      name: `${gf.name}·${gf.function.name}`,
      mpCost: gf.function.mpCost ?? 0,
      needTarget: hasOffensive,
      targetTeam: hasOffensive ? "enemy" : "ally",
      description: gf.function.components.map(c => c.desc).join("，"),
    });
  }
  return items;
}

function findHealGongfaIndex(actor: BattleCombatant): number | null {
  for (let i = 0; i < actor.gongfaSlots.length; i++) {
    const gf = actor.gongfaSlots[i];
    if (!gf || !gf.function || gf.function.type !== "主动") continue;
    if (actor.currentMp < (gf.function.mpCost ?? 0)) continue;
    const hasHeal = gf.function.components.some(c => c.mechanic?.startsWith("heal_"));
    if (hasHeal) return i;
  }
  return null;
}

function findHealElixirIndex(actor: BattleCombatant): number | null {
  for (let i = 0; i < actor.availableElixirs.length; i++) {
    const el = actor.availableElixirs[i];
    if (el.count <= 0) continue;
    if (el.effectType === "恢复血量" || el.effectType === "恢复法力") return i;
  }
  return null;
}

export function chooseNpcAction(
  actor: BattleCombatant,
  allies: BattleCombatant[],
  enemies: BattleCombatant[],
): BattleAction {
  const preventCheck = isActionPrevented(actor);
  if (preventCheck.prevented) {
    const target = selectTargetByPowerTier(actor, enemies, allies);
    return { type: "normal_attack", targetId: target?.id ?? "" };
  }

  const hpRatio = actor.maxHp > 0 ? actor.currentHp / actor.maxHp : 1;

  if (hpRatio < 0.3) {
    const elixirIdx = findHealElixirIndex(actor);
    if (elixirIdx !== null) {
      return { type: "elixir", elixirIndex: elixirIdx };
    }
  }

  if (hpRatio < 0.5) {
    const healIdx = findHealGongfaIndex(actor);
    if (healIdx !== null) {
      return { type: "gongfa", gongfaIndex: healIdx, targetId: actor.id };
    }
  }

  if (!isSilenced(actor)) {
    const options = findActiveGongfaOptions(actor);
    if (options.length > 0) {
      const best = options[0];
      if (best.needTarget) {
        const target = selectTargetByPowerTier(actor, enemies, allies);
        if (target) {
          return { type: "gongfa", gongfaIndex: best.gongfaIndex, targetId: target.id };
        }
      } else {
        return { type: "gongfa", gongfaIndex: best.gongfaIndex, targetId: actor.id };
      }
    }

  }

  const target = selectTargetByPowerTier(actor, enemies, allies);
  return { type: "normal_attack", targetId: target?.id ?? "" };
}
