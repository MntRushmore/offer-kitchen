"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStoredValue } from "@/lib/client/storage";
import { formatClock, useGameState, useTick } from "@/lib/client/useGame";
import type { GameConfig, PublicState } from "@/lib/types";
import { Badge, Button, ChefHat, cx, Field, Input, Logo, Mascot, ShowProvider } from "../ui";
import { DemoTab } from "./DemoTab";
import { GraderTab } from "./GraderTab";
import { LiveTab } from "./LiveTab";
import { PlayersTab } from "./PlayersTab";
import { RoundsTab } from "./RoundsTab";
import { type Act, type Edit, type Flash, msLeft, PHASE_EMOJI, PHASE_LABEL, same, type Tab } from "./shared";
import { ShowTab } from "./ShowTab";
import { TopicsTab } from "./TopicsTab";

const KEY = "ok:admin";
const TAB_KEY = "ok:admin-tab";

const TABS: { id: Tab; emoji: string; label: string; hint: string }[] = [
  { id: "live", emoji: "🎬", label: "Live", hint: "Run the show" },
  { id: "demo", emoji: "🤖", label: "Demo", hint: "Hands-free autopilot" },
  { id: "show", emoji: "🎨", label: "Show", hint: "Look, sound & flow" },
  { id: "rounds", emoji: "🍽️", label: "Rounds", hint: "Courses & timers" },
  { id: "topics", emoji: "📋", label: "Topics", hint: "Order tickets" },
  { id: "grader", emoji: "🧑‍⚖️", label: "Grader", hint: "Claude's tasting notes" },
  { id: "players", emoji: "👥", label: "Players", hint: "Chefs & scores" },
];

export default function AdminApp() {
  const [stored, save] = useStoredValue(KEY);
  const key = stored ?? null;
  const ready = stored !== undefined;
  const { state, error, offline, refresh, serverNow } = useGameState({ adminKey: key, interval: 1500, enabled: ready && !!key });

  if (!ready) return null;
  if (!key || error === "Wrong password") return <Login onLogin={save} failed={!!key && error === "Wrong password"} />;
  if (!state?.admin) return <Loading error={error} />;
  return (
    <ShowProvider value={state.show}>
      <Console state={state} adminKey={key} refresh={refresh} serverNow={serverNow} offline={offline} logout={() => save(null)} />
    </ShowProvider>
  );
}

function Login({ onLogin, failed }: { onLogin: (k: string) => void; failed: boolean }) {
  const [pw, setPw] = useState("");
  return (
    <div className="bg-tiles grid min-h-dvh place-items-center p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw.trim()) onLogin(pw.trim());
        }}
        className="flex w-full max-w-[420px] flex-col items-center"
      >
        <Mascot pose="wave" className="animate-sway relative z-10 -mb-6 h-40 w-40" />
        <div className="border-line bg-surface shadow-tv w-full rounded-[24px] border-2 px-6 pt-8 pb-6 sm:px-8">
          <div className="flex justify-center">
            <Logo size="sm" />
          </div>
          <p className="text-ink-muted mt-2 mb-6 text-center text-[15px]">Head chef only. Enter the host password to run the show.</p>
          <Field label="Host password" error={failed ? "That's not the password. Try again?" : null}>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus placeholder="••••••••" autoComplete="current-password" />
          </Field>
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={!pw.trim()}>
            Enter the kitchen →
          </Button>
        </div>
      </form>
    </div>
  );
}

function Loading({ error }: { error: string | null }) {
  return (
    <div className="bg-bg bg-paper grid min-h-dvh place-items-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <ChefHat size={72} className="animate-wiggle" />
        <div className="font-display text-ink text-2xl font-extrabold">{error ? "The kitchen isn't answering…" : "Warming up the kitchen…"}</div>
        {error && <div className="text-ink-soft text-[14px] font-bold">{error} · retrying</div>}
      </div>
    </div>
  );
}

/* ---------- The console ---------- */

