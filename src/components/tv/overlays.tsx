"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/client/sound";
import { useTick } from "@/lib/client/useGame";
import type { GameState } from "@/lib/types";
import { Mascot } from "../ui";

type Bubble = { id: number; emoji: string; x: number; drift: number; size: number; dur: number };

/** Emoji reactions from phones float up the right edge of the TV. */
export function ReactionLayer({ counts, sound }: { counts: Record<string, number>; sound: boolean }) {
  const prev = useRef<Record<string, number> | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const p = prev.current;
    prev.current = counts;
    if (!p) return;
    const fresh: Bubble[] = [];
    for (const [emoji, n] of Object.entries(counts)) {
      const delta = Math.min(8, n - (p[emoji] ?? 0));
      for (let i = 0; i < delta; i++) {
        fresh.push({
          id: seq.current++,
          emoji,
          x: 1500 + Math.random() * 340,
          drift: (Math.random() - 0.5) * 160,
          size: 70 + Math.random() * 50,
          dur: 2.6 + Math.random() * 1.4,
        });
      }
    }
    if (!fresh.length) return;
    if (sound) sfx.pop();
    // Stagger a burst so a flood of taps reads as a stream, not a clump.
    fresh.slice(0, 18).forEach((b, i) =>
      setTimeout(() => {
        setBubbles((bs) => [...bs.slice(-40), b]);
        setTimeout(() => setBubbles((bs) => bs.filter((x) => x.id !== b.id)), b.dur * 1000 + 100);
      }, i * 140),
    );
  }, [counts, sound]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
      {bubbles.map((b) => (
        <motion.div
          key={b.id}
          className="absolute"
          style={{ left: b.x, top: 1080, fontSize: b.size, lineHeight: 1 }}
          initial={{ y: 0, x: 0, opacity: 0, scale: 0.4, rotate: -10 }}
          animate={{ y: -1000, x: b.drift, opacity: [0, 1, 1, 0], scale: [0.4, 1.1, 1, 0.9], rotate: 10 }}
          transition={{ duration: b.dur, ease: "easeOut", times: [0, 0.15, 0.75, 1] }}
        >
          {b.emoji}
        </motion.div>
      ))}
    </div>
  );
}

const SHOW_MS = 15_000;

/** The host's announcement drops in as a ticket from the head chef. */
export function Announcement({ announcement, serverNow, sound }: { announcement: GameState["announcement"]; serverNow: () => number; sound: boolean }) {
  useTick(1000);
  const live = announcement && serverNow() - announcement.at < SHOW_MS ? announcement : null;
  const lastAt = useRef<number | null>(null);
  useEffect(() => {
    if (!live || live.at === lastAt.current) return;
    if (lastAt.current !== null && sound) sfx.bell(1);
    lastAt.current = live.at;
  }, [live, sound]);

  return (
    <AnimatePresence>
      {live && (
        <motion.div
          key={live.at}
          className="absolute top-8 left-1/2 z-50 flex -translate-x-1/2 items-end"
          initial={{ y: -360, rotate: -4 }}
          animate={{ y: 0, rotate: -1.5 }}
          exit={{ y: -400, opacity: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 15 }}
        >
          <Mascot pose="point" className="relative z-10 -mr-10 h-[230px] -scale-x-100" />
          <div className="bg-goldenrod border-line shadow-tv max-w-[1180px] rounded-[26px] border-4 px-12 py-7">
            <div className="font-ticket text-ink/70 text-[22px] font-bold tracking-[0.18em] uppercase">From the head chef</div>
            <div className="font-sign text-ink mt-2 text-[60px] leading-[1.05]">{live.text}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
