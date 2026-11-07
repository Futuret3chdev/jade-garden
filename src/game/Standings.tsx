import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { formatClock, MODE_LABEL, type PlayMode } from "@/game/modes";
import { listScores, submitScore, type Boards, type Score } from "@/game/scores";
import { xIntent } from "@/game/share";

type BoardTab = "normal" | "timed" | "challenge";

const TABS: { id: BoardTab; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "timed", label: "Timed" },
  { id: "challenge", label: "Challenges" },
];

function tabFor(mode: PlayMode): BoardTab {
  if (mode === "timed") return "timed";
  if (mode === "normal") return "normal";
  return "challenge";
}

function Result({ row, timed }: { row: Score; timed: boolean }) {
  const cleared = row.tilesLeft === 0;
  return (
    <span className="standings-result">
      {timed ? formatClock(row.elapsedSec) : cleared ? "Cleared" : `${row.tilesLeft} left`}
      <small>
        {timed ? (cleared ? "cleared" : `${row.tilesLeft} left`) : `${row.moves} moves`}
        {row.mispicks ? ` · ${row.mispicks} slips` : ""}
      </small>
    </span>
  );
}

function Rows({ rows, timed, empty }: { rows: Score[]; timed: boolean; empty: string }) {
  if (rows.length === 0) return <p className="standings-empty">{empty}</p>;
  return (
    <ol>
      {rows.map((row, index) => (
        <li key={row.id}>
          <span className="standings-rank">{index + 1}</span>
          <span className="standings-nick">{row.nick}</span>
          <Result row={row} timed={timed} />
        </li>
      ))}
    </ol>
  );
}

export function Standings({ refresh, mode }: { refresh: number; mode: PlayMode }) {
  const [boards, setBoards] = useState<Boards | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [tab, setTab] = useState<BoardTab>("normal");

  useEffect(() => {
    let live = true;
    listScores()
      .then((next) => {
        if (!live) return;
        setBoards(next);
        setQuiet(false);
      })
      .catch(() => {
        if (live) setQuiet(true);
      });
    return () => {
      live = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (refresh === 0) return;
    setTab(tabFor(mode));
  }, [refresh, mode]);

  return (
    <section className="standings" aria-label="Leaderboard">
      <div className="standings-head">
        <h2>The board</h2>
        <a className="garden-btn" href={xIntent()} target="_blank" rel="noopener noreferrer">
          Share on X
        </a>
      </div>
      <div className="board-tabs" role="tablist" aria-label="Score boards">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "board-tab is-on" : "board-tab"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {quiet ? (
        <p className="standings-empty">The board is quiet for a moment. Try again shortly.</p>
      ) : tab === "challenge" ? (
        <div className="challenge-boards">
          {(["m20", "m10", "m5"] as const).map((key) => (
            <div key={key}>
              <h3>{MODE_LABEL[key]}</h3>
              <Rows rows={boards?.[key] ?? []} timed empty={`No ${MODE_LABEL[key]} names yet.`} />
            </div>
          ))}
        </div>
      ) : (
        <Rows
          rows={boards?.[tab] ?? []}
          timed={tab === "timed"}
          empty={tab === "timed" ? "No timed names yet. Start the clock and leave yours." : "No names yet. When a path closes, leave yours."}
        />
      )}
    </section>
  );
}

export function NickGate({
  tilesLeft,
  moves,
  mispicks,
  elapsedSec,
  mode,
  heading,
  onPosted,
}: {
  tilesLeft: number;
  moves: number;
  mispicks: number;
  elapsedSec: number;
  mode: PlayMode;
  heading: string;
  onPosted: (nick: string) => void;
}) {
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sendScore = useServerFn(submitScore);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendScore({ data: { nick, tilesLeft, moves, mispicks, elapsedSec, mode } });
      onPosted(nick.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message.startsWith("Use a short") || message.startsWith("That ")
          ? message
          : "The board could not be reached. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="nick-card" onSubmit={onSubmit}>
      <p className="eyebrow">{heading}</p>
      <label>
        Your name
        <span className="nick-row">
          <input
            value={nick}
            maxLength={16}
            autoComplete="nickname"
            placeholder="Koi"
            onChange={(event) => setNick(event.target.value)}
          />
          <button type="submit" className="garden-btn is-primary" disabled={busy || nick.trim().length === 0}>
            {busy ? "Saving" : "Leave it"}
          </button>
        </span>
      </label>
      {error ? <p className="nick-error">{error}</p> : null}
    </form>
  );
}
