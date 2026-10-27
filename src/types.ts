// Data spec: one pitch-class set with its analysis settings and display options.
// Plain JSON so it can be saved, diffed, and written by hand or by an AI.

import type { Accidental } from "./theory.ts";

export type LabelMode = "note" | "degree" | "none";

export interface Subset {
  /** Pitch classes (C = 0), absolute — they move with transposition. */
  pcs: number[];
  color: string;
}

export interface Display {
  label: LabelMode;
  /** What sits at 12 o'clock: always C, or the center. */
  top: "C" | "center";
  showSetPolygon: boolean;
  showTitle: boolean;
  showLegend: boolean;
}

export interface PitchSet {
  version: 1;
  meta: { title: string; tags: string[] };
  pcs: number[];
  center: number | null;
  /** Manual ♯/♭ per pitch class (keys "0"–"11"). */
  spelling: Partial<Record<number, Accidental>>;
  /** Degree label overrides keyed by semitones above the center. */
  degreeNames: Partial<Record<number, string>>;
  subsets: Subset[];
  display: Display;
}

/** A scale preset: intervals above its root (0 first). */
export interface ScalePreset {
  name: string;
  intervals: number[];
}

export function emptySet(): PitchSet {
  return {
    version: 1,
    meta: { title: "", tags: [] },
    pcs: [0, 2, 4, 5, 7, 9, 11],
    center: 0,
    spelling: {},
    degreeNames: {},
    subsets: [],
    display: { label: "note", top: "C", showSetPolygon: true, showTitle: true, showLegend: true },
  };
}

/** Fill in fields missing from older or hand-written files. */
export function withDefaults(raw: Partial<PitchSet>): PitchSet {
  const base = emptySet();
  return {
    ...base,
    ...raw,
    meta: { ...base.meta, ...raw.meta },
    display: { ...base.display, ...raw.display },
    spelling: raw.spelling ?? {},
    degreeNames: raw.degreeNames ?? {},
    subsets: raw.subsets ?? [],
    pcs: raw.pcs ?? base.pcs,
    center: raw.center === undefined ? base.center : raw.center,
  };
}
