// Rendering core: PitchSet spec -> SVG string.
//
// Pure and side-effect free: no DOM, no filesystem, no GUI. Draws the set on
// the circle of fifths and the chromatic circle side by side.

import type { PitchSet } from "./types.ts";
import { mod12, normalize, spell, degreeLabel, type SpellingContext } from "./theory.ts";
import { identifyChord } from "./chords.ts";

export interface RenderOptions {
  /** Add transparent hit targets (class "hit", data-pc) for the GUI. */
  interactive?: boolean;
  background?: "transparent" | "white";
  /** Another set drawn dashed on top, for comparison. */
  overlay?: { pcs: number[]; color?: string; label?: string } | null;
  /** Pairs of pitch classes to draw as highlighted chords of the circle. */
  highlightPairs?: [number, number][];
}

const S = {
  radius: 118,
  dot: 16,
  box: 320,
  gap: 24,
  margin: 20,
  titleSize: 18,
  lineColor: "#222222",
  faint: "#bdbdbd",
  ring: "#d6d6d3",
  overlayColor: "#2b6cb0",
  highlight: "#e67e22",
  font: "system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type CircleKind = "fifths" | "chromatic";

/** Clockwise step (0–11) of a pitch class from the top of the circle. */
export function circleIndex(pc: number, top: number, kind: CircleKind): number {
  const d = mod12(pc - top);
  return kind === "fifths" ? mod12(d * 7) : d;
}

function point(cx: number, cy: number, idx: number, r: number): [number, number] {
  const a = (idx / 12) * Math.PI * 2 - Math.PI / 2;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

const fmt = (n: number) => Math.round(n * 100) / 100;

function polygonPath(pcs: readonly number[], cx: number, cy: number, top: number, kind: CircleKind): string {
  const idx = normalize(pcs).map((p) => circleIndex(p, top, kind)).sort((a, b) => a - b);
  if (idx.length < 2) return "";
  const pts = idx.map((i) => point(cx, cy, i, S.radius).map(fmt).join(","));
  return `M${pts.join("L")}${idx.length > 2 ? "Z" : ""}`;
}

/** Text used for a subset in the legend: its chord names, else its notes. */
export function subsetLabel(pcs: readonly number[], ctx: SpellingContext): string {
  const chords = identifyChord(pcs);
  if (chords.length) return chords.map((c) => spell(c.root, ctx) + c.suffix).join(" / ");
  return normalize(pcs).map((p) => spell(p, ctx)).join(" ");
}

function nodeLabel(pc: number, spec: PitchSet, ctx: SpellingContext): string {
  if (spec.display.label === "none") return "";
  if (spec.display.label === "degree" && spec.center != null) {
    return degreeLabel(pc, spec.center, spec.pcs, spec.degreeNames);
  }
  return spell(pc, ctx);
}

function drawCircle(
  spec: PitchSet,
  kind: CircleKind,
  cx: number,
  cy: number,
  opts: RenderOptions,
): string {
  const top = spec.display.top === "center" && spec.center != null ? spec.center : 0;
  const members = new Set(normalize(spec.pcs));
  const ctx: SpellingContext = spec;
  const out: string[] = [];

  out.push(`<circle cx="${cx}" cy="${cy}" r="${S.radius}" fill="none" stroke="${S.ring}" stroke-width="1"/>`);

  if (spec.display.showSetPolygon && members.size > 1) {
    out.push(
      `<path d="${polygonPath([...members], cx, cy, top, kind)}" fill="${S.lineColor}" fill-opacity="0.05" stroke="${S.lineColor}" stroke-width="1.5" stroke-linejoin="round"/>`,
    );
  }
  for (const sub of spec.subsets) {
    const d = polygonPath(sub.pcs, cx, cy, top, kind);
    if (!d) continue;
    out.push(
      `<path d="${d}" fill="${esc(sub.color)}" fill-opacity="0.13" stroke="${esc(sub.color)}" stroke-width="3" stroke-linejoin="round"/>`,
    );
  }
  for (const [a, b] of opts.highlightPairs ?? []) {
    const [x1, y1] = point(cx, cy, circleIndex(a, top, kind), S.radius);
    const [x2, y2] = point(cx, cy, circleIndex(b, top, kind), S.radius);
    out.push(
      `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${S.highlight}" stroke-width="3.5" stroke-linecap="round"/>`,
    );
  }
  if (opts.overlay && opts.overlay.pcs.length > 1) {
    const color = opts.overlay.color ?? S.overlayColor;
    out.push(
      `<path d="${polygonPath(opts.overlay.pcs, cx, cy, top, kind)}" fill="none" stroke="${esc(color)}" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round"/>`,
    );
  }

  for (let pc = 0; pc < 12; pc++) {
    const [x, y] = point(cx, cy, circleIndex(pc, top, kind), S.radius);
    const label = nodeLabel(pc, spec, ctx);
    const isCenter = spec.center != null && mod12(spec.center) === pc;
    if (opts.overlay?.pcs.map(mod12).includes(pc)) {
      out.push(
        `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${S.dot + 7}" fill="none" stroke="${esc(opts.overlay.color ?? S.overlayColor)}" stroke-width="1.5" stroke-dasharray="3 3"/>`,
      );
    }
    if (members.has(pc)) {
      if (isCenter) {
        out.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${S.dot + 4}" fill="#fff" stroke="${S.lineColor}" stroke-width="1.5"/>`);
      }
      out.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${S.dot}" fill="${S.lineColor}"/>`);
      if (label) {
        out.push(
          `<text x="${fmt(x)}" y="${fmt(y)}" dy="0.35em" text-anchor="middle" font-size="${label.length > 2 ? 11 : 13}" font-weight="600" fill="#fff">${esc(label)}</text>`,
        );
      }
    } else {
      if (isCenter) {
        out.push(
          `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${S.dot}" fill="#fff" stroke="${S.lineColor}" stroke-width="1.5" stroke-dasharray="3 2"/>`,
        );
      } else {
        out.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="3" fill="${S.faint}"/>`);
      }
    }
    // Every position is named by note outside the ring: dark for members, faint
    // for the rest. Degrees stay inside the dots, so they only mark the set.
    if (spec.display.label !== "none") {
      const [lx, ly] = point(cx, cy, circleIndex(pc, top, kind), S.radius + 30);
      const member = members.has(pc);
      out.push(
        `<text x="${fmt(lx)}" y="${fmt(ly)}" dy="0.35em" text-anchor="middle" font-size="${member ? 12 : 11}"${member ? ' font-weight="600"' : ""} fill="${member ? S.lineColor : S.faint}">${esc(spell(pc, ctx))}</text>`,
      );
    }
    if (opts.interactive) {
      out.push(
        `<circle class="hit" data-pc="${pc}" cx="${fmt(x)}" cy="${fmt(y)}" r="${S.dot + 6}" fill="transparent"><title>${esc(spell(pc, ctx))}</title></circle>`,
      );
    }
  }

  const caption = kind === "fifths" ? "Circle of fifths" : "Chromatic circle";
  out.push(
    `<text x="${cx}" y="${cy + S.box / 2 + 6}" text-anchor="middle" font-size="12" fill="#6b6b6b">${caption}</text>`,
  );
  return out.join("\n");
}

export function renderSvg(spec: PitchSet, opts: RenderOptions = {}): string {
  const ctx: SpellingContext = spec;
  const title = spec.display.showTitle ? spec.meta.title.trim() : "";
  const legend = spec.display.showLegend
    ? [
        ...spec.subsets.map((s) => ({ color: s.color, text: subsetLabel(s.pcs, ctx), dashed: false })),
        ...(opts.overlay ? [{ color: opts.overlay.color ?? S.overlayColor, text: opts.overlay.label ?? "Compared set", dashed: true }] : []),
      ]
    : [];

  const titleH = title ? S.titleSize + 16 : 0;
  const width = S.margin * 2 + S.box * 2 + S.gap;
  const circlesTop = S.margin + titleH;
  const legendTop = circlesTop + S.box + 24;
  const legendRows = Math.ceil(legend.length / 2);
  const height = legendTop + (legendRows ? legendRows * 22 + 6 : 0) + S.margin - 10;

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${S.font}">`,
  );
  if (opts.background === "white") out.push(`<rect width="100%" height="100%" fill="#fff"/>`);
  if (title) {
    out.push(
      `<text x="${S.margin}" y="${S.margin + S.titleSize}" font-size="${S.titleSize}" font-weight="600" fill="${S.lineColor}">${esc(title)}</text>`,
    );
  }
  const cy = circlesTop + S.box / 2 - 8;
  out.push(`<g data-circle="fifths">${drawCircle(spec, "fifths", S.margin + S.box / 2, cy, opts)}</g>`);
  out.push(`<g data-circle="chromatic">${drawCircle(spec, "chromatic", S.margin + S.box * 1.5 + S.gap, cy, opts)}</g>`);

  legend.forEach((item, i) => {
    const x = S.margin + (i % 2) * (S.box + S.gap);
    const y = legendTop + Math.floor(i / 2) * 22;
    out.push(
      `<line x1="${x}" y1="${y}" x2="${x + 22}" y2="${y}" stroke="${esc(item.color)}" stroke-width="3"${item.dashed ? ' stroke-dasharray="6 4"' : ""}/>`,
      `<text x="${x + 30}" y="${y}" dy="0.35em" font-size="12" fill="${S.lineColor}">${esc(item.text)}</text>`,
    );
  });
  out.push("</svg>");
  return out.join("\n");
}
