"use client";

import { useMemo, useState } from "react";
import type { Player, PublicState, Submission } from "@/lib/types";
import { Avatar, Badge, buttonClass, cx, Input, Panel, scoreInk } from "../ui";
import { ActButton, Empty, Segmented, TabHeader } from "./controls";
import { type Act, plural } from "./shared";

type Filter = "all" | "humans" | "bots" | "hidden";

export function PlayersTab({ state, act, adminKey }: { state: PublicState; act: Act; adminKey: string }) {
  const admin = state.admin!;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const subs = useMemo(() => {
    const m = new Map<string, Submission>();
    for (const s of admin.subs) m.set(`${s.round}:${s.playerId}`, s);
    return m;
  }, [admin.subs]);

  const humans = state.players.filter((p) => !p.bot).length;
  const bots = state.players.length - humans;
  const hidden = state.players.filter((p) => p.hidden).length;
  const query = q.trim().toLowerCase();
  const shown = state.players.filter(
    (p) =>
      (filter === "all" || (filter === "humans" && !p.bot) || (filter === "bots" && p.bot) || (filter === "hidden" && p.hidden)) &&
      (!query || p.name.toLowerCase().includes(query)),
  );
  const cols = `minmax(0,1fr) repeat(${state.rounds.length}, 4.5rem) auto`;

  return (
    <div>
      <TabHeader
        title="Players"
        blurb="Everyone in the kitchen, with their score each round. Tap a chef to read their offers. Hidden chefs stay in the game but off the TV."
        actions={
          <a href={`/api/admin/export?key=${encodeURIComponent(adminKey)}`} className={buttonClass("success", "md")}>
            ⬇ Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px]">🔎</span>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chefs…" className="pl-9" />
        </div>
        <div className="max-w-full overflow-x-auto">
          <Segmented
            size="sm"
            label="Filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All · ${state.players.length}` },
              { value: "humans", label: `People · ${humans}` },
              { value: "bots", label: `Bots · ${bots}` },
              { value: "hidden", label: `Hidden · ${hidden}` },
            ]}
          />
        </div>
      </div>

      <Panel title={`👥 ${plural(shown.length, "chef")}${query || filter !== "all" ? " match" : ""}`} tone="alt" bodyClassName="p-0">
        {/* Column heads */}
        <div
          className="border-line/15 bg-surface-alt font-display text-ink-soft hidden items-center gap-3 border-b-2 px-4 py-2 text-[11.5px] font-extrabold tracking-[0.08em] uppercase md:grid"
          style={{ gridTemplateColumns: cols }}
        >
          <span>Chef</span>
          {state.rounds.map((r, i) => (
            <span key={i} className="truncate text-center" title={r.name}>
              R{i + 1}
            </span>
          ))}
          <span className="w-36 text-right">Actions</span>
        </div>

        {shown.length === 0 ? (
          <div className="p-5">
            <Empty pose="think">{state.players.length ? "No chefs match that." : "Nobody's here yet. Share the QR code on the TV!"}</Empty>
          </div>
        ) : (
          <div className="divide-line/10 divide-y-2">
            {shown.map((p) => (
              <Row
                key={p.id}
                player={p}
                state={state}
                cols={cols}
                subs={subs}
                open={open === p.id}
                toggle={() => setOpen(open === p.id ? null : p.id)}
                act={act}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Row({
  player: p,
  state,
  cols,
  subs,
  open,
  toggle,
  act,
}: {
  player: Player;
  state: PublicState;
  cols: string;
  subs: Map<string, Submission>;
  open: boolean;
  toggle: () => void;
  act: Act;
}) {
  const grades = state.admin!.grades;
  const [renaming, setRenaming] = useState<string | null>(null);

  const cell = (round: number) => {
    const sub = subs.get(`${round}:${p.id}`);
    if (!sub) return <span className="text-ink-soft/60">—</span>;
    const rec = grades[`${round}:${p.id}`];
    if (!rec || rec.forVersion !== sub.version || rec.status === "pending") return <span title="In the oven">⏳</span>;
    if (rec.status === "error")
      return (
        <Badge tone="danger" title={rec.error}>
          error
        </Badge>
      );
    return (
      <span className="font-display text-[16px] font-extrabold tabular-nums" style={{ color: scoreInk(rec.grade!.overall) }}>
        {rec.grade!.overall}
        <span className="text-[12px]">{rec.grade!.letter}</span>
      </span>
    );
  };

  const rename = async () => {
    const name = renaming?.trim();
    if (!name || name === p.name) return setRenaming(null);
    if (await act({ action: "renamePlayer", playerId: p.id, name }, `Renamed to ${name}`)) setRenaming(null);
  };

  return (
    <div className={cx("transition-colors", open ? "bg-goldenrod/15" : "hover:bg-surface-alt/70", p.hidden && "bg-grout/30")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:grid" style={{ gridTemplateColumns: cols }}>
        {/* Chef */}
        <div className="flex min-w-0 basis-full items-center gap-2.5 md:basis-auto">
          <Avatar player={p} size={34} dim={p.hidden} />
          {renaming !== null ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void rename();
              }}
            >
              <Input
                autoFocus
                value={renaming}
                maxLength={18}
                onChange={(e) => setRenaming(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                className="h-9 min-w-0 flex-1 py-1 text-[15px]"
              />
              <button type="submit" className={buttonClass("success", "sm")}>
                Save
              </button>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setRenaming(null)}>
                ✕
              </button>
            </form>
          ) : (
            <>
              <button type="button" onClick={toggle} className="flex min-w-0 cursor-pointer items-center gap-1.5 text-left">
                <span className={cx("font-display text-ink truncate text-[15px] font-bold", p.hidden && "line-through opacity-60")}>{p.name}</span>
                {p.seat ? (
                  <span title="Demo phone">📱</span>
                ) : p.bot ? (
                  <span title="Rehearsal bot">🤖</span>
                ) : null}
                <span className="text-ink-soft text-[11px]">{open ? "▲" : "▼"}</span>
              </button>
              <button
                type="button"
                title="Rename"
                aria-label={`Rename ${p.name}`}
                onClick={() => setRenaming(p.name)}
                className="text-ink-soft hover:text-ink shrink-0 cursor-pointer rounded-md px-1 text-[13px]"
              >
                ✏️
              </button>
              {p.hidden && <Badge>hidden</Badge>}
            </>
          )}
        </div>

        {/* Scores */}
        {state.rounds.map((_, i) => (
          <div key={i} className="flex items-center gap-1.5 md:justify-center">
            <span className="text-ink-soft font-display text-[11px] font-extrabold md:hidden">R{i + 1}</span>
            {cell(i)}
          </div>
        ))}

        {/* Actions */}
        <div className="ml-auto flex w-auto justify-end gap-1.5 md:w-36">
          <ActButton size="sm" variant="secondary" run={() => act({ action: "hidePlayer", playerId: p.id, hidden: !p.hidden }, p.hidden ? `${p.name} is back on the TV` : `${p.name} hidden from the TV`)}>
            {p.hidden ? "Unhide" : "Hide"}
          </ActButton>
          <ActButton
            size="sm"
            variant="danger"
            run={async () => {
              if (confirm(`Remove ${p.name} from the game? Their offers leave the leaderboard and the CSV export.`)) await act({ action: "kickPlayer", playerId: p.id }, `${p.name} removed`);
            }}
          >
            Kick
          </ActButton>
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 gap-3 px-4 pb-4 md:pl-[3.75rem]">
          {state.rounds.map((r, i) => {
            const text = subs.get(`${i}:${p.id}`)?.text;
            return (
              <div key={i} className="border-line/15 bg-surface-plain rounded-[12px] border-2 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[14px] font-extrabold">
                    R{i + 1} · {r.name}
                  </span>
                  <span className="ml-1">{cell(i)}</span>
                  {text && (
                    <ActButton size="sm" variant="ghost" className="ml-auto" run={() => act({ action: "regrade", round: i, playerId: p.id }, "Back in the oven…")}>
                      🔁 Regrade
                    </ActButton>
                  )}
                </div>
                <p className={cx("font-literal mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-wrap", text ? "text-ink-muted" : "text-ink-soft italic")}>
                  {text ?? "No offer this round."}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
