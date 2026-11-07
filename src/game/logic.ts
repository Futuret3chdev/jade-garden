export type Tile = {
  id: number;
  x: number;
  y: number;
  z: number;
  face: number;
  removed: boolean;
};

export const FACE_COUNT = 45;
export const DEAL_FACES = Array.from({ length: 60 }, (_, i) => i % FACE_COUNT);

const WIND = ["East", "South", "West", "North"] as const;
const DRAGON = ["Red dragon", "Green dragon", "White dragon"] as const;
const FLOWER = ["Plum blossom", "Orchid", "Chrysanthemum", "Bamboo flower"] as const;
const SEASON = ["Spring", "Summer", "Autumn", "Winter"] as const;
const GARDEN = ["Crane", "Koi", "Lotus"] as const;

export function faceLabel(face: number): string {
  if (face < 9) return `Bamboo ${face + 1}`;
  if (face < 18) return `Circles ${face - 8}`;
  if (face < 27) return `Characters ${face - 17}`;
  if (face < 31) return `${WIND[face - 27]} wind`;
  if (face < 34) return DRAGON[face - 31];
  if (face < 38) return FLOWER[face - 34];
  if (face < 42) return SEASON[face - 38];
  return GARDEN[face - 42] ?? "Tile";
}

export function faceCaption(face: number): string {
  if (face < 9) return "Bamboo";
  if (face < 18) return "Circles";
  if (face < 27) return "Characters";
  if (face < 31) return WIND[face - 27];
  if (face < 34) return DRAGON[face - 31].replace(" dragon", "");
  if (face < 38) return FLOWER[face - 34].split(" ")[0];
  if (face < 42) return SEASON[face - 38];
  return GARDEN[face - 42] ?? "Garden";
}

function mix<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

export function layout(): Tile[] {
  const tiles: Tile[] = [];
  const dims = [
    { w: 10, h: 8 },
    { w: 6, h: 6 },
    { w: 2, h: 2 },
  ];
  for (let z = 0; z < dims.length; z++) {
    const { w, h } = dims[z];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        tiles.push({
          id: tiles.length,
          x: x + (10 - w) / 2,
          y: y + (8 - h) / 2,
          z,
          face: 0,
          removed: false,
        });
      }
    }
  }
  return tiles;
}

function keyOf(z: number, x: number, y: number) {
  return `${z}|${x}|${y}`;
}

export function isFree(t: Tile, tiles: Tile[]): boolean {
  if (t.removed) return false;
  for (const u of tiles) {
    if (u.removed || u.z <= t.z) continue;
    if (Math.abs(u.x - t.x) < 1 && Math.abs(u.y - t.y) < 1) return false;
  }
  let left = false;
  let right = false;
  for (const u of tiles) {
    if (u.removed || u.z !== t.z || Math.abs(u.y - t.y) >= 1) continue;
    if (u.x === t.x - 1) left = true;
    else if (u.x === t.x + 1) right = true;
    if (left && right) return false;
  }
  return !left || !right;
}

/** Build a full removal order by lifting random free pairs. Faces are assigned later. */
export function removalSequence(tiles: Tile[]): [number, number][] | null {
  const total = tiles.reduce((n, t) => n + (t.removed ? 0 : 1), 0);
  if (total === 0) return [];
  if (total % 2 !== 0) return null;
  let maxZ = 0;
  for (const t of tiles) if (t.z > maxZ) maxZ = t.z;

  for (let attempt = 0; attempt < 160; attempt++) {
    const alive = tiles.map((t) => !t.removed);
    const occ = new Map<string, number>();
    tiles.forEach((t, i) => {
      if (!t.removed) occ.set(keyOf(t.z, t.x, t.y), i);
    });
    const seq: [number, number][] = [];
    let removed = 0;
    while (removed < total) {
      const freeIdx: number[] = [];
      for (let i = 0; i < tiles.length; i++) {
        if (!alive[i]) continue;
        const t = tiles[i];
        let covered = false;
        for (let z = t.z + 1; z <= maxZ; z++) {
          if (occ.has(keyOf(z, t.x, t.y))) {
            covered = true;
            break;
          }
        }
        if (covered) continue;
        const left = occ.has(keyOf(t.z, t.x - 1, t.y));
        const right = occ.has(keyOf(t.z, t.x + 1, t.y));
        if (!left || !right) freeIdx.push(i);
      }
      if (freeIdx.length < 2) break;
      const i1 = Math.floor(Math.random() * freeIdx.length);
      let i2 = Math.floor(Math.random() * (freeIdx.length - 1));
      if (i2 >= i1) i2 += 1;
      const ia = freeIdx[i1];
      const ib = freeIdx[i2];
      const ta = tiles[ia];
      const tb = tiles[ib];
      alive[ia] = false;
      alive[ib] = false;
      occ.delete(keyOf(ta.z, ta.x, ta.y));
      occ.delete(keyOf(tb.z, tb.x, tb.y));
      seq.push([ta.id, tb.id]);
      removed += 2;
    }
    if (removed === total) return seq;
  }
  return null;
}

export function assignFaces(tiles: Tile[], seq: [number, number][], faces: number[]) {
  const order = mix([...faces]);
  const byId = new Map(tiles.map((t) => [t.id, t]));
  seq.forEach((pair, i) => {
    const face = order[i];
    for (const id of pair) {
      const tile = byId.get(id);
      if (tile && face !== undefined) tile.face = face;
    }
  });
}

export function newDeal(): { tiles: Tile[]; solution: [number, number][] } {
  for (let n = 0; n < 12; n++) {
    const tiles = layout();
    const solution = removalSequence(tiles);
    if (solution) {
      assignFaces(tiles, solution, DEAL_FACES);
      return { tiles, solution };
    }
  }
  throw new Error("Layout generation failed");
}

export function freePairs(tiles: Tile[]): [Tile, Tile][] {
  const open = tiles.filter((t) => isFree(t, tiles));
  const pairs: [Tile, Tile][] = [];
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      if (open[i].face === open[j].face) pairs.push([open[i], open[j]]);
    }
  }
  return pairs;
}

export function shuffleRemaining(tiles: Tile[]): { tiles: Tile[]; reflow: boolean } {
  const live = tiles.filter((t) => !t.removed);
  if (live.length === 0) return { tiles: tiles.map((t) => ({ ...t })), reflow: false };

  const counts = new Map<number, number>();
  for (const t of live) counts.set(t.face, (counts.get(t.face) ?? 0) + 1);
  const inventory: number[] = [];
  for (const [face, n] of counts) {
    for (let i = 0; i < Math.floor(n / 2); i++) inventory.push(face);
  }
  if (inventory.length * 2 !== live.length) throw new Error("Uneven tile inventory");

  let working = tiles.map((t) => ({ ...t }));
  let seq = removalSequence(working);
  let reflow = false;
  if (!seq) {
    reflow = true;
    working = live.map((t, i) => ({
      id: i,
      x: i % 10,
      y: Math.floor(i / 10),
      z: 0,
      face: t.face,
      removed: false,
    }));
    seq = removalSequence(working);
  }
  if (!seq) throw new Error("Shuffle failed");
  assignFaces(working, seq, inventory);
  return { tiles: working, reflow };
}

export function cloneTiles(tiles: Tile[]): Tile[] {
  return tiles.map((t) => ({ ...t }));
}
