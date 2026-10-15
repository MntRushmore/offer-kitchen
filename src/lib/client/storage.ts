"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "ok:storage";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function readStorage(key: string) {
  return read(key);
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/**
 * A localStorage-backed value. Returns `undefined` until hydrated on the
 * client, then the stored string or null.
 */
export function useStoredValue(key: string): [string | null | undefined, (v: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => undefined,
  );
  const set = useCallback((v: string | null) => writeStorage(key, v), [key]);
  return [value, set];
}

const noop = () => () => {};
export function useOrigin() {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
}

/** A URL query parameter, read on the client only (no Suspense boundary needed). */
export function useQueryParam(name: string) {
  return useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}
