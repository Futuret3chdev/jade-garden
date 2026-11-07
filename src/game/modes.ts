export const PLAY_MODES = ["normal", "timed", "m20", "m10", "m5"] as const;

export type PlayMode = (typeof PLAY_MODES)[number];

export const MODE_LABEL: Record<PlayMode, string> = {
  normal: "Normal",
  timed: "Timed",
  m20: "20 min",
  m10: "10 min",
  m5: "5 min",
};

const LIMITS: Partial<Record<PlayMode, number>> = {
  m20: 20 * 60,
  m10: 10 * 60,
  m5: 5 * 60,
};

export function isPlayMode(value: unknown): value is PlayMode {
  return typeof value === "string" && (PLAY_MODES as readonly string[]).includes(value);
}

export function challengeLimit(mode: PlayMode) {
  return LIMITS[mode] ?? null;
}

export function formatClock(total: number) {
  const safe = Math.max(0, Math.floor(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
