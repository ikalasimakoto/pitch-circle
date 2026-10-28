// One editable pitch set with its circles and analysis. The app shows one
// panel, or two side by side for comparison.

import type { PitchSet, ScalePreset } from "../src/types.ts";
import type { StoredSet } from "./api.ts";
import { withDefaults } from "../src/types.ts";
import {
  mod12, normalize, sameSet, spell, centerName, degreeLabel, contextualDegrees,
  intervalAnalysis, transpositionalSymmetry, IC_LABELS, type Accidental,
} from "../src/theory.ts";
import { setClass } from "../src/setclass.ts";
import { identifyChord, subsets } from "../src/chords.ts";
import {
  transposeSpec, withCenter, modeOnCenter, namedModes, intervalsFromCenter, presetToPcs,
  type NamedIntervals,
} from "../src/ops.ts";
import { renderSvg, subsetLabel } from "../src/render.ts";

/** Phone-width screens get the two circles stacked. Matches styles.css. */
export const PHONE = window.matchMedia("(max-width: 600px)");

export const PALETTE = ["#d9534f", "#3a7bd5", "#2e9e5b", "#e0a100", "#8e44ad", "#16a2b8", "#e67e22", "#7f8c8d"];

export interface AppContext {
  presets(): ScalePreset[];
  library(): StoredSet[];
  /** The other panel while comparing, else null. */
  other(p: Panel): Panel | null;
  changed(p: Panel): void;
  setPresets(list: ScalePreset[]): void;
  save(p: Panel, asNew: boolean): void;
  exportImage(p: Panel, type: "svg" | "png" | "jpeg"): void;
}

interface SubsetFilter {
  size: number | "all";
  kind: "all" | "chord" | "triad" | "tetrad";
  withCenter: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const key = (pcs: readonly number[]) => normalize(pcs).join(",");
const HEX = "0123456789TE";

export class Panel {
  spec: PitchSet;
  storedId: string | null = null;
  overlay = true;
  highlightIc: number | null = null;
  filter: SubsetFilter = { size: "all", kind: "all", withCenter: false };
  openSizes = new Set<number>([3, 4]);
  readonly root: HTMLElement;
  private q = <T extends HTMLElement>(role: string) =>
    this.root.querySelector<T>(`[data-role="${role}"]`)!;

  constructor(
    readonly name: "A" | "B",
    spec: PitchSet,
    private app: AppContext,
  ) {
    this.spec = spec;
    this.root = document.createElement("section");
    this.root.className = "panel set-panel";
    this.root.innerHTML = skeleton(name);
    this.bind();
    this.loadFields();
    this.update();
  }

  /** Replace the whole spec (load from library or JSON). */
  load(spec: PitchSet, storedId: string | null): void {
    this.spec = withDefaults(spec);
    this.storedId = storedId;
    this.highlightIc = null;
    this.loadFields();
    this.commit();
  }

  private set(next: PitchSet): void {
    this.spec = next;
    this.commit();
  }

  private commit(): void {
    this.update();
    this.app.changed(this);
  }

  private loadFields(): void {
    this.q<HTMLInputElement>("title").value = this.spec.meta.title;
    this.q<HTMLInputElement>("tags").value = this.spec.meta.tags.join(", ");
  }

  // ---------- Rendering ----------

  update(): void {
    const other = this.app.other(this);
    this.root.querySelector<HTMLElement>(".overlay-opt")!.hidden = !other;
    this.renderNoteButtons();
    this.renderPresetSelect();
    this.renderDisplayControls();
    this.renderPreview();
    this.renderDegrees();
    this.renderSetClass();
    this.renderModes();
    this.renderIntervals();
    this.renderSubsets();
    this.renderSpelling();
    const st = this.q("save-status");
    st.textContent = this.storedId ? `Saved as ${this.storedId}` : "Not saved yet";
  }

  private noteName(pc: number): string {
    return spell(pc, this.spec);
  }

