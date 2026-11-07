"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { INTENTS, MEMBERS, type Intent, type IntentResolution, type MemberId } from "@/lib/types";
import {
  getActiveMember,
  getVote,
  getVotes,
  memberLabel,
  resolveFude,
  setActiveMember,
  setVote,
} from "@/lib/intents";

type Props = {
  fudeId: string;
  yobina: string;
};

export function FamilyIntents({ fudeId, yobina }: Props) {
  const [active, setActive] = useState<MemberId>("self");
  const [myVote, setMyVote] = useState<Intent | null>(null);
  const [resolution, setResolution] = useState<IntentResolution>({ kind: "pending", submitted: 0, total: MEMBERS.length });
  const [showReveal, setShowReveal] = useState(false);

  useEffect(() => {
    setActive(getActiveMember());
    const onMember = () => setActive(getActiveMember());
    const onVotes = () => refresh();
    window.addEventListener("fudekoe:active-member-changed", onMember);
    window.addEventListener("fudekoe:intents-changed", onVotes);
    return () => {
      window.removeEventListener("fudekoe:active-member-changed", onMember);
      window.removeEventListener("fudekoe:intents-changed", onVotes);
    };
  }, []);

  const refresh = () => {
    const votes = getVotes();
    const r = resolveFude(fudeId, votes);
    setResolution(r);
  };

  useEffect(() => {
    const mine = getVote(active, fudeId);
    setMyVote(mine ? mine.intent : null);
    refresh();
    setShowReveal(false);
  }, [fudeId, active]);

  const submit = (intent: Intent) => {
    setVote(active, fudeId, intent);
    setMyVote(intent);
    const r = resolveFude(fudeId);
    setResolution(r);
    if (r.kind === "unanimous" || r.kind === "split") {
      // reveal を少し遅らせて演出
      setTimeout(() => setShowReveal(true), 250);
    }
  };

  const switchMember = (id: MemberId) => {
    setActiveMember(id);
    setActive(id);
  };

  const otherVoters = resolution.kind === "pending"
    ? resolution.submitted
    : MEMBERS.length;

  return (
    <div className="bg-washi border border-sumi-200 rounded-md shadow-card stroke-edge p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-mincho text-sumi-500">家族の論点</div>
          <div className="font-fude text-xl text-sumi-900 mt-1">{yobina}</div>
        </div>
        <div className="flex items-center gap-1">
          {MEMBERS.map((m) => (
            <button
              key={m.id}
              onClick={() => switchMember(m.id)}
              className={`px-3 py-1.5 rounded-full font-mincho text-xs transition-colors ${
                active === m.id
                  ? "bg-sumi-900 text-washi"
                  : "bg-washi text-sumi-500 border border-sumi-300 hover:bg-sumi-50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 現在のメンバーの意向入力 */}
      <div className="mt-5">
        <div className="font-mincho text-sm text-sumi-600 mb-2">
          {memberLabel(active)}として、{yobina}を—
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {INTENTS.map((it) => {
            const picked = myVote === it;
            return (
              <button
                key={it}
                onClick={() => submit(it)}
                className={`py-3 rounded-sm font-mincho text-sm transition-all ${
                  picked
                    ? "bg-sumi-900 text-washi"
                    : "bg-washi border border-sumi-300 text-sumi-700 hover:bg-sumi-50"
                }`}
              >
                {it}
              </button>
            );
          })}
        </div>
      </div>

      {/* 進捗バー（メンバー数のマスで埋める） */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5">
          {MEMBERS.map((m) => {
            const v = getVote(m.id, fudeId);
            const filled = Boolean(v);
            return (
              <div
                key={m.id}
                title={filled ? `${m.label}：投票済み` : `${m.label}：未投票`}
                className={`flex-1 h-2 rounded-full ${filled ? "bg-sumi-900" : "bg-sumi-200"}`}
              />
            );
          })}
        </div>
        <div className="mt-2 font-mincho text-xs text-sumi-500 tabular">
          {resolution.kind === "pending"
            ? `${resolution.submitted} / ${resolution.total} 人が意向を入れた`
            : `${otherVoters} / ${MEMBERS.length} 人が意向を入れた`}
        </div>
      </div>

      {/* 結果の開示：全員がそろうまで隠す */}
      <AnimatePresence>
        {(resolution.kind !== "pending") && showReveal && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 170, damping: 24 }}
            className="mt-6 border-t border-sumi-200 pt-5"
          >
            {resolution.kind === "unanimous" ? (
              <div>
                <div className="text-xs font-mincho text-sumi-500">全員一致</div>
                <div className="font-fude text-3xl text-sumi-900 mt-1">{resolution.intent}</div>
                <div className="mt-3 font-mincho text-sm text-sumi-600">
                  家族の意向として、{yobina}は <span className="font-bold">{resolution.intent}</span>。
                  窓口に持っていく前に、家族の記録に残しておく。
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs font-mincho text-beni">論点あり</div>
                <div className="font-fude text-xl text-sumi-900 mt-1">家族で話し合う一筆</div>
                <div className="mt-3 grid grid-cols-1 gap-1.5">
                  {resolution.votes.map((v) => (
                    <div
                      key={v.member}
                      className="flex items-center justify-between py-2 px-3 bg-sumi-50 rounded-sm"
                    >
                      <span className="font-mincho text-sm text-sumi-500">{memberLabel(v.member)}</span>
                      <span className="font-fude text-base text-sumi-900">{v.intent}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 font-mincho text-xs text-sumi-500">
                  一致するまでは、家族の画面には開示しません。話し合いの題材としてここに残します。
                </div>
              </div>
            )}
          </motion.div>
        )}

        {resolution.kind === "pending" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 font-mincho text-xs text-sumi-400"
          >
            他の人の意向は、全員がそろうまで見えません。
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
