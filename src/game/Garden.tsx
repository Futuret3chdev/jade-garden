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
import { Pond } from "@/game/Pond";
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
import { challengeLimit, formatClock, MODE_LABEL, PLAY_MODES, type PlayMode } from "@/game/modes";
import { readSave, writeSave } from "@/game/save";
import { NickGate, Standings } from "@/game/Standings";
import { xIntent } from "@/game/share";

type Snap = { tiles: Tile[]; moves: number; mispicks: number; clears: number };
type Ghost = { key: string; face: number; left: number; top: number; z: number; spin: number };
type Spark = { id: number; x: number; y: number; dx: number; dy: number; color: string; big: boolean };
type Ring = { id: number; x: number; y: number; jade: boolean };

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
  const [rings, setRings] = useState<Ring[]>([]);
  const [shake, setShake] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [posted, setPosted] = useState(false);
  const [boardTick, setBoardTick] = useState(0);
  const [signedName, setSignedName] = useState("");
  const [mode, setMode] = useState<PlayMode>("normal");
  const [elapsed, setElapsed] = useState(0);
  const [leave, setLeave] = useState<null | { next: "restart" } | { next: "fresh" } | { next: "mode"; mode: PlayMode }>(null);
  const startRef = useRef<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const focusFree = useRef(false);
  const sparkSeq = useRef(1);
  const timers = useRef<number[]>([]);
  const reduceRef = useRef(false);
  reduceRef.current = reduceMotion;

  function toggleHelp() {
    setHelpOpen((open) => {
      const next = !open;
      window.localStorage.setItem("jade-help", next ? "open" : "closed");
      return next;
    });
  }

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

  useEffect(() => {
    setHelpOpen(window.localStorage.getItem("jade-help") === "open");
  }, []);

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
      const savedMode = saved.mode;
      const elapsed0 = savedMode === "normal" ? 0 : saved.elapsed;
      const limit = challengeLimit(savedMode);
      setMode(savedMode);
      setTiles(saved.tiles);
      setOriginal(saved.original);
      setMoves(saved.moves);
      setMispicks(saved.mispicks);
      if (savedMode !== "normal" && (limit == null || elapsed0 < limit)) {
        startRef.current = Date.now() - elapsed0 * 1000;
        setElapsed(elapsed0);
      } else if (limit != null) {
        startRef.current = null;
        setElapsed(limit);
      }
      const open = freePairs(saved.tiles);
      setMessage(
        limit != null && elapsed0 >= limit
          ? "Time is up. Leave your name, or deal again."
          : open.length
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
    writeSave({ v: 1, tiles, original, moves, mispicks, clears, sound, mode, elapsed });
  }, [ready, tiles, original, moves, mispicks, clears, sound, mode, elapsed]);

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
  const stuck = !!tiles && !won && freePairs(tiles).length === 0;
  const limit = challengeLimit(mode);
  const timeUp = limit != null && !won && elapsed >= limit;
  const clock = mode === "normal" ? null : timeUp || limit == null ? elapsed : Math.max(0, limit - elapsed);

  useEffect(() => {
    if (!ready || mode === "normal" || startRef.current == null || won) return;
    const cap = challengeLimit(mode);
    const id = window.setInterval(() => {
      const start = startRef.current;
      if (start == null) return;
      const raw = Math.floor((Date.now() - start) / 1000);
      if (cap != null && raw >= cap) {
        startRef.current = null;
        setElapsed(cap);
        setMessage("Time is up. Leave your name, or deal again.");
        return;
      }
      setElapsed(raw);
    }, 1000);
    return () => window.clearInterval(id);
  }, [ready, mode, won]);

  function onPosted(nick: string) {
    setPosted(true);
    setSignedName(nick);
    setBoardTick((tick) => tick + 1);
  }

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
    const waves: Ring[] = [];
    pair.forEach((t, ti) => {
      const p = tilePosition(t);
      const x = p.left + TILE_W / 2;
      const y = p.top + TILE_H / 2;
      waves.push({ id: sparkSeq.current++, x, y, jade: false }, { id: sparkSeq.current++, x, y, jade: true });
      for (let i = 0; i < 14; i++) {
        const a = (Math.PI * 2 * i) / 14 + ti * 0.35;
        const dist = 28 + (i % 5) * 14;
        born.push({
          id: sparkSeq.current++,
          x,
          y,
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist * 0.72 - (16 + (i % 4) * 10),
          color: SPARK_COLORS[i % SPARK_COLORS.length],
          big: i % 3 === 0,
        });
      }
    });
    setSparks((s) => [...s, ...born]);
    setRings((r) => [...r, ...waves]);
    const ids = new Set(born.map((s) => s.id));
    const ringIds = new Set(waves.map((r) => r.id));
    later(() => setSparks((s) => s.filter((sp) => !ids.has(sp.id))), 860);
    later(() => setRings((r) => r.filter((ring) => !ringIds.has(ring.id))), 780);
    setShake(true);
    later(() => setShake(false), 420);
  }

  function depart(pair: Tile[]) {
    const born = pair.map((t, i) => {
      const p = tilePosition(t);
      return {
        key: `${t.id}-${sparkSeq.current++}`,
        face: t.face,
        left: p.left,
        top: p.top,
        z: t.z,
        spin: i === 0 ? -1 : 1,
      };
    });
    setGhosts((g) => [...g, ...born]);
    const keys = new Set(born.map((g) => g.key));
    later(() => setGhosts((g) => g.filter((ghost) => !keys.has(ghost.key))), 760);
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
    if (!tiles || leave) return;
    unlockAudio();
    if (timeUp) {
      setMessage("Time is up. Leave your name, or deal again.");
      play("block");
      return;
    }
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
    if (!tiles || won || timeUp || leave) return;
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
    if (timeUp || leave) return;
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
    if (!tiles || won || timeUp || leave) return;
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

  function runHasProgress() {
    if (posted || !tiles) return false;
    return timeUp || moves > 0 || mispicks > 0 || tiles.some((tile) => tile.removed);
  }

  function freezeClock() {
    if (startRef.current == null) return;
    const raw = Math.floor((Date.now() - startRef.current) / 1000);
    const cap = challengeLimit(mode);
    startRef.current = null;
    setElapsed(cap == null ? raw : Math.min(raw, cap));
  }

  function commitLeave(action: { next: "restart" } | { next: "fresh" } | { next: "mode"; mode: PlayMode }) {
    const nextMode = action.next === "mode" ? action.mode : mode;
    const restarting = action.next === "restart";
    const source = restarting && original ? cloneTiles(original) : newDeal().tiles;
    setMode(nextMode);
    setTiles(source);
    if (!restarting) setOriginal(cloneTiles(source));
    setSelected(null);
    setHinted([]);
    setHistory([]);
    setMoves(0);
    setMispicks(0);
    setPosted(false);
    setSignedName("");
    setLeave(null);
    setElapsed(0);
    startRef.current = nextMode === "normal" ? null : Date.now();
    if (restarting) {
      setMessage(nextMode === "normal" ? "Original deal restored. A fresh start." : "Same garden. The clock starts again.");
    } else if (nextMode === "timed") {
      setMessage("The clock is counting. Clear the garden.");
    } else if (nextMode === "normal") {
      setMessage("A fresh, solvable deal. Take your time.");
    } else {
      setMessage(`Clear it before ${MODE_LABEL[nextMode]} runs out.`);
    }
  }

  function requestLeave(action: { next: "restart" } | { next: "fresh" } | { next: "mode"; mode: PlayMode }) {
    if (runHasProgress()) {
      freezeClock();
      setLeave(action);
      setMessage("Leave this run on the board, or skip it.");
      play("ui");
      return;
    }
    commitLeave(action);
    play("ui");
  }

  function onRestart() {
    if (!original || leave) return;
    unlockAudio();
    requestLeave({ next: "restart" });
  }

  function onFresh() {
    if (leave) return;
    unlockAudio();
    requestLeave({ next: "fresh" });
  }

  function onPickMode(next: PlayMode) {
    if (next === mode || leave) return;
    unlockAudio();
    requestLeave({ next: "mode", mode: next });
  }

  function onLeavePosted(nick: string) {
    const action = leave;
    if (!action) return;
    setBoardTick((tick) => tick + 1);
    commitLeave(action);
    setMessage(`${nick} is on the board.`);
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
      <div className="garden-motes" aria-hidden="true" />
      <Pond />
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
          <div className={timeUp ? "score-pill is-out" : "score-pill"}>
            {clock != null ? (
              <>
                <strong className={limit != null && !timeUp && clock <= 60 ? "is-low" : undefined}>{formatClock(clock)}</strong>
                <span>{limit == null ? "on the clock" : "remaining"}</span>
                <span>
                  {remaining ?? "—"} tiles
                  {mispicks > 0 ? ` · ${mispicks} slips` : ""}
                </span>
              </>
            ) : (
              <>
                <strong>{remaining ?? "—"}</strong>
                <span>tiles left</span>
                <span>
                  {clears} cleared
                  {mispicks > 0 ? ` · ${mispicks} slips` : ""}
                </span>
              </>
            )}
          </div>
        </header>

        <div className="mode-row" role="group" aria-label="Play mode">
          {PLAY_MODES.map((item) => (
            <button
              key={item}
              type="button"
              className={mode === item ? "mode-btn is-on" : "mode-btn"}
              aria-pressed={mode === item}
              onClick={() => onPickMode(item)}
            >
              {MODE_LABEL[item]}
            </button>
          ))}
        </div>

        <nav className="garden-dock" aria-label="Game controls">
          <button type="button" className="dock-btn" onClick={onHint} disabled={!tiles || won || timeUp || !!leave}>
            <Sparkles aria-hidden className="dock-ico text-gold" />
            <span>Hint</span>
          </button>
          <button type="button" className="dock-btn" onClick={onUndo} disabled={history.length === 0 || timeUp || !!leave}>
            <Undo2 aria-hidden className="dock-ico" />
            <span>Undo</span>
          </button>
          <button type="button" className="dock-btn" onClick={onShuffle} disabled={!tiles || won || timeUp || !!leave}>
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

        {leave ? (
          <div className="resign-card">
            <NickGate
              tilesLeft={remaining ?? 0}
              moves={moves}
              mispicks={mispicks}
              elapsedSec={elapsed}
              mode={mode}
              heading="Save this run?"
              onPosted={onLeavePosted}
            />
            <button type="button" className="garden-btn" onClick={() => leave && commitLeave(leave)}>
              Skip
            </button>
          </div>
        ) : null}

        {(stuck || timeUp) && !posted && !leave ? (
          <NickGate
            tilesLeft={remaining ?? 0}
            moves={moves}
            mispicks={mispicks}
            elapsedSec={elapsed}
            mode={mode}
            heading={timeUp ? "Time is up" : "The path closed"}
            onPosted={onPosted}
          />
        ) : null}
        {(stuck || timeUp) && posted && !leave ? (
          <p className="nick-done">
            {signedName} is on the board.{" "}
            <a href={xIntent(`${signedName} left ${remaining} tiles in Jade Garden.`)} target="_blank" rel="noopener noreferrer">
              Tell X
            </a>
          </p>
        ) : null}

        <section ref={stageRef} className="garden-stage" aria-label="Mahjong tile board">
          <div className="garden-scroll">
            <div style={{ width: bounds.w * scale, height: bounds.h * scale }}>
              <div className={shake && !reduceMotion ? "mj-tray is-lit" : "mj-tray"} style={{ width: bounds.w, height: bounds.h, transform: `scale(${scale})` }}>
                <div className="mj-perspective">
                  <div className="mj-tilt">
                    <div
                      ref={boardRef}
                      className={shake && !reduceMotion ? "mj-plane mj-shake" : "mj-plane"}
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
                      style={{ left: g.left, top: g.top, zIndex: 7000 + g.z, "--spin": g.spin } as CSSProperties}
                    >
                      <TileFace face={g.face} />
                    </div>
                  ))}
                  {rings.map((ring) => (
                    <span
                      key={ring.id}
                      className={ring.jade ? "mj-ring is-jade" : "mj-ring"}
                      style={{ left: ring.x, top: ring.y }}
                    />
                  ))}
                  {sparks.map((s) => (
                    <span
                      key={s.id}
                      className={s.big ? `mj-spark is-big ${s.color}` : `mj-spark ${s.color}`}
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
                {posted ? (
                  <p className="nick-done">
                    {signedName} cleared the garden.{" "}
                    <a
                      href={xIntent(
                        mode === "normal"
                          ? `${signedName} cleared Jade Garden in ${moves} moves.`
                          : `${signedName} cleared Jade Garden in ${formatClock(elapsed)}.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Tell X
                    </a>
                  </p>
                ) : (
                  <NickGate
                    tilesLeft={0}
                    moves={moves}
                    mispicks={mispicks}
                    elapsedSec={elapsed}
                    mode={mode}
                    heading="Leave your name"
                    onPosted={onPosted}
                  />
                )}
                <button type="button" className="garden-btn is-primary mt-4" onClick={onFresh}>
                  New game
                </button>
              </div>
            </div>
          )}
        </section>
        {overflows && <p className="scroll-hint">Swipe sideways if a tile sits past the edge.</p>}

        <Standings refresh={boardTick} mode={mode} />

        <div className="rules-wrap">
          <button
            type="button"
            className="rules-toggle"
            aria-expanded={helpOpen}
            onClick={toggleHelp}
          >
            {helpOpen ? "Hide instructions" : "How to play"}
          </button>
          {helpOpen ? (
            <div className="rules">
              <p>
                <strong>How to play</strong>
                Match two identical free tiles. A tile is free when nothing sits above it and its left or right side is
                open. Darker tiles are blocked.
              </p>
              <p>
                <strong>Take your time</strong>
                Hint outlines a pair. Shuffle keeps the tiles you still have and guarantees a way through. Restart
                asks you to save the run or skip it, then restores the original deal. Timed counts up. The 20, 10, and
                5 minute challenges must be cleared before the sand runs out.
              </p>
              <p>
                <strong>Keys</strong>
                Tab, Enter, or Space selects a free tile. Arrows move across open tiles. H hint, U undo, S shuffle, R
                restart, N new game.
              </p>
            </div>
          ) : null}
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
