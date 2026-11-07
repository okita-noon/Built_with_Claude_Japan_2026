"use client";
import {
  INTENTS,
  MEMBERS,
  type Intent,
  type IntentResolution,
  type IntentVote,
  type MemberId,
} from "./types";

const STORAGE_KEY = "fudekoe.intents.v1";
const ACTIVE_MEMBER_KEY = "fudekoe.active-member.v1";

function readAll(): IntentVote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IntentVote[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => INTENTS.includes(v.intent as Intent));
  } catch {
    return [];
  }
}

function writeAll(votes: IntentVote[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
  window.dispatchEvent(new Event("fudekoe:intents-changed"));
}

export function getVotes(): IntentVote[] {
  return readAll();
}

export function getVote(member: MemberId, fudeId: string): IntentVote | null {
  return readAll().find((v) => v.member === member && v.fude_id === fudeId) ?? null;
}

export function setVote(member: MemberId, fudeId: string, intent: Intent): void {
  const all = readAll().filter((v) => !(v.member === member && v.fude_id === fudeId));
  all.push({ member, fude_id: fudeId, intent, at: Date.now() });
  writeAll(all);
}

export function clearVote(member: MemberId, fudeId: string): void {
  const all = readAll().filter((v) => !(v.member === member && v.fude_id === fudeId));
  writeAll(all);
}

export function resolveFude(fudeId: string, votes = readAll()): IntentResolution {
  const forFude = votes.filter((v) => v.fude_id === fudeId);
  const submitted = forFude.length;
  const total = MEMBERS.length;
  if (submitted < total) return { kind: "pending", submitted, total };
  const first = forFude[0].intent;
  if (forFude.every((v) => v.intent === first)) {
    return { kind: "unanimous", intent: first };
  }
  return {
    kind: "split",
    votes: MEMBERS.map((m) => {
      const v = forFude.find((x) => x.member === m.id);
      return { member: m.id, intent: v!.intent };
    }),
  };
}

export function getActiveMember(): MemberId {
  if (typeof window === "undefined") return "self";
  const v = window.localStorage.getItem(ACTIVE_MEMBER_KEY);
  if (v && MEMBERS.some((m) => m.id === v)) return v as MemberId;
  return "self";
}

export function setActiveMember(id: MemberId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_MEMBER_KEY, id);
  window.dispatchEvent(new Event("fudekoe:active-member-changed"));
}

export function memberLabel(id: MemberId): string {
  return MEMBERS.find((m) => m.id === id)?.label ?? id;
}
