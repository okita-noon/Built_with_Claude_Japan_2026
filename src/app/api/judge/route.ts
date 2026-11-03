import { NextResponse } from "next/server";
import { judge } from "@/lib/judge";
import type { FudeCard } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as { card?: FudeCard };
  if (!body?.card) return NextResponse.json({ error: "card is required" }, { status: 400 });
  return NextResponse.json(judge(body.card));
}