  svg(opts: { interactive?: boolean; background?: "transparent" | "white" } = {}): string {
    const other = this.app.other(this);
    const ana = this.highlightIc != null ? intervalAnalysis(this.spec.pcs).pairs[this.highlightIc] : [];
    return renderSvg(this.spec, {
      ...opts,
      // On-screen only: exports keep the circles side by side.
      stacked: opts.interactive && PHONE.matches,
      highlightPairs: opts.interactive ? ana : [],
      overlay:
        other && this.overlay
          ? { pcs: other.spec.pcs, label: `${other.name}: ${other.spec.meta.title || other.notesText()}` }
          : null,
    });
  }

  notesText(): string {
    return normalize(this.spec.pcs).map((p) => this.noteName(p)).join(" ");
  }

  private renderNoteButtons(): void {
    const members = new Set(normalize(this.spec.pcs));
    this.q("notes").innerHTML = [...Array(12).keys()]
      .map((pc) => `<button type="button" class="pc${members.has(pc) ? " on" : ""}" data-act="toggle" data-pc="${pc}">${esc(this.noteName(pc))}</button>`)
      .join("");
    const c = this.spec.center;
    this.q("centers").innerHTML =
      [...Array(12).keys()]
        .map((pc) => `<button type="button" class="pc${c === pc ? " on center" : ""}${members.has(pc) ? "" : " outside"}" data-act="center" data-pc="${pc}">${esc(this.noteName(pc))}</button>`)
        .join("") + `<button type="button" class="pc wide${c == null ? " on" : ""}" data-act="center" data-pc="">none</button>`;
  }