function Console({
  state,
  adminKey,
  refresh,
  serverNow,
  offline,
  logout,
}: {
  state: PublicState;
  adminKey: string;
  refresh: () => Promise<void>;
  serverNow: () => number;
  offline: boolean;
  logout: () => void;
}) {
  const [storedTab, setStoredTab] = useStoredValue(TAB_KEY);
  const tab: Tab = TABS.some((t) => t.id === storedTab) ? (storedTab as Tab) : "live";
  const setTab = (t: Tab) => {
    setStoredTab(t);
    window.scrollTo({ top: 0 });
  };

  const admin = state.admin!;
  const server = admin.config;
  const [draft, setDraft] = useState<GameConfig | null>(null);
  const dirty = draft !== null && !same(draft, server);
  const config = dirty ? draft : server;
  const edit: Edit = (fn) => setDraft((d) => fn(d && !same(d, server) ? d : server));

  // Which tabs hold unsaved edits.
  const dirtyTabs: Partial<Record<Tab, boolean>> = dirty
    ? {
        show: !same({ ...draft.show, demo: null }, { ...server.show, demo: null }) || draft.joinUrl !== server.joinUrl,
        demo: !same(draft.show.demo, server.show.demo),
        rounds: !same(draft.rounds, server.rounds),
        topics: !same(draft.topics, server.topics),
        grader: draft.model !== server.model || draft.gradingMode !== server.gradingMode || draft.graderPrompt !== server.graderPrompt,
      }
    : {};

  /* Toasts */
  const [toasts, setToasts] = useState<{ id: number; msg: string; bad: boolean }[]>([]);
  const seq = useRef(0);
  const flash: Flash = useCallback((msg, bad = false) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, msg, bad }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), bad ? 5500 : 2600);
  }, []);

  const act: Act = useCallback(
    async (body, ok) => {
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
        if (ok) flash(ok);
        await refresh();
        return true;
      } catch (err) {
        flash(err instanceof Error ? err.message : "Something went wrong", true);
        return false;
      }
    },
    [adminKey, flash, refresh],
  );

  const [saving, setSaving] = useState(false);
  const saveDraft = useCallback(async () => {
    if (!draft || saving) return true;
    setSaving(true);
    const ok = await act({ action: "saveConfig", config: draft }, "Saved ✓ — the TV and phones have it now");
    setSaving(false);
    if (ok) setDraft(null);
    return ok;
  }, [act, draft, saving]);

  // ⌘S saves; leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveDraft();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [dirty, saveDraft]);

  // Keep the active tab visible in the phone tab strip.
  useEffect(() => {
    document.querySelector(`[data-mtab="${tab}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab]);

  const entries = state.board[state.game.roundIndex] ?? [];
  const errors = entries.filter((e) => e.status === "error").length;
  const tabProps = { state, config, edit, act, flash, adminKey };

  return (
    <div className="bg-bg bg-paper min-h-dvh">
      <TopBar state={state} offline={offline} logout={logout} />

      {/* Phones and tablets: a scrolling tab strip */}
      <nav className="border-line bg-surface/95 no-scrollbar sticky top-0 z-30 flex gap-1.5 overflow-x-auto border-b-2 px-3 py-2 backdrop-blur lg:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-mtab={t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              "font-display relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[11px] border-2 px-3 py-1.5 text-[14px] font-bold whitespace-nowrap transition-all",
              tab === t.id ? "border-line bg-goldenrod shadow-control" : "text-ink/75 border-transparent",
            )}
          >
            <span>{t.emoji}</span>
            {t.label}
            {dirtyTabs[t.id] && <span className="bg-sunset-orange border-line absolute -top-1 -right-1 h-3 w-3 rounded-full border-2" />}
          </button>
        ))}
      </nav>

      <div className="mx-auto flex max-w-[1480px] gap-8 px-4 sm:px-6 lg:px-8">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[232px] shrink-0 flex-col gap-1.5 overflow-y-auto py-6 lg:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cx(
                "group flex w-full cursor-pointer items-center gap-3 rounded-[14px] border-2 px-2.5 py-2 text-left transition-all duration-150",
                tab === t.id ? "border-line bg-goldenrod shadow-control" : "hover:border-line/25 hover:bg-surface/80 border-transparent",
              )}
            >
              <span
                className={cx(
                  "border-line grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border-2 text-[18px] transition-transform group-hover:-rotate-6",
                  tab === t.id ? "bg-surface-plain" : "bg-surface",
                )}
              >
                {t.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display text-ink block text-[15px] leading-tight font-extrabold">{t.label}</span>
                <span className="text-ink-soft block truncate text-[12px] leading-tight">{t.hint}</span>
              </span>
              <NavBadge tab={t.id} state={state} errors={errors} dirty={!!dirtyTabs[t.id]} />
            </button>
          ))}
          <div className="flex-1" />
          <NowCard state={state} serverNow={serverNow} onClick={() => setTab("live")} />
        </aside>

        <main className="min-w-0 flex-1 pt-6 pb-36 lg:pt-8">
          {tab === "live" && <LiveTab {...tabProps} serverNow={serverNow} />}
          {tab === "demo" && <DemoTab {...tabProps} dirty={dirty} saveDraft={saveDraft} />}
          {tab === "show" && <ShowTab {...tabProps} />}
          {tab === "rounds" && <RoundsTab {...tabProps} />}
          {tab === "topics" && <TopicsTab {...tabProps} />}
          {tab === "grader" && <GraderTab {...tabProps} dirty={dirty} />}
          {tab === "players" && <PlayersTab {...tabProps} />}
        </main>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        where={TABS.filter((t) => dirtyTabs[t.id]).map((t) => t.label)}
        onSave={() => void saveDraft()}
        onDiscard={() => setDraft(null)}
      />
      <Toasts toasts={toasts} />
    </div>
  );
}

/* ---------- Top bar ---------- */

function Pill({ tone, children, title, className }: { tone: "ok" | "warn" | "info" | "hot"; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "border-line font-display inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 px-2.5 py-[3px] text-[12.5px] font-bold whitespace-nowrap",
        tone === "ok" && "bg-leaf/35",
        tone === "warn" && "bg-goldenrod",
        tone === "info" && "bg-viking/35",
        tone === "hot" && "bg-sunset-orange text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}

function StatusPills({ state, offline }: { state: PublicState; offline: boolean }) {
  const admin = state.admin!;
  return (
    <>
      {offline && <Pill tone="hot">📡 Reconnecting…</Pill>}
      {state.game.autopilot && (
        <Pill tone="hot" title="The server is running the show by itself">
          <span className="animate-glow h-2 w-2 rounded-full bg-white" />
          Autopilot ON
        </Pill>
      )}
      {admin.aiConfigured ? (
        <Pill tone="ok" title="AI Gateway credentials found on the server">
          ✅ AI connected
        </Pill>
      ) : (
        <Pill tone="warn" title="No AI credentials on the server: every grade is simulated">
          ⚠️ AI not connected
        </Pill>
      )}
      {admin.config.gradingMode === "mock" && (
        <Pill tone="warn" title="Every offer gets a free simulated grade. Switch to Claude in the Grader tab for the real show.">
          🎭 Simulated grades
        </Pill>
      )}
      {admin.storeKind === "redis" ? (
        <Pill tone="info" title="Game state lives in Redis and survives restarts">
          🗄️ Redis
        </Pill>
      ) : (
        <Pill tone="warn" title="Game state lives in this server's memory. Fine for local rehearsals; it resets on restart.">
          💾 Memory (local only)
        </Pill>
      )}
    </>
  );
}

function TopBar({ state, offline, logout }: { state: PublicState; offline: boolean; logout: () => void }) {
  const link =
    "font-display inline-flex shrink-0 items-center gap-1 rounded-[10px] border-2 border-line bg-surface-plain px-2.5 py-1 text-[13px] font-bold shadow-[0_2px_0_rgba(97,51,1,0.25)] transition-all hover:-translate-y-px hover:bg-goldenrod/50";
  return (
    <header className="border-line bg-surface/95 z-40 border-b-2 backdrop-blur lg:sticky lg:top-0">
      <div className="mx-auto flex max-w-[1480px] items-center gap-2.5 px-4 py-2.5 sm:px-6 lg:h-16 lg:px-8 lg:py-0">
        <Logo size="sm" />
        <Badge tone="info" className="max-sm:hidden">
          Host
        </Badge>
        <div className="ml-2 hidden min-w-0 items-center gap-1.5 overflow-hidden xl:flex">
          <StatusPills state={state} offline={offline} />
        </div>
        <div className="flex-1" />
        <a href="/tv" target="_blank" rel="noreferrer" className={link}>
          📺 <span className="max-sm:hidden">Open</span> TV<span className="max-sm:hidden"> ↗</span>
        </a>
        <a href="/demo" target="_blank" rel="noreferrer" className={link}>
          🎭 Demo<span className="max-sm:hidden"> stage ↗</span>
        </a>
        <Button variant="ghost" size="sm" onClick={logout} className="max-sm:hidden">
          Log out
        </Button>
      </div>
      <div className="no-scrollbar mx-auto flex max-w-[1480px] items-center gap-1.5 overflow-x-auto px-4 pb-2.5 sm:px-6 xl:hidden">
        <StatusPills state={state} offline={offline} />
        <div className="flex-1" />
        <button type="button" onClick={logout} className="font-display text-ink-soft shrink-0 cursor-pointer px-1 text-[13px] font-bold underline sm:hidden">
          Log out
        </button>
      </div>
    </header>
  );
}

/* ---------- Sidebar bits ---------- */

function NavBadge({ tab, state, errors, dirty }: { tab: Tab; state: PublicState; errors: number; dirty: boolean }) {
  if (dirty) return <span title="Unsaved changes" className="bg-sunset-orange border-line h-3 w-3 shrink-0 rounded-full border-2" />;
  const chip = "font-display shrink-0 rounded-full border-2 border-line px-1.5 text-[11px] font-extrabold leading-[16px] tabular-nums";
  if (tab === "live" && errors > 0) return <span className={cx(chip, "bg-sunset-orange text-white")}>{errors}</span>;
  if (tab === "demo" && state.game.autopilot) return <span className={cx(chip, "bg-leaf")}>ON</span>;
  if (tab === "players") return <span className={cx(chip, "bg-surface-plain")}>{state.players.length}</span>;
  return null;
}

/** What the TV shows right now, pinned under the nav. */
function NowCard({ state, serverNow, onClick }: { state: PublicState; serverNow: () => number; onClick: () => void }) {
  useTick(500);
  const { game } = state;
  const round = state.rounds[game.roundIndex];
  const left = game.phase === "writing" ? msLeft(game, serverNow()) : null;
  const inRound = game.phase !== "lobby" && game.phase !== "final";
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-line bg-surface shadow-card hover:bg-surface-plain w-full cursor-pointer rounded-[16px] border-2 p-3.5 text-left transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="bg-sunset-orange animate-glow h-2 w-2 rounded-full" />
        <span className="font-display text-ink-soft text-[11px] font-extrabold tracking-[0.09em] uppercase">On the TV</span>
      </div>
      <div className="font-display text-ink mt-1.5 text-[18px] leading-tight font-extrabold">
        {PHASE_EMOJI[game.phase]} {PHASE_LABEL[game.phase]}
      </div>
      {inRound && round && (
        <div className="text-ink-muted truncate text-[13px]">
          Round {game.roundIndex + 1} · {round.name}
        </div>
      )}
      {left !== null && (
        <div
          className={cx(
            "font-display mt-1 text-[26px] leading-none font-extrabold tabular-nums",
            game.pausedLeft !== null ? "text-ink-soft" : left < 30_000 ? "text-sunset-orange" : "text-ink",
          )}
        >
          {left <= 0 ? "TIME!" : formatClock(left)}
          {game.pausedLeft !== null && <span className="ml-2 text-[12px] tracking-wide">⏸ PAUSED</span>}
        </div>
      )}
      {game.autopilot && <div className="text-ink-soft mt-1.5 text-[12px] font-bold">🤖 Autopilot is driving</div>}
    </button>
  );
}

/* ---------- Save bar & toasts ---------- */

function SaveBar({
  dirty,
  saving,
  where,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  where: string[];
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-[620px] sm:bottom-5 lg:left-[264px]"
        >
          <div className="border-line bg-ink text-surface shadow-raised flex items-center gap-3 rounded-[18px] border-2 py-2.5 pr-2.5 pl-4">
            <span className="text-[22px]">📝</span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-goldenrod text-[15px] leading-tight font-extrabold">Unsaved changes</div>
              <div className="truncate text-[12.5px] opacity-80">
                {where.join(" · ")}
                <span className="hidden sm:inline"> — nothing changes on the TV until you save</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onDiscard}
              className="font-display text-surface/80 hover:text-surface shrink-0 cursor-pointer rounded-[10px] px-2.5 py-2 text-[14px] font-bold"
            >
              Discard
            </button>
            <Button variant="success" onClick={onSave} disabled={saving} className="shrink-0">
              {saving ? "Saving…" : "Save"}
              <kbd className="hidden rounded border border-current/30 px-1 text-[11px] font-bold opacity-60 md:inline">⌘S</kbd>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Toasts({ toasts }: { toasts: { id: number; msg: string; bad: boolean }[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col items-center gap-2 sm:top-20 sm:right-5 sm:left-auto sm:items-end">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            role={t.bad ? "alert" : "status"}
            className={cx(
              "border-line font-display shadow-card max-w-[min(420px,100%)] rounded-[14px] border-2 px-4 py-2.5 text-[14.5px] font-bold",
              t.bad ? "bg-sunset-orange text-white" : "bg-leaf text-ink",
            )}
          >
            {t.bad ? "⚠️ " : ""}
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
