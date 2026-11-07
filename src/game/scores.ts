import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { challengeLimit, isPlayMode, type PlayMode } from "@/game/modes";

export type Score = {
  id: number;
  nick: string;
  tilesLeft: number;
  moves: number;
  mispicks: number;
  elapsedSec: number;
  mode: PlayMode;
};

export type Boards = Record<PlayMode, Score[]>;

type ScoreRow = {
  id: number;
  nick: string;
  tiles_left: number;
  moves: number;
  mispicks: number;
  elapsed_sec: number;
  mode: string;
};

const NICK = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,15}$/u;

function cleanNick(value: unknown) {
  if (typeof value !== "string") throw new Error("Use a short name.");
  const nick = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!NICK.test(nick) || /[@/\\]/.test(nick)) {
    throw new Error("Use a short name — letters, numbers, and spaces.");
  }
  return nick;
}

function cleanCount(value: unknown, label: string, max = 999) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`${label} is not a real result.`);
  }
  return value;
}

function mapRow(row: ScoreRow): Score | null {
  if (!isPlayMode(row.mode)) return null;
  return {
    id: Number(row.id),
    nick: row.nick,
    tilesLeft: Number(row.tiles_left),
    moves: Number(row.moves),
    mispicks: Number(row.mispicks),
    elapsedSec: Number(row.elapsed_sec),
    mode: row.mode,
  };
}

async function boards(): Promise<Boards> {
  const sql = await getSql();
  const rows = await sql<ScoreRow>`
    select id, nick, tiles_left, moves, mispicks, elapsed_sec, mode
    from scores
    order by
      case mode
        when 'normal' then 0
        when 'timed' then 1
        when 'm20' then 2
        when 'm10' then 3
        else 4
      end,
      tiles_left asc,
      elapsed_sec asc,
      mispicks asc,
      moves asc,
      created_at asc
  `;
  const next: Boards = { normal: [], timed: [], m20: [], m10: [], m5: [] };
  for (const row of rows) {
    const score = mapRow(row);
    if (!score) continue;
    const list = next[score.mode];
    if (list.length < 8) list.push(score);
  }
  return next;
}

export const listScores = createServerFn({ method: "GET" }).handler(async () => boards());

export const submitScore = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("That score did not send.");
    const raw = input as Record<string, unknown>;
    const mode = raw.mode;
    if (!isPlayMode(mode)) throw new Error("That board does not exist.");
    const tilesLeft = cleanCount(raw.tilesLeft, "Tiles left", 120);
    const elapsedSec = cleanCount(raw.elapsedSec, "Time", 86400);
    const limit = challengeLimit(mode);
    if (limit != null && tilesLeft === 0 && elapsedSec > limit) {
      throw new Error("That clear is outside the challenge.");
    }
    return {
      nick: cleanNick(raw.nick),
      tilesLeft,
      moves: cleanCount(raw.moves, "Moves"),
      mispicks: cleanCount(raw.mispicks, "Slips"),
      elapsedSec: mode === "normal" ? 0 : elapsedSec,
      mode,
    };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into scores (nick, tiles_left, moves, mispicks, elapsed_sec, mode)
      values (${data.nick}, ${data.tilesLeft}, ${data.moves}, ${data.mispicks}, ${data.elapsedSec}, ${data.mode})
    `;
    return boards();
  });
