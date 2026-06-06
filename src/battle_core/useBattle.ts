import { ref, type Ref } from "vue";
import type {
  BattleState,
  BattleAction,
  BattleResult,
  BattleCombatant,
  GongfaActionItem,
  ElixirActionItem,
  ActionSubmenu,
} from "./battleTypes";
import type { BattleTriggerEntry } from "../ai/state_generate";
import { initBattle } from "./battleInit";
import { settleBattle } from "./battleSettle";
import {
  resolveAction,
  processTurnStart,
  processTurnEnd,
  checkBattleEnd,
  getAliveEnemies,
  getAliveAllies,
  isActionPrevented,
  isSilenced,
  findCombatantById,
} from "./battleEngine";
import { chooseNpcAction } from "./battleAI";
import { gameLog } from "../log/gameLog";

export function useBattle() {
  const state: Ref<BattleState | null> = ref(null);
  const result: Ref<BattleResult | null> = ref(null);
  const resolving = ref(false);

  function startBattle(triggerEntry: BattleTriggerEntry): void {
    const battleState = initBattle(triggerEntry);
    gameLog.info(`[useBattle] initBattle 完成: allies=${battleState.allies.length}, enemies=${battleState.enemies.length}`);

    if (battleState.enemies.length === 0) {
      throw new Error(`战斗初始化失败：未找到敌方参战者。triggerEntry.enemies=${JSON.stringify(triggerEntry.enemies.map(e => e.displayName))}，请检查 NPC 是否已写入 npcStore`);
    }

    if (battleState.allies.length === 0) {
      throw new Error("战斗初始化失败：未找到主角参战者");
    }

    battleState.phase = "turn_start";
    const startEntries = processTurnStart(battleState.allies, battleState.enemies, battleState.turn);
    battleState.log.push(...startEntries);

    const endCheck = checkBattleEnd(battleState);
    if (endCheck.ended && endCheck.outcome) {
      battleState.phase = endCheck.outcome;
      state.value = battleState;
      finishBattle();
      return;
    }

    battleState.phase = "player_action";
    state.value = battleState;
    result.value = null;
  }

  function getPlayerActionOptions(): {
    canNormalAttack: boolean;
    gongfaItems: GongfaActionItem[];
    elixirItems: ElixirActionItem[];
    canFlee: boolean;
  } {
    const s = state.value;
    if (!s) return { canNormalAttack: false, gongfaItems: [], elixirItems: [], canFlee: false };

    const p = s.allies.find(a => a.isProtagonist && !a.isDead);
    if (!p) return { canNormalAttack: false, gongfaItems: [], elixirItems: [], canFlee: false };

    const prevent = isActionPrevented(p);
    const silenced = isSilenced(p);

    const gongfaItems: GongfaActionItem[] = [];
    if (!silenced && !prevent.prevented) {
      for (let i = 0; i < p.gongfaSlots.length; i++) {
        const gf = p.gongfaSlots[i];
        if (!gf || !gf.function || gf.function.type !== "主动") continue;
        if (p.currentMp < (gf.function.mpCost ?? 0)) continue;

        const hasOffensive = gf.function.components.some(c => {
          if (!c.mechanic) return false;
          return c.mechanic.startsWith("dmg_") || c.mechanic.startsWith("debuff_") || c.mechanic.startsWith("cc_");
        });

        gongfaItems.push({
          gongfaIndex: i,
          name: `${gf.name}·${gf.function.name}`,
          mpCost: gf.function.mpCost ?? 0,
          needTarget: hasOffensive,
          targetTeam: hasOffensive ? "enemy" : "ally",
          description: gf.function.components.map(c => c.desc).join("，"),
        });
      }
    }

    const elixirItems: ElixirActionItem[] = [];
    if (!prevent.prevented) {
      for (let i = 0; i < p.availableElixirs.length; i++) {
        const el = p.availableElixirs[i];
        if (el.count <= 0) continue;
        if (el.effectType !== "恢复血量" && el.effectType !== "恢复法力") continue;
        elixirItems.push({
          elixirIndex: i,
          name: el.name,
          effectType: el.effectType,
          count: el.count,
          description: `${el.effectType}${el.effects.isPercent ? el.effects.value + "%" : el.effects.value + "点"}`,
        });
      }
    }

    return {
      canNormalAttack: !prevent.prevented,
      gongfaItems,
      elixirItems,
      canFlee: !prevent.prevented,
    };
  }

  function selectAction(action: BattleAction): void {
    const s = state.value;
    if (!s || s.phase !== "player_action") return;
    s.pendingAction = action;
    s.phase = "target_selection";
  }

  function selectTarget(targetId: string): void {
    const s = state.value;
    if (!s || s.phase !== "target_selection" || !s.pendingAction) return;
    s.selectedTargetId = targetId;

    const action = s.pendingAction;
    if (action.type !== "flee" && action.type !== "elixir") {
      (action as { targetId: string }).targetId = targetId;
    }

    executePlayerAction(action);
  }

  function executePlayerAction(action: BattleAction): void {
    const s = state.value;
    if (!s) return;
    resolving.value = true;
    s.phase = "resolving";

    const p = s.allies.find(a => a.isProtagonist && !a.isDead);
    if (!p) {
      resolving.value = false;
      return;
    }

    p.actedThisTurn = true;
    const { entries, fled } = resolveAction(action, p, s.allies, s.enemies, s.turn);
    s.log.push(...entries);

    if (fled) {
      s.phase = "fled";
      state.value = s;
      finishBattle();
      resolving.value = false;
      return;
    }

    const endCheck = checkBattleEnd(s);
    if (endCheck.ended && endCheck.outcome) {
      s.phase = endCheck.outcome;
      state.value = s;
      finishBattle();
      resolving.value = false;
      return;
    }

    processAllyAI();
  }

  function processAllyAI(): void {
    const s = state.value;
    if (!s) return;
    s.phase = "ally_ai";

    const allyNpcs = s.allies.filter(a => !a.isProtagonist && !a.isDead && !a.actedThisTurn);

    for (const npc of allyNpcs) {
      npc.actedThisTurn = true;
      const action = chooseNpcAction(npc, s.allies, s.enemies);

      if (action.type === "normal_attack" || action.type === "magic_attack") {
        if (!action.targetId) {
          const aliveEnemies = getAliveEnemies(s.enemies);
          if (aliveEnemies.length > 0) {
            action.targetId = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)].id;
          }
        }
      }

      const { entries } = resolveAction(action, npc, s.allies, s.enemies, s.turn);
      s.log.push(...entries);

      const endCheck = checkBattleEnd(s);
      if (endCheck.ended && endCheck.outcome) {
        s.phase = endCheck.outcome;
        state.value = s;
        finishBattle();
        resolving.value = false;
        return;
      }
    }

    processEnemyAI();
  }

  function processEnemyAI(): void {
    const s = state.value;
    if (!s) return;
    s.phase = "enemy_ai";

    const aliveEnemies = getAliveEnemies(s.enemies);

    for (const enemy of aliveEnemies) {
      enemy.actedThisTurn = true;
      const action = chooseNpcAction(enemy, s.enemies, s.allies);

      if (action.type === "normal_attack" || action.type === "magic_attack") {
        if (!action.targetId) {
          const aliveAllies = getAliveAllies(s.allies);
          if (aliveAllies.length > 0) {
            action.targetId = aliveAllies[Math.floor(Math.random() * aliveAllies.length)].id;
          }
        }
      }

      const { entries, fled } = resolveAction(action, enemy, s.enemies, s.allies, s.turn);
      s.log.push(...entries);

      if (fled) continue;

      const endCheck = checkBattleEnd(s);
      if (endCheck.ended && endCheck.outcome) {
        s.phase = endCheck.outcome;
        state.value = s;
        finishBattle();
        resolving.value = false;
        return;
      }
    }

    endTurn();
  }

  function endTurn(): void {
    const s = state.value;
    if (!s) return;
    s.phase = "turn_end";

    const endEntries = processTurnEnd(s.allies, s.enemies, s.turn);
    s.log.push(...endEntries);

    const endCheck = checkBattleEnd(s);
    if (endCheck.ended && endCheck.outcome) {
      s.phase = endCheck.outcome;
      state.value = s;
      finishBattle();
      resolving.value = false;
      return;
    }

    s.turn += 1;
    s.phase = "turn_start";

    const startEntries = processTurnStart(s.allies, s.enemies, s.turn);
    s.log.push(...startEntries);

    const startEndCheck = checkBattleEnd(s);
    if (startEndCheck.ended && startEndCheck.outcome) {
      s.phase = startEndCheck.outcome;
      state.value = s;
      finishBattle();
      resolving.value = false;
      return;
    }

    s.phase = "player_action";
    s.pendingAction = null;
    s.selectedTargetId = null;
    s.actionSubmenu = null;
    state.value = s;
    resolving.value = false;
  }

  function finishBattle(): void {
    const s = state.value;
    if (!s) return;
    result.value = settleBattle(s);
  }

  function clearBattle(): void {
    state.value = null;
    result.value = null;
    resolving.value = false;
  }

  return {
    state,
    result,
    resolving,
    startBattle,
    selectAction,
    selectTarget,
    getPlayerActionOptions,
    clearBattle,
  };
}
