<script setup lang="ts">
/**
 * 储物袋全览弹窗：侧栏只铺前 `INVENTORY_BAG_SIDEBAR_SLOTS` 格，其余靠这里看。
 * 格子下标即 `protagonist.inventorySlots` 的真实下标，`select` 直接回传，
 * 由 PlayerInfoPanel 复用既有的 `onBagSlotClick` 打开物品详情。
 */
import { computed, onMounted, onUnmounted, watch } from "vue";
import type { InventoryStackItem } from "../role_core/types/itemInfo";
import { useScrollLock } from "../composables/useScrollLock";
import { inventorySlotParts } from "./protagonistPanelDisplay";

const props = defineProps<{
  open: boolean;
  slots: ReadonlyArray<InventoryStackItem | null>;
}>();

const emit = defineEmits<{
  close: [];
  select: [index: number];
}>();

const scrollLock = useScrollLock();

const usedCount = computed(() => props.slots.reduce((n, cell) => (cell ? n + 1 : n), 0));

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === "Escape" && props.open) {
    ev.preventDefault();
    emit("close");
  }
}

function onSlotKeydown(ev: KeyboardEvent, index: number) {
  if (ev.key === "Enter" || ev.key === " ") {
    ev.preventDefault();
    emit("select", index);
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) scrollLock.acquire();
    else scrollLock.release();
  },
);

onMounted(() => {
  document.addEventListener("keydown", onKeydown, true);
});
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown, true);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="mj-backdrop">
      <div v-if="open" class="mj-trait-modal-root mj-protagonist-detail-root" role="presentation">
        <div class="mj-trait-modal-backdrop" tabindex="-1" aria-label="关闭" @click="emit('close')" />
        <Transition name="mj-modal" appear>
          <div class="mj-trait-modal mj-item-detail-panel" role="dialog" aria-modal="true" @click.stop>
            <button type="button" class="mj-trait-modal-close" aria-label="关闭" @click="emit('close')">×</button>
            <h4 class="mj-trait-modal-title">储物袋 · {{ usedCount }} / {{ slots.length }} 格</h4>
            <div class="mj-trait-modal-body">
              <div class="mj-inventory-grid" role="region" aria-label="储物袋全部格子">
                <div
                  v-for="(cell, bi) in slots"
                  :key="bi"
                  class="mj-inventory-slot"
                  :class="{
                    'mj-inventory-slot--empty': !inventorySlotParts(cell).filled,
                    'mj-inventory-slot--filled': inventorySlotParts(cell).filled,
                    'mj-inventory-slot--lingshi': inventorySlotParts(cell).lingshi,
                  }"
                  :data-rarity="inventorySlotParts(cell).rarity"
                  :title="
                    cell
                      ? `${inventorySlotParts(cell).label}${inventorySlotParts(cell).qty ? ' ×' + inventorySlotParts(cell).qty : ''}\n（点击查看详情）`
                      : `格 ${bi + 1}`
                  "
                  :tabindex="cell ? 0 : -1"
                  @click="cell && emit('select', bi)"
                  @keydown="cell && onSlotKeydown($event, bi)"
                >
                  <span class="mj-inventory-slot-label">{{ inventorySlotParts(cell).label }}</span>
                  <span v-if="inventorySlotParts(cell).qty" class="mj-inventory-slot-qty">{{
                    inventorySlotParts(cell).qty
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 侧栏那套格子样式挂在 `.main-panel--player #mj-inventory-grid` 下，本弹窗 Teleport 到
   body 后够不着，只能就地复刻一份（与 NpcDetailModal 的做法一致）。 */
.mj-inventory-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  margin-top: 4px;
}

.mj-inventory-slot {
  aspect-ratio: 1;
  min-height: 36px;
  border: 1px dashed rgba(140, 120, 83, 0.4);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 5px 18px;
  box-sizing: border-box;
}

.mj-inventory-slot-label {
  font-size: var(--mj-player-content-font);
  line-height: 1.15;
  text-align: center;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  color: var(--mj-text);
}

.mj-inventory-slot--empty .mj-inventory-slot-label {
  color: transparent;
}

.mj-inventory-slot-qty {
  position: absolute;
  bottom: 3px;
  right: 4px;
  font-size: var(--mj-player-content-font);
  font-weight: 600;
  color: var(--mj-gold-dim);
  line-height: 1;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  pointer-events: none;
}

.mj-inventory-slot--lingshi {
  border-style: solid;
  border-color: rgba(180, 160, 90, 0.45);
  background: rgba(232, 197, 71, 0.06);
}

.mj-inventory-slot--lingshi .mj-inventory-slot-label {
  color: var(--mj-text);
}

.mj-inventory-slot--filled {
  border-style: solid;
  cursor: pointer;
}

.mj-inventory-slot--filled[data-rarity] {
  border-color: var(--mj-rarity-active);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mj-rarity-active) 25%, transparent);
}

.mj-inventory-slot--filled:focus-visible {
  outline: 2px solid var(--mj-gold, #e8c547);
  outline-offset: 1px;
}

/* 冰蓝主题：上面复刻的规则里有 5 处硬编码色值，`themes/ice-blue/main-screen/mainScreenPlayerPanel.css`
   改写的是 `.main-panel--player ...`，够不着本弹窗，只能按主题根属性再镜像一份。
   数值与该主题文件保持一致，改那边时记得同步。 */
html[data-mj-theme="ice-blue"] .mj-inventory-slot {
  background: rgba(28, 34, 48, 0.22);
}

/* 描边只改无品级的格子：有 data-rarity 的走 `--mj-rarity-active`，那套变量主题自己已经换过了。 */
html[data-mj-theme="ice-blue"] .mj-inventory-slot:not([data-rarity]) {
  border-color: rgba(150, 146, 175, 0.4);
}

html[data-mj-theme="ice-blue"] .mj-inventory-slot-qty {
  text-shadow: 0 1px 2px rgba(28, 34, 48, 0.9);
}

html[data-mj-theme="ice-blue"] .mj-inventory-slot--lingshi {
  background: rgba(172, 219, 223, 0.06);
}

html[data-mj-theme="ice-blue"] .mj-inventory-slot--lingshi:not([data-rarity]) {
  border-color: rgba(150, 146, 175, 0.45);
}
</style>
