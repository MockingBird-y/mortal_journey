import type {
  EquippedSlotsState,
  GongfaSlotsState,
  CultivationRealm,
  PowerTier,
  PrimaryStatKey,
} from "../role_core/types/playInfo";

import type {
  MechanicId,
  MechanicCategory,
  StatusId,
  EffectComponent,
} from "../role_core/types/combatMechanics";

import type { ItemGrade, ElixirItemDefinition } from "../role_core/types/itemInfo";

import type { GongfaSystem } from "../role_core/types/gongfa";

import type { BattleTriggerEntry } from "../ai/state_generate";

import type { ElixirEffectType } from "../role_core/types/elixir";

// ═══════════════════════════════════════════════════════════════
// 伤害类型
// ═══════════════════════════════════════════════════════════════

export type DamageType = "physical" | "magical" | "true";

// ═══════════════════════════════════════════════════════════════
// 战斗事件
// ═══════════════════════════════════════════════════════════════

export type BattleEvent =
  | "battle_start"
  | "turn_start"
  | "turn_end"
  | "action_start"
  | "action_end"
  | "pre_damage"
  | "damage_dealt"
  | "damage_taken"
  | "heal"
  | "crit"
  | "dodge"
  | "kill"
  | "death"
  | "fatal"
  | "buff_applied"
  | "debuff_applied"
  | "effect_expire"
  | "battle_end";

// ═══════════════════════════════════════════════════════════════
// 战斗阶段（UI 用）
// ═══════════════════════════════════════════════════════════════

export type BattlePhase =
  | "init"
  | "running"
  | "player_action"
  | "target_selection"
  | "victory"
  | "defeat"
  | "fled"
  | "draw";

// ═══════════════════════════════════════════════════════════════
// 战斗结局
// ═══════════════════════════════════════════════════════════════

export type BattleOutcome = "victory" | "defeat" | "fled" | "draw";

// ═══════════════════════════════════════════════════════════════
// 伤害上下文 / 结果
// ═══════════════════════════════════════════════════════════════

export interface DamageContext {
  source: BattleCombatant;
  target: BattleCombatant;
  rawDamage: number;
  damageType: DamageType;
  isCrit: boolean;
  isReflected?: boolean;
}

