import { faceCaption } from "@/game/logic";

function Stalk({
  x,
  y,
  h,
  dim,
}: {
  x: number;
  y: number;
  h: number;
  dim?: boolean;
}) {
  const joints = [0.28, 0.55, 0.8];
  return (
    <g opacity={dim ? 0.85 : 1}>
      <rect x={x - 3.2} y={y} width={6.4} height={h} rx={2.4} className="fill-bamboo" />
      <rect x={x - 1.3} y={y + 1} width={1.5} height={h - 2} rx={1} className="fill-ivory" opacity={0.35} />
      {joints.map((p) => (
        <path
          key={p}
          d={`M${x - 4} ${y + h * p} h8`}
          className="stroke-ivory"
          strokeWidth={1.1}
          opacity={0.7}
        />
      ))}
      <path
        d={`M${x} ${y + 2} q4 -6 0 -1`}
        className="stroke-bamboo"
        strokeWidth={1.4}
        fill="none"
      />
    </g>
  );
}

function stalksFor(n: number): { x: number; y: number; h: number }[] {
  const cols = n === 2 ? 2 : n === 4 ? 2 : n >= 7 ? 3 : n === 1 ? 1 : Math.min(3, n);
  const rows = Math.ceil(n / cols);
  const out: { x: number; y: number; h: number }[] = [];
  let i = 0;
  const h = rows >= 3 ? 16 : rows === 2 ? 22 : 46;
  for (let r = 0; r < rows; r++) {
    const count = Math.min(cols, n - i);
    for (let c = 0; c < count; c++) {
      const x = 32 + (c - (count - 1) / 2) * (cols >= 3 ? 16 : 18);
      const y = 36 + (r - (rows - 1) / 2) * (h + 4) - h / 2;
      out.push({ x, y: Math.max(4, y), h });
      i++;
    }
  }
  return out;
}

