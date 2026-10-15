import type { GuidedFields, TopicCard } from "./types";

export const BOT_NAMES = [
  "Sir Loin", "Penny Pancake", "Chili Willy", "Tater Tom", "Miso Molly", "Biscuit Bob",
  "Nacho Nancy", "Waffle Wes", "Kale Kim", "Dumpling Dee", "Pickle Pete", "Mango Max",
  "Toast Tina", "Ravioli Ray", "Gnocchi Gia", "Taco Tess", "Cocoa Carl", "Bagel Bea",
  "Fig Fiona", "Lemon Leo", "Paprika Pam", "Noodle Ned", "Olive Ollie", "Pesto Paul",
  "Saffron Sam", "Cheddar Chad", "Muffin Mia", "Ginger Gus", "Truffle Tara", "Pretzel Priya",
  "Brioche Bree", "Curry Cal", "Sorbet Sue", "Hummus Hal", "Tofu Toby", "Scone Sal",
  "Crumpet Cora", "Gravy Gabe", "Jelly Jo", "Kebab Kai",
];

/** The two on-screen demo phones. */
export const SEATS: Record<string, { name: string; avatar: string; color: string }> = {
  a: { name: "Chef Rosa", avatar: "strawberry", color: "#fddb68" },
  b: { name: "Chef Theo", avatar: "avocado", color: "#6fbbe2" },
};

/** Small deterministic PRNG so a demo seat types the same offer on every poll. */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * A sample offer. `level` 0 = raw (vague, buzzwords), 1 = seasoned (most parts,
 * thin math), 2 = grand slam (every ingredient with numbers).
 */
export function botOffer(
  topic: TopicCard,
  level: number,
  rand: () => number = Math.random,
): { text: string; fields: GuidedFields | null } {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const t = topic.title.toLowerCase();
  const price = pick([199, 249, 299, 349, 399, 449]);
  const lvl = Math.max(0, Math.min(2, level));

  if (lvl === 0) {
    return {
      fields: null,
      text: pick([
        `I do ${t} and I'm really good at it. Great prices, satisfaction guaranteed! Call me.`,
        `Best ${t} in town!! Super affordable, you'll love it, text me anytime.`,
        `${topic.title}. $${price}. I bring everything. Text me.`,
        `Tired of stress? Let me handle ${t} for you. Dream outcome, risk reversal, grand slam value.`,
        `Hi neighbor! I'm starting a ${t} service and would love your business. Very fair prices and I work hard.`,
      ]),
    };
  }

  if (lvl === 1) {
    return {
      fields: null,
      text: pick([
        `For busy two-income families: ${t} done in one weekend so you get your time back. Unlike the usual options, I handle everything start to finish. It's $${price}, which is less than most alternatives. If you're not happy, I'll come back and make it right. I need about 6 hours and maybe $${Math.round(price / 5)} in supplies.`,
        `Parents with kids under 10: I take ${t} completely off your plate. $${price} flat, cheaper than hiring a pro and way less hassle than doing it yourself. If it's not done on the day we agree, you get $50 back. Costs me roughly $${Math.round(price / 4)} and an afternoon.`,
      ]),
    };
  }

  const cost = Math.round(price * pick([0.18, 0.22, 0.28]));
  const refund = pick([75, 100, 150]);
  const fields: GuidedFields = {
    promise: `Two-income parents with kids under 10 get ${t} fully handled within 7 days of booking, with zero planning on their side.`,
    difference: `Today they either pay for a service that only does half the job or burn a weekend doing it themselves. I plan it, do it and clean up in one visit.`,
    price: `$${price} flat. They're spending $${price + 200}+ on the usual option plus 8+ hours of their own time, which at $30/hour is another $240.`,
    guarantee: `If it isn't done by the date we agree, I refund $${refund} within 48 hours. Ten claims would cost $${(refund * 10).toLocaleString()}, which fits my reserve.`,
    pitch: `I help busy parents get ${t} completely off their plate in one weekend.`,
    delivery: `Each job takes me about 6 hours and $${cost} in supplies and gas, so I keep $${price - cost} (${Math.round(((price - cost) / price) * 100)}% margin). I can do 2 per weekend.`,
  };
  return { fields, text: assembleGuided(fields) };
}

/** Assembly order puts the pitch first so the offer reads top-down like a real one. */
export const GUIDED_LABELS: Record<string, string> = {
  pitch: "Pitch",
  promise: "Buyer & outcome",
  difference: "Why me vs. alternatives",
  price: "Price & value",
  guarantee: "Guarantee",
  delivery: "Delivery",
};

export function assembleGuided(fields: GuidedFields): string {
  return Object.entries(GUIDED_LABELS)
    .map(([id, label]) => {
      const v = fields[id as keyof GuidedFields]?.trim();
      return v ? `${label}: ${v}` : null;
    })
    .filter(Boolean)
    .join("\n");
}
