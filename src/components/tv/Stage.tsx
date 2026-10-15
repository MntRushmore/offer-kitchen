"use client";

import confetti from "canvas-confetti";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type Fire = (opts: confetti.Options) => void;
const ConfettiContext = createContext<Fire>(() => {});
/** Confetti scoped to the stage, so an embedded TV never sprays the page around it. */
export const useConfetti = () => useContext(ConfettiContext);

/**
 * A fixed 1920×1080 canvas scaled to fit, like a slide. `fit="window"` fills
 * the browser; `fit="parent"` fills whatever box it is placed in (admin
 * preview, demo stage).
 */
export function Stage({ children, fit = "window", allowConfetti = true }: { children: React.ReactNode; fit?: "window" | "parent"; allowConfetti?: boolean }) {
  const [scale, setScale] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (fit === "window") {
      const onResize = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
      onResize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(e.contentRect.width / 1920, e.contentRect.height / 1080)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const fire = useMemo<Fire>(() => {
    let inst: confetti.CreateTypes | null = null;
    return (opts) => {
      if (!allowConfetti || !canvas.current) return;
      inst ??= confetti.create(canvas.current, { resize: true, useWorker: true });
      void inst({ ...opts, zIndex: undefined });
    };
  }, [allowConfetti]);

  return (
    <div ref={box} className={fit === "window" ? "bg-slate fixed inset-0 overflow-hidden" : "relative h-full w-full overflow-hidden"}>
      <div
        className="bg-tiles text-ink absolute top-1/2 left-1/2 overflow-hidden"
        style={{
          width: 1920,
          height: 1080,
          transform: `translate(-50%, -50%) scale(${scale})`,
          opacity: scale ? 1 : 0,
        }}
      >
        <ConfettiContext.Provider value={fire}>{children}</ConfettiContext.Provider>
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 z-[60] h-full w-full" />
      </div>
    </div>
  );
}
