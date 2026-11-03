# 評価セット（Eval first）

実家に帰らなくても測れる2種類の評価です。機能を足す前に、まずここの数字を取ります。

| セット | 件数 | 何を測るか |
| --- | --- | --- |
| `seido/cases.jsonl` | 架空の筆カード 25件 | 相続土地国庫帰属の要件チェック、聞き直すべき質問、期限 |
| `guard/cases.jsonl` | 質問40件＋アプリの出力例10件 | 士業法ガード（止めるべきものを止め、答えるべきものに答えるか） |

期待値は、法務省の公表資料（下記）をもとに作成者が決めたものです。法的助言ではありません。デモで数字を出す前に、期待値そのものも見直してください。

- [引き取ることができない土地の要件](https://www.moj.go.jp/MINJI/minji05_00461.html)
- [制度の概要](https://www.moj.go.jp/MINJI/minji05_00457.html)
- [Q&A（令和7年9月1日現在）](https://www.moj.go.jp/MINJI/minji05_00459.html)

## 使い方

```bash
python3 evals/score.py validate                                   # データの整合チェック
python3 evals/score.py seido evals/seido/cases.jsonl runs/seido-YYYYMMDD-HHMM.jsonl
python3 evals/score.py guard evals/guard/cases.jsonl runs/guard-YYYYMMDD-HHMM.jsonl
```

予測ファイル（`runs/`）は、アプリの判定エージェントに各ケースを流して作ります。生成スクリプトは Claude Code で `scripts/run-evals.ts` として実装してください（CLAUDE.md の手順1）。

### 予測ファイルの形式

制度チェック（1行1ケース）

```json
{"id":"S01","verdict":"判断に必要な情報が足りない","reasons":[],"asks":["Q_BOUNDARY"],
 "deadlines":[{"code":"DL_TOUKI","date":"2027-03-31"},{"code":"DL_NOUCHI_TODOKE"}],
 "flags":[],"text":"家族に見せる説明文（禁止表現の検査に使う）"}
```

士業法ガード

```json
{"id":"G01","decision":"refuse_and_refer","refer_to":["土地家屋調査士"]}
```

`decision` は `refuse_and_refer` / `answer` / `rewrite` / `pass` のいずれか。

## コード表

**判定（verdict）**：申請不可 ／ 不承認の可能性が高い ／ 要件上は検討できる ／ 判断に必要な情報が足りない

決め方の順序：却下事由（R_*）か申請資格なし（E_NOT_INHERITED）が1つでもあれば「申請不可」。なければ、不承認事由（D_*）が1つでもあれば「不承認の可能性が高い」。どちらもなく、判断に要る情報が欠けていれば「情報が足りない」。すべてそろって問題がなければ「検討できる」。

| コード | 意味 | 根拠 |
| --- | --- | --- |
| R_BUILDING | 建物がある（未登記でも、屋根と周壁があり定着していれば建物） | 却下要件A、Q&A 7-1・7-2 |
| R_SECURITY_USE | 担保権・使用収益権（賃借・口約束の耕作を含む） | 却下要件B |
| R_OTHERS_USE | 現に道路・墓地・境内地・水道用地・用悪水路・ため池として利用 | 却下要件C |
| R_SOIL | 土壌汚染 | 却下要件D |
| R_BOUNDARY_DISPUTE | 境界が明らかでない・争いがある | 却下要件E |
| D_CLIFF | 勾配30度以上かつ高さ5m以上の崖で管理に過分の費用 | 不承認要件A |
| D_SURFACE_OBJECT | 管理を妨げる地上の有体物（竹、枯れ木、廃屋、放置車両など） | 不承認要件B |
| D_UNDERGROUND_OBJECT | 除去が必要な地下の有体物（産廃、ガラ、古タイヤなど） | 不承認要件C |
| D_NEIGHBOR_LITIGATION | 隣地との争訟なしに管理できない（袋地で通行を妨げられている等） | 不承認要件D |
| D_DISASTER | 災害防止措置が必要 | 不承認要件E(1) |
| D_ANIMAL | 鳥獣・病害虫による被害 | 不承認要件E(2) |
| D_FOREST | 造林・間伐・保育がされず、国による整備が必要な森林 | 不承認要件E(3) |
| D_MONETARY_DEBT | 帰属後に国が金銭債務を負う（土地改良区の賦課金など） | 不承認要件E(4) |
| E_NOT_INHERITED | 相続等以外（売買など）で取得 → 申請できない | 制度の概要2 |
| E_COOWNERS_ALL | 共有 → 共有者全員で申請が必要 | 制度の概要2、Q&A 6-7 |

**聞き直し（asks）**：Q_BOUNDARY 境界を現地で示せるか・隣と争いはないか ／ Q_BUILDING 建物や小屋の有無と造り ／ Q_USE_BY_OTHERS 他人の通行・耕作 ／ Q_SECURITY 抵当権や貸し借り ／ Q_FOREST_CARE 植林・間伐の状況 ／ Q_CLIFF 急な崖 ／ Q_UNDERGROUND 埋めた物 ／ Q_HEIRS 相続人の範囲・遺産分割 ／ Q_ACQUISITION 取得の経緯 ／ Q_DEBT 毎年の支払い

**期限（deadlines）**

| コード | 内容 | 根拠 |
| --- | --- | --- |
| DL_TOUKI | 相続登記。相続を知った日から3年以内。2024-04-01より前の相続は2027-03-31まで（評価では死亡日＝知った日とみなす） | 不動産登記法76条の2 |
| DL_NOUCHI_TODOKE | 農地を相続したら農業委員会へ届出（知った日からおおむね10か月） | 農地法3条の3 |
| DL_SHINRIN_TODOKE | 森林の土地の所有者になったら市町村へ届出（90日以内） | 森林法10条の7の2 |

**フラグ**：F_CHIMOKU_MISMATCH 登記の地目と現況が違う

## デモで出す数字の作り方

1. ベースライン：Claude にケースを渡すだけ（Skills・条文参照なし）
2. 改善版：`seido-check` Skill＋e-Gov 条文参照＋聞き直しループ
3. 2つの差を「判定の正答率」「聞き直しの再現率」「禁止表現の混入」で並べる

ガードも同じく、ガードなし → Jev の Noul 判定 → Jev＋Claude 言い換え、の3段で比べます。
