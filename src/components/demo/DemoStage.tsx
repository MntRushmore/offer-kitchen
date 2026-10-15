"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { TvApp } from "@/components/tv/TvApp";
import { Button, cx, Input, Logo } from "@/components/ui";
import { setMuted, unlockAudio } from "@/lib/client/sound";
import { useOrigin, useStoredValue } from "@/lib/client/storage";
import { useGameState } from "@/lib/client/useGame";
import type { Phase } from "@/lib/types";

const PHASE_LABEL: Record<Phase, string> = {
  lobby: "Chefs arriving",
  intro: "Round intro",
  writing: "Kitchen open",
  grading: "In the oven",
  leaderboard: "Results",
  spotlight: "Spotlight",
  final: "Finale",
};

type Mode = "play" | "watch";

const PHONE_W = 390;
const PHONE_H = 844;
const BEZEL = 10;
const STATUS = 22;
const LABEL = 44;

const PHONES: Record<Mode, { seat: string; label: string; you?: boolean }[]> = {
  play: [
    { seat: "you", label: "📱 Your phone — tap in and play!", you: true },
    { seat: "a", label: "📱 Chef Rosa (a demo bot)" },
  ],
  watch: [
    { seat: "a", label: "📱 Chef Rosa's phone" },
    { seat: "b", label: "📱 Chef Theo's phone" },
  ],
};

/** The whole show on one screen: the TV, plus two phones playing along. */
export default function DemoStage() {
  const [key, saveKey] = useStoredValue("ok:admin");
  const [mode, setMode] = useState<Mode>("play");
  const [pw, setPw] = useState("");
  const [needPw, setNeedPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const origin = useOrigin();
  const { state } = useGameState({ interval: 1500 });

  // Fit TV + two phones (+ their captions) inside whatever window this is.
  const box = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1400, h: 760 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setDims({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const gap = 28;
  const availH = dims.h - LABEL;
  const scale = Math.max(0.3, Math.min(0.9, (availH - 2 * BEZEL - STATUS) / PHONE_H, (dims.w * 0.42 - gap) / 2 / (PHONE_W + 2 * BEZEL)));
  const phoneOuterW = PHONE_W * scale + 2 * BEZEL;
  const phoneOuterH = PHONE_H * scale + 2 * BEZEL + STATUS;
  const tvW = Math.max(320, Math.min(dims.w - 2 * phoneOuterW - 2 * gap, (availH * 16) / 9));

  const turnOnSound = () => {
    unlockAudio();
    setMuted(false);
    setSound(true);
  };

  const admin = async (body: Record<string, unknown>, k = key) => {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": k ?? "" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      setNeedPw(true);
      throw new Error("Enter the host password to start");
    }
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  };

  const start = async (k = key) => {
    turnOnSound();
    setBusy(true);
    setMsg(null);
    try {
      await admin({ action: "demoStart" }, k);
      setNeedPw(false);
      setMsg(mode === "play" ? "Pick your chef on the left phone 👈" : "Sit back and watch 🍿");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const game = state?.game;
  const autopilot = Boolean(game?.autopilot);
  const joinUrl = state?.joinUrl || origin;

  return (
    <div className="bg-slate flex h-dvh flex-col overflow-hidden text-white">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b-4 border-black/40 bg-[#1b221f] px-5 py-2.5">
        <Logo size="sm" />
        <div className="flex rounded-full bg-white/10 p-1">
          {(["play", "watch"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cx(
                "font-display rounded-full px-3.5 py-1 text-[13px] font-extrabold transition-colors",
                mode === m ? "bg-goldenrod text-ink" : "text-white/75 hover:text-white",
              )}
            >
              {m === "play" ? "🎮 Play along" : "🍿 Just watch"}
            </button>
          ))}
        </div>
        {game && (
          <span className="font-display text-[14px] font-bold text-white/80">
            {autopilot ? "🎬 Autopilot" : "✋ Manual"} · {PHASE_LABEL[game.phase]}
            {game.phase !== "lobby" && game.phase !== "final" && ` · Round ${game.roundIndex + 1}`} · {state?.players.length ?? 0} chefs
          </span>
        )}
        <div className="flex-1" />
        {msg && <span className="font-display text-goldenrod text-[14px] font-bold">{msg}</span>}
        {!sound && (
          <Button size="sm" variant="secondary" onClick={turnOnSound}>
            🔊 Sound on
          </Button>
        )}
        {needPw ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveKey(pw);
              void start(pw);
            }}
          >
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Host password" className="h-9 w-44 py-1" autoFocus />
            <Button size="sm" type="submit">
              Go
            </Button>
          </form>
        ) : (
          <>
            {game && game.phase !== "lobby" && (
              <Button size="sm" variant="secondary" onClick={() => admin({ action: "autopilot", on: !autopilot }).catch(() => {})}>
                {autopilot ? "⏸ Pause" : "▶ Resume"}
              </Button>
            )}
            {game && game.phase !== "final" && (
              <Button size="sm" variant="secondary" onClick={() => admin({ action: "next" }).catch((e) => setMsg(e.message))}>
                Skip ▶
              </Button>
            )}
            <Button size="sm" onClick={() => start()} disabled={busy}>
              {busy ? "Starting…" : autopilot || (game && game.phase !== "lobby") ? "↻ Restart demo" : "▶ Start the demo"}
            </Button>
          </>
        )}
        <a href="/admin" target="_blank" className="font-display text-[13px] font-bold text-white/70 underline">
          Host console ↗
        </a>
      </header>

      <div ref={box} className="flex min-h-0 flex-1 items-start justify-center overflow-hidden px-5 pt-4 pb-3" style={{ gap }}>
        <div className="flex shrink-0 flex-col items-center" style={{ width: tvW }}>
          <div
            className="relative w-full overflow-hidden rounded-[16px] border-[8px] border-[#0d0f0e] bg-black shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]"
            style={{ aspectRatio: "16 / 9" }}
          >
            <TvApp mode="embedded" started={sound} />
          </div>
          <div className="font-display mt-2.5 flex items-center gap-4 text-[14px] font-bold text-white/75">
            <span>📺 The TV — what the whole room sees</span>
            {mode === "play" && joinUrl && (
              <span className="flex items-center gap-2 rounded-full bg-white/10 py-1 pr-3 pl-1">
                <span className="rounded-md bg-white p-0.5">
                  <QRCodeSVG value={joinUrl} size={28} bgColor="#ffffff" fgColor="#1b221f" />
                </span>
                or join from your real phone
              </span>
            )}
          </div>
        </div>
        {PHONES[mode].map((p) => (
          <div key={`${mode}-${p.seat}`} className="flex shrink-0 flex-col items-center">
            <div
              className={cx(
                "relative overflow-hidden rounded-[44px] bg-[#0d0f0e] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]",
                p.you && "ring-goldenrod ring-4",
              )}
              style={{ width: phoneOuterW, height: phoneOuterH, padding: BEZEL, paddingTop: BEZEL + STATUS }}
            >
              <div className="absolute top-[9px] left-1/2 h-[14px] w-[72px] -translate-x-1/2 rounded-full bg-black" />
              <div className="relative overflow-hidden rounded-[34px] bg-white" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
                <iframe
                  title={p.label}
                  src={`/?seat=${p.seat}`}
                  className="absolute top-0 left-0 origin-top-left border-0"
                  style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})` }}
                />
              </div>
            </div>
            <div className={cx("font-display mt-2.5 text-[14px] font-bold", p.you ? "text-goldenrod" : "text-white/75")}>{p.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
