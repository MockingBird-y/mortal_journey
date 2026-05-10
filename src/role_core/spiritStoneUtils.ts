/**
 * 灵石功能函数。
 * 类型和常量数据表定义在 `types/spiritStone.ts`。
 */

import {
  mjDescribeSpiritStones,
  SPIRIT_STONE_INVENTORY_KIND,
  type SpiritStoneName,
  type SpiritStoneInventoryStack,
} from "./types/spiritStone";

export function createSpiritStoneInventoryStack(name: SpiritStoneName, count: number): SpiritStoneInventoryStack {
  return {
    name,
    count,
    ...mjDescribeSpiritStones[name],
    type: SPIRIT_STONE_INVENTORY_KIND,
  };
}
