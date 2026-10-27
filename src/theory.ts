// Music-theory helpers for pitch-class sets: names, spelling, degrees,
// intervals, transposition and symmetry.
//
// Standalone and pure so the renderer, the GUI, tests and headless AI use all
// share it. Pitch classes are integers 0–11 with C = 0.

export type Accidental = "sharp" | "flat";

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

/** How a black-key center is named when nothing else decides it. */
const CENTER_DEFAULT: Accidental[] = [
  "sharp", "flat", "sharp", "flat", "sharp", "sharp", "sharp", "sharp", "flat", "sharp", "flat", "sharp",
];

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** Sorted, de-duplicated pitch classes. */
export function normalize(pcs: readonly number[]): number[] {
  return [...new Set(pcs.map(mod12))].sort((a, b) => a - b);
}

export function transpose(pcs: readonly number[], t: number): number[] {
  return normalize(pcs.map((p) => p + t));
}

export function sameSet(a: readonly number[], b: readonly number[]): boolean {
  const x = normalize(a);
  const y = normalize(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** Plain name with a fixed accidental preference. */
export function plainName(pc: number, acc: Accidental = "sharp"): string {
  return (acc === "flat" ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
}

// ---------- Degrees ----------

/** Default degree labels keyed by semitones above the center (0–11). */
export const DEFAULT_DEGREES = [
  "R", "m2", "M2", "m3", "M3", "P4", "♭5", "P5", "m6", "M6", "m7", "M7",
];

/**
 * Degree label of each semitone class for a given set and center, before user
 * overrides. The tritone and the minor sixth depend on context: a set with a
 * perfect fifth reads the tritone as ♯4; a set with a major third but neither
 * a perfect nor a diminished fifth reads semitone 8 as ♯5 (augmented sound).
 */
export function contextualDegrees(pcs: readonly number[], center: number): string[] {
  const rel = new Set(pcs.map((p) => mod12(p - center)));
  const out = [...DEFAULT_DEGREES];
  if (rel.has(7)) out[6] = "♯4";
  if (rel.has(4) && !rel.has(7) && !rel.has(6)) out[8] = "♯5";
  return out;
}

export function degreeLabel(
  pc: number,
  center: number,
  pcs: readonly number[],
  overrides?: Partial<Record<number, string>>,
): string {
  const semis = mod12(pc - center);
  return overrides?.[semis] ?? contextualDegrees(pcs, center)[semis];
}

/** Scale-step number (1–7) implied by a degree label such as "m3", "♯4", "b9", "13". */
export function degreeStep(label: string): number | null {
  const m = /(\d+)/.exec(label);
  if (label.trim() === "R") return 1;
  if (!m) return null;
  return ((Number(m[1]) - 1) % 7) + 1;
}

// ---------- Spelling ----------

export interface SpellingContext {
  pcs: readonly number[];
  center: number | null;
  /** Manual ♯/♭ choices per pitch class; they always win. */
  spelling?: Partial<Record<number, Accidental>>;
  degreeNames?: Partial<Record<number, string>>;
}

function letterName(letterIdx: number, pc: number): string | null {
  const diff = mod12(pc - LETTER_PC[letterIdx]);
  const letter = LETTERS[letterIdx];
  if (diff === 0) return letter;
  if (diff === 1) return letter + "♯";
  if (diff === 11) return letter + "♭";
  return null; // would need a double accidental
}

const AWKWARD = new Set(["C♭", "F♭", "E♯", "B♯"]);

/** Name of the center itself. */
export function centerName(center: number, spelling?: Partial<Record<number, Accidental>>): string {
  return plainName(center, spelling?.[mod12(center)] ?? CENTER_DEFAULT[mod12(center)]);
}

/**
 * Spell a pitch class. Order of precedence:
 * 1. a manual ♯/♭ choice for that pitch class;
 * 2. with a center, the letter implied by its degree (m3 above E♭ is G♭),
 *    unless that needs a double accidental or C♭/F♭/E♯/B♯;
 * 3. the accidental of the center's key side (flat keys F, B♭, E♭, A♭, D♭).
 */
export function spell(pc: number, ctx: SpellingContext): string {
  const p = mod12(pc);
  const manual = ctx.spelling?.[p];
  if (manual) return plainName(p, manual);
  if (ctx.center == null) return plainName(p, "sharp");
  const c = mod12(ctx.center);
  if (p === c) return centerName(c, ctx.spelling);

  const cName = centerName(c, ctx.spelling);
  const step = degreeStep(degreeLabel(p, c, ctx.pcs, ctx.degreeNames));
  if (step != null) {
    const letterIdx = (LETTERS.indexOf(cName[0]) + step - 1) % 7;
    const name = letterName(letterIdx, p);
    if (name && !AWKWARD.has(name)) return name;
  }
  return plainName(p, keySide(c, ctx.spelling));
}

/** Which accidental the center's key leans to. */
export function keySide(center: number, spelling?: Partial<Record<number, Accidental>>): Accidental {
  const name = centerName(center, spelling);
  return name.includes("♭") || name === "F" ? "flat" : "sharp";
}

// ---------- Intervals ----------

export const IC_LABELS = ["m2/M7", "M2/m7", "m3/M6", "M3/m6", "P4/P5", "TT"];

/** Interval class (1–6) between two pitch classes; 0 for unison. */
export function intervalClass(a: number, b: number): number {
  const d = mod12(b - a);
  return Math.min(d, 12 - d);
}

export interface IntervalAnalysis {
  /** Counts for ic1..ic6. */
  vector: number[];
  /** Pairs [a, b] (a < b) making each ic, index 0 = ic1. */
  pairs: [number, number][][];
}

export function intervalAnalysis(pcs: readonly number[]): IntervalAnalysis {
  const s = normalize(pcs);
  const vector = [0, 0, 0, 0, 0, 0];
  const pairs: [number, number][][] = [[], [], [], [], [], []];
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length; j++) {
      const ic = intervalClass(s[i], s[j]);
      vector[ic - 1]++;
      pairs[ic - 1].push([s[i], s[j]]);
    }
  }
  return { vector, pairs };
}

// ---------- Symmetry ----------

/** Transpositions t (0–11) with T_t(set) = set. Always contains 0 for a non-empty set. */
export function transpositionalSymmetry(pcs: readonly number[]): number[] {
  const s = normalize(pcs);
  if (s.length === 0) return [];
  const out: number[] = [];
  for (let t = 0; t < 12; t++) if (sameSet(transpose(s, t), s)) out.push(t);
  return out;
}

// ---------- Modes ----------

export interface Mode {
  /** The member taken as center. */
  center: number;
  /** Semitones above that center, ascending, starting with 0. */
  intervals: number[];
}

/** One mode per member: the set read from each of its notes. */
export function modes(pcs: readonly number[]): Mode[] {
  const s = normalize(pcs);
  return s.map((c) => ({ center: c, intervals: normalize(s.map((p) => p - c)) }));
}
