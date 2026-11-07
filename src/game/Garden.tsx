import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Undo2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import gardenUrl from "@/assets/garden.jpg";
import { play, resumeAudio, setSoundEnabled, unlockAudio } from "@/game/audio";
import { TileFace } from "@/game/faces";
import {
  cloneTiles,
  faceLabel,
  freePairs,
  isFree,
  newDeal,
  shuffleRemaining,
  type Tile,
} from "@/game/logic";
import { BOARD_H, BOARD_W, TILE_H, TILE_W, tilePosition } from "@/game/metrics";
import { readSave, writeSave } from "@/game/save";

type Snap = { tiles: Tile[]; moves: number; mispicks: number; clears: number };
type Ghost = { key: string; face: number; left: number; top: number; z: number };
type Spark = { id: number; x: number; y: number; dx: number; dy: number; color: string };

const SPARK_COLORS = ["bg-gold", "bg-jade", "bg-seal", "bg-ivory"];

export function Garden() {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [original, setOriginal] = useState<Tile[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hinted, setHinted] = useState<number[]>([]);
  const [message, setMessage] = useState("Laying the tiles…");
  const [moves, setMoves] = useState(0);
  const [mispicks, setMispicks] = useState(0);
  const [history, setHistory] = useState<Snap[]>([]);
  const [clears, setClears] = useState(0);
  const [sound, setSound] = useState(true);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState<"fit" | "play">("fit");
  const [stageWidth, setStageWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [shake, setShake] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const focusFree = useRef(false);
  const sparkSeq = useRef(1);
  const timers = useRef<number[]>([]);
  const reduceRef = useRef(false);
  reduceRef.current = reduceMotion;

  const api = useRef({
    hint: () => {},
    undo: () => {},
    shuffle: () => {},
    restart: () => {},
    fresh: () => {},
  });

  useEffect(() => {
    if (!trailerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTrailerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trailerOpen]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const apply = () => setStageWidth(el.clientWidth);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const saved = readSave();
    const keepClears = saved?.clears ?? 0;
    const keepSound = saved?.sound ?? true;
    setSound(keepSound);
    setSoundEnabled(keepSound);
    setClears(keepClears);
    const restorable = saved?.tiles?.some((t) => !t.removed) && saved.original;
    if (saved && restorable) {
      setTiles(saved.tiles);
      setOriginal(saved.original);
      setMoves(saved.moves);
      setMispicks(saved.mispicks);
      const open = freePairs(saved.tiles);
      setMessage(
        open.length
          ? "Your garden is as you left it."
          : "No moves remain. Shuffle to rearrange the remaining pairs, or restart.",
      );
    } else {
      const deal = newDeal();
      setTiles(deal.tiles);
      setOriginal(cloneTiles(deal.tiles));
      setMessage("A fresh, solvable deal. Take your time.");
    }
    setReady(true);

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) setZoom("play");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduceMotion(motion.matches);
    syncMotion();
    motion.addEventListener("change", syncMotion);

    const onGesture = () => unlockAudio();
    const onVis = () => {
      if (document.visibilityState === "visible") resumeAudio();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    document.addEventListener("visibilitychange", onVis);

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (k === "h") api.current.hint();
      else if (k === "u") api.current.undo();
      else if (k === "s") api.current.shuffle();
      else if (k === "r") api.current.restart();
      else if (k === "n") api.current.fresh();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      motion.removeEventListener("change", syncMotion);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
      timers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (!ready || !tiles || !original) return;
    writeSave({ v: 1, tiles, original, moves, mispicks, clears, sound });
  }, [ready, tiles, original, moves, mispicks, clears, sound]);

  useEffect(() => {
    if (!focusFree.current) return;
    focusFree.current = false;
    boardRef.current?.querySelector<HTMLButtonElement>('[data-free="1"]')?.focus({ preventScroll: true });
  }, [tiles]);

  const freeIds = useMemo(() => {
    const ids = new Set<number>();
    if (!tiles) return ids;
    for (const t of tiles) if (isFree(t, tiles)) ids.add(t.id);
    return ids;
  }, [tiles]);

  const remaining = tiles ? tiles.filter((t) => !t.removed).length : null;
  const won = remaining === 0;

  const bounds = useMemo(() => {
    let w = BOARD_W;
    let h = BOARD_H;
    for (const t of tiles ?? []) {
      if (t.removed) continue;
      const p = tilePosition(t);
      w = Math.max(w, p.left + TILE_W + 28);
      h = Math.max(h, p.top + TILE_H + 32);
    }
    return { w, h };
  }, [tiles]);

  const fit = stageWidth > 0 ? stageWidth / bounds.w : 1;
  const scale = Math.min(1, zoom === "play" ? Math.max(fit, Math.min(1, 50 / TILE_W)) : fit);
  const overflows = stageWidth > 0 && bounds.w * scale > stageWidth + 8;

  function later(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }

  function burst(pair: Tile[]) {
    if (reduceRef.current) return;
    const born: Spark[] = [];
    pair.forEach((t, ti) => {
      const p = tilePosition(t);
      const x = p.left + TILE_W / 2;
      const y = p.top + TILE_H / 2;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 + ti * 0.4;
        const dist = 26 + (i % 3) * 12;
        born.push({
          id: sparkSeq.current++,
          x,
          y,
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist - 12,
          color: SPARK_COLORS[i % SPARK_COLORS.length],
        });
      }
    });
    setSparks((s) => [...s, ...born]);
    const ids = new Set(born.map((s) => s.id));
    later(() => setSparks((s) => s.filter((sp) => !ids.has(sp.id))), 680);
    setShake(true);
    later(() => setShake(false), 300);
  }

  function depart(pair: Tile[]) {
    const born = pair.map((t) => {
      const p = tilePosition(t);
      return { key: `${t.id}-${sparkSeq.current++}`, face: t.face, left: p.left, top: p.top, z: t.z };
    });
    setGhosts((g) => [...g, ...born]);
    const keys = new Set(born.map((g) => g.key));
    later(() => setGhosts((g) => g.filter((ghost) => !keys.has(ghost.key))), 460);
  }

  function noteAfter(next: Tile[]) {
    const left = next.filter((t) => !t.removed).length;
    if (left === 0) return "Beautifully done — the garden is clear.";
    if (freePairs(next).length === 0) {
      return "No moves remain. Shuffle to rearrange the remaining pairs, or restart.";
    }
    return "A little more space. Keep going.";
  }

  function onChoose(id: number) {
    if (!tiles) return;
    unlockAudio();
    const tile = tiles.find((t) => t.id === id);
    if (!tile || tile.removed) return;
    if (!freeIds.has(id)) {
      setMessage("That tile is blocked. Clear its top and open a horizontal side.");
      play("block");
      return;
    }
    setHinted([]);
    if (selected === id) {
      setSelected(null);
      setMessage("Selection cleared.");
      play("ui");
      return;
    }
    const other = tiles.find((t) => t.id === selected);
    if (other && freeIds.has(other.id) && other.face === tile.face) {
      const snap: Snap = { tiles: cloneTiles(tiles), moves, mispicks, clears };
      const next = tiles.map((t) =>
        t.id === other.id || t.id === tile.id ? { ...t, removed: true } : t,
      );
      const clearedNow = next.every((t) => t.removed);
      setHistory((h) => [...h.slice(-39), snap]);
      setTiles(next);
      setSelected(null);
      setMoves((m) => m + 1);
      if (clearedNow) setClears((c) => c + 1);
      setMessage(noteAfter(next));
      depart([other, tile]);
      burst([other, tile]);
      play(clearedNow ? "win" : "match");
      focusFree.current = true;
      return;
    }
    if (other) {
      setMispicks((n) => n + 1);
      setMessage("Not a match — try another tile.");
      play("miss");
    } else {
      setMessage("Tile selected. Find its identical partner.");
      play("select");
    }
    setSelected(id);
  }

  function onHint() {
    if (!tiles || won) return;
    unlockAudio();
    const pairs = freePairs(tiles);
    const pair = pairs[0];
    setSelected(null);
    if (!pair) {
      setHinted([]);
      setMessage("No matching free pairs. Try Shuffle.");
      play("block");
      return;
    }
    setHinted([pair[0].id, pair[1].id]);
    setMessage("The jade outlines show a matching free pair.");
    play("ui");
  }

  function onUndo() {
    const snap = history[history.length - 1];
    if (!snap) return;
    unlockAudio();
    setHistory((h) => h.slice(0, -1));
    setTiles(cloneTiles(snap.tiles));
    setMoves(snap.moves);
    setMispicks(snap.mispicks);
    setClears(snap.clears);
    setSelected(null);
    setHinted([]);
    setMessage("Last match undone.");
    play("ui");
  }

  function onShuffle() {
    if (!tiles || won) return;
    unlockAudio();
    try {
      const next = shuffleRemaining(tiles);
      setTiles(next.tiles);
      setSelected(null);
      setHinted([]);
      setHistory([]);
      setMessage(
        next.reflow
          ? "Tiles opened into a fresh arrangement. A complete solution is available."
          : "Remaining pairs reshuffled. A complete solution is available.",
      );
      play("ui");
    } catch {
      setMessage("Could not reshuffle. Restart the deal.");
      play("block");
    }
  }

  function onRestart() {
    if (!original) return;
    unlockAudio();
    setTiles(cloneTiles(original));
    setSelected(null);
    setHinted([]);
    setHistory([]);
    setMoves(0);
    setMispicks(0);
    setMessage("Original deal restored. A fresh start.");
    play("ui");
  }

  function onFresh() {
    unlockAudio();
    const deal = newDeal();
    setTiles(deal.tiles);
    setOriginal(cloneTiles(deal.tiles));
    setSelected(null);
    setHinted([]);
    setHistory([]);
    setMoves(0);
    setMispicks(0);
    setMessage("A fresh, solvable deal. Take your time.");
    play("ui");
  }

  api.current = { hint: onHint, undo: onUndo, shuffle: onShuffle, restart: onRestart, fresh: onFresh };

  function onBoardKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!tiles) return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    const current = document.activeElement as HTMLElement | null;
    const fromId = Number(current?.dataset.id);
    const from = tiles.find((t) => t.id === fromId);
    if (!from) return;
    e.preventDefault();
    const dir = e.key;
    let best: Tile | null = null;
    let bestScore = Infinity;
    for (const c of tiles) {
      if (c.removed || c.id === from.id || !freeIds.has(c.id)) continue;
      const dx = c.x - from.x;
      const dy = c.y - from.y;
      const ok =
        (dir === "ArrowLeft" && dx < 0 && Math.abs(dy) <= Math.abs(dx) + 0.01) ||
        (dir === "ArrowRight" && dx > 0 && Math.abs(dy) <= Math.abs(dx) + 0.01) ||
        (dir === "ArrowUp" && dy < 0 && Math.abs(dx) <= Math.abs(dy) + 0.01) ||
        (dir === "ArrowDown" && dy > 0 && Math.abs(dx) <= Math.abs(dy) + 0.01);
      if (!ok) continue;
      const score = dx * dx + dy * dy;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) {
      boardRef.current
        ?.querySelector<HTMLButtonElement>(`[data-id="${best.id}"]`)
        ?.focus({ preventScroll: true });
    }
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    unlockAudio();
    if (next) play("ui");
  }

  return (
    <div className="garden-sky">
      <img src={gardenUrl} alt="" className="garden-photo" />
      <div className="garden-shade" />
      <div className="garden-petals" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className="petal"
            style={{ left: `${(i * 8.3) % 100}%`, animationDuration: `${14 + (i % 5) * 2}s`, animationDelay: `${-i * 1.4}s` }}
          />
        ))}
      </div>

      <main className="relative mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-7">
        <header className="garden-head">
          <div className="min-w-0">
            <p className="eyebrow">A quiet moment of play</p>
            <h1 className="garden-title">Jade Garden</h1>
            <p className="lede">Match. Uncover. Unwind.</p>
          </div>
          <div className="score-pill">
            <strong>{remaining ?? "—"}</strong>
            <span>tiles left</span>
            <span>
              {clears} cleared
              {mispicks > 0 ? ` · ${mispicks} slips` : ""}
            </span>
          </div>
        </header>

        <nav className="garden-dock" aria-label="Game controls">
          <button type="button" className="dock-btn" onClick={onHint} disabled={!tiles || won}>
            <Sparkles aria-hidden className="dock-ico text-gold" />
            <span>Hint</span>
          </button>
          <button type="button" className="dock-btn" onClick={onUndo} disabled={history.length === 0}>
            <Undo2 aria-hidden className="dock-ico" />
            <span>Undo</span>
          </button>
          <button type="button" className="dock-btn" onClick={onShuffle} disabled={!tiles || won}>
            <Shuffle aria-hidden className="dock-ico" />
            <span>Shuffle</span>
          </button>
          <button type="button" className="dock-btn" onClick={onRestart} disabled={!original}>
            <RotateCcw aria-hidden className="dock-ico" />
            <span>Restart</span>
          </button>
          <button type="button" className="dock-btn is-primary" onClick={onFresh}>
            <Plus aria-hidden className="dock-ico" />
            <span>New</span>
          </button>
          <button type="button" className="dock-btn" onClick={() => setZoom((z) => (z === "fit" ? "play" : "fit"))}>
            {zoom === "fit" ? <ZoomIn aria-hidden className="dock-ico" /> : <ZoomOut aria-hidden className="dock-ico" />}
            <span>{zoom === "fit" ? "Bigger" : "Fit"}</span>
          </button>
          <button type="button" className="dock-btn" onClick={toggleSound} aria-pressed={sound}>
            {sound ? <Volume2 aria-hidden className="dock-ico" /> : <VolumeX aria-hidden className="dock-ico" />}
            <span>{sound ? "Sound" : "Muted"}</span>
          </button>
          <button type="button" className="dock-btn" onClick={() => setTrailerOpen(true)}>
            <Play aria-hidden className="dock-ico" />
            <span>Trailer</span>
          </button>
        </nav>

        <p id="status" className="garden-status" role="status" aria-live="polite">
          {message}
        </p>

        <section ref={stageRef} className="garden-stage" aria-label="Mahjong tile board">
          <div className="garden-scroll">
            <div style={{ width: bounds.w * scale, height: bounds.h * scale }}>
              <div className="mj-tray" style={{ width: bounds.w, height: bounds.h, transform: `scale(${scale})` }}>
                <div
                  ref={boardRef}
                  className={shake && !reduceMotion ? "mj-shake" : undefined}
                  style={{ position: "relative", width: "100%", height: "100%" }}
                  onKeyDown={onBoardKey}
                >
                  {!tiles && (
                    <p className="absolute inset-0 grid place-items-center text-mist">Laying the tiles…</p>
                  )}
                  {tiles
                    ?.filter((t) => !t.removed)
                    .map((t) => {
                      const pos = tilePosition(t);
                      const free = freeIds.has(t.id);
                      const label = faceLabel(t.face);
                      const classes = [
                        "mj-tile",
                        free ? "is-free" : "is-blocked",
                        selected === t.id ? "is-selected" : "",
                        hinted.includes(t.id) ? "is-hint" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={classes}
                          data-id={t.id}
                          data-face={t.face}
                          data-free={free ? "1" : "0"}
                          data-z={t.z}
                          tabIndex={free ? 0 : -1}
                          aria-label={`${label}, ${free ? "free" : "blocked"}`}
                          aria-disabled={!free}
                          aria-pressed={selected === t.id}
                          style={{
                            left: pos.left,
                            top: pos.top,
                            zIndex: (selected === t.id ? 6000 : 0) + t.z * 100 + t.y * 10 + t.x,
                          }}
                          onClick={() => onChoose(t.id)}
                        >
                          <TileFace face={t.face} />
                        </button>
                      );
                    })}
                  {ghosts.map((g) => (
                    <div
                      key={g.key}
                      className="mj-tile mj-ghost"
                      data-z={g.z}
                      style={{ left: g.left, top: g.top, zIndex: 7000 + g.z }}
                    >
                      <TileFace face={g.face} />
                    </div>
                  ))}
                  {sparks.map((s) => (
                    <span
                      key={s.id}
                      className={`mj-spark ${s.color}`}
                      style={
                        {
                          left: s.x,
                          top: s.y,
                          "--dx": `${s.dx}px`,
                          "--dy": `${s.dy}px`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          {won && (
            <div className="win-veil">
              <div className="win-card">
                <p className="eyebrow">Cleared</p>
                <h2>The garden is still</h2>
                <p className="lede mx-auto">
                  Sixty pairs lifted
                  {mispicks ? `, with ${mispicks} mis-picks along the way` : ", without a mis-pick"}. The moon can
                  have the pond back.
                </p>
                <button type="button" className="garden-btn is-primary mt-4" onClick={onFresh}>
                  New game
                </button>
              </div>
            </div>
          )}
        </section>
        {overflows && <p className="scroll-hint">Swipe across the lacquer if the outer tiles sit past the edge.</p>}

        <div className="rules">
          <p>
            <strong>How to play</strong>
            Match two identical free tiles. A tile is free when nothing sits above it and its left or right side is
            open. Darker tiles are blocked.
          </p>
          <p>
            <strong>Take your time</strong>
            Hint outlines a pair. Shuffle keeps the tiles you still have and guarantees a way through. Restart restores
            the original deal. Undo lifts the last match.
          </p>
          <p>
            <strong>Keys</strong>
            Tab, Enter, or Space selects a free tile. Arrows move across open tiles. H hint, U undo, S shuffle, R
            restart, N new game.
          </p>
        </div>

        <footer className="garden-foot">
          <a href="https://t3x.futuret3ch.com.au" target="_blank" rel="noopener">
            Created by futuret3ch
          </a>
        </footer>
      </main>
      {trailerOpen && (
        <div className="trailer-scrim" onClick={() => setTrailerOpen(false)}>
          <div
            className="trailer-card"
            role="dialog"
            aria-modal="true"
            aria-label="Jade Garden trailer"
            onClick={(event) => event.stopPropagation()}
          >
            <video src="/trailer.mp4?v=2" controls autoPlay playsInline />
            <div className="trailer-bar">
              <p>A minute in the garden</p>
              <button type="button" className="garden-btn" onClick={() => setTrailerOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
