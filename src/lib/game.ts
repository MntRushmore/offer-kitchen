import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { assembleGuided, BOT_NAMES, botOffer, SEATS, seeded } from "./bots";
import { AVATAR_COLORS, AVATARS, DEFAULT_CONFIG, REACTIONS, REVEAL_GAP_MS, SOUND_CUES, withDefaults } from "./constants";
import { aiConfigured, gradeSubmission } from "./grader/grade";
import { DEFAULT_SYSTEM_PROMPT } from "./grader/prompt";
import { store } from "./store";
import {
  CRITERIA_IDS,
  type BoardEntry,
  type GameConfig,
  type GameState,
  type GradeRecord,
  type GuidedFields,
  type MeRound,
  type Phase,
  type Player,
  type PublicState,
  type Scaffold,
  type ShowSettings,
  type SoundCue,
  type Submission,
  type TopicCard,
} from "./types";

const K = {
  config: "ok:config",
  game: "ok:game",
  players: "ok:players",
  subs: "ok:subs",
  grades: "ok:grades",
  reactions: "ok:react",
};
const subKey = (round: number, playerId: string) => `${round}:${playerId}`;

export class GameError extends Error {}

interface Snapshot {
  config: GameConfig;
  game: GameState;
  players: Record<string, Player>;
  subs: Record<string, Submission>;
  grades: Record<string, GradeRecord>;
  reactions: Record<string, number>;
}

/* ---------- Reading ---------- */

// Every phone polls once a second; a short per-instance cache keeps Redis calm.
let cache: { at: number; snap: Snapshot } | null = null;
const CACHE_MS = 750;

function invalidate() {
  cache = null;
}

function newGame(muted = false): GameState {
  const now = Date.now();
  return {
    id: crypto.randomUUID().slice(0, 8),
    phase: "lobby",
    roundIndex: 0,
    roundEndsAt: null,
    pausedLeft: null,
    spotlightPlayerId: null,
    muted,
    phaseStartedAt: now,
    autopilot: false,
    announcement: null,
    cue: null,
    updatedAt: now,
  };
}

async function readSnapshot(fresh = false): Promise<Snapshot> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.snap;
  const { gets, hashes } = await store.readMany([K.config, K.game], [K.players, K.subs, K.grades, K.reactions]);
  const config = withDefaults(gets[0] as Partial<GameConfig> | null);
  let game = gets[1] as GameState | null;
  if (!game) {
    game = newGame();
    await store.set(K.game, game);
  }
  // Games saved by an older build lack the newer fields.
  game = { ...newGame(game.muted), ...game };
  const snap: Snapshot = {
    config,
    game,
    players: hashes[0] as Record<string, Player>,
    subs: hashes[1] as Record<string, Submission>,
    grades: hashes[2] as Record<string, GradeRecord>,
    reactions: Object.fromEntries(Object.entries(hashes[3] ?? {}).map(([k, v]) => [k, Number(v) || 0])),
  };
  cache = { at: Date.now(), snap };
  return snap;
}

function topicFor(config: GameConfig, round: number): TopicCard {
  const id = config.rounds[round]?.topicId;
  return config.topics.find((t) => t.id === id) ?? config.topics[0] ?? DEFAULT_CONFIG.topics[0];
}

const AFTER_LOCK: Phase[] = ["grading", "leaderboard", "spotlight", "final"];
const REVEALED: Phase[] = ["leaderboard", "spotlight", "final"];

/** When a phone may see its own grade (host setting: at lock, or at the TV reveal). */
function gradesVisible(snap: Snapshot, round: number) {
  const { game } = snap;
  if (round < game.roundIndex) return true;
  if (round !== game.roundIndex) return false;
  return (snap.config.show.phoneGrades === "reveal" ? REVEALED : AFTER_LOCK).includes(game.phase);
}
/** Scores and ranks go public once the TV reveals the leaderboard. */
function scoresRevealed(game: GameState, round: number) {
  return round < game.roundIndex || (round === game.roundIndex && REVEALED.includes(game.phase));
}

function currentGrade(sub: Submission | undefined, rec: GradeRecord | undefined) {
  if (!sub || !rec || rec.forVersion !== sub.version) return null;
  return rec;
}

/** Offer quality follows the scaffold: blank → raw, checklist → seasoned, guided → grand slam. */
const SCAFFOLD_LEVEL: Record<Scaffold, number> = { blank: 0, checklist: 1, guided: 2 };

