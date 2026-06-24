<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from "vue";
import type { Npc } from "../role_core/Npc";
import { Character } from "../role_core/Character";
import {
  PRIMARY_STAT_KEY_TO_ZH,
  PRIMARY_STAT_KEYS,
  type EquipSlotKey,
} from "../role_core/types/playInfo";
import { computeLinggenCombatBonuses } from "../role_core/types/gameConstants";
import type { GongfaItemDefinition } from "../role_core/types/itemInfo";
import {
  buildWearableDetailPayload,
  buildGongfaDetailPayload,
  buildInventoryStackDetailPayload,
  type ProtagonistDetailPayload,
  type DerivedStatValues,
} from "./protagonistDetailPayload";
import {
  treasureCellName,
  gongfaCellName,
  gongfaMasteryLabel,
  gradeToTraitRarity,
  inventorySlotParts,
  getInventoryBagDisplaySlots,
} from "./protagonistPanelDisplay";
import ProtagonistDetailModal from "./ProtagonistDetailModal.vue";
import { useScrollLock } from "../composables/useScrollLock";
import { resizeImageFileToAvatar } from "./avatarUpload";
import { writeActiveSave } from "../save/gameSave";
import { npcStore } from "../role_core/npcStore";

type NpcTab = "combat" | "story";

const props = defineProps<{
  open: boolean;
  npc: Npc | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const scrollLock = useScrollLock();
const activeTab = ref<NpcTab>("combat");

const itemDetailOpen = ref(false);
const itemDetailPayload = shallowRef<ProtagonistDetailPayload | null>(null);

// ── NPC 头像上传 ────────────────────────────────────────────────────────────
const avatarFileInput = ref<HTMLInputElement | null>(null);
const avatarError = ref("");

function onNpcAvatarClick() {
  avatarError.value = "";
  avatarFileInput.value?.click();
}

async function onNpcAvatarFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  const npc = props.npc;
  if (file && npc) {
    try {
      const dataUrl = await resizeImageFileToAvatar(file);
      npc.setAvatarUrl(dataUrl);
      npcStore.setNpc(npc);
      writeActiveSave();
      avatarError.value = "";
    } catch (err) {
      avatarError.value = err instanceof Error ? err.message : "头像上传失败。";
    }
  }
  if (input) input.value = "";
}

const primaryStats = computed(() => props.npc?.getPrimaryStats() ?? null);

const equipSlots = computed(() => {
  const npc = props.npc;
  if (!npc) return [];
  const rows: Array<{ key: EquipSlotKey; item: typeof npc.equippedSlots[0] }> = [];
  for (let i = 0; i < npc.equippedSlots.length; i++) {
    rows.push({ key: i as EquipSlotKey, item: npc.equippedSlots[i] });
  }
  return rows;
});

const gongfaSlots = computed(() => props.npc?.gongfaSlots ?? []);
const bagSlots = computed(() => getInventoryBagDisplaySlots(props.npc?.inventorySlots ?? null));

function favorLabel(f: number): string {
  if (f >= 80) return "生死之交";
  if (f >= 60) return "亲密无间";
  if (f >= 40) return "亲密";
  if (f >= 20) return "朋友";
  if (f >= -19) return "普通";
  if (f >= -39) return "疏离";
  if (f >= -59) return "厌恶";
  if (f >= -79) return "仇视";
  return "不死不休";
}

function switchTab(tab: NpcTab) {
  activeTab.value = tab;
  if (tab !== "combat") {
    itemDetailOpen.value = false;
    itemDetailPayload.value = null;
  }
}

function getNpcDerivedStats(npc: Npc): DerivedStatValues {
  const ps = npc.getPrimaryStats();
  return {
    physique: ps.physique,
    spirit: ps.spirit,
    strength: ps.strength,
    perception: ps.perception,
    guard: ps.guard,
    resistance: ps.resistance,
    agility: ps.agility,
    insight: ps.insight,
  };
}

function openEquipDetail(key: EquipSlotKey) {
  const npc = props.npc;
  if (!npc) return;
  const it = npc.equippedSlots[key];
  if (!it) return;
  itemDetailPayload.value = buildWearableDetailPayload(it);
  itemDetailOpen.value = true;
}

