"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import type { FudeCard, NextQuestion } from "@/lib/types";

type Enriched = { card: FudeCard; judge: { verdict: string } };

export default function MotherPage() {
  const [card, setCard] = useState<FudeCard | null>(null);
  const [question, setQuestion] = useState<NextQuestion | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/demo");
      const j = (await r.json()) as { fude: Enriched[] };
      const first = j.fude.find((x) => x.judge.verdict === "判断に必要な情報が足りない") || j.fude[0];
      setCard(first.card);
      const q = await fetch("/api/next-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card: first.card }),
      });
      const qj = (await q.json()) as { question: NextQuestion | null };
      setQuestion(qj.question);
    })();
  }, []);

  if (!card) return <div className="min-h-screen grid place-items-center font-mincho text-sumi-500">読み込み中</div>;

  const name = card.yobina || card.chiban;

  return (
    <main className="min-h-screen grid place-items-center px-6 py-10">
      <div className="w-full max-w-2xl flex flex-col items-center gap-10">
        {/* 写真1枚（代替：SVGでその場所を描く）*/}
        <div className="w-full aspect-[4/3] rounded-md overflow-hidden stroke-edge bg-sumi-50 border border-sumi-200">
          <svg viewBox="0 0 400 300" className="w-full h-full">
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f6efe2" />
                <stop offset="1" stopColor="#ece2d1" />
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="url(#sky)" />
            <path d="M0 220 L80 170 L160 190 L240 150 L320 180 L400 160 L400 300 L0 300 Z" fill="#8a7a6a" opacity="0.6" />
            <path d="M0 240 L120 220 L220 230 L320 215 L400 225 L400 300 L0 300 Z" fill="#6b5d50" opacity="0.7" />
            <circle cx="320" cy="80" r="30" fill="#dfd3bc" />
          </svg>
        </div>

        <div className="text-center">
          <div className="font-fude text-4xl text-sumi-900">{name}</div>
        </div>

        {/* 二択の質問。母には1問だけ、大きく */}
        <AnimatePresence>
          {question && (
            <motion.div
              key={question.code}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 170, damping: 26 }}
              className="w-full text-center"
            >
              <p className="font-fude text-3xl text-sumi-900 leading-snug">{question.prompt}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 話すボタン：声に合わせて輪が膨らむ想定（デモはクリックで膨らむ） */}
        <div className="relative">
          <AnimatePresence>
            {speaking && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-sumi-900/30"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>
          <button
            onMouseDown={() => setSpeaking(true)}
            onMouseUp={() => setSpeaking(false)}
            onMouseLeave={() => setSpeaking(false)}
            onTouchStart={() => setSpeaking(true)}
            onTouchEnd={() => setSpeaking(false)}
            className="relative w-44 h-44 rounded-full bg-sumi-900 text-washi font-fude text-3xl grid place-items-center shadow-card hover:bg-sumi-800 active:scale-[0.98] transition-transform"
            aria-label="話す"
          >
            話す
          </button>
        </div>

        <Link href="/family" className="text-sm font-mincho text-sumi-400 hover:text-sumi-700">
          家族の画面へもどる
        </Link>
      </div>
    </main>
  );
}
