import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Gemini Live API のブラウザ接続用に、サーバーで短命トークンを発行する。
 *
 * - サーバー側の GEMINI_API_KEY は流さない。
 * - 下記は Google AI Studio の ephemeral token 発行 API の最小呼び出し。
 *   実パスは Google 側の正式仕様に合わせて差し替える。
 *
 * GEMINI_API_KEY が未設定なら 501 を返し、ブラウザ側はキャンド transcript に
 * フォールバックする運用（デモ用）。
 */
/** 鍵があるかだけを返す（トークンは消費しない） */
export async function GET() {
  return NextResponse.json({ available: Boolean(process.env.GEMINI_API_KEY) });
}

export async function POST() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "GEMINI_API_KEY が未設定です。デモは `demo-transcript` にフォールバックしてください。",
        fallback: "demo-transcript",
      },
      { status: 501 }
    );
  }

  try {
    // 公式の Google AI SDK の auth_tokens エンドポイント。URL と形は本番で
    // 更新される可能性があるので docs 側で最新を確認する。
    const model = "models/" + (process.env.GEMINI_LIVE_MODEL || "gemini-live-2.5-flash-preview").replace(/^models\//, "");
    const now = Date.now();
    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=" + encodeURIComponent(key),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uses: 1,
          expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
          // トークンで使える設定をここで固定する（ブラウザ側の setup と同じ内容）
          bidiGenerateContentSetup: {
            model,
            generationConfig: { responseModalities: ["AUDIO"] },
            inputAudioTranscription: {},
          },
        }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `gemini token http ${resp.status}: ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const data = (await resp.json()) as { name?: string };
    if (!data.name) {
      return NextResponse.json({ error: "no token in gemini response" }, { status: 502 });
    }
    return NextResponse.json({ token: data.name, model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
