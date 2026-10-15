"use client";

import { useCallback, useSyncExternalStore } from "react";
import PlayApp from "@/components/play/PlayApp";
import { TvApp } from "@/components/tv/TvApp";
import { useQueryParam, useStoredValue } from "@/lib/client/storage";

/** A laptop or a TV driven by one. Tablets and phones get the player app. */
const BIG_SCREEN = "(min-width: 1024px) and (pointer: fine)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(BIG_SCREEN);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * The bare URL. On a big screen it's the TV with the join QR; phones that scan
 * it land on the same URL and get the join form. Anyone already playing on this
 * device, or opening `?play`, stays on the player app.
 */
export default function HomeSwitch() {
  const big = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(BIG_SCREEN).matches,
    () => null,
  );
  const play = useQueryParam("play");
  const seat = useQueryParam("seat");
  const [pid, setPid] = useStoredValue("ok:pid");
  // A laptop whose player was reset or removed goes back to being the TV.
  const forget = useCallback(() => setPid(null), [setPid]);

  if (big === null || pid === undefined) return null;
  const tvByDefault = big && play === null && seat === null;
  if (tvByDefault && !pid) return <TvApp mode="full" playHref="/?play" />;
  return <PlayApp onStale={tvByDefault ? forget : undefined} />;
}
