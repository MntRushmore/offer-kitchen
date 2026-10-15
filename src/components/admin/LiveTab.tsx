"use client";

import { motion } from "motion/react";
import { memo, useState } from "react";
import { TvApp } from "@/components/tv/TvApp";
import { useStoredValue } from "@/lib/client/storage";
import { formatClock, useTick } from "@/lib/client/useGame";
import { REACTIONS, SOUND_CUES } from "@/lib/constants";
import type { GameConfig, Phase, Player, PublicState, SoundCue } from "@/lib/types";
import { Avatar, Button, Chip, cx, GradeBadge, Input, Panel, scoreInk, Select } from "../ui";
import { ActButton, Boundary, Empty, Eyebrow, Toggle } from "./controls";
import { type Act, ANNOUNCE_MS, earlierScores, msLeft, PHASE_EMOJI, PHASE_LABEL, plural, rankByBest, topChefs } from "./shared";

interface Props {
  state: PublicState;
  config: GameConfig;
  act: Act;
  serverNow: () => number;
}

export function LiveTab({ state, config, act, serverNow }: Props) {
  const { game } = state;
  const writing = game.phase === "writing";
  const finals = (state.rounds[game.roundIndex]?.finalists ?? 0) > 0 && game.phase !== "lobby" && game.phase !== "final";
  return (
    // On phones the two columns dissolve into one list, re-ordered by importance.
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
      <div className="contents lg:flex lg:flex-col lg:gap-6">
        <ThePass state={state} act={act} className="order-1 lg:order-none" />
        {writing && <TimerCard state={state} config={config} act={act} serverNow={serverNow} className="order-2 lg:order-none" />}
        {finals && <FinalistsCard state={state} act={act} className="order-2 lg:order-none" />}
        <StatTiles state={state} act={act} className="order-3 lg:order-none" />
        <SpotlightCard state={state} act={act} className="order-7 lg:order-none" />
        <div className="order-9 grid grid-cols-1 gap-6 lg:order-none xl:grid-cols-2">
          <BotsCard state={state} config={config} act={act} />
          <DangerCard act={act} />
        </div>
      </div>
      <div className="contents lg:flex lg:flex-col lg:gap-6">
        <TvPreviewCard className="order-4 lg:order-none" />
        <Announcer state={state} act={act} serverNow={serverNow} className="order-5 lg:order-none" />
        <Soundboard state={state} act={act} className="order-6 lg:order-none" />
        <ReactionsCard state={state} act={act} className="order-8 lg:order-none" />
      </div>
    </div>
  );
}

/* ---------- The pass: where the show is, and what's next ---------- */

const ROUND_STEPS: { phase: Phase; label: string; emoji: string }[] = [
  { phase: "intro", label: "Intro", emoji: "🎬" },
  { phase: "writing", label: "Cook", emoji: "🔥" },
  { phase: "grading", label: "Oven", emoji: "♨️" },
  { phase: "leaderboard", label: "Results", emoji: "📊" },
];

/** Position on the show's timeline: lobby, four steps per round, finale. */
function stepIndex(phase: Phase, round: number, rounds: number) {
  if (phase === "lobby") return 0;
  if (phase === "final") return 1 + rounds * 4;
  const p = phase === "spotlight" ? "leaderboard" : phase;
  return 1 + round * 4 + ROUND_STEPS.findIndex((s) => s.phase === p);
}

