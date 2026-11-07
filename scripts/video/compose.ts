/**
 * カード・収録映像・ナレーションを合成して 1 本の mp4 にする。
 *   npx tsx scripts/video/compose.ts [--tempo 1.1] [--app-speed 1.0]
 *   → out/video/fudekoe-demo.mp4
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES } from "./script.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const V = resolve(ROOT, "out/video");
const TMP = resolve(V, "tmp");
mkdirSync(TMP, { recursive: true });
const arg = (k: string, d: number) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const TEMPO = arg("--tempo", 1.15); // ナレーションの話速
const APP_SPEED = arg("--app-speed", 1.0); // 収録パートの再生速度
const dur: Record<string, number> = JSON.parse(readFileSync(resolve(V, "audio/durations.json"), "utf-8"));
const ff = (args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const probe = (f: string) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const VENC = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-preset", "medium", "-crf", "20"];
const AENC = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"];

const LEAD = 0.25;
const TAIL = 0.3;

function cardClip(id: string): string {
  const out = resolve(TMP, `${id}.mp4`);
  const d = dur[id] / TEMPO + LEAD + TAIL;
  ff([
    "-loop", "1", "-t", d.toFixed(3), "-i", resolve(V, `cards/${id}.png`),
    "-i", resolve(V, `audio/${id}.wav`),
    "-filter_complex",
    `[0]scale=1920:1080,fade=in:st=0:d=0.25,fade=out:st=${(d - 0.25).toFixed(3)}:d=0.25[v];` +
      `[1]atempo=${TEMPO},adelay=${Math.round(LEAD * 1000)}:all=1,apad,atrim=0:${d.toFixed(3)}[a]`,
    "-map", "[v]", "-map", "[a]", ...VENC, ...AENC, "-t", d.toFixed(3), out,
  ]);
  return out;
}

function appClip(): string {
  const tl = JSON.parse(readFileSync(resolve(V, "rec/timeline.json"), "utf-8")) as {
    segs: Array<[number, number]>;
    placed: Array<{ file: string; at: number }>;
    total: number;
  };
  const video = resolve(TMP, "app-video.mp4");
  const vparts = tl.segs.map(([a, b], i) => `[0]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS[s${i}]`);
  ff([
    "-i", resolve(V, "rec/app.webm"),
    "-filter_complex",
    vparts.join(";") + ";" + tl.segs.map((_, i) => `[s${i}]`).join("") + `concat=n=${tl.segs.length}:v=1:a=0,scale=1920:1080,setpts=PTS/${APP_SPEED}[v]`,
    "-map", "[v]", ...VENC, video,
  ]);
  const vlen = probe(video);
  // 音声：置いた位置に合わせて重ねる。ナレーションだけ話速を上げる（開始位置は変えない）
  const inputs: string[] = [];
  const filters: string[] = [];
  tl.placed.forEach((p, i) => {
    inputs.push("-i", resolve(V, `audio/${p.file}`));
    const isNarr = /^\d\d/.test(p.file);
    const at = Math.max(0, p.at / APP_SPEED);
    const speed = (isNarr ? TEMPO : 1) * APP_SPEED;
    filters.push(`[${i + 1}]${speed !== 1 ? `atempo=${speed.toFixed(4)},` : ""}adelay=${Math.round(at * 1000)}:all=1[a${i}]`);
  });
  const out = resolve(TMP, "app.mp4");
  ff([
    "-i", video, ...inputs,
    "-filter_complex",
    filters.join(";") + ";" + tl.placed.map((_, i) => `[a${i}]`).join("") +
      `amix=inputs=${tl.placed.length}:normalize=0:duration=longest,apad,atrim=0:${vlen.toFixed(3)}[a]`,
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", ...AENC, "-t", vlen.toFixed(3), out,
  ]);
  return out;
}

const clips: string[] = [];
let appDone = false;
for (const s of SCENES) {
  if (s.visual.kind === "app") {
    if (!appDone) clips.push(appClip());
    appDone = true;
  } else clips.push(cardClip(s.id));
}
const list = resolve(TMP, "list.txt");
writeFileSync(list, clips.map((c) => `file '${c}'`).join("\n"));
const joined = resolve(TMP, "joined.mp4");
ff(["-f", "concat", "-safe", "0", "-i", list, ...VENC, ...AENC, joined]);
const final = resolve(V, "fudekoe-demo.mp4");
ff(["-i", joined, "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", ...AENC, "-movflags", "+faststart", final]);
console.log(`✓ ${final}  ${probe(final).toFixed(1)}s`);
