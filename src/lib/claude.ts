import Anthropic from "@anthropic-ai/sdk";
import type { FudeCard, JudgeResult, NextQuestion, GuardResult, Verdict } from "./types";
import { SKILL_SEIDO_CHECK, SKILL_SHIGYO_GUARD, SKILL_FUDE_CARD } from "./skills.generated";
import { ALL_QUESTIONS } from "./next-question";

const VERDICTS: readonly Verdict[] = [
  "申請不可",
  "不承認の可能性が高い",
  "要件上は検討できる",
  "判断に必要な情報が足りない",
];
const REASONS = [
  "R_BUILDING", "R_SECURITY_USE", "R_OTHERS_USE", "R_SOIL", "R_BOUNDARY_DISPUTE",
  "D_CLIFF", "D_SURFACE_OBJECT", "D_UNDERGROUND_OBJECT", "D_NEIGHBOR_LITIGATION",
  "D_DISASTER", "D_ANIMAL", "D_FOREST", "D_MONETARY_DEBT",
  "E_NOT_INHERITED", "E_COOWNERS_ALL",
] as const;
const ASKS = [
  "Q_BOUNDARY", "Q_BUILDING", "Q_USE_BY_OTHERS", "Q_SECURITY", "Q_FOREST_CARE",
  "Q_CLIFF", "Q_UNDERGROUND", "Q_HEIRS", "Q_ACQUISITION", "Q_DEBT",
] as const;
const DEADLINE_CODES = ["DL_TOUKI", "DL_NOUCHI_TODOKE", "DL_SHINRIN_TODOKE"] as const;
const FLAG_CODES = ["F_CHIMOKU_MISMATCH"] as const;
const GUARD_DECISIONS = ["refuse_and_refer", "answer", "rewrite", "pass"] as const;

export const SEIDO_TOOL = {
  name: "fude_verdict",
  description: "筆カードに対する国庫帰属の判定を返す。推測で埋めず、情報が足りなければ asks に質問コードを入れる。",
  input_schema: {
    type: "object" as const,
    required: ["verdict", "reasons", "asks", "deadlines", "flags", "text"],
    properties: {
      verdict: { type: "string", enum: VERDICTS as unknown as string[] },
      reasons: { type: "array", items: { type: "string", enum: REASONS as unknown as string[] } },
      asks: { type: "array", items: { type: "string", enum: ASKS as unknown as string[] } },
      deadlines: {
        type: "array",
        items: {
          type: "object",
          required: ["code"],
          properties: {
            code: { type: "string", enum: DEADLINE_CODES as unknown as string[] },
            date: { type: "string", description: "YYYY-MM-DD（分かるとき）" },
          },
        },
      },
      flags: { type: "array", items: { type: "string", enum: FLAG_CODES as unknown as string[] } },
      text: { type: "string", description: "家族向けの短い説明（1〜3文）" },
    },
  },
};

export const GUARD_TOOL = {
  name: "shigyo_decision",
  description: "ユーザー質問またはアプリ出力に対する士業法ガードの決定を返す。",
  input_schema: {
    type: "object" as const,
    required: ["decision"],
    properties: {
      decision: { type: "string", enum: GUARD_DECISIONS as unknown as string[] },
      refer_to: {
        type: "array",
        items: { type: "string" },
        description: "refuse_and_refer のときの相談先（土地家屋調査士 など）",
      },
      rewritten: {
        type: "string",
        description: "decision が rewrite のときの言い換え文。",
      },
      reason_tag: { type: "string" },
    },
  },
};

export const NEXT_Q_TOOL = {
  name: "pick_next_question",
  description: "親に次に聞く二択の質問コードを1つ選ぶ。既に埋まっている項目や、争いが分かっている項目は聞かない。",
  input_schema: {
    type: "object" as const,
    required: ["ask_code"],
    properties: {
      ask_code: {
        type: "string",
        enum: ASKS as unknown as string[],
        description: "Q_BOUNDARY / Q_BUILDING などから1つ",
      },
      why: { type: "string", description: "なぜこの質問を選んだか（短く）" },
    },
  },
};

export const SEIDO_SYSTEM = `あなたは「筆のこえ」の判定エージェントです。
次の Skill を必ず守って、fude_verdict ツールを呼び出して判定してください。
推測で埋めず、根拠が足りない項目は asks に対応する質問コードを入れてください。
text は家族に見せる 1〜3 文の説明（判定理由と、確認が必要なら何を）。

<skill name="seido-check">
${SKILL_SEIDO_CHECK}
</skill>

<skill name="fude-card">
${SKILL_FUDE_CARD}
</skill>`;

export const GUARD_SYSTEM = `あなたは「筆のこえ」の士業法ガードです。
次の Skill を必ず守って、shigyo_decision ツールを呼び出して判定してください。
- refuse_and_refer: 士業の独占業務・断定・個別助言に踏み込む入力を止め、refer_to に相応しい相談先を入れる
- answer: 一般的な制度説明や公表された事実への質問として答えてよい
- rewrite: アプリ出力案に断定や越境が含まれ、言い換えが必要。rewritten に書き換え文を入れる
- pass: 問題のないアプリ出力案

<skill name="shigyo-guard">
${SKILL_SHIGYO_GUARD}
</skill>`;

