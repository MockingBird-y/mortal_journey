/**
 * @fileoverview 主角储物袋操作：格子管理、物品/灵石增删。
 * 以模块函数形式提供，由 `Protagonist` 类的实例方法委托调用。
 */

import type { InventoryStackItem } from "./types/itemInfo";
import {
  createSpiritStoneInventoryStack,
  type SpiritStoneName,
} from "./types/spiritStone";
import { gameLog } from "../log/gameLog";
import type { Protagonist } from "./Protagonist";

export const DEFAULT_INVENTORY_SLOT_COUNT = 12;
export const INVENTORY_SLOT_EXPAND_STEP = 4;

export function expandInventorySlots(p: Protagonist, count: number): void {
  if (!Number.isFinite(count) || count <= 0) return;
  for (let c = 0; c < Math.floor(count); c++) p.inventorySlots.push(null);
}

export function findFirstEmptyInventorySlot(p: Protagonist): number {
  for (let i = 0; i < p.inventorySlots.length; i++) {
    if (p.inventorySlots[i] == null) return i;
  }
  return -1;
}

export function findFirstEmptyInventorySlotOrExpand(p: Protagonist): number {
  let i = findFirstEmptyInventorySlot(p);
  if (i < 0) {
    expandInventorySlots(p, INVENTORY_SLOT_EXPAND_STEP);
    i = findFirstEmptyInventorySlot(p);
  }
  return i;
}

export function compactInventorySlotsInPlace(p: Protagonist): void {
  const slots = p.inventorySlots;
  let w = 0;
  for (let r = 0; r < slots.length; r++) {
    if (slots[r] != null) slots[w++] = slots[r];
  }
  const itemCount = w;
  const targetLen = Math.max(
    DEFAULT_INVENTORY_SLOT_COUNT,
    Math.ceil(itemCount / INVENTORY_SLOT_EXPAND_STEP) * INVENTORY_SLOT_EXPAND_STEP,
  );
  for (let i = itemCount; i < targetLen; i++) slots[i] = null;
  slots.length = targetLen;
}

export function setInventorySlot(p: Protagonist, index: number, item: InventoryStackItem | null): boolean {
  if (index < 0 || index >= p.inventorySlots.length) return false;
  p.inventorySlots[index] = item;
  compactInventorySlotsInPlace(p);
  return true;
}

export function addToInventory(p: Protagonist, item: InventoryStackItem): number {
  const i = findFirstEmptyInventorySlotOrExpand(p);
  if (i < 0) return -1;
  setInventorySlot(p, i, item);
  return i;
}

export function addSpiritStone(p: Protagonist, name: SpiritStoneName, count: number): void {
  for (let i = 0; i < p.inventorySlots.length; i++) {
    const cell = p.inventorySlots[i];
    if (!cell || !("type" in cell) || cell.type !== "灵石" || cell.name !== name) continue;
    cell.count += count;
    return;
  }
  addToInventory(p, createSpiritStoneInventoryStack(name, count));
}

export function removeSpiritStone(p: Protagonist, name: SpiritStoneName, count: number): void {
  let remaining = count;
  for (let i = 0; i < p.inventorySlots.length && remaining > 0; i++) {
    const cell = p.inventorySlots[i];
    if (!cell || !("type" in cell) || cell.type !== "灵石" || cell.name !== name) continue;
    const take = Math.min(remaining, cell.count);
    cell.count -= take;
    remaining -= take;
    if (cell.count <= 0) setInventorySlot(p, i, null);
  }
  if (remaining > 0) {
    gameLog.warn(`[Protagonist] 灵石不足：还需 ${remaining} 颗「${name}」`);
  }
}
