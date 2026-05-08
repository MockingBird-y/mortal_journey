/**
 * @fileoverview 将 AI 生成状态解析结果应用到主角数据：HP/MP 更新、灵石增减、物品增减。
 */

import type { StateParsed } from "../ai/state_generate";
import {
  protagonist,
  setCurrentHpMp,
  addToInventory,
  setInventorySlot,
} from "./protagonistManager";
import type { ProtagonistPlayInfo } from "../types/playInfo";
import {
  createSpiritStoneInventoryStack,
  SPIRIT_STONE_TABLE_KEYS_ORDERED,
  type SpiritStoneName,
} from "../types/spiritStone";
import { gameLog } from "../log/gameLog";

function mergeOrAddStone(p: ProtagonistPlayInfo, name: SpiritStoneName, count: number): void {
  for (let i = 0; i < p.inventorySlots.length; i++) {
    const cell = p.inventorySlots[i];
    if (!cell || !("type" in cell) || cell.type !== "灵石" || cell.name !== name) continue;
    cell.count += count;
    return;
  }
  addToInventory(createSpiritStoneInventoryStack(name, count));
}

function removeStoneByName(p: ProtagonistPlayInfo, name: SpiritStoneName, count: number): void {
  let remaining = count;
  for (let i = 0; i < p.inventorySlots.length && remaining > 0; i++) {
    const cell = p.inventorySlots[i];
    if (!cell || !("type" in cell) || cell.type !== "灵石" || cell.name !== name) continue;
    const take = Math.min(remaining, cell.count);
    cell.count -= take;
    remaining -= take;
    if (cell.count <= 0) setInventorySlot(i, null);
  }
  if (remaining > 0) {
    gameLog.warn(`[StoryChat] 灵石不足：还需 ${remaining} 颗「${name}」`);
  }
}

/**
 * 将 AI 状态解析结果应用到主角：HP/MP、灵石增减、物品增减。
 */
export function applyStateChanges(state: StateParsed): void {
  const p = protagonist.value;
  if (!p) return;

  if (state.userState) {
    setCurrentHpMp(state.userState.currentHp, state.userState.currentMp);
  }

  for (const change of state.spiritStoneChanges) {
    if (!SPIRIT_STONE_TABLE_KEYS_ORDERED.includes(change.name as SpiritStoneName)) continue;
    if (change.op === "add") {
      mergeOrAddStone(p, change.name as SpiritStoneName, change.count);
    } else if (change.op === "remove") {
      removeStoneByName(p, change.name as SpiritStoneName, change.count);
    }
  }

  const stackableTypes = new Set(["材料", "杂物"]);

  for (const item of state.itemAdds) {
    if (item.type === "灵石") continue;
    if (stackableTypes.has(item.type)) {
      let merged = false;
      for (let i = 0; i < p.inventorySlots.length; i++) {
        const cell = p.inventorySlots[i];
        if (!cell || !("name" in cell) || cell.name !== item.name) continue;
        if (!("itemType" in cell) || !stackableTypes.has(cell.itemType)) continue;
        cell.count += item.count;
        merged = true;
        break;
      }
      if (!merged) {
        addToInventory({
          name: item.name,
          desc: item.intro,
          grade: item.grade as "下品" | "中品" | "上品" | "极品" | "仙品",
          count: item.count,
          itemType: "杂物",
        } as any);
      }
    } else {
      addToInventory({
        name: item.name,
        desc: item.intro,
        grade: item.grade as "下品" | "中品" | "上品" | "极品" | "仙品",
        count: item.count,
        itemType: "杂物",
      } as any);
    }
  }

  for (const item of state.itemRemoves) {
    let remaining = item.count;
    for (let i = 0; i < p.inventorySlots.length && remaining > 0; i++) {
      const cell = p.inventorySlots[i];
      if (!cell || !("name" in cell) || cell.name !== item.name) continue;
      const take = Math.min(remaining, cell.count);
      cell.count -= take;
      remaining -= take;
      if (cell.count <= 0) setInventorySlot(i, null);
    }
  }
}
