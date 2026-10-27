// Clients for the dev-server APIs (see vite.config.ts). Sets persist as JSON
// files under ./library; scale presets in ./config/scales.json.

import type { PitchSet, ScalePreset } from "../src/types.ts";

export interface StoredSet {
  id: string;
  createdAt?: string;
  savedAt: string;
  set: PitchSet;
}

const BASE = "/api/library";

export async function listLibrary(): Promise<StoredSet[]> {
  const r = await fetch(BASE);
  if (!r.ok) throw new Error(`list failed (${r.status})`);
  return r.json();
}

export async function saveLibrary(id: string, set: PitchSet): Promise<StoredSet> {
  const r = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(set),
  });
  if (!r.ok) throw new Error(`save failed (${r.status})`);
  return r.json();
}

export async function deleteLibrary(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!r.ok && r.status !== 204) throw new Error(`delete failed (${r.status})`);
}

export async function loadScales(): Promise<ScalePreset[]> {
  const r = await fetch("/api/scales");
  if (!r.ok) throw new Error(`scales failed (${r.status})`);
  return r.json();
}

export async function saveScales(list: ScalePreset[]): Promise<ScalePreset[]> {
  const r = await fetch("/api/scales", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(list),
  });
  if (!r.ok) throw new Error(`save scales failed (${r.status})`);
  return r.json();
}

/** Human-readable, filesystem-safe id derived from the title plus a short suffix. */
export function makeId(title: string): string {
  const slug =
    (title || "set")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "set";
  const rand = Math.random().toString(16).slice(2, 6);
  return `${slug}-${rand}`;
}
