/**
 * Jev（TypeSafe AI）のラッパー。POST https://api.typesafe.ai/v1/systemone に
 * Choice / Noul / Score の質問を1リクエストでまとめて送る（質問は並列に評価される）。
 * 鍵が未設定・失敗時はヒューリスティックのモックで同じ形を返す。
 *
 * - Choice: この発話はどの呼び名の話か（候補のうち1つ、または null）
 * - Noul: この発話に含まれる「要件に関わる事実」のタグ配列
 * - Score: 親の疲れを 0〜100 で推定（高いほど疲れている）
 */

export type JevNoulTag =
  | "building_yes"
  | "building_no"
  | "boundary_witness"
  | "boundary_known"
  | "boundary_dispute"
  | "cliff_yes"
  | "cliff_no"
  | "underground_yes"
  | "underground_no"
  | "others_use_yes"
  | "others_use_no"
  | "forest_care_yes"
  | "forest_care_no"
  | "debt_yes"
  | "debt_no"
  | "fatigue"
  | "offtopic";

export type JevTagResult = {
  choice: string | null;        // 呼び名（候補から）
  noul: JevNoulTag[];
  score: number;                 // 0〜100 の疲れスコア
  engine: "jev" | "mock";
};

const NOUL_PATTERNS: Array<{ re: RegExp; tag: JevNoulTag }> = [
  { re: /(小屋|物置|倉庫|納屋).*(壁|屋根|ちゃんと|建って|ある)/, tag: "building_yes" },
  { re: /(崩れ|壊れ|倒れ).*(小屋|倉庫|納屋)/, tag: "building_no" },
  { re: /(境).*(栗の木|杭|石|標).*/, tag: "boundary_witness" },
  { re: /(隣).*(見て決め|言い合|確認)/, tag: "boundary_known" },
  { re: /(争|もめ|揉め|言い争|裁判)/, tag: "boundary_dispute" },
  { re: /(崖|がけ|急な斜面)/, tag: "cliff_yes" },
  { re: /崖.*(ない|無い|ないと)/, tag: "cliff_no" },
  { re: /(埋め|埋設|埋めた|埋けた)/, tag: "underground_yes" },
  { re: /(貸し|使わせ|耕作).*(ずっと|長年|他|おる)/, tag: "others_use_yes" },
  { re: /(間伐|手入れ).*(してもろ|やってもろ|した|やった|もらった)/, tag: "forest_care_yes" },
  { re: /(間伐|手入れ).*(してない|やってない|してへん)/, tag: "forest_care_no" },
  { re: /(改良区|賦課|毎年の)/, tag: "debt_yes" },
  { re: /(疲れ|しんどい|ようわから|もうええ|また今度)/, tag: "fatigue" },
];

const YOBINA_HINTS = [
  { name: "栗の木の畑", keywords: ["栗の木", "栗"] },
  { name: "うえの畑", keywords: ["うえの畑", "上の畑"] },
  { name: "家のとこ", keywords: ["家のとこ", "母屋", "家の"] },
  { name: "うらやま", keywords: ["うらやま", "裏山"] },
  { name: "佐藤さんの田", keywords: ["佐藤さん"] },
  { name: "みなみ山", keywords: ["みなみ山", "南の山"] },
  { name: "川ばたの畑", keywords: ["川ばた", "川端"] },
  { name: "ひがし山", keywords: ["ひがし山", "東の山"] },
  { name: "したの田", keywords: ["したの田", "下の田"] },
  { name: "おくの畑", keywords: ["おくの畑", "奥の畑"] },
];

/** Noul の各タグを、Jev に渡す「はい／いいえ」の問いにしたもの */
const NOUL_QUESTIONS: Record<Exclude<JevNoulTag, "fatigue" | "offtopic">, string> = {
  building_yes: "屋根と壁のある小屋・倉庫・納屋などの建物が、その土地にあると言っているか",
  building_no: "その土地に建物はない、または崩れてしまったと言っているか",
  boundary_witness: "境界の目印（木・杭・石など）を、本人の記憶として語っているか",
  boundary_known: "隣の人と一緒に境界を見て決めた・確認したと言っているか",
  boundary_dispute: "隣の人と境界でもめた・争ったことがあると言っているか",
  cliff_yes: "その土地に急な崖があると言っているか",
  cliff_no: "その土地に崖はないと言っているか",
  underground_yes: "その土地に何かを埋めたことがあると言っているか",
  underground_no: "その土地に何も埋めていないと言っているか",
  others_use_yes: "他の人がその土地を使っている（耕作・通路・貸している）と言っているか",
  others_use_no: "誰もその土地を使っていない・貸していないと言っているか",
  forest_care_yes: "その山の間伐や手入れをした・してもらったと言っているか",
  forest_care_no: "その山の間伐や手入れはしていないと言っているか",
  debt_yes: "その土地のために毎年お金（土地改良区の賦課金など）を払っていると言っているか",
  debt_no: "その土地に毎年払うお金はないと言っているか",
};

