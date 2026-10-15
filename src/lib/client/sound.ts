"use client";

/**
 * All sound is synthesized with Web Audio, so there are no files to load and
 * nothing to license. Browsers need one click before audio can start; the TV
 * gets that click from its "Start the show" overlay.
 */

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
let musicLevel = 0.7;
let sfxLevel = 0.85;

const MUSIC_MAX = 0.28;

export function unlockAudio() {
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain();
    out.gain.value = muted ? 0 : 1;
    out.connect(ctx.destination);
    // `master` is the SFX bus; music has its own so the host can balance them.
    master = ctx.createGain();
    master.gain.value = sfxLevel;
    master.connect(out);
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_MAX * musicLevel;
    musicBus.connect(out);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  void ctx.resume();
}

export function audioReady() {
  return ctx?.state === "running";
}

export function setMuted(m: boolean) {
  muted = m;
  if (ctx && out) out.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
}

/** Volumes from the host's show settings, 0–100. */
export function setVolumes(music: number, sfx: number) {
  musicLevel = Math.max(0, Math.min(1, music / 100));
  sfxLevel = Math.max(0, Math.min(1, sfx / 100));
  if (ctx && master && musicBus) {
    master.gain.setTargetAtTime(sfxLevel, ctx.currentTime, 0.05);
    musicBus.gain.setTargetAtTime(MUSIC_MAX * musicLevel, ctx.currentTime, 0.05);
  }
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function tone(
  freq: number,
  at: number,
  dur: number,
  { type = "sine", vol = 0.3, to, dest }: { type?: OscillatorType; vol?: number; to?: number; dest?: AudioNode } = {},
) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(dest ?? master);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function noise(
  at: number,
  dur: number,
  { vol = 0.2, freq = 2000, type = "bandpass", to, dest }: { vol?: number; freq?: number; type?: BiquadFilterType; to?: number; dest?: AudioNode } = {},
) {
  if (!ctx || !master || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, at);
  if (to) f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(dest ?? master);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.05);
}

const now = () => ctx?.currentTime ?? 0;

export const sfx = {
  pop() {
    const t = now();
    tone(500 + Math.random() * 200, t, 0.12, { vol: 0.35, to: 1100 });
  },
  sizzle() {
    const t = now();
    noise(t, 0.55, { vol: 0.16, freq: 5000, type: "highpass" });
    tone(880, t, 0.1, { type: "triangle", vol: 0.15, to: 1320 });
  },
  tick() {
    tone(1500, now(), 0.04, { type: "square", vol: 0.07 });
  },
  ding() {
    const t = now();
    tone(midi(88), t, 1.4, { vol: 0.28 });
    tone(midi(95), t, 1.0, { vol: 0.1 });
  },
  buzzer() {
    const t = now();
    tone(150, t, 0.7, { type: "sawtooth", vol: 0.18 });
    tone(156, t, 0.7, { type: "square", vol: 0.1 });
  },
  whoosh() {
    noise(now(), 0.45, { vol: 0.18, freq: 400, to: 4000 });
  },
  drumroll(seconds = 2) {
    const t = now();
    const hits = Math.floor(seconds * 22);
    for (let i = 0; i < hits; i++) noise(t + i / 22, 0.05, { vol: 0.05 + (0.16 * i) / hits, freq: 1500 });
    noise(t + seconds, 1.2, { vol: 0.25, freq: 6000, type: "highpass" });
    tone(110, t + seconds, 0.4, { vol: 0.4, to: 50 });
  },
  rowReveal(rank: number) {
    const t = now();
    const base = [79, 76, 74, 72, 67][Math.min(4, rank - 1)] ?? 67;
    tone(midi(base), t, 0.25, { type: "square", vol: 0.1 });
    tone(midi(base + 12), t + 0.07, 0.3, { type: "triangle", vol: 0.15 });
  },
  fanfare() {
    const t = now();
    [60, 64, 67, 72].forEach((n, i) => tone(midi(n), t + i * 0.12, 0.25, { type: "square", vol: 0.1 }));
    [72, 76, 79, 84].forEach((n) => tone(midi(n), t + 0.5, 1.6, { type: "triangle", vol: 0.12 }));
  },
  /** The kitchen service bell: "Order up!" */
  bell(times = 2) {
    const t = now();
    for (let i = 0; i < times; i++) {
      const at = t + i * 0.22;
      tone(2093, at, 1.6, { vol: 0.22 });
      tone(2093 * 2.76, at, 0.7, { vol: 0.06 });
      tone(2093 * 5.4, at, 0.3, { vol: 0.03 });
      noise(at, 0.02, { vol: 0.12, freq: 6000, type: "highpass" });
    }
  },
  applause(seconds = 2.6) {
    const t = now();
    const claps = Math.floor(seconds * 38);
    for (let i = 0; i < claps; i++) {
      const at = t + Math.random() * seconds;
      const fade = 1 - (at - t) / seconds;
      noise(at, 0.035, { vol: 0.05 + 0.1 * fade * Math.random(), freq: 1200 + Math.random() * 1800 });
    }
  },
  airhorn() {
    const t = now();
    [0, 0.32, 0.64].forEach((d, i) => {
      const len = i === 2 ? 0.9 : 0.24;
      [466, 470, 587, 698].forEach((f) => tone(f, t + d, len, { type: "sawtooth", vol: 0.07 }));
    });
  },
  sadTrombone() {
    const t = now();
    [[311, 293], [293, 277], [277, 262], [262, 233]].forEach(([a, b], i) => {
      const len = i === 3 ? 1.3 : 0.42;
      tone(a, t + i * 0.45, len, { type: "sawtooth", vol: 0.09, to: b });
      tone(a / 2, t + i * 0.45, len, { type: "triangle", vol: 0.12, to: b / 2 });
    });
  },
  /** A soft "plink" for phones and small UI moments. */
  plink() {
    const t = now();
    tone(midi(84), t, 0.18, { type: "triangle", vol: 0.16 });
    tone(midi(91), t + 0.05, 0.22, { type: "sine", vol: 0.1 });
  },
};

