# 事前準備：APIキーとアカウント

上から順に。★はハッカソン中に必須。

| # | 必要なもの | 取得先 | 費用 | 用途 |
| --- | --- | --- | --- | --- |
| 1 ★ | Claude API キー（Anthropic 直 API） | console.anthropic.com | 従量課金（Opus/Sonnet/Haiku） | 判定・筆カード・言い換え・評価 |
| 2 ★ | Gemini API キー | Google AI Studio | 音声入力 約$0.005/分、出力 約$0.018/分（2026-10時点の公開価格） | 親との音声会話（Live API） |
| 3 ★ | Jev API キー | TypeSafe AI のコンソール（取得済み） | 入力 $0.042/1Mトークン | 会話中の即時判断、ガード |
| 4 ★ | GitHub の公開リポジトリ | GitHub | 無料 | 提出（OSS 要件の可能性） |
| 5 ★ | Cloudflare アカウント | Cloudflare | 無料枠 | スマホのマイクは HTTPS 必須のため公開URLが要る（Workers + カスタムドメイン） |
| 7 ★ | G空間情報センターのアカウント | G空間情報センター（無料登録） | 無料 | 対象市町村の登記所備付地図XMLをダウンロード |
| 8 | 和歌山県の森林計画情報 | 県の公開サービス（申請不要・注意事項に同意） | 無料 | 林班・小班 Shapefile、市町村別の森林資源 Excel |
| — | e-Gov 法令API v2 | キー不要 | 無料 | 条文の取得と引用の実在確認 |
| — | 地理院タイル（空中写真） | キー不要（出典表示が必要） | 無料 | 背景地図 |
| — | 国土数値情報 A33（土砂災害警戒区域） | キー不要 | 無料 | ハザードの重ね合わせ |
| 任意 | 不動産情報ライブラリ API キー | 国土交通省（申請制） | 無料 | ハザードのベクタ取得。審査に日数がかかる可能性があるため、会期中は A33 で代用 |

使わないもの：Google マップ（キーと利用規約の制約、画面キャプチャも動画に使わない）。

## `.env.local`

`.env.example` をコピーして埋める。キーはコミットしない（`.gitignore` 済み）。Gemini のキーはブラウザに出さず、サーバーで ephemeral token を発行して渡す。

Anthropic 直 API の設定（Claude 呼び出し）
- `ANTHROPIC_API_KEY`：console.anthropic.com で発行
- `CLAUDE_MODEL`：モデル ID（評価と本番は `claude-sonnet-5-5`）。Sonnet 5.5 は `tool_choice` の強制指定が 400 になるため、`auto`＋「必ずツールを呼ぶ」指示で使う
- ローカルは `.env.local` に書く。Cloudflare Workers 上では `wrangler secret put ANTHROPIC_API_KEY` で登録

## Cloudflare 側の設定（Bot 対策）

アクセス制御（Cloudflare Access）は入れない。デモは誰でも開ける。代わりに、
AI 学習クローラーと営業系スクレイパーだけを落とす。

**ダッシュボード側**（`fudekoe.okita.dev` のゾーン）

- Security → Bots → **Bot Fight Mode を ON**（Free プランで無料）
- Security → WAF → Managed rules → Cloudflare Managed Ruleset を有効化
- Security → WAF → Custom rules に以下を追加（必要なら）
  - 式：`(cf.verified_bot) and not (cf.bot_management.verified_bot_category in {"Search Engine Crawler"})`
  - 動作：Block（検索クローラー以外の検証済みボットを拒否）
- 必要に応じて Rate limiting rule（10 req/10s）を `/api/*` に設定

**コード側**（`src/middleware.ts` と `public/robots.txt`）

- UA 一致で GPTBot・ClaudeBot・CCBot・PerplexityBot などを 403 で落とす
- `robots.txt` で同じクローラーを拒否（polite layer）
- ダッシュボード側が落ちても最低限の遮断が残るように二重化

## その他のキー

- `GEMINI_API_KEY`／`GEMINI_LIVE_MODEL`：Google AI Studio で発行。Live のモデルは `gemini-3.8-live` で動作確認済み
- `GEMINI_TTS_MODEL`：デモ動画のナレーション生成だけで使う。Tier 1 は1モデルあたり1日100回まで（17:00 JST に戻る）。足りなければ `gemini-3.8-flash-lite-tts`
- `JEV_API_KEY`：TypeSafe AI。`POST https://api.typesafe.ai/v1/systemone` に質問をその場で書いて送る（事前登録なし）。応答は約0.4秒

## 初日に確かめたこと

- [x] Jev の応答時間：約0.4秒で、会話中の判断に間に合う
- [x] Gemini Live：ブラウザから ephemeral token で接続し、方言の発話を文字に起こせる
- [x] デモの親の声は合成音声（実在人物の声は使わない）
- [ ] 運営に確認：他社API（Gemini・Jev）の利用可否、動画の長さ（提出フォームで確認）
- [ ] 登記所備付地図XML・林班/小班の実データ取り込み（未着手。デモは架空データ）
