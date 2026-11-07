import { NextResponse } from "next/server";
import { guard } from "@/lib/guard";
import { isClaudeConfigured, guardWithClaude } from "@/lib/claude";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    kind?: "prompt" | "output";
    input?: string;
    mode?: "mock" | "claude";
  };
  if (!body?.kind || !body?.input) {
    return NextResponse.json({ error: "kind and input are required" }, { status: 400 });
  }

  const useClaude = body.mode !== "mock" && isClaudeConfigured();
  if (useClaude) {
    try {
      const result = await guardWithClaude(body.kind, body.input);
      return NextResponse.json({ ...result, engine: "claude" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ...guard(body.kind, body.input), engine: "mock-fallback", error: msg });
    }
  }
  return NextResponse.json({ ...guard(body.kind, body.input), engine: "mock" });
}
