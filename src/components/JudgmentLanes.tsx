"use client";
import { motion, AnimatePresence } from "motion/react";
import type { FudeCard, JudgeResult } from "@/lib/types";
import { LANE_FOR_VERDICT } from "@/lib/types";
import { ChimokuGlyph } from "./BrushGlyph";

const LANES: Array<{ key: "refuse" | "risk" | "wait" | "ok"; label: string; cls: string }> = [
  { key: "refuse", label: "申請不可", cls: "lane-refuse" },
  { key: "risk", label: "不承認の可能性", cls: "lane-risk" },
  { key: "wait", label: "情報が足りない", cls: "lane-wait" },
  { key: "ok", label: "検討できる", cls: "lane-ok" },
];

export function JudgmentLanes({
  items,
  activeId,
  onSelect,
}: {
  items: Array<{ card: FudeCard; judge: JudgeResult }>;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const grouped = LANES.map((l) => ({
    ...l,
    cards: items.filter((it) => LANE_FOR_VERDICT[it.judge.verdict] === l.key),
  }));

  return (
    <div className="grid grid-cols-4 gap-3 h-full">
      {grouped.map((lane) => (
        <div key={lane.key} className={`bg-washi/60 rounded-md pt-3 pb-2 px-2 ${lane.cls} border-y border-r border-sumi-100 flex flex-col`}>
          <div className="font-fude text-sumi-900 text-base px-1 pb-2 border-b border-sumi-200/60">{lane.label}</div>
          <div className="flex-1 overflow-y-auto space-y-2 pt-2">
            <AnimatePresence>
              {lane.cards.map((it) => (
                <motion.button
                  layout
                  key={it.card.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 170, damping: 26 }}
                  onClick={() => onSelect(it.card.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${
                    activeId === it.card.id ? "bg-sumi-900 text-washi border-sumi-900" : "bg-washi border-sumi-200 text-sumi-900 hover:bg-sumi-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ChimokuGlyph chimoku={it.card.toki_chimoku} size={22} />
                    <div className="flex-1 min-w-0">
                      <div className="font-fude text-base truncate">{it.card.yobina || it.card.chiban}</div>
                      <div className={`text-[11px] tabular ${activeId === it.card.id ? "text-sumi-200" : "text-sumi-500"}`}>
                        {it.card.chiban}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </div>
  );
}
