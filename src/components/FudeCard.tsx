"use client";
import { motion } from "motion/react";
import type { FudeCard as FudeCardT, JudgeResult, NextQuestion } from "@/lib/types";
import { ChimokuGlyph, BrushCheck, BrushAsk } from "./BrushGlyph";

type Cell = { key: string; label: string; filled: boolean; value: string };

function cells(card: FudeCardT): Cell[] {
  const row = (k: string, label: string, value: unknown): Cell => {
    const s = typeof value === "string" ? value.trim() : "";
    const filled = !!s && !/^(不明|)$/.test(s);
    return { key: k, label, filled, value: s };
  };
  return [
    row("building", "建物", card.building),
    row("boundary", "境界", card.boundary),
    row("others_use", "他人の使用", card.others_use),
    row("rights", "担保・貸借", card.rights),
    row("cliff", "崖", card.cliff),
    row("underground", "地下埋設", card.underground),
    row("forest_care", "山の手入れ", card.forest_care),
    row("disaster", "警戒区域", card.disaster),
    row("neighbor_trouble", "隣地争い", card.neighbor_trouble),
    row("recurring_charges", "毎年の負担", card.recurring_charges),
  ];
}

export function FudeCardPanel({
  card,
  judge,
  question,
  onAnswer,
}: {
  card: FudeCardT;
  judge: JudgeResult;
  question: NextQuestion | null;
  onAnswer: (choiceIndex: 0 | 1) => void;
}) {
  const list = cells(card);
  const filled = list.filter((c) => c.filled).length;

  return (
    <div className="bg-washi border border-sumi-200 rounded-md shadow-card stroke-edge p-6">
      <div className="flex items-start gap-4">
        <ChimokuGlyph chimoku={card.toki_chimoku} size={42} />
        <div className="flex-1">
          <div className="font-fude text-2xl text-sumi-900">{card.yobina || card.chiban}</div>
          <div className="text-xs text-sumi-500 font-mincho tabular mt-1">{card.chiban}{card.menseki_m2 ? ` ・ ${card.menseki_m2.toLocaleString()} m²` : ""}</div>
        </div>
        <div className="flex items-center gap-1 tabular text-sumi-400">
          <span className="font-mincho text-sm">{filled}</span>
          <span className="font-mincho text-xs">/ {list.length}</span>
        </div>
      </div>

      {card.haha_shogen ? (
        <blockquote className="mt-4 font-mincho text-sumi-700 text-sm border-l-2 border-sumi-300 pl-3">
          「{card.haha_shogen}」
        </blockquote>
      ) : null}

      {/* 必須項目のマス：埋まったら塗られる（文字ラベルは左端1回のみ） */}
      <div className="mt-5 grid grid-cols-10 gap-1.5">
        {list.map((c) => (
          <motion.div
            key={c.key}
            title={`${c.label}${c.value ? "：" + c.value : ""}`}
            initial={false}
            animate={{ backgroundColor: c.filled ? "#2a241e" : "#f6efe2", borderColor: c.filled ? "#2a241e" : "#dfd3bc" }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="aspect-square rounded-sm border"
          />
        ))}
      </div>

      <div className="mt-5 font-mincho text-sumi-800 text-sm leading-relaxed">
        {judge.text}
      </div>

      {judge.flags.includes("F_CHIMOKU_MISMATCH") && (
        <div className="mt-3 text-xs font-mincho text-beni">※ 登記の地目と現況が違います。</div>
      )}

      {question && (
        <motion.div
          layout
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 170, damping: 26 }}
          className="mt-6 border-t border-sumi-200 pt-5"
        >
          <div className="flex items-center gap-2 text-sumi-600">
            <BrushAsk size={18} />
            <span className="font-mincho text-sm">母に聞き直す</span>
          </div>
          <p className="font-fude text-xl text-sumi-900 mt-2 leading-snug">{question.prompt}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => onAnswer(0)} className="py-4 px-5 rounded-md bg-sumi-900 text-washi font-mincho hover:bg-sumi-800">
              {question.choices[0]}
            </button>
            <button onClick={() => onAnswer(1)} className="py-4 px-5 rounded-md bg-washi border border-sumi-800 text-sumi-900 font-mincho hover:bg-sumi-50">
              {question.choices[1]}
            </button>
          </div>
        </motion.div>
      )}

      {!question && judge.verdict === "要件上は検討できる" && (
        <div className="mt-5 flex items-center gap-2 text-matcha">
          <BrushCheck size={20} />
          <span className="font-mincho text-sm">今のところ、確認した項目では問題は見当たりません。</span>
        </div>
      )}
    </div>
  );
}
