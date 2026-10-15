"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/lib/client/storage";
import { AVATARS, avatarSrc } from "@/lib/constants";
import { Art, Button, cx } from "../ui";

/**
 * A 30-second whack-a-mole for the wait between plating and the reveal:
 * food pops out of nine pots, tap it before it ducks back down, skip the fire.
 * Purely local; the best score lives on the phone.
 */

const CELLS = 9;
const GAME_MS = 30_000;
const BEST_KEY = "ok:rush:best";

type Pop = { id: number; kind: "food" | "fire"; src: string; hit?: boolean };
type Phase = "idle" | "playing" | "over";

export function KitchenRush({ className }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pots, setPots] = useState<(Pop | null)[]>(() => Array(CELLS).fill(null));
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(GAME_MS);
  const [best, setBest] = useState(() => Number(readStorage(BEST_KEY)) || 0);
  const [newBest, setNewBest] = useState(false);
  const [burnt, setBurnt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The game clock runs in an interval, so it reads the live score and best from refs.
  const scoreRef = useRef(0);
  const bestRef = useRef(best);
  const addScore = (d: number) => {
    scoreRef.current = Math.max(0, scoreRef.current + d);
    setScore(scoreRef.current);
  };

  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (phase !== "playing") return;
    const started = Date.now();
    let alive = true;
    const spawn = () => {
      if (!alive) return;
      const elapsed = Date.now() - started;
      if (elapsed >= GAME_MS) return;
      // Faster and busier as the clock runs down.
      const t = elapsed / GAME_MS;
      const stay = 1150 - 550 * t;
      setPots((ps) => {
        const free = ps.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
        if (!free.length || CELLS - free.length >= 2 + Math.floor(t * 2)) return ps;
        const at = free[Math.floor(Math.random() * free.length)];
        const id = ++seq.current;
        const kind = Math.random() < 0.16 + 0.08 * t ? "fire" : "food";
        later(() => setPots((cur) => cur.map((p, i) => (i === at && p?.id === id ? null : p))), stay);
        return ps.map((p, i) => (i === at ? { id, kind, src: avatarSrc(AVATARS[Math.floor(Math.random() * AVATARS.length)]) } : p));
      });
      later(spawn, 520 - 260 * t + Math.random() * 220);
    };
    later(spawn, 350);
    const clock = setInterval(() => {
      const l = Math.max(0, GAME_MS - (Date.now() - started));
      setLeft(l);
      if (l === 0) {
        clearInterval(clock);
        setPots(Array(CELLS).fill(null));
        if (scoreRef.current > bestRef.current) {
          bestRef.current = scoreRef.current;
          setBest(scoreRef.current);
          setNewBest(true);
          writeStorage(BEST_KEY, String(scoreRef.current));
        }
        setPhase("over");
      }
    }, 100);
    return () => {
      alive = false;
      clearInterval(clock);
    };
  }, [phase]);

  const start = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPots(Array(CELLS).fill(null));
    scoreRef.current = 0;
    setScore(0);
    setLeft(GAME_MS);
    setNewBest(false);
    setPhase("playing");
    // The game usually sits below the fold; bring the whole board into view.
    setTimeout(() => box.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
  };

  const tap = (i: number) => {
    const p = pots[i];
    if (phase !== "playing" || !p || p.hit) return;
    if (p.kind === "fire") {
      addScore(-2);
      setBurnt((b) => b + 1);
      navigator.vibrate?.([30, 40, 30]);
    } else {
      addScore(1);
      navigator.vibrate?.(8);
    }
    setPots((ps) => ps.map((x, j) => (j === i && x ? { ...x, hit: true } : x)));
    later(() => setPots((ps) => ps.map((x, j) => (j === i && x?.id === p.id ? null : x))), 220);
  };

  return (
    <div ref={box} className={cx("border-line bg-surface shadow-card overflow-hidden rounded-[20px] border-2", className)}>
      <div className="bg-sidecar border-line flex items-center justify-between gap-3 border-b-2 px-4 py-2.5">
        <div className="font-display text-[17px] font-extrabold">🎮 Kitchen Rush</div>
        {phase === "playing" ? (
          <div className="font-display flex items-center gap-3 text-[17px] font-extrabold tabular-nums">
            <span>⭐ {score}</span>
            <span className={cx(left < 5000 && "text-sunset-orange")}>⏱ {Math.ceil(left / 1000)}s</span>
          </div>
        ) : (
          <div className="font-display text-ink-soft text-[15px] font-bold">Best: {best}</div>
        )}
      </div>

      {phase === "playing" ? (
        <motion.div
          key={burnt}
          animate={burnt ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
          transition={{ duration: 0.35 }}
          className="grid touch-manipulation grid-cols-3 gap-2.5 p-3 select-none"
        >
          {pots.map((p, i) => (
            <button
              key={i}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                tap(i);
              }}
              aria-label={p ? (p.kind === "fire" ? "Fire, don't tap" : "Food, tap it") : "Empty pot"}
              className="bg-surface-alt border-line/25 relative aspect-square overflow-hidden rounded-[18px] border-2 shadow-[inset_0_-10px_0_rgba(97,51,1,0.08)]"
            >
              <AnimatePresence>
                {p && (
                  <motion.div
                    key={p.id}
                    initial={{ y: "70%", scale: 0.6, opacity: 0 }}
                    animate={p.hit ? { scale: 1.35, opacity: 0, rotate: p.kind === "fire" ? 0 : 20 } : { y: "0%", scale: 1, opacity: 1 }}
                    exit={{ y: "70%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 22 }}
                    className="absolute inset-0 grid place-items-center"
                  >
                    {p.kind === "fire" ? (
                      <span className="text-[52px] leading-none">🔥</span>
                    ) : (
                      <Art src={p.src} className="h-[84%] w-[84%] object-contain" />
                    )}
                    {p.hit && (
                      <span
                        className={cx(
                          "font-display absolute top-1 text-[22px] font-black",
                          p.kind === "fire" ? "text-sunset-orange" : "text-[#3c7a2c]",
                        )}
                      >
                        {p.kind === "fire" ? "−2" : "+1"}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          ))}
        </motion.div>
      ) : (
        <div className="flex flex-col items-center gap-3 px-4 py-5 text-center">
          {phase === "over" ? (
            <>
              <div className="font-sign text-[40px] leading-none">{score} served!</div>
              <p className="text-ink-muted text-[17px] font-semibold">{newBest ? "🎉 New best score!" : `Your best is ${best}.`}</p>
            </>
          ) : (
            <p className="text-ink-muted text-[17px] leading-snug font-semibold">
              Tap the food before it ducks back down. Don&apos;t touch the 🔥. 30 seconds!
            </p>
          )}
          <Button size="lg" onClick={start} className="w-full">
            {phase === "over" ? "Play again ↻" : "Play ▶"}
          </Button>
        </div>
      )}
    </div>
  );
}
