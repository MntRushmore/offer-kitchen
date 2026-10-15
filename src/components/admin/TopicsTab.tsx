"use client";

import { useState } from "react";
import { TOPIC_ART, topicBrief, topicImage } from "@/lib/constants";
import type { GameConfig, PublicState, TopicCard } from "@/lib/types";
import { Art, Badge, Button, cx, Field, Input, OfferBrief, Panel, Textarea, TopicArt } from "../ui";
import { Count, Eyebrow, TabHeader } from "./controls";
import { adminFetch, type Edit, type Flash } from "./shared";

const FIELDS: { key: "buyer" | "pain" | "alternatives" | "scope" | "economics"; label: string; hint: string }[] = [
  { key: "buyer", label: "👥 Who might buy", hint: "Two or three buyer groups, separated by semicolons. Each chef picks one." },
  { key: "pain", label: "😩 What hurts", hint: "What it costs them today, in time or money." },
  { key: "alternatives", label: "🏪 What they use today", hint: "Real price ranges help the grader judge a premium price." },
  { key: "scope", label: "🛠️ Your setup", hint: "Capacity, hours and equipment. Offers are held to this." },
  { key: "economics", label: "💵 Your costs", hint: "Costs and hours per job, so margins can be checked." },
];

const blank = (): TopicCard => ({
  id: `topic-${Date.now().toString(36)}`,
  title: "New topic",
  emoji: "🍽️",
  image: null,
  brief: [],
  buyer: "",
  pain: "",
  alternatives: "",
  scope: "",
  economics: "",
  absurdPrice: 20000,
});

