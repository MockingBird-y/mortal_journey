import { ref, type Ref } from "vue";
import { Npc } from "./Npc";
import type { NpcPlayInfo } from "./types/playInfo";
import type { NpcNearbyEntry } from "../ai/state_generate";

const npcMap: Ref<Map<string, Npc>> = ref(new Map());

export function useNpcStore() {
  function applyNpcUpdates(
    entries: NpcNearbyEntry[],
    protagonistLinggen?: string[],
  ): void {
    for (const entry of entries) {
      const name = entry.displayName?.trim();
      if (!name) continue;

      const existing = npcMap.value.get(name);
      if (existing) {
        existing.mergeFromAi(entry, protagonistLinggen);
      } else {
        const npc = Npc.fromAiData(entry, protagonistLinggen);
        npcMap.value.set(name, npc);
      }
    }
  }

  function getNpc(displayName: string): Npc | undefined {
    return npcMap.value.get(displayName);
  }

  function allNpcs(): Npc[] {
    return Array.from(npcMap.value.values());
  }

  function serializeNpcs(): NpcPlayInfo[] {
    const result: NpcPlayInfo[] = [];
    for (const npc of npcMap.value.values()) {
      result.push(npc.toData());
    }
    return result;
  }

  function restoreNpcs(data: NpcPlayInfo[]): void {
    npcMap.value.clear();
    for (const d of data) {
      const npc = Npc.fromData(d);
      npcMap.value.set(npc.displayName, npc);
    }
  }

  function clearNpcs(): void {
    npcMap.value.clear();
  }

  return {
    npcs: npcMap,
    applyNpcUpdates,
    getNpc,
    allNpcs,
    serializeNpcs,
    restoreNpcs,
    clearNpcs,
  };
}

export const npcStore = useNpcStore();
