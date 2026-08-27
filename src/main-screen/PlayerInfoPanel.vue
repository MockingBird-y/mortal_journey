<script setup lang="ts">
/**
 * 左栏：主角档案。类名与 `mortal_journey/css/main.css` 左栏（mj-*）对齐；数据为 `playInfo.ProtagonistPlayInfo`。
 * 展示派生逻辑见 `lib/protagonistPanelDisplay.ts`；详情弹窗见 `ProtagonistDetailModal.vue`。
 */
import { computed, ref } from "vue";
import { Protagonist } from "../role_core/Protagonist";
import { PRIMARY_STAT_KEY_TO_ZH, PRIMARY_STAT_KEYS, PRIMARY_STAT_KEY_DESC, formatLinggenBonusText, type EquipSlotKey, type PrimaryStatKey } from "../role_core/types/playInfo";
import type { GongfaItemDefinition } from "../role_core/types/itemInfo";
import { computeLinggenCombatBonuses } from "../role_core/types/gameConstants";
import { computePanelCombatStats } from "../battle_engine/panelStats";
import { CRAFT_SKILL_KEYS, CRAFT_SKILL_TO_ZH, CRAFT_SKILL_DESC, craftUpgradeChance } from "../role_core/craft";
import { timedBuffDaysLeft } from "../role_core/timedBuff";
import { charmTierLabel, fameTierLabel } from "../role_core/roleplayStats";
import { CREATION_FACTIONS, CREATION_RACES } from "../fate_choice/types";
import { PRIMARY_STAT_KEY_TO_ZH as STAT_ZH } from "../role_core/types/playInfo";
import type { DerivedStatValues } from "./protagonistDetailPayload";
import {
  buildGongfaDetailPayload,
  buildInventoryStackDetailPayload,
  buildTraitDetailPayload,
  buildWearableDetailPayload,
  type ProtagonistDetailAction,
  type ProtagonistDetailPayload,
} from "./protagonistDetailPayload";
import {
  getCultivationUiState,
  getEquipSlotRows,
  getHpMpBarState,
  getInventoryBagDisplaySlots,
  INVENTORY_BAG_SIDEBAR_SLOTS,
  gongfaCellName,
  displayStatInt,
  gradeToTraitRarity,
  inventorySlotParts,
  traitSlotInnerText,
  traitSlotRarity,
  traitSlotTitle,
  treasureCellName,
  gongfaMasteryLabel,
  gongfaMasteryThresholdText,
  getShouyuanWarningLevel,
} from "./protagonistPanelDisplay";
import ProtagonistDetailModal from "./ProtagonistDetailModal.vue";
import GongfaCultivateModal from "./GongfaCultivateModal.vue";
import type { CultivationInput, CultivationConfirmPayload } from "../ai/cultivation_types";
import {
  calendarYearsElapsed,
  formatWorldTimeZhDisplay,
  type WorldTime,
} from "../role_core/worldTime";
import { getSpiritStoneCount } from "../role_core/CharacterInventory";
import { getGongfaMasteryProgress } from "./protagonistPanelDisplay";
import { writeActiveSave } from "../save/gameSave";
import { generateProtagonistPortrait, isImageApiConfigured } from "../image_generate";
import PortraitHistoryModal from "./PortraitHistoryModal.vue";
import InventoryBagModal from "./InventoryBagModal.vue";

const props = defineProps<{
  protagonist: Protagonist | null;
  worldTime: WorldTime;
  worldTimeBaseline: WorldTime;
}>();

const emit = defineEmits<{
  "update:worldTime": [value: WorldTime];
  "cultivate": [value: CultivationInput];
}>();
const worldTimeTitle = computed(() => formatWorldTimeZhDisplay(props.worldTime));

/**
 * 面板年龄：档案开局年龄 + 自 `worldTimeBaseline` 至 `worldTime` 的整年差（仅当存在主角时在模板中展示）。
 * 推进 `worldTime` 的年份即可同步长龄，无需把世界时间存成字符串再解析。
 */
const panelAgeForDisplay = computed(() => {
  const p = props.protagonist;
  if (!p || !p.ageConfirmed) return "—";
  return p.age + calendarYearsElapsed(props.worldTimeBaseline, props.worldTime);
});

const cultivationUi = computed(() => getCultivationUiState(props.protagonist));
const primaryStats = computed(() => props.protagonist?.getPrimaryStats() ?? null);

