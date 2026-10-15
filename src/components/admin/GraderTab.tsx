"use client";

import { useState } from "react";
import { MODELS } from "@/lib/constants";
import type { GameConfig, Grade, PublicState, TopicCard } from "@/lib/types";
import { Badge, Button, cx, Field, GradeBadge, Mascot, OfferFacts, Panel, scoreInk, Select, Textarea, TopicArt } from "../ui";
import { Eyebrow, Segmented, SettingRow, TabHeader } from "./controls";
import { adminFetch, type Edit } from "./shared";

export function GraderTab({
  state,
  config,
  edit,
  adminKey,
  dirty,
}: {
  state: PublicState;
  config: GameConfig;
  edit: Edit;
  adminKey: string;
  dirty: boolean;
}) {
  const admin = state.admin!;
  const custom = config.graderPrompt !== null;
  const prompt = config.graderPrompt ?? admin.defaultPrompt;

  return (
    <div>
      <TabHeader
        title="The grader"
        blurb="Claude tastes every plate against the six ingredients and the round's topic card. Tune how strict it is, then taste-test it before the show."
      />

      <div className="flex flex-col gap-6">
        <div
          className={cx(
            "border-line flex items-center gap-3 rounded-[16px] border-2 px-4 py-3",
            admin.aiConfigured ? "bg-leaf/30" : "bg-goldenrod/60",
          )}
        >
          <span className="text-[26px]">{admin.aiConfigured ? "✅" : "⚠️"}</span>
          <div className="text-[14.5px] leading-snug">
            <b className="font-display">{admin.aiConfigured ? "AI Gateway connected." : "No AI credentials on the server."}</b>{" "}
            {admin.aiConfigured
              ? "Real Claude grading is ready."
              : "Every grade will be simulated until AI Gateway is connected. Fine for rehearsals, not for the real show."}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <Panel title="🧑‍⚖️ How offers get graded" tone="brand">
            <SettingRow title="Grading" hint={config.gradingMode === "ai" ? "Claude reads and scores every offer." : "Instant, free, believable fake grades. For rehearsals."} stack>
              <Segmented
                full
                label="Grading mode"
                value={config.gradingMode}
                onChange={(gradingMode) => edit((c) => ({ ...c, gradingMode }))}
                options={[
                  { value: "ai", label: "🤖 Claude (real)" },
                  { value: "mock", label: "🎭 Simulated (free)" },
                ]}
              />
            </SettingRow>
            <SettingRow title="Model" hint="Also writes AI topic cards." stack>
              <Select value={config.model} onChange={(e) => edit((c) => ({ ...c, model: e.target.value }))}>
                {!MODELS.some((m) => m.id === config.model) && <option value={config.model}>{config.model}</option>}
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </SettingRow>
          </Panel>

          <Panel title="🧂 What's always checked" tone="plain">
            <p className="text-ink-muted text-[14px] leading-snug">On top of the prompt, the server flags these on every plate, whatever the prompt says:</p>
            <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[14px] sm:grid-cols-2">
              {["🙊 Buzzwords", "💸 Unrealistic prices", "🔁 Refunds that are a multiple of the price", "✂️ Offers that are too short", "🗣️ Talking to the grader"].map((x) => (
                <li key={x} className="border-line/15 bg-surface-plain rounded-[10px] border-2 px-2.5 py-1.5 font-semibold">
                  {x}
                </li>
              ))}
            </ul>
            <p className="text-ink-soft mt-3 text-[12.5px]">Bots and demo phones follow their own switches in the Show and Demo tabs.</p>
          </Panel>
        </div>

        <Panel
          title={
            <span className="flex items-center gap-2">
              📜 Grader prompt
              <Badge tone={custom ? "warning" : "neutral"}>{custom ? "Custom" : "Default"}</Badge>
            </span>
          }
          tone="alt"
          actions={
            custom && (
              <Button size="sm" variant="secondary" onClick={() => edit((c) => ({ ...c, graderPrompt: null }))}>
                ↺ Back to default
              </Button>
            )
          }
        >
          <p className="text-ink-muted mb-3 text-[14px] leading-snug">
            Adapted from the Offer Karaoke grader for parents pitching as themselves. Edits apply to new grades once you save.
          </p>
          <Textarea
            mono
            rows={18}
            value={prompt}
            onChange={(e) => edit((c) => ({ ...c, graderPrompt: e.target.value === admin.defaultPrompt ? null : e.target.value }))}
            className="max-h-[70vh]"
          />
          <div className="text-ink-soft mt-1.5 text-right text-[11.5px] font-bold tabular-nums">{prompt.length.toLocaleString()} / 40,000</div>
        </Panel>

        <TasteTest config={config} adminKey={adminKey} dirty={dirty} />
      </div>
    </div>
  );
}

