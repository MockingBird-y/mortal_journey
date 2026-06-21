/**
 * @fileoverview 存档服务：自动存档的写入/读取/恢复/重置。
 *
 * 设计要点：
 *   - **自包含纯 JSON 载荷**：单 id 对应单个 blob，聚合四个数据源
 *     （主角 / NPC / 世界地图 / 剧情），无类实例、无 Map，天然可作云端「文档」。
 *   - **存储后端抽象** `SaveBackend`：默认 localStorage，日后云存档只需替换实现。
 *   - **自动存档**：本模块不提供 UI，仅暴露 `createSave` / `writeActiveSave` /
 *     `restoreSave` / `resetAllGameState`，由 `App.vue`、`useOpeningStory`、
 *     `StoryChatPanel` 在关键节点调用。
 *
 * 存档唯一标识：`${主角名}-${YYYYMMDD-HHMMSS}`。同一存档在会话中原地更新；
 * 开新人生才生成新存档。
 */

import type { FateChoiceResult } from "../fate_choice/types";
import type { NpcPlayInfo, ProtagonistPlayInfo } from "../role_core/types/playInfo";
import type { WorldMapSerialData } from "../role_core/worldMapStore";
import type { WorldLocation } from "../role_core/types/worldLocation";
import { formatWorldLocation } from "../role_core/types/worldLocation";
import { Protagonist, protagonist } from "../role_core/Protagonist";
import { npcStore } from "../role_core/npcStore";
import { worldMapStore } from "../role_core/worldMapStore";
import { storyStore, type StorySerialData } from "../role_core/storyStore";
import { gameLog } from "../log/gameLog";

export const SAVE_VERSION = 1;
export const SAVE_INDEX_KEY = "MJ_SAVES_INDEX_V1";
export const SAVE_PREFIX = "MJ_SAVE_V1:";
/** 当前活动存档 id 的本地持久化键——用于刷新网页后自动恢复到当前存档。 */
export const ACTIVE_SAVE_ID_KEY = "MJ_ACTIVE_SAVE_ID_V1";

// ---------------------------------------------------------------------------
// 活动存档 id 的持久化（刷新续玩）
// ---------------------------------------------------------------------------

function persistActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_SAVE_ID_KEY, id);
  } catch {
    /* ignore */
  }
}

/** 清除本地持久化的活动存档指针（返回标题=退出当前存档时调用）。 */
export function clearActiveId(): void {
  try {
    localStorage.removeItem(ACTIVE_SAVE_ID_KEY);
  } catch {
    /* ignore */
  }
}

/** 读取本地持久化的活动存档 id（无则 null）。 */
export function getPersistedActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SAVE_ID_KEY);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 存储后端抽象（云存档替换点）
// ---------------------------------------------------------------------------

export interface SaveBackend {
  read(id: string): string | null;
  write(id: string, blob: string): void;
  remove(id: string): void;
}

const localStorageBackend: SaveBackend = {
  read(id) {
    try {
      return localStorage.getItem(SAVE_PREFIX + id);
    } catch {
      return null;
    }
  },
  write(id, blob) {
    try {
      localStorage.setItem(SAVE_PREFIX + id, blob);
    } catch (e) {
      gameLog.error("[GameSave] 写入存档失败：" + (e instanceof Error ? e.message : String(e)));
    }
  },
  remove(id) {
    try {
      localStorage.removeItem(SAVE_PREFIX + id);
    } catch {
      /* ignore */
    }
  },
};

let backend: SaveBackend = localStorageBackend;

/** 替换存储后端（云存档接入点）。 */
export function setSaveBackend(b: SaveBackend): void {
  backend = b;
}

// ---------------------------------------------------------------------------
// 存档载荷与索引
// ---------------------------------------------------------------------------

/**
 * 完整存档载荷。占位存档（开局 AI 尚未完成）仅含 `fateChoice` 并标记 `incomplete`，
 * 其余字段缺省；读档时由 {@link isCompleteSave} 判定是否直接恢复。
 */
