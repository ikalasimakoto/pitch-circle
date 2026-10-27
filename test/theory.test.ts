import { test } from "node:test";
import assert from "node:assert/strict";
import {
  spell, degreeLabel, intervalAnalysis, transpositionalSymmetry, modes, normalize,
} from "../src/theory.ts";
import { identifyChord, subsets } from "../src/chords.ts";
import { transposeSpec, modeOnCenter, namedModes } from "../src/ops.ts";
import { emptySet } from "../src/types.ts";

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const names = (pcs: number[], center: number | null) =>
  pcs.map((p) => spell(p, { pcs, center }));

test("spelling follows the degree letters", () => {
  assert.deepEqual(names([0, 2, 3, 5, 7, 8, 10], 0), ["C", "D", "E♭", "F", "G", "A♭", "B♭"]);
  // F♯ major: E♯ is avoided and falls back to F.
  assert.deepEqual(names([6, 8, 10, 11, 1, 3, 5], 6), ["F♯", "G♯", "A♯", "B", "C♯", "D♯", "F"]);
  assert.deepEqual(names([0, 2, 4, 6, 7, 9, 11], 0), ["C", "D", "E", "F♯", "G", "A", "B"]);
  assert.deepEqual(names([3, 5, 7, 8, 10, 0, 2], 3), ["E♭", "F", "G", "A♭", "B♭", "C", "D"]);
  assert.equal(spell(1, { pcs: MAJOR, center: 0, spelling: { 1: "sharp" } }), "C♯");
  assert.equal(spell(3, { pcs: [3], center: null }), "D♯");
});

test("contextual tritone and sixth", () => {
  assert.equal(degreeLabel(6, 0, [0, 2, 4, 6, 7, 9, 11]), "♯4");
  assert.equal(degreeLabel(6, 0, [0, 1, 3, 5, 6, 8, 10]), "♭5");
  assert.equal(degreeLabel(8, 0, [0, 4, 8]), "♯5");
  assert.equal(degreeLabel(8, 0, [0, 3, 7, 8]), "m6");
  assert.equal(degreeLabel(2, 0, MAJOR, { 2: "9" }), "9");
});

test("interval-class vector", () => {
  assert.deepEqual(intervalAnalysis(MAJOR).vector, [2, 5, 4, 3, 6, 1]);
  assert.deepEqual(intervalAnalysis([0, 4, 7]).pairs[4], [[0, 7]]);
});

test("transpositional symmetry", () => {
  assert.deepEqual(transpositionalSymmetry([0, 2, 4, 6, 8, 10]), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(transpositionalSymmetry([0, 1, 3, 4, 6, 7, 9, 10]), [0, 3, 6, 9]);
  assert.deepEqual(transpositionalSymmetry(MAJOR), [0]);
});

test("modes", () => {
  const m = modes(MAJOR);
  assert.deepEqual(m[1], { center: 2, intervals: [0, 2, 3, 5, 7, 9, 10] });
  const named = namedModes(MAJOR, [{ name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] }]);
  assert.deepEqual(named[1].names, ["Dorian"]);
  assert.deepEqual(named[0].names, []);
});

test("chord names", () => {
  assert.deepEqual(identifyChord([0, 4, 7]).map((c) => c.suffix), [""]);
  assert.deepEqual(identifyChord([0, 4, 7, 9]).map((c) => [c.root, c.suffix]), [[0, "6"], [9, "m7"]]);
  assert.deepEqual(identifyChord([0, 5, 7]).map((c) => [c.root, c.suffix]), [[0, "sus4"], [5, "sus2"]]);
  assert.equal(identifyChord([0, 4, 8]).length, 3);
  assert.equal(identifyChord([0, 1, 2]).length, 0);
});

test("subset counts", () => {
  assert.equal(subsets(MAJOR).length, 120);
  assert.equal(subsets([...Array(12).keys()]).length, 4083);
  const triads = subsets(MAJOR).filter((s) => s.length === 3 && identifyChord(s).some((c) => ["", "m", "dim"].includes(c.suffix)));
  assert.equal(triads.length, 7);
});

test("transpose and mode-on-center", () => {
  const spec = { ...emptySet(), subsets: [{ pcs: [0, 4, 7], color: "#f00" }] };
  const up = transposeSpec(spec, 1);
  assert.deepEqual(up.pcs, normalize(MAJOR.map((p) => p + 1)));
  assert.equal(up.center, 1);
  assert.deepEqual(up.subsets[0].pcs, [1, 5, 8]);
  // D dorian read on C: C dorian.
  const cDorian = modeOnCenter(spec, 2);
  assert.deepEqual(cDorian.pcs, [0, 2, 3, 5, 7, 9, 10]);
  assert.equal(cDorian.center, 0);
});