const FATIGUE_LEVELS = [
  "元気に、具体的に話している",
  "普通に話している",
  "少し言葉に詰まる・答えが短くなっている",
  "疲れた様子がある・話を切り上げたがっている",
  "はっきり疲れた・もうやめたいと言っている",
];

async function callJev(text: string, candidates: string[]): Promise<JevTagResult> {
  const questions: Record<string, unknown> = {
    place: {
      type: "choice",
      instructions: "この発話は、どの土地（呼び名）の話をしているか",
      criteria: Object.fromEntries(candidates.map((c) => [c, null])),
    },
    mentions_place: { type: "noul", instructions: "この発話は、特定の土地の呼び名や場所に触れているか" },
    fatigue: { type: "score", instructions: "話し手（70代の親）の疲れ具合", criteria: FATIGUE_LEVELS },
  };
  for (const [tag, q] of Object.entries(NOUL_QUESTIONS)) questions[tag] = { type: "noul", instructions: q };

  const resp = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.JEV_API_KEY}` },
    body: JSON.stringify({ model: process.env.JEV_MODEL || "jev-latest", state: text, questions }),
    signal: AbortSignal.timeout(4000),
  });
  if (!resp.ok) throw new Error(`jev http ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = (await resp.json()) as { answers: Record<string, any> };
  const a = data.answers;
  // Noul は P(yes)。0.7 以上だけ採る（中間は聞き直しに回す）
  const noul = (Object.keys(NOUL_QUESTIONS) as JevNoulTag[]).filter((t) => (a[t]?.noul ?? 0) >= 0.7);
  const fatigue = a.fatigue?.score ?? 1;
  const score = Math.round((fatigue / (FATIGUE_LEVELS.length - 1)) * 100);
  if (score >= 70) noul.push("fatigue");
  // 呼び名は、場所に触れていて、かつ確信が高いときだけ。外れると別の筆を書き換えてしまうため
  const choice = (a.mentions_place?.noul ?? 0) >= 0.7 && (a.place?.confidence ?? 0) >= 0.6 ? String(a.place.choice) : null;
  return { choice, noul, score, engine: "jev" };
}

function mockTag(text: string, candidates?: string[]): JevTagResult {
  const noul: JevNoulTag[] = [];
  for (const { re, tag } of NOUL_PATTERNS) {
    if (re.test(text) && !noul.includes(tag)) noul.push(tag);
  }

  // Choice：候補が渡ってきたらそれ優先、無ければ全体から推定
  const pool = candidates && candidates.length ? YOBINA_HINTS.filter((y) => candidates.includes(y.name)) : YOBINA_HINTS;
  let choice: string | null = null;
  for (const y of pool) {
    if (y.keywords.some((kw) => text.includes(kw))) {
      choice = y.name;
      break;
    }
  }

  // 疲れスコア：発話長が短い・「もうええ」等が入ると上がる
  let score = 20;
  if (noul.includes("fatigue")) score += 50;
  if (text.length < 10) score += 10;
  if (/また今度|もうええ|ちょっと休/.test(text)) score += 20;
  score = Math.min(100, score);

  return { choice, noul, score, engine: "mock" };
}

export function isJevConfigured(): boolean {
  return Boolean(process.env.JEV_API_KEY);
}

export async function tagTranscript(
  text: string,
  candidates?: string[]
): Promise<JevTagResult> {
  if (!isJevConfigured()) {
    return mockTag(text, candidates);
  }
  try {
    const pool = candidates && candidates.length ? candidates : YOBINA_HINTS.map((y) => y.name);
    return await callJev(text, pool);
  } catch (e) {
    console.warn("[jev] fallback to mock:", e instanceof Error ? e.message : e);
    return mockTag(text, candidates);
  }
}

/**
 * Noul タグ → FudeCard の項目パッチ。
 * 家族の画面で active card に当てるためのヒント。
 */
export function nouToFudePatch(tags: JevNoulTag[]): Partial<Record<string, string>> {
  const patch: Partial<Record<string, string>> = {};
  for (const t of tags) {
    switch (t) {
      case "building_yes": patch.building = "有（屋根と壁あり・親の証言）"; break;
      case "building_no": patch.building = "無"; break;
      case "boundary_witness": patch.boundary = "親の証言のみ（栗の木まで）"; break;
      case "boundary_known": patch.boundary = "隣地と確認済（親の証言）"; break;
      case "boundary_dispute": patch.boundary = "争いあり"; break;
      case "cliff_yes": patch.cliff = "有（親の証言・高さ不明）"; break;
      case "cliff_no": patch.cliff = "無"; break;
      case "underground_yes": patch.underground = "有（埋めた覚え・親の証言）"; break;
      case "underground_no": patch.underground = "無"; break;
      case "others_use_yes": patch.others_use = "有（口約束で耕作・親の証言）"; break;
      case "others_use_no": patch.others_use = "無"; break;
      case "forest_care_yes": patch.forest_care = "一通り手入れされている（親の証言）"; break;
      case "forest_care_no": patch.forest_care = "植林後に間伐されていない"; break;
      case "debt_yes": patch.recurring_charges = "有（土地改良区の賦課金）"; break;
      case "debt_no": patch.recurring_charges = "無"; break;
    }
  }
  return patch;
}
