/**
 * ブラウザ QA：各画面のゴールデンパスをスクショする。
 *
 * 前提：別シェルで `npm run dev` を立ち上げている（デフォルト http://localhost:3100）。
 * または `BASE_URL=http://localhost:3100 npm run qa` で明示。
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = resolve(ROOT, "docs/screenshots-2026-11-04");
mkdirSync(OUT, { recursive: true });

async function shot(page: Page, name: string, fullPage = true) {
  const path = resolve(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage });
  console.log(`✓ ${name}.png`);
}

async function waitFonts(page: Page) {
  await page.evaluate(() => (document as any).fonts?.ready);
  await page.waitForTimeout(300);
}

async function run(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  // 1. ホーム
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await waitFonts(page);
  await shot(page, "01-home-town");

  await page.getByPlaceholder(/大字 栗原/).fill("大字 栗原");
  await page.getByRole("button", { name: "地図へ" }).click();
  await waitFonts(page);
  await shot(page, "02-home-slip");

  await page.getByRole("button", { name: "撮る" }).click();
  // 筆が1つずつ現れるアニメが終わるまで
  await page.waitForTimeout(3000);
  await waitFonts(page);
  await shot(page, "03-home-list");

  // 2. 家族の画面
  await page.goto(`${BASE}/family`, { waitUntil: "networkidle" });
  await waitFonts(page);
  await page.waitForTimeout(1500);
  await shot(page, "04-family-initial");

  // 聞き直しの最初の答え（はい側）
  try {
    const yes = page.getByRole("button").filter({ hasText: /隣と見て決めたことがある|屋根も壁もある|ずっと使ってる人がおる|していた覚えがある|やってもろたことがある|崖がある|埋めた覚えがある|払っとる/ }).first();
    await yes.click({ timeout: 3000 });
    await page.waitForTimeout(900);
    await shot(page, "05-family-after-answer");
  } catch (e) {
    console.log("(no 聞き直し on initial fude — skipping)");
  }

  // 3. 母の画面
  await page.goto(`${BASE}/mother`, { waitUntil: "networkidle" });
  await waitFonts(page);
  await page.waitForTimeout(800);
  await shot(page, "06-mother");

  // 4. 窓口の画面
  await page.goto(`${BASE}/counter`, { waitUntil: "networkidle" });
  await waitFonts(page);
  await page.waitForTimeout(400);
  await shot(page, "07-counter-forestry");

  await page.getByRole("button", { name: /農業委員会/ }).click();
  await page.waitForTimeout(500);
  await shot(page, "08-counter-nouchi");

  await page.getByRole("button", { name: /司法書士/ }).click();
  await page.waitForTimeout(500);
  await shot(page, "09-counter-shoshi");

  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await run(browser);
    console.log(`\n完了: ${OUT}`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
