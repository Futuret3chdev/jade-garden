import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

export type Score = {
  id: number;
  nick: string;
  tilesLeft: number;
  moves: number;
  mispicks: number;
};

type ScoreRow = {
  id: number;
  nick: string;
  tiles_left: number;
  moves: number;
  mispicks: number;
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

function cleanCount(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 999) {
    throw new Error(`${label} is not a real result.`);
  }
  return value;
}

async function topScores(): Promise<Score[]> {
  const sql = await getSql();
  const rows = await sql<ScoreRow>`
    select id, nick, tiles_left, moves, mispicks
    from scores
    order by tiles_left asc, mispicks asc, moves asc, created_at asc
    limit 8
  `;
  return rows.map((row) => ({
    id: Number(row.id),
    nick: row.nick,
    tilesLeft: Number(row.tiles_left),
    moves: Number(row.moves),
    mispicks: Number(row.mispicks),
  }));
}

export const listScores = createServerFn({ method: "GET" }).handler(async () => topScores());

export const submitScore = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("That score did not send.");
    const raw = input as Record<string, unknown>;
    return {
      nick: cleanNick(raw.nick),
      tilesLeft: cleanCount(raw.tilesLeft, "Tiles left"),
      moves: cleanCount(raw.moves, "Moves"),
      mispicks: cleanCount(raw.mispicks, "Slips"),
    };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into scores (nick, tiles_left, moves, mispicks)
      values (${data.nick}, ${data.tilesLeft}, ${data.moves}, ${data.mispicks})
    `;
    return topScores();
  });