export function TopicsTab({
  state,
  config,
  edit,
  flash,
  adminKey,
}: {
  state: PublicState;
  config: GameConfig;
  edit: Edit;
  flash: Flash;
  adminKey: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const topic = config.topics.find((t) => t.id === selected) ?? config.topics[0];
  const usedBy = (id: string) => config.rounds.flatMap((r, i) => (r.topicId === id ? [i + 1] : []));

  const update = (id: string, patch: Partial<TopicCard>) =>
    edit((c) => ({ ...c, topics: c.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const add = (t: TopicCard) => {
    const ids = new Set(config.topics.map((x) => x.id));
    let id = t.id;
    for (let n = 2; ids.has(id); n++) id = `${t.id}-${n}`;
    edit((c) => ({ ...c, topics: [...c.topics, { ...t, id }] }));
    setSelected(id);
  };

  return (
    <div>
      <TabHeader
        title="Topic cards"
        blurb="The order ticket every chef writes against: who buys, what hurts, what they use today, and your setup and costs. The grader checks offers against it."
      />

      <AiWriter adminKey={adminKey} aiConfigured={state.admin!.aiConfigured} onTopic={add} flash={flash} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:items-start">
        {/* List */}
        <div className="flex flex-col gap-2 lg:sticky lg:top-24">
          <Eyebrow className="px-1">{config.topics.length} cards</Eyebrow>
          <div className="flex flex-col gap-1.5">
            {config.topics.map((t) => {
              const used = usedBy(t.id);
              const on = t.id === topic?.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelected(t.id);
                    // On phones the editor sits below the list.
                    if (window.innerWidth < 1024) document.getElementById("topic-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cx(
                    "flex cursor-pointer items-center gap-3 rounded-[14px] border-2 p-2 text-left transition-all",
                    on ? "border-line bg-goldenrod shadow-control" : "border-line/15 bg-surface hover:border-line/50",
                  )}
                >
                  <span className="border-line bg-surface-plain grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[11px] border-2">
                    <TopicArt topic={t} className="h-9 w-9 text-[26px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-display text-ink block truncate text-[15px] font-extrabold">{t.title || "Untitled"}</span>
                    <span className="text-ink-soft block truncate text-[12px] font-semibold">
                      {used.length ? `Used in round ${used.join(", ")}` : "Not in any round"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <Button variant="secondary" size="sm" className="mt-1 self-start" disabled={config.topics.length >= 30} onClick={() => add(blank())}>
            + Blank card
          </Button>
        </div>

        {/* Editor */}
        {topic && (
          <div id="topic-editor" className="min-w-0 scroll-mt-20">
            <TopicEditor
              key={topic.id}
              topic={topic}
              used={usedBy(topic.id)}
              canDelete={config.topics.length > 1}
              canAdd={config.topics.length < 30}
              update={(patch) => update(topic.id, patch)}
              duplicate={() => add({ ...topic, id: `${topic.id}-copy`, title: `${topic.title} (copy)`.slice(0, 80) })}
              remove={() => {
                if (!confirm(`Delete “${topic.title}”? You can still discard before saving.`)) return;
                edit((c) => ({ ...c, topics: c.topics.filter((x) => x.id !== topic.id) }));
                setSelected(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TopicEditor({
  topic: t,
  used,
  canDelete,
  canAdd,
  update,
  duplicate,
  remove,
}: {
  topic: TopicCard;
  used: number[];
  canDelete: boolean;
  canAdd: boolean;
  update: (patch: Partial<TopicCard>) => void;
  duplicate: () => void;
  remove: () => void;
}) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {t.emoji} {t.title || "Untitled"}
          {used.length > 0 && (
            <Badge tone="success" className="max-sm:hidden">
              In use
            </Badge>
          )}
        </span>
      }
      actions={
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="secondary" onClick={duplicate} disabled={!canAdd}>
            ⧉ <span className="max-sm:hidden">Duplicate</span>
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={remove}
            disabled={used.length > 0 || !canDelete}
            title={used.length ? "Used by a round. Switch that round's topic first." : undefined}
          >
            🗑 <span className="max-sm:hidden">Delete</span>
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <Field label="Emoji">
              <Input value={t.emoji} maxLength={16} onChange={(e) => update({ emoji: e.target.value })} className="text-center text-[20px]" />
            </Field>
            <Field
              label={
                <span className="flex items-baseline justify-between gap-2">
                  Title
                  <Count n={t.title.length} max={80} />
                </span>
              }
            >
              <Input value={t.title} maxLength={80} onChange={(e) => update({ title: e.target.value })} />
            </Field>
          </div>

          <ImagePicker topic={t} update={update} />

          <Field
            label="📝 Short version"
            hint="What players see while they write: 2–3 short bullets, one per line. Leave it empty to use the first line of who buys, what they use today and your setup."
          >
            <Textarea
              rows={3}
              value={(t.brief ?? []).join("\n")}
              onChange={(e) => update({ brief: e.target.value.split("\n").slice(0, 4) })}
              placeholder={topicBrief({ ...t, brief: [] }).join("\n")}
              className="[field-sizing:content] min-h-24"
            />
          </Field>

          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <Textarea
                rows={Math.min(9, Math.max(3, Math.ceil(t[f.key].length / 58) + 1))}
                maxLength={1500}
                value={t[f.key]}
                onChange={(e) => update({ [f.key]: e.target.value })}
                className="max-h-80 min-h-24 [field-sizing:content]"
              />
            </Field>
          ))}

          <Field label="💸 Unrealistic price" hint="Any dollar amount at or above this trips the “unrealistic price” check.">
            <div className="relative max-w-56">
              <span className="font-display text-ink-soft pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-bold">$</span>
              <Input
                type="number"
                min={1}
                value={t.absurdPrice}
                onChange={(e) => update({ absurdPrice: Math.max(1, Number(e.target.value) || 20000) })}
                className="pl-7"
              />
            </div>
          </Field>

          {used.length > 0 && <p className="text-ink-soft text-[13px] font-semibold">Used in round {used.join(", ")}. To delete it, switch those rounds to another card first.</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Eyebrow>Preview</Eyebrow>
          <div className="bg-tiles bg-tiles-sm border-line rounded-[16px] border-2 px-3 pt-5 pb-2">
            <OfferBrief topic={t} />
          </div>
          <p className="text-ink-soft text-[13px]">This is what chefs see on their phones and the TV. The full card is one tap away on phones, and the grader always gets all of it.</p>
        </div>
      </div>
    </Panel>
  );
}

function ImagePicker({ topic, update }: { topic: TopicCard; update: (patch: Partial<TopicCard>) => void }) {
  const img = topic.image ?? null;
  const custom = img !== null && !TOPIC_ART[img];
  const [url, setUrl] = useState(custom ? img : "");
  const badUrl = url.trim() !== "" && !topicImage({ image: url.trim() });
  const tile = (on: boolean) =>
    cx(
      "flex cursor-pointer flex-col items-center gap-1 rounded-[14px] border-2 p-1.5 transition-all",
      on ? "border-line bg-goldenrod/60 shadow-control" : "border-line/15 bg-surface-plain hover:border-line/50",
    );
  return (
    <div>
      <div className="font-display text-body text-ink mb-1.5 font-bold">Picture</div>
      <div className="grid grid-cols-4 gap-2 2xl:grid-cols-8">
        <button type="button" className={tile(img === null)} onClick={() => update({ image: null })} aria-pressed={img === null}>
          <span className="grid aspect-square w-full place-items-center text-[30px] leading-none">{topic.emoji || "🍽️"}</span>
          <span className="text-ink-muted text-[10.5px] leading-tight font-bold">Emoji only</span>
        </button>
        {Object.entries(TOPIC_ART).map(([key, art]) => (
          <button key={key} type="button" className={tile(img === key)} onClick={() => update({ image: key })} aria-pressed={img === key} title={art.label}>
            <Art src={art.src} alt={art.label} className="aspect-square w-full object-contain" />
            <span className="text-ink-muted w-full truncate text-center text-[10.5px] leading-tight font-bold">{art.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={tile(custom)}
          onClick={() => url.trim() && !badUrl && update({ image: url.trim() })}
          aria-pressed={custom}
          title="Custom image URL"
        >
          {custom && topicImage(topic) ? (
            <Art src={topicImage(topic)!} className="aspect-square w-full object-contain" />
          ) : (
            <span className="text-ink-soft grid aspect-square w-full place-items-center text-[26px]">🔗</span>
          )}
          <span className="text-ink-muted text-[10.5px] leading-tight font-bold">Custom</span>
        </button>
      </div>
      <div className="mt-2.5 flex gap-2">
        <Input
          value={url}
          placeholder="Or paste an image URL: https://… or /art/…"
          onChange={(e) => {
            const v = e.target.value;
            setUrl(v);
            if (v.trim() && topicImage({ image: v.trim() })) update({ image: v.trim() });
            else if (!v.trim() && custom) update({ image: null });
          }}
          className="text-[14px]"
        />
      </div>
      {badUrl && <p className="text-sunset-orange mt-1 text-[12.5px] font-bold">Image links must start with https://, http:// or /</p>}
    </div>
  );
}

/** Describe a side hustle; Claude drafts the whole card. */
function AiWriter({ adminKey, aiConfigured, onTopic, flash }: { adminKey: string; aiConfigured: boolean; onTopic: (t: TopicCard) => void; flash: Flash }) {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const write = async () => {
    setBusy(true);
    setErr(null);
    try {
      const data = (await adminFetch(adminKey, "/api/admin/topic", { idea })) as { topic?: TopicCard; error?: string };
      if (!data.topic) throw new Error(data.error ?? "No card came back. Try again?");
      onTopic(data.topic);
      setIdea("");
      flash(`✨ “${data.topic.title}” drafted. Review it, then save.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="✨ Write a card with AI" tone="pink">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (idea.trim() && !busy) void write();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <Input
          value={idea}
          maxLength={300}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g. “dog walking for busy families”"
          disabled={busy}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="dark" disabled={!idea.trim() || busy} className="shrink-0">
          {busy ? "✍️ Writing… (up to a minute)" : "✨ Write it"}
        </Button>
      </form>
      {err ? (
        <p className="text-sunset-orange mt-2 text-[13.5px] font-bold">⚠️ {err}</p>
      ) : (
        <p className="text-ink-soft mt-2 text-[12.5px]">
          {aiConfigured
            ? "Claude drafts the buyers, pain, price ranges, setup and costs. It lands in your unsaved changes so you can tweak it first."
            : "AI isn't connected on the server, so this won't work until it is. You can still write cards by hand."}
        </p>
      )}
    </Panel>
  );
}
