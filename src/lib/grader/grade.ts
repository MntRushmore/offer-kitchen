import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CRITERIA, scoreToLetter } from "../constants";
import { CRITERIA_IDS, type CriterionGrade, type CriterionId, type Grade, type Submission, type TopicCard } from "../types";
import { runChecks, type ServerChecks } from "./checks";
import { buildUserMessage, DEFAULT_SYSTEM_PROMPT } from "./prompt";

const GradeSchema = z.object({
  compelling: z.boolean(),
  verdict: z.string(),
  strength: z.string(),
  nextMove: z.string(),
  criteria: z.array(
    z.object({
      id: z.enum(CRITERIA_IDS),
      score: z.number().int(),
      evidence: z.string(),
      feedback: z.string(),
    }),
  ),
  levers: z.object({
    outcome: z.string(),
    likelihood: z.string(),
    delay: z.string(),
    effort: z.string(),
  }),
});
type RawGrade = z.infer<typeof GradeSchema>;

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

/** Post-grader guards from the Offer Karaoke spec. They only ever lower scores. */
export function applyGuards(raw: RawGrade, checks: ServerChecks): Grade {
  const caps = Object.fromEntries(CRITERIA_IDS.map((id) => [id, 100])) as Record<CriterionId, number>;
  const cap = (ids: readonly CriterionId[], n: number) => ids.forEach((id) => (caps[id] = Math.min(caps[id], n)));
  const capAll = (n: number) => cap(CRITERIA_IDS, n);
  const notes: string[] = [];

  if (checks.addressesGrader) {
    capAll(39);
    notes.push("Text aimed at the grader was ignored.");
  }
  if (checks.recitedExample) {
    capAll(39);
    notes.push("This reads back the on-screen example.");
  }
  if (checks.borrowedExample) {
    capAll(84);
    notes.push("Long stretches are lifted from an example.");
  }
  if (checks.rubricStuffing) {
    capAll(59);
    notes.push("Buzzwords instead of terms — name the actual deal, with numbers.");
  }
  if (checks.absurdDollars) {
    cap(["price", "guarantee", "delivery"], 40);
    capAll(74);
    notes.push("That price is far beyond what a solo side hustle can credibly charge.");
  }
  if (checks.multiplierRefund) {
    cap(["guarantee", "delivery"], 59);
    notes.push("A multiple-of-price refund isn't affordable across ten claims.");
  }
  if (checks.numbersStated === 0) {
    cap(["price", "guarantee", "delivery"], 59);
    notes.push("No numbers at all — no price, deadline or remedy amount.");
  }
  if (checks.belowPassLength) {
    notes.push("Too short to state a buyer, result, price, remedy and delivery math.");
  }

  const compelling = raw.compelling && notes.length === 0;
  if (!compelling) capAll(89);

  const byId = new Map(raw.criteria.map((c) => [c.id, c]));
  const criteria: CriterionGrade[] = CRITERIA_IDS.map((id) => {
    const c = byId.get(id);
    const score = Math.max(0, Math.min(caps[id], Math.round(c?.score ?? 0)));
    return { id, score, evidence: c?.evidence ?? "Not provided", feedback: c?.feedback ?? "" };
  });
  const overall = Math.floor(criteria.reduce((s, c) => s + c.score, 0) / criteria.length);

  return {
    overall,
    letter: scoreToLetter(overall),
    passed: compelling && criteria.every((c) => c.score >= 90),
    compelling,
    verdict: notes.length ? `Server check: ${notes.join(" ")} ${raw.verdict}` : raw.verdict,
    strength: raw.strength,
    nextMove: raw.nextMove,
    criteria,
    levers: raw.levers,
    serverNotes: notes,
  };
}

