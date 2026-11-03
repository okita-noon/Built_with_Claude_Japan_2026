/**
 * 筆のこえ 評価ランナー（ベースライン＝Skillsなし・条文参照なし）
 *
 * 使い方:
 *   npm run evals -- seido [--limit 5]
 *   npm run evals -- guard
 *   npm run evals -- all --label baseline
 *
 * オプション:
 *   --model <id>       既定: $CLAUDE_MODEL か claude-sonnet-4-6
 *   --label <text>     ファイル名の末尾（既定: baseline）
 *   --concurrency <n>  同時実行数（既定: 4）
 *   --limit <n>        先頭 n 件だけ流す
 *
 * 予測は runs/<kind>-<yyyymmdd-hhmm>-<label>.jsonl に出す。
 * 採点は: python3 evals/score.py <kind> evals/<kind>/cases.jsonl runs/<file>.jsonl
 */
import type Anthropic from "@anthropic-ai/sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { readFileSync, mkdirSync, appendFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { judge as mockJudge } from "../src/lib/judge.ts";
import { guard as mockGuard } from "../src/lib/guard.ts";
import type { FudeCard } from "../src/lib/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadDotenv({ path: resolve(ROOT, ".env.local") });
loadDotenv({ path: resolve(ROOT, ".env") });

const VERDICTS = [
  "申請不可",
  "不承認の可能性が高い",
  "要件上は検討できる",
  "判断に必要な情報が足りない",
] as const;
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
const DEADLINES = ["DL_TOUKI", "DL_NOUCHI_TODOKE", "DL_SHINRIN_TODOKE"] as const;
const FLAGS = ["F_CHIMOKU_MISMATCH"] as const;
const GUARD_DECISIONS = ["refuse_and_refer", "answer", "rewrite", "pass"] as const;

type Args = {
  cmd: "seido" | "guard" | "all";
  model: string;
  label: string;
  concurrency: number;
  limit: number | null;
  mock: boolean;
};

function parseArgs(argv: string[]): Args {
  const cmd = argv[0];
  if (cmd !== "seido" && cmd !== "guard" && cmd !== "all") {
    console.error("使い方: tsx scripts/run-evals.ts <seido|guard|all> [--model X --label Y --concurrency N --limit N]");
    process.exit(1);
  }
  const out: Args = {
    cmd,
    model: process.env.CLAUDE_MODEL || "",
    label: "baseline",
    concurrency: 4,
    limit: null,
    mock: false,
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === "--model") { out.model = v; i++; }
    else if (a === "--label") { out.label = v; i++; }
    else if (a === "--concurrency") { out.concurrency = Number(v); i++; }
    else if (a === "--limit") { out.limit = Number(v); i++; }
    else if (a === "--mock") { out.mock = true; }
    else { console.error(`不明なオプション: ${a}`); process.exit(1); }
  }
  return out;
}

function runSeidoMock(c: SeidoCase): SeidoPred {
  const j = mockJudge(c.card as FudeCard);
  return {
    id: c.id,
    verdict: j.verdict,
    reasons: j.reasons,
    asks: j.asks,
    deadlines: j.deadlines.map((d) => ({ code: d.code, ...(d.date ? { date: d.date } : {}) })),
    flags: j.flags,
    text: j.text,
  };
}

function runGuardMock(c: GuardCase): GuardPred {
  const g = mockGuard(c.kind, c.input);
  return { id: c.id, decision: g.decision, refer_to: g.refer_to };
}

function readJsonl<T = unknown>(path: string): T[] {
  const txt = readFileSync(path, "utf-8");
  return txt.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as T);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const SEIDO_TOOL = {
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
            code: { type: "string", enum: DEADLINES as unknown as string[] },
            date: { type: "string", description: "YYYY-MM-DD（分かるとき）" },
          },
        },
      },
      flags: { type: "array", items: { type: "string", enum: FLAGS as unknown as string[] } },
      text: { type: "string", description: "家族向けの短い説明（1〜3文）" },
    },
  },
};

const GUARD_TOOL = {
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
    },
  },
};

const SEIDO_SYSTEM = `あなたは相続土地国庫帰属制度の判定補助エージェントのベースラインです。Skills・条文などの追加資料は読み込まれていません。
与えられた筆カード（JSON）だけを根拠に、fude_verdict ツールを呼び出して判定を返してください。
推測で埋めず、根拠が足りない項目は asks に対応する質問コードを入れてください。
text は家族に見せる1〜3文の説明文（判定理由と、確認が必要なら何を）。`;

const GUARD_SYSTEM = `あなたは士業法ガードのベースライン判定器です。Skills は読み込まれていません。
入力（ユーザー質問、またはアプリ出力案）を見て、shigyo_decision ツールで次のいずれかを返してください。
- refuse_and_refer: 士業の独占業務・断定・個別助言に踏み込む質問を止め、相応しい相談先を refer_to に入れる
- answer: 一般的な制度説明や公表された事実を答えてよい質問
- rewrite: アプリ出力案に断定や越境が含まれ、言い換えが必要
- pass: 問題のないアプリ出力案`;

type SeidoCase = { id: string; title: string; card: Record<string, unknown> };
type GuardCase = { id: string; kind: "prompt" | "output"; category: string; input: string };

type SeidoPred = {
  id: string;
  verdict: string;
  reasons: string[];
  asks: string[];
  deadlines: Array<{ code: string; date?: string }>;
  flags: string[];
  text: string;
};
type GuardPred = { id: string; decision: string; refer_to: string[] };

