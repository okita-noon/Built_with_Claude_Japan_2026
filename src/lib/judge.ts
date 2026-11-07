import type { FudeCard, JudgeResult, Deadline, Verdict } from "./types.ts";

const UNKNOWN = /^(不明|)$/;

function has(s: unknown, re: RegExp): boolean {
  return typeof s === "string" && re.test(s);
}
function missing(s: unknown): boolean {
  return typeof s !== "string" || UNKNOWN.test(s.trim());
}

export function judge(card: FudeCard, today = new Date("2026-11-04")): JudgeResult {
  const reasons: string[] = [];
  const asks: string[] = [];
  const flags: string[] = [];

  // 却下 R_*
  if (has(card.building, /有/) && !/物置|簡易/.test(card.building)) reasons.push("R_BUILDING");
  else if (missing(card.building)) asks.push("Q_BUILDING");

  if (has(card.others_use, /有/)) reasons.push("R_SECURITY_USE");
  else if (missing(card.others_use)) asks.push("Q_USE_BY_OTHERS");

  if (has(card.rights, /有|抵当/)) reasons.push("R_SECURITY_USE");
  else if (missing(card.rights)) asks.push("Q_SECURITY");

  if (has(card.boundary, /争|もめ|係争/)) reasons.push("R_BOUNDARY_DISPUTE");
  else if (has(card.boundary, /証言のみ|口伝え/) || missing(card.boundary)) asks.push("Q_BOUNDARY");

  // 不承認 D_*
  if (has(card.cliff, /有/)) reasons.push("D_CLIFF");
  else if (missing(card.cliff)) asks.push("Q_CLIFF");

  if (has(card.underground, /有|埋/)) reasons.push("D_UNDERGROUND_OBJECT");
  else if (missing(card.underground)) asks.push("Q_UNDERGROUND");

  if (has(card.forest_care, /間伐されていない|放置|されていない/)) reasons.push("D_FOREST");
  else if (card.toki_chimoku === "山林" && missing(card.forest_care)) asks.push("Q_FOREST_CARE");

  if (has(card.disaster, /警戒|危険|土砂災害/) && !has(card.disaster, /外/)) reasons.push("D_DISASTER");

  if (has(card.recurring_charges, /有|賦課|改良区/)) reasons.push("D_MONETARY_DEBT");
  else if (missing(card.recurring_charges)) asks.push("Q_DEBT");

  // 地目ずれ
  if (card.toki_chimoku && card.genkyo) {
    const tk = card.toki_chimoku;
    const gk = card.genkyo;
    if ((tk === "畑" && /竹林|山林|宅地/.test(gk)) ||
        (tk === "田" && /山林|宅地/.test(gk)) ||
        (tk === "山林" && /宅地/.test(gk))) {
      flags.push("F_CHIMOKU_MISMATCH");
    }
  }

  // verdict の決定
  const hasR = reasons.some((r) => r.startsWith("R_") || r === "E_NOT_INHERITED");
  const hasD = reasons.some((r) => r.startsWith("D_"));
  let verdict: Verdict;
  if (hasR) verdict = "申請不可";
  else if (hasD) verdict = "不承認の可能性が高い";
  else if (asks.length) verdict = "判断に必要な情報が足りない";
  else verdict = "要件上は検討できる";

  // 期限
  const deadlines: Deadline[] = [{ code: "DL_TOUKI", date: "2027-03-31" }];
  if (/田|畑/.test(card.toki_chimoku)) deadlines.push({ code: "DL_NOUCHI_TODOKE" });
  if (/山林/.test(card.toki_chimoku)) deadlines.push({ code: "DL_SHINRIN_TODOKE" });

  const text = buildText(verdict, reasons, asks, card);
  return { verdict, reasons, asks, deadlines, flags, text };
}

function buildText(v: Verdict, rs: string[], as: string[], c: FudeCard): string {
  const name = c.yobina || c.chiban;
  if (v === "申請不可") {
    const why = rs.map(reasonHuman).join("、");
    return `${name}は、${why}のため、相続土地国庫帰属の対象外になる可能性が高い。最終判断は法務局の審査。`;
  }
  if (v === "不承認の可能性が高い") {
    const why = rs.map(reasonHuman).join("、");
    return `${name}は、${why}のため、不承認になる可能性がある。他の選択肢（農地バンク・森林経営管理制度・保留）も並べて考える。`;
  }
  if (v === "判断に必要な情報が足りない") {
    const q = as.slice(0, 2).map(askHuman).join("、");
    return `${name}は、${q}が分かれば判定できる。親に聞き直す。`;
  }
  return `${name}は、要件のうち確認できた項目では問題は見当たらない。最終判断は法務局の審査。`;
}

function reasonHuman(code: string): string {
  const map: Record<string, string> = {
    R_BUILDING: "建物がある",
    R_SECURITY_USE: "他人の使用や貸し借りが残っている",
    R_OTHERS_USE: "現に道・墓地などに使われている",
    R_SOIL: "土壌汚染がある",
    R_BOUNDARY_DISPUTE: "境界で争いがある",
    D_CLIFF: "急な崖がある",
    D_SURFACE_OBJECT: "地上に管理を妨げる物がある",
    D_UNDERGROUND_OBJECT: "地下に除去が必要な物がある",
    D_NEIGHBOR_LITIGATION: "隣地との争訟なしに管理できない",
    D_DISASTER: "災害防止措置が必要な区域",
    D_ANIMAL: "鳥獣・病害虫の被害",
    D_FOREST: "手入れされていない人工林",
    D_MONETARY_DEBT: "毎年の金銭負担がある",
    E_NOT_INHERITED: "相続以外で取得した",
    E_COOWNERS_ALL: "共有者全員の申請が必要",
  };
  return map[code] || code;
}

function askHuman(code: string): string {
  const map: Record<string, string> = {
    Q_BOUNDARY: "境界を現地で示せるか",
    Q_BUILDING: "小屋の造り",
    Q_USE_BY_OTHERS: "他人が使っていないか",
    Q_SECURITY: "抵当や貸し借り",
    Q_FOREST_CARE: "植林・間伐の状況",
    Q_CLIFF: "急な崖の有無",
    Q_UNDERGROUND: "埋めた物の有無",
    Q_HEIRS: "相続人の範囲",
    Q_ACQUISITION: "取得の経緯",
    Q_DEBT: "毎年の支払い",
  };
  return map[code] || code;
}
