// Storage for saved sets and scale presets, with two backends:
//
// - "files": the dev server (`npm run dev`, see vite.config.ts) writes sets to
//   ./library/*.json and presets to ./config/scales.json. This is the main,
//   durable copy on the Mac.
// - "browser": the static build (e.g. on GitHub Pages) has no server, so it
//   keeps both in this browser's localStorage. Each device has its own copy;
//   the library's JSON export/import moves sets between devices.

import type { PitchSet, ScalePreset } from "../src/types.ts";
import { DEFAULT_SCALES } from "../src/presets.ts";

export interface StoredSet {
  id: string;
  createdAt?: string;
  savedAt: string;
  set: PitchSet;
}

export const STORAGE: "files" | "browser" = import.meta.env.DEV ? "files" : "browser";

const BASE = "/api/library";
const LS_LIBRARY = "pitch-circle.library";
const LS_SCALES = "pitch-circle.scales";

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    throw new Error(`browser storage unavailable (${e})`);
  }
}

export async function listLibrary(): Promise<StoredSet[]> {
  if (STORAGE === "browser") return readLocal<StoredSet[]>(LS_LIBRARY, []);
  const r = await fetch(BASE);
  if (!r.ok) throw new Error(`list failed (${r.status})`);
  return r.json();
}

export async function saveLibrary(id: string, set: PitchSet, createdAt?: string): Promise<StoredSet> {
  if (STORAGE === "browser") {
    const list = readLocal<StoredSet[]>(LS_LIBRARY, []);
    const prev = list.find((s) => s.id === id);
    const now = new Date().toISOString();
    const rec: StoredSet = { id, createdAt: prev?.createdAt ?? createdAt ?? now, savedAt: now, set };
    writeLocal(LS_LIBRARY, [rec, ...list.filter((s) => s.id !== id)]);
    return rec;
  }
  const r = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(set),
  });
  if (!r.ok) throw new Error(`save failed (${r.status})`);
  return r.json();
}

export async function deleteLibrary(id: string): Promise<void> {
  if (STORAGE === "browser") {
    writeLocal(LS_LIBRARY, readLocal<StoredSet[]>(LS_LIBRARY, []).filter((s) => s.id !== id));
    return;
  }
  const r = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!r.ok && r.status !== 204) throw new Error(`delete failed (${r.status})`);
}

export async function loadScales(): Promise<ScalePreset[]> {
  if (STORAGE === "browser") return readLocal<ScalePreset[]>(LS_SCALES, DEFAULT_SCALES);
  const r = await fetch("/api/scales");
  if (!r.ok) throw new Error(`scales failed (${r.status})`);
  return r.json();
}

export async function saveScales(list: ScalePreset[]): Promise<ScalePreset[]> {
  if (STORAGE === "browser") {
    writeLocal(LS_SCALES, list);
    return list;
  }
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
