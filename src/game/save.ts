import type { Tile } from "@/game/logic";
import { isPlayMode, type PlayMode } from "@/game/modes";

export type Save = {
  v: 1;
  tiles: Tile[];
  original: Tile[];
  moves: number;
  mispicks: number;
  clears: number;
  sound: boolean;
  mode: PlayMode;
  elapsed: number;
};

const KEY = "jade-garden-v1";

function isTile(value: unknown): value is Tile {
  if (!value || typeof value !== "object") return false;
  const t = value as Tile;
  return (
    typeof t.id === "number" &&
    typeof t.x === "number" &&
    typeof t.y === "number" &&
    typeof t.z === "number" &&
    typeof t.face === "number" &&
    typeof t.removed === "boolean"
  );
}

export function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Save>;
    if (data.v !== 1 || !Array.isArray(data.tiles) || !Array.isArray(data.original)) return null;
    if (!data.tiles.every(isTile) || !data.original.every(isTile)) return null;
    return {
      v: 1,
      tiles: data.tiles,
      original: data.original,
      moves: Number(data.moves) || 0,
      mispicks: Number(data.mispicks) || 0,
      clears: Number(data.clears) || 0,
      sound: data.sound !== false,
      mode: isPlayMode(data.mode) ? data.mode : "normal",
      elapsed: Number(data.elapsed) || 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(save: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / quota */
  }
}