export interface MjSavePayload {
  version: number;
  fateChoice: FateChoiceResult;
  createdAt: number;
  updatedAt: number;
  /** 占位标记：开局 AI 未完成时写入；完整存档不带此字段。 */
  incomplete?: true;
  protagonist?: ProtagonistPlayInfo;
  npcs?: NpcPlayInfo[];
  worldMap?: WorldMapSerialData;
  story?: StorySerialData;
}

export interface SaveIndexEntry {
  id: string;
  /** 主角名。 */
  name: string;
  updatedAt: number;
  createdAt: number;
  /** 预览：境界（如「练气初期」）。 */
  realm?: string;
  /** 预览：当前地点。 */
  location?: string;
}

// ---------------------------------------------------------------------------
// 会话内的「活动存档」记账（模块级，供各处无入参调用 writeActiveSave）
// ---------------------------------------------------------------------------

let activeSaveId: string | null = null;
let activeCreatedAt: number = 0;
let activeFateChoice: FateChoiceResult | null = null;

/** 设置当前会话的活动存档（读档时调用）。 */
export function setActiveSave(id: string, fateChoice: FateChoiceResult, createdAt: number): void {
  activeSaveId = id;
  activeFateChoice = fateChoice;
  activeCreatedAt = createdAt;
  persistActiveId(id);
}

export function hasActiveSave(): boolean {
  return activeSaveId !== null;
}

// ---------------------------------------------------------------------------
// 索引读写
// ---------------------------------------------------------------------------

function readIndexRaw(): SaveIndexEntry[] {
  try {
    const raw = localStorage.getItem(SAVE_INDEX_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as SaveIndexEntry[]) : [];
  } catch {
    return [];
  }
}

function writeIndexRaw(arr: SaveIndexEntry[]): void {
  try {
    localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
  } catch {
    /* ignore */
  }
}

/** 读取存档索引（按 updatedAt 倒序），供 UI 列表使用。 */
export function readSaveIndex(): SaveIndexEntry[] {
  const idx = readIndexRaw().filter((x) => x && x.id);
  idx.sort((a, b) => Number(b?.updatedAt) - Number(a?.updatedAt));
  return idx;
}

function upsertIndex(entry: SaveIndexEntry): void {
  const idx = readIndexRaw();
  const i = idx.findIndex((e) => e && e.id === entry.id);
  if (i >= 0) idx[i] = entry;
  else idx.push(entry);
  writeIndexRaw(idx);
}

// ---------------------------------------------------------------------------
// 序列化 / 反序列化
// ---------------------------------------------------------------------------

function realmPreview(p: ProtagonistPlayInfo): string {
  return (p.realm?.major || "") + (p.realm?.minor || "");
}

function locationPreview(loc: WorldLocation | null | undefined): string {
  return loc ? formatWorldLocation(loc) : "";
}

/** 聚合四个数据源构建完整存档载荷。protagonist 缺省时返回 null。 */
export function serializeAll(now = Date.now()): MjSavePayload | null {
  const p = protagonist.value;
  if (!p || !activeFateChoice) return null;
  return {
    version: SAVE_VERSION,
    fateChoice: activeFateChoice,
    createdAt: activeCreatedAt || now,
    updatedAt: now,
    protagonist: p.toData(),
    npcs: npcStore.serializeNpcs(),
    worldMap: worldMapStore.serializeWorldMap(),
    story: storyStore.serializeStory(),
  };
}

/**
 * 写入当前活动存档（原地更新）。在 `phase !== "ready"`、无活动存档、无主角时跳过，
 * 避免存入战斗中或半成品状态。
 */
export function writeActiveSave(): void {
  if (!activeSaveId || !activeFateChoice) return;
  if (storyStore.phase.value !== "ready") return;
  const payload = serializeAll();
  if (!payload || !payload.protagonist || !payload.story) return;
  backend.write(activeSaveId, JSON.stringify(payload));
  upsertIndex({
    id: activeSaveId,
    name: payload.fateChoice.basics.playerName || activeSaveId,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    realm: realmPreview(payload.protagonist),
    location: locationPreview(payload.story.worldLocation),
  });
}

