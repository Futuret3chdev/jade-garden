import type { CSSProperties } from "react";

const FISH = [
  { id: "a", kind: "orange", lane: "6%", dur: "27s", delay: "-6s", size: "124px", left: "8%" },
  { id: "b", kind: "white", lane: "22%", dur: "36s", delay: "-20s", size: "78px", left: "34%" },
  { id: "c", kind: "calico", lane: "40%", dur: "23s", delay: "-11s", size: "108px", left: "62%" },
  { id: "d", kind: "orange", lane: "58%", dur: "32s", delay: "-24s", size: "68px", left: "18%" },
  { id: "e", kind: "white", lane: "14%", dur: "41s", delay: "-31s", size: "56px", left: "78%" },
  { id: "f", kind: "calico", lane: "74%", dur: "26s", delay: "-8s", size: "96px", left: "46%" },
  { id: "g", kind: "orange", lane: "86%", dur: "30s", delay: "-16s", size: "84px", left: "86%" },
] as const;

function Koi({ kind }: { kind: (typeof FISH)[number]["kind"] }) {
  return (
    <svg viewBox="0 0 128 52" className="koi-svg" aria-hidden="true">
      <ellipse className="koi-shadow" cx="64" cy="46" rx="30" ry="3.5" />
      <g className="koi-tail">
        <path d="M22 26 C8 12 2 8 0 4 C10 16 10 36 0 48 C4 42 10 36 22 26Z" />
      </g>
      <path className="koi-body" d="M22 26 C38 8 78 6 100 16 C112 21 118 25 124 26 C118 27 112 31 100 36 C78 46 38 44 22 26Z" />
      <path className="koi-fin" d="M52 16 C60 4 74 5 78 16" />
      <path className="koi-belly" d="M40 30 C62 38 88 36 104 30 C90 40 58 40 40 30Z" />
      {kind === "calico" ? (
        <>
          <path className="koi-spot" d="M58 18c8 1 12 8 6 12-8 1-14-6-6-12Z" />
          <path className="koi-spot is-red" d="M78 24c7 2 8 8 2 10-7-1-10-6-2-10Z" />
        </>
      ) : null}
      {kind === "orange" ? <path className="koi-spot" d="M70 20c10 2 12 10 2 12-8-1-12-8-2-12Z" /> : null}
      {kind === "white" ? <path className="koi-spot is-red" d="M66 20c8 1 11 8 4 11-8 0-12-6-4-11Z" /> : null}
      <circle className="koi-eye" cx="108" cy="23" r="1.7" />
      <circle className="koi-eye-light" cx="108.6" cy="22.4" r="0.55" />
    </svg>
  );
}

export function Pond() {
  return (
    <div className="pond" aria-hidden="true">
      <div className="pond-glint" />
      {FISH.map((fish) => (
        <span
          key={fish.id}
          className={`koi koi-${fish.kind}`}
          style={
            {
              top: fish.lane,
              width: fish.size,
              "--rest": fish.left,
              animationDuration: fish.dur,
              animationDelay: fish.delay,
            } as CSSProperties
          }
        >
          <Koi kind={fish.kind} />
        </span>
      ))}
    </div>
  );
}
