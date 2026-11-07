/**
 * アプリの効き目：アプリなし（子が自分で聞く）vs アプリあり（聞き直し機能が聞く）
 *
 *   npx tsx scripts/effect-eval.ts [--turns 5] [--limit N] [--concurrency 6]
 *
 * 1件ごとに、評価セット（evals/seido/cases.jsonl）の筆カードを「親だけが知っている事実」にする。
 * - 親役（Claude）：その事実だけを持ち、聞かれたことにだけ方言で短く答える。知らないことは「分からん」。
 * - アプリなし：制度に詳しくない子役（Claude）が、課税明細書の情報だけを見て自由に質問する。
 * - アプリあり：本番と同じ judgeWithClaude → nextQuestionWithClaude（Skills 入り）が次の質問を選ぶ。
 * 必須10項目に、申請資格に関わる「取得の経緯」を加えた11項目で比べる。
 * 同じ回数だけ聞いたあと、両方の会話記録を同じ抽出器でカードに起こし、
 *   (1) 親が知っている必須項目のうち、正しく埋まった数
 *   (2) そのカードで判定したときに、正解の判定と一致したか
 * を比べる。親役・子役・採点も Claude なので、実際の家族での効果ではなく「聞き方の差」の目安。
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: resolve(ROOT, ".env.local") });
const { judgeWithClaude, nextQuestionWithClaude } = await import("../src/lib/claude.ts");
type FudeCard = import("../src/lib/types.ts").FudeCard;

const arg = (k: string, d: number) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const TURNS = arg("--turns", 8);
const LIMIT = arg("--limit", 0);
const CONC = arg("--concurrency", 6);
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FIELDS: Array<[keyof FudeCard, string]> = [
  ["building", "建物（屋根と壁のある小屋など）"],
  ["boundary", "境界（隣と確認したか・争いはないか）"],
  ["others_use", "他人の使用（耕作・通路など）"],
  ["rights", "担保・貸し借り（抵当権など）"],
  ["cliff", "急な崖"],
  ["underground", "地下に埋めた物"],
  ["forest_care", "山の手入れ（植林・間伐）"],
  ["disaster", "土砂災害警戒区域"],
  ["neighbor_trouble", "隣地とのもめごと・通行"],
  ["recurring_charges", "毎年の金銭負担（土地改良区の賦課金など）"],
  ["shutoku", "取得の経緯（相続か、売買か、遺産分割していないか）"],
];
const UNKNOWABLE = /^(不明|対象外|)$/;

async function ask(system: string, user: string, maxTokens = 2000): Promise<string> {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        // 補助役（親・子・抽出・採点）は浅い思考で速く
        ...({ output_config: { effort: "low" } } as object),
      });
      return r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    } catch (e) {
      if (a === 3) throw e;
      await new Promise((s) => setTimeout(s, 3000 * (a + 1)));
    }
  }
  return "";
}
const json = (s: string) => JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));

function initialCard(truth: FudeCard): FudeCard {
  // 課税明細書から分かるのは、地番・登記地目・面積・名義まで
  const blank = Object.fromEntries(FIELDS.map(([k]) => [k, "不明"]));
  return {
    ...(blank as unknown as FudeCard),
    id: truth.id || "X",
    chiban: truth.chiban,
    toki_chimoku: truth.toki_chimoku,
    menseki_m2: truth.menseki_m2,
    meigi: truth.meigi,
    hisouzokunin_shibou: truth.hisouzokunin_shibou,
    genkyo: "不明",
    shutoku: "不明",
    structures: [],
  };
}

const PARENT_SYS = (truth: FudeCard) => `あなたは和歌山の山あいに住む70代の親です。子どもから電話で、実家の土地（${truth.chiban}、${truth.toki_chimoku}）について聞かれています。
あなたが知っている事実は次のJSONだけです。値が「不明」の項目は本当に分かりません。
${JSON.stringify(truth, null, 1)}
ルール：聞かれたことにだけ、関西の方言で1〜2文で答える。聞かれていないことは言わない。JSONにないことは「分からん」と言う。制度の用語は使わない。`;

const CHILD_SYS = `あなたは東京に住む40代の会社員です。親が亡くなったあとの実家の土地の扱いが気になり、70代の親に電話で話を聞いています。
相続や「相続土地国庫帰属制度」の細かい要件は知りません（ニュースで聞いたことがある程度）。
手元には課税明細書の情報だけがあります。親に聞く質問を、1回に1つだけ、短い話し言葉で書いてください。質問文だけを出力します。`;

const EXTRACT_SYS = `電話の会話記録から、土地カードの項目を埋めます。会話ではっきり分かったことだけを書き、分からない項目は「不明」にします。推測で埋めない。
JSONだけを出力：{${FIELDS.map(([k]) => `"${k}": "..."`).join(", ")}, "genkyo": "...", "structures": ["..."]}`;

const GRADE_SYS = `土地カードの採点です。各項目について、抽出値が正解値と同じ事実を表していれば「一致」、違えば「不一致」、抽出値が「不明」なら「空欄」。
JSONだけを出力：{"項目キー": "一致|不一致|空欄", ...}`;

async function extract(base: FudeCard, transcript: string): Promise<FudeCard> {
  const out = json(await ask(EXTRACT_SYS, `課税明細書の情報：${JSON.stringify({ chiban: base.chiban, toki_chimoku: base.toki_chimoku, menseki_m2: base.menseki_m2, meigi: base.meigi })}\n\n会話記録：\n${transcript}`));
  return { ...base, ...out, structures: Array.isArray(out.structures) ? out.structures : [] };
}

type ArmResult = { transcript: string; card: FudeCard; correct: number; wrong: number; knowable: number; verdict: string; questions: string[] };

async function finish(truth: FudeCard, base: FudeCard, transcript: string, questions: string[], expectedVerdict: string): Promise<ArmResult> {
  const card = await extract(base, transcript);
  const keys = FIELDS.map(([k]) => k).filter((k) => !UNKNOWABLE.test(String(truth[k] ?? "").trim()));
  const pairs = Object.fromEntries(keys.map((k) => [k, { 正解: truth[k], 抽出: card[k] }]));
  const g = keys.length ? json(await ask(GRADE_SYS, JSON.stringify(pairs, null, 1))) : {};
  const correct = keys.filter((k) => g[k] === "一致").length;
  const wrong = keys.filter((k) => g[k] === "不一致").length;
  const j = await judgeWithClaude(card);
  void expectedVerdict;
  return { transcript, card, correct, wrong, knowable: keys.length, verdict: j.verdict, questions };
}

async function runWithout(truth: FudeCard, expected: string): Promise<ArmResult> {
  const base = initialCard(truth);
  let transcript = "";
  const qs: string[] = [];
  for (let t = 0; t < TURNS; t++) {
    const q = await ask(CHILD_SYS, `課税明細書：${JSON.stringify({ 地番: base.chiban, 地目: base.toki_chimoku, 面積: base.menseki_m2, 名義: base.meigi })}\n\nここまでの会話：\n${transcript || "（まだなし）"}\n\n次に親に聞く質問を1つ。`, 800);
    qs.push(q);
    const a = await ask(PARENT_SYS(truth), `ここまでの会話：\n${transcript}\n\n子：${q}\n\nあなた（親）の答え：`, 600);
    transcript += `子：${q}\n親：${a}\n`;
  }
  return finish(truth, base, transcript, qs, expected);
}

async function runWith(truth: FudeCard, expected: string): Promise<ArmResult> {
  const base = initialCard(truth);
  let card = base;
  const asked: string[] = [];
  let transcript = "";
  const qs: string[] = [];
  for (let t = 0; t < TURNS; t++) {
    const j = await judgeWithClaude(card);
    const nq = await nextQuestionWithClaude(card, j, asked);
    if (!nq) break;
    asked.push(nq.code);
    const q = nq.prompt;
    qs.push(q);
    const a = await ask(PARENT_SYS(truth), `ここまでの会話：\n${transcript}\n\n子：${q}\n\nあなた（親）の答え：`, 600);
    transcript += `子：${q}\n親：${a}\n`;
    card = await extract(base, transcript); // 本番と同じく、答えのたびにカードを更新して次の質問を選ぶ
  }
  return finish(truth, base, transcript, qs, expected);
}

async function main() {
  const cases = readFileSync(resolve(ROOT, "evals/seido/cases.jsonl"), "utf-8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l)) as Array<{ id: string; title: string; card: FudeCard; expected: { verdict: string } }>;
  const list = LIMIT ? cases.slice(0, LIMIT) : cases;
  const ts = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-");
  mkdirSync(resolve(ROOT, "runs"), { recursive: true });
  const outPath = resolve(ROOT, `runs/effect-${ts}.jsonl`);
  const rows: any[] = [];
  const queue = list.slice();
  let done = 0;
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const truth = { ...c.card, id: c.id };
      try {
        const [a, b] = await Promise.all([runWithout(truth, c.expected.verdict), runWith(truth, c.expected.verdict)]);
        rows.push({ id: c.id, title: c.title, expected: c.expected.verdict, without: a, with: b });
      } catch (e) {
        console.error(`  ${c.id} 失敗: ${e instanceof Error ? e.message : e}`);
      }
      process.stdout.write(`\r  ${++done}/${list.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONC }, worker));
  process.stdout.write("\n");
  rows.sort((x, y) => x.id.localeCompare(y.id));
  writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

  const sum = (arm: "without" | "with") => {
    const k = rows.reduce((s, r) => s + r[arm].knowable, 0);
    const c = rows.reduce((s, r) => s + r[arm].correct, 0);
    const w = rows.reduce((s, r) => s + r[arm].wrong, 0);
    const v = rows.filter((r) => r[arm].verdict === r.expected).length;
    return { k, c, w, v };
  };
  const A = sum("without"), B = sum("with");
  const pct = (a: number, b: number) => `${Math.round((100 * a) / Math.max(b, 1))}%`;
  console.log(`件数 ${rows.length}・各${TURNS}問`);
  console.log(`親が知っている必須項目のうち、正しく聞き出せた  アプリなし ${A.c}/${A.k} = ${pct(A.c, A.k)}   アプリあり ${B.c}/${B.k} = ${pct(B.c, B.k)}`);
  console.log(`取り違え（不一致）                              アプリなし ${A.w}   アプリあり ${B.w}`);
  console.log(`判定が正解と一致                                アプリなし ${A.v}/${rows.length} = ${pct(A.v, rows.length)}   アプリあり ${B.v}/${rows.length} = ${pct(B.v, rows.length)}`);
  console.log(`出力: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