function seatScript(snap: Snapshot, player: Player) {
  const { game, config } = snap;
  const round = config.rounds[game.roundIndex];
  if (!player.seat || !round || game.phase !== "writing") return null;
  const rand = seeded(`${game.id}:${game.roundIndex}:${player.seat}`);
  return botOffer(topicFor(config, game.roundIndex), SCAFFOLD_LEVEL[round.scaffold], rand);
}

export async function buildState(opts: { playerId?: string | null; admin?: boolean }): Promise<PublicState> {
  const snap = await readSnapshot();
  const { config, game } = snap;
  const admin = Boolean(opts.admin);

  const allPlayers = Object.values(snap.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const visible = admin ? allPlayers : allPlayers.filter((p) => !p.hidden);
  const visibleIds = new Set(visible.map((p) => p.id));

  const board: BoardEntry[][] = config.rounds.map((_, r) => {
    const revealed = admin || scoresRevealed(game, r);
    const entries: BoardEntry[] = [];
    for (const p of visible) {
      const sub = snap.subs[subKey(r, p.id)];
      if (!sub) continue;
      const rec = currentGrade(sub, snap.grades[subKey(r, p.id)]);
      const graded = rec?.status === "done" && rec.grade;
      entries.push({
        playerId: p.id,
        submittedAt: sub.submittedAt,
        status: graded ? "graded" : rec?.status === "error" ? "error" : "submitted",
        overall: revealed && graded ? rec.grade!.overall : undefined,
        letter: revealed && graded ? rec.grade!.letter : undefined,
      });
    }
    return entries.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1) || a.submittedAt - b.submittedAt);
  });

  let spotlight: PublicState["spotlight"] = null;
  const sp = game.spotlightPlayerId;
  if (sp && (admin || game.phase === "spotlight") && visibleIds.has(sp)) {
    const sub = snap.subs[subKey(game.roundIndex, sp)];
    if (sub) {
      const rec = currentGrade(sub, snap.grades[subKey(game.roundIndex, sp)]);
      spotlight = { player: snap.players[sp], submission: sub, grade: rec?.grade ?? null };
    }
  }

  let me: PublicState["me"] = null;
  const mine = opts.playerId ? snap.players[opts.playerId] : undefined;
  if (mine) {
    me = {
      player: mine,
      script: seatScript(snap, mine),
      rounds: config.rounds.map((_, r): MeRound => {
        const sub = snap.subs[subKey(r, mine.id)] ?? null;
        const rec = currentGrade(sub ?? undefined, snap.grades[subKey(r, mine.id)]);
        const show = gradesVisible(snap, r);
        const graded = board[r].filter((e) => e.overall !== undefined);
        const idx = graded.findIndex((e) => e.playerId === mine.id);
        return {
          submission: sub,
          gradeStatus: !sub ? "none" : !rec ? "pending" : rec.status,
          grade: show && rec?.status === "done" ? (rec.grade ?? null) : null,
          rank: idx >= 0 ? idx + 1 : null,
          of: idx >= 0 ? graded.length : null,
        };
      }),
    };
  }

  // Host-only knobs stay on the server.
  const show = { ...config.show } as Partial<ShowSettings>;
  for (const k of ["demo", "botsUseAI", "autoLock", "autoReveal", "lateJoin"] as const) delete show[k];

  return {
    serverNow: Date.now(),
    game,
    rounds: config.rounds.map((r, i) => ({ ...r, topic: topicFor(config, i) })),
    players: visible,
    board,
    scoresRevealed: config.rounds.map((_, r) => scoresRevealed(game, r)),
    spotlight,
    me,
    joinUrl: config.joinUrl,
    show: show as PublicState["show"],
    reactions: snap.reactions,
    admin: admin
      ? {
          config,
          subs: Object.values(snap.subs),
          grades: snap.grades,
          aiConfigured: aiConfigured(),
          storeKind: store.kind,
          defaultPrompt: DEFAULT_SYSTEM_PROMPT,
        }
      : undefined,
  };
}

/* ---------- Players ---------- */

