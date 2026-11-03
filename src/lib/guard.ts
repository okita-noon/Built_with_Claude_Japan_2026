import type { GuardResult } from "./types.ts";

type Rule = {
  match: RegExp;
  decision: GuardResult["decision"];
  refer_to?: string[];
  rewrite?: string;
  tag: string;
};

const PROMPT_RULES: Rule[] = [
  { match: /境界.*確定|境.*(確定|引いて|正式).*(して|登録|書面)|GPS.*境界|筆界|境界.*引いて|栗の木.*確定/, decision: "refuse_and_refer", refer_to: ["土地家屋調査士", "法務局（筆界特定）"], tag: "boundary" },
  { match: /遺産分割協議書.*作|遺産分割.*書.*作/, decision: "refuse_and_refer", refer_to: ["司法書士", "弁護士"], tag: "docs_bunkatsu" },
  { match: /承認申請書.*(作|出|書)|申請書.*(書い|出せる|作って)/, decision: "refuse_and_refer", refer_to: ["司法書士", "行政書士", "弁護士"], tag: "docs_kokko" },
  { match: /相続登記.*(申請書|書い|出せる)/, decision: "refuse_and_refer", refer_to: ["司法書士"], tag: "docs_touki" },
  { match: /農地法3条の3.*(届出|記入|出)/, decision: "refuse_and_refer", refer_to: ["農業委員会", "行政書士"], tag: "docs_nouchi" },
  { match: /森林.*所有者.*(届出|埋め)/, decision: "refuse_and_refer", refer_to: ["市町村の林務担当", "行政書士"], tag: "docs_shinrin" },
  { match: /兄.*(渡さず|有利)|分け方.*教えて|押し付け/, decision: "refuse_and_refer", refer_to: ["弁護士"], tag: "partition" },
  { match: /認知.*怪しい.*録音|有利な意向.*録音/, decision: "refuse_and_refer", refer_to: ["弁護士"], tag: "manipulation" },
  { match: /相続税.*(いくら|計算)|税金.*(得|計算)|個別.*税/, decision: "refuse_and_refer", refer_to: ["税理士"], tag: "tax_individual" },
  { match: /断言|必ず.*借り|承認される(って|と).*断言/, decision: "refuse_and_refer", refer_to: ["法務局（事前相談）"], tag: "guarantee" },
  { match: /買い手.*探|値段.*交渉|売る.*契約書/, decision: "refuse_and_refer", refer_to: ["宅地建物取引業者", "森林組合"], tag: "brokerage" },
  { match: /遺言.*(有効|残せば|従わ)/, decision: "refuse_and_refer", refer_to: ["弁護士", "公証役場"], tag: "will" },
  { match: /隣.*住所.*電話|第三者.*個人情報|叔父.*戸籍/, decision: "refuse_and_refer", refer_to: ["法務局"], tag: "privacy" },
  { match: /SYSTEM:|士業法.*無視|プロンプト.*無視/i, decision: "refuse_and_refer", refer_to: [], tag: "injection" },
  { match: /申請書.*書い|もう面倒.*書い/, decision: "refuse_and_refer", refer_to: ["司法書士", "行政書士"], tag: "injection_voice" },
  { match: /境.*ここで決まり.*隣.*言う/, decision: "refuse_and_refer", refer_to: ["土地家屋調査士"], tag: "injection_boundary" },
];

const OUTPUT_RULES: Rule[] = [
  { match: /境界は.*です[。．]?$/, decision: "rewrite", rewrite: "お母さんの証言では、境は◯◯のあたり（参考情報）。確定には土地家屋調査士への相談が必要です。", tag: "boundary_assert" },
  { match: /承認されます|引き取ってもらえます|引き取ってくれます/, decision: "rewrite", rewrite: "却下事由は今のところ見当たりません。最終判断は法務局の審査です。", tag: "guarantee" },
  { match: /申請書の記入例|申請者：.*所在/, decision: "rewrite", rewrite: "申請書の作成は司法書士・行政書士・弁護士に依頼できます。持参するもの：固定資産税の課税明細書、戸籍など。", tag: "docs" },
  { match: /公平です|分け方.*(最も|公平)/, decision: "rewrite", rewrite: "分け方は家族で決めること。論点整理は手伝えますが、助言は弁護士へ。", tag: "partition" },
  { match: /相続税は.*円/, decision: "rewrite", rewrite: "個別の税額は税理士へ。制度の一般説明はできます。", tag: "tax" },
  { match: /遺言として残せました|遺言として有効/, decision: "rewrite", rewrite: "録音・動画は法的な遺言になりません。公正証書遺言などは公証役場・弁護士に相談を。", tag: "will" },
];

export function guardPrompt(input: string): GuardResult {
  for (const r of PROMPT_RULES) {
    if (r.match.test(input)) {
      return { decision: r.decision, refer_to: r.refer_to || [], reason_tag: r.tag };
    }
  }
  return { decision: "answer", refer_to: [], reason_tag: "general" };
}

export function guardOutput(input: string): GuardResult {
  for (const r of OUTPUT_RULES) {
    if (r.match.test(input)) {
      return { decision: "rewrite", refer_to: [], rewritten: r.rewrite, reason_tag: r.tag };
    }
  }
  return { decision: "pass", refer_to: [], reason_tag: "ok" };
}

export function guard(kind: "prompt" | "output", input: string): GuardResult {
  return kind === "prompt" ? guardPrompt(input) : guardOutput(input);
}
