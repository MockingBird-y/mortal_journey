<script setup lang="ts">
import { computed, ref, nextTick, watch } from "vue";
import type { BattleTriggerEntry } from "../ai/state_generate";
import type { BattleAction, BattleCombatant, BattleResult, SkillActionItem, ElixirActionItem } from "../battle_engine/types";
import { useBattle } from "./useBattle";
import { gameLog } from "../log/gameLog";
import { useScrollLock } from "../composables/useScrollLock";

const props = defineProps<{
  trigger: BattleTriggerEntry | null;
}>();

const emit = defineEmits<{
  battleEnd: [result: BattleResult | null];
}>();

const { engine, state, result, resolving, startBattle, selectAction, selectTarget, getPlayerActionOptions, clearBattle, isBattleOver } = useBattle();

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
  return state.value?.phase === "playerAction";
});

const isTargetSelection = computed(() => {
  return state.value?.phase === "targetSelection";
});

const battleOver = computed(() => {
  return isBattleOver();
});

const actionOptions = computed(() => {
  if (!isPlayerTurn.value) return null;
  return getPlayerActionOptions();
});

const targetTeam = computed((): "ally" | "enemy" => {
  const action = state.value?.pendingAction;
  if (!action) return "enemy";
  if (action.type === "skill") {
    const opts = actionOptions.value;
    const skillItem = opts?.skills.find(s => s.skillIndex === action.skillIndex);
    return skillItem?.targetTeam ?? "enemy";
  }
  return "enemy";
});

function onNormalAttack() {
  selectAction({ type: "normalAttack", targetId: "" });
}

function onSkillSelect(item: SkillActionItem) {
  if (item.needTarget) {
    selectAction({ type: "skill", skillIndex: item.skillIndex, targetId: "" });
  } else {
    const currentActorId = state.value?.activeCombatantId;
    if (currentActorId) {
      selectTarget(currentActorId);
    }
  }
}

function onElixirSelect(item: ElixirActionItem) {
  selectAction({ type: "elixir", elixirIndex: item.elixirIndex });
  const currentActorId = state.value?.activeCombatantId;
  if (currentActorId) {
    selectTarget(currentActorId);
  }
}

function onFlee() {
  selectAction({ type: "flee" });
  selectTarget("");
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
  const pct = combatant.stats.maxHp > 0 ? combatant.hp / combatant.stats.maxHp : 0;
  if (pct > 0.6) return "battle__hp-bar--high";
  if (pct > 0.3) return "battle__hp-bar--mid";
  return "battle__hp-bar--low";
}

function gaugePct(combatant: BattleCombatant): number {
  return Math.min(100, Math.max(0, combatant.actionGauge));
}

function gaugeBarClass(combatant: BattleCombatant): string {
  const g = combatant.actionGauge;
  if (g >= 100) return "battle__gauge-bar--full";
  if (g >= 60) return "battle__gauge-bar--high";
  if (g >= 30) return "battle__gauge-bar--mid";
  return "battle__gauge-bar--low";
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
    case "gauge": return "⏳";
    default: return "•";
  }
}

const skillSubmenuOpen = ref(false);
const elixirSubmenuOpen = ref(false);

function toggleSkillSubmenu() {
  skillSubmenuOpen.value = !skillSubmenuOpen.value;
  elixirSubmenuOpen.value = false;
}