export async function joinGame(rawName: string, avatar: string, seat?: string | null): Promise<Player> {
  const snap = await readSnapshot(true);
  const seatInfo = seat ? SEATS[seat] : undefined;
  if (seatInfo) {
    // A demo phone re-joining after a reset gets its old seat back, not a duplicate.
    const existing = Object.values(snap.players).find((p) => p.seat === seat);
    if (existing) return existing;
  } else if (snap.game.phase !== "lobby" && !snap.config.show.lateJoin && !snap.game.autopilot) {
    throw new GameError("The kitchen doors are closed for this show. Ask the host to let you in!");
  }
  let name = (seatInfo?.name ?? rawName).replace(/\s+/g, " ").trim().slice(0, 18);
  if (!name) throw new GameError("Pick a chef name first!");
  const taken = new Set(Object.values(snap.players).map((p) => p.name.toLowerCase()));
  if (taken.has(name.toLowerCase())) {
    let n = 2;
    while (taken.has(`${name} ${n}`.toLowerCase())) n++;
    name = `${name} ${n}`;
  }
  const count = Object.keys(snap.players).length;
  const player: Player = {
    id: crypto.randomUUID(),
    name,
    avatar: seatInfo?.avatar ?? (AVATARS.includes(avatar) ? avatar : AVATARS[count % AVATARS.length]),
    color: seatInfo?.color ?? AVATAR_COLORS[count % AVATAR_COLORS.length],
    joinedAt: Date.now(),
    hidden: false,
    ...(seatInfo ? { bot: true, seat: seat! } : {}),
  };
  await store.hset(K.players, player.id, player);
  invalidate();
  return player;
}

export async function react(playerId: string, emoji: string) {
  const snap = await readSnapshot();
  if (!snap.config.show.reactions) throw new GameError("Reactions are off right now.");
  if (!snap.players[playerId]) throw new GameError("You're not in this game.");
  if (!REACTIONS.includes(emoji)) throw new GameError("Unknown reaction.");
  await store.hincrby(K.reactions, emoji, 1);
  invalidate();
}

/* ---------- Submitting & grading ---------- */

export async function submitOffer(input: {
  playerId: string;
  round: number;
  text?: string;
  fields?: GuidedFields | null;
}): Promise<Submission> {
  const snap = await readSnapshot(true);
  const { game, config } = snap;
  if (!snap.players[input.playerId]) throw new GameError("You're not in this game — rejoin from the QR code.");
  if (game.phase !== "writing" || input.round !== game.roundIndex) {
    throw new GameError("The kitchen is closed for this round.");
  }

  let text: string;
  let fields: GuidedFields | null = null;
  if (config.rounds[input.round]?.scaffold === "guided" && input.fields) {
    fields = {};
    for (const id of CRITERIA_IDS) {
      const v = input.fields[id]?.trim().slice(0, 1200);
      if (v) fields[id] = v;
    }
    text = assembleGuided(fields);
  } else {
    text = (input.text ?? "").trim().slice(0, 4000);
  }
  if (text.length < 3) throw new GameError("Write something first!");

  const key = subKey(input.round, input.playerId);
  const prev = snap.subs[key];
  const sub: Submission = {
    round: input.round,
    playerId: input.playerId,
    text,
    fields,
    version: (prev?.version ?? 0) + 1,
    submittedAt: Date.now(),
  };
  await store.hset(K.subs, key, sub);
  invalidate();
  scheduleGrade(input.round, input.playerId, sub.version);
  return sub;
}

/** Grade in the background as soon as an offer is plated, so the reveal is instant. */
function scheduleGrade(round: number, playerId: string, version: number) {
  after(() => runGrade(round, playerId, version));
}

function gradingModeFor(snap: Snapshot, player: Player | undefined) {
  const { config } = snap;
  if (player?.seat) return config.show.demo.seatsUseAI ? config.gradingMode : "mock";
  if (player?.bot && !config.show.botsUseAI) return "mock";
  return config.gradingMode;
}

