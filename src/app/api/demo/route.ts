import { NextResponse } from "next/server";
import { loadFude, loadGeojson, loadShogen, loadTaxSlip } from "@/lib/mock-data";
import { judge } from "@/lib/judge";

export const dynamic = "force-dynamic";

export async function GET() {
  const fude = loadFude();
  const geo = loadGeojson();
  const shogen = loadShogen();
  const tax = loadTaxSlip();
  const judged = fude.map((f) => ({ card: f, judge: judge(f) }));
  return NextResponse.json({ fude: judged, geo, shogen, tax });
}
