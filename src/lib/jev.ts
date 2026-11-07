/**
 * Jev（TypeSafe AI）のラッパー。本番は Jev のクラスファイアに Choice/Noul/Score を
 * 呼び分けるが、鍵が未設定ならヒューリスティックのモックで同じ形を返す。
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
  { name: "沢の上の田んぼ", keywords: ["沢の上", "沢上", "田んぼ", "田"] },
  { name: "栗の木の畑", keywords: ["栗の木", "栗", "畑"] },
  { name: "奥の山", keywords: ["奥の山", "奥山", "奥"] },
  { name: "お宮の下", keywords: ["お宮", "神社"] },
  { name: "川向こう", keywords: ["川向こう", "川の向こう"] },
];

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
  // 実 Jev 呼び出し。クラスファイアの ID は TypeSafe AI 側で登録する想定。
  // ここでは最小の HTTP 呼び出しだけ用意して、失敗したら mock にフォールバック。
  try {
    const resp = await fetch("https://api.jev.ai/v1/classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.JEV_API_KEY}`,
      },
      body: JSON.stringify({
        classifier_id: process.env.JEV_CLASSIFIER_ID || "fudekoe-noul-v1",
        input: text,
        candidates,
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!resp.ok) throw new Error(`jev http ${resp.status}`);
    const data = (await resp.json()) as {
      choice?: string | null;
      noul?: string[];
      score?: number;
    };
    return {
      choice: data.choice ?? null,
      noul: (data.noul ?? []).filter((t): t is JevNoulTag => NOUL_PATTERNS.some((p) => p.tag === t) || t === "fatigue" || t === "offtopic"),
      score: typeof data.score === "number" ? Math.round(data.score) : 20,
      engine: "jev",
    };
  } catch {
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
