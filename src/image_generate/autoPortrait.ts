/**
 * @fileoverview 新 NPC 自动生成立绘编排（受 useImageApiConfig 的 autoGenerate 开关控制）。
 *
 * 由 npcStore.applyNpcUpdates 的调用方在拿到「新建 NPC 列表」后调用：fire-and-forget，
 * 串行生成（模块级 Promise 链，避免并发触发 Ark 限流），成功即回写 avatarUrl 并落盘，
 * 失败仅 gameLog.warn，绝不阻塞剧情 / 状态管线。
 */

import { gameLog } from "../log/gameLog";
import { npcStore } from "../role_core/npcStore";
import { writeActiveSave } from "../save/gameSave";
import { generateNpcPortrait } from "./imageGenerate";
import { isAutoGenerateEnabled, isImageApiConfigured } from "./useImageApiConfig";
import type { Npc } from "../role_core/Npc";

/** 串行执行队列，保证任意时刻只有一张立绘在生成。 */
let _queue: Promise<void> = Promise.resolve();

/**
 * 为「本次新建的 NPC」按需自动生成立绘。
 *
 * 守卫：未配置文生图 / 未开启自动生成 / 列表为空 → 直接返回。
 * 仅处理尚无 avatarUrl 的新 NPC；逐个串行生成，成功后 setAvatarUrl + setNpc + writeActiveSave。
 *
 * @param created 本次 applyNpcUpdates 中新建的 NPC 列表。
 */
export function autoGeneratePortraits(created: Npc[]): void {
  if (!created || created.length === 0) return;
  if (!isImageApiConfigured() || !isAutoGenerateEnabled()) return;
  const targets = created.filter((n) => !n.avatarUrl);
  if (targets.length === 0) return;

  _queue = _queue
    .then(() => runPortraitBatch(targets))
    .catch((err) => {
      gameLog.warn("[图 自动] 批次异常：" + (err instanceof Error ? err.message : String(err)));
    });
}

async function runPortraitBatch(list: Npc[]): Promise<void> {
  for (const npc of list) {
    try {
      const dataUrl = await generateNpcPortrait(npc);
      npc.addPortraitCandidate(dataUrl);
      npcStore.setNpc(npc);
      writeActiveSave();
      gameLog.info(`[图 自动] 已为「${npc.displayName}」生成立绘`);
    } catch (err) {
      gameLog.warn(
        `[图 自动]「${npc.displayName}」立绘生成失败：` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }
}
