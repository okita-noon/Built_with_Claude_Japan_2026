"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { DeadlineBar } from "@/components/DeadlineBar";
import { JudgmentLanes } from "@/components/JudgmentLanes";
import { FudeCardPanel } from "@/components/FudeCard";
import { FamilyIntents } from "@/components/FamilyIntents";
import type { FudeCard, IntentResolution, JudgeResult, NextQuestion } from "@/lib/types";
import { LANE_FOR_VERDICT } from "@/lib/types";
import { getVotes, resolveFude } from "@/lib/intents";
import { publish, subscribe, type BridgeEvent } from "@/lib/bridge";
import { nouToFudePatch } from "@/lib/jev";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), { ssr: false });

type Enriched = { card: FudeCard; judge: JudgeResult };

export default function FamilyPage() {
  const [items, setItems] = useState<Enriched[]>([]);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [question, setQuestion] = useState<NextQuestion | null>(null);
  const [intentsTick, setIntentsTick] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null);
  const [fatigue, setFatigue] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/demo");
      const j = (await r.json()) as { fude: Enriched[]; geo: GeoJSON.FeatureCollection };
      setItems(j.fude);
      setGeo(j.geo);
      // 最初は「情報が足りない」の筆を1つ選んで、聞き直しの山場を見せる
      const first = j.fude.find((x) => x.judge.verdict === "判断に必要な情報が足りない") || j.fude[0];
      if (first) selectCard(first.card.id, j.fude);
    })();
  }, []);

  const selectCard = useCallback(async (id: string, list?: Enriched[]) => {
    const base = list ?? items;
    const it = base.find((x) => x.card.id === id);
    setActiveId(id);
    setQuestion(null); // 前の筆の質問を残さない
    if (!it) return;
    const r = await fetch("/api/next-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card: it.card }),
    });
    const j = (await r.json()) as { question: NextQuestion | null; judge: JudgeResult };
    setQuestion(j.question);
  }, [items]);

  const active = useMemo(() => items.find((x) => x.card.id === activeId) || null, [items, activeId]);

  useEffect(() => {
    const h = () => setIntentsTick((n) => n + 1);
    window.addEventListener("fudekoe:intents-changed", h);
    window.addEventListener("fudekoe:active-member-changed", h);
    return () => {
      window.removeEventListener("fudekoe:intents-changed", h);
      window.removeEventListener("fudekoe:active-member-changed", h);
    };
  }, []);

  const intentOf = useCallback<(id: string) => IntentResolution>(
    (id) => resolveFude(id, getVotes()),
    // intentsTick を依存に入れて、投票が入るたびに再計算する
    [intentsTick]
  );

  const verdictOf = useCallback(
    (id: string): "refuse" | "risk" | "wait" | "ok" | "unknown" => {
      const it = items.find((x) => x.card.id === id);
      return it ? LANE_FOR_VERDICT[it.judge.verdict] : "unknown";
    },
    [items]
  );

  // 親画面からの transcript / tag / focus を受け取る
  useEffect(() => {
    const unsub = subscribe((ev: BridgeEvent) => {
      if (ev.type === "transcript") {
        setLiveTranscript(ev.text);
      }
      if (ev.type === "fatigue") {
        setFatigue(ev.score);
        setTimeout(() => setFatigue((v) => (v === ev.score ? null : v)), 6000);
      }
      if (ev.type === "focus") {
        // yobina が一致する筆を active にする
        setItems((cur) => {
          const match = cur.find((x) => x.card.yobina === ev.yobina);
          if (match) {
            setActiveId(match.card.id);
            fetch("/api/next-question", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ card: match.card }),
            }).then((r) => r.json()).then((j: { question: NextQuestion | null }) => setQuestion(j.question));
          }
          return cur;
        });
      }
      if (ev.type === "tag") {
        const patch = nouToFudePatch(ev.result.noul);
        if (Object.keys(patch).length === 0) return;
        setItems((cur) => {
          const idx = cur.findIndex((x) => x.card.yobina === ev.result.choice || x.card.id === activeId);
          if (idx < 0) return cur;
          const base = cur[idx].card;
          const updated: FudeCard = { ...base, ...patch, shogen: (base.shogen ? base.shogen + " " : "") + ev.text };
          const next = cur.slice();
          next[idx] = { ...cur[idx], card: updated };
          // 判定を更新
          fetch("/api/judge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ card: updated }),
          })
            .then((r) => r.json())
            .then((nj: JudgeResult) => {
              setItems((cur2) => {
                const idx2 = cur2.findIndex((x) => x.card.id === updated.id);
                if (idx2 < 0) return cur2;
                const n2 = cur2.slice();
                n2[idx2] = { card: updated, judge: nj };
                return n2;
              });
              if (updated.id === activeId) {
                fetch("/api/next-question", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ card: updated }),
                })
                  .then((r) => r.json())
                  .then((j: { question: NextQuestion | null }) => setQuestion(j.question));
              }
            });
          return next;
        });
      }
    });
    return unsub;
  }, [activeId]);

  // 親に読み上げを依頼する
  const sayToParent = useCallback((msg: string, yobina?: string) => {
    publish({ type: "say", message: msg, yobina, at: Date.now() });
  }, []);

  const answer = useCallback(async (choice: 0 | 1) => {
    if (!active || !question) return;
    // 親の答えで該当項目を埋める。簡易：choice=0 なら「有」寄り、=1 なら「無」寄り
    const updated: FudeCard = { ...active.card };
    const yes = choice === 0;
    switch (question.code) {
      case "Q_BOUNDARY":
        updated.boundary = yes ? "隣地と確認済・境界杭あり" : "親の証言のみ（栗の木まで）";
        break;
      case "Q_BUILDING":
        updated.building = yes ? "有（屋根と壁あり・未登記）" : "無";
        break;
      case "Q_USE_BY_OTHERS":
        updated.others_use = yes ? "有（口約束で耕作）" : "無";
        break;
      case "Q_SECURITY":
        updated.rights = yes ? "有（抵当権の可能性）" : "無";
        break;
      case "Q_FOREST_CARE":
        updated.forest_care = yes ? "一通り手入れされている" : "植林後に間伐されていない";
        break;
      case "Q_CLIFF":
        updated.cliff = yes ? "有（高さ約4m）" : "無";
        break;
      case "Q_UNDERGROUND":
        updated.underground = yes ? "有（埋めた覚え）" : "無";
        break;
      case "Q_DEBT":
        updated.recurring_charges = yes ? "有（土地改良区の賦課金）" : "無";
        break;
    }
    const r = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card: updated }),
    });
    const nj = (await r.json()) as JudgeResult;
    const next = items.map((x) => (x.card.id === active.card.id ? { card: updated, judge: nj } : x));
    setItems(next);
    // 次の質問
    const r2 = await fetch("/api/next-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card: updated }),
    });
    const qj = (await r2.json()) as { question: NextQuestion | null };
    setQuestion(qj.question);
  }, [active, items, question]);

  return (
    <main className="min-h-screen px-6 pt-6 pb-10">
      <header className="flex items-center justify-between pb-4">
        <BrandMark size="sm" />
        <nav className="flex gap-5 text-sm text-sumi-500">
          <Link href="/" className="hover:text-sumi-900">はじめから</Link>
          <Link href="/parent" className="hover:text-sumi-900">親の画面</Link>
          <Link href="/counter" className="hover:text-sumi-900">窓口の画面</Link>
        </nav>
      </header>

      <div className="mb-4 flex items-stretch gap-3">
        <div className="flex-1">
          <DeadlineBar />
        </div>
        {question && (
          <button
            onClick={() => sayToParent(question.prompt, active?.card.yobina || active?.card.chiban)}
            className="px-4 py-2 rounded-md bg-washi border border-sumi-300 text-sumi-700 font-mincho text-sm hover:bg-sumi-50"
            title="親の画面に音声で読み上げを依頼"
          >
            親に読み上げる
          </button>
        )}
      </div>

      {(liveTranscript || fatigue !== null) && (
        <div className="mb-4 flex items-start gap-3">
          {liveTranscript && (
            <div className="flex-1 bg-washi border border-sumi-300 rounded-md px-4 py-3 stroke-edge">
              <div className="text-xs font-mincho text-sumi-400">親の発話（Live）</div>
              <div className="font-fude text-lg text-sumi-900 leading-snug mt-1">「{liveTranscript}」</div>
            </div>
          )}
          {fatigue !== null && (
            <div className="bg-beni/10 border border-beni/30 rounded-md px-4 py-3 w-56">
              <div className="text-xs font-mincho text-beni">親の疲れ</div>
              <div className="font-fude text-xl text-beni leading-snug mt-1">少し休んでもらう</div>
              <div className="text-xs font-mincho text-sumi-500 mt-1">score {fatigue}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4" style={{ height: "calc(100vh - 180px)" }}>
        <section className="col-span-7 flex flex-col gap-4 min-h-0">
          <div className="h-[52%] min-h-0">
            {geo ? (
              <MapView geo={geo} activeId={activeId} verdictOf={verdictOf} onSelect={selectCard} />
            ) : (
              <div className="w-full h-full bg-washi border border-sumi-200 rounded-md" />
            )}
          </div>
          <div className="flex-1 min-h-0">
            <JudgmentLanes items={items} activeId={activeId} onSelect={selectCard} intentOf={intentOf} />
          </div>
        </section>

        <aside className="col-span-5 min-h-0 overflow-y-auto space-y-4">
          {active ? (
            <>
              <FudeCardPanel card={active.card} judge={active.judge} question={question} onAnswer={answer} />
              <FamilyIntents fudeId={active.card.id} yobina={active.card.yobina || active.card.chiban} />
            </>
          ) : (
            <div className="h-full grid place-items-center text-sumi-400 font-mincho">地図かレーンから一筆を選ぶ</div>
          )}
        </aside>
      </div>
    </main>
  );
}
