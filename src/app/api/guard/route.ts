import { NextResponse } from "next/server";
import { guard } from "@/lib/guard";

export async function POST(req: Request) {
  const body = (await req.json()) as { kind?: "prompt" | "output"; input?: string };
  if (!body?.kind || !body?.input) return NextResponse.json({ error: "kind and input are required" }, { status: 400 });
  return NextResponse.json(guard(body.kind, body.input));
}
