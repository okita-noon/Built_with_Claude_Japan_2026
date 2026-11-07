"use client";
import type { JevTagResult } from "./jev";

/**
 * 親の画面と家族の画面のあいだを BroadcastChannel で中継する。
 * 同じオリジンの別タブに届く。Gemini Live の文字起こしをそのまま流す。
 */

export type BridgeEvent =
  | { type: "transcript"; text: string; at: number }
  | { type: "tag"; text: string; result: JevTagResult; at: number }
  | { type: "fatigue"; score: number; at: number }
  | { type: "say"; message: string; yobina?: string; at: number }  // 家族 → 親：読み上げ指示（親の画面にも同じ質問を出す）
  | { type: "focus"; yobina: string; at: number };

const CHANNEL = "fudekoe.bridge.v1";

let ch: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!ch) ch = new BroadcastChannel(CHANNEL);
  return ch;
}

export function publish(ev: BridgeEvent): void {
  const c = getChannel();
  if (!c) return;
  c.postMessage(ev);
}

export function subscribe(handler: (ev: BridgeEvent) => void): () => void {
  const c = getChannel();
  if (!c) return () => {};
  const onMsg = (e: MessageEvent<BridgeEvent>) => handler(e.data);
  c.addEventListener("message", onMsg);
  return () => c.removeEventListener("message", onMsg);
}
