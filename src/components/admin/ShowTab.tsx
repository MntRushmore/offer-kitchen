"use client";

import { DEFAULT_SHOW, GRADE_TIERS, REVEAL_GAP_MS } from "@/lib/constants";
import type { GameConfig, Letter, ShowSettings } from "@/lib/types";
import { Button, cx, Field, GradeBadge, Input, Logo, Panel, ShowProvider } from "../ui";
import { Count, Eyebrow, Segmented, SettingRow, Slider, Stepper, ToggleRow } from "./controls";
import type { Edit } from "./shared";

const RANGES: Record<Letter, string> = { A: "90–100", B: "80–89", C: "70–79", D: "60–69", F: "0–59" };
const ORDER: Letter[] = ["A", "B", "C", "D", "F"];

export function ShowTab({ config, edit }: { config: GameConfig; edit: Edit }) {
  const s = config.show;
  const set = (patch: Partial<ShowSettings>) => edit((c) => ({ ...c, show: { ...c.show, ...patch } }));
  const setTier = (l: Letter, patch: Partial<ShowSettings["tiers"][Letter]>) =>
    edit((c) => ({ ...c, show: { ...c.show, tiers: { ...c.show.tiers, [l]: { ...c.show.tiers[l], ...patch } } } }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-72">
          <h1 className="font-sign text-ink text-[30px] leading-none sm:text-[36px]">Show settings</h1>
          <p className="text-ink-muted mt-2 max-w-2xl text-[15px] leading-snug">
            How the show looks, sounds and flows. Changes reach the TV and every phone the moment you save.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (confirm("Restore the default look, sound and flow? Demo settings stay. You can still discard before saving.")) {
              edit((c) => ({ ...c, joinUrl: null, show: { ...DEFAULT_SHOW, demo: c.show.demo } }));
            }
          }}
        >
          ↺ Restore defaults
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        {/* Branding */}
        <Panel title="🏷️ Branding" tone="brand">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={<LabelCount text="Show title" n={s.title.length} max={40} />}>
                <Input value={s.title} maxLength={40} onChange={(e) => set({ title: e.target.value })} placeholder="Offer Kitchen" />
              </Field>
              <Field label={<LabelCount text="Host name" n={s.hostName.length} max={40} />}>
                <Input value={s.hostName} maxLength={40} onChange={(e) => set({ hostName: e.target.value })} placeholder="“Hosted by …” on the TV" />
              </Field>
              <div className="sm:col-span-2">
                <Field label={<LabelCount text="Tagline" n={s.tagline.length} max={140} />}>
                  <Input value={s.tagline} maxLength={140} onChange={(e) => set({ tagline: e.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={<LabelCount text="Lobby note" n={s.lobbyNote.length} max={120} />} hint="A line under the tagline in the lobby, like the event name.">
                  <Input value={s.lobbyNote} maxLength={120} onChange={(e) => set({ lobbyNote: e.target.value })} placeholder="e.g. Lincoln Elementary PTA · Fall Workshop" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Join link on the TV" hint="Printed on the TV and encoded in the QR code. Leave blank to use this site's address.">
                  <Input
                    value={config.joinUrl ?? ""}
                    maxLength={300}
                    placeholder="https://offer-kitchen.vercel.app"
                    onChange={(e) => edit((c) => ({ ...c, joinUrl: e.target.value.trim() || null }))}
                  />
                </Field>
              </div>
            </div>

            {/* Lobby preview */}
            <div className="flex flex-col gap-2">
              <Eyebrow>Lobby preview</Eyebrow>
              <div className="border-line bg-tiles bg-tiles-sm flex min-h-56 flex-col items-center justify-center gap-3 overflow-hidden rounded-[16px] border-2 px-5 py-7 text-center xl:aspect-video xl:min-h-0">
                <div className="max-w-full origin-center scale-90 sm:scale-100">
                  <Logo size="md" title={s.title || "Offer Kitchen"} />
                </div>
                {s.tagline && <p className="font-display text-ink max-w-sm text-[16px] leading-snug font-bold">{s.tagline}</p>}
                {s.lobbyNote && (
                  <span className="border-line bg-surface-plain rounded-full border-2 px-3 py-0.5 text-[13px] font-bold">{s.lobbyNote}</span>
                )}
                {s.hostName && <p className="text-ink-muted text-[13px] font-semibold">Hosted by {s.hostName}</p>}
                <span className="font-ticket text-ink-soft mt-1 max-w-full truncate text-[12px] font-bold">
                  Join at {config.joinUrl?.replace(/^https?:\/\//, "") || "this site"}
                </span>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-6">
            {/* Flow */}
            <Panel title="🚦 Flow" tone="alt">
              <ToggleRow
                title="Lock the kitchen when the timer hits zero"
                hint="Off: the clock shows TIME! and waits for you to lock."
                checked={s.autoLock}
                onChange={(autoLock) => set({ autoLock })}
              />
              <ToggleRow
                title="Reveal results as soon as every plate is graded"
                hint="Off: the oven screen waits for you to hit Reveal."
                checked={s.autoReveal}
                onChange={(autoReveal) => set({ autoReveal })}
              />
              <ToggleRow
                title="Let people join after the show starts"
                hint="Off: the doors close once Round 1 begins."
                checked={s.lateJoin}
                onChange={(lateJoin) => set({ lateJoin })}
              />
              <SettingRow title="Phones see their grade" hint="Showing grades at the reveal keeps the suspense for the TV." stack>
                <Segmented
                  full
                  label="Phones see their grade"
                  value={s.phoneGrades}
                  onChange={(phoneGrades) => set({ phoneGrades })}
                  options={[
                    { value: "lock", label: "When the kitchen locks" },
                    { value: "reveal", label: "When the TV reveals" },
                  ]}
                />
              </SettingRow>
            </Panel>

            {/* Grade names */}
            <Panel title="🏅 Grade names" tone="leaf">
              <p className="text-ink-muted mb-4 text-[14px]">What each letter is called on the TV and phones. Keep them short and kitchen-y.</p>
              <ShowProvider value={s}>
                <div className="flex flex-col gap-3">
                  {ORDER.map((l) => (
                    <div key={l} className="border-line/15 bg-surface-plain flex flex-wrap items-center gap-2.5 rounded-[14px] border-2 p-2.5">
                      <div className="flex w-12 shrink-0 flex-col items-center gap-0.5">
                        <span
                          className="border-line font-sign grid h-10 w-10 place-items-center rounded-[11px] border-2 text-[22px] leading-none"
                          style={{ background: GRADE_TIERS[l].color, color: GRADE_TIERS[l].ink }}
                        >
                          {l}
                        </span>
                        <span className="font-ticket text-ink-soft text-[10px] leading-none font-bold">{RANGES[l]}</span>
                      </div>
                      <div className="w-14 shrink-0">
                        <Input
                          aria-label={`${l} emoji`}
                          value={s.tiers[l].emoji}
                          maxLength={16}
                          onChange={(e) => setTier(l, { emoji: e.target.value })}
                          className="px-1 text-center text-[18px]"
                        />
                      </div>
                      <div className="min-w-0 flex-1 basis-32">
                        <Input
                          aria-label={`${l} name`}
                          value={s.tiers[l].name}
                          maxLength={24}
                          onChange={(e) => setTier(l, { name: e.target.value })}
                          className={cx(!s.tiers[l].name.trim() && "ring-sunset-orange/60 ring-4")}
                        />
                      </div>
                      <div className="ml-auto flex shrink-0 justify-end sm:w-36">
                        <GradeBadge letter={l} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </ShowProvider>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => edit((c) => ({ ...c, show: { ...c.show, tiers: DEFAULT_SHOW.tiers } }))}
              >
                ↺ Default names
              </Button>
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            {/* Leaderboard */}
            <Panel title="📊 Leaderboard" tone="lime">
              <SettingRow title="Chefs on the board" hint="How many names the TV reveals each round.">
                <Stepper value={s.leaderboardSize} min={3} max={8} onChange={(leaderboardSize) => set({ leaderboardSize })} label="Chefs on the board" />
              </SettingRow>
              <SettingRow title="Reveal pace" hint={`One name every ${(REVEAL_GAP_MS[s.revealPace] / 1000).toFixed(1)}s, last place first.`}>
                <Segmented
                  label="Reveal pace"
                  value={s.revealPace}
                  onChange={(revealPace) => set({ revealPace })}
                  options={[
                    { value: "fast", label: "⚡ Fast" },
                    { value: "normal", label: "Normal" },
                    { value: "slow", label: "🐢 Slow" },
                  ]}
                />
              </SettingRow>
            </Panel>

            {/* Fun */}
            <Panel title="🎉 Fun" tone="pink">
              <ToggleRow
                title="Emoji reactions"
                hint="Phones get a reaction bar; taps float up the side of the TV."
                checked={s.reactions}
                onChange={(reactions) => set({ reactions })}
              />
              <ToggleRow title="Confetti" hint="Bursts on the TV for big reveals and the finale." checked={s.confetti} onChange={(confetti) => set({ confetti })} />
            </Panel>

            {/* Sound */}
            <Panel title="🎵 Sound" tone="orange">
              <VolumeRow label="Music" hint="Lobby and cooking music on the TV." value={s.musicVolume} onChange={(musicVolume) => set({ musicVolume })} />
              <VolumeRow label="Sound effects" hint="Bells, sizzles, drumrolls and the soundboard." value={s.sfxVolume} onChange={(sfxVolume) => set({ sfxVolume })} />
              <p className="text-ink-soft mt-4 text-[12.5px]">Mute the TV any time from the soundboard on the Live tab.</p>
            </Panel>

            {/* Bots */}
            <Panel title="🤖 Rehearsal bots" tone="plain">
              <ToggleRow
                title="Spend real AI calls grading rehearsal bots"
                hint="Off: bots get instant, free simulated grades. Real guests always get Claude."
                checked={s.botsUseAI}
                onChange={(botsUseAI) => set({ botsUseAI })}
              />
            </Panel>
          </div>
        </div>
      </div>
    </div>
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

function VolumeRow({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <SettingRow title={label} hint={hint} stack>
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 text-center text-[18px]">{value === 0 ? "🔇" : value < 40 ? "🔈" : value < 75 ? "🔉" : "🔊"}</span>
        <Slider value={value} min={0} max={100} onChange={onChange} label={`${label} volume`} />
        <span className="font-display w-11 shrink-0 text-right text-[16px] font-extrabold tabular-nums">{value}%</span>
      </div>
    </SettingRow>
  );
}