async function runGrade(round: number, playerId: string, version: number) {
  const key = subKey(round, playerId);
  const snap = await readSnapshot(true);
  const sub = snap.subs[key];
  if (!sub || sub.version !== version) return;
  const player = snap.players[playerId];
  const mode = gradingModeFor(snap, player);

  const startedAt = Date.now();
  await store.hset(K.grades, key, { forVersion: version, status: "pending", startedAt } satisfies GradeRecord);
  invalidate();

  let rec: GradeRecord;
  // One extra attempt on top of the SDK's own retries: a lost grade mid-show is worse than a slow one.
  for (let attempt = 1; ; attempt++) {
    try {
      const grade = await gradeSubmission({
        topic: topicFor(snap.config, round),
        sub,
        model: snap.config.model,
        mode,
        systemPrompt: snap.config.graderPrompt,
      });
      rec = { forVersion: version, status: "done", startedAt, grade };
      break;
    } catch (err) {
      console.error(`grading failed (attempt ${attempt})`, key, err);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      // A demo/bot plate must never stall the show: fall back to the simulated grader.
      if (player?.bot) {
        const grade = await gradeSubmission({ topic: topicFor(snap.config, round), sub, model: "", mode: "mock", systemPrompt: null });
        rec = { forVersion: version, status: "done", startedAt, grade };
        break;
      }
      rec = { forVersion: version, status: "error", startedAt, error: err instanceof Error ? err.message : String(err) };
      break;
    }
  }

  // A newer edit may have landed while we were grading; that edit has its own grade coming.
  const latest = await store.hget<Submission>(K.subs, key);
  if (!latest || latest.version !== version) return;
  await store.hset(K.grades, key, rec);
  invalidate();
}

/* ---------- Host controls ---------- */

async function saveGame(game: GameState, prev: GameState) {
  const now = Date.now();
  if (game.phase !== prev.phase || game.roundIndex !== prev.roundIndex) game.phaseStartedAt = now;
  game.updatedAt = now;
  await store.set(K.game, game);
  invalidate();
}

function lockAndGrade(snap: Snapshot, round: number) {
  for (const sub of Object.values(snap.subs)) {
    if (sub.round !== round) continue;
    const rec = currentGrade(sub, snap.grades[subKey(round, sub.playerId)]);
    const stale = rec?.status === "pending" && Date.now() - rec.startedAt > 150_000;
    if (!rec || rec.status === "error" || stale) scheduleGrade(round, sub.playerId, sub.version);
  }
}

const TopicSchema = z.object({
  id: z.string().min(1).max(60),
  title: z.string().min(1).max(80),
  emoji: z.string().max(16),
  image: z.string().max(2000).nullable().optional(),
  buyer: z.string().max(1500),
  pain: z.string().max(1500),
  alternatives: z.string().max(1500),
  scope: z.string().max(1500),
  economics: z.string().max(1500),
  absurdPrice: z.number().positive(),
});
const TierSchema = z.object({ name: z.string().min(1).max(24), emoji: z.string().max(16) });
const ShowSchema = z.object({
  title: z.string().min(1).max(40),
  tagline: z.string().max(140),
  lobbyNote: z.string().max(120),
  hostName: z.string().max(40),
  leaderboardSize: z.number().int().min(3).max(8),
  revealPace: z.enum(["fast", "normal", "slow"]),
  phoneGrades: z.enum(["lock", "reveal"]),
  reactions: z.boolean(),
  confetti: z.boolean(),
  musicVolume: z.number().min(0).max(100),
  sfxVolume: z.number().min(0).max(100),
  autoLock: z.boolean(),
  autoReveal: z.boolean(),
  lateJoin: z.boolean(),
  botsUseAI: z.boolean(),
  tiers: z.object({ A: TierSchema, B: TierSchema, C: TierSchema, D: TierSchema, F: TierSchema }),
  demo: z.object({
    bots: z.number().int().min(0).max(40),
    writingSeconds: z.number().int().min(15).max(600),
    seatsUseAI: z.boolean(),
  }),
});
const ConfigSchema = z.object({
  rounds: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        subtitle: z.string().max(120),
        topicId: z.string(),
        scaffold: z.enum(["blank", "checklist", "guided"]),
        minutes: z.number().min(0.5).max(60),
        tips: z.array(z.string().max(300)).max(10),
      }),
    )
    .min(1)
    .max(6),
  topics: z.array(TopicSchema).min(1).max(30),
  model: z.string().min(1),
  gradingMode: z.enum(["ai", "mock"]),
  graderPrompt: z.string().max(40_000).nullable(),
  joinUrl: z.string().max(300).nullable(),
  show: ShowSchema,
});

type Expect = { phase: Phase; round: number };