/** 战斗属性区块：基础值 + 灵根 + 法宝词条 + 被动功法修正的静态汇总（与战斗初始化同源）。 */
const combatStatRows = computed(() => {
  const p = props.protagonist;
  if (!p) return [];
  const c = computePanelCombatStats(p);
  const fmt = (v: number) => `${Math.round(v * 10) / 10}%`;
  return [
    { k: "暴击率", v: fmt(c.critRate), tip: "攻击造成暴击的概率，来自法宝词条与被动功法" },
    { k: "暴击伤害", v: fmt(c.critDmg), tip: "暴击时造成的伤害倍率（基础150%，金灵根提升）" },
    { k: "闪避率", v: fmt(c.dodgeRate), tip: "完全闪避一次攻击的概率" },
    { k: "吸血", v: fmt(c.lifesteal), tip: "造成伤害后按比例回复血量" },
    { k: "增伤", v: fmt(c.damageDealt), tip: "造成的最终伤害提升" },
    { k: "减伤", v: fmt(c.damageReduction), tip: "受到的最终伤害降低" },
    { k: "回血", v: fmt(c.hpRecoverPerTurn), tip: "战斗中每回合自动恢复最大血量的百分比（火灵根增强）" },
    { k: "回蓝", v: fmt(c.mpRecoverPerTurn), tip: "战斗中每回合自动恢复最大法力的百分比" },
  ];
});
const hpMp = computed(() => getHpMpBarState(props.protagonist, props.protagonist ? { hp: props.protagonist.maxHp, mp: props.protagonist.maxMp } : null));
const equipSlots = computed(() => getEquipSlotRows(props.protagonist));
/** 天赋平铺列表：条数不再固定为 5，直接铺开主角实际持有的全部天赋。 */
const traitRows = computed(() => props.protagonist?.traits ?? []);
/** 侧栏只铺前 `INVENTORY_BAG_SIDEBAR_SLOTS` 格：储物袋无上限，铺全了会把侧栏撑得很长。 */
const inventoryBagDisplaySlots = computed(() =>
  (props.protagonist ? getInventoryBagDisplaySlots(props.protagonist.inventorySlots) : []).slice(
    0,
    INVENTORY_BAG_SIDEBAR_SLOTS,
  ),
);
/** 侧栏放不下的格数；> 0 时才显示「更多」。 */
const inventoryBagOverflow = computed(() =>
  Math.max(0, (props.protagonist?.inventorySlots.length ?? 0) - INVENTORY_BAG_SIDEBAR_SLOTS),
);
const bagModalOpen = ref(false);
const shouyuanWarning = computed(() => getShouyuanWarningLevel(props.protagonist, props.worldTimeBaseline, props.worldTime));

const raceTooltip = computed(() => {
  const race = props.protagonist?.race;
  return race ? CREATION_RACES[race]?.desc ?? "" : "";
});

const factionTooltip = computed(() => {
  const faction = props.protagonist?.faction;
  return faction ? CREATION_FACTIONS[faction]?.desc ?? "" : "";
});

