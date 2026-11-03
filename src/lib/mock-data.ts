import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FudeCard } from "./types.ts";

const ROOT = process.cwd();

export function loadFude(): FudeCard[] {
  const txt = readFileSync(resolve(ROOT, "data/demo/fude.json"), "utf-8");
  return JSON.parse(txt) as FudeCard[];
}

export function loadGeojson(): unknown {
  const txt = readFileSync(resolve(ROOT, "data/demo/fude.geojson"), "utf-8");
  return JSON.parse(txt);
}

export function loadTaxSlip(): unknown {
  const txt = readFileSync(resolve(ROOT, "data/demo/tax-slip.json"), "utf-8");
  return JSON.parse(txt);
}

export function loadShogen(): Array<{ id: string; fude_candidates: string[]; text: string; tags: string[] }> {
  const txt = readFileSync(resolve(ROOT, "data/demo/shogen.json"), "utf-8");
  return JSON.parse(txt);
}
