"use client";

/**
 * Gemini Live API へのブラウザ直結（ephemeral token）。
 *
 * - 親の声を 16kHz / 16bit PCM にしてそのまま流し、入力の文字起こし
 *   （inputTranscription）だけを使う。Gemini 側の返答音声は再生しない。
 *   親に聞き返す文は Claude が作り、ガードを通したものだけを家族が読み上げる。
 * - 発話の区切りは Gemini のサーバー側 VAD に任せ、turnComplete で1発話を確定する。
 *
 * 鍵がない環境ではトークン発行が 501 になり、親の画面はキャンド transcript で動く。
 */

const WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

export type LiveHandlers = {
  /** 文字起こしの途中経過（同じ発話の中で伸びていく） */
  onPartial?: (text: string) => void;
  /** 1発話が確定した */
  onUtterance: (text: string) => void;
  /** マイクの音量（0〜1）。話すボタンの輪に使う */
  onLevel?: (level: number) => void;
  onState?: (s: "connecting" | "listening" | "closed" | "error", detail?: string) => void;
};

export type LiveSession = { stop: () => void };

const WORKLET = `
class PcmDown extends AudioWorkletProcessor {
  constructor() { super(); this.ratio = sampleRate / 16000; this.acc = []; this.pos = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    // 単純な間引き（音声認識用途には十分）
    for (; this.pos < ch.length; this.pos += this.ratio) {
      const s = Math.max(-1, Math.min(1, ch[Math.floor(this.pos)]));
      this.acc.push(s < 0 ? s * 0x8000 : s * 0x7fff);
    }
    this.pos -= ch.length;
    if (this.acc.length >= 1600) { // 100ms ごとに送る
      const buf = new Int16Array(this.acc);
      this.acc = [];
      this.port.postMessage({ pcm: buf.buffer, level: Math.sqrt(sum / ch.length) }, [buf.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-down", PcmDown);
`;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export async function fetchLiveToken(): Promise<{ token: string; model: string } | null> {
  try {
    const r = await fetch("/api/gemini/token", { method: "POST" });
    if (!r.ok) return null;
    const j = (await r.json()) as { token?: string; model?: string };
    return j.token && j.model ? { token: j.token, model: j.model } : null;
  } catch {
    return null;
  }
}

export async function startLive(h: LiveHandlers): Promise<LiveSession> {
  h.onState?.("connecting");
  const tok = await fetchLiveToken();
  if (!tok) {
    h.onState?.("error", "token");
    throw new Error("Gemini のトークンが取れません");
  }

  const media = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const src = ctx.createMediaStreamSource(media);
  const node = new AudioWorkletNode(ctx, "pcm-down");
  src.connect(node);

  const ws = new WebSocket(`${WS_URL}?access_token=${encodeURIComponent(tok.token)}`);
  let ready = false;
  let partial = "";
  let closed = false;

  const stop = () => {
    if (closed) return;
    closed = true;
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    } catch {}
    try { ws.close(); } catch {}
    node.disconnect();
    src.disconnect();
    media.getTracks().forEach((t) => t.stop());
    void ctx.close();
    if (partial.trim()) h.onUtterance(partial.trim());
    partial = "";
    h.onState?.("closed");
  };

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        setup: {
          model: tok.model,
          generationConfig: { responseModalities: ["AUDIO"] },
          inputAudioTranscription: {},
          systemInstruction: {
            parts: [{ text: "あなたは聞き役です。返事は「うん」だけにしてください。" }],
          },
        },
      })
    );
  };

  ws.onmessage = async (ev) => {
    const raw = typeof ev.data === "string" ? ev.data : await (ev.data as Blob).text();
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.setupComplete) {
      ready = true;
      h.onState?.("listening");
      return;
    }
    const sc = msg.serverContent;
    if (!sc) return;
    const t: string | undefined = sc.inputTranscription?.text;
    if (t) {
      partial += t;
      h.onPartial?.(partial.trim());
    }
    if ((sc.turnComplete || sc.generationComplete) && partial.trim()) {
      h.onUtterance(partial.trim());
      partial = "";
    }
  };

  ws.onerror = () => h.onState?.("error", "ws");
  ws.onclose = (e) => {
    if (!closed) {
      h.onState?.("error", `closed ${e.code} ${e.reason}`);
      stop();
    }
  };

  node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
    h.onLevel?.(Math.min(1, e.data.level * 4));
    if (!ready || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        realtimeInput: { audio: { data: toBase64(e.data.pcm), mimeType: "audio/pcm;rate=16000" } },
      })
    );
  };

  return { stop };
}
