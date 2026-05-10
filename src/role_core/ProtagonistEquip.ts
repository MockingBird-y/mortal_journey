/**
 * @fileoverview 主角法宝栏 & 功法栏操作：法宝装备/卸下、功法装备/卸下、详情弹窗动作。
 * 以模块函数形式提供，由 `Protagonist` 类的实例方法委托调用。
 */

import type {
  TreasureItemDefinition,
  GongfaItemDefinition,
} from "./types/itemInfo";
import {
  EQUIP_SLOT_COUNT,
  GONGFA_SLOT_COUNT,
  type EquipSlotKey,
  type ProtagonistDetailAction,
} from "./types/playInfo";
import type { Protagonist } from "./Protagonist";
import { compactInventorySlotsInPlace, findFirstEmptyInventorySlotOrExpand } from "./ProtagonistInventory";

export function isTreasureItem(x: unknown): x is TreasureItemDefinition {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return o.itemType === "法宝";
}

export function findFirstEmptyEquipSlot(p: Protagonist): number {
  for (let i = 0; i < EQUIP_SLOT_COUNT; i++) {
    if (p.equippedSlots[i] == null) return i;
  }
  return -1;
}

export function setGongfaSlot(p: Protagonist, index: number, item: GongfaItemDefinition | null): boolean {
  if (index < 0 || index >= GONGFA_SLOT_COUNT) return false;
  p.gongfaSlots[index] = item;
  return true;
}

export function findFirstEmptyGongfaSlot(p: Protagonist): number {
  for (let i = 0; i < GONGFA_SLOT_COUNT; i++) {
    if (p.gongfaSlots[i] == null) return i;
  }
  return -1;
}

export function unequipGongfaToInventory(p: Protagonist, gongfaSlotIndex: number): boolean {
  if (gongfaSlotIndex < 0 || gongfaSlotIndex >= GONGFA_SLOT_COUNT) return false;
  const cell = p.gongfaSlots[gongfaSlotIndex];
  if (!cell) return true;
  const empty = findFirstEmptyInventorySlotOrExpand(p);
  if (empty < 0) return false;
  p.gongfaSlots[gongfaSlotIndex] = null;
  p.inventorySlots[empty] = cell;
  compactInventorySlotsInPlace(p);
  return true;
}

export function equipGongfaFromInventory(p: Protagonist, inventoryIndex: number): boolean {
  if (inventoryIndex < 0 || inventoryIndex >= p.inventorySlots.length) return false;
  const cell = p.inventorySlots[inventoryIndex];
  if (!cell || !("itemType" in cell) || cell.itemType !== "功法") return false;
  const gi = findFirstEmptyGongfaSlot(p);
  if (gi < 0) return false;
  p.gongfaSlots[gi] = cell as GongfaItemDefinition;
  p.inventorySlots[inventoryIndex] = null;
  compactInventorySlotsInPlace(p);
  return true;
}

export function setEquippedSlot(p: Protagonist, slot: EquipSlotKey, item: TreasureItemDefinition | null): boolean {
  if (slot < 0 || slot >= EQUIP_SLOT_COUNT) return false;
  p.equippedSlots[slot] = item;
  return true;
}

export function equipFromInventory(p: Protagonist, inventoryIndex: number): boolean {
  if (inventoryIndex < 0 || inventoryIndex >= p.inventorySlots.length) return false;
  const cell = p.inventorySlots[inventoryIndex];
  if (!cell || !isTreasureItem(cell)) return false;
  const slot = findFirstEmptyEquipSlot(p);
  if (slot < 0) return false;
  const prev = p.equippedSlots[slot];
  p.equippedSlots[slot] = cell;
  p.inventorySlots[inventoryIndex] = prev;
  compactInventorySlotsInPlace(p);
  return true;
}

export function unequipToInventory(p: Protagonist, slot: EquipSlotKey): boolean {
  if (slot < 0 || slot >= EQUIP_SLOT_COUNT) return false;
  const cur = p.equippedSlots[slot];
  if (!cur) return true;
  const empty = findFirstEmptyInventorySlotOrExpand(p);
  if (empty < 0) return false;
  p.equippedSlots[slot] = null;
  p.inventorySlots[empty] = cur;
  compactInventorySlotsInPlace(p);
  return true;
}

export function applyDetailAction(p: Protagonist, a: ProtagonistDetailAction): boolean {
  switch (a.id) {
    case "unequipWear":
      return unequipToInventory(p, a.equipSlot);
    case "unequipGongfa":
      return unequipGongfaToInventory(p, a.gongfaIndex);
    case "equipWearFromBag":
      return equipFromInventory(p, a.inventoryIndex);
    case "equipGongfaFromBag":
      return equipGongfaFromInventory(p, a.inventoryIndex);
    default:
      return false;
  }
}