export type AdminAction =
  | { action: "next"; expect?: Expect }
  | { action: "back" }
  | { action: "goto"; phase: Phase; roundIndex?: number }
  | { action: "addTime"; seconds: number }
  | { action: "setTime"; seconds: number }
  | { action: "pause" }
  | { action: "resume" }
  | { action: "spotlight"; playerId: string | null; expect?: Expect }
  | { action: "mute"; muted: boolean }
  | { action: "announce"; text: string }
  | { action: "clearAnnouncement" }
  | { action: "cue"; id: SoundCue }
  | { action: "reset" }
  | { action: "saveConfig"; config: GameConfig }
  | { action: "hidePlayer"; playerId: string; hidden: boolean }
  | { action: "kickPlayer"; playerId: string }
  | { action: "renamePlayer"; playerId: string; name: string }
  | { action: "regrade"; round: number; playerId?: string }
  | { action: "addBots"; count: number }
  | { action: "botsSubmit" }
  | { action: "removeBots" }
  | { action: "clearReactions" }
  | { action: "demoStart" }
  | { action: "autopilot"; on: boolean };

function timeLeft(game: GameState) {
  if (game.pausedLeft !== null) return game.pausedLeft;
  return game.roundEndsAt ? game.roundEndsAt - Date.now() : null;
}

async function addBots(snap: Snapshot, count: number) {
  const existing = Object.values(snap.players);
  const used = new Set(existing.map((p) => p.name));
  const names = BOT_NAMES.filter((n) => !used.has(n)).slice(0, Math.max(1, Math.min(40, count)));
  let i = existing.length;
  for (const name of names) {
    const bot: Player = {
      id: `bot-${crypto.randomUUID().slice(0, 8)}`,
      name,
      avatar: AVATARS[(i * 7 + 3) % AVATARS.length],
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
      joinedAt: Date.now() + i,
      hidden: false,
      bot: true,
    };
    i++;
    await store.hset(K.players, bot.id, bot);
  }
  invalidate();
}

function botPlate(snap: Snapshot, bot: Player) {
  const round = snap.game.roundIndex;
  const scaffold = snap.config.rounds[round]?.scaffold ?? "blank";
  const jitter = [-1, 0, 0, 0, 1][Math.floor(Math.random() * 5)];
  const offer = bot.seat ? seatScript(snap, bot)! : botOffer(topicFor(snap.config, round), SCAFFOLD_LEVEL[scaffold] + jitter);
  return submitOffer({ playerId: bot.id, round, text: offer.text, fields: offer.fields }).catch(() => {});
}

