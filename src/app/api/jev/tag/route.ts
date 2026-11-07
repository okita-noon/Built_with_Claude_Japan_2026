import { NextResponse } from "next/server";
import { tagTranscript } from "@/lib/jev";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string; candidates?: string[] };
  if (!body?.text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const result = await tagTranscript(body.text, body.candidates);
  return NextResponse.json(result);
}
