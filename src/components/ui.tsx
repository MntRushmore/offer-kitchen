"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { createContext, useContext, useEffect } from "react";
import {
  avatarSrc,
  CRITERIA,
  DEFAULT_SHOW,
  GRADE_TIERS,
  isArtAvatar,
  MASCOT,
  scoreToLetter,
  topicBrief,
  topicImage,
} from "@/lib/constants";
import type { CriterionGrade, Grade, Letter, Player, PublicShow, TopicCard } from "@/lib/types";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- Show settings (title, tier names…) ---------- */

const ShowContext = createContext<PublicShow>(DEFAULT_SHOW);
export const ShowProvider = ShowContext.Provider;
export const useShow = () => useContext(ShowContext);

/** A grade tier with the host's custom name and emoji. */
export function useTier(letter: Letter) {
  const show = useShow();
  return { ...GRADE_TIERS[letter], ...(show.tiers?.[letter] ?? {}) };
}

/* ---------- Art ---------- */

export function Art({ src, alt = "", className, style }: { src: string; alt?: string; className?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} draggable={false} className={cx("pointer-events-none select-none", className)} style={style} />;
}

export function Mascot({ pose, className, style }: { pose: keyof typeof MASCOT; className?: string; style?: React.CSSProperties }) {
  return <Art src={MASCOT[pose]} alt="Chef Toque" className={cx("object-contain drop-shadow-[0_10px_0_rgba(97,51,1,0.18)]", className)} style={style} />;
}

/* ---------- Brand ---------- */

export function ChefHat({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d="M24 58c-11 0-18-8-18-18 0-11 9-19 20-18 3-11 13-17 24-17s21 6 24 17c11-1 20 7 20 18 0 10-7 18-18 18z"
        fill="#fffdf9"
        stroke="#613301"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M26 56h48v28a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6z" fill="#fffdf9" stroke="#613301" strokeWidth="5" strokeLinejoin="round" />
      <path d="M28 70h44" stroke="#fd6338" strokeWidth="7" />
      <path d="M40 40c0-5 4-9 9-9" stroke="#613301" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.25" />
    </svg>
  );
}

export function Logo({ size = "md", title }: { size?: "sm" | "md" | "lg" | "xl"; title?: string }) {
  const show = useShow();
  const s = {
    sm: [30, "text-[22px]", "gap-2"],
    md: [50, "text-[38px]", "gap-3"],
    lg: [96, "text-[78px]", "gap-4"],
    xl: [150, "text-[118px]", "gap-5"],
  }[size] as [number, string, string];
  return (
    <div className={cx("flex items-center select-none", s[2])}>
      <ChefHat size={s[0]} className="animate-wiggle shrink-0" />
      <div className={cx("font-sign text-sticker leading-[0.95] tracking-[0.01em] whitespace-nowrap", s[1])}>
        {title ?? show.title}
      </div>
    </div>
  );
}

/** A strip of torn paper: the sheet on top, the rip, then whatever is behind. */
export function PaperTear({ flip, className }: { flip?: boolean; className?: string }) {
  return <div aria-hidden className={cx("paper-tear pointer-events-none w-full", flip && "-scale-y-100", className)} />;
}

/* ---------- Panels ---------- */

export type Tone = "brand" | "alt" | "pink" | "leaf" | "lime" | "orange" | "plain" | "tomato";

const TITLEBAR: Record<Tone, string> = {
  brand: "bg-goldenrod",
  alt: "bg-viking",
  pink: "bg-azalea",
  leaf: "bg-leaf",
  lime: "bg-sidecar",
  orange: "bg-carrot-orange",
  plain: "bg-surface-alt",
  tomato: "bg-sunset-orange text-white",
};

/** The house container: a rounded cream card with a coloured label strip. */
export function Panel({
  title,
  tone = "brand",
  tv,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  tone?: Tone;
  tv?: boolean;
  /** Ignored; kept so older call sites still type-check. */
  chrome?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cx(
        "border-line bg-surface flex flex-col overflow-hidden",
        tv ? "rounded-[26px] border-4 shadow-tv" : "rounded-[18px] border-2 shadow-card",
        className,
      )}
    >
      {(title || actions) && (
        <div
          className={cx(
            "border-line flex items-center",
            tv ? "gap-4 border-b-4 px-7 py-3" : "gap-3 border-b-2 px-4 py-2",
            TITLEBAR[tone],
          )}
        >
          <span className={cx("font-display min-w-0 flex-1 truncate font-extrabold", tv ? "text-[28px]" : "text-[15px]")}>{title}</span>
          {actions}
        </div>
      )}
      {/* A caller's bodyClassName replaces the default padding rather than fighting it. */}
      <div className={cx("flex-1", bodyClassName ?? (tv ? "p-8" : "p-5"))}>{children}</div>
    </div>
  );
}

