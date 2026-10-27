# pitch-circle

A study tool for pitch-class sets. Pick notes from the 12, and see them on the
circle of fifths and the chromatic circle, with an analysis of degrees,
intervals, subsets and chords, modes, symmetry and set class. Two sets can be
compared side by side. Built in the same way as `fretboard-diagram`: a pure
JSON → SVG core with a local web editor on top, so it also runs headlessly.

## Getting started

Requirements: Node 24+ (the TypeScript sources run directly, no build step).

```bash
npm install     # first time only
npm run dev     # starts the editor (Vite prints the address)
npm test        # theory and set-class tests
```

## Using the editor

- **Notes / Center**: toggle notes with the 12 buttons or by clicking either
  circle. The center may lie outside the set.
- **Transpose**: −1 / +1 semitone, −5th / +5th (one step on the circle of
  fifths). Notes, center and drawn subsets move together; spelling follows the
  new center.
- **Presets**: scale presets are stored as intervals above a root and applied
  on the current center. “+ preset” saves the current set; “− preset” removes
  the selected one. The list lives in `config/scales.json` (seeded on first run).
- **Labels**: note names, degrees, or none; 12 o'clock is C or the center.
- **Spelling and degree names**: “auto” spells each note from its degree above
  the center (m3 above E♭ is G♭), avoiding double accidentals and C♭/F♭/E♯/B♯.
  Any pitch class can be forced to ♯ or ♭, and any degree renamed (e.g. 2 → 9).

### Analysis

- **Degrees** of each note above the center.
- **Set class and symmetry**: Forte number and prime form (Forte's method),
  version A/B for asymmetric classes (B = inversion of the prime form), other
  presets or saved sets in the same class, and the transpositions that map the
  set onto itself.
- **Modes**: the set read from each of its notes, named when the pattern
  matches a preset or a saved set (with a center). Click a row to make that note
  the center; “on X” keeps the center and transposes the set to that mode.
- **Intervals**: interval-class vector and the note pairs behind each class.
  Click a row to draw those pairs on the circles.
- **Subsets**: every subset of 2+ notes, grouped by size, with degrees, chord
  names (triads incl. sus, 4-note chords incl. 6ths; one name per possible root)
  and Forte number. Tick a subset to draw it as a coloured polygon on both
  circles; several can be drawn at once.

### Compare, save, export

- **Compare two sets** shows panels A and B, the common tones and the notes
  only in each, and (optionally) the other set dashed on each panel's circles.
- **Save / update** writes `library/<id>.json`; the library below filters by
  title and tags and sorts by date or name.
- **Export**: PNG, JPEG or SVG at 1×/2×/4×, transparent or white background.
  The title and legend can be switched off.

## Headless use

```ts
import { emptySet, renderSvg, setClass, intervalAnalysis } from "./src/index.ts";
const spec = { ...emptySet(), pcs: [0, 2, 4, 6, 8, 10], center: 0 };
renderSvg(spec);              // SVG string
setClass(spec.pcs);           // { prime: [0,2,4,6,8,10], forte: "6-35", version: null }
intervalAnalysis(spec.pcs);   // { vector: [0,6,0,6,0,3], pairs: [...] }
```

The spec shape is in `src/types.ts`.

## Layout

- `src/theory.ts` — names, spelling, degrees, intervals, symmetry, modes
- `src/setclass.ts`, `src/forte-table.ts` — prime form and Forte numbers
- `src/chords.ts` — chord names and subset enumeration
- `src/ops.ts` — whole-spec operations (transpose, mode switch, name matching)
- `src/render.ts` — SVG rendering
- `gui/` — the editor; `vite.config.ts` — library and preset APIs
