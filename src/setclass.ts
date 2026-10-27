// Set classes: prime form (Forte's method) and Forte numbers.
//
// A set class groups every set that becomes the same under transposition or
// inversion. On the chromatic circle, members of one class have polygons that
// match by rotation or reflection.

import { FORTE_TABLE } from "./forte-table.ts";
import { mod12, normalize, intervalAnalysis } from "./theory.ts";

/** Each rotation of the sorted set, transposed to start at 0. */
function rotations(s: readonly number[]): number[][] {
  return s.map((_, i) => {
    const rot = [...s.slice(i), ...s.slice(0, i)];
    return rot.map((p) => mod12(p - rot[0]));
  });
}

/**
 * Forte's ordering: smallest span (last element) first, then packed to the
 * left (compare from the second element onward). Rahn compares from the right
 * instead; the two disagree on 5-20, 6-Z29, 6-31, 7-Z18, 7-20 and 8-26.
 */
function forteCompare(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  if (a[n - 1] !== b[n - 1]) return a[n - 1] - b[n - 1];
  for (let i = 1; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function best(cands: number[][]): number[] {
  return cands.reduce((m, c) => (forteCompare(c, m) < 0 ? c : m));
}

/** The most compact transposition of the set alone (its Tn type). */
export function tnPrime(pcs: readonly number[]): number[] {
  const s = normalize(pcs);
  if (s.length === 0) return [];
  return best(rotations(s));
}

/** Prime form under transposition and inversion, by Forte's method. */
export function primeForm(pcs: readonly number[]): number[] {
  const s = normalize(pcs);
  if (s.length === 0) return [];
  const inv = normalize(s.map((p) => -p));
  return best([...rotations(s), ...rotations(inv)]);
}

const HEX = "0123456789TE";
export const formatPcs = (pcs: readonly number[]): string => pcs.map((p) => HEX[p]).join("");

interface ForteEntry {
  number: string;
  prime: number[];
  vector: number[];
}

const BY_PRIME = new Map<string, ForteEntry>(
  FORTE_TABLE.map(([number, prime, vec]) => {
    const entry = {
      number,
      prime: [...prime].map((c) => HEX.indexOf(c)),
      vector: [...vec].map(Number),
    };
    return [prime, entry];
  }),
);

export function forteEntries(): ForteEntry[] {
  return [...BY_PRIME.values()];
}

export interface SetClassInfo {
  prime: number[];
  /** Forte number such as "7-35", or null outside 3–9 notes. */
  forte: string | null;
  /**
   * For asymmetric classes: "A" if the set is a transposition of the prime
   * form, "B" if of its inversion. Null for inversionally symmetric classes.
   */
  version: "A" | "B" | null;
}

export function setClass(pcs: readonly number[]): SetClassInfo {
  const prime = primeForm(pcs);
  const entry = BY_PRIME.get(formatPcs(prime));
  const tn = tnPrime(pcs);
  const invTn = tnPrime(prime.map((p) => -p));
  const symmetric = formatPcs(tnPrime(prime)) === formatPcs(invTn);
  const version = symmetric ? null : formatPcs(tn) === formatPcs(prime) ? "A" : "B";
  return { prime, forte: entry?.number ?? null, version };
}

/** True when the table's interval vector matches the computed one (used by tests). */
export function vectorMatches(entry: ForteEntry): boolean {
  return intervalAnalysis(entry.prime).vector.join("") === entry.vector.join("");
}
