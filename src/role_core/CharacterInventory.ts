/**
 * @fileoverview 通用储物袋操作：格子管理、物品/灵石增删。
 * 以模块函数形式提供，任何实现 InventoryCarrier 接口的对象均可使用。
 */

import type { InventoryStackItem } from "./types/itemInfo";
import {
  createSpiritStoneInventoryStack,
  type SpiritStoneName,
} from "./types/spiritStone";
import { gameLog } from "../log/gameLog";

export interface InventoryCarrier {
  inventorySlots: Array<InventoryStackItem | null>;
}

export const DEFAULT_INVENTORY_SLOT_COUNT = 12;
export const INVENTORY_SLOT_EXPAND_STEP = 4;

export function expandInventorySlots(c: InventoryCarrier, count: number): void {
  if (!Number.isFinite(count) || count <= 0) return;
  for (let i = 0; i < Math.floor(count); i++) c.inventorySlots.push(null);
}

export function findFirstEmptyInventorySlot(c: InventoryCarrier): number {
  for (let i = 0; i < c.inventorySlots.length; i++) {
    if (c.inventorySlots[i] == null) return i;
  }
  return -1;
}

export function findFirstEmptyInventorySlotOrExpand(c: InventoryCarrier): number {
  let i = findFirstEmptyInventorySlot(c);
  if (i < 0) {
    expandInventorySlots(c, INVENTORY_SLOT_EXPAND_STEP);
    i = findFirstEmptyInventorySlot(c);
  }
  return i;
}

export function compactInventorySlotsInPlace(c: InventoryCarrier): void {
  const slots = c.inventorySlots;
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

export function setInventorySlot(c: InventoryCarrier, index: number, item: InventoryStackItem | null): boolean {
  if (index < 0 || index >= c.inventorySlots.length) return false;
  c.inventorySlots[index] = item;
  compactInventorySlotsInPlace(c);
  return true;
}

export function addToInventory(c: InventoryCarrier, item: InventoryStackItem): number {
  const i = findFirstEmptyInventorySlotOrExpand(c);
  if (i < 0) return -1;
  setInventorySlot(c, i, item);
  return i;
}

export function addSpiritStone(c: InventoryCarrier, name: SpiritStoneName, count: number): void {
  for (let i = 0; i < c.inventorySlots.length; i++) {
    const cell = c.inventorySlots[i];
    if (!cell || !("type" in cell) || cell.type !== "灵石" || cell.name !== name) continue;
    cell.count += count;
    return;
  }
  addToInventory(c, createSpiritStoneInventoryStack(name, count));
}

export function removeSpiritStone(c: InventoryCarrier, name: SpiritStoneName, count: number): void {
  let remaining = count;
  for (let i = 0; i < c.inventorySlots.length && remaining > 0; i++) {
    const cell = c.inventorySlots[i];
    if (!cell || !("type" in cell) || cell.type !== "灵石" || cell.name !== name) continue;
    const take = Math.min(remaining, cell.count);
    cell.count -= take;
    remaining -= take;
    if (cell.count <= 0) setInventorySlot(c, i, null);
  }
  if (remaining > 0) {
    gameLog.warn(`[Inventory] 灵石不足：还需 ${remaining} 颗「${name}」`);
  }
}
