/**
 * デモ動画（3分以内）の台本。ナレーションと画面の対応表。
 *
 * - narration はナレーター（Gemini TTS）が読む文。
 * - visual は scripts/video/record.ts が撮る画面の種類。
 * - 文言は shigyo-guard の線引きに従う（承認・却下の断定をしない）。
 *
 * 採点の配分（参加者まとめ・非公式）：インパクト30／デモ25／Claudeの活用25／深さと実行力20。
 * 課題（インパクト）を厚めに、動く様子を中心に。
 */

export type Scene = {
  id: string;
  visual:
    | { kind: "card"; lines: string[]; sub?: string; big?: string }
    | { kind: "app"; flow: "ocr" | "live" | "ask" | "family-counter" }
    | { kind: "evals" }
    | { kind: "guard" }
    | { kind: "arch" };
  narration: string;
};

export const NARRATOR_VOICE = "Kore";
// 読み方の指示文を本文の前に付けると、指示文ごと読み上げられる（3.8-flash-tts で確認）。声の選択だけで調整する
export const NARRATOR_STYLE = "";
export const PARENT_VOICE = "Leda";
export const PARENT_STYLE = "";

export const SCENES: Scene[] = [
  {
    id: "01-problem",
    visual: { kind: "card", lines: ["実家の山と畑。", "どこからどこまでが、うちの土地か。"], sub: "知っているのは、70代の親の記憶だけ。" },
    narration:
      "実家の山と畑。どこからどこまでが、うちの土地か。知っているのは、70代の親の記憶だけ。そんな家族が増えています。",
  },
  {
    id: "02-scale",
    visual: {
      kind: "card",
      big: "約2割",
      lines: ["登記簿で、持ち主が", "すぐ分からない土地。"],
      sub: "地籍調査（2016年度）。全国では九州より広いと推計（所有者不明土地問題研究会）。<br>相続登記は2024年4月1日から義務。それより前の相続も、原則 2027年3月31日まで。",
    },
    narration:
      "登記簿だけでは持ち主がすぐに分からない土地は、およそ2割。2024年から相続登記は義務になり、それより前の相続も、原則2027年3月末が期限です。",
  },
  {
    id: "03-kokko",
    visual: {
      kind: "card",
      lines: ["相続した土地を、国に引き取ってもらう制度がある。", "でも――"],
      sub: "境界が分からない／建物が残っている／整備が必要な森林　→　引き取ってもらえないことがある",
    },
    narration:
      "相続した土地を、国に引き取ってもらう制度もあります。でも、境界が分からない、小屋が残っている、手入れが必要な山は、引き取ってもらえないことがあります。",
  },
  {
    id: "04-gap",
    visual: {
      kind: "card",
      lines: ["境界はどこ？　小屋はある？", "答えは、親の記憶の中にしかない。"],
      sub: "子は何を聞けばいいか分からない。親はスマホが苦手。記憶は年々薄れていく。",
    },
    narration:
      "手続きには、境界はどこか、小屋はあるか、といった親の証言が欠かせません。でも、子は何を聞けばいいか分からず、親の記憶は年々薄れていきます。",
  },
  {
    id: "05-solution",
    visual: { kind: "card", big: "筆のこえ", lines: ["この課題を解くためのアプリ。"], sub: "<b>筆（ひつ）</b>＝登記で土地を数える単位。一筆ごとに、親の話から必要な証言を集める。<br>親は話すだけ。操作はビデオ通話で隣にいる子が担う。" },
    narration:
      "この課題を解くためのアプリが、ふでのこえです。登記では、土地を、いっぴつ、にひつ、と数えます。親は話すだけ。操作は隣の子が担います。",
  },
  {
    id: "06-ocr",
    visual: { kind: "app", flow: "ocr" },
    narration: "まず、課税明細書を撮ると、土地がいっぴつずつ並びます。",
  },
  {
    id: "07-live",
    visual: { kind: "app", flow: "live" },
    narration:
      "親の画面は、話すボタンと写真だけ。話した言葉は文字になって、家族の画面に届きます。",
  },
  {
    id: "08-live-result",
    visual: { kind: "app", flow: "live" },
    narration:
      "小屋に壁と屋根がある、という一言から、Claude は建物の可能性に気づき、この畑を、国に返すのが難しい列へ移しました。",
  },
  {
    id: "09-ask",
    visual: { kind: "app", flow: "ask" },
    narration: "足りない証言は、Claude が二択の質問にします。子が、親の画面に読み上げます。",
  },
  {
    id: "09b-ask",
    visual: { kind: "app", flow: "ask" },
    narration: "答えると、確認が必要な10項目のマスが埋まり、次の質問へ進みます。",
  },
  {
    id: "10-family-counter",
    visual: { kind: "app", flow: "family-counter" },
    narration:
      "家族は、残すか、託すか、譲るかを、それぞれ非公開で選びます。窓口には、一覧と、持っていく物のリストを渡します。",
  },
  {
    id: "11-arch",
    visual: { kind: "arch" },
    narration:
      "判定と次の質問は Claude がつくります。制度のルールは Skills にまとめ、開発と本番で同じものを使います。",
  },
  {
    id: "12-evals",
    visual: { kind: "evals" },
    narration:
      "アプリの効き目も測りました。AI が演じる親と子で8問ずつ聞き取ると、必要な項目を聞き出せた割合は、アプリなしの49パーセントから70パーセントへ。Skills で判定は100パーセント、士業ガードの止めすぎはゼロです。",
  },
  {
    id: "13-guard",
    visual: { kind: "guard" },
    narration:
      "境界の断定や書類の作成は、士業の仕事です。アプリは相談先と持っていく物に言い換え、最終判断は法務局と添えます。",
  },
  {
    id: "14-close",
    visual: { kind: "card", big: "筆のこえ", lines: ["親の記憶があるうちに、聞き切る。"], sub: "山の値段や担い手不足は、このアプリの範囲外です。表示は参考情報で、最終判断は法務局・専門家へ。" },
    narration:
      "解くのは、親の記憶があるうちに、必要な証言を聞き切ること。次の相続で、持ち主の分からない土地をつくらないために。",
  },
];

/**
 * 07 のデモで親が話す言葉。収録では、この音声を親の画面のマイク入力として
 * Gemini Live に流し込み、文字起こし以降はアプリの実処理で動かす。
 */
export const PARENT_LINES = [
  "あのな、栗の木のとこの畑やけどな。",
  "隣の田中さんとは昔、栗の木までがうちやって、見て決めたことがあったよ。",
  "小屋かい？壁も屋根もあるで。中に農機具置いてたわ。",
];

/** 09 の聞き直し：親の端末が読み上げる質問と、親の答え */
export const ASK_DEVICE_VOICE = "Aoede";
/** Claude がどちらを先に聞くかは毎回変わるので、両方の音声を用意する */
export const ASKS = [
  { key: "use", question: "だれか、そこを使わせてる人はおる？", answer: "おらんおらん。だれにも貸してへんよ。", choice: "誰も使ってない" },
  { key: "security", question: "お父さん、そこで銀行とかから借り入れしてた？", answer: "借金なんか、したことあらへんよ。", choice: "していないと思う" },
  { key: "boundary", question: "お隣とは、どこまでがうちの土地って、言い合ったことある？", answer: "見たことは、ないなあ。", choice: "見たことはない" },
] as const;
