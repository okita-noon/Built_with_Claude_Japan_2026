/**
 * デモ用のキャンド発話。Gemini Live の文字起こしに相当する想定で、
 * `chunks` を順に流し（delay_ms は親がその文を話し終えるまでの目安）、各 chunk を Jev タグ付け → Claude 判定にかける。
 */
export type DemoTranscript = {
  id: string;
  title: string;
  yobina: string;      // 想定している呼び名
  chunks: Array<{ text: string; delay_ms?: number }>;
};

export const DEMO_TRANSCRIPTS: DemoTranscript[] = [
  {
    id: "kuri-boundary",
    title: "栗の木の畑：境と小屋の話",
    yobina: "栗の木の畑",
    chunks: [
      { text: "あのな、栗の木のとこの畑やけどな、", delay_ms: 4000 },
      { text: "隣の田中さんとは、昔、栗の木までがうちや、言うてな、", delay_ms: 5200 },
      { text: "見て決めたことがあったよ。", delay_ms: 3500 },
      { text: "小屋かい？壁も屋根もあるで。中に農機具置いてた。", delay_ms: 4900 },
      { text: "崖はないよ。ゆるい斜面で、水はけはええ。", delay_ms: 4400 },
    ],
  },
  {
    id: "sawa-ue-rice",
    title: "沢の上の田んぼ：賦課金と耕作",
    yobina: "沢の上の田んぼ",
    chunks: [
      { text: "沢の上の田んぼはな、" },
      { text: "山本さんが耕作してくれとる。もう十年くらいかな。" },
      { text: "土地改良区の賦課金は毎年払うとるよ。" },
      { text: "ちょっと疲れたな、また今度にしよか。" },
    ],
  },
  {
    id: "oku-yama",
    title: "奥の山：間伐と境",
    yobina: "奥の山",
    chunks: [
      { text: "奥の山は、植えたままで、間伐はやってないわ。" },
      { text: "境はな、ようわからん。昔、親父が言うとっただけで。" },
    ],
  },
];
