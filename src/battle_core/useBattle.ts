import { ref, type Ref } from "vue";
import type {
  BattleState,
  BattleAction,
  BattleResult,
  BattleCombatant,
  GongfaActionItem,
  ElixirActionItem,
} from "./types";

import type { BattleTriggerEntry } from "../ai/state_generate";
import { BattleEngine } from "./BattleEngine";
import { createBattleCombatants } from "./battleInit";
import { settleBattle } from "./battleSettle";
import { gameLog } from "../log/gameLog";

export function useBattle() {
  const engine: Ref<BattleEngine | null> = ref(null);
  const state: Ref<BattleState | null> = ref(null);
  const result: Ref<BattleResult | null> = ref(null);
  const resolving = ref(false);

  function startBattle(triggerEntry: BattleTriggerEntry): void {
    const { allies, enemies } = createBattleCombatants(triggerEntry);
    gameLog.info(`[useBattle] createBattleCombatants 完成: allies=${allies.length}, enemies=${enemies.length}`);

    if (enemies.length === 0) {
      throw new Error(`战斗初始化失败：未找到敌方参战者。triggerEntry.enemies=${JSON.stringify(triggerEntry.enemies.map(e => e.displayName))}，请检查 NPC 是否已写入 npcStore`);
    }

    if (allies.length === 0) {
      throw new Error("战斗初始化失败：未找到主角参战者");
    }

    const e = new BattleEngine();
    e.init(allies, enemies, triggerEntry);
    engine.value = e;
    state.value = e.state;
    result.value = null;

    gameLog.info(`[useBattle] BattleEngine.init 完成: phase=${e.state.phase}, turn=${e.state.turn}`);
  }

  function getPlayerActionOptions(): {
    canNormalAttack: boolean;
    canMagicAttack: boolean;
    gongfaItems: GongfaActionItem[];
    elixirItems: ElixirActionItem[];
    canFlee: boolean;
  } {
    const e = engine.value;
    if (!e) return { canNormalAttack: false, canMagicAttack: false, gongfaItems: [], elixirItems: [], canFlee: false };
    return e.getPlayerActionOptions();
  }

  function selectAction(action: BattleAction): void {
    const s = state.value;
    if (!s || s.phase !== "player_action") return;
    s.pendingAction = action;
    s.phase = "target_selection";
  }

  function selectTarget(targetId: string): void {
    const s = state.value;
    const e = engine.value;
    if (!s || !e || s.phase !== "target_selection" || !s.pendingAction) return;
    s.selectedTargetId = targetId;

    const action = s.pendingAction;
    if (action.type !== "flee" && action.type !== "elixir") {
      (action as { targetId: string }).targetId = targetId;
    }

    resolving.value = true;
    executePlayerAction(action);
  }

  function executePlayerAction(action: BattleAction): void {
    const e = engine.value;
    if (!e) {
      resolving.value = false;
      return;
    }

    e.submitPlayerAction(action);
    state.value = e.state;

    if (isBattleOver()) {
      finishBattle();
    }

    resolving.value = false;
  }

  function isBattleOver(): boolean {
    const phase = state.value?.phase;
    return phase === "victory" || phase === "defeat" || phase === "fled" || phase === "draw";
  }

  function finishBattle(): void {
    const e = engine.value;
    const s = state.value;
    if (!e || !s) return;
    result.value = settleBattle(s);
  }

  function clearBattle(): void {
    engine.value = null;
    state.value = null;
    result.value = null;
    resolving.value = false;
  }

  return {
    engine,
    state,
    result,
    resolving,
    startBattle,
    selectAction,
    selectTarget,
    getPlayerActionOptions,
    clearBattle,
    isBattleOver,
  };
}
