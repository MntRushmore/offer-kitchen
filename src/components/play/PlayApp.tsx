"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { readStorage, useQueryParam, useStoredValue, writeStorage } from "@/lib/client/storage";
import { formatClock, useGameState, useTick } from "@/lib/client/useGame";
import { AVATARS, avatarSrc, CRITERIA, DEFAULT_SHOW, MASCOT, randomChefName, REACTIONS, roundArt } from "@/lib/constants";
import type { CriterionId, Grade, GuidedFields, MeRound, Player, PublicState, RoundView } from "@/lib/types";
import {
  Art,
  Avatar,
  Button,
  CheckMark,
  ChefHat,
  Chip,
  CountUp,
  cx,
  Input,
  Logo,
  Mascot,
  OfferBrief,
  OfferFacts,
  scoreInk,
  ShowProvider,
  SpeechBubble,
  Stamp,
  Textarea,
  TopicFacts,
  useTier,
} from "../ui";
import { KitchenRush } from "./KitchenRush";

const GUIDED_ORDER: CriterionId[] = ["promise", "difference", "price", "guarantee", "delivery", "pitch"];
const REACT_PHASES = ["lobby", "leaderboard", "spotlight", "final"];

/** In a finalists-only round: who's cooking, and whether this phone is just watching. */
function finalsOf(state: PublicState) {
  const { roundIndex } = state.game;
  const n = state.rounds[roundIndex]?.finalists ?? 0;
  if (!n || state.game.phase === "lobby") return null;
  const f = state.game.finalists;
  const ids = f?.round === roundIndex ? f.ids : [];
  const me = state.me?.player.id;
  return { n, ids, watching: !me || !ids.includes(me) };
}
/** Demo-stage phones that join and type on their own. Any other ?seat= is just a separate player slot. */
const SCRIPTED_SEATS = ["a", "b"];

