import { NextResponse } from "next/server";
import { loadTaxSlip } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function POST() {
  // 本物の画像入力は接続後に差し替え。今は固定の課税明細書を返す。
  const slip = loadTaxSlip();
  return NextResponse.json(slip);
}
