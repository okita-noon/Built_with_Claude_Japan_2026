/**
 * 台本のナレーションと親の発話を Gemini TTS で WAV にする。
 *
 *   npx tsx scripts/video/tts.ts            # 未生成のものだけ
 *   npx tsx scripts/video/tts.ts --force    # 全部作り直す
 *
 * 出力: out/video/audio/<scene>.wav, out/video/audio/parent-<n>.wav, durations.json
 */
import { config as loadDotenv } from "dotenv";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES, PARENT_LINES, NARRATOR_VOICE, NARRATOR_STYLE, PARENT_VOICE, PARENT_STYLE, ASK_DEVICE_VOICE, ASKS } from "./script.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadDotenv({ path: resolve(ROOT, ".env.local") });
const OUT = resolve(ROOT, "out/video/audio");
mkdirSync(OUT, { recursive: true });

const MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
const force = process.argv.includes("--force");

async function tts(text: string, voice: string, style: string): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY が未設定");
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${style}\n${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    if (r.ok) {
      const j = (await r.json()) as any;
      const part = j.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (part) {
        const buf = Buffer.from(part.inlineData.data, "base64");
        const mime: string = part.inlineData.mimeType;
        if (mime.includes("wav")) return buf;
        // audio/L16;rate=24000 → WAV ヘッダを付ける
        const rate = Number(/rate=(\d+)/.exec(mime)?.[1] || 24000);
        return pcmToWav(buf, rate);
      }
    }
    else console.warn(`  TTS ${r.status}: ${(await r.text()).slice(0, 160)}`);
    await new Promise((s) => setTimeout(s, 5000 * (attempt + 1)));
  }
  throw new Error(`TTS 失敗: ${text.slice(0, 20)}`);
}

function pcmToWav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function wavSeconds(buf: Buffer): number {
  const rate = buf.readUInt32LE(24);
  const bytesPerSec = buf.readUInt32LE(28);
  const dataIdx = buf.indexOf("data");
  const len = buf.readUInt32LE(dataIdx + 4);
  return len / (bytesPerSec || rate * 2);
}

async function main() {
  const jobs: Array<{ name: string; text: string; voice: string; style: string }> = [
    ...SCENES.map((s) => ({ name: s.id, text: s.narration, voice: NARRATOR_VOICE, style: NARRATOR_STYLE })),
    ...PARENT_LINES.map((t, i) => ({ name: `parent-${i}`, text: t, voice: PARENT_VOICE, style: PARENT_STYLE })),
    ...ASKS.flatMap((a) => [
      { name: `ask-q-${a.key}`, text: a.question, voice: ASK_DEVICE_VOICE, style: "" },
      { name: `ask-a-${a.key}`, text: a.answer, voice: PARENT_VOICE, style: PARENT_STYLE },
    ]),
  ];
  const durPath = resolve(OUT, "durations.json");
  const durations: Record<string, number> = existsSync(durPath) ? JSON.parse(readFileSync(durPath, "utf-8")) : {};
  // 同時に投げすぎると 429 になるので 3 本ずつ
  const queue = jobs.slice();
  const worker = async () => {
    for (let j = queue.shift(); j; j = queue.shift()) await runJob(j);
  };
  const runJob = async (j: (typeof jobs)[number]) => {
      const path = resolve(OUT, `${j.name}.wav`);
      if (!force && existsSync(path)) {
        durations[j.name] = wavSeconds(readFileSync(path));
        return;
      }
      const wav = await tts(j.text, j.voice, j.style);
      writeFileSync(path, wav);
      durations[j.name] = wavSeconds(wav);
      console.log(`✓ ${j.name} ${durations[j.name].toFixed(1)}s`);
  };
  await Promise.all([worker(), worker(), worker()]);
  writeFileSync(durPath, JSON.stringify(durations, null, 2));
  const total = SCENES.reduce((a, s) => a + durations[s.id], 0);
  console.log(`ナレーション合計 ${total.toFixed(1)}s（シーン間の余白は別）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
