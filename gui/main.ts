// App shell: one or two set panels, the comparison bar, and the library.

import type { ScalePreset } from "../src/types.ts";
import { emptySet, withDefaults } from "../src/types.ts";
import { normalize, spell } from "../src/theory.ts";
import { renderSvg } from "../src/render.ts";
import { Panel, PHONE, type AppContext } from "./panel.ts";
import {
  listLibrary, saveLibrary, deleteLibrary, loadScales, saveScales, makeId, STORAGE, type StoredSet,
} from "./api.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let presets: ScalePreset[] = [];
let library: StoredSet[] = [];
let comparing = false;
/** Which panel the tab bar shows on narrow screens while comparing. */
let activeTab = 0;
const panels: Panel[] = [];

const STORAGE_NOTE =
  STORAGE === "files"
    ? "Saved sets are stored as JSON files in library/."
    : "Saved sets are kept in this browser only. Use Export / Import to move them to another device.";

const app: AppContext = {
  presets: () => presets,
  library: () => library,
  other: (p) => (comparing ? panels.find((x) => x !== p) ?? null : null),
  changed: (p) => {
    // The other panel draws this one as its overlay.
    if (comparing) panels.find((x) => x !== p)?.update();
    renderCompare();
    renderLibrary();
  },
  setPresets: async (list) => {
    presets = await saveScales(list);
    panels.forEach((p) => p.update());
  },
  save: (p, asNew) => void save(p, asNew),
  exportImage: (p, type) => void exportImage(p, type),
};

// ---------- Compare ----------

function setComparing(on: boolean): void {
  comparing = on;
  $("panels").classList.toggle("comparing", on);
  panels[1].root.hidden = !on;
  $("tabs").hidden = !on;
  showTab(on ? activeTab : 0);
  $("compare-toggle").textContent = on ? "Single view" : "Compare two sets";
  panels.forEach((p) => p.update());
  renderCompare();
  renderLibrary();
}

/** On narrow screens (see styles.css) only the active panel is shown. */
function showTab(i: number): void {
  activeTab = i;
  panels.forEach((p, j) => p.root.classList.toggle("tab-hidden", j !== i));
  $("tabs").querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => {
    const on = Number(b.dataset.tab) === i;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", String(on));
  });
  updateTabLabels();
}

function updateTabLabels(): void {
  $("tabs").querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => {
    const p = panels[Number(b.dataset.tab)];
    b.textContent = `${p.name}${p.spec.meta.title ? ` · ${p.spec.meta.title}` : ""}`;
  });
}

function renderCompare(): void {
  updateTabLabels();
  const bar = $("compare-bar");
  bar.hidden = !comparing;
  if (!comparing) return;
  const [a, b] = panels;
  const A = new Set(normalize(a.spec.pcs));
  const B = new Set(normalize(b.spec.pcs));
  const names = (pcs: number[], p: Panel) => pcs.map((x) => spell(x, p.spec)).join(" ") || "—";
  const common = [...A].filter((x) => B.has(x));
  bar.innerHTML = `
    <div><span class="lbl">Common (${common.length})</span> ${names(common, a)}</div>
    <div><span class="lbl">Only A (${[...A].filter((x) => !B.has(x)).length})</span> ${names([...A].filter((x) => !B.has(x)), a)}</div>
    <div><span class="lbl">Only B (${[...B].filter((x) => !A.has(x)).length})</span> ${names([...B].filter((x) => !A.has(x)), b)}</div>`;
}

// ---------- Library ----------

async function refreshLibrary(): Promise<void> {
  try {
    library = await listLibrary();
  } catch (e) {
    $("lib-status").textContent = `Library unavailable: ${e}`;
  }
  panels.forEach((p) => p.update());
  renderLibrary();
}

async function save(p: Panel, asNew: boolean): Promise<void> {
  const id = !asNew && p.storedId ? p.storedId : makeId(p.spec.meta.title);
  try {
    const rec = await saveLibrary(id, p.spec);
    p.storedId = rec.id;
    $("lib-status").textContent =
      STORAGE === "files"
        ? `Saved “${p.spec.meta.title || rec.id}” to library/${rec.id}.json`
        : `Saved “${p.spec.meta.title || rec.id}” in this browser.`;
    await refreshLibrary();
  } catch (e) {
    $("lib-status").textContent = `Save failed: ${e}`;
  }
}

function matchesFilter(s: StoredSet, terms: string[]): boolean {
  const hay = [s.set.meta.title, ...s.set.meta.tags].join(" ").toLowerCase();
  return terms.every((t) => hay.includes(t));
}

