"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { buttonClass, Chip, Logo, Mascot, ShowProvider } from "@/components/ui";
import { Announcement, ReactionLayer } from "@/components/tv/overlays";
import { Stage } from "@/components/tv/Stage";
import {
  FinalScreen,
  GradingScreen,
  IntroScreen,
  LeaderboardScreen,
  LobbyScreen,
  SpotlightScreen,
  WritingScreen,
} from "@/components/tv/screens";
import { playCue, playMusic, setMuted, setVolumes, sfx, unlockAudio } from "@/lib/client/sound";
import { useOrigin } from "@/lib/client/storage";
import { useGameState } from "@/lib/client/useGame";

/**
 * The big screen.
 * - `full`: the /tv page. One click turns on sound and goes fullscreen.
 * - `embedded`: inside the /demo stage; the parent's click unlocks audio.
 * - `preview`: the host's silent thumbnail in the admin page.
 */
export function TvApp({ mode = "full", started: startedProp }: { mode?: "full" | "embedded" | "preview"; started?: boolean }) {
  const { state, offline, serverNow } = useGameState({ interval: mode === "preview" ? 1500 : 1000 });
  const [clicked, setClicked] = useState(false);
  const origin = useOrigin();
  const audible = mode !== "preview";
  const started = mode === "full" ? clicked : mode === "embedded" ? Boolean(startedProp) : false;

  const phase = state?.game.phase;
  const round = state?.game.roundIndex ?? 0;
  const show = state?.show;

  // Music follows the phase; the host can mute or set levels from the admin page.
  useEffect(() => {
    if (!started) return;
    setMuted(Boolean(state?.game.muted));
  }, [started, state?.game.muted]);
  useEffect(() => {
    if (!started || !show) return;
    setVolumes(show.musicVolume, show.sfxVolume);
  }, [started, show?.musicVolume, show?.sfxVolume, show]);
  useEffect(() => {
    if (!started) return;
    playMusic(phase === "lobby" ? "lobby" : phase === "writing" ? "cooking" : null);
  }, [started, phase]);
  useEffect(() => () => playMusic(null), []);

  // Soundboard cues fired from the admin page.
  const lastCue = useRef<number | null>(null);
  useEffect(() => {
    const cue = state?.game.cue;
    if (!cue) return;
    if (lastCue.current === null) {
      lastCue.current = cue.at; // don't replay an old cue on load
      return;
    }
    if (cue.at !== lastCue.current) {
      lastCue.current = cue.at;
      if (started) playCue(cue.id);
    }
  }, [state?.game.cue, started]);

  // Sound cues from state changes.
  const prev = useRef<{ players: number; plated: number; graded: number; key: string } | null>(null);
  useEffect(() => {
    if (!state || !started) return;
    const entries = state.board[round] ?? [];
    const cur = {
      players: state.players.length,
      plated: entries.length,
      graded: entries.filter((e) => e.status === "graded").length,
      key: `${phase}:${round}`,
    };
    const p = prev.current;
    if (p) {
      if (cur.key !== p.key) {
        if (phase === "intro") sfx.bell(2);
        else if (phase !== "leaderboard" && phase !== "final" && phase !== "spotlight") sfx.whoosh();
      } else {
        if (cur.players > p.players) sfx.pop();
        if (phase === "writing" && cur.plated > p.plated) sfx.sizzle();
        if (phase === "grading" && cur.graded > p.graded) sfx.pop();
      }
    }
    prev.current = cur;
  }, [state, started, phase, round]);

  const joinUrl = state?.joinUrl || origin || "";

  const start = () => {
    unlockAudio();
    setClicked(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const props = state ? { state, serverNow, joinUrl } : null;

  return (
    <Stage fit={mode === "full" ? "window" : "parent"} allowConfetti={mode !== "preview" && (show?.confetti ?? true)}>
      {state && props && (
        <ShowProvider value={state.show}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${phase}:${round}:${state.spotlight?.player.id ?? ""}`}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35 }}
            >
              {phase === "lobby" && <LobbyScreen {...props} />}
              {phase === "intro" && <IntroScreen {...props} />}
              {phase === "writing" && <WritingScreen {...props} />}
              {phase === "grading" && <GradingScreen {...props} />}
              {phase === "leaderboard" && <LeaderboardScreen {...props} />}
              {phase === "spotlight" && <SpotlightScreen {...props} />}
              {phase === "final" && <FinalScreen {...props} />}
            </motion.div>
          </AnimatePresence>
          {state.show.reactions && <ReactionLayer counts={state.reactions} sound={audible && started} />}
          <Announcement announcement={state.game.announcement} serverNow={serverNow} sound={audible && started} />
        </ShowProvider>
      )}

      {offline && (
        <div className="absolute top-6 left-1/2 z-50 -translate-x-1/2">
          <Chip tv tone="orange">
            Reconnecting…
          </Chip>
        </div>
      )}

      {mode === "full" && !clicked && (
        <button onClick={start} className="bg-tiles absolute inset-0 z-40 grid cursor-pointer place-items-center">
          <div className="flex items-center gap-24">
            <Mascot pose="wave" className="animate-sway h-[560px]" />
            <div className="flex flex-col items-start gap-10">
              <Logo size="xl" title={state?.show.title} />
              <div className={buttonClass("primary", "xl", "px-14 py-7 text-[52px]")}>🔊 Open the kitchen</div>
              <div className="text-ink-muted text-[28px] font-semibold">Click once to turn on sound and go fullscreen</div>
            </div>
          </div>
        </button>
      )}
    </Stage>
  );
}
