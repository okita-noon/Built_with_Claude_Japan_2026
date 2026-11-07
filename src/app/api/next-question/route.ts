import { NextResponse } from "next/server";
import { judge } from "@/lib/judge";
import { pickNextQuestion } from "@/lib/next-question";
import { isClaudeConfigured, judgeWithClaude, nextQuestionWithClaude } from "@/lib/claude";
import type { FudeCard } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { card?: FudeCard; mode?: "mock" | "claude" };
  if (!body?.card) return NextResponse.json({ error: "card is required" }, { status: 400 });

  const useClaude = body.mode !== "mock" && isClaudeConfigured();
  if (useClaude) {
    try {
      const j = await judgeWithClaude(body.card);
      const q = await nextQuestionWithClaude(body.card, j);
      return NextResponse.json({ question: q, judge: j, engine: "claude" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const j = judge(body.card);
      const q = pickNextQuestion(body.card, j);
      return NextResponse.json({ question: q, judge: j, engine: "mock-fallback", error: msg });
    }
  }
  const j = judge(body.card);
  const q = pickNextQuestion(body.card, j);
  return NextResponse.json({ question: q, judge: j, engine: "mock" });
}
