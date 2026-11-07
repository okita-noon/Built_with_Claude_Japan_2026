"use client";
import { motion, AnimatePresence } from "motion/react";
import type { FudeCard, IntentResolution, JudgeResult } from "@/lib/types";
import { LANE_FOR_VERDICT } from "@/lib/types";
import { ChimokuGlyph } from "./BrushGlyph";

const LANES: Array<{ key: "refuse" | "risk" | "wait" | "ok"; label: string; cls: string; hint: string }> = [
  { key: "refuse", label: "申請不可", cls: "lane-refuse", hint: "法令上、国庫帰属の申請そのものができない筆（建物あり・担保ありなど）" },
  { key: "risk", label: "不承認の可能性", cls: "lane-risk", hint: "申請はできるが、審査で不承認になる可能性が高い筆（崖・災害警戒区域など）" },
  { key: "wait", label: "情報が足りない", cls: "lane-wait", hint: "判定に必要な証言や書類が足りていない筆。親に聞き直しが必要" },
  { key: "ok", label: "検討できる", cls: "lane-ok", hint: "要件上は検討できる筆。最終判断は法務局の審査" },
];

export function JudgmentLanes({
  items,
  activeId,
  onSelect,
  intentOf,
}: {
  items: Array<{ card: FudeCard; judge: JudgeResult }>;
  activeId: string | null;
  onSelect: (id: string) => void;
  intentOf?: (id: string) => IntentResolution;
}) {
  const grouped = LANES.map((l) => ({
    ...l,
    cards: items.filter((it) => LANE_FOR_VERDICT[it.judge.verdict] === l.key),
  }));

  return (
    <div className="grid grid-cols-4 gap-3 h-full">
      {grouped.map((lane) => (
        <div key={lane.key} className={`bg-washi/60 rounded-md pt-3 pb-2 px-2 ${lane.cls} border-y border-r border-sumi-100 flex flex-col`}>
          <div title={lane.hint} className="font-fude text-sumi-900 text-base px-1 pb-2 border-b border-sumi-200/60 cursor-help">{lane.label}</div>
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
                    {intentOf && <IntentBadge resolution={intentOf(it.card.id)} active={activeId === it.card.id} />}
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

function IntentBadge({ resolution, active }: { resolution: IntentResolution; active: boolean }) {
  if (resolution.kind === "pending") {
    return (
      <span title={`意向 ${resolution.submitted}/${resolution.total}`} className="flex items-center gap-0.5 shrink-0">
        {Array.from({ length: resolution.total }).map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${i < resolution.submitted ? (active ? "bg-washi" : "bg-sumi-500") : (active ? "bg-sumi-600" : "bg-sumi-200")}`}
          />
        ))}
      </span>
    );
  }
  if (resolution.kind === "unanimous") {
    return (
      <span title={`家族一致：${resolution.intent}`} className={`shrink-0 font-fude text-sm ${active ? "text-washi" : "text-matcha"}`}>
        一
      </span>
    );
  }
  return (
    <span title="家族で論点あり" className={`shrink-0 font-fude text-sm ${active ? "text-washi" : "text-beni"}`}>
      論
    </span>
  );
}
