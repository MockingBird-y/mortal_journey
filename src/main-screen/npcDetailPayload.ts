import { Character } from "../role_core/Character";
import { Npc } from "../role_core/Npc";

export interface NpcDetailSection {
  label: string;
  text: string;
}

export interface NpcDetailPayload {
  title: string;
  subtitle: string;
  sections: NpcDetailSection[];
  dataRarity?: string;
  gridSections?: boolean;
}

function favorabilityLabel(f: number): string {
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

function pushSec(out: NpcDetailSection[], label: string, text: string | number | undefined | null): void {
  if (text == null) return;
  const t = typeof text === "string" ? text.trim() : String(text);
  if (t === "") return;
  out.push({ label, text: t });
}

function formatSlotList(
  slots: readonly (import("../role_core/types/itemInfo").TreasureItemDefinition | import("../role_core/types/itemInfo").GongfaItemDefinition | null)[],
): string {
  const items = slots.filter((s): s is NonNullable<typeof s> => s != null);
  if (items.length === 0) return "无";
  return items.map((it) => {
    const grade = (it as { grade?: string }).grade;
    return grade ? `${it.name}（${grade}）` : it.name;
  }).join("、");
}

function formatInventoryList(
  slots: readonly (import("../role_core/types/itemInfo").InventoryStackItem | null)[],
): string {
  const items = slots.filter((s): s is NonNullable<typeof s> => s != null);
  if (items.length === 0) return "无";
  return items.map((it) => {
    const name = (it as { name?: string }).name ?? "未知物品";
    const count = (it as { count?: number }).count;
    return count != null && count > 1 ? `${name}×${count}` : name;
  }).join("、");
}

const NPC_REALM_RARITY: Readonly<Record<string, string>> = {
  "化神": "传说",
  "元婴": "史诗",
  "结丹": "稀有",
  "筑基": "精良",
};

export function buildNpcDetailPayload(npc: Npc): NpcDetailPayload {
  const gridSections: NpcDetailSection[] = [];
  pushSec(gridSections, "性别", npc.gender);
  pushSec(gridSections, "灵根", Character.formatLinggenElements(npc.linggen));
  pushSec(gridSections, "年龄", String(npc.age));
  pushSec(gridSections, "寿元", String(npc.shouyuan));
  pushSec(gridSections, "修为", String(npc.xiuwei));
  pushSec(gridSections, "好感度", `${npc.favorability}（${favorabilityLabel(npc.favorability)}）`);
  pushSec(gridSections, "性格", npc.personality);
  pushSec(gridSections, "短期目标", npc.currentStageGoal);
  pushSec(gridSections, "长期目标", npc.longTermGoal);
  pushSec(gridSections, "爱好", npc.hobby);
  pushSec(gridSections, "恐惧", npc.fear);
  pushSec(gridSections, "血量", `${npc.currentHp}/${npc.maxHp}`);
  pushSec(gridSections, "法力", `${npc.currentMp}/${npc.maxMp}`);

  const fullSections: NpcDetailSection[] = [...gridSections];
  fullSections.push({ label: "法宝", text: formatSlotList(npc.equippedSlots) });
  fullSections.push({ label: "功法", text: formatSlotList(npc.gongfaSlots) });
  fullSections.push({ label: "储物袋", text: formatInventoryList(npc.inventorySlots) });

  const dataRarity = NPC_REALM_RARITY[npc.realm.major] || undefined;

  return {
    title: npc.displayName,
    subtitle: `${npc.identity} · ${Character.formatRealm(npc.realm)} · ${npc.powerTier}`,
    sections: fullSections,
    dataRarity,
    gridSections: true,
  };
}

export function buildNpcListEntryPayload(npc: Npc): {
  title: string;
  subtitle: string;
  hpPct: number;
  mpPct: number;
  isDead: boolean;
  favorability: number;
  favorLabel: string;
} {
  return {
    title: npc.displayName,
    subtitle: `${npc.identity} · ${Character.formatRealm(npc.realm)}`,
    hpPct: npc.maxHp > 0 ? Math.round((npc.currentHp / npc.maxHp) * 100) : 0,
    mpPct: npc.maxMp > 0 ? Math.round((npc.currentMp / npc.maxMp) * 100) : 0,
    isDead: npc.isDead,
    favorability: npc.favorability,
    favorLabel: favorabilityLabel(npc.favorability),
  };
}
