import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

const BOT_UA_PATTERNS: RegExp[] = [
  /GPTBot/i,
  /OAI-SearchBot/i,
  /ChatGPT-User/i,
  /ClaudeBot/i,
  /anthropic-ai/i,
  /Claude-Web/i,
  /CCBot/i,
  /Google-Extended/i,
  /PerplexityBot/i,
  /Perplexity-User/i,
  /Bytespider/i,
  /Amazonbot/i,
  /facebookexternalhit/i,
  /Meta-ExternalAgent/i,
  /cohere-ai/i,
  /Diffbot/i,
  /DataForSeoBot/i,
  /SemrushBot/i,
  /AhrefsBot/i,
  /MJ12bot/i,
  /DotBot/i,
  /PetalBot/i,
  /scrapy/i,
];

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";

  if (!ua.trim()) {
    return new NextResponse("bot blocked", { status: 403 });
  }
  if (BOT_UA_PATTERNS.some((p) => p.test(ua))) {
    return new NextResponse("bot blocked", { status: 403 });
  }

  return NextResponse.next();
}
