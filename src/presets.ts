// Default scale presets: intervals above the root. The dev server seeds
// config/scales.json from this list; the static build seeds browser storage.

import type { ScalePreset } from "./types.ts";

export const DEFAULT_SCALES: ScalePreset[] = [
  { name: "Major (Ionian)", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { name: "Natural minor (Aeolian)", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
  { name: "Harmonic minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
  { name: "Phrygian dominant", intervals: [0, 1, 4, 5, 7, 8, 10] },
  { name: "Melodic minor", intervals: [0, 2, 3, 5, 7, 9, 11] },
  { name: "Lydian dominant", intervals: [0, 2, 4, 6, 7, 9, 10] },
  { name: "Altered", intervals: [0, 1, 3, 4, 6, 8, 10] },
  { name: "Major pentatonic", intervals: [0, 2, 4, 7, 9] },
  { name: "Minor pentatonic", intervals: [0, 3, 5, 7, 10] },
  { name: "Blues", intervals: [0, 3, 5, 6, 7, 10] },
  { name: "Whole tone", intervals: [0, 2, 4, 6, 8, 10] },
  { name: "Diminished (half-whole)", intervals: [0, 1, 3, 4, 6, 7, 9, 10] },
  { name: "Diminished (whole-half)", intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
  { name: "Chromatic", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];
