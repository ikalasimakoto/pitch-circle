// Whole-spec operations used by the GUI and available headlessly.

import type { PitchSet, ScalePreset } from "./types.ts";
import { mod12, normalize, transpose, sameSet, modes } from "./theory.ts";

/**
 * Transpose everything: the set, the center and the drawn subsets. Manual ♯/♭
 * choices stay on their pitch classes; automatic spelling follows the new
 * center. Degree overrides are relative to the center, so they stay too.
 */
export function transposeSpec(spec: PitchSet, t: number): PitchSet {
  return {
    ...spec,
    pcs: transpose(spec.pcs, t),
    center: spec.center == null ? null : mod12(spec.center + t),
    subsets: spec.subsets.map((s) => ({ ...s, pcs: transpose(s.pcs, t) })),
  };
}

/** Same notes, new center. */
export function withCenter(spec: PitchSet, center: number | null): PitchSet {
  return { ...spec, center: center == null ? null : mod12(center) };
}

/**
 * Keep the current center but rebuild the set as the mode that starts on
 * `member`: transpose so that `member` lands on the center.
 */
export function modeOnCenter(spec: PitchSet, member: number): PitchSet {
  if (spec.center == null) return spec;
  return { ...transposeSpec(spec, spec.center - member), center: spec.center };
}

/** Intervals of the set above a center, or null without one. */
export function intervalsFromCenter(pcs: readonly number[], center: number | null): number[] | null {
  if (center == null) return null;
  return normalize(pcs.map((p) => p - center));
}

export interface NamedIntervals {
  name: string;
  intervals: number[];
}

/** Names (from presets or saved sets) whose interval pattern equals the given one. */
export function matchNames(intervals: readonly number[], known: readonly NamedIntervals[]): string[] {
  return [...new Set(known.filter((k) => sameSet(k.intervals, intervals)).map((k) => k.name))];
}

/** Each mode of the set with the names it matches. */
export function namedModes(pcs: readonly number[], known: readonly NamedIntervals[]) {
  return modes(pcs).map((m) => ({ ...m, names: matchNames(m.intervals, known) }));
}

export function presetToPcs(preset: ScalePreset, root: number): number[] {
  return transpose(preset.intervals, root);
}