/** A paper order ticket with a torn zig-zag bottom, clipped to the rail. */
export function Ticket({
  label,
  number,
  tv,
  children,
  className,
  bodyClassName,
  clip = true,
}: {
  /** Omit for a ticket with no printed header strip. */
  label?: React.ReactNode;
  number?: React.ReactNode;
  tv?: boolean;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  clip?: boolean;
}) {
  return (
    <div className={cx("relative", className)}>
      {clip && (
        <div
          aria-hidden
          className={cx(
            "bg-steel border-line absolute left-1/2 z-10 -translate-x-1/2 rounded-b-md",
            tv ? "-top-3 h-9 w-40 border-4 border-t-0" : "-top-1.5 h-5 w-20 border-2 border-t-0",
          )}
        />
      )}
      <div className="h-full drop-shadow-[0_10px_0_rgba(97,51,1,0.16)]">
        <div
          className={cx("bg-ticket ticket-edge flex h-full flex-col", tv ? "px-10 pt-9 pb-12" : "px-5 pt-5 pb-7", bodyClassName)}
          style={{ ["--zig" as string]: tv ? "18px" : "10px" }}
        >
          {label && (
            <div
              className={cx(
                "font-display text-ink-soft flex items-center justify-between border-b-2 border-dashed border-current/40 font-bold",
                tv ? "mb-6 pb-4 text-[30px]" : "mb-3 pb-2 text-[15px]",
              )}
            >
              <span>{label}</span>
              {number && <span>{number}</span>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

/** The steel rail tickets hang from. */
export function TicketRail({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("bg-steel border-line relative h-6 rounded-full border-4 shadow-[0_6px_0_rgba(97,51,1,0.18)]", className)}>
      <div className="absolute inset-x-6 top-1/2 h-[3px] -translate-y-1/2 rounded bg-white/70" />
    </div>
  );
}

/** A chalk menu board in a wooden frame. */
export function Chalkboard({ children, className, bodyClassName }: { children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={cx("bg-butcher border-line rounded-[22px] border-4 p-4 shadow-tv", className)}>
      <div className={cx("bg-chalkboard h-full rounded-[10px] shadow-[inset_0_0_0_3px_rgba(0,0,0,0.35),inset_0_8px_24px_rgba(0,0,0,0.45)]", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Speech bubbles ---------- */

export function SpeechHeading({
  title,
  eyebrow,
  subtitle,
  actions,
  tv,
  level: Heading = "h1",
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tv?: boolean;
  level?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col", tv ? "gap-7" : "gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative inline-block">
          <div
            aria-hidden
            className={cx(
              "border-bubble-ink bg-bubble absolute bottom-0 z-0 translate-y-1/2 rotate-45",
              tv ? "left-20 h-9 w-9 border-r-4 border-b-4" : "left-9 h-4 w-4 border-r-2 border-b-2",
            )}
          />
          <div
            className={cx(
              "border-bubble-ink bg-bubble relative z-10 inline-flex items-center rounded-full",
              tv ? "gap-5 border-4 px-14 py-5" : "gap-3 border-2 px-6 py-2.5",
            )}
          >
            {eyebrow && (
              <span className={cx("font-display text-bubble-ink/70 font-bold tracking-wide uppercase", tv ? "text-[30px]" : "text-caption")}>
                {eyebrow}
              </span>
            )}
            <Heading className={cx("font-sign text-bubble-ink leading-none tracking-[0.01em]", tv ? "text-[64px]" : "text-[28px]")}>
              {title}
            </Heading>
          </div>
        </div>
        {actions}
      </div>
      {subtitle && (
        <div className={cx("text-ink-muted leading-snug", tv ? "text-[34px] font-semibold" : "text-subheading")}>{subtitle}</div>
      )}
    </div>
  );
}

export function SpeechBubble({
  tail = "bottom-right",
  tv,
  children,
  className,
  bodyClassName,
}: {
  tail?: "bottom-right" | "bottom-left" | "left" | "none";
  tv?: boolean;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      {tail !== "none" && (
        <div
          aria-hidden
          className={cx(
            "border-bubble-ink bg-bubble-body absolute z-0 rotate-45",
            tail === "left"
              ? cx("top-1/2 left-0 -translate-x-1/2 -translate-y-1/2", tv ? "h-10 w-10 border-b-4 border-l-4" : "h-5 w-5 border-b-2 border-l-2")
              : cx("bottom-0 translate-y-1/2", tv ? "h-10 w-10 border-r-4 border-b-4" : "h-6 w-6 border-r-2 border-b-2"),
            tail === "bottom-right" && (tv ? "right-20" : "right-12"),
            tail === "bottom-left" && (tv ? "left-20" : "left-12"),
          )}
        />
      )}
      <div
        className={cx(
          "border-bubble-ink bg-bubble-body relative z-10 h-full",
          tv ? "rounded-[26px] border-4 p-9 shadow-tv" : "rounded-[18px] border-2 p-5 shadow-card",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/* ---------- Controls ---------- */

export type ButtonVariant = "primary" | "brand" | "secondary" | "ghost" | "danger" | "success" | "dark";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

// Brown-bordered on a hard offset shadow that collapses when pressed.
const BTN_BASE =
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 border-2 border-line font-display font-extrabold " +
  "shadow-control transition-all duration-150 ease-standard " +
  "hover:-translate-y-px hover:shadow-[0_4px_0_0_rgba(97,51,1,0.3)] " +
  "active:translate-y-[3px] active:shadow-none " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-control";

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: "text-ink bg-[linear-gradient(180deg,#ffe58f_0%,#fddb68_55%,#f5c84a_100%)]",
  brand: "bg-goldenrod text-ink",
  secondary: "bg-surface text-ink hover:bg-surface-alt",
  ghost: "border-transparent bg-transparent text-ink shadow-none hover:bg-surface-alt hover:shadow-none",
  danger: "bg-sunset-orange text-white",
  success: "bg-leaf text-ink",
  dark: "bg-ink text-goldenrod",
};

const BTN_SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[13px] rounded-[10px]",
  md: "px-5 py-2.5 text-body rounded-[12px]",
  lg: "px-7 py-3.5 text-subheading rounded-[14px]",
  xl: "px-8 py-4 text-[22px] rounded-[18px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cx(BTN_BASE, BTN_VARIANTS[variant], BTN_SIZES[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button type={type} {...rest} className={buttonClass(variant, size, className)}>
      {children}
    </button>
  );
}

export type BadgeTone = "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "pink";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-alt text-ink",
  brand: "bg-goldenrod text-ink",
  info: "bg-viking text-blue-dianne",
  success: "bg-leaf text-ink",
  warning: "bg-carrot-orange text-white",
  danger: "bg-sunset-orange text-white",
  pink: "bg-azalea text-ink",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: BadgeTone; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "border-line font-display inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A rounded status chip. */
export function Chip({ tone = "brand", tv, children, className }: { tone?: Tone; tv?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "border-line font-display text-ink inline-flex items-center font-extrabold whitespace-nowrap",
        tv ? "gap-3 rounded-[18px] border-4 px-6 py-2.5 text-[32px] shadow-card" : "gap-1.5 rounded-[10px] border-2 px-2.5 py-1 text-[15px]",
        TITLEBAR[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- Form fields ---------- */

// font-literal: what someone types is data, not prose.
const CONTROL =
  "w-full rounded-[12px] border-2 border-line bg-surface-plain px-3 py-2 text-ink shadow-[inset_0_2px_0_rgba(97,51,1,0.08)] " +
  "font-literal placeholder:text-ink-soft transition-shadow " +
  "focus:outline-none focus:ring-4 focus:ring-viking/50 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Label({ children, hint, htmlFor }: { children: React.ReactNode; hint?: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={htmlFor} className="font-display text-body text-ink font-bold">
        {children}
      </label>
      {hint && <span className="text-caption text-ink-soft">{hint}</span>}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label?: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label hint={hint}>{label}</Label>}
      {children}
      {error && <span className="text-caption text-sunset-orange font-bold">{error}</span>}
    </div>
  );
}

/** The default size, unless the caller sets its own (two font-size classes don't override by order). */
const bodySize = (className?: string) => (className && /(^|\s)text-\[\d/.test(className) ? null : "text-body");

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, "font-body", bodySize(className), className)} {...props} />;
}

export function Textarea({ className, mono, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
  return (
    <textarea
      className={cx(CONTROL, mono ? "font-mono text-xs leading-relaxed" : cx("font-body resize-none leading-relaxed", bodySize(className)), className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(CONTROL, "font-body text-body cursor-pointer", className)} {...props} />;
}

/** A drawn tick, because an explicit background paints over the native checked state. */
export function CheckMark({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "border-line grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border-2 text-[15px] leading-none font-bold transition-colors",
        on ? "bg-leaf text-white" : "bg-surface-plain",
        className,
      )}
    >
      {on ? "✓" : ""}
    </span>
  );
}

/* ---------- Players ---------- */

export function Avatar({
  player,
  size = 56,
  className,
  dim,
  ring = true,
}: {
  player: Pick<Player, "avatar" | "color">;
  size?: number;
  className?: string;
  dim?: boolean;
  ring?: boolean;
}) {
  const art = isArtAvatar(player.avatar);
  return (
    <div
      className={cx("grid shrink-0 place-items-center rounded-full", ring && "border-line", className)}
      style={{
        width: size,
        height: size,
        background: ring ? player.color : undefined,
        borderWidth: ring ? Math.max(2, Math.round(size / 26)) : 0,
        boxShadow: ring ? `0 ${Math.max(2, Math.round(size / 18))}px 0 rgba(97, 51, 1, 0.22)` : undefined,
        fontSize: size * 0.55,
        filter: dim ? "grayscale(1) opacity(0.4)" : undefined,
      }}
    >
      {art ? (
        <Art
          src={avatarSrc(player.avatar)}
          className="object-contain"
          style={ring ? { width: size * 0.94, height: size * 0.94, marginTop: -size * 0.06 } : { width: size, height: size }}
        />
      ) : (
        <span style={{ lineHeight: 1 }}>{player.avatar}</span>
      )}
    </div>
  );
}

/* ---------- Grades ---------- */

export function GradeBadge({ letter, size = "md", showName = true }: { letter: Letter; size?: "sm" | "md" | "lg" | "xl"; showName?: boolean }) {
  const t = useTier(letter);
  const cls = {
    sm: "text-[13px] px-2.5 py-0.5 gap-1.5 border-2",
    md: "text-xl px-4 py-1 gap-2 border-2",
    lg: "text-[34px] px-6 py-2 gap-3 border-4",
    xl: "text-5xl px-8 py-3 gap-4 border-4",
  }[size];
  return (
    <div
      className={cx("border-line font-display inline-flex items-center rounded-full font-extrabold whitespace-nowrap", cls)}
      style={{ background: t.color, color: t.ink, boxShadow: "0 3px 0 rgba(97, 51, 1, 0.25)" }}
    >
      <span>{letter}</span>
      {showName && (
        <>
          <span className="opacity-40">·</span>
          <span>{t.name}</span>
        </>
      )}
      <span>{t.emoji}</span>
    </div>
  );
}

/** The grade as an inked rubber stamp that slams onto the page. */
export function Stamp({ letter, size = 40, delay = 0.2, className }: { letter: Letter; size?: number; delay?: number; className?: string }) {
  const t = useTier(letter);
  return (
    <motion.div
      className={cx("inline-flex", className)}
      initial={{ scale: 2.4, opacity: 0, rotate: -24 }}
      animate={{ scale: 1, opacity: 1, rotate: -9 }}
      transition={{ delay, type: "spring", stiffness: 420, damping: 16 }}
    >
      <div
        className="stamp font-sign inline-flex items-center rounded-[0.22em] leading-none whitespace-nowrap"
        style={{ color: t.text, fontSize: size, padding: "0.18em 0.42em 0.12em", gap: "0.3em", background: "rgba(255,255,255,0.35)" }}
      >
        <span style={{ fontSize: "1.25em" }}>{letter}</span>
        <span style={{ fontSize: "0.62em", letterSpacing: "0.04em" }}>{t.name}</span>
      </div>
    </motion.div>
  );
}

export function CountUp({ to, duration = 1.2, className }: { to: number; duration?: number; className?: string }) {
  const v = useMotionValue(0);
  const rounded = useTransform(v, (x) => Math.round(x));
  useEffect(() => {
    const c = animate(v, to, { duration, ease: "easeOut" });
    return () => c.stop();
  }, [to, duration, v]);
  return <motion.span className={className}>{rounded}</motion.span>;
}

/** Fill colour for a bar or chip. */
export function scoreColor(score: number) {
  return GRADE_TIERS[scoreToLetter(score)].color;
}

/** The same hue, dark enough to read as text on cream. */
export function scoreInk(score: number) {
  return GRADE_TIERS[scoreToLetter(score)].text;
}

export function Meter({
  value,
  color,
  tv,
  className,
  delay = 0,
}: {
  value: number;
  color: string;
  tv?: boolean;
  className?: string;
  delay?: number;
}) {
  return (
    <div className={cx("border-line bg-surface-alt overflow-hidden rounded-full", tv ? "h-8 border-4" : "h-4 border-2", className)}>
      <motion.div
        className={cx("border-line h-full rounded-full", value > 0 && (tv ? "border-r-4" : "border-r-2"))}
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ delay, type: "spring", stiffness: 70, damping: 15 }}
      />
    </div>
  );
}

export function CriteriaBars({ criteria, feedback = false, big = false, delay = 0 }: { criteria: CriterionGrade[]; feedback?: boolean; big?: boolean; delay?: number }) {
  return (
    <div className={cx("flex flex-col", big ? "gap-[18px]" : "gap-4")}>
      {criteria.map((c, i) => {
        const meta = CRITERIA[c.id];
        return (
          <div key={c.id}>
            <div className={cx("font-display flex items-center gap-2 font-bold", big ? "mb-1.5 text-[26px]" : "text-body mb-1")}>
              <span>{meta.emoji}</span>
              <span className="flex-1 truncate">{meta.label}</span>
              <span className="font-extrabold tabular-nums" style={{ color: scoreInk(c.score) }}>
                {c.score}
              </span>
            </div>
            <Meter value={Math.max(3, c.score)} color={scoreColor(c.score)} tv={big} delay={delay + i * 0.12} />
            {feedback && c.feedback && (
              <p className={cx("text-ink-muted leading-snug", big ? "mt-2 text-xl" : "text-caption mt-1.5")}>{c.feedback}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The six ingredients as a food-packaging "Offer Facts" label: heavy rules,
 * bold type, a daily-value column. Works on the phone and the TV.
 */
export function OfferFacts({
  grade,
  tv,
  delay = 0,
  feedback = false,
  className,
}: {
  grade: Grade;
  tv?: boolean;
  delay?: number;
  feedback?: boolean;
  className?: string;
}) {
  const tier = useTier(grade.letter);
  return (
    <div
      className={cx(
        "bg-surface-plain text-[#1d1208]",
        tv ? "border-[5px] border-[#1d1208] px-7 pt-5 pb-6" : "border-[3px] border-[#1d1208] px-4 pt-3 pb-4",
        className,
      )}
    >
      <div className={cx("font-sign leading-none tracking-[0.01em]", tv ? "text-[60px]" : "text-[36px]")}>Offer Facts</div>
      <div className={cx("flex justify-between border-b-[#1d1208] font-semibold", tv ? "mt-2 border-b-[3px] pb-2 text-[22px]" : "mt-1 border-b-2 pb-1 text-[15px]")}>
        <span>Serving size 1 offer</span>
        <span>
          {tier.name} {tier.emoji}
        </span>
      </div>
      <div className={cx("flex items-end justify-between border-b-[#1d1208]", tv ? "border-b-[14px] py-2" : "border-b-[9px] py-1")}>
        <span className={cx("font-black", tv ? "text-[34px]" : "text-[20px]")}>Overall</span>
        <span className={cx("leading-none font-black tabular-nums", tv ? "text-[56px]" : "text-[34px]")}>
          <CountUp to={grade.overall} duration={1} />
        </span>
      </div>
      <div className={cx("border-b-[#1d1208] text-right font-bold", tv ? "border-b-2 py-1 text-[18px]" : "border-b py-0.5 text-[13px]")}>
        % Grand Slam*
      </div>
      {grade.criteria.map((c, i) => {
        const meta = CRITERIA[c.id];
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + i * 0.12 }}
            className={cx("border-b-[#1d1208]/70", tv ? "border-b-2 py-2" : "border-b py-1.5")}
          >
            <div className={cx("flex items-center", tv ? "gap-3 text-[24px]" : "gap-2 text-[16px]")}>
              <span>{meta.emoji}</span>
              <span className={cx("flex-1 font-bold", tv ? "truncate" : "leading-tight")}>{meta.label}</span>
              <div className={cx("relative overflow-hidden rounded-full bg-[#1d1208]/10", tv ? "h-4 w-40" : "h-2.5 w-16")}>
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: scoreColor(c.score) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(4, c.score)}%` }}
                  transition={{ delay: delay + 0.2 + i * 0.12, type: "spring", stiffness: 70, damping: 14 }}
                />
              </div>
              <span className={cx("text-right font-black tabular-nums", tv ? "w-20" : "w-11")} style={{ color: scoreInk(c.score) }}>
                {c.score}%
              </span>
            </div>
            {feedback && c.feedback && (
              <p className={cx("leading-snug text-[#1d1208]/75", tv ? "mt-1 text-[19px]" : "mt-1 text-[15px]")}>{c.feedback}</p>
            )}
          </motion.div>
        );
      })}
      <p className={cx("leading-snug text-[#1d1208]/70", tv ? "mt-3 text-[16px]" : "mt-2 text-[13px]")}>
        * 90%+ in all six, and a buyer would feel silly saying no. Judged strictly by {grade.simulated ? "the rehearsal grader" : "Claude"}.
      </p>
    </div>
  );
}

/* ---------- Topic ticket ---------- */

const TOPIC_ROWS: { key: keyof TopicCard; label: string; emoji: string }[] = [
  { key: "buyer", label: "Who might buy", emoji: "👥" },
  { key: "pain", label: "What hurts", emoji: "😩" },
  { key: "alternatives", label: "What they use today", emoji: "🏪" },
  { key: "scope", label: "Your setup", emoji: "🛠️" },
  { key: "economics", label: "Your costs", emoji: "💵" },
];

export function TopicArt({ topic, className }: { topic: TopicCard; className?: string }) {
  const src = topicImage(topic);
  if (src) return <Art src={src} alt={topic.title} className={cx("object-contain", className)} />;
  return <div className={cx("grid place-items-center leading-none", className)}>{topic.emoji}</div>;
}

/** The card's full detail rows: who buys, what hurts, what they use today, setup, costs. */
export function TopicFacts({
  topic,
  rows = TOPIC_ROWS.map((r) => r.key),
  tv,
  dense,
  className,
}: {
  topic: TopicCard;
  rows?: (keyof TopicCard)[];
  tv?: boolean;
  dense?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col", className)}>
      {TOPIC_ROWS.filter((r) => rows.includes(r.key)).map((r) => (
        <div key={r.key} className={cx("border-line/15 flex border-t first:border-t-0", tv ? (dense ? "gap-4 py-2" : "gap-5 py-3") : "gap-3 py-2.5")}>
          <div className={cx("shrink-0", tv ? (dense ? "text-[28px] leading-none" : "text-[34px] leading-none") : "text-xl")}>{r.emoji}</div>
          <div className="min-w-0">
            <div className={cx("font-display text-ink-soft font-bold", tv ? (dense ? "text-[18px]" : "text-[20px]") : "text-[14px]")}>{r.label}</div>
            <div className={cx("text-ink leading-snug", tv ? (dense ? "text-[21px]" : "mt-0.5 text-[24px]") : "text-[16px]")}>{String(topic[r.key])}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The topic as players write from it: "Create an offer for…" and a few bullets. */
export function OfferBrief({ topic, tv, children, className }: { topic: TopicCard; tv?: boolean; children?: React.ReactNode; className?: string }) {
  return (
    <Ticket tv={tv} className={className} bodyClassName={tv ? "px-12 pt-12 pb-14" : "px-5 pt-6 pb-8"}>
      <div className={cx("font-display text-ink-muted font-bold", tv ? "text-[38px]" : "text-[17px]")}>Create an offer for</div>
      <div className={cx("flex items-center", tv ? "mt-3 gap-6" : "mt-1.5 gap-3")}>
        <TopicArt topic={topic} className={cx("shrink-0", tv ? "h-[150px] w-[150px] text-[110px]" : "h-16 w-16 text-5xl")} />
        <div className={cx("font-sign text-ink leading-[0.95] tracking-[0.01em]", tv ? "text-[76px]" : "text-[30px]")}>{topic.title}</div>
      </div>
      <ul className={cx("flex flex-col", tv ? "mt-10 gap-7" : "mt-4 gap-3")}>
        {topicBrief(topic).map((b, i) => (
          <li key={i} className={cx("text-ink flex leading-snug font-semibold", tv ? "gap-5 text-[40px]" : "gap-3 text-[17px]")}>
            <span aria-hidden className={cx("bg-sunset-orange border-line shrink-0 rounded-full", tv ? "mt-[0.42em] h-5 w-5 border-[3px]" : "mt-[0.4em] h-2.5 w-2.5 border-2")} />
            <span className="min-w-0">{b}</span>
          </li>
        ))}
      </ul>
      {children}
    </Ticket>
  );
}