function toggleElixirSubmenu() {
  elixirSubmenuOpen.value = !elixirSubmenuOpen.value;
  skillSubmenuOpen.value = false;
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
              <h2 class="battle__title">⚔ 战斗 — 行动 {{ state.actionCount }}</h2>
              <span class="battle__phase">
                <template v-if="isPlayerTurn">你的回合</template>
                <template v-else-if="isTargetSelection">选择目标</template>
                <template v-else-if="resolving">结算中…</template>
                <template v-else-if="state.phase === 'running'">战斗中…</template>
              </span>
            </header>

            <div class="battle__body">
              <aside class="battle__actions">
                <template v-if="isPlayerTurn && actionOptions">
                  <button class="battle__action-btn" @click="onNormalAttack" :disabled="!actionOptions.canNormalAttack">
                    ⚔ 普通攻击
                  </button>
                  <div class="battle__action-group">
                    <button class="battle__action-btn" @click="toggleSkillSubmenu" :disabled="actionOptions.skills.length === 0">
                      📜 技能 {{ skillSubmenuOpen ? '▲' : '▼' }}
                    </button>
                    <div v-if="skillSubmenuOpen" class="battle__submenu">
                      <button
                        v-for="item in actionOptions.skills"
                        :key="item.skillIndex"
                        class="battle__submenu-item"
                        @click="onSkillSelect(item)"
                      >
                        {{ item.name }} <span class="battle__mp-cost">MP:{{ item.mpCost }}</span>
                      </button>
                    </div>
                  </div>
                  <div class="battle__action-group">
                    <button class="battle__action-btn" @click="toggleElixirSubmenu" :disabled="actionOptions.elixirs.length === 0">
                      💊 恢复丹药 {{ elixirSubmenuOpen ? '▲' : '▼' }}
                    </button>
                    <div v-if="elixirSubmenuOpen" class="battle__submenu">
                      <button
                        v-for="item in actionOptions.elixirs"
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
                <template v-else-if="!battleOver">
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
                    {{ ally.name }}
                    <span v-if="ally.isProtagonist" class="battle__card-badge">主角</span>
                    <span v-if="ally.isFleeing" class="battle__card-badge battle__card-badge--flee">逃跑中</span>
                  </div>
                  <div class="battle__card-identity" v-if="ally.identity">{{ ally.identity }}</div>
                  <div class="battle__bar-row">
                    <span class="battle__bar-label">HP</span>
                    <div class="battle__bar"><div class="battle__bar-fill" :class="hpBarClass(ally)" :style="{ width: (ally.stats.maxHp > 0 ? ally.hp / ally.stats.maxHp * 100 : 0) + '%' }"></div></div>
                    <span class="battle__bar-value">{{ ally.hp }}/{{ ally.stats.maxHp }}</span>
                  </div>
                  <div class="battle__bar-row">
                    <span class="battle__bar-label">MP</span>
                    <div class="battle__bar"><div class="battle__bar-fill battle__mp-bar" :style="{ width: (ally.stats.maxMp > 0 ? ally.mp / ally.stats.maxMp * 100 : 0) + '%' }"></div></div>
                    <span class="battle__bar-value">{{ ally.mp }}/{{ ally.stats.maxMp }}</span>
                  </div>
                  <div class="battle__bar-row">
                    <span class="battle__bar-label">蓄力</span>
                    <div class="battle__bar"><div class="battle__bar-fill battle__gauge-fill" :class="gaugeBarClass(ally)" :style="{ width: gaugePct(ally) + '%' }"></div></div>
                    <span class="battle__bar-value">{{ Math.floor(ally.actionGauge) }}%</span>
                  </div>
                  <div v-if="ally.shield > 0" class="battle__card-shield">🛡 {{ ally.shield }}</div>
                  <div v-if="ally.effects.length > 0" class="battle__card-effects">
                    <span v-for="eff in ally.effects" :key="eff.id" class="battle__effect-tag" :class="'battle__effect-tag--' + eff.category">
                      {{ eff.name }}({{ eff.remainingDuration }})
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
                    {{ enemy.name }}
                    <span v-if="enemy.powerTier" class="battle__card-badge battle__card-badge--{{ enemy.powerTier }}">{{ enemy.powerTier }}</span>
                  </div>
                  <div class="battle__card-identity" v-if="enemy.identity">{{ enemy.identity }}</div>
                  <div class="battle__bar-row">
                    <span class="battle__bar-label">HP</span>
                    <div class="battle__bar"><div class="battle__bar-fill" :class="hpBarClass(enemy)" :style="{ width: (enemy.stats.maxHp > 0 ? enemy.hp / enemy.stats.maxHp * 100 : 0) + '%' }"></div></div>
                    <span class="battle__bar-value">{{ enemy.hp }}/{{ enemy.stats.maxHp }}</span>
                  </div>
                  <div class="battle__bar-row">
                    <span class="battle__bar-label">MP</span>
                    <div class="battle__bar"><div class="battle__bar-fill battle__mp-bar" :style="{ width: (enemy.stats.maxMp > 0 ? enemy.mp / enemy.stats.maxMp * 100 : 0) + '%' }"></div></div>
                    <span class="battle__bar-value">{{ enemy.mp }}/{{ enemy.stats.maxMp }}</span>
                  </div>
                  <div class="battle__bar-row">
                    <span class="battle__bar-label">蓄力</span>
                    <div class="battle__bar"><div class="battle__bar-fill battle__gauge-fill" :class="gaugeBarClass(enemy)" :style="{ width: gaugePct(enemy) + '%' }"></div></div>
                    <span class="battle__bar-value">{{ Math.floor(enemy.actionGauge) }}%</span>
                  </div>
                  <div v-if="enemy.shield > 0" class="battle__card-shield">🛡 {{ enemy.shield }}</div>
                  <div v-if="enemy.effects.length > 0" class="battle__card-effects">
                    <span v-for="eff in enemy.effects" :key="eff.id" class="battle__effect-tag" :class="'battle__effect-tag--' + eff.category">
                      {{ eff.name }}({{ eff.remainingDuration }})
                    </span>
                  </div>
                </div>
              </aside>
            </div>

            <div v-if="battleOver" class="battle__overlay">
              <div class="battle__result">
                <h2 v-if="state.phase === 'victory'">🎉 战斗胜利！</h2>
                <h2 v-else-if="state.phase === 'defeat'">💀 战斗失败</h2>
                <h2 v-else-if="state.phase === 'fled'">🏃 成功撤退</h2>
                <p v-if="result">共 {{ result.actionCount }} 次行动 | 主角 HP: {{ result.protagonistHpPercent }}% | MP: {{ result.protagonistMpPercent }}%</p>
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
