import type { FudeCard, JudgeResult, NextQuestion } from "./types.ts";

const QUESTIONS: Record<string, Omit<NextQuestion, "for_fude_id">> = {
  Q_BOUNDARY: {
    code: "Q_BOUNDARY",
    prompt: "お隣とは、どこまでがうちの土地って、言い合ったことある？",
    choices: ["隣と見て決めたことがある", "見たことはない"],
  },
  Q_BUILDING: {
    code: "Q_BUILDING",
    prompt: "そこに、屋根と壁のある小屋はある？",
    choices: ["屋根も壁もある", "屋根か壁しかない／無い"],
  },
  Q_USE_BY_OTHERS: {
    code: "Q_USE_BY_OTHERS",
    prompt: "だれか、そこを使わせてる人はおる？",
    choices: ["ずっと使ってる人がおる", "誰も使ってない"],
  },
  Q_SECURITY: {
    code: "Q_SECURITY",
    prompt: "お父さん、そこで銀行とかから借り入れしてた？",
    choices: ["していた覚えがある", "していないと思う"],
  },
  Q_FOREST_CARE: {
    code: "Q_FOREST_CARE",
    prompt: "山、ここ10年のうちに、間伐してもらったことある？",
    choices: ["やってもろたことがある", "やってない"],
  },
  Q_CLIFF: {
    code: "Q_CLIFF",
    prompt: "そこ、急な崖はある？",
    choices: ["崖がある", "崖はない"],
  },
  Q_UNDERGROUND: {
    code: "Q_UNDERGROUND",
    prompt: "そこに、昔なにか埋めたことはある？",
    choices: ["埋めた覚えがある", "ない"],
  },
  Q_HEIRS: {
    code: "Q_HEIRS",
    prompt: "お父さんの兄弟は、みんなもう亡くなっとる？",
    choices: ["みんな亡くなった", "まだ生きとる人がおる"],
  },
  Q_ACQUISITION: {
    code: "Q_ACQUISITION",
    prompt: "この土地は、お父さんがだれかから買ったもの？",
    choices: ["買ったもの", "もらったか相続した"],
  },
  Q_DEBT: {
    code: "Q_DEBT",
    prompt: "そこで、毎年のお金（土地改良区の賦課金など）払っとる？",
    choices: ["払っとる", "払っとらん"],
  },
};

export function pickNextQuestion(card: FudeCard, j: JudgeResult): NextQuestion | null {
  if (!j.asks.length) return null;
  const q = QUESTIONS[j.asks[0]];
  if (!q) return null;
  return { ...q, for_fude_id: card.id };
}

export const ALL_QUESTIONS = QUESTIONS;