export async function adminAction(a: AdminAction): Promise<void> {
  const snap = await readSnapshot(true);
  const prev = snap.game;
  const game = { ...snap.game };
  const last = snap.config.rounds.length - 1;
  const minutes = () => snap.config.rounds[game.roundIndex]?.minutes ?? 5;
  const save = () => saveGame(game, prev);
  const openKitchen = () => {
    const secs = game.autopilot ? snap.config.show.demo.writingSeconds : minutes() * 60;
    Object.assign(game, { phase: "writing", roundEndsAt: Date.now() + secs * 1000, pausedLeft: null });
  };

  if ("expect" in a && a.expect && (a.expect.phase !== game.phase || a.expect.round !== game.roundIndex)) return;

  switch (a.action) {
    case "next": {
      if (game.phase === "lobby") Object.assign(game, { phase: "intro", roundIndex: 0 });
      else if (game.phase === "intro") openKitchen();
      else if (game.phase === "writing") {
        Object.assign(game, { phase: "grading", pausedLeft: null });
        lockAndGrade(snap, game.roundIndex);
      } else if (game.phase === "grading") game.phase = "leaderboard";
      else if (game.phase === "leaderboard" || game.phase === "spotlight") {
        game.spotlightPlayerId = null;
        if (game.roundIndex < last) Object.assign(game, { phase: "intro", roundIndex: game.roundIndex + 1, roundEndsAt: null });
        else game.phase = "final";
      }
      return save();
    }
    case "back": {
      if (game.phase === "intro") {
        if (game.roundIndex === 0) game.phase = "lobby";
        else Object.assign(game, { phase: "leaderboard", roundIndex: game.roundIndex - 1 });
      } else if (game.phase === "writing") Object.assign(game, { phase: "intro", roundEndsAt: null, pausedLeft: null });
      else if (game.phase === "grading") {
        game.phase = "writing";
        game.roundEndsAt = Math.max(game.roundEndsAt ?? 0, Date.now() + 60_000);
      } else if (game.phase === "leaderboard") game.phase = "grading";
      else if (game.phase === "spotlight") Object.assign(game, { phase: "leaderboard", spotlightPlayerId: null });
      else if (game.phase === "final") Object.assign(game, { phase: "leaderboard", roundIndex: last });
      return save();
    }
    case "goto": {
      game.phase = a.phase;
      game.pausedLeft = null;
      if (a.roundIndex !== undefined) game.roundIndex = Math.max(0, Math.min(last, a.roundIndex));
      if (a.phase === "writing") openKitchen();
      if (a.phase === "grading") lockAndGrade(snap, game.roundIndex);
      return save();
    }
    case "addTime": {
      if (game.phase !== "writing") throw new GameError("The timer only runs while the kitchen is open.");
      if (game.pausedLeft !== null) game.pausedLeft = Math.max(0, game.pausedLeft + a.seconds * 1000);
      else game.roundEndsAt = Math.max(Date.now(), game.roundEndsAt ?? 0) + a.seconds * 1000;
      return save();
    }
    case "setTime": {
      if (game.phase !== "writing") throw new GameError("The timer only runs while the kitchen is open.");
      if (game.pausedLeft !== null) game.pausedLeft = a.seconds * 1000;
      else game.roundEndsAt = Date.now() + a.seconds * 1000;
      return save();
    }
    case "pause": {
      const left = timeLeft(game);
      if (game.phase !== "writing" || left === null || game.pausedLeft !== null) return;
      Object.assign(game, { pausedLeft: Math.max(0, left), roundEndsAt: null });
      return save();
    }
    case "resume": {
      if (game.pausedLeft === null) return;
      Object.assign(game, { roundEndsAt: Date.now() + game.pausedLeft, pausedLeft: null });
      return save();
    }
    case "spotlight": {
      game.spotlightPlayerId = a.playerId;
      game.phase = a.playerId ? "spotlight" : "leaderboard";
      return save();
    }
    case "mute":
      game.muted = a.muted;
      return save();
    case "announce": {
      const text = a.text.trim().slice(0, 140);
      game.announcement = text ? { text, at: Date.now() } : null;
      return save();
    }
    case "clearAnnouncement":
      game.announcement = null;
      return save();
    case "cue": {
      if (!SOUND_CUES.some((c) => c.id === a.id)) throw new GameError("Unknown sound.");
      game.cue = { id: a.id, at: Date.now() };
      return save();
    }
    case "reset": {
      await store.del(K.players, K.subs, K.grades, K.reactions);
      await store.set(K.game, newGame(game.muted));
      invalidate();
      return;
    }
    case "demoStart": {
      await store.del(K.players, K.subs, K.grades, K.reactions);
      await store.set(K.game, { ...newGame(game.muted), autopilot: true });
      invalidate();
      return;
    }
    case "autopilot": {
      game.autopilot = a.on;
      return save();
    }
    case "saveConfig": {
      const parsed = ConfigSchema.safeParse(a.config);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new GameError(`Not saved: ${issue?.path.join(" › ") || "config"} — ${issue?.message ?? "invalid"}`);
      }
      const cfg = parsed.data as GameConfig;
      cfg.rounds.forEach((r) => (r.tips = r.tips.map((t) => t.trim()).filter(Boolean)));
      const ids = new Set(cfg.topics.map((t) => t.id));
      if (cfg.rounds.some((r) => !ids.has(r.topicId))) throw new GameError("Every round needs a topic card that exists.");
      await store.set(K.config, cfg);
      if (game.roundIndex > cfg.rounds.length - 1) {
        game.roundIndex = cfg.rounds.length - 1;
        await save();
      }
      invalidate();
      return;
    }
    case "hidePlayer": {
      const p = snap.players[a.playerId];
      if (!p) throw new GameError("No such player.");
      await store.hset(K.players, p.id, { ...p, hidden: a.hidden });
      if (a.hidden && game.spotlightPlayerId === p.id) {
        Object.assign(game, { spotlightPlayerId: null, phase: game.phase === "spotlight" ? "leaderboard" : game.phase });
        await save();
      }
      invalidate();
      return;
    }
    case "renamePlayer": {
      const p = snap.players[a.playerId];
      if (!p) throw new GameError("No such player.");
      const name = a.name.replace(/\s+/g, " ").trim().slice(0, 18);
      if (!name) throw new GameError("Names can't be empty.");
      await store.hset(K.players, p.id, { ...p, name });
      invalidate();
      return;
    }
    case "kickPlayer": {
      await store.hdel(K.players, a.playerId);
      if (game.spotlightPlayerId === a.playerId) {
        Object.assign(game, { spotlightPlayerId: null, phase: game.phase === "spotlight" ? "leaderboard" : game.phase });
        await save();
      }
      invalidate();
      return;
    }
    case "regrade": {
      for (const sub of Object.values(snap.subs)) {
        if (sub.round !== a.round) continue;
        if (a.playerId && sub.playerId !== a.playerId) continue;
        if (!a.playerId) {
          const rec = currentGrade(sub, snap.grades[subKey(sub.round, sub.playerId)]);
          if (rec?.status === "done") continue;
        }
        scheduleGrade(sub.round, sub.playerId, sub.version);
      }
      return;
    }
    case "addBots":
      return addBots(snap, a.count);
    case "botsSubmit": {
      if (game.phase !== "writing") throw new GameError("Open the kitchen first, then let the bots cook.");
      const round = game.roundIndex;
      const bots = Object.values(snap.players).filter((p) => p.bot && !snap.subs[subKey(round, p.id)]);
      after(async () => {
        for (const bot of bots) {
          await new Promise((r) => setTimeout(r, 250 + Math.random() * 900));
          await botPlate(snap, bot);
        }
      });
      return;
    }
    case "removeBots": {
      for (const p of Object.values(snap.players)) if (p.bot) await store.hdel(K.players, p.id);
      invalidate();
      return;
    }
    case "clearReactions":
      await store.del(K.reactions);
      invalidate();
      return;
  }
}

