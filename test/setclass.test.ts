import { test } from "node:test";
import assert from "node:assert/strict";
import { primeForm, setClass, forteEntries, vectorMatches, formatPcs } from "../src/setclass.ts";
import { normalize } from "../src/theory.ts";

test("table: 208 classes, each prime is its own Forte prime, vectors agree", () => {
  const e = forteEntries();
  assert.equal(e.length, 208);
  for (const x of e) {
    assert.equal(formatPcs(primeForm(x.prime)), formatPcs(x.prime), x.number);
    assert.ok(vectorMatches(x), x.number);
  }
});

test("every 3–9 note set maps to a table entry", () => {
  const seen = new Set<string>();
  for (let mask = 1; mask < 4096; mask++) {
    const s = [...Array(12).keys()].filter((i) => mask & (1 << i));
    if (s.length < 3 || s.length > 9) continue;
    const info = setClass(s);
    assert.ok(info.forte, formatPcs(s));
    seen.add(info.forte!);
  }
  assert.equal(seen.size, 208);
});

test("familiar sets", () => {
  assert.deepEqual(setClass([0, 4, 7]), { prime: [0, 3, 7], forte: "3-11", version: "B" });
  assert.deepEqual(setClass([0, 3, 7]), { prime: [0, 3, 7], forte: "3-11", version: "A" });
  assert.equal(setClass([0, 2, 4, 5, 7, 9, 11]).forte, "7-35");
  assert.equal(setClass([0, 4, 7, 10]).forte, "4-27");
  assert.equal(setClass([0, 3, 6, 10]).forte, "4-27");
  assert.equal(setClass([0, 3, 6, 9]).version, null);
  assert.equal(setClass([0, 1, 4, 6]).forte, "4-Z15");
  assert.equal(setClass([0, 1, 3, 7]).forte, "4-Z29");
  // A Forte/Rahn disagreement: Forte's spelling wins.
  assert.equal(formatPcs(primeForm(normalize([0, 1, 5, 6, 8]))), "01378");
});
