"use client";

import { Component, useId, useState } from "react";
import { Button, cx, Mascot } from "../ui";

/* ---------- Inputs ---------- */

/** An on/off switch. */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "border-line relative inline-flex h-[30px] w-[54px] shrink-0 cursor-pointer items-center rounded-full border-2 p-[3px] transition-colors duration-200",
        "shadow-[inset_0_2px_0_rgba(97,51,1,0.14)] focus-visible:ring-viking/60 focus-visible:ring-4 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-leaf" : "bg-grout",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "border-line bg-surface-plain grid h-5 w-5 place-items-center rounded-full border-2 text-[10px] leading-none font-black shadow-[0_2px_0_rgba(97,51,1,0.3)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          checked ? "translate-x-6" : "translate-x-0",
        )}
      >
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: React.ReactNode;
  hint?: string;
}

/** A row of mutually exclusive choices. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  full,
  size = "md",
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegOption<T>[];
  full?: boolean;
  size?: "sm" | "md";
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("border-line bg-grout/60 gap-1 rounded-[13px] border-2 p-1", full ? "flex w-full" : "inline-flex max-w-full")}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cx(
              "font-display min-w-0 cursor-pointer rounded-[9px] border-2 leading-tight font-bold transition-all duration-150",
              full ? "text-balance" : "whitespace-nowrap",
              size === "sm" ? "px-2.5 py-1 text-[13px]" : "px-3.5 py-1.5 text-[14px]",
              full && "flex-1",
              on ? "border-line bg-goldenrod text-ink shadow-[0_2px_0_rgba(97,51,1,0.3)]" : "text-ink/70 hover:bg-surface hover:text-ink border-transparent",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const THUMB =
  "[&::-webkit-slider-thumb]:h-[26px] [&::-webkit-slider-thumb]:w-[26px] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-[#613301] " +
  "[&::-webkit-slider-thumb]:bg-[#fddb68] [&::-webkit-slider-thumb]:shadow-[0_3px_0_rgba(97,51,1,0.3)] " +
  "[&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:w-[22px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 " +
  "[&::-moz-range-thumb]:border-[#613301] [&::-moz-range-thumb]:bg-[#fddb68]";

/** A chunky range slider with a filled track. */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cx(
        "border-line h-3.5 w-full cursor-pointer appearance-none rounded-full border-2 focus-visible:ring-viking/60 focus-visible:ring-4 focus-visible:outline-none",
        THUMB,
        className,
      )}
      style={{ background: `linear-gradient(90deg, #eb9824 0%, #fddb68 ${pct}%, #f7f2e8 ${pct}%)` }}
    />
  );
}

/** − value + */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => React.ReactNode;
  label?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step));
  const btn =
    "grid h-10 w-10 cursor-pointer place-items-center font-display text-[22px] font-extrabold leading-none transition-colors hover:bg-goldenrod/60 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <div aria-label={label} className="border-line bg-surface-plain shadow-control inline-flex items-stretch overflow-hidden rounded-[12px] border-2">
      <button type="button" className={btn} aria-label="Less" disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <span className="font-display border-line/25 grid min-w-16 place-items-center border-x-2 px-2 text-[17px] font-extrabold tabular-nums">
        {format(value)}
      </span>
      <button type="button" className={btn} aria-label="More" disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </div>
  );
}

/** Characters used / allowed, turning orange near the limit. */
export function Count({ n, max }: { n: number; max: number }) {
  return (
    <span className={cx("text-[11px] font-bold tabular-nums", n > max * 0.9 ? "text-carrot-orange" : "text-ink-soft")}>
      {n}/{max}
    </span>
  );
}

/* ---------- Layout ---------- */

/** A setting: title and explanation on the left, its control on the right. */
export function SettingRow({
  title,
  hint,
  children,
  stack,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  stack?: boolean;
}) {
  return (
    <div
      className={cx(
        "border-line/12 flex gap-x-6 gap-y-3 border-t py-4 first:border-t-0 first:pt-0 last:pb-0",
        stack ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="min-w-0">
        <div className="font-display text-ink text-[16px] leading-snug font-bold">{title}</div>
        {hint && <p className="text-ink-soft mt-0.5 text-[13.5px] leading-snug">{hint}</p>}
      </div>
      <div className={cx("shrink-0", stack && "w-full")}>{children}</div>
    </div>
  );
}

/** A toggle setting where the whole row is clickable. */
export function ToggleRow({
  title,
  hint,
  checked,
  onChange,
  disabled,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="border-line/12 flex items-center justify-between gap-6 border-t py-4 first:border-t-0 first:pt-0 last:pb-0">
      <label htmlFor={id} className={cx("min-w-0", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <div className="font-display text-ink text-[16px] leading-snug font-bold">{title}</div>
        {hint && <p className="text-ink-soft mt-0.5 text-[13.5px] leading-snug">{hint}</p>}
      </label>
      <Toggle id={id} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/** The heading at the top of each tab. */
export function TabHeader({
  title,
  blurb,
  actions,
  className,
}: {
  title: React.ReactNode;
  blurb?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-6 flex flex-wrap items-end gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 flex-1 basis-72">
        <h1 className="font-sign text-ink text-[30px] leading-none tracking-[0.01em] sm:text-[36px]">{title}</h1>
        {blurb && <p className="text-ink-muted mt-2 max-w-2xl text-[15px] leading-snug">{blurb}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A dashed placeholder for empty lists. */
export function Empty({ children, pose, className }: { children: React.ReactNode; pose?: React.ComponentProps<typeof Mascot>["pose"]; className?: string }) {
  return (
    <div
      className={cx(
        "border-line/30 bg-surface-alt/70 text-ink-soft flex flex-col items-center gap-2 rounded-[14px] border-2 border-dashed px-4 py-7 text-center text-[14px] font-bold",
        className,
      )}
    >
      {pose && <Mascot pose={pose} className="h-20 w-20" />}
      {children}
    </div>
  );
}

/** A small uppercase label above a group of controls. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("font-display text-ink-soft text-[11.5px] font-extrabold tracking-[0.09em] uppercase", className)}>{children}</div>;
}

/** A button that shows a busy state and ignores taps until its action finishes. */
export function ActButton({
  run,
  busyLabel,
  children,
  disabled,
  ...rest
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & { run: () => Promise<unknown>; busyLabel?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await run();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && busyLabel ? busyLabel : children}
    </Button>
  );
}

/** Keeps a crash in one widget (say, the TV preview) from taking down the host console. */
export class Boundary extends Component<
  { children: React.ReactNode; fallback: (retry: () => void) => React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}
