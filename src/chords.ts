// Chord identification and subset enumeration.

import { mod12, normalize, sameSet } from "./theory.ts";

export type ChordKind = "triad" | "tetrad";

interface ChordType {
  suffix: string;
  intervals: number[];
  kind: ChordKind;
}

/** Named 3- and 4-note chords: tertian triads and sevenths, plus sus and sixths. */
export const CHORD_TYPES: readonly ChordType[] = [
  { suffix: "", intervals: [0, 4, 7], kind: "triad" },
  { suffix: "m", intervals: [0, 3, 7], kind: "triad" },
  { suffix: "dim", intervals: [0, 3, 6], kind: "triad" },
  { suffix: "aug", intervals: [0, 4, 8], kind: "triad" },
  { suffix: "sus4", intervals: [0, 5, 7], kind: "triad" },
  { suffix: "sus2", intervals: [0, 2, 7], kind: "triad" },
  { suffix: "maj7", intervals: [0, 4, 7, 11], kind: "tetrad" },
  { suffix: "7", intervals: [0, 4, 7, 10], kind: "tetrad" },
  { suffix: "m7", intervals: [0, 3, 7, 10], kind: "tetrad" },
  { suffix: "mM7", intervals: [0, 3, 7, 11], kind: "tetrad" },
  { suffix: "m7♭5", intervals: [0, 3, 6, 10], kind: "tetrad" },
  { suffix: "dim7", intervals: [0, 3, 6, 9], kind: "tetrad" },
  { suffix: "augM7", intervals: [0, 4, 8, 11], kind: "tetrad" },
  { suffix: "7♯5", intervals: [0, 4, 8, 10], kind: "tetrad" },
  { suffix: "6", intervals: [0, 4, 7, 9], kind: "tetrad" },
  { suffix: "m6", intervals: [0, 3, 7, 9], kind: "tetrad" },
];

export interface ChordName {
  root: number;
  suffix: string;
  kind: ChordKind;
}

/** Every reading of the set as a named chord, one per possible root. */
export function identifyChord(pcs: readonly number[]): ChordName[] {
  const s = normalize(pcs);
  const out: ChordName[] = [];
  for (const root of s) {
    const rel = s.map((p) => mod12(p - root));
    for (const t of CHORD_TYPES) {
      if (t.intervals.length === s.length && sameSet(rel, t.intervals)) {
        out.push({ root, suffix: t.suffix, kind: t.kind });
      }
    }
  }
  return out;
}

/** All subsets with at least `min` notes, grouped by size ascending, each sorted. */
export function subsets(pcs: readonly number[], min = 2): number[][] {
  const s = normalize(pcs);
  const out: number[][] = [];
  for (let mask = 1; mask < 1 << s.length; mask++) {
    const sub = s.filter((_, i) => mask & (1 << i));
    if (sub.length >= min) out.push(sub);
  }
  return out.sort((a, b) => a.length - b.length || compareLex(a, b));
}

function compareLex(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
