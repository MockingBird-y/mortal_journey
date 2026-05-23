import { STORY_SYSTEM_PRESET } from "./story_preset";
import { completeChatWithMessagesJson, type JsonChatRequestPayload, type ChatMessage } from "./openAiChatBridge";
import { Protagonist } from "../role_core/Protagonist";
import type { ProtagonistPlayInfo, NarrationPerson } from "../role_core/types/playInfo";

export interface StoryChatEntry {
  role: "user" | "assistant";
  content: string;
}

export interface StoryGenerateInput {
  apiUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
  protagonist: ProtagonistPlayInfo;
  chatHistory: StoryChatEntry[];
}

export interface StoryParsed {
  storyBody: string;
}

const DEFAULT_TEMPERATURE = 0.55;
const DEFAULT_MAX_TOKENS = 8192;

const MJ_STORY_BODY_OPEN = "<mj_story_body>";
const MJ_STORY_BODY_CLOSE = "</mj_story_body>";

export function extractStoryBody(raw: string): string {
  const s = raw == null ? "" : String(raw);
  const i = s.indexOf(MJ_STORY_BODY_OPEN);
  if (i < 0) return s.trim();
  const from = i + MJ_STORY_BODY_OPEN.length;
  const j = s.indexOf(MJ_STORY_BODY_CLOSE, from);
  if (j < 0) return s.slice(from).trim();
  return s.slice(from, j).trim();
}

function narrationPersonLine(person: NarrationPerson): string {
  switch (person) {
    case "first":
      return "叙事人称：第一人称——以主角口吻，用「我」「我们」等叙述。";
    case "third":
      return "叙事人称：第三人称——以旁观视角写主角，用「他/她」或其姓名指代主角。";
    case "second":
    default:
      return "叙事人称：第二人称——面向玩家，将主角作为「你」「您」书写。";
  }
}

function buildStoryUserContent(p: ProtagonistPlayInfo): string {
  return [
    "【主角摘要 · 请据此与历史剧情继续生成后续剧情】",
    "",
    `姓名：${p.displayName}`,
    `性别：${p.gender || "—"}`,
    narrationPersonLine(p.narrationPerson),
    `境界：${Protagonist.formatRealm(p.realm)}`,
    `灵根：${Protagonist.formatLinggenElements(p.linggen)}`,
    `当前血量：${p.currentHp}/${p.maxHp}`,
    `当前法力：${p.currentMp}/${p.maxMp}`,
    "",
  ].join("\n");
}

export function buildStoryRequestPayload(input: StoryGenerateInput): JsonChatRequestPayload {
  const messages: ChatMessage[] = [];

  messages.push({ role: "system", content: STORY_SYSTEM_PRESET });

  messages.push({
    role: "user",
    content: buildStoryUserContent(input.protagonist),
  });

  for (const entry of input.chatHistory) {
    messages.push({ role: entry.role, content: entry.content });
  }

  return {
    apiUrl: input.apiUrl,
    apiKey: input.apiKey,
    model: input.model,
    messages,
    temperature: input.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: input.max_tokens ?? DEFAULT_MAX_TOKENS,
    requestTimeoutMs: input.requestTimeoutMs,
    signal: input.signal,
  };
}

export async function generateStory(input: StoryGenerateInput): Promise<StoryParsed> {
  const raw = await completeChatWithMessagesJson(buildStoryRequestPayload(input));
  return { storyBody: extractStoryBody(raw) };
}
