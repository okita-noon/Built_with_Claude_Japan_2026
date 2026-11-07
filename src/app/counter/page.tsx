"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { BrandMark } from "@/components/BrandMark";
import { BrushGlyph, ChimokuGlyph } from "@/components/BrushGlyph";
import { CounterEmailDraft } from "@/components/CounterEmailDraft";
import type { FudeCard, JudgeResult } from "@/lib/types";

type Enriched = { card: FudeCard; judge: JudgeResult };
type Office = "forestry" | "nouchi" | "shoshi";

const OFFICES: Array<{ key: Office; name: string; glyph: string }> = [
  { key: "forestry", name: "林務・森林組合", glyph: "森" },
  { key: "nouchi", name: "農業委員会", glyph: "農" },
  { key: "shoshi", name: "司法書士", glyph: "司" },
];

function filterFor(office: Office, items: Enriched[]) {
  if (office === "forestry") return items.filter((x) => x.card.toki_chimoku === "山林");
  if (office === "nouchi") return items.filter((x) => /田|畑/.test(x.card.toki_chimoku));
  return items;
}

function toCSV(office: Office, items: Enriched[]): string {
  const base = ["id", "chiban", "chimoku", "menseki_m2", "verdict", "reasons"];
  const extra = office === "forestry" ? ["forest_care", "disaster"] : office === "nouchi" ? ["others_use", "boundary"] : ["meigi", "shutoku"];
  const header = [...base, ...extra].join(",");
  const rows = items.map((x) => {
    const c = x.card as any;
    const vals = [
      x.card.id,
      JSON.stringify(x.card.chiban),
      x.card.toki_chimoku,
      String(x.card.menseki_m2 ?? ""),
      JSON.stringify(x.judge.verdict),
      JSON.stringify(x.judge.reasons.join("|")),
      ...extra.map((k) => JSON.stringify(c[k] ?? "")),
    ];
    return vals.join(",");
  });
  return [header, ...rows].join("\n");
}

const BRINGS: Record<Office, string[]> = {
  forestry: ["固定資産税の課税明細書", "森林の土地の所有者届出書（様式は窓口で入手）", "位置が分かるメモ（林小班・地番）", "家族の意向のメモ"],
  nouchi: ["固定資産税の課税明細書", "農地法3条の3の届出書（様式は窓口で入手）", "耕作者の名前のメモ", "家族の意向のメモ"],
  shoshi: ["戸籍一式（被相続人・相続人）", "固定資産税の課税明細書", "名寄帳", "相続関係の概略メモ"],
};

export default function CounterPage() {
  const [items, setItems] = useState<Enriched[]>([]);
  const [office, setOffice] = useState<Office>("forestry");
  const [town, setTown] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/demo");
      const j = (await r.json()) as { fude: Enriched[] };
      setItems(j.fude);
    })();
    try {
      const t = window.localStorage.getItem("fudekoe.town.v1");
      if (t) setTown(t);
    } catch {}
  }, []);

  const filtered = useMemo(() => filterFor(office, items), [office, items]);

  function download() {
    const csv = toCSV(office, filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fudekoe-${office}.csv`;
    a.click();
  }

  const curOffice = OFFICES.find((o) => o.key === office)!;

  return (
    <main className="min-h-screen px-8 pt-8 pb-16">
      <header className="flex items-center justify-between pb-6">
        <BrandMark size="sm" />
        <nav className="flex gap-5 text-sm text-sumi-500">
          <Link href="/" className="hover:text-sumi-900">はじめから</Link>
          <Link href="/family" className="hover:text-sumi-900">家族の画面</Link>
          <Link href="/parent" className="hover:text-sumi-900">親の画面</Link>
        </nav>
      </header>

      <div className="flex items-center gap-2 pb-6">
        {OFFICES.map((o) => (
          <button
            key={o.key}
            onClick={() => setOffice(o.key)}
            className={`flex items-center gap-2 px-5 py-3 rounded-md border font-mincho ${
              office === o.key ? "bg-sumi-900 text-washi border-sumi-900" : "bg-washi text-sumi-700 border-sumi-200 hover:bg-sumi-50"
            }`}
          >
            <BrushGlyph char={o.glyph} size={20} className={office === o.key ? "text-washi" : "text-sumi-700"} />
            {o.name}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={download} className="px-5 py-3 rounded-md bg-washi border border-sumi-900 text-sumi-900 font-mincho hover:bg-sumi-50">
          CSV を書き出す
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-8 bg-washi border border-sumi-200 rounded-md stroke-edge overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sumi-50 text-sumi-500">
              <tr className="text-left">
                <th title="地目：田・畑・宅地・山林などの用途区分" className="px-4 py-3 font-mincho font-normal cursor-help">地目</th>
                <th title="地番：土地ごとに付けられる番号（登記・課税の基本単位）" className="px-4 py-3 font-mincho font-normal cursor-help">地番</th>
                <th className="px-4 py-3 font-mincho font-normal tabular text-right">面積 m²</th>
                <th title="国庫帰属（相続土地を国に引き取ってもらう制度）の判定区分" className="px-4 py-3 font-mincho font-normal cursor-help">判定</th>
                {office === "forestry" && <th className="px-4 py-3 font-mincho font-normal">手入れ</th>}
                {office === "nouchi" && <th className="px-4 py-3 font-mincho font-normal">他人の使用</th>}
                {office === "shoshi" && <th className="px-4 py-3 font-mincho font-normal">名義</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((x, i) => (
                <motion.tr
                  key={x.card.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  className="border-t border-sumi-100"
                >
                  <td className="px-4 py-3">
                    <ChimokuGlyph chimoku={x.card.toki_chimoku} size={22} />
                  </td>
                  <td className="px-4 py-3 font-mincho text-sumi-900">{x.card.chiban}</td>
                  <td className="px-4 py-3 tabular text-right text-sumi-700">
                    {x.card.menseki_m2 ? x.card.menseki_m2.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 font-mincho text-sumi-700">{x.judge.verdict}</td>
                  {office === "forestry" && <td className="px-4 py-3 font-mincho text-sumi-700 text-xs">{x.card.forest_care}</td>}
                  {office === "nouchi" && <td className="px-4 py-3 font-mincho text-sumi-700 text-xs">{x.card.others_use}</td>}
                  {office === "shoshi" && <td className="px-4 py-3 font-mincho text-sumi-700 text-xs">{x.card.meigi}</td>}
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="px-6 py-10 text-sumi-400 font-mincho text-center">この窓口の対象になる筆はありません。</div>
          )}
        </section>

        <aside className="col-span-4 bg-washi border border-sumi-200 rounded-md stroke-edge p-5">
          <div className="font-fude text-xl text-sumi-900">相談に持っていくもの</div>
          <ul className="mt-4 space-y-3">
            {BRINGS[office].map((b) => (
              <li key={b} className="flex gap-3 items-start">
                <BrushGlyph char="持" size={18} className="text-sumi-500 mt-0.5" />
                <span className="font-mincho text-sumi-800 text-sm">{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs font-mincho text-sumi-400">
            ※ 法定様式の記入はしません。{curOffice.name}の窓口で受け取り、ここに書いてある情報と並べて記入してください。
          </p>
          <CounterEmailDraft
            office={office}
            officeName={curOffice.name}
            items={filtered}
            townName={town}
          />
        </aside>
      </div>
    </main>
  );
}