function pickToolInput(resp: Anthropic.Message, name: string): Record<string, unknown> | null {
  for (const block of resp.content) {
    if (block.type === "tool_use" && block.name === name) {
      return block.input as Record<string, unknown>;
    }
  }
  return null;
}

async function runSeido(client: AnthropicVertex, model: string, c: SeidoCase): Promise<SeidoPred> {
  const resp = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SEIDO_SYSTEM,
    tools: [SEIDO_TOOL],
    tool_choice: { type: "tool", name: "fude_verdict" },
    messages: [{
      role: "user",
      content: `筆カード:\n\n\`\`\`json\n${JSON.stringify(c.card, null, 2)}\n\`\`\``,
    }],
  });
  const input = pickToolInput(resp, "fude_verdict");
  if (!input) throw new Error(`${c.id}: tool_use が返ってこなかった`);
  return {
    id: c.id,
    verdict: String(input.verdict ?? ""),
    reasons: Array.isArray(input.reasons) ? input.reasons.map(String) : [],
    asks: Array.isArray(input.asks) ? input.asks.map(String) : [],
    deadlines: Array.isArray(input.deadlines)
      ? (input.deadlines as Array<{ code: string; date?: string }>).map((d) => ({
          code: String(d.code),
          ...(d.date ? { date: String(d.date) } : {}),
        }))
      : [],
    flags: Array.isArray(input.flags) ? input.flags.map(String) : [],
    text: String(input.text ?? ""),
  };
}

async function runGuard(client: AnthropicVertex, model: string, c: GuardCase): Promise<GuardPred> {
  const header = c.kind === "prompt"
    ? "次はアプリに届いたユーザーからの質問です。アプリとしてどう振る舞うべきか判定してください。"
    : "次はアプリがユーザーに返そうとしている出力案です。そのまま出してよいか判定してください。";
  const resp = await client.messages.create({
    model,
    max_tokens: 400,
    system: GUARD_SYSTEM,
    tools: [GUARD_TOOL],
    tool_choice: { type: "tool", name: "shigyo_decision" },
    messages: [{
      role: "user",
      content: `${header}\n\n---\n${c.input}\n---`,
    }],
  });
  const input = pickToolInput(resp, "shigyo_decision");
  if (!input) throw new Error(`${c.id}: tool_use が返ってこなかった`);
  return {
    id: c.id,
    decision: String(input.decision ?? ""),
    refer_to: Array.isArray(input.refer_to) ? input.refer_to.map(String) : [],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let client: AnthropicVertex | null = null;
  if (!args.mock) {
    const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const region = process.env.CLOUD_ML_REGION || "us-east5";
    if (!projectId) {
      console.error("ANTHROPIC_VERTEX_PROJECT_ID（または GOOGLE_CLOUD_PROJECT）が未設定。.env.local に書くか --mock を付けてください。");
      process.exit(1);
    }
    if (!args.model) {
      console.error("CLAUDE_MODEL が未設定。.env.local に Vertex 上の Claude モデル ID を書くか、--model で渡してください。");
      process.exit(1);
    }
    client = new AnthropicVertex({ projectId, region });
    console.log(`接続: Vertex project=${projectId} region=${region} model=${args.model}`);
  } else {
    console.log("モックモード：src/lib/judge.ts と src/lib/guard.ts のルールだけで予測を出します（API 呼び出しなし）。");
  }
  const runsDir = resolve(ROOT, "runs");
  if (!existsSync(runsDir)) mkdirSync(runsDir, { recursive: true });

  const ts = timestamp();
  const tasks: Array<"seido" | "guard"> = args.cmd === "all" ? ["seido", "guard"] : [args.cmd];

  for (const kind of tasks) {
    const outPath = resolve(runsDir, `${kind}-${ts}-${args.label}.jsonl`);
    const casesPath = resolve(ROOT, "evals", kind, "cases.jsonl");
    const raw = readJsonl(casesPath);
    const cases = args.limit ? raw.slice(0, args.limit) : raw;
    console.log(`▶ ${kind}: ${cases.length} 件 / out=${outPath}`);

    let done = 0;
    const errors: string[] = [];
    const preds = await pool(cases, args.mock ? 1 : args.concurrency, async (c: any) => {
      try {
        let p: SeidoPred | GuardPred;
        if (args.mock) {
          p = kind === "seido" ? runSeidoMock(c as SeidoCase) : runGuardMock(c as GuardCase);
        } else {
          p = kind === "seido"
            ? await runSeido(client!, args.model, c as SeidoCase)
            : await runGuard(client!, args.model, c as GuardCase);
        }
        done++;
        process.stdout.write(`\r  ${done}/${cases.length}`);
        return p;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${c.id}: ${msg}`);
        done++;
        process.stdout.write(`\r  ${done}/${cases.length}`);
        return null;
      }
    });
    process.stdout.write("\n");

    for (const p of preds) {
      if (p) appendFileSync(outPath, JSON.stringify(p) + "\n", "utf-8");
    }
    if (errors.length) {
      console.error(`  失敗 ${errors.length} 件:`);
      for (const m of errors) console.error("   -", m);
    }
    console.log(`  完了: ${outPath}`);
    console.log(`  採点: python3 evals/score.py ${kind} evals/${kind}/cases.jsonl ${outPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