/* ---------- Taste test ---------- */

function TasteTest({ config, adminKey, dirty }: { config: GameConfig; adminKey: string; dirty: boolean }) {
  const [topicId, setTopicId] = useState(config.rounds[0]?.topicId ?? config.topics[0]?.id);
  const topic = config.topics.find((t) => t.id === topicId) ?? config.topics[0];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Grade | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const data = (await adminFetch(adminKey, "/api/admin/test", { topicId: topic.id, text })) as { grade: Grade };
      setResult(data.grade);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="🥄 Taste test" tone="lime">
      <p className="text-ink-muted mb-4 text-[14px] leading-snug">
        Grade any offer exactly the way the show would. Uses the <b>saved</b> settings
        {dirty && <b className="text-carrot-orange"> (you have unsaved changes: save first to test them)</b>}.
      </p>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Field label="Topic">
            <div className="flex items-center gap-3">
              <span className="border-line bg-surface-plain grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[11px] border-2">
                {topic && <TopicArt topic={topic} className="h-9 w-9 text-[26px]" />}
              </span>
              <Select value={topic?.id} onChange={(e) => setTopicId(e.target.value)} className="min-w-0 flex-1">
                {config.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.title}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-display text-body text-ink mr-auto font-bold">Offer</span>
              <Eyebrow>Try a sample:</Eyebrow>
              {(["raw", "seasoned", "slam"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => topic && setText(sampleOffer(topic, lvl))}
                  className="border-line/30 bg-surface-plain hover:border-line hover:bg-goldenrod/50 font-display cursor-pointer rounded-full border-2 px-2.5 py-0.5 text-[12.5px] font-bold transition-colors"
                >
                  {SAMPLE_LABEL[lvl]}
                </button>
              ))}
            </div>
            <Textarea rows={11} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or type an offer, or pick a sample above…" />
          </div>
          <Button size="lg" onClick={run} disabled={busy || !text.trim()}>
            {busy ? "Tasting…" : "🥄 Grade it"}
          </Button>
          {err && <p className="text-sunset-orange text-[14px] font-bold">⚠️ {err}</p>}
        </div>

        <div className="min-w-0">
          {busy ? (
            <div className="border-line/25 bg-surface-alt/70 flex h-full min-h-72 flex-col items-center justify-center gap-3 rounded-[16px] border-2 border-dashed p-6 text-center">
              <Mascot pose="taste" className="animate-bob h-32 w-32" />
              <div className="font-display text-[17px] font-extrabold">Tasting…</div>
              <p className="text-ink-soft text-[13px]">Real grading takes 5–30 seconds.</p>
            </div>
          ) : result ? (
            <GradeResult grade={result} />
          ) : (
            <div className="border-line/25 bg-surface-alt/70 flex h-full min-h-72 flex-col items-center justify-center gap-3 rounded-[16px] border-2 border-dashed p-6 text-center">
              <Mascot pose="think" className="h-28 w-28" />
              <p className="text-ink-soft max-w-xs text-[14px] font-semibold">The grade shows up here: the Offer Facts label, the verdict and the next move.</p>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function GradeResult({ grade }: { grade: Grade }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-sign text-[52px] leading-none tabular-nums" style={{ color: scoreInk(grade.overall) }}>
          {grade.overall}
        </span>
        <GradeBadge letter={grade.letter} size="md" />
        {grade.compelling && <Badge tone="success">🤩 Compelling</Badge>}
      </div>
      <div className="border-line bg-sidecar/60 rounded-[14px] border-2 px-4 py-3">
        <Eyebrow>Verdict</Eyebrow>
        <p className="font-display text-ink mt-1 text-[16px] leading-snug font-bold">{grade.verdict}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="border-line/20 bg-surface-plain rounded-[14px] border-2 px-3.5 py-2.5">
          <Eyebrow>💪 Strength</Eyebrow>
          <p className="text-ink mt-1 text-[14px] leading-snug">{grade.strength}</p>
        </div>
        <div className="border-line/20 bg-surface-plain rounded-[14px] border-2 px-3.5 py-2.5">
          <Eyebrow>👉 Next move</Eyebrow>
          <p className="text-ink mt-1 text-[14px] leading-snug">{grade.nextMove}</p>
        </div>
      </div>
      {grade.serverNotes.length > 0 && (
        <div className="border-carrot-orange bg-goldenrod/30 rounded-[14px] border-2 px-3.5 py-2.5">
          <Eyebrow>Server checks</Eyebrow>
          <ul className="mt-1 list-disc pl-5 text-[13.5px]">
            {grade.serverNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      <OfferFacts grade={grade} feedback className="rounded-[4px]" />
      <div className="font-ticket text-ink-soft flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-bold">
        <span>{grade.simulated ? "🎭 Simulated grader" : `🤖 ${grade.model ?? "Claude"}`}</span>
        {grade.ms !== undefined && <span>⏱ {(grade.ms / 1000).toFixed(1)}s</span>}
        <span>{grade.passed ? "✓ Passed" : "✗ Not passing yet"}</span>
      </div>
    </div>
  );
}

/* ---------- Sample offers ---------- */

type Level = "raw" | "seasoned" | "slam";
const SAMPLE_LABEL: Record<Level, string> = { raw: "🥩 Raw", seasoned: "🧂 Seasoned", slam: "🏆 Grand Slam" };

const BIRTHDAY: Record<Level, string> = {
  raw: "I'll throw your kid an awesome birthday party! Games, crafts, the works. I'm super organized and kids love me. Reasonable prices, DM me for details!",
  seasoned:
    "For busy parents of 5–9 year olds: I'll run your kid's home birthday party so you can actually enjoy it. Unlike a trampoline park, it's at your house, and I bring the games, a craft station and do the cleanup. $300 for up to 12 kids, less than most party venues. If the kids aren't having fun, I'll give you a partial refund.",
  slam: `Pitch: I help two-working-parent families throw a 2-hour home birthday party for their 5–9-year-old without planning a thing or refereeing a single game.

Promise: Book by Wednesday and your Saturday party is handled: a 20-minute planning call, a themed games-and-craft plan for up to 12 kids, I host all 2 hours, and the house is reset before the last guest leaves.

Different: Unlike a $450 trampoline-park slot, it's at your home on your schedule. Unlike a $300/hour entertainer, I plan it, run it and clean up. You're a guest at your own kid's party, not the referee.

Price: $395 flat for up to 12 kids (+$15 per extra kid, max 15). That's less than the venue package, and it saves you the 8 hours of planning.

Guarantee: If any planned activity doesn't happen, or the house isn't reset within 30 minutes of the party ending, I refund $100 on the spot. If I ever have to cancel, you get every dollar back plus $50 toward a backup plan.

Delivery: Each party takes me 6 hours and costs about $63 (craft supplies $48 for 12 kids, $15 gas). My $250 games kit pays for itself on party one, so I keep about $330 per party, max two parties per weekend day.`,
};

/** Three offers of rising quality. Tailored for the birthday card, generic for the rest. */
function sampleOffer(topic: TopicCard, level: Level): string {
  if (topic.id === "birthday") return BIRTHDAY[level];
  const job = topic.title.trim().toLowerCase() || "this";
  const first = topic.buyer.split(/[;.]/)[0]?.trim() || "busy families";
  const buyer = first.charAt(0).toLowerCase() + first.slice(1);
  switch (level) {
    case "raw":
      return `Need help with ${job}? I'm your person! Hard-working, reliable and affordable. Kids love me and so do parents. Message me for a quote!`;
    case "seasoned":
      return `For ${buyer}: I'll take ${job} completely off your plate so you get your weekend back. Unlike doing it yourself or hiring a big company, I handle everything start to finish and keep you posted by text. $250 flat, less than most of the alternatives. If you're not happy, I'll come back and make it right.`;
    case "slam":
      return `Pitch: I help ${buyer} get ${job} done in one weekend without lifting a finger.

Promise: Book by Wednesday and it's finished by Sunday at 6pm: planned on a 15-minute call, done while you're out, with before-and-after photos texted to you.

Different: Unlike hiring a big company or burning your own weekend on it, I plan it, do it and clean up for one flat price, and you deal with one person in one text thread.

Price: $350 flat. That's below the typical pro option, and less than what one lost weekend of takeout and supply runs costs you today.

Guarantee: If it isn't done by Sunday at 6pm, I finish it the next weekend for free and refund $75 for the hassle.

Delivery: Each job takes me about 8 hours and roughly $90 in supplies and gas, so I keep about $260. I take at most two jobs a weekend.`;
  }
}
