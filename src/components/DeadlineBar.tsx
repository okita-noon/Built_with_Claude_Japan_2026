"use client";
import { BrushGlyph } from "./BrushGlyph";

export function DeadlineBar({ today = new Date("2026-11-04") }: { today?: Date }) {
  const touki = new Date("2027-03-31");
  const diff = Math.max(0, Math.ceil((touki.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const months = Math.floor(diff / 30);

  return (
    <div className="flex items-baseline gap-4 px-5 py-3 bg-washi border border-sumi-200 rounded-md stroke-edge">
      <BrushGlyph char="期" size={22} />
      <div className="flex-1">
        <div className="font-mincho text-xs text-sumi-500">相続登記（名義が被相続人のまま）</div>
        <div className="font-fude text-xl text-sumi-900">2027年3月31日まで</div>
      </div>
      <div className="tabular text-sumi-700 font-mincho">
        あと <span className="font-fude text-2xl text-beni">{months}</span> か月
      </div>
    </div>
  );
}