function openGongfaDetail(index: number) {
  const npc = props.npc;
  if (!npc) return;
  const cell = npc.gongfaSlots[index];
  if (!cell) return;
  itemDetailPayload.value = buildGongfaDetailPayload(cell, undefined, npc.linggen, undefined, undefined, () => getNpcDerivedStats(npc), computeLinggenCombatBonuses(npc.linggen, npc.realm.major).cooldownReduce);
  itemDetailOpen.value = true;
}

function openBagDetail(index: number) {
  const npc = props.npc;
  if (!npc) return;
  const cell = npc.inventorySlots[index];
  if (!cell) return;
  itemDetailPayload.value = buildInventoryStackDetailPayload(cell, undefined, npc.linggen, undefined, undefined, () => getNpcDerivedStats(npc), computeLinggenCombatBonuses(npc.linggen, npc.realm.major).cooldownReduce);
  itemDetailOpen.value = true;
}

function closeItemDetail() {
  itemDetailOpen.value = false;
  itemDetailPayload.value = null;
}

function onBackdropClick() {
  if (itemDetailOpen.value) {
    closeItemDetail();
    return;
  }
  emit("close");
}

function onCloseClick() {
  if (itemDetailOpen.value) {
    closeItemDetail();
    return;
  }
  emit("close");
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key !== "Escape" || !props.open) return;
  if (itemDetailOpen.value) {
    ev.preventDefault();
    closeItemDetail();
    return;
  }
  ev.preventDefault();
  emit("close");
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      scrollLock.acquire();
      activeTab.value = "combat";
    } else {
      scrollLock.release();
      itemDetailOpen.value = false;
      itemDetailPayload.value = null;
    }
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
      <div
        v-if="open && npc"
        class="mj-trait-modal-root mj-protagonist-detail-root"
        role="presentation"
        aria-hidden="false"
      >
        <div
          class="mj-trait-modal-backdrop"
          tabindex="-1"
          aria-label="关闭"
          @click="onBackdropClick"
        />
        <Transition name="mj-modal" appear>
          <div
            class="mj-trait-modal mj-npc-detail-panel"
            role="dialog"
            aria-modal="true"
            :data-rarity="npc.realm.major === '化神' ? '传说' : npc.realm.major === '元婴' ? '史诗' : npc.realm.major === '结丹' ? '稀有' : npc.realm.major === '筑基' ? '精良' : undefined"
            @click.stop
          >
            <button type="button" class="mj-trait-modal-close" aria-label="关闭" @click="onCloseClick">
              ×
            </button>
            <h4 class="mj-trait-modal-title">
              <template v-if="npc.isDead">
                <s>{{ npc.displayName }}</s>
                <span class="mj-npc-dead-tag">（已故）</span>
              </template>
              <template v-else>{{ npc.displayName }}</template>
            </h4>
            <div class="mj-trait-modal-rarity">
              {{ npc.identity }} · {{ Character.formatRealm(npc.realm) }} · {{ npc.powerTier }}
            </div>

            <div
              class="mj-npc-avatar-wrap"
              role="button"
              tabindex="0"
              title="点击上传头像"
              @click="onNpcAvatarClick"
              @keydown="($event.key === 'Enter' || $event.key === ' ') && (onNpcAvatarClick(), $event.preventDefault())"
            >
              <img v-if="npc.avatarUrl" class="mj-npc-avatar" :src="npc.avatarUrl" :alt="npc.displayName" />
              <div v-else class="mj-npc-avatar mj-npc-avatar--placeholder">{{ npc.displayName.slice(0, 1) }}</div>
              <span class="mj-npc-avatar-edit" aria-hidden="true">✎</span>
              <input ref="avatarFileInput" type="file" accept="image/*" class="mj-npc-avatar-input" @change="onNpcAvatarFileChange" />
            </div>
            <p v-if="avatarError" class="mj-npc-avatar-error">{{ avatarError }}</p>

            <div class="mj-npc-tabs">
              <button
                type="button"
                class="mj-npc-tab"
                :class="{ 'mj-npc-tab--active': activeTab === 'combat' }"
                @click="switchTab('combat')"
              >战斗</button>
              <button
                type="button"
                class="mj-npc-tab"
                :class="{ 'mj-npc-tab--active': activeTab === 'story' }"
                @click="switchTab('story')"
              >剧情</button>
            </div>

            <div class="mj-npc-tab-content">
              <template v-if="activeTab === 'combat'">
                <div class="mj-npc-hpmp-row">
                  <div class="mj-resource-label">
                    <span>血量</span>
                    <span class="mj-resource-nums">{{ npc.currentHp }} / {{ npc.maxHp }}</span>
                  </div>
                  <div class="mj-bar">
                    <div
                      class="mj-bar-fill mj-bar-fill--hp"
                      :style="{ width: (npc.maxHp > 0 ? Math.round(npc.currentHp / npc.maxHp * 100) : 0) + '%' }"
                    />
                  </div>
                </div>
                <div class="mj-npc-hpmp-row">
                  <div class="mj-resource-label">
                    <span>法力</span>
                    <span class="mj-resource-nums">{{ npc.currentMp }} / {{ npc.maxMp }}</span>
                  </div>
                  <div class="mj-bar">
                    <div
                      class="mj-bar-fill mj-bar-fill--mp"
                      :style="{ width: (npc.maxMp > 0 ? Math.round(npc.currentMp / npc.maxMp * 100) : 0) + '%' }"
                    />
                  </div>
                </div>

                <div class="mj-npc-section-title">属性</div>
                <div class="mj-npc-stats-grid">
                  <template v-for="row in Math.ceil(PRIMARY_STAT_KEYS.length / 2)" :key="row">
                    <template v-for="col in [0, 1]" :key="col">
                      <div v-if="PRIMARY_STAT_KEYS[(row - 1) * 2 + col]" class="mj-stat-cell">
                        <span class="mj-stat-k">{{ PRIMARY_STAT_KEY_TO_ZH[PRIMARY_STAT_KEYS[(row - 1) * 2 + col]] }}</span>
                        <span class="mj-stat-v">{{ primaryStats ? (primaryStats[PRIMARY_STAT_KEYS[(row - 1) * 2 + col]] ?? 0) : 0 }}</span>
                      </div>
                    </template>
                  </template>
                </div>

                <div class="mj-npc-section-title">法宝</div>
                <div class="mj-inventory-grid mj-treasure-grid">
                  <div
                    v-for="slot in equipSlots"
                    :key="slot.key"
                    class="mj-inventory-slot"
                    :class="slot.item ? 'mj-treasure-slot--filled' : ''"
                    :data-rarity="slot.item ? gradeToTraitRarity(slot.item.grade) : undefined"
                    :title="slot.item ? `${treasureCellName(slot.item)}\n（点击查看详情）` : '法宝空位'"
                    :tabindex="slot.item ? 0 : -1"
                    @click="slot.item && openEquipDetail(slot.key)"
                    @keydown="slot.item && ($event.key === 'Enter' || $event.key === ' ') && (openEquipDetail(slot.key), $event.preventDefault())"
                  >
                    <span class="mj-treasure-slot-label">{{ slot.item ? treasureCellName(slot.item) : '' }}</span>
                  </div>
                </div>

                <div class="mj-npc-section-title">功法</div>
                <div class="mj-inventory-grid mj-gongfa-grid">
                  <div
                    v-for="(cell, gi) in gongfaSlots"
                    :key="gi"
                    class="mj-inventory-slot"
                    :class="cell ? 'mj-gongfa-slot--filled' : ''"
                    :data-rarity="cell ? gradeToTraitRarity(cell.grade) : undefined"
                    :title="cell ? `${gongfaCellName(cell)}（第${cell.mastery ?? 1}层）\n（点击查看详情）` : '功法空位'"
                    :tabindex="cell ? 0 : -1"
                    @click="cell && openGongfaDetail(gi)"
                    @keydown="cell && ($event.key === 'Enter' || $event.key === ' ') && (openGongfaDetail(gi), $event.preventDefault())"
                  >
                    <span class="mj-gongfa-slot-label">{{ cell ? gongfaCellName(cell) : '' }}</span>
                    <span v-if="cell && (cell.mastery ?? 1) > 1" class="mj-gongfa-slot-mastery">{{ gongfaMasteryLabel(cell) }}</span>
                  </div>
                </div>

                <div class="mj-npc-section-title">储物袋</div>
                <div class="mj-inventory-grid">
                  <div
                    v-for="(cell, bi) in bagSlots"
                    :key="bi"
                    class="mj-inventory-slot"
                    :class="{
                      'mj-inventory-slot--empty': !inventorySlotParts(cell).filled,
                      'mj-inventory-slot--filled': inventorySlotParts(cell).filled,
                      'mj-inventory-slot--lingshi': inventorySlotParts(cell).lingshi,
                    }"
                    :data-rarity="inventorySlotParts(cell).rarity"
                    :title="cell ? `${inventorySlotParts(cell).label}${inventorySlotParts(cell).qty ? ' ×' + inventorySlotParts(cell).qty : ''}\n（点击查看详情）` : `格 ${bi + 1}`"
                    :tabindex="cell ? 0 : -1"
                    @click="cell && openBagDetail(bi)"
                    @keydown="cell && ($event.key === 'Enter' || $event.key === ' ') && (openBagDetail(bi), $event.preventDefault())"
                  >
                    <span class="mj-inventory-slot-label">{{ inventorySlotParts(cell).label }}</span>
                    <span v-if="inventorySlotParts(cell).qty" class="mj-inventory-slot-qty">{{ inventorySlotParts(cell).qty }}</span>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="mj-npc-story-grid">
                  <div class="mj-stat-cell">
                    <span class="mj-stat-k">性别</span>
                    <span class="mj-stat-v">{{ npc.gender || '—' }}</span>
                  </div>
                  <div class="mj-stat-cell">
                    <span class="mj-stat-k">灵根</span>
                    <span class="mj-stat-v">{{ Character.formatLinggenElements(npc.linggen) }}</span>
                  </div>
                  <div class="mj-stat-cell">
                    <span class="mj-stat-k">年龄</span>
                    <span class="mj-stat-v">{{ npc.age }}</span>
                  </div>
                  <div class="mj-stat-cell">
                    <span class="mj-stat-k">寿元</span>
                    <span class="mj-stat-v">{{ npc.shouyuan }}</span>
                  </div>
                  <div class="mj-stat-cell">
                    <span class="mj-stat-k">修为</span>
                    <span class="mj-stat-v">{{ npc.xiuwei }}</span>
                  </div>
                  <div class="mj-stat-cell">
                    <span class="mj-stat-k">好感度</span>
                    <span class="mj-stat-v">{{ npc.favorability }}（{{ favorLabel(npc.favorability) }}）</span>
                  </div>
                </div>
                <div class="mj-npc-story-section" v-if="npc.personality">
                  <span class="mj-stat-k">性格</span>
                  <div class="mj-npc-story-text">{{ npc.personality }}</div>
                </div>
                <div class="mj-npc-story-section" v-if="npc.currentStageGoal">
                  <span class="mj-stat-k">短期目标</span>
                  <div class="mj-npc-story-text">{{ npc.currentStageGoal }}</div>
                </div>
                <div class="mj-npc-story-section" v-if="npc.longTermGoal">
                  <span class="mj-stat-k">长期目标</span>
                  <div class="mj-npc-story-text">{{ npc.longTermGoal }}</div>
                </div>
                <div class="mj-npc-story-section" v-if="npc.hobby">
                  <span class="mj-stat-k">爱好</span>
                  <div class="mj-npc-story-text">{{ npc.hobby }}</div>
                </div>
                <div class="mj-npc-story-section" v-if="npc.fear">
                  <span class="mj-stat-k">恐惧</span>
                  <div class="mj-npc-story-text">{{ npc.fear }}</div>
                </div>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
    <ProtagonistDetailModal
      :open="itemDetailOpen"
      :payload="itemDetailPayload"
      @close="closeItemDetail"
    />
  </Teleport>