export const NEXT_Q_SYSTEM = `あなたは「筆のこえ」の聞き直しエージェントです。
筆カードと最新の判定を見て、親に次に聞く二択の質問コードを 1 つだけ選んでください。
`
  + `すでに埋まっている項目や、争いが明らかな項目は選ばないでください。
`
  + `必ず pick_next_question ツールを呼び出してください。

<skill name="fude-card">
${SKILL_FUDE_CARD}
</skill>

<skill name="seido-check">
${SKILL_SEIDO_CHECK}
</skill>`;

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && Boolean(process.env.CLAUDE_MODEL);
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  return new Anthropic({ apiKey });
}

function getModel(): string {
  return process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
}

function pickToolInput(resp: Anthropic.Message, name: string): Record<string, unknown> | null {
  for (const block of resp.content) {
    if (block.type === "tool_use" && block.name === name) {
      return block.input as Record<string, unknown>;
    }
  }
  return null;
}

export async function judgeWithClaude(card: FudeCard): Promise<JudgeResult> {
  const client = getClient();
  const resp = await client.messages.create({
    model: getModel(),
    max_tokens: 8000, // 思考（adaptive）ぶんの余裕
    system: `${SEIDO_SYSTEM}\n\n回答は必ず fude_verdict ツールを1回呼んで返す。ツール以外の文章は書かない。`,
    tools: [SEIDO_TOOL],
    // Sonnet 5.5 以降は tool_choice の強制（tool/any）が 400 になるため auto＋指示で呼ばせる
    tool_choice: { type: "auto" },
    messages: [{
      role: "user",
      content: `筆カード:\n\n\`\`\`json\n${JSON.stringify(card, null, 2)}\n\`\`\``,
    }],
  });
  const input = pickToolInput(resp, "fude_verdict");
  if (!input) throw new Error("fude_verdict tool_use が返ってこなかった");

  const verdict = String(input.verdict ?? "") as Verdict;
  if (!VERDICTS.includes(verdict)) throw new Error(`不正な verdict: ${verdict}`);
  return {
    verdict,
    reasons: Array.isArray(input.reasons) ? input.reasons.map(String) : [],
    asks: Array.isArray(input.asks) ? input.asks.map(String) : [],
    deadlines: Array.isArray(input.deadlines)
      ? (input.deadlines as Array<{ code: string; date?: string }>).map((d) => ({
          code: d.code as JudgeResult["deadlines"][number]["code"],
          ...(d.date ? { date: String(d.date) } : {}),
        }))
      : [],
    flags: Array.isArray(input.flags) ? input.flags.map(String) : [],
    text: String(input.text ?? ""),
  };
}

export async function guardWithClaude(kind: "prompt" | "output", input: string): Promise<GuardResult> {
  const client = getClient();
  const header = kind === "prompt"
    ? "次はアプリに届いたユーザーからの質問です。アプリとしてどう振る舞うべきか判定してください。"
    : "次はアプリがユーザーに返そうとしている出力案です。そのまま出してよいか判定してください。";
  const resp = await client.messages.create({
    model: getModel(),
    max_tokens: 8000, // 思考（adaptive）ぶんの余裕
    system: `${GUARD_SYSTEM}\n\n回答は必ず shigyo_decision ツールを1回呼んで返す。ツール以外の文章は書かない。`,
    tools: [GUARD_TOOL],
    // Sonnet 5.5 以降は tool_choice の強制（tool/any）が 400 になるため auto＋指示で呼ばせる
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: `${header}\n\n---\n${input}\n---` }],
  });
  const data = pickToolInput(resp, "shigyo_decision");
  if (!data) throw new Error("shigyo_decision tool_use が返ってこなかった");
  const decision = String(data.decision ?? "") as GuardResult["decision"];
  if (!GUARD_DECISIONS.includes(decision as (typeof GUARD_DECISIONS)[number])) {
    throw new Error(`不正な decision: ${decision}`);
  }
  return {
    decision,
    refer_to: Array.isArray(data.refer_to) ? data.refer_to.map(String) : [],
    rewritten: typeof data.rewritten === "string" ? data.rewritten : undefined,
    reason_tag: typeof data.reason_tag === "string" ? data.reason_tag : undefined,
  };
}

export async function nextQuestionWithClaude(card: FudeCard, j: JudgeResult): Promise<NextQuestion | null> {
  // 判定が「要件上は検討できる」で asks が空なら質問不要
  if (!j.asks.length && j.verdict === "要件上は検討できる") return null;

  const client = getClient();
  const resp = await client.messages.create({
    model: getModel(),
    max_tokens: 8000, // 思考（adaptive）ぶんの余裕
    system: `${NEXT_Q_SYSTEM}\n\n回答は必ず pick_next_question ツールを1回呼んで返す。ツール以外の文章は書かない。`,
    tools: [NEXT_Q_TOOL],
    // Sonnet 5.5 以降は tool_choice の強制（tool/any）が 400 になるため auto＋指示で呼ばせる
    tool_choice: { type: "auto" },
    messages: [{
      role: "user",
      content: `筆カード:\n\`\`\`json\n${JSON.stringify(card, null, 2)}\n\`\`\`\n\n直近の判定:\n\`\`\`json\n${JSON.stringify(j, null, 2)}\n\`\`\``,
    }],
  });
  const data = pickToolInput(resp, "pick_next_question");
  if (!data) return null;
  const code = String(data.ask_code ?? "");
  const q = ALL_QUESTIONS[code];
  if (!q) return null;
  return { ...q, for_fude_id: card.id };
}
