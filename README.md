# 筆のこえ（仮称）

離れて暮らす家族が、高齢の親の記憶から土地を一筆ずつ棚卸しし、残す・託す・譲るを決めて窓口へつなぐアプリ。Built with Claude Code: Japan 2026 の作品。

## 動かし方（モックで）

API（Claude／Gemini／Jev）はまだ未接続。モックデータとルールベースの判定で画面を動かせます。

```bash
npm install
npm run dev   # http://localhost:3100
```

主な画面：

- `/` 子のオンボーディング（町名 → 課税明細書 → 筆一覧）
- `/family` 家族の画面（地図＋判定レーン＋筆カード＋聞き直しループ）
- `/parent` 親の画面（写真1枚＋話すボタン＋二択の質問1問）
- `/counter` 窓口の画面（林務／農業委員会／司法書士、CSV）

## 評価と QA

```bash
python3 evals/score.py validate                              # eval データの整合
npm run evals -- seido --mock --label mock-rules            # API を叩かずルールだけで予測
npm run evals -- guard --mock --label mock-rules
python3 evals/score.py seido evals/seido/cases.jsonl runs/seido-<...>.jsonl
python3 evals/score.py guard evals/guard/cases.jsonl runs/guard-<...>.jsonl

npm run typecheck
npm run build
npm run qa                                                   # Playwright でスクショ（別シェルで dev 起動必須）
```

Anthropic 直 API の Claude に接続するときは `--mock` を外し、`.env.local` に `ANTHROPIC_API_KEY`／`CLAUDE_MODEL` を入れる。手順は `docs/setup.md`。

## 入っているもの

| パス | 中身 |
| --- | --- |
| `CLAUDE.md` | 目的・原則・役割分担・手順・日程・デモ構成 |
| `src/app/` | Next.js の各画面（`/`、`/family`、`/parent`、`/counter`） |
| `src/app/api/` | モック Route Handler（`/api/demo`・`judge`・`next-question`・`guard`・`ocr`） |
| `src/lib/judge.ts` | 制度チェックのルール（Skill に沿った実装・eval の `--mock` でも共有） |
| `src/lib/guard.ts` | 士業法ガードのルール |
| `src/components/` | BrandMark・BrushGlyph・MapView・JudgmentLanes・FudeCard・DeadlineBar |
| `data/demo/` | 和歌山架空集落「大字 栗原」の筆10件・GeoJSON・親の証言・OCR モック |
| `evals/` | 制度チェック25件、士業法ガード50件、採点スクリプト、筆カードのスキーマ |
| `.claude/skills/` | seido-check、shigyo-guard、fude-card、design-system（本番のプロンプトにも読み込む） |
| `.claude/agents/` | eval-runner、legal-reviewer、map-data |
| `.claude/settings.json` | 編集時フック（評価データの整合、禁止表現の検査） |
| `docs/` | セットアップ、画面仕様、評価ログ、進捗、スクショ |

## 注意

法的助言を行うアプリではありません。書類作成・境界の確定・遺産分割の助言・税額計算は専門家へつなぎます。評価セットの期待値は法務省の公表資料をもとに作成したもので、正確性は利用前に確認してください。
