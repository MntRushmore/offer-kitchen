"use client";

import { useEffect, useRef, useState } from "react";
import { useTick } from "@/lib/client/useGame";
import type { PublicState } from "@/lib/types";
import { Avatar, cx } from "../ui";
import { ActButton } from "./controls";
import type { Act } from "./shared";

/** Parents' "Need help" taps, pinned under the header on every tab until an organizer marks them helped. */
export function HelpBanner({ state, act, serverNow }: { state: PublicState; act: Act; serverNow: () => number }) {
  const help = state.admin!.help ?? [];
  const newest = help.reduce((m, h) => Math.max(m, h.at), 0);
  useHelpAlerts(help.length, newest);
  useTick(15_000);
  // Hiding lasts until someone new asks.
  const [hiddenUpTo, setHiddenUpTo] = useState(0);
  if (!help.length) return null;

  const collapsed = newest <= hiddenUpTo;
  const pm = new Map(state.players.map((p) => [p.id, p]));
  const now = serverNow();

  return (
    <div className="lg:mx-auto lg:max-w-[1480px] lg:px-8 lg:pt-3 lg:pl-[calc(4rem+232px)]">
      <section
        aria-label="Help requests"
        className="border-line bg-goldenrod pointer-events-auto overflow-hidden border-b-2 lg:shadow-card lg:rounded-[18px] lg:border-2"
      >
        <div className={cx("border-line bg-sunset-orange flex items-center gap-3 px-3 py-1.5 text-white sm:px-4", !collapsed && "border-b-2")}>
          <span className="animate-wiggle text-[26px] leading-none">🙋</span>
          <div aria-live="polite" className="font-display min-w-0 flex-1 text-[17px] leading-tight font-extrabold">
            {help.length === 1 ? "1 person needs help" : `${help.length} people need help`}
          </div>
          <button
            type="button"
            onClick={() => setHiddenUpTo(collapsed ? 0 : newest)}
            className="font-display min-h-10 shrink-0 cursor-pointer rounded-[10px] px-2.5 text-[14px] font-bold underline"
          >
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
        {!collapsed && (
          <ul className="grid max-h-[min(45dvh,360px)] grid-cols-1 gap-2 overflow-y-auto p-2.5 sm:px-4 xl:grid-cols-2">
            {help.map((h) => {
              const p = pm.get(h.playerId);
              if (!p) return null;
              const waited = Math.max(0, now - h.at);
              return (
                <li key={h.playerId} className="border-line bg-surface-plain flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] border-2 p-2 pl-2.5">
                  <Avatar player={p} size={40} />
                  <div className="min-w-0 flex-1 basis-32">
                    <div className="font-display text-ink truncate text-[16px] leading-tight font-extrabold">{p.name}</div>
                    <div className={cx("text-[14px] font-semibold", waited >= 3 * 60_000 ? "text-sunset-orange" : "text-ink-soft")}>{ago(waited)}</div>
                  </div>
                  <ActButton
                    variant="success"
                    className="min-h-11 shrink-0 px-4"
                    run={() => act({ action: "resolveHelp", playerId: p.id }, `✓ ${p.name} got help`)}
                  >
                    ✓ Helped
                  </ActButton>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ago(ms: number) {
  const min = Math.round(ms / 60_000);
  if (ms < 45_000 || min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} hr ago`;
}

/** A chime (and a buzz on phones that can) for each new request, and the count in the tab title. */
function useHelpAlerts(count: number, newest: number) {
  // Browsers only allow sound once the page has had a tap or key press.
  useEffect(() => {
    window.addEventListener("pointerdown", primeAudio, { passive: true });
    window.addEventListener("keydown", primeAudio);
    return () => {
      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
    };
  }, []);

  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (seen.current !== null && newest > seen.current) {
      chime();
      try {
        navigator.vibrate?.([150, 80, 150]);
      } catch {}
    }
    seen.current = Math.max(seen.current ?? 0, newest);
  }, [newest]);

  useEffect(() => {
    if (!count) return;
    const base = document.title;
    document.title = `(${count}) 🙋 ${base}`;
    return () => {
      document.title = base;
    };
  }, [count]);
}

// Its own AudioContext on purpose: unlocking the shared one in sound.ts would make the TV preview on this page play every TV sound.
let audio: AudioContext | null = null;

function primeAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
  } catch {}
}

/** Two quick rising notes: a doorbell, not an alarm. */
function chime() {
  try {
    // Notes scheduled on a still-locked context would all play late, on the next tap.
    const ctx = audio;
    if (ctx?.state !== "running") return;
    const t = ctx.currentTime + 0.02;
    for (const [freq, at] of [
      [1319, 0],
      [1760, 0.16],
    ]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t + at);
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.3, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.7);
      o.connect(g).connect(ctx.destination);
      o.start(t + at);
      o.stop(t + at + 0.75);
    }
  } catch {}
}
