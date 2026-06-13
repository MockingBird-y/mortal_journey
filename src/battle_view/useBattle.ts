import { ref, type Ref } from "vue";
import type {
  BattleState,
  BattleAction,
  BattleResult,
  ActionOptions,
} from "../battle_engine/types";

import type { BattleTriggerEntry } from "../ai/state_generate";
import { BattleEngine } from "../battle_engine/BattleEngine";
import { createBattleCombatants } from "../battle_engine/battleInit";
import { settleBattle } from "../battle_engine/battleSettle";
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

    gameLog.info(`[useBattle] BattleEngine.init 完成: phase=${e.state.phase}, actionCount=${e.state.actionCount}`);
  }

  function getPlayerActionOptions(): ActionOptions {
    const e = engine.value;
    if (!e) return { canNormalAttack: false, canFlee: false, skills: [], elixirs: [] };
    return e.getPlayerActionOptions();
  }

  function selectAction(action: BattleAction): void {
    const s = state.value;
    const e = engine.value;
    if (!s || s.phase !== "playerAction") return;
    s.pendingAction = action;

    if (action.type === "normalAttack" || action.type === "skill") {
      if (e) {
        const actor = e.findCombatant(s.activeCombatantId ?? "");
        if (actor && e.effectManager.isFeared(actor)) {
          const allTargets = e.getAllCombatants().filter(c => !c.isDead && c.id !== actor.id);
          if (allTargets.length > 0) {
            const randomTarget = allTargets[Math.floor(Math.random() * allTargets.length)];
            s.phase = "targetSelection";
            selectTarget(randomTarget.id);
            return;
          }
        }
      }
    }

    if (action.type === "flee" || action.type === "elixir") {
      s.phase = "targetSelection";
      if (action.type === "elixir") {
        const currentActorId = s.activeCombatantId;
        if (currentActorId) selectTarget(currentActorId);
      } else {
        selectTarget("");
      }
      return;
    }

    if (action.type === "skill") {
      const opts = getPlayerActionOptions();
      const skillItem = opts.skills.find(sk => sk.skillIndex === action.skillIndex);
      if (skillItem && !skillItem.needTarget) {
        const currentActorId = s.activeCombatantId;
        if (currentActorId) {
          selectTarget(currentActorId);
          return;
        }
      }
    }

    s.phase = "targetSelection";
  }

  function selectTarget(targetId: string): void {
    const s = state.value;
    const e = engine.value;
    if (!s || !e || s.phase !== "targetSelection" || !s.pendingAction) return;
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
    return phase === "victory" || phase === "defeat" || phase === "fled";
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