/**
 * 命运抉择确认时创建存档：生成 id（名+时间），写入占位载荷并登记索引。
 * 开局 AI 完成后由 `writeActiveSave` 写入完整载荷。
 *
 * @returns 新建存档 id。
 */
export function createSave(fc: FateChoiceResult): string {
  const name = (fc.basics?.playerName || "").trim() || "未命名";
  const id = composeSaveId(name);
  const now = Date.now();
  activeSaveId = id;
  activeCreatedAt = now;
  activeFateChoice = fc;
  const placeholder: MjSavePayload = {
    version: SAVE_VERSION,
    fateChoice: fc,
    createdAt: now,
    updatedAt: now,
    incomplete: true,
  };
  backend.write(id, JSON.stringify(placeholder));
  upsertIndex({
    id,
    name,
    createdAt: now,
    updatedAt: now,
    realm: (fc.basics?.realmMajor || "") + (fc.basics?.realmMinor || ""),
    location: locationPreview(fc.basics?.birthPlace),
  });
  gameLog.info("[GameSave] 创建存档：" + id);
  persistActiveId(id);
  return id;
}

/** 读取并存档载荷（不恢复到运行时状态）。损坏或不存在返回 null。 */
export function readSave(id: string): MjSavePayload | null {
  const raw = backend.read(id);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return null;
    const p = obj as MjSavePayload;
    if (!p.fateChoice) return null;
    return p;
  } catch {
    return null;
  }
}

/** 判定存档是否为可直接恢复的完整存档。 */
export function isCompleteSave(p: MjSavePayload | null | undefined): boolean {
  return (
    !!p &&
    !p.incomplete &&
    !!p.protagonist &&
    !!p.story &&
    Array.isArray(p.story.chatMessages) &&
    p.story.chatMessages.length > 0
  );
}

/**
 * 从完整存档恢复全部运行时状态（主角 / NPC / 世界地图 / 剧情）。
 * 调用前应先 `resetAllGameState()` 清场；恢复后 `storyStore.restored=true`。
 */
export function restoreSave(payload: MjSavePayload): void {
  if (payload.protagonist) {
    Protagonist.loadFromJson(payload.protagonist);
  }
  npcStore.restoreNpcs(payload.npcs ?? []);
  worldMapStore.restoreWorldMap(payload.worldMap ?? null);
  storyStore.restoreStory(payload.story ?? null);
  activeFateChoice = payload.fateChoice;
}

/**
 * 清空全部游戏状态（主角 / NPC / 世界地图 / 剧情）与活动存档记账。
 * 开新人生、读档前清场均应调用。
 */
export function resetAllGameState(): void {
  Protagonist.clear();
  npcStore.clearNpcs();
  worldMapStore.clearWorldMap();
  storyStore.clearStory();
  activeSaveId = null;
  activeCreatedAt = 0;
  activeFateChoice = null;
  clearActiveId();
}

/** 删除一个存档（blob + 索引条目）。若为当前活动存档，一并清空活动记账。 */
export function removeSave(id: string): void {
  backend.remove(id);
  const idx = readIndexRaw().filter((e) => e && e.id !== id);
  writeIndexRaw(idx);
  if (activeSaveId === id) {
    activeSaveId = null;
    activeCreatedAt = 0;
    activeFateChoice = null;
    clearActiveId();
  }
}

/** 清空全部存档（不动运行时游戏状态）。 */
export function clearAllSaves(): void {
  const idx = readIndexRaw();
  for (const e of idx) {
    if (e?.id) backend.remove(e.id);
  }
  writeIndexRaw([]);
  activeSaveId = null;
  activeCreatedAt = 0;
  activeFateChoice = null;
  clearActiveId();
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

/** 生成存档 id：`${name}-${YYYYMMDD-HHMMSS}`。 */
function composeSaveId(name: string): string {
  const d = new Date();
  const pad = (x: number): string => (x < 10 ? "0" + x : String(x));
  const ts =
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
  return name + "-" + ts;
}
