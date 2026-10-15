"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicState } from "../types";

/** Polls /api/state. Polling (not sockets) shrugs off flaky venue Wi-Fi. */
export function useGameState(opts: { pid?: string | null; adminKey?: string | null; interval?: number; enabled?: boolean }) {
  const { pid, adminKey, interval = 1000, enabled = true } = opts;
  const [state, setState] = useState<PublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const offset = useRef(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const qs = new URLSearchParams();
    if (pid) qs.set("pid", pid);
    if (adminKey) qs.set("admin", "1");
    const t0 = Date.now();
    try {
      const res = await fetch(`/api/state?${qs}`, {
        cache: "no-store",
        headers: adminKey ? { "x-admin-key": adminKey } : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error");
      } else {
        offset.current = (data as PublicState).serverNow - (t0 + Date.now()) / 2;
        setState(data);
        setError(null);
      }
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      inFlight.current = false;
    }
  }, [pid, adminKey]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await refresh();
      if (alive) timer = setTimeout(loop, document.hidden ? interval * 3 : interval);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refresh, interval, enabled]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { state, error, offline, refresh, serverNow };
}

/** Re-render on an interval (for countdowns). */
export function useTick(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function formatClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