function renderLibrary(): void {
  const terms = $<HTMLInputElement>("lib-search").value.toLowerCase().split(",").map((t) => t.trim()).filter(Boolean);
  const sort = $<HTMLSelectElement>("lib-sort").value;
  const items = library.filter((s) => matchesFilter(s, terms));
  items.sort((x, y) => {
    if (sort === "name") return (x.set.meta.title || x.id).localeCompare(y.set.meta.title || y.id);
    if (sort === "created") return String(y.createdAt ?? y.savedAt).localeCompare(String(x.createdAt ?? x.savedAt));
    return String(y.savedAt).localeCompare(String(x.savedAt));
  });
  const active = new Set(panels.filter((p) => !p.root.hidden).map((p) => p.storedId));
  $("lib-list").innerHTML =
    items
      .map((s) => {
        const spec = withDefaults(s.set);
        const thumb = renderSvg({ ...spec, display: { ...spec.display, showTitle: false, showLegend: false } });
        const load = comparing
          ? `<button type="button" data-lib="load" data-to="0" data-id="${s.id}">→ A</button><button type="button" data-lib="load" data-to="1" data-id="${s.id}">→ B</button>`
          : `<button type="button" data-lib="load" data-to="0" data-id="${s.id}">Load</button>`;
        return `<div class="lib-card${active.has(s.id) ? " active" : ""}">
          <div class="lib-thumb">${thumb}</div>
          <div class="lib-title">${escapeHtml(spec.meta.title || s.id)}</div>
          <div class="lib-meta">${escapeHtml(spec.meta.tags.join(", "))}</div>
          <div class="lib-actions">${load}<button type="button" class="danger" data-lib="delete" data-id="${s.id}">Delete</button></div>
        </div>`;
      })
      .join("") || `<p class="hint">No saved sets${terms.length ? " match the filter" : " yet"}.</p>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function exportLibrary(): Promise<void> {
  const json = JSON.stringify(library, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(new Blob([json], { type: "application/json" }), `pitch-circle-library-${stamp}.json`);
}

/** Add sets from an exported file; an entry with the same id replaces the saved one. */
async function importLibrary(file: File): Promise<void> {
  try {
    const data = JSON.parse(await file.text());
    const items: StoredSet[] = Array.isArray(data) ? data : [data];
    let n = 0;
    for (const it of items) {
      if (!it || typeof it.id !== "string" || !it.set || !/^[A-Za-z0-9_-]+$/.test(it.id)) continue;
      await saveLibrary(it.id, withDefaults(it.set), it.createdAt);
      n++;
    }
    $("lib-status").textContent = `Imported ${n} set${n === 1 ? "" : "s"}.`;
    await refreshLibrary();
  } catch (e) {
    $("lib-status").textContent = `Import failed: ${e}`;
  }
}

// ---------- Export ----------

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function baseName(p: Panel): string {
  const t = (p.spec.meta.title || "pitch-circle").trim().toLowerCase();
  return t.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pitch-circle";
}

async function exportImage(p: Panel, type: "svg" | "png" | "jpeg"): Promise<void> {
  const scale = Number(p.root.querySelector<HTMLSelectElement>('[data-role="export-scale"]')!.value) || 1;
  const bg = p.root.querySelector<HTMLSelectElement>('[data-role="export-bg"]')!.value as "transparent" | "white";
  const svg = p.svg({ background: type === "jpeg" ? "white" : bg });
  if (type === "svg") return downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${baseName(p)}.svg`);

  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("SVG load failed"));
    img.src = svgUrl;
  });
  const w = (img.naturalWidth || img.width) * scale;
  const h = (img.naturalHeight || img.height) * scale;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  if (type === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(svgUrl);
  const mime = type === "png" ? "image/png" : "image/jpeg";
  canvas.toBlob((blob) => blob && downloadBlob(blob, `${baseName(p)}.${type === "png" ? "png" : "jpg"}`), mime, 0.95);
}

// ---------- Start ----------

async function init(): Promise<void> {
  try {
    presets = await loadScales();
  } catch {
    presets = [];
  }
  const a = new Panel("A", emptySet(), app);
  const bSpec = emptySet();
  bSpec.pcs = [0, 2, 3, 5, 7, 8, 10];
  const b = new Panel("B", bSpec, app);
  panels.push(a, b);
  $("panels").append(a.root, b.root);
  b.root.hidden = true;

  $("compare-toggle").addEventListener("click", () => setComparing(!comparing));
  PHONE.addEventListener("change", () => panels.forEach((p) => p.update()));
  $("tabs").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tab]");
    if (b) showTab(Number(b.dataset.tab));
  });
  $("lib-status").textContent = STORAGE_NOTE;
  $("lib-export").addEventListener("click", () => void exportLibrary());
  $("lib-import").addEventListener("click", () => $("lib-import-file").click());
  $<HTMLInputElement>("lib-import-file").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) void importLibrary(input.files[0]);
    input.value = "";
  });
  $("lib-search").addEventListener("input", renderLibrary);
  $("lib-sort").addEventListener("change", renderLibrary);
  $("lib-list").addEventListener("click", async (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-lib]");
    if (!el) return;
    const s = library.find((x) => x.id === el.dataset.id);
    if (!s) return;
    if (el.dataset.lib === "load") {
      panels[Number(el.dataset.to)].load(s.set, s.id);
      if (comparing) showTab(Number(el.dataset.to));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (confirm(`Delete “${s.set.meta.title || s.id}” from the library?`)) {
      await deleteLibrary(s.id);
      panels.forEach((p) => p.storedId === s.id && (p.storedId = null));
      await refreshLibrary();
    }
  });

  await refreshLibrary();
}

void init();