export async function gradeSubmission(opts: {
  topic: TopicCard;
  sub: Submission;
  model: string;
  mode: "ai" | "mock";
  systemPrompt: string | null;
}): Promise<Grade> {
  const { topic, sub } = opts;
  const checks = runChecks(sub.text, topic.absurdPrice);
  const started = Date.now();

  if (opts.mode === "mock" || !aiConfigured()) {
    const raw = mockGrade(sub.text, checks);
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 2400));
    return { ...applyGuards(raw, checks), simulated: true, ms: Date.now() - started };
  }

  const { output } = await generateText({
    model: opts.model,
    // The grader prompt is identical for every offer, so cache it (cheaper and faster).
    instructions: {
      role: "system",
      content: opts.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    prompt: JSON.stringify(buildUserMessage(topic, sub, checks), null, 2),
    output: Output.object({ schema: GradeSchema }),
    timeout: 120_000,
  });
  return { ...applyGuards(output, checks), model: opts.model, ms: Date.now() - started };
}

/* ---------- Simulated grader (for rehearsals without AI) ---------- */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const SIGNALS: Record<CriterionId, RegExp[]> = {
  promise: [/\b(parents?|families|homeowners?|moms?|dads?|seniors?|grandparents?|kids?)\b/i, /\b(by|within|in)\s+\d+\s*(days?|hours?|weeks?)\b|\bsame day\b|\bthis weekend\b/i],
  difference: [/\b(unlike|instead of|compared to|only one|nobody else|vs\.?|versus)\b/i, /\b(trampoline|organizer|meal kit|takeout|installer|geek|hauler|diy)\b/i],
  price: [/\$\s?\d/, /\b(per|each|a month|\/mo|package|saves?|worth)\b/i],
  guarantee: [/\b(guarantee|refund|money back|redo|for free|or you)\b/i, /\b(if|unless)\b[^.]{0,80}\b(by|within|don'?t|doesn'?t|not)\b/i],
  pitch: [/^[^.!?]{25,180}[.!?]/, /\b(i help|get|without)\b/i],
  delivery: [/\b\d+\s*(hours?|hrs?)\b/i, /\b(cost|supplies|margin|profit|gas|keep)\b/i],
};

const MOCK_FEEDBACK: Record<CriterionId, [string, string]> = {
  promise: ["Name one specific buyer and a result with a deadline.", "Clear buyer and result — now pin the exact deadline."],
  difference: ["Say why you beat what they use today, concretely.", "Good contrast with the alternative — make the gap measurable."],
  price: ["State a price and compare it to what they spend now.", "Price is anchored — show the dollar math on what it saves."],
  guarantee: ["Add a remedy with a trigger and a deadline.", "Solid remedy — check you can afford ten claims."],
  pitch: ["Lead with one sentence: buyer + result.", "Your opener works — trim it to under 20 words."],
  delivery: ["Show your hours, costs and what you keep.", "Costs are there — finish the margin math."],
};

function mockGrade(text: string, checks: ServerChecks): RawGrade {
  const seed = hash(text);
  const base = checks.words < 15 ? 18 : checks.words < 40 ? 34 : checks.words < 90 ? 48 : 56;
  const criteria = CRITERIA_IDS.map((id, i) => {
    const hits = SIGNALS[id].filter((r) => r.test(text)).length;
    const jitter = ((seed >> (i * 4)) & 15) - 7;
    const score = Math.max(5, Math.min(97, base + hits * 19 + jitter));
    const evidence = hits ? `"${text.slice(0, 60).trim()}…"` : "Not provided";
    return { id, score, evidence, feedback: MOCK_FEEDBACK[id][hits >= 2 ? 1 : 0] };
  });
  const weakest = [...criteria].sort((a, b) => a.score - b.score)[0];
  const strongest = [...criteria].sort((a, b) => b.score - a.score)[0];
  const compelling = criteria.every((c) => c.score >= 85) && checks.words >= 60;
  return {
    compelling,
    verdict: compelling
      ? "A buyer would have a hard time saying no to this."
      : `Promising start, but "${CRITERIA[weakest.id].label}" needs real terms.`,
    strength: `"${CRITERIA[strongest.id].label}" is the most concrete part of your offer.`,
    nextMove: MOCK_FEEDBACK[weakest.id][0],
    criteria,
    levers: {
      outcome: "The result is described in general terms.",
      likelihood: "Believability rests on your word alone.",
      delay: "Time to first value isn't stated.",
      effort: "Buyer effort looks low.",
    },
  };
}
