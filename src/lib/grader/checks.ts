/**
 * Server-side measurements of a submission, mirroring the Offer Karaoke
 * "serverChecks". The grader sees these, and the guards use them to cap scores.
 */
export interface ServerChecks {
  words: number;
  exampleOverlap: number;
  recitedExample: boolean;
  borrowedExample: boolean;
  addressesGrader: boolean;
  rubricTerms: string[];
  rubricStuffing: boolean;
  numbersStated: number;
  maxAskingPrice: number | null;
  absurdDollars: boolean;
  multiplierRefund: boolean;
  belowPassLength: boolean;
}

const RUBRIC_TERMS = [
  "dream outcome",
  "category of one",
  "risk reversal",
  "grand slam",
  "value stack",
  "premium",
  "compelling",
  "value equation",
  "perceived likelihood",
  "time delay",
  "effort and sacrifice",
  "no-brainer",
  "irresistible",
];

const GRADER_PATTERNS = [
  /\bgrader\b/i,
  /\bignore (all |the |any |your |previous |prior )*(instructions|rubric|rules|criteria)/i,
  /\b(give|award|grant) (me|this|it|us) (an? |the )?(100|a\+?|full|perfect|top|max)/i,
  /\bfull marks\b/i,
  /\bsystem prompt\b/i,
  /\b(you are|act as|pretend to be) (now )?(an? )?(ai|assistant|grader|judge|model)\b/i,
  /<\/?(system|developer|assistant|instructions?)>/i,
  /"(compelling|criteria|nextMove)"\s*:/i,
  /\brubric (has )?(changed|updated)\b/i,
  /\b(score|grade|rate) (this|me|it) (an? |as )?(100|a\+?|perfect)\b/i,
];

const NUMBER_WORDS =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|half|double|triple)\b/gi;

const MULTIPLIER_REFUND = [
  /\b(double|triple|2x|3x|twice|200%|300%)\s+(your\s+)?(money|refund|payment|back)/i,
  /\b(refund|money back|pay you back)\s+(x\s?\d|\d\s?x|times\s+(two|three)|twice|double|triple)/i,
];

function parseAmount(raw: string, suffix?: string): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  const s = (suffix ?? "").toLowerCase();
  if (s === "k" || s === "thousand") return n * 1000;
  if (s === "m" || s === "million") return n * 1_000_000;
  return n;
}

export function runChecks(text: string, absurdPrice: number): ServerChecks {
  const t = text.normalize("NFKC");
  const lower = t.toLowerCase();
  const words = (t.match(/[A-Za-z0-9$%][\w$%'’,.-]*/g) ?? []).length;

  const rubricTerms = RUBRIC_TERMS.filter((term) => lower.includes(term));

  const digitTokens = t.match(/\$?\d[\d,]*(\.\d+)?\s*(k\b|%)?/gi) ?? [];
  const wordTokens = t.match(NUMBER_WORDS) ?? [];
  const numbersStated = digitTokens.length + wordTokens.length;

  const amounts: number[] = [];
  for (const m of t.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|m|million)?\b/gi)) {
    amounts.push(parseAmount(m[1], m[2]));
  }
  for (const m of t.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|m|million)?\s*(dollars|bucks|usd)\b/gi)) {
    amounts.push(parseAmount(m[1], m[2]));
  }
  const maxAskingPrice = amounts.length ? Math.max(...amounts) : null;

  return {
    words,
    exampleOverlap: 0,
    recitedExample: false,
    borrowedExample: false,
    addressesGrader: GRADER_PATTERNS.some((p) => p.test(t)),
    rubricTerms,
    rubricStuffing: rubricTerms.length >= 3 && numbersStated < 3,
    numbersStated,
    maxAskingPrice,
    absurdDollars: maxAskingPrice !== null && maxAskingPrice >= absurdPrice,
    multiplierRefund: MULTIPLIER_REFUND.some((p) => p.test(t)),
    belowPassLength: words < 40,
  };
}