export interface DamageResult {
  finalDamage: number;
  shieldAbsorbed: number;
  hpLost: number;
  killed: boolean;
  dodged: boolean;
  effectiveDefense: number;
  reductionPercent: number;
  markBonus: number;
  deathWardTriggered: boolean;
  reflectHpLost: number;
  reflectKilled: boolean;
  counterHpLost: number;
  counterKilled: boolean;
  sharedDamages: Array<{
    targetId: string;
    targetName: string;
    hpLost: number;
    killed: boolean;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// 行动类型
// ═══════════════════════════════════════════════════════════════

export type BattleAction =
  | { type: "normal_attack"; targetId: string }
  | { type: "magic_attack"; targetId: string }
  | { type: "gongfa"; gongfaIndex: number; targetId: string }
  | { type: "elixir"; elixirIndex: number }
  | { type: "flee" };

// ═══════════════════════════════════════════════════════════════
// 行动上下文
// ═══════════════════════════════════════════════════════════════

export interface ActionContext {
  actor: BattleCombatant;
  action: BattleAction;
  allies: BattleCombatant[];
  enemies: BattleCombatant[];
  turn: number;
  target?: BattleCombatant;
  gongfaGrade?: ItemGrade;
  gongfaSystem?: GongfaSystem;
  gongfaMastery?: number;
  currentComponent?: EffectComponent;
}

// ═══════════════════════════════════════════════════════════════
// 事件上下文 / 处理器
// ═══════════════════════════════════════════════════════════════

export interface EventContext {
  event: BattleEvent;
  source?: BattleCombatant;
  target?: BattleCombatant;
  actor?: BattleCombatant;
  damage?: DamageResult;
  action?: BattleAction;
  allies: BattleCombatant[];
  enemies: BattleCombatant[];
  turn: number;
}

export type EventHandler = (ctx: EventContext) => void;

// ═══════════════════════════════════════════════════════════════
// 条件函数
// ═══════════════════════════════════════════════════════════════

export type ConditionFn = (ctx: ActionContext) => boolean;

// ═══════════════════════════════════════════════════════════════
// Mechanic 处理器
// ═══════════════════════════════════════════════════════════════

export interface MechanicHandler {
  mechanic: MechanicId;
  execute(ctx: ActionContext, engine: BattleEngineLike): BattleLogEntry[];
}

export interface BattleEngineLike {
  readonly damagePipeline: import("./DamagePipeline").DamagePipeline;
  readonly effectManager: import("./EffectManager").EffectManager;
  readonly eventDispatcher: import("./EventDispatcher").EventDispatcher;
  readonly conditionEvaluator: import("./ConditionEvaluator").ConditionEvaluator;
  readonly mechanicRegistry: import("./MechanicRegistry").MechanicRegistry;
  getEffectiveStat(combatant: BattleCombatant, stat: BattleStatKey): number;
  addLog(entry: BattleLogEntry): void;
  addLogEntries(entries: BattleLogEntry[]): void;
  findCombatant(id: string): BattleCombatant | undefined;
  getAllCombatants(): BattleCombatant[];
  applyMpChange(target: BattleCombatant, delta: number): number;
  applyHeal(target: BattleCombatant, rawHeal: number): number;
  addSecondaryDamageLogs(result: DamageResult, source: BattleCombatant, target: BattleCombatant, turn: number): void;
}

// ═══════════════════════════════════════════════════════════════
// 状态效果（增强版）
// ═══════════════════════════════════════════════════════════════

export type EffectCategory = "buff" | "debuff" | "cc" | "dot" | "hot" | "special";

export interface ActiveStatusEffect {
  id: string;
  name: string;
  sourceCombatantId: string;
  mechanic?: MechanicId;
  category: EffectCategory;
  statKey?: string;
  value: number;
  isPercent: boolean;
  remainingTurns: number;
  status?: StatusId;
  stacks: number;
  maxStacks: number;
  canStack: boolean;
  tickValue?: number;
  tickIsPercent?: boolean;
  tickStatKey?: "currentHp" | "maxHp" | "currentMp";
}

// ═══════════════════════════════════════════════════════════════
// 被动触发器
// ═══════════════════════════════════════════════════════════════

export interface PassiveTrigger {
  sourceType: "treasure" | "gongfa";
  sourceName: string;
  effectName: string;
  component: EffectComponent;
  grade: ItemGrade;
  system?: GongfaSystem;
  mastery?: number;
}

// ═══════════════════════════════════════════════════════════════
// 召唤物
// ═══════════════════════════════════════════════════════════════

export interface BattleSummon {
  id: string;
  name: string;
  ownerCombatantId: string;
  damagePerTurn: number;
  remainingTurns: number;
  targetStrategy: "random" | "lowest_hp";
}

// ═══════════════════════════════════════════════════════════════
// 战斗衍生属性（仅战斗时存在，由主属性推导或默认值）
// ═══════════════════════════════════════════════════════════════

export interface BattleCombatStats {
  critRate: number;
  critDmg: number;
}

export type BattleStatKey = PrimaryStatKey | keyof BattleCombatStats;

// ═══════════════════════════════════════════════════════════════
// 战斗者
// ═══════════════════════════════════════════════════════════════

export interface BattleCombatant {
  id: string;
  displayName: string;
  team: "ally" | "enemy";
  isProtagonist: boolean;
  isPlayerControlled: boolean;

  stats: Record<PrimaryStatKey, number>;
  combatStats: BattleCombatStats;
  speed: number;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  shield: number;
  isDead: boolean;

  realm: CultivationRealm;
  powerTier?: PowerTier;
  identity?: string;

  equippedSlots: EquippedSlotsState;
  gongfaSlots: GongfaSlotsState;
  cooldowns: number[];
  availableElixirs: ElixirItemDefinition[];

  activeEffects: ActiveStatusEffect[];
  passiveTriggers: PassiveTrigger[];
  summons: BattleSummon[];
  sourceNpcName?: string;
}

// ═══════════════════════════════════════════════════════════════
// 功法 / 丹药行动项（UI 用）
// ═══════════════════════════════════════════════════════════════

export interface GongfaActionItem {
  gongfaIndex: number;
  name: string;
  mpCost: number;
  needTarget: boolean;
  targetTeam: "ally" | "enemy";
  description: string;
  cooldown: number;
}

export interface ElixirActionItem {
  elixirIndex: number;
  name: string;
  effectType: ElixirEffectType;
  count: number;
  description: string;
}

// ═══════════════════════════════════════════════════════════════
// 日志
// ═══════════════════════════════════════════════════════════════

export type BattleLogType =
  | "damage"
  | "heal"
  | "shield"
  | "buff"
  | "debuff"
  | "cc"
  | "dot"
  | "miss"
  | "crit"
  | "flee_success"
  | "flee_fail"
  | "death"
  | "summon"
  | "info";

export interface BattleLogEntry {
  turn: number;
  actorName: string;
  action: string;
  targetName?: string;
  type: BattleLogType;
  value?: number;
  extra?: string;
  narrative: string;
  team?: "ally" | "enemy";
}

// ═══════════════════════════════════════════════════════════════
// 战斗状态
// ═══════════════════════════════════════════════════════════════

export interface BattleState {
  phase: BattlePhase;
  turn: number;
  allies: BattleCombatant[];
  enemies: BattleCombatant[];
  turnOrder: string[];
  currentActorId: string | null;
  log: BattleLogEntry[];
  triggerEntry: BattleTriggerEntry;
  pendingAction: BattleAction | null;
  selectedTargetId: string | null;
  maxTurns: number;
}

// ═══════════════════════════════════════════════════════════════
// 战斗结果
// ═══════════════════════════════════════════════════════════════

export interface BattleResult {
  outcome: BattleOutcome;
  turn: number;
  protagonistHpPercent: number;
  protagonistMpPercent: number;
  elixirsUsed: { name: string; count: number }[];
  enemiesKilled: string[];
  triggerReason: string;
  allyNames: string[];
  enemyNames: string[];
  triggerKind: "active" | "passive";
}
