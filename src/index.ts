// Public entry point: data spec, theory, set classes, chords and rendering.
export type { PitchSet, Subset, Display, LabelMode, ScalePreset } from "./types.ts";
export { emptySet, withDefaults } from "./types.ts";
export * from "./theory.ts";
export { primeForm, tnPrime, setClass, formatPcs } from "./setclass.ts";
export { identifyChord, subsets, CHORD_TYPES } from "./chords.ts";
export { transposeSpec, withCenter, modeOnCenter, namedModes, matchNames, presetToPcs } from "./ops.ts";
export { renderSvg, subsetLabel, circleIndex } from "./render.ts";
