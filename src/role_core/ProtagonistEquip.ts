/**
 * @fileoverview 主角穿戴槽 & 功法栏操作：装备/卸下、功法装备/卸下、详情弹窗动作。
 * 以模块函数形式提供，由 `Protagonist` 类的实例方法委托调用。
 */

import type {
  ArmorItemDefinition,
  FaqiItemDefinition,
  GongfaItemDefinition,
  WearableItemDefinition,
  WeaponItemDefinition,
} from "./types/itemInfo";
import {
  GONGFA_SLOT_COUNT,
  type EquipSlotKey,
  type ProtagonistDetailAction,
} from "./types/playInfo";
import type { Protagonist } from "./Protagonist";
import { compactInventorySlotsInPlace, findFirstEmptyInventorySlotOrExpand } from "./ProtagonistInventory";

export function isWearableItem(x: unknown): x is WearableItemDefinition {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return o.itemType === "装备" && (o.equipType === "武器" || o.equipType === "法器" || o.equipType === "防具");
}

export function equipSlotForItem(item: WearableItemDefinition): EquipSlotKey | null {
  if (item.equipType === "武器") return "weapon";
  if (item.equipType === "法器") return "faqi";
  if (item.equipType === "防具") return "armor";
  return null;
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

export function setEquippedSlot(p: Protagonist, slot: EquipSlotKey, item: WearableItemDefinition | null): boolean {
  if (item != null) {
    const sk = equipSlotForItem(item);
    if (sk !== slot) return false;
  }
  if (slot === "weapon") p.equippedSlots.weapon = item as WeaponItemDefinition | null;
  else if (slot === "faqi") p.equippedSlots.faqi = item as FaqiItemDefinition | null;
  else p.equippedSlots.armor = item as ArmorItemDefinition | null;
  return true;
}

export function equipFromInventory(p: Protagonist, inventoryIndex: number): boolean {
  if (inventoryIndex < 0 || inventoryIndex >= p.inventorySlots.length) return false;
  const cell = p.inventorySlots[inventoryIndex];
  if (!cell || !isWearableItem(cell)) return false;
  const slot = equipSlotForItem(cell);
  if (!slot) return false;
  const prev = p.equippedSlots[slot];
  if (slot === "weapon") p.equippedSlots.weapon = cell as WeaponItemDefinition;
  else if (slot === "faqi") p.equippedSlots.faqi = cell as FaqiItemDefinition;
  else p.equippedSlots.armor = cell as ArmorItemDefinition;
  p.inventorySlots[inventoryIndex] = prev;
  compactInventorySlotsInPlace(p);
  return true;
}

export function unequipToInventory(p: Protagonist, slot: EquipSlotKey): boolean {
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
