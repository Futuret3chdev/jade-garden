let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (master && ctx) master.gain.setTargetAtTime(on ? 0.85 : 0, ctx.currentTime, 0.02);
}

export function unlockAudio() {
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AC = window.AudioContext || w.webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.gain.value = enabled ? 0.85 : 0;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function resumeAudio() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, at: number, dur: number, type: OscillatorType, peak: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  g.connect(master);
  o.start(at);
  o.stop(at + dur + 0.02);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

function click(at: number, freq: number, peak: number) {
  if (!ctx || !master || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq, at);
  filter.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(at);
  src.stop(at + 0.08);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    g.disconnect();
  };
}

export type SoundName = "select" | "match" | "miss" | "block" | "win" | "ui";

export function play(kind: SoundName) {
  if (!ctx || !master || !enabled || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const jitter = 1 + (Math.random() * 2 - 1) * 0.06;
  if (kind === "select") {
    click(now, 480 * jitter, 0.22);
    tone(210 * jitter, now, 0.06, "sine", 0.04);
  } else if (kind === "ui") {
    click(now, 720 * jitter, 0.12);
  } else if (kind === "miss" || kind === "block") {
    tone(140 * jitter, now, 0.12, "triangle", 0.05);
  } else if (kind === "match") {
    click(now, 340 * jitter, 0.16);
    tone(523 * jitter, now, 0.18, "sine", 0.06);
    tone(784 * jitter, now + 0.06, 0.22, "sine", 0.05);
  } else if (kind === "win") {
    const notes = [523, 587, 659, 784, 880, 1046];
    notes.forEach((f, i) => tone(f, now + i * 0.11, 0.28, "sine", 0.055));
  }
}