</template>

<style scoped>
.mj-npc-detail-panel {
  max-width: 400px;
  max-height: min(80vh, 620px);
  overflow: auto;
}

.mj-npc-avatar-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 8px 0 4px;
  cursor: pointer;
}

.mj-npc-avatar-wrap:hover .mj-npc-avatar {
  border-color: var(--mj-gold-dim, #c9a227);
}

.mj-npc-avatar-wrap:focus-visible {
  outline: 2px solid var(--mj-gold, #e8c547);
  outline-offset: 3px;
  border-radius: 12px;
}

.mj-npc-avatar {
  width: 80px;
  height: 80px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid var(--mj-border, rgba(140, 120, 83, 0.45));
}

.mj-npc-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  color: var(--mj-muted, #8a9088);
  font-size: 1.8rem;
  font-weight: 600;
  user-select: none;
}

.mj-npc-avatar-edit {
  position: absolute;
  top: 60px;
  right: calc(50% - 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: var(--mj-gold, #e8c547);
  font-size: 0.7rem;
  line-height: 1;
  pointer-events: none;
  opacity: 0.85;
}

.mj-npc-avatar-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.mj-npc-avatar-error {
  margin: 2px 0 6px;
  font-size: 0.72rem;
  color: #e8a598;
  text-align: center;
}

.mj-npc-dead-tag {
  font-size: 0.78rem;
  color: #c62828;
  font-weight: normal;
}

.mj-npc-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 12px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(140, 120, 83, 0.35);
}

.mj-npc-tab {
  flex: 1;
  padding: 7px 0;
  border: none;
  background: transparent;
  color: var(--mj-muted, #8a9088);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.mj-npc-tab:first-child {
  border-right: 1px solid rgba(140, 120, 83, 0.35);
}

.mj-npc-tab--active {
  background: rgba(180, 150, 60, 0.15);
  color: var(--mj-gold, #e8c547);
  font-weight: 600;
}

.mj-npc-tab:hover:not(.mj-npc-tab--active) {
  background: rgba(255, 255, 255, 0.04);
}

.mj-npc-tab-content {
  padding-right: 2px;
}

.mj-npc-hpmp-row {
  margin-bottom: 8px;
}

.mj-npc-hpmp-row .mj-resource-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.84rem;
  color: var(--mj-muted, #8a9088);
  margin-bottom: 4px;
}

.mj-npc-hpmp-row .mj-resource-nums {
  font-size: 1em;
  color: var(--mj-gold, #e8c547);
  font-variant-numeric: tabular-nums;
}

.mj-npc-hpmp-row .mj-bar {
  height: 10px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.mj-npc-hpmp-row .mj-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.2s ease;
}

.mj-npc-hpmp-row .mj-bar-fill--hp {
  background: linear-gradient(90deg, #8b2942, #c62828);
}

.mj-npc-hpmp-row .mj-bar-fill--mp {
  background: linear-gradient(90deg, #1565c0, #4fc3f7);
}

.mj-npc-section-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--mj-gold-dim, #b89a4a);
  margin: 12px 0 6px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.mj-npc-section-title:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.mj-npc-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 16px;
}

.mj-stat-cell {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.mj-stat-k {
  font-size: 0.72rem;
  color: var(--mj-muted, #8a9088);
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.mj-stat-v {
  font-size: 0.85rem;
  color: var(--mj-text, #e8e4dc);
}

.mj-npc-story-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.mj-npc-story-section {
  margin-top: 10px;
}

.mj-npc-story-text {
  font-size: 0.85rem;
  color: var(--mj-text, #e8e4dc);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 3px;
}

/* ---- inventory grids ---- */

.mj-inventory-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 4px;
}

.mj-inventory-slot {
  aspect-ratio: 1;
  min-height: 36px;
  border: 1px dashed rgba(140, 120, 83, 0.4);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 5px;
  box-sizing: border-box;
  position: relative;
}

.mj-inventory-slot--empty {
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

/* treasure */

.mj-treasure-slot--filled {
  border-style: solid;
  cursor: pointer;
}

.mj-treasure-slot--filled[data-rarity] {
  border-color: var(--mj-rarity-active);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mj-rarity-active) 25%, transparent);
}

.mj-treasure-slot--filled:focus-visible {
  outline: 2px solid var(--mj-gold, #e8c547);
  outline-offset: 1px;
}

.mj-treasure-slot-label {
  width: 100%;
  max-height: 100%;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  color: var(--mj-text, #e8e4dc);
}

/* gongfa */

.mj-gongfa-slot--filled {
  border-style: solid;
  cursor: pointer;
}

.mj-gongfa-slot--filled[data-rarity] {
  border-color: var(--mj-rarity-active);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mj-rarity-active) 25%, transparent);
}

.mj-gongfa-slot--filled:focus-visible {
  outline: 2px solid var(--mj-gold, #e8c547);
  outline-offset: 1px;
}

.mj-gongfa-slot-label {
  width: 100%;
  max-height: 100%;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  color: var(--mj-text, #e8e4dc);
}

.mj-gongfa-slot-mastery {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 0.65rem;
  color: var(--mj-gold-dim, #a89040);
  opacity: 0.85;
}

/* inventory bag slots */

.mj-inventory-slot-label {
  font-size: 0.8rem;
  line-height: 1.15;
  text-align: center;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  color: var(--mj-text, #e8e4dc);
}

.mj-inventory-slot--empty .mj-inventory-slot-label {
  color: transparent;
}

.mj-inventory-slot-qty {
  position: absolute;
  bottom: 3px;
  right: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--mj-gold-dim, #b89a4a);
  line-height: 1;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  pointer-events: none;
}
</style>