const linggenTooltip = computed(() => {
  const p = props.protagonist;
  if (!p) return "";
  const major = p.realm.major;
  return p.linggen
    .map(el => {
      const text = formatLinggenBonusText(el, major);
      return text ? `${el}：${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
});

/** 技艺区块：四门技艺的熟练度与当前品阶跃迁概率。 */
const craftSkillRows = computed(() => {
  const p = props.protagonist;
  if (!p) return [];
  return CRAFT_SKILL_KEYS.map((k) => {
    const prof = p.craftSkills[k] ?? 0;
    return {
      k,
      label: CRAFT_SKILL_TO_ZH[k],
      value: prof,
      tip: `${CRAFT_SKILL_DESC[k]}
当前熟练度 ${prof}，品阶跃迁概率 ${(Math.round(craftUpgradeChance(prof) * 10) / 10)}%`,
    };
  });
});

/**
 * 魅力色阶：低档以中性灰蓝起步，中段转为清透青绿，高档落在暖金与柔粉。
 * 颜色均选用较高明度，兼顾默认深色与冰蓝半透明背景上的可读性。
 */
const CHARM_TIER_COLORS = [
  "#AAB1BD",
  "#A9BAC8",
  "#A5C7D2",
  "#9DD1D1",
  "#97D5C3",
  "#A4D8B2",
  "#BDDAA2",
  "#D7D99A",
  "#E8C995",
  "#F0B5C7",
] as const;

/**
 * 名声色阶：恶名使用红橙色，零附近使用灰蓝色，正名使用冰青、绿色与金色。
 * 除色相外也有明度变化，降低红绿色觉差异带来的辨识压力。
 */
const FAME_TIER_COLORS = [
  "#F29AA3",
  "#F0A09F",
  "#EEA69A",
  "#EBAC94",
  "#E6B28F",
  "#DCB98D",
  "#CFBF91",
  "#C2C49A",
  "#B5C8A5",
  "#A8CBB2",
  "#B7C3D2",
  "#A9C8D8",
  "#9DCCD9",
  "#91D0D5",
  "#87D3CC",
  "#86D4BD",
  "#91D5AC",
  "#A6D49A",
  "#C0D28D",
  "#D9CD8A",
] as const;

function roleplayTierColor(value: number, min: number, colors: readonly string[]): string {
  const tierIndex = Math.floor((value - min) / 10);
  return colors[Math.max(0, Math.min(colors.length - 1, tierIndex))] ?? "#D7EAEA";
}

/** 声望区块：魅力/名声的数值、查表得出的档位名，以及 AI 撰写的具体描述。 */
const roleplayStatRows = computed(() => {
  const p = props.protagonist;
  if (!p) return [];
  return [
    {
      key: "charm",
      label: "魅力",
      value: p.charm,
      tier: charmTierLabel(p.charm),
      tierColor: roleplayTierColor(p.charm, 0, CHARM_TIER_COLORS),
      desc: p.charmDesc,
    },
    {
      key: "fame",
      label: "名声",
      value: p.fame,
      tier: fameTierLabel(p.fame),
      tierColor: roleplayTierColor(p.fame, -100, FAME_TIER_COLORS),
      desc: p.fameDesc,
    },
  ].map((r) => ({ ...r, tip: r.desc ? `${r.tier}（${r.value}）
${r.desc}` : `${r.tier}（${r.value}）` }));
});

/** 生效中的限时增益（餐食等），含剩余天数与效果文案。 */
const activeBuffRows = computed(() => {
  const p = props.protagonist;
  if (!p) return [];
  return p.getActiveTimedBuffs().map((b) => {
    const parts = Object.entries(b.statPercents)
      .filter(([, v]) => typeof v === "number" && v !== 0)
      .map(([k, v]) => `${STAT_ZH[k as PrimaryStatKey]} ${(v as number) > 0 ? "+" : ""}${v}%`);
    return {
      id: b.id,
      name: b.name,
      effectText: parts.join("　"),
      daysLeft: timedBuffDaysLeft(b, props.worldTime),
      tip: `${b.desc}
${parts.join("，")}`,
    };
  });
});

const detailOpen = ref(false);
const detailPayload = ref<ProtagonistDetailPayload | null>(null);

type PlayerPanelSectionId =
  | "attributes"
  | "combat"
  | "craft"
  | "roleplay"
  | "buffs"
  | "talents"
  | "equipment"
  | "gongfa"
  | "inventory";

const collapsedSections = ref<Record<PlayerPanelSectionId, boolean>>({
  attributes: false,
  combat: false,
  craft: false,
  roleplay: false,
  buffs: false,
  talents: false,
  equipment: false,
  gongfa: false,
  inventory: false,
});

function toggleSection(section: PlayerPanelSectionId): void {
  collapsedSections.value[section] = !collapsedSections.value[section];
}

function sectionExpanded(section: PlayerPanelSectionId): boolean {
  return !collapsedSections.value[section];
}

// ── 主角立绘生成 ──────────────────────────────────────────────────────────
const generatingPortrait = ref(false);
const portraitGenError = ref("");
const imageApiReady = computed(() => isImageApiConfigured());
const historyModalOpen = ref(false);

async function onGeneratePortrait() {
  const p = props.protagonist;
  if (!p || generatingPortrait.value) return;
  generatingPortrait.value = true;
  portraitGenError.value = "";
  try {
    const dataUrl = await generateProtagonistPortrait(p);
    p.addPortraitCandidate(dataUrl);
    writeActiveSave();
  } catch (err) {
    portraitGenError.value = err instanceof Error ? err.message : "立绘生成失败。";
  } finally {
    generatingPortrait.value = false;
  }
}

function onSelectCandidate(url: string) {
  const p = props.protagonist;
  if (!p) return;
  p.selectPortrait(url);
  writeActiveSave();
}

function onRemoveCandidate(url: string) {
  const p = props.protagonist;
  if (!p) return;
  p.removePortraitCandidate(url);
  writeActiveSave();
}

function openHistoryModal() {
  historyModalOpen.value = true;
}
function closeHistoryModal() {
  historyModalOpen.value = false;
}

function onHistoryUpload(dataUrl: string) {
  const p = props.protagonist;
  if (!p) return;
  p.addPortraitCandidate(dataUrl);
  writeActiveSave();
}

function closeDetail() {
  detailOpen.value = false;
  detailPayload.value = null;
}

function openDetail(p: ProtagonistDetailPayload | null) {
  if (!p) return;
  detailPayload.value = p;
  detailOpen.value = true;
}

const ZH_STAT_TO_KEY: Readonly<Record<string, PrimaryStatKey>> = (() => {
  const o: Record<string, PrimaryStatKey> = {};
  for (const en of Object.keys(PRIMARY_STAT_KEY_TO_ZH) as PrimaryStatKey[]) {
    o[PRIMARY_STAT_KEY_TO_ZH[en]] = en;
  }
  return o;
})();

function getGongfaScalingStat(p: Protagonist, gf: GongfaItemDefinition): number {
  const bonus = gf.bonus as Record<string, number>;
  const firstKey = Object.keys(bonus)[0];
  if (!firstKey) return 0;
  const statKey = ZH_STAT_TO_KEY[firstKey];
  if (!statKey) return 0;
  return p.getPrimaryStats()[statKey] ?? 0;
}

function getGongfaScalingStatName(gf: GongfaItemDefinition): string {
  const bonus = gf.bonus as Record<string, number>;
  return Object.keys(bonus)[0] ?? "";
}

function getGongfaDerivedStats(p: Protagonist): DerivedStatValues {
  const ps = p.getPrimaryStats();
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

function onTraitSlotClick(index: number) {
  const p = props.protagonist;
  if (!p) return;
  const t = p.traits[index];
  if (t == null) return;
  openDetail(buildTraitDetailPayload(t));
}

function onEquipSlotClick(key: EquipSlotKey) {
  const p = props.protagonist;
  if (!p) return;
  const it = p.equippedSlots[key];
  if (!it) return;
  openDetail(buildWearableDetailPayload(it, { type: "equipped", equipSlot: key }, p.realm));
}

function onGongfaSlotClick(index: number) {
  const p = props.protagonist;
  if (!p) return;
  const cell = p.gongfaSlots[index];
  if (!cell) return;
  const statGetter = () => getGongfaScalingStat(p, cell);
  const nameGetter = () => getGongfaScalingStatName(cell);
  const dsGetter = () => getGongfaDerivedStats(p);
  openDetail(buildGongfaDetailPayload(cell, { type: "bar", gongfaIndex: index }, p.linggen, statGetter, nameGetter, dsGetter, computeLinggenCombatBonuses(p.linggen, p.realm.major).cooldownReduce));
}

function onBagSlotClick(index: number) {
  const p = props.protagonist;
  if (!p) return;
  const cell = p.inventorySlots[index];
  if (!cell) return;
  const gfg = (gf: GongfaItemDefinition) => getGongfaScalingStat(p, gf);
  const sng = (gf: GongfaItemDefinition) => getGongfaScalingStatName(gf);
  const dsg = (gf: GongfaItemDefinition) => getGongfaDerivedStats(p);
  openDetail(buildInventoryStackDetailPayload(cell, index, p.linggen, gfg, sng, dsg, computeLinggenCombatBonuses(p.linggen, p.realm.major).cooldownReduce, p.realm.major));
}

function onDetailAction(a: ProtagonistDetailAction) {
  if (a.id === "cultivateGongfa") {
    cultivateGongfaIndex.value = a.gongfaIndex;
    closeDetail();
    cultivateOpen.value = true;
    return;
  }
  props.protagonist?.applyDetailAction(a);
  writeActiveSave();
  closeDetail();
}

const cultivateOpen = ref(false);
const cultivateGongfaIndex = ref(-1);

const cultivateGongfa = computed(() => {
  const p = props.protagonist;
  if (!p || cultivateGongfaIndex.value < 0) return null;
  return p.gongfaSlots[cultivateGongfaIndex.value] ?? null;
});

const spiritStoneCount = computed(() => {
  return props.protagonist ? getSpiritStoneCount(props.protagonist) : 0;
});

function closeCultivate() {
  cultivateOpen.value = false;
  cultivateGongfaIndex.value = -1;
}

function onCultivateConfirm(payload: CultivationConfirmPayload) {
  const p = props.protagonist;
  const gf = cultivateGongfa.value;
  if (!p || !gf || payload.spiritStoneCount <= 0) return;

  const mp = getGongfaMasteryProgress(gf);

  emit("cultivate", {
    gongfaIndex: cultivateGongfaIndex.value,
    gongfaName: gf.name,
    gongfaGrade: gf.grade,
    gongfaSystem: gf.system ?? "法修",
    currentMastery: mp.mastery,
    currentMasteryExp: mp.exp,
    masteryThreshold: mp.threshold,
    spiritStoneCount: payload.spiritStoneCount,
    estimatedMonths: payload.estimatedMonths,
  });

  closeCultivate();
}

function onSlotKeydown(e: KeyboardEvent, fn: () => void) {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  fn();
}
</script>

<template>
  <section class="main-panel main-panel--player mj-pane--player" aria-label="主角信息">
    <InventoryBagModal
      :open="bagModalOpen && !!protagonist"
      :slots="protagonist?.inventorySlots ?? []"
      @close="bagModalOpen = false"
      @select="onBagSlotClick"
    />
    <ProtagonistDetailModal
      :open="detailOpen"
      :payload="detailPayload"
      @close="closeDetail"
      @action="onDetailAction"
    />
    <GongfaCultivateModal
      :open="cultivateOpen"
      :gongfa="cultivateGongfa"
      :spirit-stone-count="spiritStoneCount"
      :linggen-count="protagonist?.linggen?.length ?? 0"
      :insight="protagonist?.getPrimaryStats()?.insight ?? 0"
      @close="closeCultivate"
      @confirm="onCultivateConfirm"
    />
    <header class="main-panel__meta-strip" aria-label="世界时间" :title="worldTimeTitle">
      <p class="main-panel__meta-strip-text">{{ worldTimeTitle }}</p>
    </header>
    <div class="main-panel__body">
      <template v-if="!protagonist">
        <p class="main-panel__placeholder">完成命运抉择后将在此显示主角档案。</p>
      </template>
      <div v-else class="mj-player-body">
        <div class="mj-player-avatar-wrap">
          <div class="mj-player-avatar-row">


            <div class="mj-player-avatar-area">
              <img
                v-if="protagonist.avatarUrl"
                class="mj-player-avatar"
                :src="protagonist.avatarUrl"
                :alt="protagonist.displayName"
              />
              <div v-else class="mj-player-avatar mj-player-avatar--placeholder" aria-hidden="true">头像</div>
            </div>
            <div class="mj-player-portrait-actions">
              <button
                type="button"
                class="mj-player-gen-btn"
                :disabled="!imageApiReady || generatingPortrait"
                :title="imageApiReady ? '生成修仙立绘' : '未配置文生图'"
                @click.stop="onGeneratePortrait"
              >{{ generatingPortrait ? '…' : '✨' }}</button>
              <button
                type="button"
                class="mj-player-history-btn"
                title="管理历史立绘"
                @click.stop="openHistoryModal"
              >📜</button>
            </div>
          </div>
          <div class="mj-player-name-vertical">{{ protagonist.displayName }}</div>
          <p v-if="!imageApiReady && !portraitGenError" class="mj-player-gen-hint">未配置文生图</p>
          <p v-if="portraitGenError" class="mj-player-gen-error">{{ portraitGenError }}</p>
        </div>

        <p class="mj-realm-line">{{ Protagonist.formatRealm(protagonist.realm) }}<template v-if="protagonist.realmComplete">·圆满</template></p>

        <div class="mj-resource-row">
          <div class="mj-cultivation-head">
            <div class="mj-resource-label mj-resource-label--cultivation">
              <span>修为</span>
              <span class="mj-resource-nums">
                {{ cultivationUi.displayCur
                }}<template v-if="cultivationUi.req != null && cultivationUi.req > 0">
                  / {{ cultivationUi.req }}</template
                >
              </span>
            </div>
          </div>
          <template v-if="cultivationUi.req != null && cultivationUi.req > 0">
            <div
              class="mj-bar"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="Math.round(cultivationUi.pct)"
            >
              <div
                class="mj-bar-fill mj-bar-fill--cultivation"
                :style="{ width: cultivationUi.pct + '%' }"
              />
            </div>
          </template>
          <p v-else class="mj-player-info-muted">当前境界无修为阶段需求表项。</p>
        </div>

        <div class="mj-player-identity">
          <div class="mj-stat-pair-row">
            <div class="mj-stat-cell">
              <span class="mj-stat-k">性别</span>
              <span class="mj-stat-v">{{ protagonist.gender || "—" }}</span>
            </div>
            <div class="mj-stat-cell" :title="linggenTooltip">
              <span class="mj-stat-k">灵根</span>
              <span class="mj-stat-v">{{ Protagonist.formatLinggenElements(protagonist.linggen) }}</span>
            </div>
          </div>
          <div class="mj-stat-pair-row">
            <div class="mj-stat-cell">
              <span class="mj-stat-k">年龄</span>
              <span class="mj-stat-v">{{ panelAgeForDisplay }}</span>
            </div>
            <div class="mj-stat-cell">
              <span class="mj-stat-k">寿元</span>
              <span class="mj-stat-v" :class="{ 'mj-stat-v--danger': shouyuanWarning === 'danger', 'mj-stat-v--warning': shouyuanWarning === 'warning' }">{{ protagonist.shouyuan }}</span>
            </div>
          </div>
          <div class="mj-stat-pair-row">
            <div class="mj-stat-cell" :title="raceTooltip">
              <span class="mj-stat-k">种族</span>
              <span class="mj-stat-v">{{ protagonist.race || "—" }}</span>
            </div>
            <div class="mj-stat-cell" :title="factionTooltip">
              <span class="mj-stat-k">阵营</span>
              <span class="mj-stat-v">{{ protagonist.faction || "—" }}</span>
            </div>
          </div>
        </div>

        <div v-if="hpMp" class="mj-resource-row">
          <div class="mj-resource-label">
            <span>血量</span>
            <span class="mj-resource-nums"
              >{{ displayStatInt(hpMp.curH) }} / {{ displayStatInt(hpMp.maxH) }}</span
            >
          </div>
          <div class="mj-bar" role="progressbar" :aria-valuenow="Math.round(hpMp.hpPct)">
            <div class="mj-bar-fill mj-bar-fill--hp" :style="{ width: hpMp.hpPct + '%' }" />
          </div>
        </div>
        <div v-if="hpMp" class="mj-resource-row">
          <div class="mj-resource-label">
            <span>法力</span>
            <span class="mj-resource-nums"
              >{{ displayStatInt(hpMp.curM) }} / {{ displayStatInt(hpMp.maxM) }}</span
            >
          </div>
          <div class="mj-bar" role="progressbar" :aria-valuenow="Math.round(hpMp.mpPct)">
            <div class="mj-bar-fill mj-bar-fill--mp" :style="{ width: hpMp.mpPct + '%' }" />
          </div>
        </div>

        <div class="mj-combat-stats" :class="{ 'is-collapsed': !sectionExpanded('attributes') }">
          <button
            type="button"
            class="mj-attr-section-header mj-collapsible-section__trigger"
            :aria-expanded="sectionExpanded('attributes')"
            aria-controls="mj-player-section-attributes"
            @click="toggleSection('attributes')"
          >
            <h3 class="mj-attr-section-title mj-attr-section-title--first">属性</h3>
          </button>
          <div id="mj-player-section-attributes" v-show="sectionExpanded('attributes')">
            <div v-for="row in Math.ceil(PRIMARY_STAT_KEYS.length / 2)" :key="row" class="mj-stat-pair-row">
              <template v-for="col in [0, 1]" :key="col">
                 <div v-if="PRIMARY_STAT_KEYS[(row - 1) * 2 + col]" class="mj-stat-cell" :class="col === 1 ? 'mj-stat-cell--right' : ''">
                   <span class="mj-stat-k mj-stat-k--tip" :data-tip="PRIMARY_STAT_KEY_DESC[PRIMARY_STAT_KEYS[(row - 1) * 2 + col]]">{{ PRIMARY_STAT_KEY_TO_ZH[PRIMARY_STAT_KEYS[(row - 1) * 2 + col]] }}</span>
                  <span class="mj-stat-v">{{ primaryStats ? (primaryStats[PRIMARY_STAT_KEYS[(row - 1) * 2 + col]] ?? 0) : 0 }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="mj-combat-stats" :class="{ 'is-collapsed': !sectionExpanded('combat') }">
          <button
            type="button"
            class="mj-attr-section-header mj-collapsible-section__trigger"
            :aria-expanded="sectionExpanded('combat')"
            aria-controls="mj-player-section-combat"
            @click="toggleSection('combat')"
          >
            <h3 class="mj-attr-section-title">战斗属性</h3>
          </button>
          <div id="mj-player-section-combat" v-show="sectionExpanded('combat')">
            <div v-for="row in Math.ceil(combatStatRows.length / 2)" :key="row" class="mj-stat-pair-row">
              <template v-for="col in [0, 1]" :key="col">
                <div v-if="combatStatRows[(row - 1) * 2 + col]" class="mj-stat-cell" :class="col === 1 ? 'mj-stat-cell--right' : ''">
                  <span class="mj-stat-k mj-stat-k--tip" :data-tip="combatStatRows[(row - 1) * 2 + col].tip">{{ combatStatRows[(row - 1) * 2 + col].k }}</span>
                  <span class="mj-stat-v">{{ combatStatRows[(row - 1) * 2 + col].v }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="mj-combat-stats" :class="{ 'is-collapsed': !sectionExpanded('roleplay') }">
          <button
            type="button"
            class="mj-attr-section-header mj-collapsible-section__trigger"
            :aria-expanded="sectionExpanded('roleplay')"
            aria-controls="mj-player-section-roleplay"
            @click="toggleSection('roleplay')"
          >
            <h3 class="mj-attr-section-title">声望</h3>
          </button>
          <div id="mj-player-section-roleplay" v-show="sectionExpanded('roleplay')" class="mj-roleplay-list">
            <div v-for="r in roleplayStatRows" :key="r.key" class="mj-stat-cell" :title="r.tip">
              <span class="mj-stat-k">{{ r.label }}</span>
              <span class="mj-stat-v mj-roleplay-value">
                <span class="mj-roleplay-tier" :style="{ color: r.tierColor }">{{ r.tier }}</span>
                <span class="mj-roleplay-number">· {{ r.value }}</span>
              </span>
            </div>
          </div>
        </div>

        <div class="mj-combat-stats" :class="{ 'is-collapsed': !sectionExpanded('craft') }">
          <button
            type="button"
            class="mj-attr-section-header mj-collapsible-section__trigger"
            :aria-expanded="sectionExpanded('craft')"
            aria-controls="mj-player-section-craft"
            @click="toggleSection('craft')"
          >
            <h3 class="mj-attr-section-title">技艺</h3>
          </button>
          <div id="mj-player-section-craft" v-show="sectionExpanded('craft')">
            <div v-for="row in Math.ceil(craftSkillRows.length / 2)" :key="'craft-' + row" class="mj-stat-pair-row">
              <template v-for="col in [0, 1]" :key="col">
                <div v-if="craftSkillRows[(row - 1) * 2 + col]" class="mj-stat-cell" :class="col === 1 ? 'mj-stat-cell--right' : ''">
                  <span class="mj-stat-k mj-stat-k--tip" :data-tip="craftSkillRows[(row - 1) * 2 + col].tip">{{ craftSkillRows[(row - 1) * 2 + col].label }}</span>
                  <span class="mj-stat-v">{{ craftSkillRows[(row - 1) * 2 + col].value }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div v-if="activeBuffRows.length > 0" class="mj-combat-stats" :class="{ 'is-collapsed': !sectionExpanded('buffs') }">
          <button
            type="button"
            class="mj-attr-section-header mj-collapsible-section__trigger"
            :aria-expanded="sectionExpanded('buffs')"
            aria-controls="mj-player-section-buffs"
            @click="toggleSection('buffs')"
          >
            <h3 class="mj-attr-section-title">增益</h3>
          </button>
          <div id="mj-player-section-buffs" v-show="sectionExpanded('buffs')">
            <div v-for="b in activeBuffRows" :key="b.id" class="mj-stat-cell mj-buff-row" :title="b.tip">
              <span class="mj-stat-k">{{ b.name }}</span>
              <span class="mj-stat-v mj-buff-effect">{{ b.effectText }}</span>
              <span class="mj-buff-days">余{{ b.daysLeft }}天</span>
            </div>
          </div>
        </div>

        <div class="mj-talent-block" :class="{ 'is-collapsed': !sectionExpanded('talents') }">
          <button
            type="button"
            class="mj-attr-section-header mj-collapsible-section__trigger"
            :aria-expanded="sectionExpanded('talents')"
            aria-controls="mj-player-section-talents"
            @click="toggleSection('talents')"
          >
            <h3 class="mj-attr-section-title">天赋</h3>
          </button>
          <div id="mj-player-section-talents" v-show="sectionExpanded('talents')" class="mj-talent-row" role="list">
            <div
              v-for="(t, ti) in traitRows"
              :key="ti"
              class="mj-stat-cell mj-talent-item"
              :data-rarity="traitSlotRarity(t) ?? undefined"
              :title="traitSlotTitle(t) + '\n（点击查看详情）'"
              role="listitem"
              tabindex="0"
              @click="onTraitSlotClick(ti)"
              @keydown="onSlotKeydown($event, () => onTraitSlotClick(ti))"
            >
              <span class="mj-stat-k">{{ traitSlotInnerText(t) }}</span>
              <span class="mj-stat-v">{{ traitSlotRarity(t) ?? "" }}</span>
            </div>
            <div v-if="!traitRows.length" class="mj-stat-cell mj-talent-item mj-talent-item--empty">
              <span class="mj-stat-k">暂无天赋</span>
            </div>
          </div>
        </div>

        <div class="mj-equip-block" :class="{ 'is-collapsed': !sectionExpanded('equipment') }">
          <button
            type="button"
            class="mj-attr-section-header mj-collapsible-section__trigger"
            :aria-expanded="sectionExpanded('equipment')"
            aria-controls="mj-player-section-equipment"
            @click="toggleSection('equipment')"
          >
            <h3 class="mj-attr-section-title">法宝</h3>
          </button>
          <div id="mj-player-section-equipment" v-show="sectionExpanded('equipment')" class="mj-inventory-grid mj-treasure-grid" aria-label="法宝栏四格">
            <div
              v-for="slot in equipSlots"
              :key="slot.key"
              class="mj-inventory-slot"
              :class="slot.item ? 'mj-treasure-slot--filled' : ''"
              :data-rarity="slot.item ? gradeToTraitRarity(slot.item.grade) : undefined"
              :title="slot.item ? `${treasureCellName(slot.item)}\n（点击查看详情）` : '法宝空位'"
              :tabindex="slot.item ? 0 : -1"
              @click="slot.item && onEquipSlotClick(slot.key)"
              @keydown="slot.item && onSlotKeydown($event, () => onEquipSlotClick(slot.key))"
            >
              <span class="mj-treasure-slot-label">{{ slot.item ? treasureCellName(slot.item) : "" }}</span>
            </div>
          </div>
        </div>

        <div class="mj-player-bag-stack" :class="{ 'is-collapsed': !sectionExpanded('gongfa') }">
          <button
            type="button"
            class="mj-attr-section-header mj-collapsible-section__trigger"
            :aria-expanded="sectionExpanded('gongfa')"
            aria-controls="mj-player-section-gongfa"
            @click="toggleSection('gongfa')"
          >
            <h3 class="mj-attr-section-title">功法</h3>
          </button>
          <div id="mj-player-section-gongfa" v-show="sectionExpanded('gongfa')" class="mj-bag-grid-scroll mj-bag-grid-scroll--gongfa">
            <div class="mj-inventory-grid mj-gongfa-grid" aria-label="功法栏八格">
              <div
                v-for="(cell, gi) in protagonist.gongfaSlots"
                :key="gi"
                class="mj-inventory-slot"
                :class="cell ? 'mj-gongfa-slot--filled' : ''"
                :data-rarity="cell ? gradeToTraitRarity(cell.grade) : undefined"
                :title="cell ? `${gongfaCellName(cell)}（第${cell.mastery ?? 1}层${cell.masteryExp ? ' ' + cell.masteryExp + '/' + gongfaMasteryThresholdText(cell) : ''}）\n（点击查看详情）` : '功法空位'"
                :tabindex="cell ? 0 : -1"
                @click="cell && onGongfaSlotClick(gi)"
                @keydown="cell && onSlotKeydown($event, () => onGongfaSlotClick(gi))"
              >
                <span class="mj-gongfa-slot-label">{{ cell ? gongfaCellName(cell) : "" }}</span>
                <span v-if="cell" class="mj-gongfa-slot-mastery">{{ gongfaMasteryLabel(cell) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mj-player-bag-stack" :class="{ 'is-collapsed': !sectionExpanded('inventory') }">
          <button
            type="button"
            class="mj-attr-section-header mj-collapsible-section__trigger"
            :aria-expanded="sectionExpanded('inventory')"
            aria-controls="mj-player-section-inventory"
            @click="toggleSection('inventory')"
          >
            <h3 class="mj-attr-section-title">储物袋</h3>
          </button>
          <div id="mj-player-section-inventory" v-show="sectionExpanded('inventory')" class="mj-bag-grid-scroll mj-bag-grid-scroll--inventory" role="region" aria-label="储物袋格子">
            <div id="mj-inventory-grid" class="mj-inventory-grid">
              <div
                v-for="(cell, bi) in inventoryBagDisplaySlots"
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
                @click="cell && onBagSlotClick(bi)"
                @keydown="cell && onSlotKeydown($event, () => onBagSlotClick(bi))"
              >
                <span class="mj-inventory-slot-label">{{ inventorySlotParts(cell).label }}</span>
                <span v-if="inventorySlotParts(cell).qty" class="mj-inventory-slot-qty">{{
                  inventorySlotParts(cell).qty
                }}</span>
              </div>
            </div>
            <button
              v-if="inventoryBagOverflow > 0"
              type="button"
              class="main-screen__btn"
              @click="bagModalOpen = true"
            >
              更多（还有 {{ inventoryBagOverflow }} 格）
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>


  <PortraitHistoryModal
    :open="historyModalOpen && !!protagonist"
    :display-name="protagonist?.displayName ?? ''"
    :candidates="protagonist?.avatarCandidates ?? []"
    :avatar-url="protagonist?.avatarUrl ?? ''"
    @close="closeHistoryModal"
    @select="onSelectCandidate"
    @remove="onRemoveCandidate"
    @upload="onHistoryUpload"
  />
</template>

<style scoped>
.mj-buff-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  width: 100%;
}

.mj-buff-effect {
  flex: 1;
  font-size: 0.72rem;
}

.mj-buff-days {
  font-size: 0.7rem;
  opacity: 0.7;
  white-space: nowrap;
}
</style>
