import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listScores, submitScore, type Score } from "@/game/scores";
import { xIntent } from "@/game/share";

export function Standings({ refresh }: { refresh: number }) {
  const [rows, setRows] = useState<Score[]>([]);
  const [quiet, setQuiet] = useState(false);

  useEffect(() => {
    let live = true;
    listScores()
      .then((next) => {
        if (!live) return;
        setRows(next);
        setQuiet(false);
      })
      .catch(() => {
        if (live) setQuiet(true);
      });
    return () => {
      live = false;
    };
  }, [refresh]);

  return (
    <section className="standings" aria-label="Leaderboard">
      <div className="standings-head">
        <h2>The board</h2>
        <a className="garden-btn" href={xIntent()} target="_blank" rel="noopener noreferrer">
          Share on X
        </a>
      </div>
      {quiet ? (
        <p className="standings-empty">The board is quiet for a moment. Try again shortly.</p>
      ) : rows.length === 0 ? (
        <p className="standings-empty">No names yet. When a path closes, leave yours.</p>
      ) : (
        <ol>
          {rows.map((row, index) => (
            <li key={row.id}>
              <span className="standings-rank">{index + 1}</span>
              <span className="standings-nick">{row.nick}</span>
              <span className="standings-result">
                {row.tilesLeft === 0 ? "Cleared" : `${row.tilesLeft} left`}
                <small>
                  {row.moves} moves
                  {row.mispicks ? ` · ${row.mispicks} slips` : ""}
                </small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function NickGate({
  tilesLeft,
  moves,
  mispicks,
  heading,
  onPosted,
}: {
  tilesLeft: number;
  moves: number;
  mispicks: number;
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
      await sendScore({ data: { nick, tilesLeft, moves, mispicks } });
      onPosted(nick.trim());
    } catch {
      setError("That name did not land. Try a shorter one.");
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
