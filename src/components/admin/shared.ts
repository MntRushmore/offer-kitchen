import type { AdminAction } from "@/lib/game";
import type { GameConfig, GameState, Phase } from "@/lib/types";

/** POST one host action; toasts `ok` on success and the server's message on failure. */
export type Act = (body: AdminAction, ok?: string) => Promise<boolean>;
/** Apply a change to the unsaved config draft. */
export type Edit = (fn: (c: GameConfig) => GameConfig) => void;
export type Flash = (msg: string, bad?: boolean) => void;

export type Tab = "live" | "demo" | "show" | "rounds" | "topics" | "grader" | "players";

export const PHASE_LABEL: Record<Phase, string> = {
  lobby: "Lobby",
  intro: "Round intro",
  writing: "Kitchen open",
  grading: "In the oven",
  leaderboard: "Results",
  spotlight: "Spotlight",
  final: "Finale",
};

export const PHASE_EMOJI: Record<Phase, string> = {
  lobby: "🚪",
  intro: "🎬",
  writing: "🔥",
  grading: "♨️",
  leaderboard: "📊",
  spotlight: "🔦",
  final: "🏆",
};

/** Milliseconds left on the kitchen timer, or null when no timer is running. */
export function msLeft(game: GameState, now: number): number | null {
  if (game.pausedLeft !== null) return game.pausedLeft;
  return game.roundEndsAt ? game.roundEndsAt - now : null;
}

export const ANNOUNCE_MS = 15_000;

export function adminFetch(adminKey: string, url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data;
  });
}

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatSeconds(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  if (!m) return `${r}s`;
  return r ? `${m}m ${r}s` : `${m} min`;
}