function ThePass({ state, act, className }: { state: PublicState; act: Act; className?: string }) {
  const { game, rounds } = state;
  const round = rounds[game.roundIndex];
  const last = game.roundIndex >= rounds.length - 1;
  const entries = state.board[game.roundIndex] ?? [];
  const graded = entries.filter((e) => e.status === "graded").length;
  const errors = entries.filter((e) => e.status === "error").length;
  const pending = entries.length - graded - errors;
  const current = stepIndex(game.phase, game.roundIndex, rounds.length);
  const nextRound = rounds[game.roundIndex + 1];
  const upNext =
    (game.phase === "leaderboard" || game.phase === "spotlight") && nextRound?.finalists
      ? { n: nextRound.finalists, chefs: topChefs(state, game.roundIndex + 1, nextRound.finalists) }
      : null;

  const next: Record<Phase, [string, string]> = {
    lobby: ["▶ Start Round 1", `Shows Round 1's intro on the TV. ${plural(state.players.length, "chef")} in the lobby.`],
    intro: [
      `🔥 Open the kitchen · ${round?.minutes ?? "?"} min`,
      round?.finalists ? "Only the finalists' phones unlock. Everyone else watches." : "Phones unlock and the timer starts.",
    ],
    writing: ["🔒 Lock the kitchen & grade", "Phones lock and every plate goes into the oven."],
    grading: [
      "📊 Reveal the results",
      pending > 0
        ? `${pending} still in the oven. Revealing now leaves them off the board until they finish.`
        : "Every plate is graded. Time for the big reveal!",
    ],
    leaderboard: [last ? "🏆 Go to the finale" : `➡️ On to Round ${game.roundIndex + 2}`, last ? "Crowns the winners on the TV." : "Shows the next round's intro."],
    spotlight: [last ? "🏆 Go to the finale" : `➡️ On to Round ${game.roundIndex + 2}`, last ? "Crowns the winners on the TV." : "Shows the next round's intro."],
    final: ["That's a wrap! 🎉", "To run it again, reset the game in the danger zone below."],
  };
  const [label, caption] = next[game.phase];

  const jump = (phase: Phase, roundIndex: number, name: string) => {
    if (confirm(`Jump to ${name}? The TV and phones switch right away. Offers and grades are kept.`)) {
      void act({ action: "goto", phase, roundIndex }, `Jumped to ${name}`);
    }
  };

  const step = (idx: number, text: React.ReactNode, onJump: () => void, key: string) => {
    const state = idx === current ? "now" : idx < current ? "done" : "todo";
    return (
      <button
        key={key}
        type="button"
        disabled={state === "now"}
        onClick={onJump}
        title={state === "now" ? "On the TV now" : "Jump here"}
        className={cx(
          "font-display relative flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-[10px] border-2 px-1.5 py-1.5 text-[13px] font-bold whitespace-nowrap transition-all duration-150",
          state === "now" && "border-line bg-goldenrod text-ink shadow-control cursor-default",
          state === "done" && "border-leaf/60 bg-leaf/25 text-ink/80 hover:border-line",
          state === "todo" && "border-line/20 bg-surface-plain text-ink/60 hover:border-line hover:text-ink",
        )}
      >
        {state === "done" && <span className="text-[11px]">✓</span>}
        {state === "now" && <span className="bg-sunset-orange animate-glow h-2 w-2 shrink-0 rounded-full" />}
        <span className="truncate">{text}</span>
      </button>
    );
  };

  return (
    <Panel
      title="🍽️ The pass"
      className={className}
      actions={
        <Chip tone="plain" className="bg-surface-plain">
          {PHASE_EMOJI[game.phase]} {PHASE_LABEL[game.phase]}
          {game.phase !== "lobby" && game.phase !== "final" && <span className="text-ink-soft font-bold">· R{game.roundIndex + 1}</span>}
        </Chip>
      }
    >
      {game.autopilot && (
        <div className="border-line bg-viking/25 mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border-2 px-3.5 py-2.5">
          <span className="text-[22px]">🤖</span>
          <div className="min-w-0 flex-1 text-[14px] leading-snug">
            <b className="font-display">Autopilot is driving.</b> Your buttons still work, and it carries on from wherever you leave it.
          </div>
          <ActButton size="sm" variant="secondary" run={() => act({ action: "autopilot", on: false }, "You have the wheel")}>
            Take over
          </ActButton>
          <ActButton
            size="sm"
            variant="danger"
            run={async () => {
              if (!confirm("End the demo? This clears the bots, demo offers and grades and opens a fresh lobby for real guests.")) return;
              await act({ action: "reset" }, "Demo ended. Fresh lobby, ready for real guests.");
            }}
          >
            End demo
          </ActButton>
        </div>
      )}

      {/* Timeline */}
      <div className="flex flex-col gap-1.5">
        {step(0, "🚪 Lobby", () => jump("lobby", 0, "the lobby"), "lobby")}
        {rounds.map((r, i) => (
          <div key={i} className="grid grid-cols-1 gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-center sm:gap-2">
            <div className="font-display text-ink-soft truncate px-1 text-[12.5px] font-extrabold">
              <span className="text-ink">R{i + 1}</span> · {r.name}
              {r.finalists ? " 🏆" : ""}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {ROUND_STEPS.map((s, j) =>
                step(
                  1 + i * 4 + j,
                  <>
                    <span className="hidden sm:inline">{s.emoji} </span>
                    {s.label}
                  </>,
                  () => jump(s.phase, i, `Round ${i + 1} · ${s.label}`),
                  `${i}:${s.phase}`,
                ),
              )}
            </div>
          </div>
        ))}
        {step(1 + rounds.length * 4, "🏆 Finale", () => jump("final", rounds.length - 1, "the finale"), "final")}
      </div>

      {/* Next */}
      <div className="mt-5">
        <ActButton
          size="xl"
          variant={game.phase === "writing" ? "danger" : "primary"}
          className="w-full py-5 text-[20px] sm:text-[24px]"
          disabled={game.phase === "final"}
          busyLabel="On it…"
          run={() => act({ action: "next", expect: { phase: game.phase, round: game.roundIndex } })}
        >
          {label}
        </ActButton>
        <p className={cx("mt-2 text-center text-[13.5px] font-semibold", game.phase === "grading" && pending > 0 ? "text-carrot-orange" : "text-ink-soft")}>
          {caption}
        </p>
        {upNext && (
          <p className="border-line bg-goldenrod/40 mt-3 rounded-[12px] border-2 px-3 py-2 text-[14px] leading-snug">
            <b className="font-display">🏆 Up next: the top {upNext.n} finalists</b>
            <span className="text-ink-muted">
              {" "}
              — {upNext.chefs.length ? `currently: ${upNext.chefs.map((c) => `${c.player.name} (${c.best})`).join(", ")}` : "nobody has a score yet"}
            </span>
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ActButton size="sm" variant="secondary" disabled={game.phase === "lobby"} run={() => act({ action: "back" })}>
          ◀ Back
        </ActButton>
        {game.phase === "spotlight" && (
          <ActButton size="sm" variant="secondary" run={() => act({ action: "spotlight", playerId: null })}>
            🔦 End spotlight
          </ActButton>
        )}
        <span className="text-ink-soft ml-auto text-[12px]">Tap any step above to jump. Nothing gets deleted.</span>
      </div>
    </Panel>
  );
}

/* ---------- Kitchen timer ---------- */

function TimerCard({ state, config, act, serverNow, className }: Props & { className?: string }) {
  useTick(250);
  const { game } = state;
  const paused = game.pausedLeft !== null;
  const left = msLeft(game, serverNow()) ?? 0;
  const planned = (game.autopilot ? config.show.demo.writingSeconds : (state.rounds[game.roundIndex]?.minutes ?? 5) * 60) * 1000;
  const pct = Math.max(0, Math.min(100, (left / Math.max(planned, left, 1)) * 100));
  const urgent = !paused && left < 30_000;
  const t = (body: Parameters<Act>[0], ok?: string) => () => act(body, ok);

  return (
    <Panel title="⏱️ Kitchen timer" tone={urgent ? "tomato" : "orange"} className={className}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <div
            className={cx(
              "font-sign text-[64px] leading-none tabular-nums sm:text-[76px]",
              paused ? "text-ink-soft" : urgent ? "text-sunset-orange" : "text-ink",
              urgent && left > 0 && "animate-pulse",
            )}
          >
            {left <= 0 ? "TIME!" : formatClock(left)}
          </div>
          <div className="font-display mt-1.5 text-[13px] font-extrabold tracking-wide uppercase">
            {paused ? (
              <span className="bg-goldenrod border-line rounded-full border-2 px-2 py-0.5">⏸ Paused</span>
            ) : left <= 0 ? (
              <span className="text-sunset-orange">{config.show.autoLock || game.autopilot ? "Locking the kitchen…" : "Time's up: lock when ready"}</span>
            ) : (
              <span className="text-ink-soft">Kitchen open · counting down</span>
            )}
          </div>
        </div>
        {paused ? (
          <ActButton size="lg" variant="success" run={t({ action: "resume" }, "Timer resumed")}>
            ▶ Resume
          </ActButton>
        ) : (
          <ActButton size="lg" variant="brand" run={t({ action: "pause" }, "Timer paused")}>
            ⏸ Pause
          </ActButton>
        )}
      </div>
      <div className="border-line bg-surface-alt mt-4 h-3.5 overflow-hidden rounded-full border-2">
        <div
          className={cx("border-line h-full rounded-full transition-[width] duration-300 ease-linear", pct > 0 && "border-r-2")}
          style={{ width: `${pct}%`, background: urgent ? "#fd6338" : paused ? "#c9b9a3" : "#eb9824" }}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="flex gap-1.5">
          <ActButton size="sm" variant="secondary" run={t({ action: "addTime", seconds: -30 }, "−30 seconds")}>
            −30s
          </ActButton>
          <ActButton size="sm" variant="secondary" run={t({ action: "addTime", seconds: 30 }, "+30 seconds")}>
            +30s
          </ActButton>
          <ActButton size="sm" variant="secondary" run={t({ action: "addTime", seconds: 60 }, "+1 minute")}>
            +1 min
          </ActButton>
        </div>
        <div className="flex items-center gap-1.5">
          <Eyebrow className="mr-0.5">Set to</Eyebrow>
          {[60, 120, 180, 300].map((sec) => (
            <ActButton key={sec} size="sm" variant="secondary" className="px-2.5" run={t({ action: "setTime", seconds: sec }, `Timer set to ${sec / 60}:00`)}>
              {sec / 60}:00
            </ActButton>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ---------- Stats ---------- */

function StatTiles({ state, act, className }: { state: PublicState; act: Act; className?: string }) {
  const entries = state.board[state.game.roundIndex] ?? [];
  const graded = entries.filter((e) => e.status === "graded").length;
  const errors = entries.filter((e) => e.status === "error").length;
  const humans = state.players.filter((p) => !p.bot).length;
  const bots = state.players.length - humans;
  const f = state.game.finalists;
  const finalists = state.rounds[state.game.roundIndex]?.finalists && f?.round === state.game.roundIndex ? f.ids.length : null;
  const tile = "border-line bg-surface shadow-card flex min-w-0 flex-col rounded-[16px] border-2 px-4 py-3";
  const k = "font-display text-ink-soft text-[11.5px] font-extrabold tracking-[0.08em] uppercase";
  const v = "font-display text-ink text-[34px] leading-none font-extrabold tabular-nums";
  return (
    <div className={cx("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      <div className={tile}>
        <span className={k}>👩‍🍳 Chefs</span>
        <span className={cx(v, "mt-1.5")}>{state.players.length}</span>
        <span className="text-ink-soft mt-1 truncate text-[12.5px]">
          {bots > 0 ? `${humans} + ${bots} 🤖` : `${humans} ${humans === 1 ? "person" : "people"}`}
        </span>
      </div>
      <div className={tile}>
        <span className={k}>🍽️ Plated</span>
        <span className={cx(v, "mt-1.5")}>{entries.length}</span>
        <span className="text-ink-soft mt-1 text-[12.5px]">{finalists !== null ? `of ${plural(finalists, "finalist")}` : `of ${state.players.length} this round`}</span>
      </div>
      <div className={tile}>
        <span className={k}>✅ Graded</span>
        <span className={cx(v, "mt-1.5")}>{graded}</span>
        <span className="text-ink-soft mt-1 text-[12.5px]">{entries.length - graded - errors > 0 ? `${entries.length - graded - errors} in the oven` : "nothing waiting"}</span>
      </div>
      <div className={cx(tile, errors > 0 && "bg-sunset-orange/15")}>
        <span className={k}>⚠️ Errors</span>
        <span className={cx(v, "mt-1.5", errors > 0 && "text-sunset-orange")}>{errors}</span>
        {errors > 0 ? (
          <ActButton
            size="sm"
            variant="danger"
            className="mt-1.5 self-start"
            run={() => act({ action: "regrade", round: state.game.roundIndex }, `Retrying ${plural(errors, "grade")}`)}
          >
            🔁 Retry
          </ActButton>
        ) : (
          <span className="text-ink-soft mt-1 text-[12.5px]">all good</span>
        )}
      </div>
    </div>
  );
}

/* ---------- TV preview ---------- */

// Memoised so the admin's own polling doesn't re-render the TV every tick.
const TvPreview = memo(function TvPreview() {
  return (
    <Boundary
      fallback={(retry) => (
        <div className="bg-slate text-chalk absolute inset-0 grid place-items-center p-4 text-center">
          <div>
            <div className="font-display text-[15px] font-bold">The preview hiccuped.</div>
            <button type="button" onClick={retry} className="mt-2 cursor-pointer text-[13px] underline">
              Try again
            </button>
          </div>
        </div>
      )}
    >
      <TvApp mode="preview" />
    </Boundary>
  );
});

function TvPreviewCard({ className }: { className?: string }) {
  const [hidden, setHidden] = useStoredValue("ok:admin-preview-off");
  const off = hidden === "1";
  return (
    <Panel
      title="📺 On the TV right now"
      tone="alt"
      className={className}
      bodyClassName="p-3"
      actions={
        <div className="flex items-center gap-2">
          {!off && (
            <span className="font-display bg-sunset-orange border-line inline-flex items-center gap-1 rounded-full border-2 px-2 text-[11px] font-extrabold text-white">
              <span className="animate-glow h-1.5 w-1.5 rounded-full bg-white" /> LIVE
            </span>
          )}
          <button type="button" onClick={() => setHidden(off ? null : "1")} className="font-display cursor-pointer text-[13px] font-bold underline">
            {off ? "Show" : "Hide"}
          </button>
        </div>
      }
    >
      {off ? (
        <p className="text-ink-soft px-1 py-2 text-[13.5px]">Preview hidden to save battery. The TV is still running.</p>
      ) : (
        <div className="border-line bg-slate relative aspect-video overflow-hidden rounded-[12px] border-2">
          <div className="absolute inset-0">
            <TvPreview />
          </div>
          <a href="/tv" target="_blank" rel="noreferrer" className="absolute inset-0 z-10" aria-label="Open the TV in a new tab" />
        </div>
      )}
    </Panel>
  );
}

/* ---------- Announcements ---------- */

const PRESETS = ["⏰ 2 minutes left!", "👀 Phones down, eyes up", "🛡️ Don't forget your guarantee!", "🍪 Snack break — back in 5", "🔥 Great work, chefs!"];

function Announcer({ state, act, serverNow, className }: { state: PublicState; act: Act; serverNow: () => number; className?: string }) {
  const [text, setText] = useState("");
  const send = async (msg: string) => {
    if (await act({ action: "announce", text: msg }, "📣 Announced on the TV and phones")) setText("");
  };
  return (
    <Panel title="📣 Announcement" tone="lime" className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) void send(text);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative min-w-0 flex-1">
          <Input value={text} maxLength={140} onChange={(e) => setText(e.target.value)} placeholder="Message the whole room…" className="pr-14" />
          <span className="text-ink-soft pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-bold tabular-nums">
            {text.length}/140
          </span>
        </div>
        <Button type="submit" variant="brand" disabled={!text.trim()}>
          📣 Announce
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => void send(p)}
            className="border-line/30 bg-surface-plain hover:border-line hover:bg-goldenrod/40 cursor-pointer rounded-full border-2 px-3 py-1 text-[13px] font-semibold transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
      {state.game.announcement && <AnnouncementStatus announcement={state.game.announcement} serverNow={serverNow} act={act} />}
    </Panel>
  );
}

function AnnouncementStatus({
  announcement,
  serverNow,
  act,
}: {
  announcement: NonNullable<PublicState["game"]["announcement"]>;
  serverNow: () => number;
  act: Act;
}) {
  useTick(500);
  const left = ANNOUNCE_MS - (serverNow() - announcement.at);
  const live = left > 0;
  return (
    <div className={cx("mt-4 flex items-center gap-3 rounded-[14px] border-2 px-3.5 py-2.5", live ? "border-line bg-goldenrod/45" : "border-line/20 bg-surface-alt")}>
      <div className="min-w-0 flex-1">
        <Eyebrow>{live ? `On screen now · ${Math.ceil(left / 1000)}s left` : "Last announcement (no longer showing)"}</Eyebrow>
        <div className="font-display text-ink mt-0.5 truncate text-[15px] font-bold">“{announcement.text}”</div>
      </div>
      <ActButton size="sm" variant="secondary" run={() => act({ action: "clearAnnouncement" }, live ? "Announcement cleared" : undefined)}>
        Clear
      </ActButton>
    </div>
  );
}

/* ---------- Soundboard ---------- */

function Soundboard({ state, act, className }: { state: PublicState; act: Act; className?: string }) {
  const muted = state.game.muted;
  const [fired, setFired] = useState<{ id: SoundCue; n: number } | null>(null);
  return (
    <Panel
      title="🔊 Soundboard"
      tone="orange"
      className={className}
      actions={
        <label className="font-display flex cursor-pointer items-center gap-2 text-[13px] font-bold">
          {muted ? "TV muted" : "TV sound on"}
          <Toggle checked={!muted} onChange={(on) => void act({ action: "mute", muted: !on }, on ? "🔊 TV sound on" : "🔇 TV muted")} label="TV sound" />
        </label>
      }
    >
      {muted && (
        <div className="border-carrot-orange bg-goldenrod/40 mb-3 rounded-[12px] border-2 px-3 py-2 text-[13px] font-bold">
          🔇 The TV is muted, so cues won’t be heard. Flip the switch to turn sound back on.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SOUND_CUES.map((c) => (
          <motion.button
            key={c.id}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              setFired((f) => ({ id: c.id, n: (f?.n ?? 0) + 1 }));
              void act({ action: "cue", id: c.id });
            }}
            className={cx(
              "border-line bg-surface-plain shadow-control hover:bg-goldenrod/40 flex cursor-pointer flex-col items-center gap-1 rounded-[14px] border-2 px-2 py-3 transition-colors",
              muted && "opacity-60",
            )}
          >
            <motion.span
              key={fired?.id === c.id ? fired.n : 0}
              initial={fired?.id === c.id ? { scale: 1.5, rotate: -12 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 12 }}
              className="text-[28px] leading-none"
            >
              {c.emoji}
            </motion.span>
            <span className="font-display text-ink text-center text-[12.5px] leading-tight font-bold">{c.label}</span>
          </motion.button>
        ))}
      </div>
      <p className="text-ink-soft mt-3 text-[12.5px]">Plays on the TV only. Set music and effects volume in the Show tab.</p>
    </Panel>
  );
}

/* ---------- Finalists ---------- */

function FinalistsCard({ state, act, className }: { state: PublicState; act: Act; className?: string }) {
  const { game } = state;
  const round = game.roundIndex;
  const n = state.rounds[round]?.finalists ?? 0;
  const pm = new Map(state.players.map((p) => [p.id, p]));
  const scores = earlierScores(state.board, round);
  const fixed = game.finalists?.round === round ? game.finalists.ids : null;
  const ids = fixed ?? topChefs(state, round, n).map((c) => c.player.id);
  const plated = new Set((state.board[round] ?? []).map((e) => e.playerId));
  const others = rankByBest(state, round).filter((c) => !ids.includes(c.player.id));
  const set = (p: Player, on: boolean) => act({ action: "setFinalist", playerId: p.id, on }, on ? `🏆 ${p.name} is in the final` : `${p.name} is out of the final`);

  return (
    <Panel
      title="🏆 Finalists"
      className={className}
      actions={
        <Chip tone="plain" className="bg-surface-plain">
          {ids.length} of top {n}
        </Chip>
      }
    >
      <p className="text-ink-muted mb-3 text-[14px] leading-snug">
        {fixed ? "Only these chefs write this round. Everyone else watches." : "They’ll be picked when the round starts. From the scores so far:"}
      </p>
      {ids.length === 0 ? (
        <Empty pose="think">{fixed ? "No finalists right now. Add a chef below." : "Nobody has a score from earlier rounds yet. Add chefs below."}</Empty>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {ids.map((id, i) => {
            const p = pm.get(id);
            if (!p) return null;
            const best = scores.get(id)?.best;
            return (
              <li key={id} className="border-line/15 bg-surface-plain flex items-center gap-2.5 rounded-[14px] border-2 p-2">
                <span className="font-display text-ink-soft w-6 shrink-0 text-center text-[15px] font-extrabold tabular-nums">{i + 1}</span>
                <Avatar player={p} size={36} dim={p.hidden} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-ink truncate text-[15px] font-bold">
                    {p.name} {p.seat ? "📱" : p.bot ? "🤖" : ""}
                  </div>
                  <div className="text-ink-soft text-[13px] font-semibold">
                    {best !== undefined ? `Best so far ${best}` : "No score yet"}
                    {plated.has(id) && " · ✓ plated"}
                  </div>
                </div>
                {best !== undefined && (
                  <span className="font-display shrink-0 text-[22px] font-extrabold tabular-nums max-sm:hidden" style={{ color: scoreInk(best) }}>
                    {best}
                  </span>
                )}
                <ActButton size="sm" variant="secondary" className="shrink-0" run={() => set(p, false)}>
                  Remove
                </ActButton>
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select
          value=""
          aria-label="Add a chef to the final"
          disabled={!others.length}
          onChange={(e) => {
            const p = pm.get(e.target.value);
            if (p) void set(p, true);
          }}
          className="min-w-0 flex-1 basis-56"
        >
          <option value="">➕ Add a chef…</option>
          {others.map(({ player, best }) => (
            <option key={player.id} value={player.id}>
              {player.name} · {best ?? "no score yet"}
            </option>
          ))}
        </Select>
        <ActButton
          size="sm"
          variant="secondary"
          className="shrink-0"
          run={async () => {
            if (!confirm(`Re-pick the top ${n} from the scores? This replaces the list above, including any swaps you made.`)) return;
            await act({ action: "repickFinalists" }, `🏆 Re-picked the top ${n}`);
          }}
        >
          🔁 Re-pick top {n}
        </ActButton>
      </div>
    </Panel>
  );
}

/* ---------- Spotlight ---------- */

function SpotlightCard({ state, act, className }: { state: PublicState; act: Act; className?: string }) {
  const { game } = state;
  const [preview, setPreview] = useState<string | null>(null);
  const pm = new Map(state.players.map((p) => [p.id, p]));
  const subs = state.admin!.subs.filter((s) => s.round === game.roundIndex);
  const ranked = (state.board[game.roundIndex] ?? []).filter((e) => e.overall !== undefined);
  const live = game.phase === "spotlight" ? game.spotlightPlayerId : null;

  return (
    <Panel
      title={`🔦 Spotlight${state.rounds[game.roundIndex] ? ` · Round ${game.roundIndex + 1}` : ""}`}
      tone="pink"
      className={className}
      actions={
        live && (
          <ActButton size="sm" variant="secondary" run={() => act({ action: "spotlight", playerId: null })}>
            Back to the board
          </ActButton>
        )
      }
    >
      <p className="text-ink-muted mb-3 text-[14px]">Put one plate up on the TV with its full feedback. Tap a name to read the offer first.</p>
      {ranked.length === 0 ? (
        <Empty pose="taste">Graded plates show up here, best first.</Empty>
      ) : (
        <div className="-mx-1 flex max-h-[460px] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
          {ranked.map((e, i) => {
            const p = pm.get(e.playerId);
            if (!p) return null;
            const on = live === p.id;
            const open = preview === p.id;
            return (
              <div
                key={p.id}
                className={cx(
                  "rounded-[14px] border-2 transition-colors",
                  on ? "border-line bg-goldenrod shadow-control" : "border-line/15 bg-surface-plain hover:border-line/40",
                )}
              >
                <div className="flex items-center gap-2.5 p-2">
                  <span className="font-display text-ink-soft w-6 shrink-0 text-center text-[15px] font-extrabold tabular-nums">{i + 1}</span>
                  <Avatar player={p} size={36} dim={p.hidden} />
                  <button type="button" className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setPreview(open ? null : p.id)}>
                    <span className="font-display text-ink block truncate text-[15px] font-bold">
                      {p.name} {p.seat ? "📱" : p.bot ? "🤖" : ""}
                    </span>
                    <span className="text-ink-soft block text-[11.5px] font-semibold">{open ? "Hide offer ▲" : "Read offer ▼"}</span>
                  </button>
                  <span className="font-display shrink-0 text-[22px] font-extrabold tabular-nums" style={{ color: scoreInk(e.overall!) }}>
                    {e.overall}
                  </span>
                  <span className="hidden shrink-0 sm:inline-flex">
                    <GradeBadge letter={e.letter!} size="sm" showName={false} />
                  </span>
                  <ActButton
                    size="sm"
                    variant={on ? "secondary" : "primary"}
                    className="shrink-0"
                    run={() => act({ action: "spotlight", playerId: on ? null : p.id }, on ? undefined : `🔦 ${p.name} is on the TV`)}
                  >
                    {on ? "Hide" : "Show"}
                  </ActButton>
                </div>
                {open && (
                  <p className="font-literal text-ink-muted border-line/15 mx-2 mb-2 max-h-56 overflow-y-auto border-t-2 border-dashed px-1 pt-2 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                    {subs.find((s) => s.playerId === p.id)?.text ?? "No offer text."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ---------- Reactions ---------- */

function ReactionsCard({ state, act, className }: { state: PublicState; act: Act; className?: string }) {
  const total = Object.values(state.reactions).reduce((a, b) => a + b, 0);
  return (
    <Panel
      title="🙌 Reactions"
      tone="plain"
      className={className}
      actions={
        <ActButton size="sm" variant="secondary" disabled={total === 0} run={() => act({ action: "clearReactions" }, "Reactions cleared")}>
          Clear
        </ActButton>
      }
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div>
          <div className="font-sign text-ink text-[44px] leading-none tabular-nums">{total}</div>
          <Eyebrow className="mt-1">{total === 1 ? "reaction" : "reactions"} so far</Eyebrow>
        </div>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {REACTIONS.map((e) => (
            <span key={e} className="border-line/20 bg-surface-plain inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1">
              <span className="text-[18px] leading-none">{e}</span>
              <span className="font-display text-[14px] font-extrabold tabular-nums">{state.reactions[e] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>
      {!state.show.reactions && <p className="text-carrot-orange mt-3 text-[13px] font-bold">Reactions are switched off. Turn them on in the Show tab.</p>}
    </Panel>
  );
}

/* ---------- Rehearsal bots ---------- */

function BotsCard({ state, config, act }: { state: PublicState; config: GameConfig; act: Act }) {
  const bots = state.players.filter((p) => p.bot).length;
  const writing = state.game.phase === "writing";
  return (
    <Panel title="🧪 Rehearsal bots" tone="leaf" className="h-full">
      <p className="text-ink-muted text-[13.5px] leading-snug">
        Fill the room with bot chefs to rehearse. Their plates get better each round and {config.show.botsUseAI ? "use real AI grades." : "get free simulated grades."}
      </p>
      <div className="font-display text-ink mt-3 text-[15px] font-extrabold">{bots ? `🤖 ${plural(bots, "bot")} in the kitchen` : "No bots yet"}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[5, 10, 20].map((n) => (
          <ActButton key={n} size="sm" variant="secondary" run={() => act({ action: "addBots", count: n }, `${n} bots joined`)}>
            +{n}
          </ActButton>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ActButton size="sm" variant="success" disabled={!writing || !bots} run={() => act({ action: "botsSubmit" }, "🤖 Bots are cooking…")}>
          🍳 Bots plate offers
        </ActButton>
        <ActButton size="sm" variant="ghost" disabled={!bots} run={() => act({ action: "removeBots" }, "Bots sent home")}>
          Remove bots
        </ActButton>
      </div>
      {!writing && bots > 0 && <p className="text-ink-soft mt-2 text-[12px]">Bots can plate once the kitchen is open.</p>}
    </Panel>
  );
}

function DangerCard({ act }: { act: Act }) {
  return (
    <Panel title="🧯 Danger zone" tone="tomato" className="h-full">
      <p className="text-ink-muted text-[13.5px] leading-snug">
        Start over with an empty kitchen. Removes every player, offer, grade and reaction. Rounds, topics and settings stay.
      </p>
      <ActButton
        variant="danger"
        className="mt-4"
        run={async () => {
          if (confirm("Reset the game? This removes every player, offer and grade. Your rounds, topics and settings stay.")) {
            await act({ action: "reset" }, "Fresh kitchen. Game reset.");
          }
        }}
      >
        ♻️ Reset game
      </ActButton>
    </Panel>
  );
}
