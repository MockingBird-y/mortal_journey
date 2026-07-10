/**
 * @fileoverview 把 NPC 的字段拼成文生图 prompt。
 *
 * 设计目标：所有 NPC 立绘画风统一（3D 建模、虚幻引擎渲染、电影级质感）。修仙者与人形妖兽为
 * 半身立绘（自腰部以上），妖兽保留灵兽全身形态。在 race/appearance/clothing 基础上注入身份 /
 * 境界（含灵气）/ 外貌年龄等角色信息，使立绘更贴合角色；背景由模型依据角色气质自行适配相称的
 * 仙侠场景。外貌年龄按「年龄 / 寿元」比例判定——修者寿元绵长则同比例下显年轻，凡人近寿元上限则显老。
 * NPC 的 appearance/clothing 已由故事 AI 填为具体可视描述（如「及腰黑发以青丝带束起，鹅蛋脸」）。
 */

import { Character } from "../role_core/Character";
import type { Npc } from "../role_core/Npc";

/** 统一画风前缀：3D 建模 / 虚幻引擎渲染 / 电影级质感，背景由模型自行适配，避免每张立绘画风漂移。 */
const STYLE_PREFIX =
  "修仙题材角色立绘，写实厚涂风，虚幻引擎5渲染，电影级三点布光，8k超高清，PBR材质，次表面散射皮肤质感，" +
  "单人，人物居中，角色呈现非站桩式的自然动态姿态，肢体语言需与其身份、境界、当前状态相匹配（如战斗姿态、施法手势、御风而行、抚琴饮酒、负手远眺等），" +
  "衣袍与飘带受动作或风力影响产生自然飘动，拒绝僵硬直立或证件照式呆板站姿，" +
  "背景为与角色身份和当前状态匹配的仙侠场景（例如：云雾缭绕的洞府、灵气氤氲的仙山、古符文流转的秘境），丁达尔效应体积光，氛围空灵，" +
  "全身景深镜头，电影级浅景深（f/2.8），黄金分割构图，视角为平视微仰，" +
  "无文字，无水印，无UI，画面纯净。";

/** 境界 major → 视觉灵气描述（境界越高越超凡）。 */
const REALM_AURA: Record<string, string> = {
  "练气": "凡尘气息，气质质朴",
  "筑基": "气息内敛，神采清朗",
  "结丹": "周身隐现金丹灵光，气度沉稳",
  "元婴": "元婴威压隐隐外溢，气度超凡，灵气环绕",
  "化神": "化神气息如渊似海，超然物外，周身仙气氤氲",
};

/** 境界 major → 视觉灵气描述；未知境界返回空。 */
function realmAuraDescriptor(npc: Npc): string {
  return REALM_AURA[npc.realm?.major ?? ""] ?? "";
}

/**
 * 按「年龄 / 寿元」比例推算外貌年龄档位。
 *
 * 修者寿元绵长（化神可达数千岁），同比例下外貌远比凡人年轻；凡人接近寿元上限则显老。
 * age 或 shouyuan 非正时返回空串（不臆造）。
 */
function apparentAgeDescriptor(npc: Npc): string {
  const age = typeof npc.age === "number" ? npc.age : -1;
  const sy = typeof npc.shouyuan === "number" ? npc.shouyuan : 0;
  if (age <= 0 || sy <= 0) return "";
  const ratio = age / sy;
  if (ratio < 0.15) return "外貌年轻，宛如少年";
  if (ratio < 0.35) return "外貌为青年";
  if (ratio < 0.6) return "外貌为盛年";
  if (ratio < 0.8) return "外貌为沉稳中年";
  if (ratio < 0.92) return "外貌略显老态";
  return "外貌苍老，暮气沉沉";
}

/** 拼装角色信息片段（身份 / 境界 / 灵气 / 外貌年龄），逗号连接；全空返回空串。 */
function buildCharInfo(npc: Npc): string {
  const parts: string[] = [];
  const identity = String(npc.identity || "").trim();
  if (identity) parts.push(`身份为${identity}`);
  const realmZh = Character.formatRealm(npc.realm);
  if (realmZh && realmZh !== "—") parts.push(`境界${realmZh}`);
  const aura = realmAuraDescriptor(npc);
  if (aura) parts.push(aura);
  const ageDesc = apparentAgeDescriptor(npc);
  if (ageDesc) parts.push(ageDesc);
  return parts.join("，");
}

/**
 * 依据 NPC 的种族/外貌/服装 + 角色信息构建文生图 prompt。
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
  const charInfo = buildCharInfo(npc);
  const infoSeg = charInfo ? `${charInfo}，` : "";

  let subject: string;
  switch (npc.race) {
    case "妖兽": {
      const app = appearance || "通体覆有灵性光泽的毛羽，目光如炬，体型矫健";
      subject = `一只${app}的妖兽，${infoSeg}灵兽形态，全身构图，不穿戴任何人类服饰`;
      break;
    }
    case "人形妖兽": {
      const app = appearance || "保留兽类特征如兽耳或鳞片，人形体态";
      const cloth = clothing || "身着古朴修仙服饰";
      subject = `一位${app}的人形妖兽，${infoSeg}${cloth}，整体人形但头部与躯干保留兽类特征，半身立绘构图，自腰部以上，面部表情与上半身服饰细节清晰`;
      break;
    }
    case "修仙者":
    default: {
      const app = appearance || "面容清俊，气度从容";
      const cloth = clothing || "身着素色修仙长袍";
      subject = `一位${app}的修仙者，${infoSeg}${cloth}，半身立绘构图，自腰部以上，面部表情与上半身服饰细节清晰`;
      break;
    }
  }

  return `${STYLE_PREFIX} ${subject}。`;
}
