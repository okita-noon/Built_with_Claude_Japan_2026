"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { FudeCard, JudgeResult } from "@/lib/types";
import { BrushGlyph } from "./BrushGlyph";

export type Office = "forestry" | "nouchi" | "shoshi";

type Props = {
  office: Office;
  officeName: string;
  items: Array<{ card: FudeCard; judge: JudgeResult }>;
  townName?: string;
};

const INTROS: Record<Office, string> = {
  forestry: "相続した山林のうち、保有の続け方（森林経営管理制度・森林組合への相談）について、窓口の初回相談をお願いしたく、ご連絡いたしました。",
  nouchi: "相続した農地のうち、農地法3条の3の届出と、以後の耕作者・農地バンクの相談について、窓口の初回相談をお願いしたく、ご連絡いたしました。",
  shoshi: "相続登記（亡くなった親から相続した土地）について、相談をお願いしたく、ご連絡いたしました。",
};

const SUBJECT_PREFIX: Record<Office, string> = {
  forestry: "【相談希望】相続した山林の森林所有者届出・経営管理のご相談",
  nouchi: "【相談希望】相続した農地の3条の3届出・今後の利用のご相談",
  shoshi: "【相談希望】相続登記のご相談（期限内の対応）",
};

const BRINGS_LABEL: Record<Office, string> = {
  forestry: "固定資産税の課税明細書、森林の土地の所有者届出書、位置メモ、家族の意向のメモ",
  nouchi: "固定資産税の課税明細書、農地法3条の3の届出書、耕作者の名前のメモ、家族の意向のメモ",
  shoshi: "戸籍一式（被相続人・相続人）、課税明細書、名寄帳、相続関係の概略メモ",
};

function buildBody(props: Props): string {
  const { items, officeName, townName } = props;
  const lines: string[] = [];
  lines.push(`${officeName} ご担当者 様`);
  lines.push("");
  lines.push("お世話になっております。");
  lines.push(INTROS[props.office]);
  lines.push("");
  lines.push("【対象の土地】");
  if (townName) lines.push(`所在地：和歌山県田辺市 ${townName}（架空デモの地番）`);
  items.forEach((x, i) => {
    const area = x.card.menseki_m2 ? `${x.card.menseki_m2.toLocaleString()} m²` : "面積不明";
    lines.push(`${i + 1}. ${x.card.chiban}（${x.card.toki_chimoku}・${area}）／筆のこえ上の判定：${x.judge.verdict}`);
  });
  lines.push("");
  lines.push("【持参予定のもの】");
  lines.push(BRINGS_LABEL[props.office]);
  lines.push("");
  lines.push("ご多忙のところ恐れ入りますが、ご都合のよい日時のご提示をいただけますと幸いです。");
  lines.push("どうぞよろしくお願いいたします。");
  lines.push("");
  lines.push("―");
  lines.push("（差出人氏名）");
  lines.push("（電話番号）");
  return lines.join("\n");
}

export function CounterEmailDraft(props: Props) {
  const [copied, setCopied] = useState(false);
  const subject = SUBJECT_PREFIX[props.office];
  const body = useMemo(() => buildBody(props), [props]);

  const mailto = useMemo(() => {
    const q = new URLSearchParams();
    q.set("subject", subject);
    q.set("body", body);
    return `mailto:?${q.toString()}`;
  }, [subject, body]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`件名：${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const disabled = props.items.length === 0;

  return (
    <div className="mt-5 border-t border-sumi-200 pt-5">
      <div className="font-fude text-lg text-sumi-900">相談への申込（下書き）</div>
      <p className="mt-1 font-mincho text-xs text-sumi-500">
        窓口の受付問い合わせに貼る文面。家族の意向は入れず、相談の依頼にとどめます。
      </p>
      <div className="mt-3 bg-sumi-50 rounded-sm p-3 border border-sumi-100">
        <div className="font-mincho text-xs text-sumi-500">件名</div>
        <div className="font-mincho text-sumi-900 text-sm mt-0.5">{subject}</div>
        <div className="font-mincho text-xs text-sumi-500 mt-3">本文</div>
        <pre className="mt-1 whitespace-pre-wrap font-mincho text-sm text-sumi-800 leading-relaxed">
{disabled ? "この窓口の対象になる筆が選ばれていません。地目タブを切り替えてください。" : body}
        </pre>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <a
          href={disabled ? undefined : mailto}
          className={`flex-1 text-center py-2.5 rounded-md font-mincho text-sm transition-colors ${
            disabled
              ? "bg-sumi-100 text-sumi-300 cursor-not-allowed"
              : "bg-sumi-900 text-washi hover:bg-sumi-800"
          }`}
          onClick={(e) => { if (disabled) e.preventDefault(); }}
        >
          <BrushGlyph char="参" size={14} className="inline-block mr-1" />
          メーラーで開く
        </a>
        <button
          onClick={copy}
          disabled={disabled}
          className={`flex-1 py-2.5 rounded-md font-mincho text-sm border transition-colors ${
            disabled
              ? "bg-sumi-50 text-sumi-300 border-sumi-200 cursor-not-allowed"
              : "bg-washi text-sumi-900 border-sumi-800 hover:bg-sumi-50"
          }`}
        >
          本文をコピー
        </button>
      </div>
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-xs font-mincho text-matcha"
          >
            コピーしました
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