/* ---------- Autopilot & auto-advance ---------- */

/** Run `fn` at most once per key across every server instance. */
async function once(key: string, ttl: number, fn: () => Promise<unknown>) {
  if (await store.setNX(`ok:lock:${key}`, ttl)) await fn();
}

/**
 * Called on every state poll. Cheap unless something is due: lock the kitchen
 * when time runs out, reveal when the oven is empty, and in demo mode walk the
 * whole show (bots join, cook, react; screens advance on a schedule).
 */
export async function tick(): Promise<void> {
  const snap = await readSnapshot();
  const { game, config } = snap;
  const s = config.show;
  const ap = game.autopilot;
  if (!ap && !s.autoLock && !s.autoReveal) return;

  const now = Date.now();
  const age = now - game.phaseStartedAt;
  const tag = `${game.id}:${game.phase}:${game.roundIndex}:${game.phaseStartedAt}`;
  const expect = { phase: game.phase, round: game.roundIndex };
  const advance = (why: string) => once(`${tag}:${why}`, 120, () => adminAction({ action: "next", expect }));
  const bots = Object.values(snap.players).filter((p) => p.bot);
  const roundSubs = Object.values(snap.subs).filter((x) => x.round === game.roundIndex);

  if (ap && ["lobby", "leaderboard", "spotlight", "final"].includes(game.phase) && bots.length) {
    // A little crowd noise from the bots.
    await once(`${game.id}:react:${Math.floor(now / 900)}`, 10, async () => {
      if (Math.random() < 0.65) {
        const e = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
        await store.hincrby(K.reactions, e, 1 + Math.floor(Math.random() * 3));
        invalidate();
      }
    });
  }

  switch (game.phase) {
    case "lobby": {
      if (!ap) return;
      const plain = bots.filter((b) => !b.seat).length;
      if (plain < s.demo.bots) {
        if (age > 1500) await once(`${tag}:join:${Math.floor(now / 650)}`, 10, () => addBots(snap, 1));
        return;
      }
      if (age > 4000 + s.demo.bots * 650 + 2500) await advance("start");
      return;
    }
    case "intro":
      if (ap && age > 9000) await advance("open");
      return;
    case "writing": {
      const left = timeLeft(game);
      if (ap && game.pausedLeft === null) {
        const done = new Set(roundSubs.map((x) => x.playerId));
        const humans = Object.values(snap.players).filter((p) => !p.bot && !p.hidden);
        const humansDone = humans.length > 0 && humans.every((p) => done.has(p.id));
        // Playable demo: bots pace themselves to real people, and hurry up once every human has plated.
        // Watch-only demo: bots plate within ~25s so nobody waits on an empty timer.
        const total = Math.max(10_000, (game.roundEndsAt ?? now) - game.phaseStartedAt);
        const cookWindow = humans.length ? total * 0.75 : Math.min(total * 0.75, 22_000);
        const frac = humansDone ? 1 : Math.min(1, Math.max(0, (age - 3000) / cookWindow));
        const waiting = bots.filter((b) => !done.has(b.id) && (!b.seat || frac >= 1));
        const plain = bots.filter((b) => !b.seat).length;
        const want = Math.ceil(plain * frac) - bots.filter((b) => !b.seat && done.has(b.id)).length;
        const batch = waiting.filter((b) => !b.seat).slice(0, Math.max(0, Math.min(humansDone ? 8 : 3, want)));
        // Demo phones that are still typing get plated for them once the humans are done (or time is nearly up).
        if (frac >= 1 && (humansDone || age > total * 0.9)) batch.push(...waiting.filter((b) => b.seat));
        if (batch.length) await once(`${tag}:cook:${Math.floor(now / 1000)}`, 10, () => Promise.all(batch.map((b) => botPlate(snap, b))));
        const everyone = Object.values(snap.players).filter((p) => !p.hidden);
        if (age > 6000 && everyone.length > 0 && everyone.every((p) => done.has(p.id))) await advance("all-plated");
      }
      // Phones auto-plate at zero; give them a beat before the lock.
      if ((ap || s.autoLock) && game.roundEndsAt && left !== null && left < -2500) await advance("lock");
      return;
    }
    case "grading": {
      if (!ap && !s.autoReveal) return;
      const pending = roundSubs.some((x) => {
        const rec = currentGrade(x, snap.grades[subKey(x.round, x.playerId)]);
        return !rec || rec.status === "pending";
      });
      if ((!pending && age > 3500) || (ap && age > 45_000)) await advance("reveal");
      return;
    }
    case "leaderboard": {
      if (!ap) return;
      const shown = Math.min(s.leaderboardSize, roundSubs.length);
      if (age < 2500 + shown * REVEAL_GAP_MS[s.revealPace] + 6000) return;
      const pub = await buildState({});
      const top = pub.board[game.roundIndex]?.find((e) => e.overall !== undefined);
      if (top) await once(`${tag}:spot`, 120, () => adminAction({ action: "spotlight", playerId: top.playerId, expect }));
      else await advance("skip");
      return;
    }
    case "spotlight":
      if (ap && age > 15_000) await advance("onward");
      return;
    case "final":
      return;
  }
}

