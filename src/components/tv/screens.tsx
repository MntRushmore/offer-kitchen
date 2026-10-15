"use client";

import { AnimatePresence, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "@/lib/client/sound";
import { formatClock, useTick } from "@/lib/client/useGame";
import { CRITERIA, GRADE_TIERS, LETTERS, OVEN_LINES, REVEAL_GAP_MS, ROUND_ART } from "@/lib/constants";
import type { BoardEntry, Player, PublicState, Scaffold } from "@/lib/types";
import {
  Art,
  Avatar,
  Chalkboard,
  Chip,
  CountUp,
  cx,
  Logo,
  Mascot,
  Meter,
  OfferFacts,
  scoreColor,
  SpeechBubble,
  Stamp,
  Ticket,
  TicketRail,
  TopicCardView,
  useShow,
  useTier,
} from "../ui";
import { useConfetti } from "./Stage";

type Props = { state: PublicState; serverNow: () => number; joinUrl: string };

const SCAFFOLD_LABEL: Record<Scaffold, string> = {
  blank: "✍️ Blank page — no recipe",
  checklist: "✅ The 6-ingredient checklist",
  guided: "🧾 Guided recipe, step by step",
};

const CONFETTI = ["#fddb68", "#6fbbe2", "#fd6338", "#84bc74", "#f4c4cf", "#eb9824"];

function playerMap(players: Player[]) {
  return new Map(players.map((p) => [p.id, p]));
}

const shortUrl = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

/* ---------- Frame: tile wall, header, butcher-block counter ---------- */

export function Frame({ state, joinUrl, children, hideHeader }: { state: PublicState; joinUrl?: string; children: React.ReactNode; hideHeader?: boolean }) {
  const round = state.rounds[state.game.roundIndex];
  const showRound = state.game.phase !== "lobby" && state.game.phase !== "final";
  return (
    <>
      {!hideHeader && (
        <header className="absolute inset-x-0 top-0 z-10 flex h-[124px] items-center justify-between px-14">
          <Logo size="md" />
          <div className="flex items-center gap-4">
            {joinUrl && (
              <div className="font-display text-ink-muted mr-2 text-[24px] font-bold">
                join at <span className="text-link">{shortUrl(joinUrl)}</span>
              </div>
            )}
            {state.game.autopilot && (
              <Chip tv tone="pink">
                🎬 Demo
              </Chip>
            )}
            {showRound && round && (
              <Chip tv tone="alt">
                Round {state.game.roundIndex + 1} · {round.name}
              </Chip>
            )}
            <Chip tv>👩‍🍳 {state.players.length}</Chip>
          </div>
        </header>
      )}
      {children}
      <Counter />
    </>
  );
}

function Counter() {
  return <div aria-hidden className="bg-butcher border-line pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[58px] border-t-[6px]" />;
}

/* ---------- Lobby ---------- */

export function LobbyScreen({ state, joinUrl }: Props) {
  const show = useShow();
  const players = state.players;
  const n = players.length;
  // Shrink the grid as the room fills so ~45 chefs still fit.
  const grid =
    n <= 12
      ? { cols: 4, size: 124, font: 26, max: 12 }
      : n <= 20
        ? { cols: 5, size: 104, font: 23, max: 20 }
        : n <= 30
          ? { cols: 6, size: 86, font: 20, max: 30 }
          : n <= 42
            ? { cols: 7, size: 72, font: 17, max: 42 }
            : { cols: 8, size: 62, font: 15, max: 48 };
  const shown = players.slice(-grid.max);
  return (
    <Frame state={state} hideHeader>
      <div className="absolute inset-0 flex gap-12 px-16 pt-14 pb-[90px]">
        <div className="relative flex w-[860px] shrink-0 flex-col">
          <Logo size="lg" />
          <p className="font-display text-ink mt-6 max-w-[820px] text-[44px] leading-[1.12] font-extrabold tracking-tight">
            {show.tagline}
          </p>
          {(show.lobbyNote || show.hostName) && (
            <p className="text-ink-muted mt-3 text-[28px] font-semibold">
              {show.lobbyNote}
              {show.lobbyNote && show.hostName && " · "}
              {show.hostName && <>Hosted by {show.hostName}</>}
            </p>
          )}

          <div className="mt-9 flex gap-4">
            {[
              ["📱", "Scan & pick a chef"],
              ["✍️", "Cook up an offer"],
              ["🧑‍⚖️", "Get judged live"],
            ].map(([e, t], i) => (
              <motion.div
                key={t}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.12 }}
                className="border-line bg-surface shadow-card flex items-center gap-3 rounded-[20px] border-4 py-3 pr-5 pl-3"
              >
                <span className="border-line bg-goldenrod font-display grid h-11 w-11 shrink-0 place-items-center rounded-full border-4 text-[22px] font-extrabold">
                  {i + 1}
                </span>
                <span className="text-[30px] leading-none">{e}</span>
                <span className="font-display text-[22px] leading-tight font-extrabold">{t}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-auto w-[600px]"
            initial={{ rotate: -2, y: 60, opacity: 0 }}
            animate={{ rotate: -2, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.2 }}
          >
            <Ticket tv label="Scan to join" number="No. 001">
              <div className="flex items-center gap-8">
                <div className="border-line bg-surface-plain shrink-0 rounded-[18px] border-4 p-3">
                  <QRCodeSVG value={joinUrl || "https://example.com"} size={230} bgColor="#ffffff" fgColor="#613301" level="M" />
                </div>
                <div className="min-w-0">
                  <div className="font-sign text-ink text-[62px] leading-[0.95]">Grab your phone!</div>
                  <div className="text-ink-soft mt-4 text-[22px] font-bold">or go to</div>
                  <div className="font-display text-link text-[32px] leading-tight font-extrabold break-all">{shortUrl(joinUrl)}</div>
                </div>
              </div>
            </Ticket>
          </motion.div>
          <Mascot pose="point" className="animate-sway absolute right-[-30px] bottom-[-10px] h-[300px] origin-bottom" />
        </div>

        <div className="border-line bg-surface/95 shadow-tv flex min-w-0 flex-1 flex-col rounded-[30px] border-4 px-10 pt-8 pb-8">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-ticket text-ink-soft text-[22px] font-bold tracking-[0.16em] uppercase">Tonight&apos;s brigade</div>
              <div className="font-sign text-ink text-[64px] leading-none">Chefs in the kitchen</div>
            </div>
            <div className="font-sign text-sticker -mb-1 text-[130px] leading-none tabular-nums">
              <CountUp to={n} duration={0.4} />
            </div>
          </div>
          {n === 0 ? (
            <div className="border-line/30 bg-surface-alt mt-8 grid flex-1 place-items-center rounded-[22px] border-4 border-dashed text-center">
              <div className="flex flex-col items-center">
                <Mascot pose="wave" className="animate-bob h-[300px]" />
                <div className="font-display text-ink-muted mt-4 text-[40px] font-bold">Waiting for chefs… scan the code!</div>
              </div>
            </div>
          ) : (
            <div
              className="mt-5 grid content-start gap-x-4 gap-y-5 overflow-hidden pt-3"
              style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))` }}
            >
              <AnimatePresence>
                {shown.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ scale: 0, rotate: -30, y: 40 }}
                    animate={{ scale: 1, rotate: 0, y: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="animate-bob" style={{ animationDelay: `${-(i % 7) * 0.3}s` }}>
                      <Avatar player={p} size={grid.size} />
                    </div>
                    <div className="font-display line-clamp-1 w-full text-center leading-[1.1] font-bold break-all" style={{ fontSize: grid.font }}>
                      {p.name}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          {n > grid.max && (
            <div className="font-display text-ink-muted mt-auto pt-3 text-center text-[24px] font-bold">+ {n - grid.max} more chefs</div>
          )}
        </div>
      </div>
    </Frame>
  );
}

/* ---------- Round intro ---------- */

export function IntroScreen({ state, joinUrl }: Props) {
  const round = state.rounds[state.game.roundIndex];
  if (!round) return null;
  return (
    <Frame state={state} joinUrl={joinUrl}>
      <div className="absolute inset-0 flex gap-14 px-16 pt-[150px] pb-[90px]">
        <div className="relative flex w-[820px] shrink-0 flex-col">
          <motion.div
            className="absolute top-[150px] right-2"
            initial={{ scale: 0, rotate: 30 }}
            animate={{ scale: 1, rotate: 6 }}
            transition={{ delay: 0.9, type: "spring", stiffness: 140, damping: 11 }}
          >
            <Art src={ROUND_ART[round.scaffold]} className="h-[220px] w-[220px] object-contain" />
          </motion.div>
          <motion.div
            className="font-sign text-sticker inline-block self-start text-[176px] leading-none"
            initial={{ scale: 3, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: -4, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 11 }}
          >
            Round {state.game.roundIndex + 1}
          </motion.div>
          <motion.div
            className="font-sign text-ink mt-4 text-[118px] leading-[0.95]"
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.35, type: "spring" }}
          >
            {round.name}
          </motion.div>
          {round.subtitle && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8">
              <SpeechBubble tv tail="bottom-left" bodyClassName="text-[40px] leading-snug font-bold text-ink-muted">
                {round.subtitle}
              </SpeechBubble>
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-auto flex flex-wrap items-start gap-4"
          >
            <Chip tv tone="lime">
              {SCAFFOLD_LABEL[round.scaffold]}
            </Chip>
            <Chip tv tone="alt">
              ⏱️ {state.game.autopilot ? "Quick demo timer" : `${round.minutes} minutes`}
            </Chip>
          </motion.div>
        </div>
        {round.topic && (
          <div className="relative min-w-0 flex-1">
            <TicketRail className="absolute inset-x-[-20px] top-0" />
            <motion.div
              className="pt-3"
              style={{ transformOrigin: "50% 0" }}
              initial={{ y: -900, rotate: 8 }}
              animate={{ y: 0, rotate: [8, -3, 1.5, 0.5] }}
              transition={{ delay: 0.5, y: { type: "spring", stiffness: 70, damping: 12 }, rotate: { duration: 1.8, ease: "easeOut" } }}
            >
              <TopicCardView topic={round.topic} size="tv" rows={["buyer", "pain", "alternatives"]} number={`R${state.game.roundIndex + 1}`} />
            </motion.div>
          </div>
        )}
      </div>
    </Frame>
  );
}

/* ---------- Writing ---------- */

function KitchenTimer({ endsAt, pausedLeft, serverNow, total }: { endsAt: number | null; pausedLeft: number | null; serverNow: () => number; total: number }) {
  useTick(200);
  const paused = pausedLeft !== null;
  const left = paused ? pausedLeft : endsAt ? endsAt - serverNow() : total;
  const secs = Math.max(0, Math.ceil(left / 1000));
  const frac = Math.max(0, Math.min(1, left / total));
  const lastSecs = useRef(secs);
  useEffect(() => {
    if (secs !== lastSecs.current && !paused) {
      if (secs <= 10 && secs > 0) sfx.tick();
      if (secs === 0 && lastSecs.current > 0) {
        sfx.buzzer();
        setTimeout(() => sfx.bell(3), 500);
      }
    }
    lastSecs.current = secs;
  }, [secs, paused]);
  const R = 168;
  const arc = 2 * Math.PI * (R - 30);
  const hot = secs <= 30;
  const done = secs === 0 && !paused;
  const color = done || hot ? "#fd6338" : frac < 0.5 ? "#eb9824" : "#84bc74";
  return (
    <div className={cx("relative h-[400px] w-[400px]", secs <= 10 && !done && !paused && "animate-shake")}>
      <svg viewBox="0 0 400 400" className="absolute inset-0 overflow-visible">
        <defs>
          <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6f8fa" />
            <stop offset="0.55" stopColor="#d3d9e0" />
            <stop offset="1" stopColor="#aeb8c3" />
          </linearGradient>
        </defs>
        {/* knob on top, like a wind-up kitchen timer */}
        <rect x="170" y="-6" width="60" height="34" rx="10" fill="url(#steel)" stroke="#613301" strokeWidth="6" />
        <circle cx="200" cy="214" r={R + 14} fill="rgba(97,51,1,0.22)" />
        <circle cx="200" cy="200" r={R + 14} fill="url(#steel)" stroke="#613301" strokeWidth="7" />
        <circle cx="200" cy="200" r={R - 8} fill="#fffdf9" stroke="#613301" strokeWidth="5" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const r1 = R - 14;
          const r2 = i % 5 === 0 ? R - 30 : R - 22;
          return (
            <line
              key={i}
              x1={200 + Math.sin(a) * r1}
              y1={200 - Math.cos(a) * r1}
              x2={200 + Math.sin(a) * r2}
              y2={200 - Math.cos(a) * r2}
              stroke="#613301"
              strokeWidth={i % 5 === 0 ? 4 : 2}
              opacity={0.35}
            />
          );
        })}
        <circle cx="200" cy="200" r={R - 30} fill="none" stroke="#f1e9da" strokeWidth="30" />
        <circle
          cx="200"
          cy="200"
          r={R - 30}
          fill="none"
          stroke={color}
          strokeWidth="30"
          strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={(1 - frac) * arc}
          transform="rotate(-90 200 200)"
          style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.4s" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        {done ? (
          <motion.div className="font-sign text-sunset-orange text-[96px]" animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
            TIME!
          </motion.div>
        ) : (
          <div className="flex flex-col items-center">
            <div className={cx("font-display text-[100px] leading-none font-extrabold tabular-nums", hot ? "text-sunset-orange" : "text-ink")}>
              {formatClock(left)}
            </div>
            {paused && <div className="font-ticket text-ink-soft mt-2 text-[24px] font-bold tracking-[0.2em]">PAUSED</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export function WritingScreen({ state, serverNow, joinUrl }: Props) {
  useTick(1000);
  const round = state.rounds[state.game.roundIndex];
  const entries = state.board[state.game.roundIndex] ?? [];
  const plated = new Set(entries.map((e) => e.playerId));
  const total = state.players.length;
  const totalMs =
    state.game.roundEndsAt && state.game.phaseStartedAt
      ? Math.max(1000, state.game.roundEndsAt - state.game.phaseStartedAt)
      : (round?.minutes ?? 5) * 60_000;
  const left = state.game.pausedLeft ?? (state.game.roundEndsAt ? state.game.roundEndsAt - serverNow() : totalMs);
  const urgent = left < 30_000 && state.game.pausedLeft === null;
  const size = total <= 24 ? 60 : 50;
  return (
    <Frame state={state} joinUrl={joinUrl}>
      <div className="absolute inset-0 flex gap-12 px-14 pt-[150px] pb-[80px]">
        <div className="relative min-w-0 flex-1">
          <TicketRail className="absolute inset-x-[-14px] top-0" />
          {round?.topic && (
            <div className="pt-3" style={{ transform: "rotate(-0.6deg)", transformOrigin: "50% 0" }}>
              <TopicCardView topic={round.topic} size="tv" dense number={`R${state.game.roundIndex + 1}`} />
            </div>
          )}
        </div>
        <div className="flex w-[620px] shrink-0 flex-col items-center">
          <div className="relative">
            <KitchenTimer
              endsAt={state.game.roundEndsAt}
              pausedLeft={state.game.pausedLeft}
              serverNow={serverNow}
              total={totalMs}
            />
            <Mascot pose={urgent ? "shock" : "think"} className="absolute -right-28 bottom-[-20px] h-[220px]" />
          </div>
          <div className="border-line bg-steel shadow-tv mt-8 flex min-h-0 w-full flex-1 flex-col rounded-[26px] border-4 px-7 pt-5 pb-6">
            <div className="flex items-baseline justify-between">
              <span className="font-sign text-ink text-[46px]">The pass</span>
              <span className="font-display text-[64px] leading-none font-extrabold tabular-nums">
                {plated.size}
                <span className="text-ink-soft text-[36px]"> / {total}</span>
              </span>
            </div>
            <Meter tv value={total ? (plated.size / total) * 100 : 0} color="#84bc74" className="mt-3" />
            <div className="mt-5 flex flex-wrap content-start gap-2.5 overflow-hidden">
              {state.players.map((p) => {
                const on = plated.has(p.id);
                return (
                  <div key={p.id} className="relative">
                    <motion.div animate={on ? { scale: [1, 1.35, 1], y: [0, -10, 0] } : {}} transition={{ duration: 0.45 }}>
                      <Avatar player={p} size={size} dim={!on} />
                    </motion.div>
                    {on && (
                      <div className="border-line bg-leaf absolute -right-1 -bottom-1 grid h-6 w-6 place-items-center rounded-full border-[3px] text-xs font-black text-white">
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ---------- Grading ---------- */

export function GradingScreen({ state, joinUrl }: Props) {
  const entries = state.board[state.game.roundIndex] ?? [];
  const graded = entries.filter((e) => e.status !== "submitted").length;
  const total = entries.length;
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % OVEN_LINES.length), 2600);
    return () => clearInterval(t);
  }, []);
  const done = total > 0 && graded === total;
  return (
    <Frame state={state} joinUrl={joinUrl}>
      <div className="absolute inset-0 flex items-center justify-center gap-16 px-20 pt-[120px] pb-[70px]">
        <div className="relative">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="steam absolute top-6 h-28 w-16 rounded-full bg-white/85 blur-lg"
              style={{ left: 150 + i * 70, animationDelay: `${i * 0.6}s` }}
            />
          ))}
          <motion.div animate={{ rotate: [-1.2, 1.2, -1.2] }} transition={{ repeat: Infinity, duration: 0.5 }} className="relative">
            <Art src="/art/oven.webp" className="relative h-[620px] w-auto" />
            {/* the oven window glows */}
            <div
              className="animate-glow pointer-events-none absolute rounded-[40px] mix-blend-screen"
              style={{
                left: "22%",
                top: "47%",
                width: "56%",
                height: "30%",
                background: "radial-gradient(ellipse at 50% 60%, rgba(255,214,90,0.95), rgba(253,99,56,0.35) 60%, transparent 75%)",
              }}
            />
          </motion.div>
        </div>
        <div className="flex w-[820px] flex-col">
          <div className="font-sign text-ink text-[112px] leading-[0.95]">{done ? "Ready to plate! 🍽️" : "In the oven…"}</div>
          <div className="mt-6 h-14">
            <AnimatePresence mode="wait">
              {!done && (
                <motion.div
                  key={line}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="text-ink-muted text-[38px] font-bold"
                >
                  {OVEN_LINES[line]}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="border-line bg-surface shadow-tv mt-10 rounded-[26px] border-4 px-8 py-6">
            <div className="font-display mb-3 flex justify-between text-[32px] font-extrabold">
              <span>🧑‍⚖️ The judge is tasting</span>
              <span className="tabular-nums">
                {graded} / {total}
              </span>
            </div>
            <Meter tv value={total ? (graded / total) * 100 : 0} color="#fddb68" />
          </div>
          <div className="mt-6 flex items-end gap-6">
            <Mascot pose="taste" className="h-[230px]" />
            <SpeechBubble tv tail="left" className="mb-12" bodyClassName="px-8 py-5 text-[30px] font-bold text-ink-muted">
              Mmm… is that a guarantee I taste?
            </SpeechBubble>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ---------- Leaderboard: the chalk specials board ---------- */

function ChalkRow({ entry, player, rank, visible }: { entry: BoardEntry; player: Player; rank: number; visible: boolean }) {
  const tier = useTier(entry.letter!);
  const first = rank === 1;
  return (
    <motion.div
      className={cx("relative flex items-center gap-6", first ? "py-3" : "py-2")}
      initial={false}
      animate={visible ? { clipPath: "inset(0 0% 0 0)", opacity: 1 } : { clipPath: "inset(0 100% 0 0)", opacity: 0 }}
      transition={{ duration: 0.75, ease: [0.3, 0, 0.2, 1] }}
    >
      <div className={cx("font-chalk chalk w-14 text-center leading-none", first ? "text-[84px]" : "text-[64px]")} style={first ? { color: "#fddb68" } : undefined}>
        {rank}
      </div>
      <Avatar player={player} size={first ? 104 : 78} />
      <div className={cx("font-chalk chalk min-w-0 truncate leading-none", first ? "text-[80px]" : "text-[60px]")}>{player.name}</div>
      <div className="mx-2 h-0 min-w-10 flex-1 border-b-[5px] border-dotted border-white/35" />
      <div className={cx("font-chalk leading-none tabular-nums", first ? "text-[96px]" : "text-[70px]")} style={{ color: tier.color }}>
        {visible ? <CountUp to={entry.overall!} duration={0.9} /> : 0}
      </div>
      <div
        className={cx("font-chalk grid shrink-0 place-items-center rounded-full border-[4px] leading-none", first ? "h-[84px] w-[84px] text-[54px]" : "h-[66px] w-[66px] text-[42px]")}
        style={{ color: tier.color, borderColor: tier.color }}
        title={tier.name}
      >
        {entry.letter}
      </div>
      {first && visible && <div className="absolute -top-14 left-[60px] rotate-[-14deg] text-[72px]">👑</div>}
    </motion.div>
  );
}

function ChalkDistribution({ entries }: { entries: BoardEntry[] }) {
  const show = useShow();
  const graded = entries.filter((e) => e.letter);
  const counts = LETTERS.map((l) => graded.filter((e) => e.letter === l).length);
  const max = Math.max(1, ...counts);
  const avg = graded.length ? Math.round(graded.reduce((s, e) => s + (e.overall ?? 0), 0) / graded.length) : 0;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <div className="font-chalk chalk text-[56px] leading-none">The whole room</div>
        <div className="font-chalk chalk text-[36px]">
          avg{" "}
          <span className="text-[76px] tabular-nums" style={{ color: scoreColor(avg) }}>
            <CountUp to={avg} />
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-1 items-end gap-5 border-b-[4px] border-white/50 pb-0">
        {LETTERS.map((l, i) => (
          <div key={l} className="flex h-full flex-1 flex-col items-center justify-end">
            <div className="font-chalk chalk mb-1 text-[48px] leading-none tabular-nums">{counts[i]}</div>
            <motion.div
              className="w-full rounded-t-[10px] border-[4px] border-b-0 border-white/70"
              style={{ background: GRADE_TIERS[l].color, opacity: 0.88 }}
              initial={{ height: 0 }}
              animate={{ height: `${(counts[i] / max) * 72 + 2}%` }}
              transition={{ delay: 0.3 + i * 0.1, type: "spring", stiffness: 60, damping: 12 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-5">
        {LETTERS.map((l) => (
          <div key={l} className="flex flex-1 flex-col items-center">
            <div className="text-[40px] leading-none">{show.tiers[l].emoji}</div>
            <div className="font-chalk chalk mt-1 text-center text-[26px] leading-none">{show.tiers[l].name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeaderboardScreen({ state }: Props) {
  const show = useShow();
  const fire = useConfetti();
  const round = state.game.roundIndex;
  const entries = state.board[round] ?? [];
  const pm = playerMap(state.players);
  const top = entries.filter((e) => e.overall !== undefined && pm.has(e.playerId)).slice(0, show.leaderboardSize);
  const [shown, setShown] = useState(0);
  const gap = REVEAL_GAP_MS[show.revealPace];

  useEffect(() => {
    if (!top.length) return;
    sfx.drumroll((top.length * gap) / 1000);
    const timers = top.map((_, i) =>
      setTimeout(() => {
        setShown(i + 1);
        const rank = top.length - i;
        sfx.rowReveal(rank);
        if (rank === 1) {
          sfx.ding();
          fire({ particleCount: 200, spread: 110, origin: { x: 0.35, y: 0.35 }, colors: CONFETTI });
        }
      }, 900 + (i + 1) * gap),
    );
    return () => timers.forEach(clearTimeout);
    // Re-run only when the set of top players changes, not on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, top.map((e) => e.playerId).join()]);

  const allIn = shown >= top.length && top.length > 0;
  const big = top.length <= 5;
  return (
    <Frame state={state}>
      <div className="absolute inset-0 px-12 pt-[136px] pb-[84px]">
        <Chalkboard className="h-full" bodyClassName="flex gap-14 px-14 pt-9 pb-10">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-baseline gap-6">
              <div className="font-chalk chalk text-[104px] leading-none">Today&apos;s Specials</div>
              <div className="font-chalk text-goldenrod text-[48px] leading-none">
                Round {round + 1} · {state.rounds[round]?.name}
              </div>
            </div>
            <div className="mt-1 h-[6px] w-[540px] rounded-full bg-white/40" />
            <div className={cx("mt-6 flex flex-1 flex-col", big ? "justify-center gap-3" : "justify-start gap-0")}>
              {top.length === 0 && <div className="font-chalk chalk text-center text-[64px]">No plates graded yet…</div>}
              {top.map((e, i) => {
                const revealIndex = top.length - 1 - i; // last place first, #1 last
                return <ChalkRow key={e.playerId} entry={e} player={pm.get(e.playerId)!} rank={i + 1} visible={shown > revealIndex} />;
              })}
            </div>
          </div>
          <div className="relative w-[600px] shrink-0">
            <ChalkDistribution entries={entries} />
          </div>
        </Chalkboard>
        <Mascot pose={allIn ? "kiss" : "think"} className="absolute top-[-8px] left-[1110px] z-10 h-[170px]" />
      </div>
    </Frame>
  );
}

/* ---------- Spotlight: order up! ---------- */

function offerFontSize(len: number) {
  if (len < 260) return 42;
  if (len < 480) return 34;
  if (len < 760) return 29;
  if (len < 1100) return 24;
  return 20;
}

export function SpotlightScreen({ state }: Props) {
  const s = state.spotlight;
  const fire = useConfetti();
  useEffect(() => {
    sfx.bell(2);
    if (s?.grade && s.grade.overall >= 90) {
      setTimeout(() => fire({ particleCount: 140, spread: 90, origin: { x: 0.2, y: 0.25 }, colors: CONFETTI }), 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.player.id]);
  if (!s) return null;
  const { player, submission, grade } = s;
  const fs = offerFontSize(submission.text.length);
  return (
    <Frame state={state}>
      <div className="absolute inset-0 flex gap-10 px-14 pt-[140px] pb-[86px]">
        <div className="flex min-w-0 flex-1 flex-col">
          <motion.div className="flex items-center gap-6" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <Avatar player={player} size={120} />
            <div className="min-w-0 flex-1">
              <div className="font-ticket text-ink-soft text-[22px] font-bold tracking-[0.18em] uppercase">🛎️ Order up!</div>
              <div className="font-sign text-ink truncate text-[84px] leading-[0.95]">{player.name}</div>
            </div>
          </motion.div>
          <motion.div
            className="relative mt-6 min-h-0 flex-1"
            initial={{ rotate: -3, x: -60, opacity: 0 }}
            animate={{ rotate: -0.6, x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 90, damping: 14 }}
          >
            <Ticket tv label="The offer" number={`R${state.game.roundIndex + 1}`} className="h-full" bodyClassName="relative overflow-hidden">
              {submission.fields ? (
                <div className="flex flex-col gap-2.5" style={{ fontSize: Math.min(fs, 28) }}>
                  {(["pitch", "promise", "difference", "price", "guarantee", "delivery"] as const).map((id) => {
                    const v = submission.fields?.[id];
                    if (!v) return null;
                    return (
                      <div key={id} className="leading-snug">
                        <span className="font-display text-ink-muted font-extrabold">
                          {CRITERIA[id].emoji} {CRITERIA[id].short}:{" "}
                        </span>
                        <span className="font-literal">{v}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="font-literal leading-snug whitespace-pre-wrap" style={{ fontSize: fs }}>
                  {submission.text}
                </p>
              )}
              <div className="from-ticket absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent" />
            </Ticket>
            {grade && <Stamp letter={grade.letter} size={46} delay={0.7} className="absolute -top-4 right-8 z-20" />}
          </motion.div>
          {grade && (
            <div className="mt-6 grid shrink-0 grid-cols-2 gap-6">
              <div className="border-line bg-leaf/90 shadow-card rounded-[22px] border-4 px-6 py-4">
                <div className="font-ticket text-ink/70 text-[18px] font-bold tracking-[0.14em] uppercase">💪 What&apos;s working</div>
                <div className="mt-1 line-clamp-3 text-[24px] leading-snug font-semibold">{grade.strength}</div>
              </div>
              <div className="border-line bg-goldenrod shadow-card rounded-[22px] border-4 px-6 py-4">
                <div className="font-ticket text-ink/70 text-[18px] font-bold tracking-[0.14em] uppercase">🎯 Next move</div>
                <div className="mt-1 line-clamp-3 text-[24px] leading-snug font-semibold">{grade.nextMove}</div>
              </div>
            </div>
          )}
        </div>
        <motion.div
          className="flex w-[700px] shrink-0 flex-col justify-center"
          initial={{ x: 120, rotate: 6, opacity: 0 }}
          animate={{ x: 0, rotate: 1.2, opacity: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 90, damping: 14 }}
        >
          {grade ? (
            <OfferFacts grade={grade} tv delay={0.5} className="shadow-tv" />
          ) : (
            <div className="flex flex-col items-center">
              <Mascot pose="taste" className="h-[320px]" />
              <div className="font-sign text-ink-muted mt-4 text-[54px]">Still in the oven…</div>
            </div>
          )}
        </motion.div>
      </div>
    </Frame>
  );
}

/* ---------- Final: the Golden Spatula ---------- */

export function FinalScreen({ state }: Props) {
  const fire = useConfetti();
  const pm = playerMap(state.players);
  const lastRound = state.rounds.length - 1;

  const { podium, glow, avgs } = useMemo(() => {
    const scoreIn = (r: number) =>
      new Map((state.board[r] ?? []).filter((e) => e.overall !== undefined).map((e) => [e.playerId, e.overall!]));
    const last = scoreIn(lastRound);
    const first = scoreIn(0);
    const podium = [...last.entries()]
      .filter(([id]) => pm.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, score]) => ({ player: pm.get(id)!, score }));
    let glow: { player: Player; from: number; to: number } | null = null;
    for (const [id, to] of last) {
      const from = first.get(id);
      if (from === undefined || !pm.has(id) || lastRound === 0) continue;
      if (!glow || to - from > glow.to - glow.from) glow = { player: pm.get(id)!, from, to };
    }
    const avgs = state.rounds.map((_, r) => {
      const xs = [...scoreIn(r).values()];
      return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
    });
    return { podium, glow, avgs };
  }, [state.board, state.rounds, lastRound, pm]);

  useEffect(() => {
    sfx.fanfare();
    const burst = () => {
      fire({ particleCount: 120, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: CONFETTI });
      fire({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: CONFETTI });
    };
    const first = setTimeout(burst, 2200);
    const t = setInterval(burst, 4500);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [fire]);

  const order = [1, 0, 2]; // 2nd, 1st, 3rd
  const heights = [250, 340, 190];
  const medal = ["🥇", "🥈", "🥉"];
  const winner = podium[0];
  return (
    <Frame state={state}>
      <div className="absolute inset-0 flex gap-12 px-14 pt-[132px] pb-[58px]">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="font-display text-ink-muted text-[38px] font-extrabold">And the Golden Spatula goes to…</div>
          <motion.div
            className="font-sign text-sticker mt-1 truncate text-[120px] leading-[1.02]"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.6, type: "spring", stiffness: 140, damping: 12 }}
          >
            {winner ? winner.player.name : "Everyone!"}
          </motion.div>
          <div className="flex flex-1 items-end justify-center gap-7">
            {order.map((idx, col) => {
              const entry = podium[idx];
              if (!entry) return <div key={col} className="w-[290px]" />;
              return (
                <motion.div
                  key={entry.player.id}
                  className="flex w-[290px] flex-col items-center"
                  initial={{ y: 500 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.3 + (2 - idx) * 0.45, type: "spring", stiffness: 70, damping: 12 }}
                >
                  <div className="animate-bob relative">
                    <Avatar player={entry.player} size={idx === 0 ? 150 : 116} />
                    {idx === 0 && <div className="absolute -top-16 left-1/2 -translate-x-1/2 rotate-[-8deg] text-[80px]">👑</div>}
                  </div>
                  <div className="font-display mt-3 max-w-full truncate text-[38px] font-extrabold tracking-tight">{entry.player.name}</div>
                  <div
                    className="bg-butcher border-line mt-3 flex w-full flex-col items-center rounded-t-[22px] border-4 border-b-0 pt-5 shadow-[inset_0_-30px_40px_rgba(97,51,1,0.25)]"
                    style={{ height: heights[col] }}
                  >
                    <div className="text-[76px] leading-none drop-shadow-[0_4px_0_rgba(97,51,1,0.3)]">{medal[idx]}</div>
                    <div className="font-sign text-sticker-cream mt-2 text-[72px] leading-none tabular-nums">{entry.score}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        <div className="relative flex w-[640px] shrink-0 flex-col gap-6 pb-8">
          <motion.div
            className="relative grid h-[340px] place-items-center"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 1.9, type: "spring", stiffness: 110, damping: 10 }}
          >
            <motion.div
              className="absolute h-[440px] w-[440px] rounded-full opacity-70"
              style={{ background: "repeating-conic-gradient(rgba(253,219,104,0.85) 0 10deg, transparent 10deg 22deg)", maskImage: "radial-gradient(circle, #000 30%, transparent 70%)" }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
            />
            <Art src="/art/trophy.webp" className="relative h-[330px] w-auto" />
            <Mascot pose="cheer" className="absolute -right-6 bottom-[-30px] h-[200px]" />
          </motion.div>
          {glow && glow.to > glow.from && (
            <motion.div
              initial={{ scale: 0, rotate: 10 }}
              animate={{ scale: 1, rotate: 1.5 }}
              transition={{ delay: 2.6, type: "spring", stiffness: 120, damping: 12 }}
              className="border-line bg-azalea shadow-tv rounded-[26px] border-4 px-7 py-5"
            >
              <div className="font-ticket text-ink/70 text-[20px] font-bold tracking-[0.16em] uppercase">🚀 Biggest glow-up</div>
              <div className="mt-2 flex items-center gap-5">
                <Avatar player={glow.player} size={88} />
                <div className="min-w-0">
                  <div className="font-display truncate text-[42px] leading-tight font-extrabold tracking-tight">{glow.player.name}</div>
                  <div className="font-display text-[38px] font-extrabold tabular-nums">
                    {glow.from} → {glow.to} <span style={{ color: GRADE_TIERS.A.text }}>(+{glow.to - glow.from})</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3.1 }}
            className="border-line bg-surface shadow-tv flex min-h-0 flex-1 flex-col rounded-[26px] border-4 px-7 pt-4 pb-5"
          >
            <div className="font-ticket text-ink-soft text-[20px] font-bold tracking-[0.16em] uppercase">The room levelled up</div>
            <div className="mt-2 flex flex-1 items-end gap-6">
              {avgs.map((a, r) => (
                <div key={r} className="flex h-full flex-1 flex-col items-center justify-end">
                  <div className="font-display mb-1 text-[44px] font-extrabold tabular-nums" style={{ color: GRADE_TIERS[a >= 90 ? "A" : a >= 80 ? "B" : a >= 70 ? "C" : a >= 60 ? "D" : "F"].text }}>
                    {a}
                  </div>
                  <motion.div
                    className="border-line w-full rounded-t-[12px] border-4 border-b-0"
                    style={{ background: scoreColor(a) }}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, a) * 0.62}%` }}
                    transition={{ delay: 3.3 + r * 0.3, type: "spring", stiffness: 60 }}
                  />
                  <div className="font-display mt-2 text-[22px] font-bold">{state.rounds[r]?.name}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </Frame>
  );
}
