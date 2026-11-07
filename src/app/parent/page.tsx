"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import type { FudeCard, NextQuestion } from "@/lib/types";
import type { JevTagResult } from "@/lib/jev";
import { DEMO_TRANSCRIPTS } from "@/lib/transcripts";
import { publish, subscribe } from "@/lib/bridge";
import { startLive, type LiveSession } from "@/lib/gemini-live";

type Enriched = { card: FudeCard; judge: { verdict: string } };

export default function ParentPage() {
  const [card, setCard] = useState<FudeCard | null>(null);
  const [question, setQuestion] = useState<NextQuestion | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [currentChunk, setCurrentChunk] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [geminiReady, setGeminiReady] = useState<"unknown" | "ready" | "fallback">("unknown");
  const stopRef = useRef<{ stopped: boolean }>({ stopped: false });
  const liveRef = useRef<LiveSession | null>(null);
  const [level, setLevel] = useState(0);

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

    // Gemini トークン可否を確認（鍵なしなら 501 → fallback）
    (async () => {
      try {
        const r = await fetch("/api/gemini/token");
        const j = (await r.json()) as { available?: boolean };
        setGeminiReady(j.available ? "ready" : "fallback");
      } catch {
        setGeminiReady("fallback");
      }
    })();

    // 家族の画面から「次の質問を親に読み上げて」の指示を受け取る
    const unsub = subscribe((ev) => {
      if (ev.type === "say") {
        try {
          const u = new SpeechSynthesisUtterance(ev.message);
          u.lang = "ja-JP";
          u.rate = 0.95;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        } catch {}
      }
    });
    return () => {
      unsub();
      stopRef.current.stopped = true;
      liveRef.current?.stop();
    };
  }, []);

  // 1発話を家族の画面へ流し、Jev で即時タグ（Choice/Noul/Score）を付ける
  async function handleUtterance(text: string) {
    publish({ type: "transcript", text, at: Date.now() });
    try {
      const r = await fetch("/api/jev/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const result = (await r.json()) as JevTagResult;
      publish({ type: "tag", text, result, at: Date.now() });
      if (result.score >= 70) publish({ type: "fatigue", score: result.score, at: Date.now() });
    } catch {}
  }

  // 実 Gemini Live：タップで聞き始め、もう一度タップで終わる（長押しは親に難しい）
  async function toggleLive() {
    if (liveRef.current) {
      liveRef.current.stop();
      liveRef.current = null;
      return;
    }
    setSpeaking(true);
    try {
      liveRef.current = await startLive({
        onPartial: (t) => setCurrentChunk(t),
        onUtterance: (t) => {
          setCurrentChunk(t);
          void handleUtterance(t);
        },
        onLevel: setLevel,
        onState: (st) => {
          if (st === "closed" || st === "error") {
            liveRef.current = null;
            setSpeaking(false);
            setLevel(0);
            setTimeout(() => setCurrentChunk(null), 2500);
          }
        },
      });
    } catch {
      liveRef.current = null;
      setSpeaking(false);
      setGeminiReady("fallback");
    }
  }

  async function playTranscript(id: string) {
    if (playingId) return;
    const t = DEMO_TRANSCRIPTS.find((x) => x.id === id);
    if (!t) return;
    setPlayingId(id);
    setSpeaking(true);
    stopRef.current = { stopped: false };
    publish({ type: "focus", yobina: t.yobina, at: Date.now() });
    for (const chunk of t.chunks) {
      if (stopRef.current.stopped) break;
      setCurrentChunk(chunk.text);
      await handleUtterance(chunk.text);
      await new Promise((rs) => setTimeout(rs, chunk.delay_ms ?? 1200));
    }
    setSpeaking(false);
    setCurrentChunk(null);
    setPlayingId(null);
  }

  if (!card) return <div className="min-h-screen grid place-items-center font-mincho text-sumi-500">読み込み中</div>;

  const name = card.yobina || card.chiban;

  return (
    <main className="min-h-screen grid place-items-center px-6 py-10">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8">
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

        {/* 二択の質問。親には1問だけ、大きく */}
        <AnimatePresence>
          {question && !currentChunk && (
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
          {currentChunk && (
            <motion.p
              key={currentChunk}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              className="font-fude text-2xl text-sumi-700 text-center leading-snug"
            >
              「{currentChunk}」
            </motion.p>
          )}
        </AnimatePresence>

        {/* 話すボタン */}
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
          {/* 音量に追従して輪が膨らむ（上限 1.15 倍） */}
          {geminiReady === "ready" && speaking && (
            <div
              className="absolute inset-0 rounded-full bg-sumi-900/15 transition-transform duration-100"
              style={{ transform: `scale(${1 + Math.min(0.15, level * 0.15)})` }}
            />
          )}
          <button
            {...(geminiReady === "ready"
              ? { onClick: () => void toggleLive() }
              : {
                  onMouseDown: () => setSpeaking(true),
                  onMouseUp: () => setSpeaking(false),
                  onMouseLeave: () => setSpeaking(false),
                  onTouchStart: () => setSpeaking(true),
                  onTouchEnd: () => setSpeaking(false),
                })}
            className="relative w-44 h-44 rounded-full bg-sumi-900 text-washi font-fude text-3xl grid place-items-center shadow-card hover:bg-sumi-800 active:scale-[0.98] transition-transform"
            aria-label="話す"
          >
            話す
          </button>
        </div>

        {/* デモ発話：キャンドtranscriptを選んで流す（Gemini Liveの代替） */}
        <div className="w-full">
          <div className="text-xs font-mincho text-sumi-400 text-center mb-2">
            {geminiReady === "ready"
              ? "話すボタンで Gemini Live に接続。キャンドのデモ発話も流せる："
              : "Gemini Live 未接続。キャンドのデモ発話を流す："}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {DEMO_TRANSCRIPTS.map((t) => (
              <button
                key={t.id}
                disabled={Boolean(playingId) && playingId !== t.id}
                onClick={() => playTranscript(t.id)}
                className={`px-3 py-2 rounded-md font-mincho text-sm border transition-colors ${
                  playingId === t.id
                    ? "bg-sumi-900 text-washi border-sumi-900"
                    : "bg-washi text-sumi-700 border-sumi-300 hover:bg-sumi-50 disabled:opacity-30"
                }`}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>

        <Link href="/family" className="text-sm font-mincho text-sumi-400 hover:text-sumi-700">
          家族の画面へもどる
        </Link>
      </div>
    </main>
  );
}