/* ---------- Export ---------- */

export async function exportCsv(): Promise<string> {
  const snap = await readSnapshot(true);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "player", "avatar", "bot", "round", "round_name", "topic", "offer", "overall", "letter", "compelling",
    ...CRITERIA_IDS.map((c) => `${c}_score`), "verdict", "strength", "next_move",
    ...CRITERIA_IDS.map((c) => `${c}_feedback`), "submitted_at",
  ];
  const rows = [header.join(",")];
  const players = Object.values(snap.players).sort((a, b) => a.name.localeCompare(b.name));
  for (const p of players) {
    snap.config.rounds.forEach((r, i) => {
      const sub = snap.subs[subKey(i, p.id)];
      if (!sub) return;
      const g = currentGrade(sub, snap.grades[subKey(i, p.id)])?.grade;
      const crit = (id: string) => g?.criteria.find((c) => c.id === id);
      rows.push(
        [
          p.name, p.avatar, p.bot ? "yes" : "", i + 1, r.name, topicFor(snap.config, i).title, sub.text, g?.overall, g?.letter, g?.compelling,
          ...CRITERIA_IDS.map((c) => crit(c)?.score), g?.verdict, g?.strength, g?.nextMove,
          ...CRITERIA_IDS.map((c) => crit(c)?.feedback), new Date(sub.submittedAt).toISOString(),
        ]
          .map(esc)
          .join(","),
      );
    });
  }
  return rows.join("\n");
}

/* ---------- Grader playground ---------- */

export async function testGrade(topicId: string, text: string) {
  const snap = await readSnapshot(true);
  const topic = snap.config.topics.find((t) => t.id === topicId) ?? topicFor(snap.config, 0);
  return gradeSubmission({
    topic,
    sub: { round: 0, playerId: "test", text, fields: null, version: 1, submittedAt: Date.now() },
    model: snap.config.model,
    mode: snap.config.gradingMode,
    systemPrompt: snap.config.graderPrompt,
  });
}

export async function currentModel() {
  return (await readSnapshot()).config.model;
}
