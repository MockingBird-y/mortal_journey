import type {
  PlayerBaseStats,
  EquippedSlotsState,
  GongfaSlotsState,
  CultivationRealm,
  PowerTier,
} from "../role_core/types/playInfo";

import type {
  MechanicId,
  MechanicCategory,
  StatusId,
  EffectComponent,
} from "../role_core/types/combatMechanics";

import type {
  ItemGrade,
  ElixirItemDefinition,
} from "../role_core/types/itemInfo";

import type {
  GongfaSystem,
} from "../role_core/types/gongfa";

export type { GongfaSpecialEffect } from "../role_core/types/gongfa";

import type {
  ElixirEffectType,
} from "../role_core/types/elixir";

import type {
  BattleTriggerEntry,
} from "../ai/state_generate";

export interface BattleSummon {
  id: string;
  name: string;
  ownerCombatantId: string;
  damagePerTurn: number;
  remainingTurns: number;
  targetStrategy: "random" | "lowest_hp";
}

export interface ActiveStatusEffect {
  id: string;
  name: string;
  sourceCombatantId: string;
  mechanic?: MechanicId;
  category: MechanicCategory;
  value: number;
  isPercent: boolean;
  remainingTurns: number;
  status?: StatusId;
  stacks: number;
  canStack: boolean;
}

export interface PassiveTrigger {
  sourceType: "treasure" | "gongfa";
  sourceName: string;
  effectName: string;
  component: EffectComponent;
  grade: ItemGrade;
  system?: GongfaSystem;
}

export interface BattleCombatant {
  id: string;
  displayName: string;
  team: "ally" | "enemy";
  isProtagonist: boolean;
  stats: PlayerBaseStats;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  equippedSlots: EquippedSlotsState;
  gongfaSlots: GongfaSlotsState;
  availableElixirs: ElixirItemDefinition[];
  activeEffects: ActiveStatusEffect[];
  shield: number;
  isDead: boolean;
  actedThisTurn: boolean;
  passiveTriggers: PassiveTrigger[];
  sourceNpcName?: string;
  summons: BattleSummon[];
  realm: CultivationRealm;
  powerTier?: PowerTier;
  identity?: string;
}

export interface GongfaActionItem {
  gongfaIndex: number;
  name: string;
  mpCost: number;
  needTarget: boolean;
  targetTeam: "ally" | "enemy";
  description: string;
}

export interface ElixirActionItem {
  elixirIndex: number;
  name: string;
  effectType: ElixirEffectType;
  count: number;
  description: string;
}

export type BattleAction =
  | { type: "normal_attack"; targetId: string }
  | { type: "magic_attack"; targetId: string }
  | { type: "gongfa"; gongfaIndex: number; targetId: string }
  | { type: "elixir"; elixirIndex: number }
  | { type: "flee" };

export type ActionSubmenu =
  | null
  | { type: "gongfa_list"; items: GongfaActionItem[] }
  | { type: "elixir_list"; items: ElixirActionItem[] };

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
}

export type BattlePhase =
  | "init"
  | "player_action"
  | "target_selection"
  | "resolving"
  | "ally_ai"
  | "enemy_ai"
  | "turn_start"
  | "turn_end"
  | "victory"
  | "defeat"
  | "fled"
  | "draw";

export interface BattleState {
  phase: BattlePhase;
  turn: number;
  allies: BattleCombatant[];
  enemies: BattleCombatant[];
  log: BattleLogEntry[];
  triggerEntry: BattleTriggerEntry;
  pendingAction: BattleAction | null;
  selectedTargetId: string | null;
  actionSubmenu: ActionSubmenu;
  maxTurns: number;
}

export interface BattleResult {
  outcome: "victory" | "defeat" | "fled" | "draw";
  turn: number;
  protagonistHpPercent: number;
  protagonistMpPercent: number;
  elixirsUsed: { name: string; count: number }[];
  enemiesKilled: string[];
}
