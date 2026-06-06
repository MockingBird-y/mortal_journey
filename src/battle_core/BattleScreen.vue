<script setup lang="ts">
import { computed, ref, nextTick, watch } from "vue";
import type { BattleTriggerEntry } from "../ai/state_generate";
import type { BattleAction, BattleCombatant, BattleResult, GongfaActionItem, ElixirActionItem } from "../battle_core/battleTypes";
import { useBattle } from "../battle_core/useBattle";
import { getAliveEnemies, findCombatantById } from "../battle_core/battleEngine";
import { gameLog } from "../log/gameLog";
import { useScrollLock } from "../composables/useScrollLock";

const props = defineProps<{
  trigger: BattleTriggerEntry | null;
}>();

const emit = defineEmits<{
  battleEnd: [result: BattleResult | null];
}>();

const { state, result, resolving, startBattle, selectAction, selectTarget, getPlayerActionOptions, clearBattle } = useBattle();

const scrollLock = useScrollLock();

const logContainer = ref<HTMLElement | null>(null);
const initError = ref<string | null>(null);

watch(() => props.trigger, (entry) => {
  if (entry) {
    scrollLock.acquire();
    try {
      initError.value = null;
      startBattle(entry);
      gameLog.info("[BattleScreen] 战斗初始化成功，state.phase=" + state.value?.phase);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      initError.value = msg;
      gameLog.error("[BattleScreen] 战斗初始化失败: " + msg);
      console.error("[BattleScreen] startBattle error:", e);
    }
  }
}, { immediate: true });

const isPlayerTurn = computed(() => {
  return state.value?.phase === "player_action";
});

const isTargetSelection = computed(() => {
  return state.value?.phase === "target_selection";
});

const isBattleOver = computed(() => {
  const phase = state.value?.phase;
  return phase === "victory" || phase === "defeat" || phase === "fled" || phase === "draw";
});

const actionOptions = computed(() => {
  if (!isPlayerTurn.value) return null;
  return getPlayerActionOptions();
});

const needsTarget = computed(() => {
  const action = state.value?.pendingAction;
  if (!action) return false;
  if (action.type === "flee" || action.type === "elixir") return false;
  return true;
});

const targetTeam = computed((): "ally" | "enemy" => {
  const action = state.value?.pendingAction;
  if (!action) return "enemy";
  if (action.type === "gongfa") {
    const p = state.value!.allies.find(a => a.isProtagonist);
    if (p) {
      const gf = p.gongfaSlots[action.gongfaIndex];
      if (gf?.function) {
        const hasOffensive = gf.function.components.some(c => c.mechanic?.startsWith("dmg_") || c.mechanic?.startsWith("debuff_") || c.mechanic?.startsWith("cc_"));
        return hasOffensive ? "enemy" : "ally";
      }
    }
  }
  return "enemy";
});

function onNormalAttack() {
  selectAction({ type: "normal_attack", targetId: "" });
}

function onGongfaSelect(item: GongfaActionItem) {
  if (item.needTarget) {
    selectAction({ type: "gongfa", gongfaIndex: item.gongfaIndex, targetId: "" });
  } else {
    const p = state.value?.allies.find(a => a.isProtagonist);
    if (p) {
      selectTarget(p.id);
    }
  }
}

function onElixirSelect(item: ElixirActionItem) {
  selectAction({ type: "elixir", elixirIndex: item.elixirIndex });
  const s = state.value;
  if (s && s.pendingAction && s.pendingAction.type === "elixir") {
    const p = s.allies.find(a => a.isProtagonist);
    if (p) {
      selectTarget(p.id);
    }
  }
}

function onFlee() {
  selectAction({ type: "flee" });
  const s = state.value;
  if (s && s.pendingAction && s.pendingAction.type === "flee") {
    selectTarget("");
  }
}

function onTargetClick(combatantId: string) {
  selectTarget(combatantId);
}

function onBattleEnd() {
  const r = result.value;
  clearBattle();
  emit("battleEnd", r);
}

watch(() => state.value?.log.length, async () => {
  await nextTick();
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
});

function hpBarClass(combatant: BattleCombatant): string {
  const pct = combatant.maxHp > 0 ? combatant.currentHp / combatant.maxHp : 0;
  if (pct > 0.6) return "battle__hp-bar--high";
  if (pct > 0.3) return "battle__hp-bar--mid";
  return "battle__hp-bar--low";
}

function mpBarClass(): string {
  return "battle__mp-bar";
}

function logAlignClass(team?: string): string {
  if (team === "ally") return "battle__log-entry--ally";
  if (team === "enemy") return "battle__log-entry--enemy";
  return "";
}

function logTypeClass(type: string): string {
  switch (type) {
    case "damage": case "dot": return "battle__log--damage";
    case "crit": return "battle__log--crit";
    case "heal": return "battle__log--heal";
    case "shield": case "buff": return "battle__log--buff";
    case "debuff": case "cc": return "battle__log--debuff";
    case "miss": return "battle__log--miss";
    case "death": return "battle__log--death";
    case "flee_success": case "flee_fail": return "battle__log--flee";
    default: return "battle__log--info";
  }
}

