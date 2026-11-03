import { NextResponse } from "next/server";
import { judge } from "@/lib/judge";
import { pickNextQuestion } from "@/lib/next-question";
import type { FudeCard } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as { card?: FudeCard };
  if (!body?.card) return NextResponse.json({ error: "card is required" }, { status: 400 });
  const j = judge(body.card);
  const q = pickNextQuestion(body.card, j);
  return NextResponse.json({ question: q, judge: j });
}
