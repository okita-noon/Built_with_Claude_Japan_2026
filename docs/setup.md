# 事前準備：APIキーとアカウント

上から順に。★はハッカソン中に必須。

| # | 必要なもの | 取得先 | 費用 | 用途 |
| --- | --- | --- | --- | --- |
| 1 ★ | Claude API キー（Anthropic 直 API） | console.anthropic.com | 従量課金（Opus/Sonnet/Haiku） | 判定・筆カード・言い換え・評価 |
| 2 ★ | Gemini API キー | Google AI Studio | 音声入力 約$0.005/分、出力 約$0.018/分（2026-10時点の公開価格） | 親との音声会話（Live API） |
| 3 ★ | Jev API キー | TypeSafe AI のコンソール（取得済み） | 入力 $0.042/1Mトークン | 会話中の即時判断、ガード |
| 4 ★ | GitHub の公開リポジトリ | GitHub | 無料 | 提出（OSS 要件の可能性） |
| 5 ★ | Cloudflare アカウント | Cloudflare | 無料枠 | スマホのマイクは HTTPS 必須のため公開URLが要る（Workers + カスタムドメイン） |
| 6 | Neon Postgres | Vercel Marketplace から追加 | 無料枠 | 家族で共有する筆カードの保存（ローカルは SQLite でよい） |
| 7 ★ | G空間情報センターのアカウント | G空間情報センター（無料登録） | 無料 | 日高町の登記所備付地図XMLをダウンロード |
| 8 | 和歌山県の森林計画情報 | 県の公開サービス（申請不要・注意事項に同意） | 無料 | 林班・小班 Shapefile、日高町の森林資源 Excel |
| — | e-Gov 法令API v2 | キー不要 | 無料 | 条文の取得と引用の実在確認 |
| — | 地理院タイル（空中写真） | キー不要（出典表示が必要） | 無料 | 背景地図 |
| — | 国土数値情報 A33（土砂災害警戒区域） | キー不要 | 無料 | ハザードの重ね合わせ |
| 任意 | 不動産情報ライブラリ API キー | 国土交通省（申請制） | 無料 | ハザードのベクタ取得。審査に日数がかかる可能性があるため、会期中は A33 で代用 |

使わないもの：Google マップ（キーと利用規約の制約、画面キャプチャも動画に使わない）。

## `.env.local`

`.env.example` をコピーして埋める。キーはコミットしない（`.gitignore` 済み）。Gemini のキーはブラウザに出さず、サーバーで ephemeral token を発行して渡す。

Anthropic 直 API の設定（Claude 呼び出し）
- `ANTHROPIC_API_KEY`：console.anthropic.com で発行
- `CLAUDE_MODEL`：モデル ID（例：`claude-opus-4-7`, `claude-sonnet-4-6`）
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

## 初日に確かめること

- [ ] 運営に確認：他社API（Gemini・Jev）の利用可否、既存コードの扱い、OSS の範囲、動画の長さ
- [ ] 日高町の地図XMLの座標系（公共座標系か任意座標系か）。`map-data` サブエージェントに割合を出させる
- [ ] 親の声で Gemini Live を試す：方言の聞き取り、応答の遅さ、言語指定が効くか
- [ ] Jev の応答時間を実測（会話中の判断に間に合うか）
- [ ] 親に、声の利用（デモ動画）について同意を取るか、再現音声にするか決める
