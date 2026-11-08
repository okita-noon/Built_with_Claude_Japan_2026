/**
 * アプリの画面を実際に動かして収録する（06〜10）。
 *
 *   前提：開発サーバー（npm run dev, :3100）と .env.local の各キー、tts.ts の音声
 *   npx tsx scripts/video/record.ts
 *
 * 出力:
 *   out/video/rec/app.webm        … 収録そのまま
 *   out/video/rec/timeline.json   … 残す区間（Claude の待ち時間は切る）と、音声を置く位置
 *
 * 親の声は TTS の音声を「親の画面のマイク入力」として Gemini Live に流す。
 * 文字起こし → Jev → Claude の判定は、すべてアプリの実処理。
 */
import { chromium } from "@playwright/test";
import { ASKS } from "./script.ts";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = process.env.BASE_URL || "http://localhost:3100";
const AUDIO = resolve(ROOT, "out/video/audio");
const OUT = resolve(ROOT, "out/video/rec");
mkdirSync(OUT, { recursive: true });
const dur: Record<string, number> = JSON.parse(readFileSync(resolve(AUDIO, "durations.json"), "utf-8"));
// compose.ts の --tempo と合わせる（ナレーションの話速）
const TEMPO = Number(process.env.TEMPO || 1.15);
const narr = (id: string) => dur[id] / TEMPO;

// 親の3つの発話を、間に 1.6 秒の無音をはさんで1本にする（Gemini の発話区切り用）
const PARENT_ALL = resolve(AUDIO, "parent-all.wav");
execFileSync("ffmpeg", [
  "-v", "error", "-y",
  "-i", resolve(AUDIO, "parent-0.wav"), "-i", resolve(AUDIO, "parent-1.wav"), "-i", resolve(AUDIO, "parent-2.wav"),
  "-filter_complex",
  "[0]apad=pad_dur=1.2[a0];[1]apad=pad_dur=1.3[a1];[2]apad=pad_dur=0.8[a2];[a0][a1][a2]concat=n=3:v=0:a=1",
  "-ar", "24000", "-ac", "1", PARENT_ALL,
]);
const parentAllSec = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", PARENT_ALL]).toString());

const STAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#e8ddc9}
iframe{position:absolute;border:0;background:#f6efe2;transition:opacity .35s ease}
#home,#counter{left:0;top:0;width:1920px;height:1080px}
#parent{left:36px;top:40px;width:430px;height:1000px;border-radius:28px;box-shadow:0 0 0 10px #1a1612,0 18px 40px rgba(0,0,0,.25)}
#family{left:510px;top:0;width:1410px;height:1080px}
.hide{opacity:0;pointer-events:none}
</style></head><body>
<iframe id="family" class="hide" src="${BASE}/family"></iframe>
<iframe id="parent" class="hide" src="${BASE}/parent"></iframe>
<iframe id="counter" class="hide" src="about:blank"></iframe>
<iframe id="home" src="${BASE}/"></iframe>
</body></html>`;

// すべてのフレームで getUserMedia を差し替え、親の音声ファイルをマイクとして返す
const FAKE_MIC = `(() => {
  if (!navigator.mediaDevices) return;
  navigator.mediaDevices.getUserMedia = async () => {
    const ac = new AudioContext();
    const buf = await ac.decodeAudioData(await (await fetch("/__parent-all.wav")).arrayBuffer());
    const src = ac.createBufferSource(); src.buffer = buf;
    const dst = ac.createMediaStreamDestination(); src.connect(dst);
    setTimeout(() => { src.start(); console.log("MICPLAY " + Date.now()); }, 1200);
    return dst.stream;
  };
})();`;

type Seg = [number, number];
type Placed = { file: string; at: number };

async function main() {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
  });
  await ctx.addInitScript(FAKE_MIC);
  await ctx.route("**/__parent-all.wav", (r) => r.fulfill({ body: readFileSync(PARENT_ALL), contentType: "audio/wav" }));
  await ctx.route(`${BASE}/__stage`, (r) => r.fulfill({ body: STAGE, contentType: "text/html" }));

  const page = await ctx.newPage();
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const segs: Seg[] = [];
  const placed: Placed[] = [];
  let segStart = -1;
  let outBase = 0;
  const resume = () => { segStart = now(); };
  const cut = () => { const e = now(); segs.push([segStart, e]); outBase += e - segStart; segStart = -1; };
  const outNow = () => outBase + (now() - segStart);
  const say = (file: string, lead = 0) => placed.push({ file, at: outNow() + lead });
  const sleep = (s: number) => page.waitForTimeout(s * 1000);
  const log = (m: string) => console.log(`[${now().toFixed(1)}s] ${m}`);

  let micPlayAt = 0;
  page.on("console", (m) => {
    const t = m.text();
    if (t.startsWith("MICPLAY ")) micPlayAt = Number(t.slice(8));
  });

  await page.goto(`${BASE}/__stage`);
  const show = (ids: string[]) =>
    page.evaluate((ids) => {
      for (const el of Array.from(document.querySelectorAll("iframe"))) el.classList.toggle("hide", !ids.includes(el.id));
    }, ids);
  await sleep(6); // 地図タイル・フォント

  // ---- 06 課税明細書 → 筆の一覧 ----
  const home = page.frames().find((f) => f.url() === `${BASE}/`)!;
  await home.getByPlaceholder(/大字 栗原/).fill("大字 栗原");
  await home.getByRole("button", { name: "地図へ" }).click();
  await sleep(1.2);
  resume();
  say("06-ocr.wav", 0.3);
  await sleep(1.6);
  await home.getByRole("button", { name: "撮る" }).click();
  await sleep(Math.max(narr("06-ocr") - 1.3, 4) + 0.8);
  cut();
  log("06 done");

  // ---- 07 親が話す（実 Gemini Live）----
  await show(["parent", "family"]);
  await sleep(1.0);
  resume();
  say("07-live.wav", 0.3);
  await sleep(narr("07-live") + 0.6);
  const parent = page.frames().find((f) => f.url().endsWith("/parent"))!;
  const family = page.frames().find((f) => f.url().endsWith("/family"))!;
  micPlayAt = 0;
  await parent.getByRole("button", { name: "話す" }).click();
  for (let i = 0; i < 100 && !micPlayAt; i++) await sleep(0.1);
  if (!micPlayAt) throw new Error("マイク再生が始まらない");
  // MICPLAY の実時刻を出力の時間軸に直して親の声を置く
  placed.push({ file: "parent-all.wav", at: outBase + ((micPlayAt - t0) / 1000 - segStart) });
  log("mic playing");
  const parentEnd = micPlayAt + parentAllSec * 1000;
  while (Date.now() < parentEnd + 1800) await sleep(0.2);
  await parent.getByRole("button", { name: "話す" }).click(); // 終了（残りの文字起こしを確定）
  await sleep(0.8);
  cut();

  // ---- 08 栗の木の畑が「申請できない可能性」へ ----
  const inRefuse = async () => (await family.locator(".lane-refuse").innerText().catch(() => "")).includes("栗の木");
  for (let i = 0; i < 300 && !(await inRefuse()); i++) await sleep(0.2);
  log(`kuri moved: ${await inRefuse()}`);
  resume();
  say("08-live-result.wav", 0.2);
  await sleep(narr("08-live-result") + 0.6);
  cut();

  // ---- 09 聞き直し（うえの畑）----
  // 次の質問は Claude が選ぶ（毎回同じとは限らない）。用意したどちらかの質問が出るまで待つ（待ちは編集で切る）
  // 「使っている人」の質問だとマスが確実に埋まるので、それが出るまで選び直す（待ちは編集で切る）
  let ask: (typeof ASKS)[number] | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) { await family.getByText("おくの畑").first().click(); await sleep(1.5); }
    await family.getByText("うえの畑").first().click();
    ask = undefined;
    for (let i = 0; i < 200 && !ask; i++) {
      for (const a of ASKS) if (await family.getByText(a.question).first().isVisible().catch(() => false)) ask = a;
      if (!ask) await sleep(0.2);
    }
    if (ask?.key === "use") break;
    log(`ask = ${ask?.key ?? "none"} → 選び直す`);
  }
  if (!ask) throw new Error("想定した質問が出ない");
  await sleep(1.0);
  if (!(await family.getByText(ask.question).first().isVisible())) throw new Error("質問が切り替わった");
  log(`ask = ${ask.key}`);
  const q1 = ask.question;
  await sleep(0.3);
  resume();
  say("09-ask.wav", 0.2);
  await sleep(narr("09-ask") + 0.2);
  await family.getByRole("button", { name: "親に読み上げる" }).click();
  say(`ask-q-${ask.key}.wav`, 0.3);
  await sleep(dur[`ask-q-${ask.key}`] + 0.7);
  say(`ask-a-${ask.key}.wav`, 0);
  await sleep(dur[`ask-a-${ask.key}`] + 0.2);
  // マス（必須10項目）を強調してから答える。動画用の一時的な装飾で、アプリには入れない
  await family.evaluate(() => {
    const g = document.querySelector("[data-shogen-grid]") as HTMLElement | null;
    if (!g) return;
    g.style.outline = "4px solid #a0352c";
    g.style.outlineOffset = "8px";
    g.style.borderRadius = "4px";
    g.insertAdjacentHTML(
      "beforebegin",
      '<div id="__tip" style="margin-top:18px;font:700 17px \'Noto Sans JP\',sans-serif;color:#a0352c">確認が必要な10項目　━　聞けた項目は黒く埋まる</div>'
    );
  });
  await sleep(1.0);
  // 二択の文言は Claude が毎回つくるので、意味で選ぶ（見つからなければ従来の文言）
  const choiceRe = { use: /誰も|だれも|使って(い)?ない|いない|おらん/, security: /して(い)?ない|ない/, boundary: /ない/ }[ask.key];
  const btn = family.getByRole("button", { name: choiceRe }).first();
  await ((await btn.isVisible().catch(() => false)) ? btn : family.getByRole("button", { name: ask.choice })).click();
  await sleep(0.5);
  cut();
  // 答えが反映され、次の質問に替わるまで待つ（Claude の待ちは切る）
  await family.getByText(q1).first().waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  await sleep(0.3);
  resume();
  say("09b-ask.wav", 0.1);
  await sleep(narr("09b-ask") + 0.6);
  cut();

  await family.evaluate(() => {
    document.getElementById("__tip")?.remove();
    const g = document.querySelector("[data-shogen-grid]") as HTMLElement | null;
    if (g) g.style.outline = "none";
  });

  // ---- 10 家族の論点表 → 窓口 ----
  resume();
  say("10-family-counter.wav", 0.2);
  for (const [member, intent] of [["あなた", "託す"], ["兄", "託す"], ["姉", "託す"]] as const) {
    await family.getByRole("button", { name: member, exact: true }).click();
    await sleep(0.5);
    await family.getByRole("button", { name: intent, exact: true }).click();
    await sleep(0.9);
  }
  await sleep(1.0);
  await page.evaluate((u) => { (document.getElementById("counter") as HTMLIFrameElement).src = u; }, `${BASE}/counter`);
  await sleep(1.5);
  await show(["counter"]);
  const remain = narr("10-family-counter") + 0.2 - (3 * 1.4 + 1.0 + 1.5);
  await sleep(Math.max(remain, 1.5) + 0.5);
  cut();

  await ctx.close(); // 動画を書き出す
  await browser.close();

  const webm = readdirSync(OUT).filter((f) => f.endsWith(".webm") && f !== "app.webm");
  if (webm.length) renameSync(resolve(OUT, webm[webm.length - 1]), resolve(OUT, "app.webm"));
  writeFileSync(resolve(OUT, "timeline.json"), JSON.stringify({ segs, placed, total: outBase }, null, 2));
  console.log(`✓ app.webm  残す長さ ${outBase.toFixed(1)}s / 区間 ${segs.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
