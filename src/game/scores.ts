import { createServerFn } from "@tanstack/react-start";
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
const MODES: PlayMode[] = ["normal", "timed", "m20", "m10", "m5"];
const MODE_KEY: Record<PlayMode, string> = {
  normal: "n",
  timed: "t",
  m20: "20",
  m10: "10",
  m5: "5",
};
const STORE = "jgb8e1c4a90d";

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

function emptyBoards(): Boards {
  return { normal: [], timed: [], m20: [], m10: [], m5: [] };
}

function byRank(a: Score, b: Score) {
  return a.tilesLeft - b.tilesLeft || a.elapsedSec - b.elapsedSec || a.mispicks - b.mispicks || a.moves - b.moves;
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

async function sqlBoards(): Promise<Boards> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<ScoreRow>`
    select id, nick, tiles_left, moves, mispicks, elapsed_sec, mode
    from scores
    order by tiles_left asc, elapsed_sec asc, mispicks asc, moves asc, created_at asc
  `;
  const next = emptyBoards();
  const all: Score[] = [];
  for (const row of rows) {
    const score = mapRow(row);
    if (score) all.push(score);
  }
  for (const mode of MODES) next[mode] = all.filter((score) => score.mode === mode).sort(byRank).slice(0, 8);
  return next;
}

async function remoteGet(key: string) {
  const res = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${STORE}/${key}`, {
    headers: { "Content-Length": "0" },
  });
  if (!res.ok) throw new Error("The board could not be reached.");
  const text = (await res.text()).trim();
  if (!text || text === '""') return "";
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "string" ? parsed : "";
  } catch {
    throw new Error("The board could not be reached.");
  }
}

function parseList(mode: PlayMode, raw: string): Score[] {
  if (!raw) return [];
  return raw.split(";").flatMap((part, index) => {
    const [nick, tiles, moves, slips, elapsed] = part.split("|");
    if (!nick) return [];
    return [
      {
        id: index + 1,
        nick,
        tilesLeft: Number(tiles) || 0,
        moves: Number(moves) || 0,
        mispicks: Number(slips) || 0,
        elapsedSec: Number(elapsed) || 0,
        mode,
      },
    ];
  });
}

function pack(rows: Score[]) {
  let raw = "";
  for (const row of rows) {
    const line = `${row.nick}|${row.tilesLeft}|${row.moves}|${row.mispicks}|${row.elapsedSec}`;
    const next = raw ? `${raw};${line}` : line;
    if (encodeURIComponent(next).length > 200) break;
    raw = next;
  }
  return raw;
}

async function remoteSet(key: string, value: string) {
  const res = await fetch(
    `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${STORE}/${key}/${encodeURIComponent(value)}`,
    { method: "POST", headers: { "Content-Length": "0" } },
  );
  if (!res.ok || (await res.text()).trim() !== "true") throw new Error("The board could not be reached.");
}

async function remoteBoards(): Promise<Boards> {
  const next = emptyBoards();
  await Promise.all(
    MODES.map(async (mode) => {
      next[mode] = parseList(mode, await remoteGet(MODE_KEY[mode]));
    }),
  );
  return next;
}

async function remoteInsert(data: {
  nick: string;
  tilesLeft: number;
  moves: number;
  mispicks: number;
  elapsedSec: number;
  mode: PlayMode;
}) {
  const current = parseList(data.mode, await remoteGet(MODE_KEY[data.mode]));
  const ranked = [...current, { id: 0, ...data }].sort(byRank).slice(0, 8);
  await remoteSet(MODE_KEY[data.mode], pack(ranked));
  return remoteBoards();
}

function useHostedDb() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export const listScores = createServerFn({ method: "GET" }).handler(async () =>
  useHostedDb() ? sqlBoards() : remoteBoards(),
);

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
    if (useHostedDb()) {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      await sql`
        insert into scores (nick, tiles_left, moves, mispicks, elapsed_sec, mode)
        values (${data.nick}, ${data.tilesLeft}, ${data.moves}, ${data.mispicks}, ${data.elapsedSec}, ${data.mode})
      `;
      return sqlBoards();
    }
    try {
      return await remoteInsert(data);
    } catch (err) {
      if (err instanceof Error && (err.message.startsWith("The board") || err.message.startsWith("That "))) throw err;
      throw new Error("The board could not be reached.");
    }
  });
