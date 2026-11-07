/**
 * `.claude/skills/<name>/SKILL.md` をまとめて `src/lib/skills.generated.ts` に書き出す。
 *
 * Cloudflare Workers のランタイムでは `fs.readFileSync` が使えないため、
 * ビルド時に TypeScript の定数へインライン化する。
 *
 * 実行: `npm run skills:bundle`（prebuild で自動実行）
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SKILLS_DIR = resolve(ROOT, ".claude", "skills");
const OUT_PATH = resolve(ROOT, "src", "lib", "skills.generated.ts");

const TARGETS = ["seido-check", "shigyo-guard", "fude-card", "design-system"];

function constName(slug: string): string {
  return "SKILL_" + slug.replace(/-/g, "_").toUpperCase();
}

function escape(text: string): string {
  // Template literal 内に素のバックティックとドル記号を含めないため
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function main() {
  if (!existsSync(SKILLS_DIR)) {
    throw new Error(`skills dir not found: ${SKILLS_DIR}`);
  }

  const parts: string[] = [
    "// 自動生成 — 編集しない。`.claude/skills/*/SKILL.md` を `scripts/bundle-skills.ts` が束ねる。",
    "// 更新: npm run skills:bundle",
    "",
  ];

  const missing: string[] = [];
  for (const slug of TARGETS) {
    const path = resolve(SKILLS_DIR, slug, "SKILL.md");
    if (!existsSync(path)) {
      missing.push(path);
      continue;
    }
    const text = readFileSync(path, "utf-8");
    parts.push(`export const ${constName(slug)} = \`${escape(text)}\`;`);
    parts.push("");
  }

  if (missing.length) {
    throw new Error("missing SKILL.md:\n  " + missing.join("\n  "));
  }

  // Skillメタデータ（slug → 全文）
  parts.push("export const SKILLS: Record<string, string> = {");
  for (const slug of TARGETS) {
    parts.push(`  "${slug}": ${constName(slug)},`);
  }
  parts.push("};");
  parts.push("");

  const out = parts.join("\n");
  writeFileSync(OUT_PATH, out, "utf-8");
  console.log(`wrote ${OUT_PATH} (${TARGETS.length} skills)`);
  const existing = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !TARGETS.includes(n));
  if (existing.length) {
    console.log(`  note: 束ねなかった skill: ${existing.join(", ")} （必要なら scripts/bundle-skills.ts の TARGETS に追加）`);
  }
}

main();