  private renderPresetSelect(): void {
    const sel = this.q<HTMLSelectElement>("preset");
    const iv = intervalsFromCenter(this.spec.pcs, this.spec.center);
    const list = this.app.presets();
    const match = iv ? list.findIndex((p) => sameSet(p.intervals, iv)) : -1;
    sel.innerHTML =
      `<option value="">— preset —</option>` +
      list.map((p, i) => `<option value="${i}"${i === match ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  }

  private renderDisplayControls(): void {
    const d = this.spec.display;
    this.q<HTMLSelectElement>("label").value = d.label;
    this.q<HTMLSelectElement>("top").value = d.top;
    this.q<HTMLInputElement>("set-poly").checked = d.showSetPolygon;
    this.q<HTMLInputElement>("show-title").checked = d.showTitle;
    this.q<HTMLInputElement>("show-legend").checked = d.showLegend;
    this.q<HTMLInputElement>("overlay").checked = this.overlay;
  }

  private renderPreview(): void {
    this.q("preview").innerHTML = this.svg({ interactive: true });
  }

  private renderDegrees(): void {
    const { center, pcs } = this.spec;
    const el = this.q("degrees");
    if (center == null) {
      el.innerHTML = `<p class="hint">Choose a center to see degrees.</p>`;
      return;
    }
    const ordered = normalize(pcs).sort((a, b) => mod12(a - center) - mod12(b - center));
    const outside = normalize(pcs).includes(center) ? "" : `<p class="hint">The center (${esc(this.noteName(center))}) is outside the set.</p>`;
    el.innerHTML =
      `<table class="deg"><tr><th>Note</th>${ordered.map((p) => `<td>${esc(this.noteName(p))}</td>`).join("")}</tr>` +
      `<tr><th>Degree</th>${ordered.map((p) => `<td>${esc(degreeLabel(p, center, pcs, this.spec.degreeNames))}</td>`).join("")}</tr>` +
      `<tr><th>Semitones</th>${ordered.map((p) => `<td class="muted">${mod12(p - center)}</td>`).join("")}</tr></table>` +
      outside;
  }

  private knownNames(): NamedIntervals[] {
    const out: NamedIntervals[] = this.app.presets().map((p) => ({ name: p.name, intervals: p.intervals }));
    for (const s of this.app.library()) {
      if (s.id === this.storedId) continue;
      const iv = intervalsFromCenter(s.set.pcs, s.set.center);
      if (iv && s.set.meta.title) out.push({ name: s.set.meta.title, intervals: iv });
    }
    return out;
  }

  private renderSetClass(): void {
    const pcs = normalize(this.spec.pcs);
    const el = this.q("setclass");
    if (pcs.length === 0) {
      el.innerHTML = `<p class="hint">Empty set.</p>`;
      return;
    }
    const info = setClass(pcs);
    const prime = `(${info.prime.map((p) => HEX[p]).join(" ")})`;
    const forte = info.forte
      ? `<strong>Forte ${esc(info.forte)}</strong>${info.version ? `<span class="muted"> · version ${info.version}${info.version === "B" ? " (inversion of the prime form)" : ""}</span>` : `<span class="muted"> · inversionally symmetric</span>`}`
      : `<span class="muted">Forte numbers cover 3–9 notes.</span>`;

    const chips: string[] = [];
    if (info.forte) {
      this.app.presets().forEach((p, i) => {
        if (setClass(p.intervals).forte === info.forte) chips.push(`<button type="button" class="chip" data-act="load-preset" data-i="${i}">${esc(p.name)}</button>`);
      });
      for (const s of this.app.library()) {
        if (s.id !== this.storedId && setClass(s.set.pcs).forte === info.forte) {
          chips.push(`<button type="button" class="chip lib" data-act="load-stored" data-id="${esc(s.id)}">${esc(s.set.meta.title || s.id)}</button>`);
        }
      }
    }

    const sym = transpositionalSymmetry(pcs);
    const distinct = 12 / sym.length;
    const symText =
      sym.length > 1
        ? `Maps onto itself at ${sym.map((t) => `T${t}`).join(", ")} → <strong>${distinct}</strong> distinct transposition${distinct === 1 ? "" : "s"} (limited transposition).`
        : `Only T0 maps it onto itself → 12 distinct transpositions.`;

    el.innerHTML =
      `<p>${forte}</p><p>Prime form <code>${prime}</code></p>` +
      (chips.length ? `<p class="hint">Same set class:</p><div class="chips">${chips.join("")}</div>` : "") +
      `<p class="sym">${symText}</p>`;
  }

  private renderModes(): void {
    const { pcs, center } = this.spec;
    const el = this.q("modes");
    if (normalize(pcs).length < 2) {
      el.innerHTML = `<p class="hint">Add notes to see modes.</p>`;
      return;
    }
    const rows = namedModes(pcs, this.knownNames()).map((m) => {
      const degs = m.intervals.map((i) => degreeLabel(mod12(m.center + i), m.center, pcs, this.spec.degreeNames)).join(" ");
      const current = center === m.center;
      const onCenter =
        center != null && !current
          ? `<button type="button" class="ghost tiny" data-act="mode-keep" data-pc="${m.center}" title="Keep the center and transpose the set to this mode">on ${esc(centerName(center, this.spec.spelling))}</button>`
          : "";
      return `<tr class="mode-row${current ? " current" : ""}" data-act="mode" data-pc="${m.center}">
        <td class="mnote">${esc(this.noteName(m.center))}</td>
        <td class="mdeg">${esc(degs)}</td>
        <td class="mname">${m.names.map(esc).join(", ")}</td>
        <td>${onCenter}</td></tr>`;
    });
    el.innerHTML = `<p class="hint">Click a row to make that note the center. “on …” keeps the center and moves the set instead.</p><table class="modes">${rows.join("")}</table>`;
  }

  private renderIntervals(): void {
    const ana = intervalAnalysis(this.spec.pcs);
    const rows = ana.vector.map((n, i) => {
      const pairs = ana.pairs[i].map(([a, b]) => `${this.noteName(a)}–${this.noteName(b)}`).join(", ");
      return `<tr class="ic-row${this.highlightIc === i ? " current" : ""}${n ? "" : " zero"}" data-act="ic" data-i="${i}">
        <td class="icn">ic${i + 1}</td><td class="icl">${IC_LABELS[i]}</td><td class="icc">${n}</td><td class="icp">${esc(pairs)}</td></tr>`;
    });
    this.q("intervals").innerHTML =
      `<p>Interval-class vector <code>&lt;${ana.vector.join("")}&gt;</code></p>` +
      `<p class="hint">Click a row to draw its pairs on the circles.</p><table class="ics">${rows.join("")}</table>`;
  }

  private renderSubsets(): void {
    const { center } = this.spec;
    const drawn = this.spec.subsets
      .map((s, i) => `<div class="drawn"><input type="color" value="${esc(s.color)}" data-role-sub="${i}" /><span>${esc(subsetLabel(s.pcs, this.spec))}</span><span class="muted">${esc(normalize(s.pcs).map((p) => this.noteName(p)).join(" "))}</span><button type="button" class="ghost tiny" data-act="sub-remove" data-i="${i}">×</button></div>`)
      .join("");
    this.q("drawn").innerHTML = drawn
      ? drawn + `<button type="button" class="ghost tiny" data-act="sub-clear">Clear drawn subsets</button>`
      : `<p class="hint">Tick subsets below to draw them on the circles.</p>`;

    const f = this.filter;
    const all = subsets(this.spec.pcs).filter((s) => {
      if (f.size !== "all" && s.length !== f.size) return false;
      if (f.withCenter && (center == null || !s.includes(center))) return false;
      if (f.kind !== "all") {
        const kinds = identifyChord(s).map((c) => c.kind);
        if (f.kind === "chord" ? kinds.length === 0 : !kinds.includes(f.kind)) return false;
      }
      return true;
    });
    const bySize = new Map<number, number[][]>();
    for (const s of all) bySize.set(s.length, [...(bySize.get(s.length) ?? []), s]);
    const drawnKeys = new Map(this.spec.subsets.map((s) => [key(s.pcs), s.color]));

    const sizeSel = this.q<HTMLSelectElement>("f-size");
    const n = normalize(this.spec.pcs).length;
    sizeSel.innerHTML =
      `<option value="all">All sizes</option>` +
      Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 2)
        .map((k) => `<option value="${k}"${f.size === k ? " selected" : ""}>${k} notes</option>`)
        .join("");

    const groups = [...bySize.entries()].map(([size, list]) => {
      const open = this.openSizes.has(size);
      const body = open ? list.map((s) => this.subsetRow(s, drawnKeys.get(key(s)))).join("") : "";
      return `<details class="sgroup" data-size="${size}"${open ? " open" : ""}><summary>${size} notes <span class="muted">(${list.length})</span></summary><div class="srows">${body}</div></details>`;
    });
    this.q("subsets").innerHTML = groups.join("") || `<p class="hint">No subsets match.</p>`;
  }

  private subsetRow(s: number[], color: string | undefined): string {
    const { center, pcs } = this.spec;
    const chords = identifyChord(s);
    const kind = chords[0]?.kind ?? "";
    const badges = chords
      .map((c) => `<span class="badge ${c.kind}">${esc(this.noteName(c.root) + c.suffix)}</span>`)
      .join("");
    const degs = center != null ? s.map((p) => degreeLabel(p, center, pcs, this.spec.degreeNames)).join(" ") : "";
    const forte = s.length >= 3 ? setClass(s).forte ?? "" : "";
    return `<label class="srow ${kind}"><input type="checkbox" data-act="sub-toggle" data-pcs="${s.join(",")}"${color ? " checked" : ""} />
      <span class="swatch" style="background:${color ?? "transparent"}"></span>
      <span class="snotes">${esc(s.map((p) => this.noteName(p)).join(" "))}</span>
      <span class="sdeg muted">${esc(degs)}</span>
      <span class="sbadges">${badges}</span>
      <span class="sforte muted">${esc(forte)}</span></label>`;
  }

  private renderSpelling(): void {
    const { center, pcs, spelling, degreeNames } = this.spec;
    this.q("spelling").innerHTML = [...Array(12).keys()]
      .map((pc) => {
        const v = spelling[pc] ?? "";
        return `<label class="sp-row"><span>${esc(this.noteName(pc))}</span><select data-spell="${pc}">
          <option value=""${v === "" ? " selected" : ""}>auto</option>
          <option value="sharp"${v === "sharp" ? " selected" : ""}>♯</option>
          <option value="flat"${v === "flat" ? " selected" : ""}>♭</option></select></label>`;
      })
      .join("");
    const defaults = contextualDegrees(pcs, center ?? 0);
    this.q("degree-names").innerHTML = defaults
      .map((d, semis) => `<label class="dn-row"><span>${semis}</span><input data-degree="${semis}" placeholder="${esc(d)}" value="${esc(degreeNames[semis] ?? "")}" /></label>`)
      .join("");
  }

  // ---------- Events ----------

  private bind(): void {
    const r = this.root;

    r.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const hit = t.closest<SVGElement>(".hit");
      if (hit) return this.toggle(Number(hit.dataset.pc));
      const el = t.closest<HTMLElement>("[data-act]");
      if (!el || el.tagName === "INPUT") return;
      const pc = el.dataset.pc === "" || el.dataset.pc == null ? null : Number(el.dataset.pc);
      switch (el.dataset.act) {
        case "toggle": return this.toggle(pc!);
        case "center": return this.set(withCenter(this.spec, pc));
        case "transpose": return this.set(transposeSpec(this.spec, Number(el.dataset.t)));
        case "mode":
          if ((t as HTMLElement).closest("button")) return;
          return this.set(withCenter(this.spec, pc));
        case "mode-keep": return this.set(modeOnCenter(this.spec, pc!));
        case "ic": {
          const i = Number(el.dataset.i);
          this.highlightIc = this.highlightIc === i ? null : i;
          return this.update();
        }
        case "sub-remove":
          return this.set({ ...this.spec, subsets: this.spec.subsets.filter((_, i) => i !== Number(el.dataset.i)) });
        case "sub-clear": return this.set({ ...this.spec, subsets: [] });
        case "load-preset": return this.applyPreset(Number(el.dataset.i));
        case "load-stored": {
          const s = this.app.library().find((x) => x.id === el.dataset.id);
          if (s) this.load(s.set, s.id);
          return;
        }
        case "clear": return this.set({ ...this.spec, pcs: [], subsets: [] });
        case "preset-add": return this.addPreset();
        case "preset-remove": return this.removePreset();
        case "save": return this.app.save(this, false);
        case "save-new": return this.app.save(this, true);
        case "export": return this.app.exportImage(this, el.dataset.type as "svg" | "png" | "jpeg");
      }
    });

    r.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.dataset.act === "sub-toggle") return this.toggleSubset(t.dataset.pcs!.split(",").map(Number));
      if (t.dataset.roleSub != null) {
        const i = Number(t.dataset.roleSub);
        return this.set({ ...this.spec, subsets: this.spec.subsets.map((s, j) => (j === i ? { ...s, color: t.value } : s)) });
      }
      if (t.dataset.spell != null) {
        const spelling = { ...this.spec.spelling };
        if (t.value) spelling[Number(t.dataset.spell)] = t.value as Accidental;
        else delete spelling[Number(t.dataset.spell)];
        return this.set({ ...this.spec, spelling });
      }
      if (t.dataset.degree != null) {
        const degreeNames = { ...this.spec.degreeNames };
        if (t.value.trim()) degreeNames[Number(t.dataset.degree)] = t.value.trim();
        else delete degreeNames[Number(t.dataset.degree)];
        return this.set({ ...this.spec, degreeNames });
      }
      const role = t.dataset.role;
      const d = this.spec.display;
      switch (role) {
        case "preset": return t.value !== "" && this.applyPreset(Number(t.value));
        case "label": return this.set({ ...this.spec, display: { ...d, label: t.value as PitchSet["display"]["label"] } });
        case "top": return this.set({ ...this.spec, display: { ...d, top: t.value as "C" | "center" } });
        case "set-poly": return this.set({ ...this.spec, display: { ...d, showSetPolygon: t.checked } });
        case "show-title": return this.set({ ...this.spec, display: { ...d, showTitle: t.checked } });
        case "show-legend": return this.set({ ...this.spec, display: { ...d, showLegend: t.checked } });
        case "overlay":
          this.overlay = t.checked;
          return this.update();
        case "f-size":
          this.filter.size = t.value === "all" ? "all" : Number(t.value);
          if (this.filter.size !== "all") this.openSizes.add(this.filter.size);
          return this.renderSubsets();
        case "f-kind":
          this.filter.kind = t.value as SubsetFilter["kind"];
          return this.renderSubsets();
        case "f-center":
          this.filter.withCenter = t.checked;
          return this.renderSubsets();
      }
    });

    r.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.dataset.role === "title") {
        this.spec = { ...this.spec, meta: { ...this.spec.meta, title: t.value } };
        this.renderPreview();
        this.app.changed(this);
      } else if (t.dataset.role === "tags") {
        const tags = t.value.split(",").map((s) => s.trim()).filter(Boolean);
        this.spec = { ...this.spec, meta: { ...this.spec.meta, tags } };
      }
    });

    // Remember which subset sizes are open; render rows only for open groups.
    r.addEventListener(
      "toggle",
      (e) => {
        const d = e.target as HTMLDetailsElement;
        if (!d.classList?.contains("sgroup")) return;
        const size = Number(d.dataset.size);
        const was = this.openSizes.has(size);
        if (d.open) this.openSizes.add(size);
        else this.openSizes.delete(size);
        if (d.open && !was) this.renderSubsets();
      },
      true,
    );
  }

  private toggle(pc: number): void {
    const has = this.spec.pcs.includes(pc);
    const pcs = has ? this.spec.pcs.filter((p) => p !== pc) : normalize([...this.spec.pcs, pc]);
    // Drop drawn subsets that are no longer inside the set.
    const subs = this.spec.subsets.filter((s) => s.pcs.every((p) => pcs.includes(p)));
    this.set({ ...this.spec, pcs, subsets: subs });
  }

  private toggleSubset(pcs: number[]): void {
    const k = key(pcs);
    const existing = this.spec.subsets.findIndex((s) => key(s.pcs) === k);
    if (existing >= 0) {
      this.set({ ...this.spec, subsets: this.spec.subsets.filter((_, i) => i !== existing) });
      return;
    }
    const used = new Set(this.spec.subsets.map((s) => s.color));
    const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[this.spec.subsets.length % PALETTE.length];
    this.set({ ...this.spec, subsets: [...this.spec.subsets, { pcs: normalize(pcs), color }] });
  }

  private applyPreset(i: number): void {
    const p = this.app.presets()[i];
    if (!p) return;
    const root = this.spec.center ?? 0;
    const meta = this.spec.meta.title ? this.spec.meta : { ...this.spec.meta, title: `${centerName(root, this.spec.spelling)} ${p.name}` };
    this.spec = { ...this.spec, pcs: presetToPcs(p, root), center: root, subsets: [], meta };
    this.loadFields();
    this.commit();
  }

  private addPreset(): void {
    const iv = intervalsFromCenter(this.spec.pcs, this.spec.center);
    if (!iv || iv.length === 0) return alert("Choose notes and a center first: a preset is stored as intervals above its center.");
    const name = prompt("Preset name", this.spec.meta.title.replace(/^[A-G][♯♭]?\s+/, ""));
    if (!name) return;
    this.app.setPresets([...this.app.presets().filter((p) => p.name !== name), { name, intervals: iv }]);
  }

  private removePreset(): void {
    const sel = this.q<HTMLSelectElement>("preset");
    const p = this.app.presets()[Number(sel.value)];
    if (sel.value === "" || !p) return alert("Pick the preset to remove in the preset menu first.");
    if (!confirm(`Remove the preset “${p.name}”?`)) return;
    this.app.setPresets(this.app.presets().filter((x) => x !== p));
  }
}

function skeleton(name: string): string {
  return `
  <div class="sp-head">
    <span class="sp-badge">${name}</span>
    <input data-role="title" type="text" placeholder="Title, e.g. C major" />
    <input data-role="tags" type="text" placeholder="Tags (comma-separated)" />
  </div>
  <div class="sp-body">
    <div class="sp-main">
      <div class="ctl"><span class="lbl">Notes</span><div class="pcrow" data-role="notes"></div></div>
      <div class="ctl"><span class="lbl">Center</span><div class="pcrow" data-role="centers"></div></div>
      <div class="ctl row wrap">
        <span class="lbl">Transpose</span>
        <button type="button" class="ghost" data-act="transpose" data-t="-1" title="Down a semitone">−1</button>
        <button type="button" class="ghost" data-act="transpose" data-t="1" title="Up a semitone">+1</button>
        <button type="button" class="ghost" data-act="transpose" data-t="-7" title="Down a fifth: one step anticlockwise on the circle of fifths">−5th</button>
        <button type="button" class="ghost" data-act="transpose" data-t="7" title="Up a fifth: one step clockwise on the circle of fifths">+5th</button>
        <button type="button" class="ghost" data-act="clear">Clear notes</button>
      </div>
      <div class="ctl row wrap">
        <select data-role="preset"></select>
        <button type="button" class="ghost tiny" data-act="preset-add" title="Save the current set (intervals above the center) as a preset">+ preset</button>
        <button type="button" class="ghost tiny" data-act="preset-remove">− preset</button>
      </div>
      <div class="preview interactive" data-role="preview"></div>
      <p class="hint">Click a point on either circle to add or remove that note.</p>
      <div class="ctl row wrap opts">
        <label class="field small"><span>Labels</span><select data-role="label">
          <option value="note">Note names</option><option value="degree">Degrees</option><option value="none">None</option></select></label>
        <label class="field small"><span>Top of circle</span><select data-role="top">
          <option value="C">C</option><option value="center">Center</option></select></label>
      </div>
      <div class="ctl row wrap opts">
        <label class="check"><input type="checkbox" data-role="set-poly" /> Set polygon</label>
        <label class="check"><input type="checkbox" data-role="show-title" /> Title on image</label>
        <label class="check"><input type="checkbox" data-role="show-legend" /> Legend</label>
        <label class="check overlay-opt"><input type="checkbox" data-role="overlay" /> Overlay the other set</label>
      </div>
      <details class="acc"><summary>Spelling and degree names</summary><div class="acc-body">
        <p class="hint">“auto” spells each note from its degree above the center (m3 above E♭ is G♭). Degree names apply to the semitones above the center; leave blank for the default.</p>
        <div class="spell-grid" data-role="spelling"></div>
        <div class="dn-grid" data-role="degree-names"></div>
      </div></details>
      <details class="acc"><summary>Export</summary><div class="acc-body">
        <div class="row">
          <label class="field small"><span>Scale</span><select data-role="export-scale"><option value="1">1×</option><option value="2" selected>2×</option><option value="4">4×</option></select></label>
          <label class="field small"><span>Background (PNG/SVG)</span><select data-role="export-bg"><option value="transparent">Transparent</option><option value="white">White</option></select></label>
        </div>
        <div class="row wrap">
          <button type="button" data-act="export" data-type="png">PNG</button>
          <button type="button" data-act="export" data-type="jpeg">JPEG</button>
          <button type="button" class="ghost" data-act="export" data-type="svg">SVG</button>
        </div>
      </div></details>
      <div class="row wrap save-row">
        <button type="button" data-act="save">Save / update</button>
        <button type="button" class="ghost" data-act="save-new">Save as new</button>
        <span class="hint" data-role="save-status"></span>
      </div>
    </div>
    <div class="sp-analysis">
      <details class="acc" open><summary>Degrees</summary><div class="acc-body" data-role="degrees"></div></details>
      <details class="acc" open><summary>Set class and symmetry</summary><div class="acc-body" data-role="setclass"></div></details>
      <details class="acc" open><summary>Modes</summary><div class="acc-body" data-role="modes"></div></details>
      <details class="acc" open><summary>Intervals</summary><div class="acc-body" data-role="intervals"></div></details>
      <details class="acc" open><summary>Subsets</summary><div class="acc-body">
        <div data-role="drawn" class="drawn-list"></div>
        <div class="row wrap sfilter">
          <select data-role="f-size"></select>
          <select data-role="f-kind">
            <option value="all">All subsets</option><option value="chord">Named chords</option>
            <option value="triad">Triads (3-note chords)</option><option value="tetrad">4-note chords</option></select>
          <label class="check"><input type="checkbox" data-role="f-center" /> Contains center</label>
        </div>
        <p class="hint legend-hint"><span class="badge triad">triad</span> <span class="badge tetrad">4-note</span> — a chord can carry several names, one per possible root.</p>
        <div data-role="subsets"></div>
      </div></details>
    </div>
  </div>`;
}
