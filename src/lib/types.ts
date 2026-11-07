export type FudeCard = {
  id: string;
  chiban: string;
  yobina?: string;
  toki_chimoku: string;
  genkyo: string;
  menseki_m2: number | null;
  meigi: string;
  shutoku: string;
  hisouzokunin_shibou: string;
  building: string;
  structures: string[];
  boundary: string;
  others_use: string;
  rights: string;
  cliff: string;
  underground: string;
  forest_care: string;
  disaster: string;
  neighbor_trouble: string;
  recurring_charges: string;
  position?: "confirmed" | "unresolved";
  evidence?: Record<string, { value: string; confidence: number; source: string }>;
  shogen?: string;
};

export const VERDICTS = [
  "申請不可",
  "不承認の可能性が高い",
  "要件上は検討できる",
  "判断に必要な情報が足りない",
] as const;
export type Verdict = (typeof VERDICTS)[number];

export const LANE_FOR_VERDICT: Record<Verdict, "refuse" | "risk" | "wait" | "ok"> = {
  申請不可: "refuse",
  "不承認の可能性が高い": "risk",
  "判断に必要な情報が足りない": "wait",
  "要件上は検討できる": "ok",
};

export type Deadline = { code: "DL_TOUKI" | "DL_NOUCHI_TODOKE" | "DL_SHINRIN_TODOKE"; date?: string };

export type JudgeResult = {
  verdict: Verdict;
  reasons: string[];
  asks: string[];
  deadlines: Deadline[];
  flags: string[];
  text: string;
};

export type GuardDecision = "refuse_and_refer" | "answer" | "rewrite" | "pass";
export type GuardResult = {
  decision: GuardDecision;
  refer_to: string[];
  rewritten?: string;
  reason_tag?: string;
};

export type NextQuestion = {
  code: string;
  prompt: string;
  choices: [string, string];
  for_fude_id: string;
};

export const INTENTS = ["残す", "託す", "譲る", "国に返す", "保留"] as const;
export type Intent = (typeof INTENTS)[number];

export type MemberId = "self" | "ani" | "ane";
export const MEMBERS: Array<{ id: MemberId; label: string }> = [
  { id: "self", label: "あなた" },
  { id: "ani", label: "兄" },
  { id: "ane", label: "姉" },
];

export type IntentVote = {
  member: MemberId;
  fude_id: string;
  intent: Intent;
  at: number;
};

export type IntentResolution =
  | { kind: "pending"; submitted: number; total: number }
  | { kind: "unanimous"; intent: Intent }
  | { kind: "split"; votes: Array<{ member: MemberId; intent: Intent }> };
