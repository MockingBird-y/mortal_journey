/**
 * 命运抉择确认后：同步写入主角、请求开局剧情 AI、维护剧情正文与阶段状态。
 */

import { ref, watch, type ComputedRef, type Ref } from "vue";
import { generateInitStory } from "./init_story_generate";
import { generateInitState } from "./init_state_generate";
import { gameLog } from "../log/gameLog";
import {
  cloneWorldTime,
  createDefaultWorldTime,
  type WorldTime,
} from "../role_core/worldTime";
import { Protagonist, protagonist } from "../role_core/Protagonist";
import { npcStore } from "../role_core/npcStore";
import { worldMapStore } from "../role_core/worldMapStore";
import type { FateChoiceResult } from "../fate_choice/types";
import type { WorldLocation } from "../role_core/types/worldLocation";
import { isEmptyWorldLocation } from "../role_core/types/worldLocation";

export type OpeningStoryPhase = "idle" | "loading" | "ready" | "error";

/** 与启动页 API 表单对应的网关参数（空串表示未填）。 */
export interface OpeningStoryApiSlice {
  apiUrl: string;
  apiKey: string;
  apiModel: string;
}

/**
 * 监听 `fateChoice`：非空时 `Protagonist.loadFromFateChoice` 并拉取开局剧情；空时清空主角与剧情 UI。
 *
 * @param fateChoice - 通常 `toRef(props, "fateChoice")`
 * @param api - 通常 `computed(() => ({ apiUrl, apiKey, apiModel }))`，在发起请求时读取最新值
 */
export function useOpeningStoryFromFateChoice(
  fateChoice: Ref<FateChoiceResult | null | undefined>,
  api: Ref<OpeningStoryApiSlice> | ComputedRef<OpeningStoryApiSlice>,
): {
  storyBody: Ref<string>;
  phase: Ref<OpeningStoryPhase>;
  errorMessage: Ref<string>;
  worldTime: Ref<WorldTime>;
  worldTimeBaseline: Ref<WorldTime>;
  worldLocation: Ref<WorldLocation | null>;
  initSnapshot: Ref<string>;
} {
  const storyBody = ref("");
  const phase = ref<OpeningStoryPhase>("idle");
  const errorMessage = ref("");
  const worldTime = ref<WorldTime>(createDefaultWorldTime());
  const worldTimeBaseline = ref<WorldTime>(cloneWorldTime(worldTime.value));
  const worldLocation = ref<WorldLocation | null>(null);
  const initSnapshot = ref("");

  let abortCtl: AbortController | null = null;

  function resetWorldClock(): void {
    const w = createDefaultWorldTime();
    worldTime.value = w;
    worldTimeBaseline.value = cloneWorldTime(w);
    worldLocation.value = null;
    initSnapshot.value = "";
  }

  function resetStoryOnly(): void {
    storyBody.value = "";
    errorMessage.value = "";
    phase.value = "idle";
    resetWorldClock();
  }

  watch(
    fateChoice,
    async (fc) => {
      abortCtl?.abort();
      abortCtl = null;

      if (!fc) {
        Protagonist.clear();
        resetStoryOnly();
        return;
      }

      Protagonist.loadFromFateChoice(fc);
      storyBody.value = "";
      errorMessage.value = "";
      resetWorldClock();

      const { apiUrl, apiKey, apiModel } = api.value;
      const url = String(apiUrl || "").trim();
      const model = String(apiModel || "").trim();
      if (!url || !model) {
        phase.value = "error";
        errorMessage.value = "未配置 API URL 或模型，无法生成开局剧情。";
        gameLog.warn("[OpeningStory] " + errorMessage.value);
        return;
      }

      const p = protagonist.value;
      if (!p) {
        phase.value = "error";
        errorMessage.value = "主角数据未就绪。";
        return;
      }

      const ac = new AbortController();
      abortCtl = ac;
      phase.value = "loading";

      try {
        const storyResult = await generateInitStory({
          apiUrl: url,
          apiKey: String(apiKey || "").trim() || undefined,
          model,
          protagonist: p,
          signal: ac.signal,
        });
        if (abortCtl !== ac) return;

        if (!storyResult.storyBody.trim()) {
          phase.value = "error";
          errorMessage.value = "模型返回的开局正文为空。";
          return;
        }

        storyBody.value = storyResult.storyBody;

        try {
          const stateResult = await generateInitState({
            apiUrl: url,
            apiKey: String(apiKey || "").trim() || undefined,
            model,
            storyBody: storyResult.storyBody,
            protagonist: p,
            signal: ac.signal,
          });
          if (abortCtl !== ac) return;

          if (stateResult.worldLocation && !isEmptyWorldLocation(stateResult.worldLocation)) {
            worldLocation.value = stateResult.worldLocation;
          }

          if (stateResult.storySnapshot.trim()) {
            initSnapshot.value = stateResult.storySnapshot.trim();
          }

          const current = protagonist.value;
          if (current) {
            current.applyInitState(stateResult);
          }
          if (stateResult.nearbyNpcs.length > 0) {
            npcStore.applyNpcUpdates(stateResult.nearbyNpcs, p.linggen);
          }

          if (stateResult.worldLocation && !isEmptyWorldLocation(stateResult.worldLocation)) {
            worldMapStore.addLocation(
              stateResult.worldLocation,
              stateResult.nearbyNpcs.map(n => n.displayName),
            );
          }
        } catch (stateErr) {
          gameLog.error("[OpeningStory] 状态生成失败：" + (stateErr instanceof Error ? stateErr.message : String(stateErr)));
        }

        // 无论开局状态生成成功与否，统一结算天赋效果（物品/灵石/属性）：
        // 成功时叠加在 applyInitState 之上；失败时也保住天赋物品与属性加成。
        const traitsOwner = protagonist.value;
        if (traitsOwner) {
          traitsOwner.applyTraitEffects();
        }

        phase.value = "ready";
      } catch (e) {
        if (ac.signal.aborted) return;
        phase.value = "error";
        errorMessage.value = e instanceof Error ? e.message : String(e);
        gameLog.error("[OpeningStory] " + errorMessage.value);
      } finally {
        if (abortCtl === ac) abortCtl = null;
      }
    },
    { immediate: true },
  );

  return { storyBody, phase, errorMessage, worldTime, worldTimeBaseline, worldLocation, initSnapshot };
}