/** `onStale`: called when the stored player no longer exists on the server. */
export default function PlayApp({ onStale }: { onStale?: () => void } = {}) {
  const seat = useQueryParam("seat");
  const scripted = Boolean(seat && SCRIPTED_SEATS.includes(seat));
  const pidKey = seat ? `ok:pid:${seat}` : "ok:pid";
  const [pid, setPid] = useStoredValue(pidKey);
  const ready = pid !== undefined;
  const { state, offline, serverNow, refresh } = useGameState({ pid, interval: 1500, enabled: ready });

  // Our player vanished (kicked, or the host reset the game): back to the join screen.
  const removed = Boolean(pid && state && !state.me);
  useEffect(() => {
    if (removed) onStale?.();
  }, [removed, onStale]);

  const onJoined = useCallback(
    (id: string) => {
      setPid(id);
      void refresh();
    },
    [setPid, refresh],
  );

  const onLeave = useCallback(async () => {
    if (!pid || !confirm("Leave the kitchen? Your offers come off the leaderboard. You can rejoin with a new name.")) return;
    await fetch("/api/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: pid }) }).catch(() => {});
    setPid(null);
  }, [pid, setPid]);

  const onHelp = useCallback(
    async (on: boolean) => {
      if (!pid) return;
      if (!on && !confirm("Cancel your help request?")) return;
      await fetch("/api/help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: pid, on }) }).catch(() => {});
      await refresh();
    },
    [pid, refresh],
  );

  // Demo-stage phones join themselves (and rejoin after the demo restarts).
  const joining = useRef(false);
  useEffect(() => {
    if (!scripted || !ready || joining.current) return;
    if (pid && !removed) return;
    if (pid && !state) return;
    joining.current = true;
    fetch("/api/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seat }) })
      .then((r) => r.json())
      .then((d) => d.player && onJoined(d.player.id))
      .catch(() => {})
      .finally(() => setTimeout(() => (joining.current = false), 1500));
  }, [scripted, seat, ready, pid, removed, state, onJoined]);

  let body: React.ReactNode;
  if (!ready || (pid && !state) || (scripted && !state?.me)) {
    body = (
      <div className="grid flex-1 place-items-center">
        <Mascot pose="wave" className="animate-bob h-48" />
      </div>
    );
  } else if (!pid || !state?.me) {
    body = <JoinScreen onJoined={onJoined} notice={removed ? "The game was reset — jump back in!" : null} />;
  } else {
    body = (
      <>
        {offline && (
          <div className="mx-auto mb-3">
            <Chip tone="orange">Reconnecting…</Chip>
          </div>
        )}
        <PhaseView state={state} serverNow={serverNow} refresh={refresh} seat={seat} />
      </>
    );
  }

  return (
    <ShowProvider value={state?.show ?? DEFAULT_SHOW}>
      <Shell state={state ?? undefined} serverNow={serverNow} onLeave={scripted ? undefined : onLeave} onHelp={scripted ? undefined : onHelp}>
        {body}
      </Shell>
    </ShowProvider>
  );
}

function Shell({
  state,
  serverNow,
  onLeave,
  onHelp,
  children,
}: {
  state?: PublicState;
  serverNow: () => number;
  onLeave?: () => void;
  onHelp?: (on: boolean) => Promise<void>;
  children: React.ReactNode;
}) {
  const me = state?.me?.player;
  const helpAt = state?.me?.helpAt ?? null;
  // The audience of a finalists round cheers while the finalists cook.
  const watching = Boolean(state && finalsOf(state)?.watching && ["intro", "writing", "grading"].includes(state.game.phase));
  const canReact = Boolean(me && state?.show.reactions && (REACT_PHASES.includes(state.game.phase) || watching));
  const [helpBusy, setHelpBusy] = useState(false);
  const help = async (on: boolean) => {
    setHelpBusy(true);
    await onHelp?.(on);
    setHelpBusy(false);
  };
  return (
    <div className="bg-tiles bg-tiles-sm flex min-h-dvh flex-col">
      <header className="border-line bg-surface/95 sticky top-0 z-30 flex items-center gap-2 border-b-[3px] px-3 py-2.5 backdrop-blur">
        <div className="min-w-0 flex-1">
          {/* With the help button and name pill beside it, narrow phones only fit the hat. */}
          <div className={cx(me && "hidden min-[480px]:block")}>
            <Logo size="sm" />
          </div>
          {me && <ChefHat size={30} className="animate-wiggle min-[480px]:hidden" />}
        </div>
        {me && onHelp && (
          <button
            type="button"
            onClick={() => help(!helpAt)}
            disabled={helpBusy}
            className={cx(
              "border-line text-ink shadow-control font-display h-10 shrink-0 rounded-full border-2 px-3.5 text-[15px] font-extrabold active:translate-y-px disabled:opacity-60",
              helpAt ? "bg-goldenrod" : "bg-surface",
            )}
          >
            {helpAt ? "🙋 On the way" : "🙋 Need help?"}
          </button>
        )}
        {me && <NameMenu me={me} onLeave={onLeave} />}
      </header>
      <AnimatePresence>
        {me && helpAt && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="border-line bg-goldenrod shadow-card mx-3 mt-3 flex items-center gap-3 rounded-[16px] border-2 px-3 py-2.5"
          >
            <span className="animate-wiggle text-[30px] leading-none">🙋</span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[17px] leading-tight font-extrabold">An organizer is on the way</div>
              <div className="text-ink text-[15px] leading-snug font-semibold">Raise your hand so they can find you.</div>
            </div>
            {onHelp && (
              <button
                type="button"
                onClick={() => help(false)}
                disabled={helpBusy}
                className="border-line bg-surface font-display h-10 shrink-0 rounded-full border-2 px-3 text-[15px] font-bold"
              >
                Cancel
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {state && <PhoneAnnouncement state={state} serverNow={serverNow} />}
      <main className={cx("mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-5", canReact ? "pb-28" : "pb-10")}>{children}</main>
      <div className="bg-butcher border-line h-8 border-t-4" />
      {canReact && state?.me && <ReactionBar playerId={state.me.player.id} />}
    </div>
  );
}

/** The chef's name pill; tapping it offers Leave, which used to crowd the header. */
function NameMenu({ me, onLeave }: { me: Player; onLeave?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative max-w-[42%] min-w-0">
      <button
        type="button"
        onClick={() => onLeave && setOpen((o) => !o)}
        aria-expanded={open}
        className="border-line bg-goldenrod flex h-10 w-full items-center gap-1.5 rounded-full border-2 pr-3 pl-0.5"
      >
        <Avatar player={me} size={32} />
        <span className="font-display truncate text-[16px] font-extrabold">{me.name}</span>
        {onLeave && <span aria-hidden className="text-[12px]">▼</span>}
      </button>
      {open && onLeave && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="border-line bg-surface shadow-raised absolute top-12 right-0 z-50 w-48 rounded-[14px] border-2 p-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLeave();
              }}
              className="text-sunset-orange font-display w-full rounded-[10px] px-3 py-2.5 text-left text-[16px] font-extrabold hover:bg-surface-alt"
            >
              🚪 Leave the game
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Live extras ---------- */

function PhoneAnnouncement({ state, serverNow }: { state: PublicState; serverNow: () => number }) {
  useTick(1000);
  const a = state.game.announcement;
  const live = a && serverNow() - a.at < 12_000 ? a : null;
  return (
    <AnimatePresence>
      {live && (
        <motion.div
          key={live.at}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          className="border-line bg-goldenrod shadow-card sticky top-[60px] z-20 mx-3 mt-3 flex items-center gap-3 rounded-[16px] border-2 px-3 py-2.5"
        >
          <Art src={MASCOT.point} className="h-12 w-12 shrink-0 -scale-x-100 object-contain" />
          <div className="min-w-0">
            <div className="font-display text-ink-soft text-[14px] font-bold">From the head chef</div>
            <div className="font-display text-[18px] leading-snug font-extrabold">{live.text}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReactionBar({ playerId }: { playerId: string }) {
  const [burst, setBurst] = useState<{ id: number; e: string; x: number }[]>([]);
  const last = useRef(0);
  const seq = useRef(0);
  const send = (e: string, now: number) => {
    if (now - last.current < 300) return;
    last.current = now;
    navigator.vibrate?.(8);
    const id = seq.current++;
    setBurst((b) => [...b.slice(-6), { id, e, x: (Math.random() - 0.5) * 80 }]);
    setTimeout(() => setBurst((b) => b.filter((x) => x.id !== id)), 900);
    void fetch("/api/react", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId, emoji: e }) });
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="border-line bg-surface shadow-raised relative mx-auto flex max-w-md items-center justify-between rounded-[22px] border-2 px-2 py-1.5">
        {burst.map((b) => (
          <motion.span
            key={b.id}
            className="pointer-events-none absolute left-1/2 text-4xl"
            initial={{ y: 0, opacity: 1, scale: 0.6 }}
            animate={{ y: -120, opacity: 0, scale: 1.4, x: b.x }}
            transition={{ duration: 0.9 }}
          >
            {b.e}
          </motion.span>
        ))}
        {REACTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={(ev) => send(e, ev.timeStamp)}
            className="grid h-12 w-12 place-items-center rounded-full text-[28px] transition-transform active:scale-125"
            aria-label={`React ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Join ---------- */

function JoinScreen({ onJoined, notice }: { onJoined: (id: string) => void; notice: string | null }) {
  const [name, setName] = useState("");
  // Only ever rendered on the client (after storage hydrates), so random is safe here.
  const [avatar, setAvatar] = useState(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onJoined(data.player.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join. Try again!");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={join} className="flex flex-col gap-5 pb-24">
      {notice && <div className="border-line bg-goldenrod shadow-card rounded-[14px] border-2 px-4 py-2.5 text-center font-bold">{notice}</div>}

      {/* The chef card previews exactly what the TV will show. */}
      <div className="border-line bg-surface shadow-card relative overflow-hidden rounded-[24px] border-2">
        <div className="bg-sidecar border-line flex items-center justify-between border-b-2 px-4 py-2">
          <span className="font-display text-[15px] font-bold">Kitchen pass</span>
          <span className="font-display text-[15px] font-bold">New chef</span>
        </div>
        <div className="flex items-center gap-4 px-4 py-4">
          <motion.div key={avatar} initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 380, damping: 14 }}>
            <div className="border-line bg-goldenrod grid h-[108px] w-[108px] shrink-0 place-items-center rounded-full border-[3px] shadow-[0_5px_0_rgba(97,51,1,0.22)]">
              <Art src={avatarSrc(avatar)} className="-mt-3 h-[112px] w-[112px] object-contain" />
            </div>
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-ink-soft text-[16px] font-bold">Your chef name</div>
            <div className="mt-1 flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={18}
                placeholder="e.g. Priya"
                className="min-w-0 text-[18px] font-bold"
                aria-label="Your chef name"
              />
              <button
                type="button"
                onClick={() => setName(randomChefName())}
                className="border-line bg-surface-alt shadow-control grid w-12 shrink-0 place-items-center rounded-[12px] border-2 text-2xl active:translate-y-0.5 active:shadow-none"
                aria-label="Random chef name"
              >
                🎲
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <div className="font-sign text-ink text-[28px] leading-none">Pick your chef</div>
          <div className="text-ink-soft text-[15px] font-bold">{AVATARS.length} chefs</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {AVATARS.map((a) => {
            const on = a === avatar;
            return (
              <motion.button
                type="button"
                key={a}
                onClick={() => setAvatar(a)}
                whileTap={{ scale: 0.92 }}
                className={cx(
                  "relative grid aspect-square place-items-center rounded-[22px] border-[3px] p-2 transition-colors duration-150",
                  on ? "border-line bg-goldenrod shadow-[0_5px_0_rgba(97,51,1,0.3)]" : "bg-surface/90 border-line/15 hover:border-line/40",
                )}
                aria-pressed={on}
                aria-label={a}
              >
                <Art src={avatarSrc(a)} className={cx("h-full w-full object-contain transition-transform duration-200", on && "scale-110 -rotate-3")} />
                {on && (
                  <span className="border-line bg-leaf absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full border-2 text-sm font-black text-white">
                    ✓
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {error && <div className="border-sunset-orange bg-surface text-sunset-orange rounded-[12px] border-2 px-3 py-2 text-center font-bold">{error}</div>}

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#efe8db] via-[#efe8db]/90 to-transparent px-4 pt-6 pb-[max(env(safe-area-inset-bottom),14px)]">
        <div className="mx-auto max-w-md">
          <Button type="submit" size="xl" disabled={busy || !name.trim()} className="w-full">
            {busy ? "Joining…" : name.trim() ? `Let's cook, ${name.trim().split(" ")[0]}! 🍳` : "Type a chef name ☝️"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ---------- Phase router ---------- */

function PhaseView({ state, serverNow, refresh, seat }: { state: PublicState; serverNow: () => number; refresh: () => Promise<void>; seat: string | null }) {
  const { phase, roundIndex } = state.game;
  const me = state.me!;
  const round = state.rounds[roundIndex];
  const mine = me.rounds[roundIndex];
  const prevGrade = roundIndex > 0 ? me.rounds[roundIndex - 1]?.grade : null;

  const key = `${phase}:${roundIndex}`;
  // A new screen starts at the top, not wherever the last one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [key]);
  const finals = finalsOf(state);
  // Someone the host dropped from the final after they plated still gets their result.
  const audience = Boolean(finals?.watching && !mine?.submission);
  let body: React.ReactNode;
  if (phase === "lobby") body = <LobbyWait state={state} />;
  else if (phase === "intro")
    body = finals ? <FinalsIntro state={state} prevGrade={prevGrade} /> : <IntroWait round={round} index={roundIndex} prevGrade={prevGrade} />;
  else if (phase === "writing")
    body = audience ? (
      <Audience state={state} serverNow={serverNow} />
    ) : (
      <WriteScreen state={state} round={round} index={roundIndex} mine={mine} serverNow={serverNow} refresh={refresh} prevGrade={prevGrade} seat={seat} />
    );
  else if (phase === "final") body = <Journey state={state} />;
  else if (audience) body = <Audience state={state} serverNow={serverNow} />;
  else body = <AfterLock mine={mine} revealed={state.scoresRevealed[roundIndex]} finals={Boolean(finals)} />;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -24 }}
        transition={{ duration: 0.25 }}
        className="flex flex-1 flex-col"
      >
        {body}
      </motion.div>
    </AnimatePresence>
  );
}

function LobbyWait({ state }: { state: PublicState }) {
  const me = state.me!.player;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="animate-bob"
      >
        <Avatar player={me} size={150} />
      </motion.div>
      <div>
        <div className="font-display text-ink-soft text-[17px] font-bold">You&apos;re on the line</div>
        <h1 className="font-sign text-ink mt-1 text-[40px] leading-[0.95]">Welcome, {me.name}!</h1>
      </div>
      <div className="border-line bg-surface shadow-card flex items-center gap-3 rounded-full border-2 py-1.5 pr-4 pl-1.5">
        <div className="flex -space-x-3">
          {state.players.slice(-4).map((p) => (
            <Avatar key={p.id} player={p} size={30} />
          ))}
        </div>
        <span className="font-display font-extrabold">
          {state.players.length} {state.players.length === 1 ? "chef" : "chefs"} in the kitchen
        </span>
      </div>
      <div className="mt-2 flex w-full items-end gap-2">
        <Mascot pose="wave" className="h-32 shrink-0" />
        <SpeechBubble tail="left" className="mb-8 flex-1" bodyClassName="px-4 py-3 text-left">
          <p className="text-ink-muted text-[17px] leading-snug font-semibold">Eyes on the TV! Round 1 is a blank page — just write the offer you&apos;d actually say.</p>
        </SpeechBubble>
      </div>
      {state.show.reactions && <p className="text-ink-soft text-[15px] font-bold">Tap the emojis below — they fly up on the TV 👇</p>}
      <KitchenRush className="mt-2 w-full text-left" />
    </div>
  );
}

function NextMoveCallout({ grade }: { grade: Grade }) {
  return (
    <div className="border-line bg-goldenrod shadow-card rounded-[18px] border-2 px-4 py-3">
      <div className="font-display text-ink-soft text-[15px] font-bold">🎯 Your next move from last round</div>
      <p className="mt-1 text-[17px] leading-snug font-bold">{grade.nextMove}</p>
    </div>
  );
}

function IntroWait({ round, index, prevGrade }: { round: RoundView; index: number; prevGrade: Grade | null | undefined }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="relative mt-1 flex flex-col items-center text-center">
        <Art src={roundArt(round)} className="absolute -top-2 -right-1 h-20 w-20 rotate-6 object-contain" />
        <div className="font-sign text-sticker text-[54px] leading-none">Round {index + 1}</div>
        <h1 className="font-sign text-ink mt-1 text-[36px] leading-none">{round.name}</h1>
        <p className="text-ink-muted mt-2 text-[17px] font-semibold">{round.subtitle}</p>
      </div>
      {round.topic && <OfferBrief topic={round.topic} />}
      {prevGrade && <NextMoveCallout grade={prevGrade} />}
      <div className="font-display text-ink-muted animate-pulse text-center text-xl font-bold">The kitchen opens in a sec…</div>
    </div>
  );
}

/* ---------- Finals ---------- */

function FinalsIntro({ state, prevGrade }: { state: PublicState; prevGrade: Grade | null | undefined }) {
  const { roundIndex } = state.game;
  const round = state.rounds[roundIndex];
  const finals = finalsOf(state)!;
  return (
    <div className="flex flex-col gap-5">
      <div className="relative mt-1 flex flex-col items-center text-center">
        <Art src={roundArt(round)} className="absolute -top-2 -right-1 h-20 w-20 rotate-6 object-contain" />
        <div className="font-sign text-sticker text-[54px] leading-none">Round {roundIndex + 1}</div>
        <h1 className="font-sign text-ink mt-1 text-[36px] leading-none">{round.name}</h1>
      </div>
      {finals.watching ? (
        <>
          <div className="border-line bg-azalea shadow-card rounded-[20px] border-2 px-4 py-4 text-center">
            <div className="font-display text-[22px] font-extrabold">🍿 You&apos;re in the audience</div>
            <p className="text-ink mt-1 text-[17px] leading-snug font-semibold">
              The top {finals.n} chefs cook one last offer. Watch the TV and cheer them on!
            </p>
          </div>
          <FinalistList state={state} />
          <KitchenRush />
        </>
      ) : (
        <>
          <motion.div
            initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: -2, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 12 }}
            className="border-line bg-goldenrod shadow-card rounded-[20px] border-2 px-4 py-4 text-center"
          >
            <div className="font-sign text-[34px] leading-none">🏆 You made the final!</div>
            <p className="text-ink mt-2 text-[17px] leading-snug font-semibold">One blank page. Show everything you&apos;ve learned.</p>
          </motion.div>
          {round.topic && <OfferBrief topic={round.topic} />}
          {prevGrade && <NextMoveCallout grade={prevGrade} />}
          <div className="font-display text-ink-muted animate-pulse text-center text-xl font-bold">The kitchen opens in a sec…</div>
        </>
      )}
    </div>
  );
}

/** The finalists, with a tick once each has plated. */
function FinalistList({ state }: { state: PublicState }) {
  const finals = finalsOf(state);
  const pm = new Map(state.players.map((p) => [p.id, p]));
  const plated = new Set((state.board[state.game.roundIndex] ?? []).map((e) => e.playerId));
  const players = (finals?.ids ?? []).map((id) => pm.get(id)).filter((p): p is Player => Boolean(p));
  if (!players.length) return null;
  return (
    <div className="border-line bg-surface shadow-card rounded-[20px] border-2 p-4">
      <div className="font-display text-[18px] font-extrabold">🏆 The finalists</div>
      <div className="mt-3 flex flex-col gap-2.5">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <Avatar player={p} size={40} />
            <span className="font-display min-w-0 flex-1 truncate text-[18px] font-bold">{p.name}</span>
            {state.game.phase === "writing" && (
              <span className={cx("font-display text-[15px] font-bold", plated.has(p.id) ? "text-[#3c7a2c]" : "text-ink-soft")}>
                {plated.has(p.id) ? "✓ Plated" : "Cooking…"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Everyone who isn't in the final: what's happening, who's cooking, and something to do. */
function Audience({ state, serverNow }: { state: PublicState; serverNow: () => number }) {
  useTick(1000);
  const { phase, pausedLeft, roundEndsAt } = state.game;
  const left = pausedLeft ?? (roundEndsAt ? roundEndsAt - serverNow() : null);
  const line =
    phase === "writing"
      ? "The finalists are cooking. Watch the TV and cheer with the emojis below!"
      : phase === "grading"
        ? "The judge is tasting the finalists' offers…"
        : "Eyes on the TV: who takes the Golden Spatula?";
  return (
    <div className="flex flex-col gap-4">
      <div className="border-line bg-azalea shadow-card flex items-center gap-3 rounded-[20px] border-2 px-4 py-3">
        <span className="text-[34px] leading-none">🍿</span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[19px] font-extrabold">Grand Slam final</div>
          <p className="text-ink text-[16px] leading-snug font-semibold">{line}</p>
        </div>
        {phase === "writing" && left !== null && (
          <div className="border-line bg-goldenrod font-display rounded-[12px] border-2 px-2.5 py-0.5 text-[22px] font-extrabold tabular-nums">
            {formatClock(Math.max(0, left))}
          </div>
        )}
      </div>
      {phase !== "leaderboard" && phase !== "spotlight" && <FinalistList state={state} />}
      <KitchenRush />
    </div>
  );
}

/* ---------- Writing ---------- */

function ToggleChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={on}
      className={cx(
        "border-line font-display shadow-control rounded-full border-2 px-3.5 py-1.5 text-[15px] font-bold active:translate-y-px",
        on ? "bg-goldenrod" : "bg-surface-plain",
      )}
    >
      {children} <span aria-hidden>{on ? "▲" : "▼"}</span>
    </button>
  );
}

type Draft = { text: string; fields: GuidedFields };

function WriteScreen({
  state,
  round,
  index,
  mine,
  serverNow,
  refresh,
  prevGrade,
  seat,
}: {
  state: PublicState;
  round: RoundView;
  index: number;
  mine: MeRound;
  serverNow: () => number;
  refresh: () => Promise<void>;
  prevGrade: Grade | null | undefined;
  seat: string | null;
}) {
  useTick(500);
  const draftKey = `ok:draft:${seat ?? "me"}:${state.game.id}:${index}`;
  const guided = round.scaffold === "guided";
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = readStorage(draftKey);
    if (saved) {
      try {
        return JSON.parse(saved) as Draft;
      } catch {}
    }
    return { text: mine.submission?.text ?? "", fields: mine.submission?.fields ?? {} };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState<"details" | "tips" | null>(null);
  const [checked, setChecked] = useState<Set<CriterionId>>(new Set());

  useEffect(() => writeStorage(draftKey, JSON.stringify(draft)), [draft, draftKey]);

  const submitted = mine.submission;
  // The server trims each box, so compare trimmed boxes: a stray space or newline isn't an unsaved change.
  const asSaved = (fields: GuidedFields | null | undefined) => GUIDED_ORDER.map((id) => fields?.[id]?.trim() ?? "").join("|");
  const draftText = guided ? asSaved(draft.fields) : draft.text.trim();
  const submittedText = submitted ? (guided ? asSaved(submitted.fields) : submitted.text.trim()) : null;
  const empty = guided ? GUIDED_ORDER.every((id) => !draft.fields[id]?.trim()) : !draft.text.trim();
  const dirty = submittedText === null || draftText !== submittedText;
  const editing = useEditingField();

  const paused = state.game.pausedLeft !== null;
  const left = paused ? state.game.pausedLeft : state.game.roundEndsAt ? state.game.roundEndsAt - serverNow() : null;
  const timeUp = !paused && left !== null && left <= 0;

  const plate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: state.me!.player.id,
          round: index,
          text: guided ? undefined : draft.text,
          fields: guided ? draft.fields : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      navigator.vibrate?.([10, 40, 10]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't plate it. Try again!");
    } finally {
      setBusy(false);
    }
  }, [draft, guided, index, refresh, state.me]);

  // When the timer hits zero, plate whatever is on the cutting board.
  const autoPlated = useRef(false);
  useEffect(() => {
    if (timeUp && !autoPlated.current && !empty && dirty && !busy) {
      autoPlated.current = true;
      void plate();
    }
  }, [timeUp, empty, dirty, busy, plate]);

  // Demo-stage phones type their scripted offer live, then plate it.
  const script = state.me?.script;
  const typing = Boolean(seat && script && !submitted);
  const typed = useRef(false);
  const plateRef = useRef(plate);
  const stopTyping = useRef(false);
  // StrictMode remounts in dev, so re-arm on mount rather than trusting the first value.
  useEffect(() => {
    stopTyping.current = false;
    return () => {
      stopTyping.current = true;
    };
  }, []);
  useEffect(() => {
    plateRef.current = plate;
    // The server may plate a slow demo phone itself; stop typing over it.
    if (submitted) stopTyping.current = true;
  }, [plate, submitted]);
  const [typedDone, setTypedDone] = useState(false);
  useEffect(() => {
    // Runs once per round; a poll that briefly lacks the script must not cancel it.
    if (!typing || typed.current || !script) return;
    typed.current = true;
    const parts: [CriterionId | "text", string][] = script.fields
      ? GUIDED_ORDER.map((id) => [id, script.fields?.[id] ?? ""] as [CriterionId, string])
      : [["text", script.text]];
    const total = parts.reduce((s, [, v]) => s + v.length, 0);
    const budget = Math.min(24_000, Math.max(7000, (left ?? 40_000) * 0.5));
    const perTick = Math.max(1, Math.ceil(total / (budget / 45)));
    const ids = Object.keys(CRITERIA) as CriterionId[];
    let part = 0;
    let pos = 0;
    const step = () => {
      if (stopTyping.current) return;
      const [id, full] = parts[part];
      if (pos === 0) document.getElementById(`field-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      pos = Math.min(full.length, pos + perTick);
      const slice = full.slice(0, pos);
      setDraft((d) => (id === "text" ? { ...d, text: slice } : { ...d, fields: { ...d.fields, [id]: slice } }));
      if (id === "text") setChecked(new Set(ids.slice(0, Math.floor((pos / Math.max(1, full.length)) * ids.length))));
      if (pos >= full.length) {
        part++;
        pos = 0;
        if (part >= parts.length) {
          setTypedDone(true);
          return;
        }
      }
      setTimeout(step, 45);
    };
    setTimeout(step, 2200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing]);
  // Plate once the typed draft has rendered, so the submit carries all of it.
  useEffect(() => {
    if (!typedDone || stopTyping.current) return;
    const t = setTimeout(() => void plateRef.current(), 900);
    return () => clearTimeout(t);
  }, [typedDone]);

  const words = (guided ? Object.values(draft.fields).join(" ") : draft.text).trim().split(/\s+/).filter(Boolean).length;
  const hot = left !== null && left < 30_000 && !paused;

  const clock = timeUp ? "TIME!" : left !== null ? `${paused ? "⏸ " : ""}${formatClock(left)}` : "--:--";
  const plateLabel = busy ? "Plating…" : submitted ? (dirty ? "Update my plate ✏️" : "✓ Plated") : "Plate it! 🛎️";

  return (
    <div className="flex flex-col gap-4">
      {editing && !typing && (
        <TypingBar clock={clock} hot={hot} label={plateLabel} canPlate={!busy && !empty && dirty} onPlate={plate} />
      )}
      <div
        className={cx(
          "border-line bg-surface shadow-card sticky top-[64px] z-20 flex items-center justify-between gap-3 rounded-[16px] border-2 py-1.5 pr-1.5 pl-4",
          // The typing bar stands in for it while the keyboard is up; keep its space so nothing jumps.
          editing && !typing && "invisible",
        )}
      >
        <div className="font-display min-w-0 truncate text-[18px] font-extrabold">
          Round {index + 1} <span className="text-ink-soft">·</span> {round.name}
        </div>
        <div
          className={cx(
            "border-line font-display rounded-[12px] border-2 px-3 py-0.5 text-[26px] font-extrabold tabular-nums",
            hot ? "bg-sunset-orange animate-pulse text-white" : paused ? "bg-steel" : "bg-goldenrod",
          )}
        >
          {clock}
        </div>
      </div>

      {typing && <div className="border-line bg-azalea rounded-[14px] border-2 px-3 py-2 text-center text-[15px] font-bold">🎬 Demo phone — typing its offer live</div>}

      {round.topic && (
        <OfferBrief topic={round.topic}>
          <div className="mt-5 flex flex-wrap gap-2">
            <ToggleChip on={more === "details"} onClick={() => setMore((m) => (m === "details" ? null : "details"))}>
              📋 Details
            </ToggleChip>
            {round.tips.length > 0 && (
              <ToggleChip on={more === "tips"} onClick={() => setMore((m) => (m === "tips" ? null : "tips"))}>
                💡 Tips
              </ToggleChip>
            )}
          </div>
          <AnimatePresence initial={false} mode="wait">
            {more && (
              <motion.div
                key={more}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {more === "details" ? (
                  <TopicFacts topic={round.topic} className="border-line/20 mt-4 border-t-2 border-dashed pt-1" />
                ) : (
                  <ul className="border-line/20 mt-4 flex flex-col gap-2.5 border-t-2 border-dashed pt-4">
                    {round.tips.map((tip, i) => (
                      <li key={i} className="text-ink flex gap-2.5 text-[16px] leading-snug">
                        <span aria-hidden>💡</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </OfferBrief>
      )}

      {prevGrade && <NextMoveCallout grade={prevGrade} />}

      {guided ? (
        <div className="flex flex-col gap-4">
          {GUIDED_ORDER.map((id, i) => (
            <div key={id} className="border-line bg-surface shadow-card rounded-[18px] border-2 p-4">
              <label htmlFor={`field-${id}`} className="mb-2.5 flex items-center gap-2">
                <span className="border-line bg-goldenrod font-display grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[15px] font-extrabold">
                  {i + 1}
                </span>
                <span className="font-display text-[19px] leading-tight font-extrabold">
                  {CRITERIA[id].emoji} {CRITERIA[id].label}
                </span>
              </label>
              <Textarea
                value={draft.fields[id] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, fields: { ...d.fields, [id]: e.target.value } }))}
                rows={id === "pitch" ? 2 : 3}
                maxLength={1200}
                placeholder={CRITERIA[id].placeholder}
                readOnly={typing}
                id={`field-${id}`}
                className={cx(GROW, id === "pitch" ? "min-h-20" : "min-h-24")}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="border-line bg-surface shadow-card rounded-[18px] border-2 p-3">
          <label htmlFor="field-text" className="font-display mb-2 block px-1 text-[18px] font-extrabold">
            ✍️ Your offer
          </label>
          <Textarea
            value={draft.text}
            onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
            rows={6}
            maxLength={4000}
            placeholder="Write it like you'd say it to a real customer…"
            readOnly={typing}
            id="field-text"
            className={cx(GROW, "min-h-44")}
          />
        </div>
      )}

      {round.scaffold === "checklist" && (
        <div className="border-line bg-surface shadow-card rounded-[18px] border-2 p-4">
          <div className="font-display text-[18px] font-extrabold">Did you include all six?</div>
          <div className="mt-3 grid gap-2">
            {(Object.keys(CRITERIA) as CriterionId[]).map((id) => {
              const on = checked.has(id);
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() =>
                    setChecked((s) => {
                      const n = new Set(s);
                      if (on) n.delete(id);
                      else n.add(id);
                      return n;
                    })
                  }
                  aria-pressed={on}
                  className={cx(
                    "flex items-center gap-3 rounded-[12px] border-2 px-3 py-2.5 text-left transition-colors",
                    on ? "border-line bg-leaf/25" : "border-line/20 bg-surface-plain",
                  )}
                >
                  <CheckMark on={on} />
                  <span className="text-xl">{CRITERIA[id].emoji}</span>
                  <span className="font-display text-[17px] leading-tight font-bold">{CRITERIA[id].label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}


      <div className="text-caption text-ink-soft -mt-1 flex items-center justify-between px-1 font-bold">
        <span>{words} words</span>
        {submitted && !dirty && <span className="text-[#3c7a2c]">✓ Plated</span>}
        {submitted && dirty && <span className="text-[#b45f0a]">Not saved yet: tap Update</span>}
      </div>

      {error && <div className="border-sunset-orange bg-surface text-sunset-orange rounded-[12px] border-2 px-3 py-2 text-center font-bold">{error}</div>}

      {submitted && !dirty ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="border-line bg-leaf/90 shadow-card flex items-center gap-3 rounded-[18px] border-2 p-3"
        >
          <Art src="/art/cloche.webp" className="h-16 w-16 shrink-0 object-contain" />
          <div>
            <div className="font-sign text-[26px] leading-none">Plated!</div>
            <p className="text-ink mt-1 text-[16px] leading-snug font-semibold">The judge tastes it when the kitchen locks. You can still tweak it until then.</p>
          </div>
        </motion.div>
      ) : (
        <Button variant={submitted ? "brand" : "primary"} size="xl" onClick={plate} disabled={busy || empty || typing} className="w-full">
          {plateLabel}
        </Button>
      )}

      {submitted && !dirty && !typing && <KitchenRush />}
    </div>
  );
}

/** Textareas grow with what's typed (where supported), and focusing one leaves room for the typing bar above it. */
const GROW = "text-[17px] [field-sizing:content] max-h-[60vh] scroll-mt-28 scroll-mb-6";

/** True while a writable text box on the page has focus, i.e. the keyboard is (probably) up. */
function useEditingField() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = document.activeElement;
      setOn(el instanceof HTMLTextAreaElement && !el.readOnly);
    };
    // focusout fires before the next focusin when hopping between boxes; check after both.
    const later = () => setTimeout(check, 0);
    document.addEventListener("focusin", later);
    document.addEventListener("focusout", later);
    return () => {
      document.removeEventListener("focusin", later);
      document.removeEventListener("focusout", later);
    };
  }, []);
  return on;
}

/** How far the visible area has scrolled inside the page; iOS pans it when the keyboard opens. */
function useViewportTop() {
  const [top, setTop] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setTop(vv.offsetTop);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return top;
}

/**
 * While typing, the keyboard hides the Plate button and can push the sticky
 * timer off screen. This bar is pinned to the top of what's actually visible.
 */
function TypingBar({ clock, hot, label, canPlate, onPlate }: { clock: string; hot: boolean; label: string; canPlate: boolean; onPlate: () => void }) {
  const top = useViewportTop();
  return (
    <div
      className="border-line bg-surface fixed inset-x-0 top-0 z-50 flex items-center gap-2 border-b-[3px] px-3 py-2"
      style={{ transform: `translateY(${top}px)` }}
    >
      <div
        className={cx(
          "border-line font-display rounded-[10px] border-2 px-2.5 py-0.5 text-[20px] font-extrabold tabular-nums",
          hot ? "bg-sunset-orange text-white" : "bg-goldenrod",
        )}
      >
        {clock}
      </div>
      <button
        type="button"
        // Keep focus in the box until the tap lands, so the keyboard doesn't drop first.
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
        className="font-display text-link ml-auto h-11 shrink-0 px-2 text-[16px] font-bold"
      >
        Done
      </button>
      <Button size="md" variant="primary" onPointerDown={(e) => e.preventDefault()} onClick={onPlate} disabled={!canPlate} className="h-11 shrink-0 px-4 text-[16px]">
        {label}
      </Button>
    </div>
  );
}

/* ---------- After the kitchen locks ---------- */

function AfterLock({ mine, revealed, finals }: { mine: MeRound; revealed: boolean; finals: boolean }) {
  if (!mine.submission) {
    return (
      <div className="border-line/40 bg-surface/90 flex flex-1 flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed px-6 py-14 text-center">
        <Mascot pose="shock" className="h-40" />
        <div className="font-sign text-[30px] leading-none">No plate this round</div>
        <p className="text-ink-muted text-[17px] font-semibold">Catch the next one — watch the TV for what&apos;s coming.</p>
      </div>
    );
  }
  if (!mine.grade) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <motion.div animate={{ rotate: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 0.5 }}>
          <Art src="/art/oven.webp" className="h-40 object-contain" />
        </motion.div>
        <div className="font-sign text-[40px] leading-none">In the oven…</div>
        <p className="text-ink-muted max-w-xs text-[17px] leading-snug font-semibold">
          {mine.gradeStatus === "done"
            ? "Graded! Your result appears when the TV reveals it. 👀"
            : "The judge is tasting your offer. Your feedback lands here in a moment."}
        </p>
        <KitchenRush className="mt-2 w-full text-left" />
      </div>
    );
  }
  return <ResultCard grade={mine.grade} rank={revealed ? mine.rank : null} of={mine.of} finals={finals} />;
}

function ResultCard({ grade, rank, of, finals }: { grade: Grade; rank: number | null; of: number | null; finals: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 14 }}
        className="border-line bg-surface shadow-card relative overflow-hidden rounded-[24px] border-2 px-5 pt-5 pb-4 text-center"
      >
        <div className="font-display text-ink-soft text-[17px] font-bold">The judge says</div>
        <div className="font-sign text-[104px] leading-none tabular-nums" style={{ color: scoreInk(grade.overall) }}>
          <CountUp to={grade.overall} />
        </div>
        <div className="mt-1 flex justify-center">
          <Stamp letter={grade.letter} size={30} delay={0.9} />
        </div>
        {rank && of && (
          <div className="mt-3">
            <Chip>
              #{rank} of {of} {finals ? "finalists" : "in the room"}
            </Chip>
          </div>
        )}
        <p className="text-ink-muted mt-3 text-[17px] leading-snug font-semibold">{grade.verdict}</p>
        {grade.overall >= 90 && <Mascot pose="kiss" className="absolute top-1 -right-3 h-20" />}
      </motion.div>

      <div className="border-line bg-goldenrod shadow-card rounded-[18px] border-2 px-4 py-3">
        <div className="font-display text-ink-soft text-[15px] font-bold">🎯 Your next move</div>
        <p className="mt-1 text-[17px] leading-snug font-bold">{grade.nextMove}</p>
      </div>
      <div className="border-line bg-leaf/80 shadow-card rounded-[18px] border-2 px-4 py-3">
        <div className="font-display text-ink/75 text-[15px] font-bold">💪 What&apos;s working</div>
        <p className="mt-1 text-[17px] leading-snug font-bold">{grade.strength}</p>
      </div>

      <OfferFacts grade={grade} feedback delay={0.4} className="shadow-card rounded-[6px]" />

      <details className="border-line/30 bg-surface/80 rounded-[14px] border-2 px-4 py-2.5 text-[15px]">
        <summary className="font-display cursor-pointer font-bold">What the judge quoted from your offer</summary>
        <div className="mt-2 flex flex-col gap-1.5">
          {grade.criteria.map((c) => (
            <p key={c.id} className="text-ink-muted leading-snug">
              <b>
                {CRITERIA[c.id].emoji} {CRITERIA[c.id].short}:
              </b>{" "}
              <i>{c.evidence}</i>
            </p>
          ))}
        </div>
      </details>
      {grade.simulated && <p className="text-ink-soft text-center text-[14px]">Rehearsal mode — simulated grade</p>}
    </div>
  );
}

/* ---------- Final ---------- */

function Journey({ state }: { state: PublicState }) {
  const me = state.me!;
  const graded = me.rounds.map((r, i) => ({ r, i })).filter((x) => x.r.grade);
  const first = graded[0]?.r.grade?.overall;
  const last = graded[graded.length - 1]?.r.grade;
  const won = me.rounds[me.rounds.length - 1]?.rank === 1;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center">
        {won ? (
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 140, damping: 10 }}>
            <Art src="/art/trophy.webp" className="h-44 object-contain" />
          </motion.div>
        ) : (
          <Mascot pose="cheer" className="h-40" />
        )}
        <div className="font-sign text-sticker mt-2 text-[40px] leading-none">{won ? "Golden Spatula!" : "That's a wrap!"}</div>
        <p className="text-ink-muted mt-1 text-[17px] font-semibold">{won ? "You cooked the best offer in the room." : "From raw to Grand Slam — here's your journey."}</p>
      </div>
      <div className="border-line bg-surface shadow-card overflow-hidden rounded-[20px] border-2">
        {me.rounds.map((r, i) => (
          <div key={i} className="border-line/15 flex items-center gap-3 border-t px-4 py-3 first:border-t-0">
            <Art src={state.rounds[i] ? roundArt(state.rounds[i]) : ""} className="h-10 w-10 shrink-0 object-contain" />
            <div className="font-display min-w-0 flex-1 truncate text-[18px] font-extrabold">{state.rounds[i]?.name}</div>
            {r.grade ? (
              <>
                <div className="font-sign w-14 text-right text-3xl tabular-nums" style={{ color: scoreInk(r.grade.overall) }}>
                  {r.grade.overall}
                </div>
                <JourneyLetter letter={r.grade.letter} />
              </>
            ) : (
              <div className="text-ink-soft text-[16px] font-semibold">{state.rounds[i]?.finalists ? "🍿 Audience" : "No plate"}</div>
            )}
          </div>
        ))}
      </div>
      {first !== undefined && last && graded.length > 1 && (
        <div className="border-line bg-azalea shadow-card rounded-[18px] border-2 p-4 text-center">
          <div className="font-sign text-[34px] leading-none">{last.overall - first >= 0 ? `+${last.overall - first} points 🚀` : `${last.overall - first} points`}</div>
          <div className="text-ink-muted mt-1 font-semibold">from your first offer to your last</div>
        </div>
      )}
      {last && (
        <div className="border-line bg-goldenrod shadow-card rounded-[18px] border-2 px-4 py-3">
          <div className="font-display text-ink-soft text-[15px] font-bold">🎯 Take this home</div>
          <p className="mt-1 text-[17px] leading-snug font-bold">{last.nextMove}</p>
        </div>
      )}
    </div>
  );
}

function JourneyLetter({ letter }: { letter: Grade["letter"] }) {
  const t = useTier(letter);
  return (
    <span className="border-line font-display grid h-9 w-9 place-items-center rounded-full border-2 font-extrabold" style={{ background: t.color, color: t.ink }} title={t.name}>
      {letter}
    </span>
  );
}