function logIcon(type: string): string {
  switch (type) {
    case "damage": case "dot": case "crit": return "⚔";
    case "heal": return "💚";
    case "shield": return "🛡";
    case "buff": return "⬆";
    case "debuff": return "⬇";
    case "cc": return "❄";
    case "miss": return "💨";
    case "death": return "💀";
    case "flee_success": return "🏃";
    case "flee_fail": return "✋";
    case "summon": return "✨";
    default: return "•";
  }
}

const gongfaSubmenuOpen = ref(false);
const elixirSubmenuOpen = ref(false);

function toggleGongfaSubmenu() {
  gongfaSubmenuOpen.value = !gongfaSubmenuOpen.value;
  elixirSubmenuOpen.value = false;
}

function toggleElixirSubmenu() {
  elixirSubmenuOpen.value = !elixirSubmenuOpen.value;
  gongfaSubmenuOpen.value = false;
}

function closeSubmenus() {
  gongfaSubmenuOpen.value = false;
  elixirSubmenuOpen.value = false;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="mj-backdrop">
      <div class="battle-backdrop" v-if="state || initError">
        <Transition name="mj-modal" appear>
          <div class="battle-dialog">
            <template v-if="initError">
              <div class="battle__overlay">
                <div class="battle__result">
                  <h2>⚠ 战斗初始化失败</h2>
                  <p>{{ initError }}</p>
                  <button class="battle__action-btn" @click="onBattleEnd">返回</button>
                </div>
              </div>
            </template>
            <template v-else-if="state">
            <header class="battle__header">
              <h2 class="battle__title">⚔ 战斗 — 第 {{ state.turn }} 回合</h2>
              <span class="battle__phase">
                <template v-if="isPlayerTurn">你的回合</template>
                <template v-else-if="isTargetSelection">选择目标</template>
                <template v-else-if="resolving">结算中…</template>
                <template v-else-if="state.phase === 'ally_ai'">友方行动</template>
                <template v-else-if="state.phase === 'enemy_ai'">敌方行动</template>
              </span>
            </header>

            <div class="battle__body">
              <aside class="battle__actions">
                <template v-if="isPlayerTurn && actionOptions">
                  <button class="battle__action-btn" @click="onNormalAttack" :disabled="!actionOptions.canNormalAttack">
                    ⚔ 普通攻击
                  </button>
                  <div class="battle__action-group">
                    <button class="battle__action-btn" @click="toggleGongfaSubmenu" :disabled="actionOptions.gongfaItems.length === 0">
                      📜 功法攻击 {{ gongfaSubmenuOpen ? '▲' : '▼' }}
                    </button>
                    <div v-if="gongfaSubmenuOpen" class="battle__submenu">
                      <button
                        v-for="item in actionOptions.gongfaItems"
                        :key="item.gongfaIndex"
                        class="battle__submenu-item"
                        @click="onGongfaSelect(item)"
                      >
                        {{ item.name }} <span class="battle__mp-cost">MP:{{ item.mpCost }}</span>
                      </button>
                    </div>
                  </div>
                  <div class="battle__action-group">
                    <button class="battle__action-btn" @click="toggleElixirSubmenu" :disabled="actionOptions.elixirItems.length === 0">
                      💊 恢复丹药 {{ elixirSubmenuOpen ? '▲' : '▼' }}
                    </button>
                    <div v-if="elixirSubmenuOpen" class="battle__submenu">
                      <button
                        v-for="item in actionOptions.elixirItems"
                        :key="item.elixirIndex"
                        class="battle__submenu-item"
                        @click="onElixirSelect(item)"
                      >
                        {{ item.name }} ×{{ item.count }}
                      </button>
                    </div>
                  </div>
                  <button class="battle__action-btn battle__action-btn--flee" @click="onFlee" :disabled="!actionOptions.canFlee">
                    🏃 逃跑
                  </button>
                </template>
                <template v-else-if="!isBattleOver">
                  <p class="battle__action-wait">等待中…</p>
                </template>
              </aside>

              <aside class="battle__team battle__team--ally">
                <h3 class="battle__team-title">我方</h3>
                <div
                  v-for="ally in state.allies"
                  :key="ally.id"
                  class="battle__card"
                  :class="{
                    'battle__card--dead': ally.isDead,
                    'battle__card--selectable': isTargetSelection && targetTeam === 'ally' && !ally.isDead,
                    'battle__card--protagonist': ally.isProtagonist,
                  }"
                  @click="isTargetSelection && targetTeam === 'ally' && !ally.isDead && onTargetClick(ally.id)"
                >
                  <div class="battle__card-name">
                    {{ ally.displayName }}
                    <span v-if="ally.isProtagonist" class="battle__card-badge">主角</span>
                  </div>
                  <div class="battle__card-identity" v-if="ally.identity">{{ ally.identity }}</div>
                  <div class="battle__bar-row">
                    <span class="battle__bar-label">HP</span>
                    <div class="battle__bar"><div class="battle__bar-fill" :class="hpBarClass(ally)" :style="{ width: (ally.maxHp > 0 ? ally.currentHp / ally.maxHp * 100 : 0) + '%' }"></div></div>
                    <span class="battle__bar-value">{{ ally.currentHp }}/{{ ally.maxHp }}</span>
                  </div>
                  <div class="battle__bar-row">
                    <span class="battle__bar-label">MP</span>
                    <div class="battle__bar"><div class="battle__bar-fill battle__mp-bar" :style="{ width: (ally.maxMp > 0 ? ally.currentMp / ally.maxMp * 100 : 0) + '%' }"></div></div>
                    <span class="battle__bar-value">{{ ally.currentMp }}/{{ ally.maxMp }}</span>
                  </div>
                  <div v-if="ally.shield > 0" class="battle__card-shield">🛡 {{ ally.shield }}</div>
                  <div v-if="ally.activeEffects.length > 0" class="battle__card-effects">
                    <span v-for="eff in ally.activeEffects" :key="eff.id" class="battle__effect-tag" :class="'battle__effect-tag--' + eff.category">
                      {{ eff.name }}({{ eff.remainingTurns }})
                    </span>
                  </div>
                </div>
              </aside>

              <main class="battle__log-area" ref="logContainer">
                <div v-for="(entry, idx) in state.log" :key="idx" class="battle__log-entry" :class="[logTypeClass(entry.type), logAlignClass(entry.team)]">
                  <span class="battle__log-icon">{{ logIcon(entry.type) }}</span>
                  <span class="battle__log-text">{{ entry.narrative }}</span>
                </div>
              </main>

              <aside class="battle__team battle__team--enemy">
                <h3 class="battle__team-title">敌方</h3>
                <div
                  v-for="enemy in state.enemies"
                  :key="enemy.id"
                  class="battle__card"
                  :class="{
                    'battle__card--dead': enemy.isDead,
                    'battle__card--selectable': isTargetSelection && targetTeam === 'enemy' && !enemy.isDead,
                  }"
                  @click="isTargetSelection && targetTeam === 'enemy' && !enemy.isDead && onTargetClick(enemy.id)"
                >
                  <div class="battle__card-name">
                    {{ enemy.displayName }}
                    <span v-if="enemy.powerTier" class="battle__card-badge battle__card-badge--{{ enemy.powerTier }}">{{ enemy.powerTier }}</span>
                  </div>
                  <div class="battle__card-identity" v-if="enemy.identity">{{ enemy.identity }}</div>
                  <div class="battle__bar-row">
                    <span class="battle__bar-label">HP</span>
                    <div class="battle__bar"><div class="battle__bar-fill" :class="hpBarClass(enemy)" :style="{ width: (enemy.maxHp > 0 ? enemy.currentHp / enemy.maxHp * 100 : 0) + '%' }"></div></div>
                    <span class="battle__bar-value">{{ enemy.currentHp }}/{{ enemy.maxHp }}</span>
                  </div>
                  <div class="battle__bar-row">
                    <span class="battle__bar-label">MP</span>
                    <div class="battle__bar"><div class="battle__bar-fill battle__mp-bar" :style="{ width: (enemy.maxMp > 0 ? enemy.currentMp / enemy.maxMp * 100 : 0) + '%' }"></div></div>
                    <span class="battle__bar-value">{{ enemy.currentMp }}/{{ enemy.maxMp }}</span>
                  </div>
                  <div v-if="enemy.shield > 0" class="battle__card-shield">🛡 {{ enemy.shield }}</div>
                  <div v-if="enemy.activeEffects.length > 0" class="battle__card-effects">
                    <span v-for="eff in enemy.activeEffects" :key="eff.id" class="battle__effect-tag" :class="'battle__effect-tag--' + eff.category">
                      {{ eff.name }}({{ eff.remainingTurns }})
                    </span>
                  </div>
                </div>
              </aside>
            </div>

            <div v-if="isBattleOver" class="battle__overlay">
              <div class="battle__result">
                <h2 v-if="state.phase === 'victory'">🎉 战斗胜利！</h2>
                <h2 v-else-if="state.phase === 'defeat'">💀 战斗失败</h2>
                <h2 v-else-if="state.phase === 'fled'">🏃 成功撤退</h2>
                <h2 v-else>⚖ 战斗平局</h2>
                <p v-if="result">共 {{ result.turn }} 回合 | 主角 HP: {{ result.protagonistHpPercent }}% | MP: {{ result.protagonistMpPercent }}%</p>
                <p v-if="result && result.enemiesKilled.length > 0">击杀：{{ result.enemiesKilled.join("、") }}</p>
                <button class="battle__action-btn" @click="onBattleEnd">返回</button>
              </div>
            </div>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