function Bamboo({ n }: { n: number }) {
  if (n === 1) {
    return (
      <svg viewBox="0 0 64 70" className="h-full w-full" aria-hidden>
        <Stalk x={18} y={8} h={52} />
        <path
          d="M28 40c6-1 12-8 16-16 1 7 6 13 14 16-6 2-10 6-11 11-5-3-12-6-19-11z"
          className="fill-bamboo"
        />
        <path d="M44 26c8-8 16-8 20-6-6 3-9 8-8 13" className="fill-jade" />
        <circle cx="58" cy="22" r="1.5" className="fill-ink" />
        <path d="M60 24c3 1 5 2 6 3" className="stroke-seal" strokeWidth="1.3" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 70" className="h-full w-full" aria-hidden>
      {stalksFor(n).map((s, i) => (
        <Stalk key={i} x={s.x} y={s.y} h={s.h} dim={i % 2 === 1} />
      ))}
    </svg>
  );
}

function Pip({ cx, cy, r, hot }: { cx: number; cy: number; r: number; hot?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="fill-ivory" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        className={hot ? "stroke-seal" : "stroke-river"}
        fill="none"
        strokeWidth={1.7}
      />
      <circle cx={cx} cy={cy} r={r * 0.42} className={hot ? "fill-seal" : "fill-river"} />
      <circle cx={cx - r * 0.22} cy={cy - r * 0.28} r={r * 0.16} className="fill-ivory" opacity={0.8} />
    </g>
  );
}

const CIRCLES: Record<number, [number, number, boolean][]> = {
  1: [[32, 34, true]],
  2: [
    [32, 18, false],
    [32, 48, true],
  ],
  3: [
    [18, 16, false],
    [32, 34, true],
    [46, 52, false],
  ],
  4: [
    [20, 20, false],
    [44, 20, false],
    [20, 48, false],
    [44, 48, false],
  ],
  5: [
    [20, 18, false],
    [44, 18, false],
    [32, 34, true],
    [20, 50, false],
    [44, 50, false],
  ],
  6: [
    [22, 16, false],
    [42, 16, false],
    [22, 34, true],
    [42, 34, false],
    [22, 52, false],
    [42, 52, true],
  ],
  7: [
    [18, 14, false],
    [32, 14, false],
    [46, 14, false],
    [32, 32, true],
    [18, 52, false],
    [32, 52, false],
    [46, 52, false],
  ],
  8: [
    [22, 12, false],
    [42, 12, true],
    [22, 26, false],
    [42, 26, false],
    [22, 40, true],
    [42, 40, false],
    [22, 54, false],
    [42, 54, true],
  ],
  9: [
    [18, 16, false],
    [32, 16, true],
    [46, 16, false],
    [18, 34, false],
    [32, 34, true],
    [46, 34, false],
    [18, 52, false],
    [32, 52, true],
    [46, 52, false],
  ],
};

function Circles({ n }: { n: number }) {
  const r = n === 1 ? 16 : n >= 6 ? 6 : n >= 4 ? 7.2 : 9;
  return (
    <svg viewBox="0 0 64 70" className="h-full w-full" aria-hidden>
      {(CIRCLES[n] ?? []).map(([cx, cy, hot], i) => (
        <Pip key={i} cx={cx} cy={cy} r={n === 1 ? 16 : r} hot={hot || n === 1} />
      ))}
    </svg>
  );
}

const NUMERAL = "一二三四五六七八九";

function Characters({ n }: { n: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center leading-none text-seal">
      <span className="font-cjk text-3xl">{NUMERAL[n - 1]}</span>
      <span className="mt-1 font-cjk text-xl">萬</span>
    </div>
  );
}

function Wind({ n }: { n: number }) {
  return (
    <div className="grid h-full place-items-center">
      <span className="grid size-12 place-items-center rounded-sm border-2 border-ink font-cjk text-3xl leading-none text-ink">
        {"東南西北"[n]}
      </span>
    </div>
  );
}

function Dragon({ n }: { n: number }) {
  if (n === 2) {
    return (
      <div className="grid h-full place-items-center">
        <span className="grid h-11 w-9 place-items-center rounded-sm border-2 border-river bg-ivory">
          <span className="h-6 w-5 rounded-[2px] border border-river" />
        </span>
      </div>
    );
  }
  const ch = n === 0 ? "中" : "發";
  const color = n === 0 ? "text-seal border-seal" : "text-bamboo border-bamboo";
  return (
    <div className="grid h-full place-items-center">
      <span
        className={`grid size-12 place-items-center rounded-sm border-2 font-cjk text-3xl leading-none ${color}`}
      >
        {ch}
      </span>
    </div>
  );
}

function Plum() {
  return (
    <svg viewBox="0 0 64 70" className="h-full w-full" aria-hidden>
      {[0, 72, 144, 216, 288].map((deg) => {
        const a = (deg * Math.PI) / 180;
        const cx = 32 + Math.cos(a) * 10;
        const cy = 30 + Math.sin(a) * 10;
        return <ellipse key={deg} cx={cx} cy={cy} rx={7} ry={5} transform={`rotate(${deg} ${cx} ${cy})`} className="fill-seal" />;
      })}
      <circle cx="32" cy="30" r="4" className="fill-gold" />
      <path d="M32 42c2 8 1 16-2 22" className="stroke-bamboo" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

function Orchid() {
  return (
    <svg viewBox="0 0 64 70" className="h-full w-full" aria-hidden>
      <path d="M34 58c8-16 6-28-2-36" className="stroke-bamboo" strokeWidth="1.5" fill="none" />
      <path d="M32 40c-10-2-16 4-16 4 6 2 12 0 16-4z" className="fill-jade" />
      <path d="M32 36c8-8 16-6 16-6-2 8-8 10-16 6z" className="fill-ivory" />
      <path d="M30 34c-2-10 2-16 2-16s6 6 4 14c-2 1-4 2-6 2z" className="fill-seal" opacity="0.9" />
      <circle cx="32" cy="32" r="2" className="fill-gold" />
    </svg>
  );
}

function Mum() {
  return (
    <svg viewBox="0 0 64 70" className="h-full w-full" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x2 = 32 + Math.cos(a) * 16;
        const y2 = 32 + Math.sin(a) * 16;
        return (
          <line
            key={i}
            x1={32}
            y1={32}
            x2={x2}
            y2={y2}
            className="stroke-gold"
            strokeWidth={i % 2 ? 3 : 1.6}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="32" cy="32" r="5" className="fill-seal" />
    </svg>
  );
}

function BambooFlower() {
  return (
    <svg viewBox="0 0 64 70" className="h-full w-full" aria-hidden>
      <Stalk x={24} y={10} h={50} />
      <Stalk x={40} y={16} h={42} dim />
      <circle cx="30" cy="22" r="3.2" className="fill-seal" />
      <circle cx="44" cy="30" r="2.6" className="fill-gold" />
    </svg>
  );
}

function Season({ n }: { n: number }) {
  const ch = "春夏秋冬"[n];
  return (
    <div className="relative grid h-full place-items-center">
      <svg viewBox="0 0 64 70" className="absolute inset-0 h-full w-full" aria-hidden>
        {n === 0 && <path d="M14 50c10-18 18-22 36-28" className="stroke-bamboo" strokeWidth="1.6" fill="none" />}
        {n === 0 && <circle cx="44" cy="24" r="5" className="fill-seal" />}
        {n === 1 && <ellipse cx="32" cy="28" rx="14" ry="8" className="fill-jade" opacity="0.85" />}
        {n === 1 && <circle cx="32" cy="26" r="5" className="fill-seal" />}
        {n === 2 && <path d="M32 16l8 14h-16z M24 30l8 14h-16z M40 30l8 14h-16z" className="fill-seal" />}
        {n === 3 && <path d="M32 14l4 10h8l-6 6 2 10-8-6-8 6 2-10-6-6h8z" className="fill-bamboo" />}
      </svg>
      <span className="font-cjk relative text-2xl text-ink">{ch}</span>
    </div>
  );
}

function Crane() {
  return (
    <svg viewBox="0 0 64 70" className="h-full w-full" aria-hidden>
      <path d="M10 40c12-4 20-16 24-26 2 10 10 18 22 20-8 2-14 8-16 16-6-4-18-6-30-10z" className="fill-ivory" strokeWidth="1.2" />
      <path d="M10 40c12-4 20-16 24-26 2 10 10 18 22 20-8 2-14 8-16 16-6-4-18-6-30-10z" className="stroke-ink" fill="none" strokeWidth="1.2" />
      <path d="M18 42c6 2 10 8 8 16" className="stroke-ink" strokeWidth="1.4" fill="none" />
      <path d="M46 18c6-4 10-4 12-2" className="stroke-seal" strokeWidth="1.6" fill="none" />
      <circle cx="50" cy="16" r="1.4" className="fill-ink" />
      <path d="M30 22c2 2 2 4 0 5" className="fill-seal" />
    </svg>
  );
}

function Koi() {
  return (
    <svg viewBox="0 0 64 70" className="h-full w-full" aria-hidden>
      <path d="M8 36c10-14 24-18 38-12 2 8-4 14-12 16 8 2 14 8 16 16-14-6-24-4-32 2-2-8-6-14-10-22z" className="fill-seal" />
      <path d="M46 26c8-8 14-8 16-4-8 2-12 8-10 14" className="fill-gold" />
      <circle cx="40" cy="32" r="1.5" className="fill-ink" />
      <path d="M14 36c6 1 10 1 14 0" className="stroke-ivory" strokeWidth="1" fill="none" opacity="0.7" />
    </svg>
  );
}

function Lotus() {
  return (
    <svg viewBox="0 0 64 70" className="h-full w-full" aria-hidden>
      <ellipse cx="32" cy="50" rx="16" ry="6" className="fill-jade" />
      <path d="M32 46c0-14 8-24 8-24s2 12-2 22" className="fill-seal" />
      <path d="M32 46c0-16-8-26-8-26s-2 12 2 24" className="fill-seal" opacity="0.85" />
      <path d="M32 44c0-12 0-22 0-22s8 8 6 20" className="fill-gold" opacity="0.9" />
      <path d="M32 44c0-12 0-22 0-22s-8 8-6 20" className="fill-ivory" />
    </svg>
  );
}

const FLOWERS = [Plum, Orchid, Mum, BambooFlower];

export function TileFace({ face }: { face: number }) {
  let art;
  if (face < 9) art = <Bamboo n={face + 1} />;
  else if (face < 18) art = <Circles n={face - 8} />;
  else if (face < 27) art = <Characters n={face - 17} />;
  else if (face < 31) art = <Wind n={face - 27} />;
  else if (face < 34) art = <Dragon n={face - 31} />;
  else if (face < 38) {
    const Flower = FLOWERS[face - 34];
    art = <Flower />;
  } else if (face < 42) art = <Season n={face - 38} />;
  else if (face === 42) art = <Crane />;
  else if (face === 43) art = <Koi />;
  else art = <Lotus />;

  return (
    <span className="flex h-full w-full flex-col">
      <span className="min-h-0 flex-1">{art}</span>
      <span className="mj-caption">{faceCaption(face)}</span>
    </span>
  );
}