export function playCue(id: string) {
  switch (id) {
    case "bell": return sfx.bell();
    case "drumroll": return sfx.drumroll(2.4);
    case "applause": return sfx.applause();
    case "airhorn": return sfx.airhorn();
    case "ding": return sfx.ding();
    case "sadTrombone": return sfx.sadTrombone();
    case "sizzle": return sfx.sizzle();
    case "fanfare": return sfx.fanfare();
  }
}

/* ---------- Background music: a tiny chiptune step sequencer ---------- */

type Track = { bpm: number; lead: (number | null)[]; bass: (number | null)[]; hat: number[]; kick: number[] };
const _ = null;

const LOBBY: Track = {
  bpm: 112,
  // C – Am – F – G, one bar each, 16th-note steps
  lead: [
    76, _, 79, _, 81, _, 79, _, 76, _, _, _, 72, _, 74, _,
    76, _, _, _, 69, _, 72, _, 76, _, 74, _, 72, _, _, _,
    77, _, 81, _, 84, _, 81, _, 77, _, _, _, 79, _, 81, _,
    79, _, _, _, 74, _, 79, _, 83, _, 81, _, 79, _, _, _,
  ],
  bass: [
    48, _, _, _, 60, _, _, _, 48, _, _, _, 60, _, 55, _,
    45, _, _, _, 57, _, _, _, 45, _, _, _, 57, _, 52, _,
    41, _, _, _, 53, _, _, _, 41, _, _, _, 53, _, 48, _,
    43, _, _, _, 55, _, _, _, 43, _, _, _, 55, _, 50, _,
  ],
  hat: [2, 6, 10, 14],
  kick: [0, 8],
};

const COOKING: Track = {
  bpm: 128,
  // Am – Am – F – G, driving and a little tense
  lead: [
    81, _, _, 81, _, _, 79, _, 76, _, _, _, _, _, _, _,
    81, _, _, 81, _, _, 83, _, 84, _, _, _, 83, _, _, _,
    77, _, _, 77, _, _, 76, _, 72, _, _, _, _, _, _, _,
    79, _, _, 79, _, _, 81, _, 83, _, _, _, 86, _, _, _,
  ],
  bass: [
    45, _, 45, 57, 45, _, 45, 57, 45, _, 45, 57, 45, _, 52, _,
    45, _, 45, 57, 45, _, 45, 57, 45, _, 45, 57, 45, _, 52, _,
    41, _, 41, 53, 41, _, 41, 53, 41, _, 41, 53, 41, _, 48, _,
    43, _, 43, 55, 43, _, 43, 55, 43, _, 43, 55, 43, _, 50, _,
  ],
  hat: [0, 2, 4, 6, 8, 10, 12, 14],
  kick: [0, 4, 8, 12],
};

const TRACKS = { lobby: LOBBY, cooking: COOKING };
export type MusicName = keyof typeof TRACKS;

let musicTimer: ReturnType<typeof setInterval> | null = null;
let current: MusicName | null = null;

export function playMusic(name: MusicName | null) {
  if (name === current) return;
  stopMusic();
  current = name;
  if (!name || !ctx) return;
  const track = TRACKS[name];
  const stepDur = 60 / track.bpm / 4;
  let step = 0;
  let nextAt = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!ctx || !musicBus) return;
    while (nextAt < ctx.currentTime + 0.15) {
      const s = step % track.lead.length;
      const inBar = s % 16;
      const lead = track.lead[s];
      const bass = track.bass[s];
      if (lead !== null) tone(midi(lead), nextAt, stepDur * 1.8, { type: "square", vol: 0.12, dest: musicBus });
      if (bass !== null) tone(midi(bass - 12), nextAt, stepDur * 1.6, { type: "triangle", vol: 0.5, dest: musicBus });
      if (track.hat.includes(inBar)) noise(nextAt, 0.04, { vol: 0.12, freq: 8000, type: "highpass", dest: musicBus });
      if (track.kick.includes(inBar)) tone(150, nextAt, 0.18, { vol: 0.7, to: 45, dest: musicBus });
      nextAt += stepDur;
      step++;
    }
  }, 25);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  current = null;
}
