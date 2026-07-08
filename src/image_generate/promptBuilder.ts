/**
 * @fileoverview 把 NPC 的 race/appearance/clothing 字段拼成文生图 prompt。
 *
 * 设计目标：所有 NPC 立绘画风统一（修仙古风），半身构图（面部居上）对齐 CSS `object-position: top` 的方形头像裁切。
 * NPC 的这三个字段已由故事 AI（state_preset / init_state_preset）填为具体可视描述（如「及腰黑发以青丝带束起，鹅蛋脸」）。
 */

import type { Npc } from "../role_core/Npc";

/** 统一画风前缀：固定风格，避免每张立绘画风漂移。 */
const STYLE_PREFIX =
  "修仙题材人物立绘，中国古风工笔画与影视级光影结合，半身构图，人物居中，" +
  "单人，浅色素雅背景，无文字无水印，高细节，4k画质，画面重点表现面部与上半身。";

/**
 * 依据 NPC 的种族/外貌/服装构建文生图 prompt。
 *
 * - 修仙者：正常人形 + appearance + clothing
 * - 人形妖兽：人形体态但保留兽特征（兽耳/兽角/鳞片/毛色）+ appearance + clothing
 * - 妖兽：纯兽形 + appearance；clothing 可为空
 *
 * 字段缺失时给出温和回退，保证 prompt 始终可生成。
 */
export function buildNpcPortraitPrompt(npc: Npc): string {
  const appearance = String(npc.appearance || "").trim();
  const clothing = String(npc.clothing || "").trim();

  let subject: string;
  switch (npc.race) {
    case "妖兽": {
      const app = appearance || "通体覆有灵性光泽的毛羽，目光如炬，体型矫健";
      subject = `一只${app}的妖兽，灵兽形态，不穿戴任何人类服饰，背景为云雾山川烘托仙气`;
      break;
    }
    case "人形妖兽": {
      const app = appearance || "保留兽类特征如兽耳或鳞片，人形体态";
      const cloth = clothing || "身着古朴修仙服饰";
      subject = `一位${app}的人形妖兽，${cloth}，整体人形但头部与躯干保留兽类特征`;
      break;
    }
    case "修仙者":
    default: {
      const app = appearance || "面容清俊，气度从容";
      const cloth = clothing || "身着素色修仙长袍";
      subject = `一位${app}的修仙者，${cloth}`;
      break;
    }
  }

  return `${STYLE_PREFIX} ${subject}。`;
}
