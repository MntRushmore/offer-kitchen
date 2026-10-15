"use client";

import { roundArt } from "@/lib/constants";
import type { GameConfig, PublicState, RoundConfig, Scaffold } from "@/lib/types";
import { Art, Badge, Button, cx, Field, Input, Panel, Select, Textarea, TopicArt } from "../ui";
import { Count, Eyebrow, Stepper, TabHeader } from "./controls";
import { type Edit, plural } from "./shared";

const SCAFFOLDS: { value: Scaffold; title: string; blurb: string }[] = [
  { value: "blank", title: "Blank page", blurb: "One big text box and no hints. See what people already know." },
  { value: "checklist", title: "Text box + checklist", blurb: "The six ingredients tick off on screen as they write." },
  { value: "guided", title: "Six guided fields", blurb: "One box per ingredient, stitched into a full offer for grading." },
];

const MAX_ROUNDS = 6;

export function RoundsTab({ state, config, edit }: { state: PublicState; config: GameConfig; edit: Edit }) {
  const rounds = config.rounds;
  const update = (i: number, patch: Partial<RoundConfig>) =>
    edit((c) => ({ ...c, rounds: c.rounds.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const move = (i: number, d: number) =>
    edit((c) => {
      const rs = [...c.rounds];
      const [r] = rs.splice(i, 1);
      rs.splice(i + d, 0, r);
      return { ...c, rounds: rs };
    });
  const cookMinutes = rounds.reduce((a, r) => a + r.minutes, 0);
  const { game } = state;
  const liveRound = game.phase !== "lobby" && game.phase !== "final" ? game.roundIndex : -1;

  return (
    <div>
      <TabHeader
        title="Rounds"
        blurb="Each round is a course: a topic card, a phone layout and a timer. Offers usually get sharper as the layout gets more guided."
        actions={
          <div className="border-line bg-surface shadow-control flex items-center gap-3 rounded-[14px] border-2 px-3.5 py-2">
            <span className="font-display text-[14px] font-extrabold">{plural(rounds.length, "round")}</span>
            <span className="bg-line/20 h-4 w-[2px]" />
            <span className="font-display text-[14px] font-extrabold">⏱️ {cookMinutes} min of cooking</span>
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        {rounds.map((r, i) => {
          const topic = config.topics.find((t) => t.id === r.topicId);
          const finalists = r.finalists ?? 0;
          return (
            <Panel
              key={i}
              tone={i === liveRound ? "brand" : "plain"}
              title={
                <span className="flex items-center gap-2">
                  Round {i + 1}
                  <span className="text-ink-soft truncate font-bold">· {r.name || "Untitled"}</span>
                  {finalists > 0 && <span title={`Top ${finalists} finalists`}>🏆</span>}
                  {i === liveRound && <Badge tone="danger">On the TV</Badge>}
                </span>
              }
              actions={
                <div className="flex shrink-0 gap-1">
                  <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </IconBtn>
                  <IconBtn label="Move down" disabled={i === rounds.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </IconBtn>
                  <IconBtn
                    label="Duplicate"
                    disabled={rounds.length >= MAX_ROUNDS}
                    onClick={() => edit((c) => ({ ...c, rounds: [...c.rounds.slice(0, i + 1), { ...r, tips: [...r.tips] }, ...c.rounds.slice(i + 1)] }))}
                  >
                    ⧉
                  </IconBtn>
                  <IconBtn
                    label="Remove"
                    danger
                    disabled={rounds.length <= 1}
                    onClick={() => edit((c) => ({ ...c, rounds: c.rounds.filter((_, j) => j !== i) }))}
                  >
                    ✕
                  </IconBtn>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
                {/* Art */}
                <div className="flex flex-row items-center gap-4 md:flex-col md:items-stretch">
                  <div className="border-line bg-tiles bg-tiles-sm relative grid aspect-square w-28 shrink-0 place-items-center overflow-hidden rounded-[16px] border-2 md:w-full">
                    <Art src={roundArt(r)} alt="" className="h-[86%] w-[86%] object-contain" />
                    <span className="font-sign text-sticker absolute top-1.5 left-2.5 text-[30px] leading-none">{i + 1}</span>
                  </div>
                  <div className="min-w-0">
                    <Eyebrow>Timer</Eyebrow>
                    <div className="mt-1.5">
                      <Stepper
                        value={r.minutes}
                        min={0.5}
                        max={60}
                        step={0.5}
                        format={(m) => `${m} min`}
                        onChange={(minutes) => update(i, { minutes })}
                        label="Timer minutes"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={<LabelCount text="Name" n={r.name.length} max={40} />}>
                      <Input value={r.name} maxLength={40} onChange={(e) => update(i, { name: e.target.value })} />
                    </Field>
                    <Field label={<LabelCount text="Subtitle" n={r.subtitle.length} max={120} />}>
                      <Input value={r.subtitle} maxLength={120} onChange={(e) => update(i, { subtitle: e.target.value })} />
                    </Field>
                  </div>

                  <Field label="Topic card">
                    <div className="flex items-center gap-3">
                      <div className="border-line bg-surface-plain grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[12px] border-2">
                        {topic ? <TopicArt topic={topic} className="h-10 w-10 text-[30px]" /> : <span className="text-[22px]">❓</span>}
                      </div>
                      <Select value={r.topicId} onChange={(e) => update(i, { topicId: e.target.value })} className="min-w-0 flex-1">
                        {!topic && <option value={r.topicId}>⚠️ Missing topic: pick one</option>}
                        {config.topics.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.emoji} {t.title}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </Field>

                  <div>
                    <div className="font-display text-body text-ink mb-1.5 font-bold">Phone layout</div>
                    <div role="radiogroup" aria-label="Phone layout" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {SCAFFOLDS.map((s) => (
                        <Choice key={s.value} on={r.scaffold === s.value} title={s.title} blurb={s.blurb} onClick={() => update(i, { scaffold: s.value })} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="font-display text-body text-ink mb-1.5 font-bold">Who writes</div>
                    <div role="radiogroup" aria-label="Who writes" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Choice on={!finalists} title="Everyone" blurb="Every chef writes an offer." onClick={() => update(i, { finalists: 0 })} />
                      <Choice
                        on={finalists > 0}
                        disabled={i === 0 && !finalists}
                        title="Only the top finalists"
                        blurb={i === 0 ? "Not in round 1: nobody has a score yet." : "Everyone else watches this round."}
                        onClick={() => !finalists && update(i, { finalists: 5 })}
                      />
                    </div>
                    {finalists > 0 && (
                      <div className="font-display text-ink mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] font-bold">
                        Only the top
                        <Stepper value={finalists} min={1} max={40} onChange={(n) => update(i, { finalists: n })} label="Number of finalists" />
                        {finalists === 1 ? "chef writes" : "chefs write"}
                      </div>
                    )}
                    {i === 0 && finalists > 0 && (
                      <p className="text-sunset-orange mt-2 text-[13.5px] font-bold">⚠️ Round 1 can’t be a finals round. Switch it to Everyone before saving.</p>
                    )}
                    <p className="text-ink-soft mt-2 text-[13.5px] leading-snug">
                      Finalists are the top {finalists > 0 ? finalists : "chefs"} by best score from earlier rounds; everyone else watches and plays the
                      mini-game. You can swap people when the round starts.
                    </p>
                  </div>

                  <Field
                    label={
                      <span className="flex items-baseline justify-between gap-2">
                        Tips on the phones
                        <span className="text-ink-soft text-[11px] font-bold">{plural(r.tips.filter((t) => t.trim()).length, "tip")} · max 10</span>
                      </span>
                    }
                    hint="One per line. They show as swipeable cards while people write."
                  >
                    <Textarea
                      rows={Math.min(8, Math.max(3, r.tips.length + 1))}
                      value={r.tips.join("\n")}
                      onChange={(e) =>
                        update(i, {
                          tips: e.target.value
                            .split("\n")
                            .filter((t, j, a) => t.trim() !== "" || j === a.length - 1)
                            .slice(0, 10),
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            </Panel>
          );
        })}

        <Button
          variant="brand"
          size="lg"
          className="self-start"
          disabled={rounds.length >= MAX_ROUNDS}
          onClick={() =>
            edit((c) => ({
              ...c,
              rounds: [
                ...c.rounds,
                { name: "Bonus", subtitle: "One more for the road.", topicId: c.topics[0].id, scaffold: "guided", minutes: 5, tips: [], finalists: 0 },
              ],
            }))
          }
        >
          + Add a round
        </Button>
        {rounds.length >= MAX_ROUNDS && <p className="text-ink-soft -mt-3 text-[13px] font-bold">That’s the max: six rounds.</p>}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "border-line font-display grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-2 text-[15px] font-extrabold shadow-[0_2px_0_rgba(97,51,1,0.25)] transition-all",
        "hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0",
        danger ? "bg-sunset-orange text-white" : "bg-surface-plain hover:bg-goldenrod/50",
      )}
    >
      {children}
    </button>
  );
}

/** One option in a row of radio cards. */
function Choice({
  on,
  title,
  blurb,
  onClick,
  disabled,
}: {
  on: boolean;
  title: React.ReactNode;
  blurb: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex cursor-pointer items-start gap-2.5 rounded-[14px] border-2 p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-55",
        on ? "border-line bg-goldenrod/60 shadow-control" : "border-line/20 bg-surface-plain hover:border-line/60 disabled:hover:border-line/20",
      )}
    >
      <span className={cx("border-line mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", on ? "bg-ink" : "bg-surface-plain")}>
        {on && <span className="bg-goldenrod h-2 w-2 rounded-full" />}
      </span>
      <span className="min-w-0">
        <span className="font-display text-ink block text-[14.5px] leading-tight font-extrabold">{title}</span>
        <span className="text-ink-muted mt-0.5 block text-[13px] leading-snug">{blurb}</span>
      </span>
    </button>
  );
}

function LabelCount({ text, n, max }: { text: string; n: number; max: number }) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      {text}
      <Count n={n} max={max} />
    </span>
  );
}
