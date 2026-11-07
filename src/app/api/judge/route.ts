import { NextResponse } from "next/server";
import { judge } from "@/lib/judge";
import { isClaudeConfigured, judgeWithClaude } from "@/lib/claude";
import type { FudeCard } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { card?: FudeCard; mode?: "mock" | "claude" };
  if (!body?.card) return NextResponse.json({ error: "card is required" }, { status: 400 });

  const useClaude = body.mode !== "mock" && isClaudeConfigured();
  if (useClaude) {
    try {
      const result = await judgeWithClaude(body.card);
      return NextResponse.json({ ...result, engine: "claude" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const fallback = judge(body.card);
      return NextResponse.json({ ...fallback, engine: "mock-fallback", error: msg });
    }
  }
  return NextResponse.json({ ...judge(body.card), engine: "mock" });
}
