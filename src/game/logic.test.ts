import assert from "node:assert/strict";
import test from "node:test";
import {
  cloneTiles,
  faceLabel,
  freePairs,
  isFree,
  newDeal,
  shuffleRemaining,
  type Tile,
} from "./logic.ts";

test("120-tile solvable deals", () => {
  for (let n = 0; n < 20; n++) {
    const { tiles, solution } = newDeal();
    assert.equal(tiles.length, 120);
    assert.equal(solution.length, 60);
    const counts = new Map<number, number>();
    for (const t of tiles) counts.set(t.face, (counts.get(t.face) ?? 0) + 1);
    for (const nTiles of counts.values()) assert.equal(nTiles % 2, 0);
    const copy = cloneTiles(tiles);
    for (const [a, b] of solution) {
      const ta = copy.find((t) => t.id === a);
      const tb = copy.find((t) => t.id === b);
      assert.ok(ta && tb);
      assert.equal(ta.face, tb.face);
      assert.equal(isFree(ta, copy), true);
      assert.equal(isFree(tb, copy), true);
      ta.removed = true;
      tb.removed = true;
    }
    assert.equal(
      copy.every((t) => t.removed),
      true,
    );
  }
});

test("covering and side blocking", () => {
  const tiles: Tile[] = [
    { id: 0, x: 0, y: 0, z: 0, face: 1, removed: false },
    { id: 1, x: 1, y: 0, z: 0, face: 1, removed: false },
    { id: 2, x: 2, y: 0, z: 0, face: 2, removed: false },
    { id: 3, x: 1, y: 0, z: 1, face: 3, removed: false },
  ];
  assert.equal(isFree(tiles[0], tiles), true);
  assert.equal(isFree(tiles[1], tiles), false);
  assert.equal(isFree(tiles[2], tiles), true);
  assert.equal(isFree(tiles[3], tiles), true);

  const row: Tile[] = [
    { id: 0, x: 0, y: 0, z: 0, face: 0, removed: false },
    { id: 1, x: 1, y: 0, z: 0, face: 0, removed: false },
    { id: 2, x: 2, y: 0, z: 0, face: 0, removed: false },
  ];
  assert.equal(isFree(row[1], row), false);
  row[0].removed = true;
  assert.equal(isFree(row[1], row), true);
});

test("shuffle keeps the inventory and opens a move", () => {
  const { tiles } = newDeal();
  const face = tiles[0].face;
  const partner = tiles.find((t, i) => i > 0 && t.face === face);
  assert.ok(partner);
  tiles[0].removed = true;
  partner.removed = true;
  const before = new Map<number, number>();
  for (const t of tiles) {
    if (!t.removed) before.set(t.face, (before.get(t.face) ?? 0) + 1);
  }
  const next = shuffleRemaining(tiles);
  const after = new Map<number, number>();
  for (const t of next.tiles) {
    if (!t.removed) after.set(t.face, (after.get(t.face) ?? 0) + 1);
  }
  assert.equal(after.size, before.size);
  for (const [face, n] of before) assert.equal(after.get(face), n);
  assert.ok(freePairs(next.tiles).length > 0);
});

test("labels cover every face", () => {
  for (let i = 0; i < 45; i++) assert.equal(faceLabel(i).length > 0, true);
});
