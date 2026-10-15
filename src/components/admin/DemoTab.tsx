"use client";

import { useState } from "react";
import { REVEAL_GAP_MS } from "@/lib/constants";
import type { GameConfig, PublicState } from "@/lib/types";
import { buttonClass, cx, Mascot, Panel } from "../ui";
import { ActButton, Eyebrow, SettingRow, Slider, Stepper, Toggle, ToggleRow } from "./controls";
import { type Act, type Edit, formatSeconds, PHASE_EMOJI, PHASE_LABEL } from "./shared";

interface Props {
  state: PublicState;
  config: GameConfig;
  edit: Edit;
  act: Act;
  dirty: boolean;
  saveDraft: () => Promise<boolean>;
}

const setDemo = (edit: Edit, patch: Partial<GameConfig["show"]["demo"]>) =>
  edit((c) => ({ ...c, show: { ...c.show, demo: { ...c.show.demo, ...patch } } }));

export function DemoTab({ state, config, edit, act, dirty, saveDraft }: Props) {
  const { game } = state;
  const demo = config.show.demo;
  const ai = state.admin!.aiConfigured;
  const [started, setStarted] = useState(false);
  const running = game.autopilot;
  const demoLeftovers = running || state.players.some((p) => p.bot);

  const end = async () => {
    if (!confirm("End the demo? This clears the bots, demo offers and grades and opens a fresh lobby for real guests.")) return;
    if (await act({ action: "reset" }, "Demo ended. Fresh lobby, ready for real guests.")) setStarted(false);
  };

  const start = async () => {
    const msg = "This clears all players, offers and grades and runs the whole show automatically.";
    if (!confirm(dirty ? `${msg}\n\nYour unsaved changes will be saved first.` : msg)) return;
    if (dirty && !(await saveDraft())) return;
    if (await act({ action: "demoStart" }, "🤖 Demo started. Autopilot has the wheel.")) setStarted(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="border-line bg-tiles bg-tiles-sm shadow-card relative overflow-hidden rounded-[22px] border-2">
        <div className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-end sm:gap-6 sm:p-8 sm:pb-0">
          <Mascot pose={running ? "cheer" : "point"} className="animate-sway order-first h-28 w-28 shrink-0 sm:order-last sm:h-56 sm:w-56" />
          <div className="min-w-0 flex-1 sm:pb-8">
            <Eyebrow>Hands-free mode</Eyebrow>
            <h1 className="font-sign text-ink mt-1 text-[34px] leading-[0.95] sm:text-[46px]">Run the whole show on autopilot</h1>
            <p className="text-ink-muted mt-3 max-w-xl text-[15.5px] leading-snug">
              Perfect for a pitch, a rehearsal or a walk-through. Bot chefs join, cook and react, two demo phones type real offers on screen, and every
              screen advances on its own from the lobby to the finale.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <ActButton size="xl" run={start} busyLabel="Starting…" className="w-full sm:w-auto">
                ▶ {running ? "Restart the full demo" : "Start the full demo"}
              </ActButton>
              {demoLeftovers && (
                <ActButton size="xl" variant="danger" run={end} busyLabel="Ending…" className="w-full sm:w-auto">
                  ■ End the demo
                </ActButton>
              )}
              <a
                href="/demo"
                target="_blank"
                rel="noreferrer"
                className={buttonClass(started || running ? "dark" : "secondary", started || running ? "xl" : "lg", "w-full whitespace-nowrap sm:w-auto")}
              >
                🎭 Open the demo stage ↗
              </a>
            </div>
            <p className="text-ink-soft mt-3 text-[12.5px] font-semibold">
              {started || running
                ? "Put the demo stage on the big screen: it shows the TV and both demo phones side by side."
                : "Starting clears players, offers and grades. Rounds, topics and settings stay."}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          {/* Autopilot status */}
          <Panel title="🤖 Autopilot" tone={running ? "leaf" : "plain"}>
            <div className="flex items-center gap-4">
              <div className={cx("border-line grid h-14 w-14 shrink-0 place-items-center rounded-[16px] border-2 text-[28px]", running ? "bg-leaf" : "bg-grout")}>
                {running ? "🟢" : "⏸️"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-ink text-[20px] leading-tight font-extrabold">{running ? "Autopilot is ON" : "Autopilot is off"}</div>
                <div className="text-ink-muted text-[14px]">
                  Now showing: {PHASE_EMOJI[game.phase]} {PHASE_LABEL[game.phase]}
                  {game.phase !== "lobby" && game.phase !== "final" && ` · Round ${game.roundIndex + 1}`}
                </div>
              </div>
              <Toggle
                checked={running}
                label="Autopilot"
                onChange={(on) => void act({ action: "autopilot", on }, on ? "🤖 Autopilot resumed" : "Autopilot stopped. You have the wheel.")}
              />
            </div>
            <p className="text-ink-soft mt-4 text-[13.5px] leading-snug">
              {running
                ? "Stopping hands control back to you on the current screen. You can resume any time and it picks up from there."
                : "Resume to let the server walk the show from wherever it is now, without clearing anything."}
            </p>
          </Panel>

          {/* Settings */}
          <Panel title="⚙️ Demo settings" tone="brand">
            <SettingRow title="Bot chefs" hint="How many bots trickle into the lobby, on top of the two demo phones." stack>
              <div className="flex items-center gap-4">
                <Slider value={demo.bots} min={0} max={40} onChange={(bots) => setDemo(edit, { bots })} label="Bot chefs" />
                <Stepper value={demo.bots} min={0} max={40} onChange={(bots) => setDemo(edit, { bots })} label="Bot chefs" />
              </div>
            </SettingRow>
            <SettingRow title="Cooking time per round" hint="How long the kitchen stays open in demo mode (your normal round timers are unchanged)." stack>
              <div className="flex items-center gap-4">
                <Slider
                  value={demo.writingSeconds}
                  min={15}
                  max={600}
                  step={5}
                  onChange={(writingSeconds) => setDemo(edit, { writingSeconds })}
                  label="Cooking time"
                />
                <Stepper
                  value={demo.writingSeconds}
                  min={15}
                  max={600}
                  step={5}
                  format={(s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`}
                  onChange={(writingSeconds) => setDemo(edit, { writingSeconds })}
                  label="Cooking time"
                />
              </div>
            </SettingRow>
            <ToggleRow
              title="Grade the two demo phones with real AI"
              hint={
                ai
                  ? "Their offers go to Claude like a real guest's. Off: instant simulated grades."
                  : "AI isn't connected on the server, so the demo phones get simulated grades either way."
              }
              checked={demo.seatsUseAI}
              onChange={(seatsUseAI) => setDemo(edit, { seatsUseAI })}
            />
            {dirty && <p className="text-carrot-orange mt-4 text-[13px] font-bold">Save to use these settings. Starting the demo saves them for you.</p>}
          </Panel>
        </div>

        <Timeline config={config} />
      </div>
    </div>
  );
}

/** What autopilot does, with timings from the current settings. */
function Timeline({ config }: { config: GameConfig }) {
  const { demo, leaderboardSize, revealPace } = config.show;
  const lobby = 4 + demo.bots * 0.65 + 2.5;
  const shown = Math.min(leaderboardSize, demo.bots + 2);
  const board = 2.5 + (shown * REVEAL_GAP_MS[revealPace]) / 1000 + 6;
  const oven = 8;
  const perRound = 9 + demo.writingSeconds + 2.5 + oven + board + 15;
  const total = lobby + perRound * config.rounds.length;

  const steps: { emoji: string; title: string; detail: string; time?: string }[] = [
    { emoji: "🚪", title: "Bots trickle into the lobby", detail: `${demo.bots} bot chefs and two demo phones join, one by one, while the crowd reacts.`, time: formatSeconds(Math.round(lobby)) },
    { emoji: "🎬", title: "Round intro", detail: "The round's name, topic card and tips on the TV.", time: "9s" },
    {
      emoji: "🔥",
      title: "The kitchen opens",
      detail: "Bots plate offers as the clock runs down, and the two demo phones type their own, letter by letter.",
      time: formatSeconds(demo.writingSeconds),
    },
    { emoji: "♨️", title: "Into the oven", detail: "Every plate gets graded. Moves on as soon as the last grade lands.", time: "~5–10s" },
    { emoji: "📊", title: "Leaderboard reveal", detail: `The top ${shown} reveal one by one at a ${revealPace} pace.`, time: formatSeconds(Math.round(board)) },
    { emoji: "🔦", title: "Spotlight on the winner", detail: "The round's best plate, with Claude's full feedback.", time: "15s" },
  ];

  return (
    <Panel title="🗺️ What autopilot does" tone="alt">
      <ol className="relative flex flex-col">
        {steps.map((s, i) => (
          <li key={i} className="relative flex gap-3.5 pb-5">
            {i < steps.length - 1 && <span aria-hidden className="bg-line/20 absolute top-11 bottom-1 left-[21px] w-[2px]" />}
            <span className="border-line bg-surface-plain grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-[20px] shadow-[0_2px_0_rgba(97,51,1,0.2)]">
              {s.emoji}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-ink text-[15.5px] font-extrabold">{s.title}</span>
                {s.time && <span className="font-ticket text-ink-soft ml-auto shrink-0 text-[12px] font-bold">{s.time}</span>}
              </div>
              <p className="text-ink-muted text-[13.5px] leading-snug">{s.detail}</p>
            </div>
          </li>
        ))}
        <li className="border-line/25 bg-surface-alt mb-5 ml-[56px] rounded-[12px] border-2 border-dashed px-3 py-2 text-[13.5px]">
          <span className="font-display font-extrabold">↻ Repeat for every round:</span>{" "}
          <span className="text-ink-muted">{config.rounds.map((r, i) => `${i + 1}. ${r.name}`).join(" → ")}</span>
        </li>
        <li className="flex gap-3.5">
          <span className="border-line bg-goldenrod grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-[20px] shadow-[0_2px_0_rgba(97,51,1,0.2)]">
            🏆
          </span>
          <div className="pt-1">
            <div className="font-display text-ink text-[15.5px] font-extrabold">Finale</div>
            <p className="text-ink-muted text-[13.5px] leading-snug">The overall winners take a bow. Autopilot stays on the finale until you reset.</p>
          </div>
        </li>
      </ol>
      <div className="border-line bg-goldenrod/40 mt-5 flex items-center justify-between gap-3 rounded-[14px] border-2 px-4 py-3">
        <span className="font-display text-[14px] font-bold">Whole show, start to finale</span>
        <span className="font-sign text-ink text-[26px] leading-none">≈ {Math.max(1, Math.round(total / 60))} min</span>
      </div>
    </Panel>
  );
}
