"use client";
import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { BrandMark } from "@/components/BrandMark";
import { BrushGlyph, ChimokuGlyph } from "@/components/BrushGlyph";

type Line = { chiban: string; chimoku_tax: string; menseki_m2: number; kazei_hyoka_en: number };

type Step = "town" | "slip" | "scanning" | "list";

export default function Onboarding() {
  const [step, setStep] = useState<Step>("town");
  const [town, setTown] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [revealed, setRevealed] = useState(0);

  async function startScan() {
    setStep("scanning");
    const res = await fetch("/api/ocr", { method: "POST" });
    const slip = (await res.json()) as { lines: Line[] };
    setLines(slip.lines);
    for (let i = 1; i <= slip.lines.length; i++) {
      await new Promise((r) => setTimeout(r, 220));
      setRevealed(i);
    }
    setStep("list");
  }

  return (
    <main className="min-h-screen w-full">
      <header className="px-8 pt-10 pb-6 flex items-center justify-between">
        <BrandMark size="md" />
        <nav className="flex gap-5 text-sm text-sumi-500">
          <Link href="/family" className="hover:text-sumi-900">家族の画面</Link>
          <Link href="/parent" className="hover:text-sumi-900">親の画面</Link>
          <Link href="/counter" className="hover:text-sumi-900">窓口の画面</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-8 pt-6 pb-24">
        <AnimatePresence mode="wait">
          {step === "town" && (
            <motion.div
              key="town"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="pt-20"
            >
              <h1 className="font-fude text-5xl text-sumi-900 leading-tight">親の町名を、ひとつだけ</h1>
              <p className="font-mincho text-sumi-600 mt-6 text-base max-w-xl">
                親の記憶から土地を一筆ずつ棚卸しし、家族が「残す／託す／譲る／国に返す／保留」を決めて窓口へ持っていけるようにします。
              </p>
              <div className="mt-10 flex gap-3 items-stretch max-w-xl">
                <input
                  value={town}
                  onChange={(e) => setTown(e.target.value)}
                  placeholder="大字 栗原（和歌山県・架空）"
                  className="flex-1 bg-washi border border-sumi-200 focus:border-sumi-500 outline-none rounded-md px-5 py-4 font-mincho text-lg text-sumi-900 placeholder:text-sumi-300"
                />
                <button
                  onClick={() => setStep("slip")}
                  disabled={!town.trim()}
                  className="px-6 py-4 rounded-md bg-sumi-900 text-washi font-mincho text-lg disabled:opacity-30 hover:bg-sumi-800 transition-colors"
                >
                  地図へ
                </button>
              </div>
              <p className="text-xs text-sumi-400 mt-4 font-mincho">※ デモ用の架空集落。実在の地名との関係はありません。</p>
            </motion.div>
          )}

          {step === "slip" && (
            <motion.div key="slip" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.32 }} className="pt-16">
              <h2 className="font-fude text-4xl text-sumi-900">課税明細書を、1枚だけ</h2>
              <p className="font-mincho text-sumi-600 mt-5">撮れば、筆が1つずつ地図に灯ります。</p>

              <div className="mt-10 grid grid-cols-[1fr_auto] gap-6 items-center">
                <div className="aspect-[3/4] bg-sumi-50 border border-sumi-200 rounded-md flex items-center justify-center stroke-edge relative overflow-hidden max-w-sm">
                  <svg viewBox="0 0 240 320" className="w-full h-full">
                    <rect x="20" y="30" width="200" height="20" fill="#ece2d1" />
                    <text x="30" y="46" fontSize="10" fill="#6b5d50">固定資産課税明細書（デモ）</text>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <g key={i}>
                        <rect x="20" y={60 + i * 24} width="200" height="20" fill="#f6efe2" stroke="#dfd3bc" />
                        <text x="30" y={74 + i * 24} fontSize="9" fill="#4a4038">大字栗原 ○○○</text>
                      </g>
                    ))}
                  </svg>
                </div>
                <button onClick={startScan} className="px-8 py-5 rounded-md bg-sumi-900 text-washi font-mincho text-lg hover:bg-sumi-800">撮る</button>
              </div>
            </motion.div>
          )}

          {(step === "scanning" || step === "list") && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-12">
              <h2 className="font-fude text-4xl text-sumi-900">
                筆が <span className="tabular text-sumi-900">{revealed}</span> つ
              </h2>

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lines.slice(0, revealed).map((l, i) => (
                  <motion.div
                    key={l.chiban}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.02, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-washi border border-sumi-200 rounded-md p-5 shadow-card stroke-edge"
                  >
                    <div className="flex items-center gap-3">
                      <ChimokuGlyph chimoku={l.chimoku_tax} size={34} />
                      <div className="flex-1">
                        <div className="font-mincho text-sumi-900 text-base">{l.chiban}</div>
                        <div className="text-xs text-sumi-500 tabular">{l.menseki_m2.toLocaleString()} m²</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {step === "list" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-14 flex items-center justify-between">
                  <div>
                    <h3 className="font-fude text-2xl text-sumi-900">まず親に聞きたい場所を1つ</h3>
                    <p className="font-mincho text-sumi-500 text-sm mt-2">家族の画面で地図から選び、聞き直しを始めます。</p>
                  </div>
                  <Link href="/family" className="px-7 py-4 rounded-md bg-sumi-900 text-washi font-mincho text-lg hover:bg-sumi-800">
                    家族の画面へ
                  </Link>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <footer className="px-8 py-6 text-xs font-mincho text-sumi-400 flex items-center gap-2">
        <BrushGlyph char="参" size={14} />
        <span>参考情報です。最終判断は法務局・各窓口。アプリは書類作成・境界確定・個別助言はしません。</span>
      </footer>
    </main>
  );
}
