/**
 * 文字カード・構成図・評価・ガードの静止画（1920x1080）を書き出す。
 *   npx tsx scripts/video/cards.ts  → out/video/cards/<scene>.png
 *
 * デザインはアプリと同じ和紙と墨の色。補助ラベルは置かず、大きさと位置で読ませる。
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES } from "./script.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "out/video/cards");
mkdirSync(OUT, { recursive: true });

const C = {
  washi: "#f6efe2", washiDark: "#ece2d1", deep: "#dfd3bc",
  sumi900: "#1a1612", sumi700: "#3b332a", sumi500: "#6b5d50", sumi400: "#8a7a6a", sumi300: "#b8a893",
  beni: "#a0352c", kincha: "#b7892a", matcha: "#5e7a3e", ai: "#345672",
};

const HEAD = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Yuji+Boku&family=Shippori+Mincho:wght@500;700&family=Noto+Sans+JP:wght@400;500;700&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden}
body{word-break:auto-phrase;background:radial-gradient(ellipse at 30% 20%, ${C.washi} 0%, ${C.washiDark} 100%);color:${C.sumi900};font-family:'Noto Sans JP',sans-serif}
.fude{font-family:'Yuji Boku',serif}
.mincho{font-family:'Shippori Mincho',serif}
.wrap{position:absolute;inset:0;padding:120px 160px;display:flex;flex-direction:column;justify-content:center}
.brand{position:absolute;left:72px;top:56px;font-family:'Yuji Boku',serif;font-size:34px;letter-spacing:.3em;color:${C.sumi700}}
.line{font-family:'Noto Sans JP',sans-serif;font-weight:700;font-size:76px;line-height:1.5;letter-spacing:.02em}
.big{font-family:'Yuji Boku',serif;font-size:220px;line-height:1.1;color:${C.beni};margin-bottom:24px}
.sub{font-family:'Noto Sans JP',sans-serif;font-weight:500;font-size:38px;line-height:1.7;color:${C.sumi500};margin-top:48px;max-width:1500px}
.rule{width:120px;height:4px;background:${C.sumi900};margin:40px 0 0}
</style></head><body>`;

function cardHtml(lines: string[], big?: string, sub?: string, withBrand = true): string {
  return `${HEAD}${withBrand ? '<div class="brand">筆のこえ</div>' : ""}<div class="wrap">
${big ? `<div class="big">${big}</div>` : ""}
${lines.map((l) => `<div class="line">${l}</div>`).join("")}
${sub ? `<div class="rule"></div><div class="sub">${sub}</div>` : ""}
</div></body></html>`;
}

function archHtml(): string {
  const box = (x: number, y: number, w: number, h: number, title: string, body: string, color = C.sumi900) =>
    `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:3px solid ${color};border-radius:14px;background:${C.washi};padding:22px 26px;box-shadow:0 8px 24px rgba(26,22,18,.08)">
      <div style="font-size:42px;font-weight:700;color:${color}">${title}</div>
      <div class="mincho" style="font-size:27px;line-height:1.55;color:${C.sumi700};margin-top:10px">${body}</div></div>`;
  const arrow = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.sumi500}" stroke-width="4" marker-end="url(#a)"/>`;
  return `${HEAD}<div class="brand">筆のこえ</div>
  <svg width="1920" height="1080" style="position:absolute;inset:0">
    <defs><marker id="a" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="${C.sumi500}"/></marker></defs>
    ${arrow(340, 470, 400, 470)}${arrow(720, 470, 780, 470)}${arrow(1100, 470, 1160, 470)}${arrow(1540, 470, 1600, 470)}
    ${arrow(1350, 730, 1350, 615)}${arrow(1350, 330, 1350, 255)}
  </svg>
  ${box(60, 340, 280, 260, "親の声", "話すだけ。<br>方言のまま。", C.sumi900)}
  ${box(400, 340, 320, 260, "Gemini Live", "声を文字に<br>（ブラウザ直結）", C.ai)}
  ${box(780, 340, 320, 260, "Jev", "その場でタグ付け<br>どの土地の話か<br>何の事実か・疲れ", C.sumi700)}
  ${box(1160, 340, 380, 270, "Claude", "判定・理由<br>次の二択の質問<br>士業法ガードの言い換え", C.beni)}
  ${box(1600, 340, 260, 260, "家族", "地図<br>カード<br>論点", C.matcha)}
  ${box(1065, 740, 570, 250, "Skills", "制度の要件・士業の線引き（.claude/skills）<br>開発の Claude Code と本番で共用", C.kincha)}
  ${box(1065, 70, 570, 185, "評価（evals/）", "判定25件・ガード50件・効果測定25件", C.sumi700)}
  </body></html>`;
}

function evalsHtml(): string {
  const bar = (label: string, before: number, after: number, y: number) => `
  <div style="position:absolute;left:160px;top:${y}px;width:1600px">
    <div style="font-size:46px;font-weight:700">${label}</div>
    <div style="display:flex;align-items:center;gap:28px;margin-top:18px">
      <div style="width:230px;font-size:30px;color:${C.sumi500}">アプリなし</div>
      <div style="height:50px;width:${before * 11}px;background:${C.sumi300};border-radius:6px"></div>
      <div style="font-size:46px;font-weight:700;color:${C.sumi500}">${before}%</div>
    </div>
    <div style="display:flex;align-items:center;gap:28px;margin-top:14px">
      <div style="width:230px;font-size:30px;font-weight:700;color:${C.sumi900}">アプリあり</div>
      <div style="height:50px;width:${after * 11}px;background:${C.beni};border-radius:6px"></div>
      <div style="font-size:58px;font-weight:700;color:${C.beni}">${after}%</div>
    </div>
  </div>`;
  return `${HEAD}<div class="brand">筆のこえ</div>
  <div style="position:absolute;left:160px;top:120px;font-size:34px;color:${C.sumi700}">親役・子役を AI で模擬し、8問ずつ聞き取り（25件）</div>
  ${bar("必要な項目を聞き出せた", 49, 70, 200)}
  ${bar("判定が正解と一致", 72, 84, 470)}
  <div style="position:absolute;left:160px;top:760px;font-size:38px;font-weight:700;color:${C.sumi900}">
    Skills で判定 <span style="color:${C.sumi500}">84%</span> → <span style="color:${C.beni}">100%</span>　／　士業ガード 96%以上・止めすぎ <span style="color:${C.matcha}">0件</span>
  </div>
  <div style="position:absolute;left:160px;top:900px;width:1600px;font-size:24px;line-height:1.6;color:${C.sumi400}">claude-sonnet-5-5。模擬の聞き取りで、実際の家族での効果ではありません。判定の100%は同じ25件を見ながら直した値（docs/eval-log.md）</div>
  </body></html>`;
}

function guardHtml(): string {
  return `${HEAD}<div class="brand">筆のこえ</div>
  <div style="position:absolute;left:160px;top:190px;width:1600px">
    <div class="mincho" style="font-size:44px;line-height:1.7;color:${C.sumi400};text-decoration:line-through;text-decoration-color:${C.beni};text-decoration-thickness:5px">
      境界は栗の木までです。この畑は国に引き取ってもらえます。
    </div>
    <div style="margin:56px 0 0;width:100%;height:3px;background:${C.deep}"></div>
    <div style="font-size:56px;font-weight:700;line-height:1.6;margin-top:56px">
      境界は、母の証言では栗の木まで（参考）。<br>確かめるには、土地家屋調査士へ。
    </div>
    <div class="mincho" style="font-size:38px;line-height:1.8;color:${C.sumi700};margin-top:36px">
      持っていく物：課税明細書／公図の写し／現地の写真<br>最終判断は法務局の審査です。
    </div>
  </div></body></html>`;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const render = async (name: string, html: string) => {
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => (document as any).fonts.ready);
    await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(OUT, `${name}.png`) });
    console.log(`✓ ${name}.png`);
  };
  for (const s of SCENES) {
    const v = s.visual;
    if (v.kind === "card") await render(s.id, cardHtml(v.lines, v.big, v.sub, !v.big));
    if (v.kind === "arch") await render(s.id, archHtml());
    if (v.kind === "evals") await render(s.id, evalsHtml());
    if (v.kind === "guard") await render(s.id, guardHtml());
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
