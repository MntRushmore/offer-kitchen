import type { CriterionId, GameConfig, Letter, RoundConfig, Scaffold, ShowSettings, SoundCue, TopicCard } from "./types";

/** Illustrated food chefs in /public/art/avatars. Players store the id. */
export const AVATARS = [
  "tomato", "avocado", "egg", "cupcake", "strawberry", "croissant", "taco", "sushi",
  "pancake", "broccoli", "lemon", "donut", "chili", "cheese", "dumpling", "carrot",
  "watermelon", "mushroom", "pretzel", "cookie", "icecream", "bao", "pineapple", "waffle",
  "eggplant", "peach", "onigiri", "hotdog", "pizza", "corn", "coffee", "cherry",
];

export const avatarSrc = (id: string) => `/art/avatars/${id}.webp`;
export const isArtAvatar = (id: string) => AVATARS.includes(id);

/** Built-in illustrations a topic card can use. */
export const TOPIC_ART: Record<string, { label: string; src: string }> = {
  birthday: { label: "Birthday cake", src: "/art/topic-birthday.webp" },
  garage: { label: "Garage & tools", src: "/art/topic-garage.webp" },
  dinner: { label: "Meal prep", src: "/art/topic-dinner.webp" },
  lights: { label: "House with lights", src: "/art/topic-lights.webp" },
  tech: { label: "Phone & video call", src: "/art/topic-tech.webp" },
  generic: { label: "Recipe book", src: "/art/topic-generic.webp" },
};

export function topicImage(topic: Pick<TopicCard, "image">): string | null {
  const img = topic.image;
  if (!img) return null;
  if (TOPIC_ART[img]) return TOPIC_ART[img].src;
  return /^(https?:)?\/|^data:image\//.test(img) ? img : null;
}

export const ROUND_ART: Record<Scaffold, string> = {
  blank: "/art/round-raw.webp",
  checklist: "/art/round-seasoned.webp",
  guided: "/art/round-grandslam.webp",
};

export const MASCOT = {
  wave: "/art/mascot-wave.webp",
  point: "/art/mascot-point.webp",
  taste: "/art/mascot-taste.webp",
  kiss: "/art/mascot-kiss.webp",
  think: "/art/mascot-think.webp",
  cheer: "/art/mascot-cheer.webp",
  shock: "/art/mascot-shock.webp",
} as const;

export const REACTIONS = ["🔥", "👏", "😂", "🤌", "😱", "🍅"];

export const SOUND_CUES: { id: SoundCue; label: string; emoji: string }[] = [
  { id: "bell", label: "Order up bell", emoji: "🛎️" },
  { id: "drumroll", label: "Drumroll", emoji: "🥁" },
  { id: "applause", label: "Applause", emoji: "👏" },
  { id: "airhorn", label: "Air horn", emoji: "📯" },
  { id: "ding", label: "Ding", emoji: "✨" },
  { id: "sadTrombone", label: "Sad trombone", emoji: "🎺" },
  { id: "sizzle", label: "Sizzle", emoji: "🍳" },
  { id: "fanfare", label: "Fanfare", emoji: "🎉" },
];

const CHEF_FIRST = ["Chef", "Sous-chef", "Captain", "Auntie", "Uncle", "Professor", "Little", "Big", "Saucy", "Spicy"];
const CHEF_LAST = [
  "Basil", "Paprika", "Waffles", "Biscuit", "Nugget", "Pickles", "Noodle", "Muffin", "Crumble",
  "Gravy", "Pesto", "Sprinkles", "Dumpling", "Tater", "Nacho", "Brioche", "Mango", "Saffron",
];
export function randomChefName() {
  const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
  return `${pick(CHEF_FIRST)} ${pick(CHEF_LAST)}`.slice(0, 18);
}

export const AVATAR_COLORS = [
  "#6fbbe2", "#f4c4cf", "#84bc74", "#fddb68", "#eb9824",
  "#c0dfc6", "#fd6338", "#edf386", "#b6dbc9", "#f7b98a",
];

export const CRITERIA: Record<
  CriterionId,
  { label: string; short: string; emoji: string; hint: string; placeholder: string }
> = {
  promise: {
    label: "Buyer & dream outcome",
    short: "Promise",
    emoji: "🎯",
    hint: "Who exactly? What result? By when?",
    placeholder: "___ (one specific buyer) gets ___ (result) by ___ (deadline).",
  },
  difference: {
    label: "Category of one",
    short: "Different",
    emoji: "🦄",
    hint: "Why you instead of what they use today?",
    placeholder: "Unlike ___ (what they use today), I...",
  },
  price: {
    label: "Premium price & value",
    short: "Price",
    emoji: "💰",
    hint: "Your price vs. what it's worth to them",
    placeholder: "$___ — compared to what they spend or lose today...",
  },
  guarantee: {
    label: "Risk reversal",
    short: "Guarantee",
    emoji: "🛡️",
    hint: "If it fails: what you do, by when",
    placeholder: "If ___ doesn't happen by ___, I will ___.",
  },
  pitch: {
    label: "One-sentence pitch",
    short: "Pitch",
    emoji: "📣",
    hint: "Buyer + result in one line",
    placeholder: "I help ___ get ___ in ___ without ___.",
  },
  delivery: {
    label: "Credible delivery",
    short: "Delivery",
    emoji: "🚚",
    hint: "Your hours, costs and margin",
    placeholder: "Each one takes me ___ hours and costs $___, so I keep $___.",
  },
};

/** `color` fills a chip or bar; `text` is the same hue dark enough to read on cream. */
export const GRADE_TIERS: Record<Letter, { name: string; emoji: string; color: string; ink: string; text: string }> = {
  A: { name: "Chef's Kiss", emoji: "🤌", color: "#84bc74", ink: "#613301", text: "#3c7a2c" },
  B: { name: "Well Done", emoji: "🔥", color: "#6fbbe2", ink: "#274e63", text: "#2a6f96" },
  C: { name: "Medium", emoji: "🍳", color: "#fddb68", ink: "#613301", text: "#946b00" },
  D: { name: "Half-Baked", emoji: "🥖", color: "#eb9824", ink: "#613301", text: "#b45f0a" },
  F: { name: "Raw", emoji: "🥩", color: "#fd6338", ink: "#613301", text: "#c43a14" },
};

export const LETTERS: Letter[] = ["F", "D", "C", "B", "A"];

export function scoreToLetter(score: number): Letter {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s >= 90) return "A";
  if (s >= 80) return "B";
  if (s >= 70) return "C";
  if (s >= 60) return "D";
  return "F";
}

export const MODELS = [
  { id: "anthropic/claude-opus-5.5-fast", label: "Claude Opus 5.5 (fast) — recommended" },
  { id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5" },
  { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5" },
  { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5 (fastest, least strict)" },
];

export const DEFAULT_TOPICS: TopicCard[] = [
  {
    id: "birthday",
    image: "birthday",
    brief: [
      "Busy parents of 5–9-year-olds hosting a party at home",
      "Venues charge $350–$650; entertainers $200–$400 an hour",
      "You host at their home on weekends: about 6 hours and $75 in costs per party",
    ],
    title: "Birthday Party Rescue",
    emoji: "🎉",
    buyer:
      "Busy parents of 5–9-year-olds planning a home birthday party; first-time party hosts; families with two working parents.",
    pain:
      "Planning eats 6–10 hours across two weeks, the party itself is two hours of chaos, and parents end up refereeing instead of enjoying their kid's day. Venue packages book up weeks ahead.",
    alternatives:
      "Trampoline park or play-place packages run $350–$650 for 10–12 kids (fixed 90-minute slot, parents still herd kids). Hired entertainers charge $200–$400 per hour and don't plan or clean up. DIY from Pinterest costs $150–$300 in supplies plus the parents' time.",
    scope:
      "You run parties at the client's home on Saturdays or Sundays: up to 2 parties per weekend day, max 15 kids, 2 hours each. You bring games, a craft station and a host script. You don't bake or serve food.",
    economics:
      "Craft supplies cost about $4 per kid. A reusable games-and-decor kit costs $250 one time. Each party takes about 6 hours total (planning call and prep 1.5h, travel 0.5h, running it 2h, setup and cleanup 1h, buffer 1h) plus $15 of gas.",
    absurdPrice: 20000,
  },
  {
    id: "garage",
    image: "garage",
    brief: [
      "Homeowners who can't park in their own garage",
      "Organizers charge $80–$150 an hour; junk haulers $300–$800 a load",
      "One garage per weekend: about 14 hours, plus $250–$450 in shelving and $210 in dump runs",
    ],
    title: "Garage Rescue",
    emoji: "🧰",
    buyer:
      "Homeowners who can't park in their own garage; families getting ready to sell or move; parents with years of kid gear piled up.",
    pain:
      "Both cars live in the driveway, nobody can find anything, and the 'we'll finally do it this weekend' plan has failed three years running. A cluttered garage also drags down listing photos.",
    alternatives:
      "Junk haulers charge $300–$800 per load but only haul — no sorting or organizing. Professional organizers charge $80–$150 per hour, usually 10–15 hours for a garage. A storage unit runs $120–$220 per month. DIY costs a weekend or three plus dump fees.",
    scope:
      "You do one garage per weekend (Saturday and Sunday, about 12 hours total). You sort into keep / donate / dump, install basic wall shelving and label bins. You drive an SUV, not a truck.",
    economics:
      "Shelving and bins cost $250–$450 per garage. Each dump run costs $60 for a trailer rental plus a $45 dump fee, usually 2 runs. Donation drop-off is free. Your time is about 12 hours plus 2 hours of driving.",
    absurdPrice: 20000,
  },
  {
    id: "dinner",
    image: "dinner",
    brief: [
      "Busy two-income families with young kids",
      "Takeout runs $60–$90 a night; meal kits $10–$13 a serving",
      "You cook 5 dinners in their kitchen each week: about 5 hours, plus $110–$150 in groceries",
    ],
    title: "Weeknight Dinner Prep",
    emoji: "🍲",
    buyer:
      "Dual-income families with young kids; new parents; families who keep 'meaning to cook more'.",
    pain:
      "The 5:30pm 'what's for dinner' panic ends in $60–$90 of takeout three or four nights a week, and nobody feels great about it.",
    alternatives:
      "Meal kits cost $10–$13 per serving and you still cook and clean. Takeout averages $15–$20 per person. A personal chef charges $300–$500 per week plus groceries. Grocery-store prepared meals run $9–$14 per serving.",
    scope:
      "You serve at most 2 families per week: one on Sunday afternoon, one on a weeknight evening. In each session you cook five family-of-four dinners in the client's kitchen, label them and leave reheat instructions.",
    economics:
      "Groceries for five family-of-four dinners run $110–$150 per week. Containers are a $40 one-time cost per family. Your time is about 5 hours per family per week (1h shopping, 4h cooking and cleanup) plus $10 of gas.",
    absurdPrice: 20000,
  },
  {
    id: "lights",
    image: "lights",
    brief: [
      "Homeowners who hate ladders or don't have the time",
      "Pro installers charge $500–$2,500 a season",
      "Single-story homes only: about 6 hours a house, and the lights ($180–$300) last 3 seasons",
    ],
    title: "Holiday Lights Install",
    emoji: "🎄",
    buyer:
      "Homeowners who hate ladders; older homeowners; busy families who want the house to look great for the holidays.",
    pain:
      "Climbing a ladder in the cold is risky, the lights tangle, half the strand dies, and it eats a weekend to put up and another to take down.",
    alternatives:
      "Pro installers charge $500–$2,500 per season and book up by mid-November. DIY costs $150–$400 in lights plus two weekends and real fall risk. A handyman charges $60–$90 per hour and doesn't bring lights.",
    scope:
      "You install on weekends from mid-November and take down in January. A single-story roofline takes 4 hours to install and 2 hours to take down. You own a 24-foot ladder and a clip kit, and only work single-story roofs.",
    economics:
      "Commercial LED lights cost $180–$300 per house and last 3 seasons. Clips and cords cost $35 per house. Storage bins cost $20. Your time is 6 hours per house per season plus $20 of gas.",
    absurdPrice: 20000,
  },
  {
    id: "tech",
    image: "tech",
    brief: [
      "Adult kids whose aging parents keep calling for tech help",
      "Big-box tech visits cost $100–$200 and fix one device",
      "90-minute home visits on evenings and weekends: about 2 hours and $10 of gas each",
    ],
    title: "Tech Help for Grandparents",
    emoji: "📱",
    buyer:
      "Adult children whose aging parents keep calling for tech help; seniors who want to video-call grandkids; families worried about phone scams.",
    pain:
      "Grandma can't join the FaceTime, Dad clicked a scam link again, and every family visit turns into a two-hour tech support session.",
    alternatives:
      "Big-box tech support visits cost $100–$200 each and fix one device. Store tech memberships run about $200 per year but you have to go in. Grandkids and neighbors help for free — rarely and impatiently.",
    scope:
      "You make in-home visits on weekday evenings and weekends, 90 minutes each, within 20 minutes of home. You set up devices, teach with printed cheat sheets, and can do 20-minute video check-ins.",
    economics:
      "Laminated cheat sheets cost $8 per client. Gas is about $10 per visit. Each visit takes 2 hours including travel; a video check-in takes 20 minutes.",
    absurdPrice: 20000,
  },
];

export const DEFAULT_ROUNDS: RoundConfig[] = [
  {
    name: "Raw",
    subtitle: "No recipe yet. Just cook.",
    topicId: "birthday",
    scaffold: "blank",
    minutes: 3,
    tips: ["Write the offer you'd text a neighbor who might buy.", "No rules yet — just go!"],
  },
  {
    name: "Seasoned",
    subtitle: "Now you know the six ingredients.",
    topicId: "birthday",
    scaffold: "checklist",
    minutes: 5,
    tips: [
      "Name ONE specific buyer and the result they get — by when.",
      "Say your price and compare it to what they pay today.",
      "What happens if it doesn't work? Spell out the guarantee.",
      "Show you can deliver: your hours, your costs, your margin.",
    ],
  },
  {
    name: "Grand Slam",
    subtitle: "Plate the whole thing.",
    topicId: "birthday",
    scaffold: "guided",
    minutes: 7,
    tips: [
      "Numbers beat adjectives. Every claim gets a $ or a deadline.",
      "Guarantee test: could you afford it if 10 people claimed it?",
      "Buzzwords earn zero. 'Dream outcome' isn't a term of the deal.",
      "Your pitch is one sentence: buyer + result.",
    ],
  },
];

export const DEFAULT_SHOW: ShowSettings = {
  title: "Offer Kitchen",
  tagline: "Cook up an offer so good, people feel stupid saying no.",
  lobbyNote: "",
  hostName: "",
  leaderboardSize: 5,
  revealPace: "normal",
  phoneGrades: "lock",
  reactions: true,
  confetti: true,
  musicVolume: 70,
  sfxVolume: 85,
  autoLock: true,
  autoReveal: false,
  lateJoin: true,
  botsUseAI: false,
  tiers: Object.fromEntries(
    (Object.keys(GRADE_TIERS) as Letter[]).map((l) => [l, { name: GRADE_TIERS[l].name, emoji: GRADE_TIERS[l].emoji }]),
  ) as ShowSettings["tiers"],
  demo: { bots: 18, writingSeconds: 120, seatsUseAI: true },
};

export const REVEAL_GAP_MS: Record<ShowSettings["revealPace"], number> = { fast: 650, normal: 1100, slow: 1700 };

export const DEFAULT_CONFIG: GameConfig = {
  rounds: DEFAULT_ROUNDS,
  topics: DEFAULT_TOPICS,
  model: MODELS[0].id,
  gradingMode: "ai",
  graderPrompt: null,
  joinUrl: null,
  show: DEFAULT_SHOW,
};

/** Fill in anything a stored (older) config is missing. */
export function withDefaults(saved: Partial<GameConfig> | null): GameConfig {
  const s = saved ?? {};
  const show = { ...DEFAULT_SHOW, ...(s.show ?? {}) };
  show.tiers = { ...DEFAULT_SHOW.tiers, ...(s.show?.tiers ?? {}) };
  show.demo = { ...DEFAULT_SHOW.demo, ...(s.show?.demo ?? {}) };
  // Cards saved before briefs existed: a built-in card nobody edited gets its brief back.
  const topics = s.topics?.map((t) => {
    if (t.brief?.length) return t;
    const d = DEFAULT_TOPICS.find((x) => x.id === t.id);
    const same = d && BRIEF_SOURCE.every((k) => d[k] === t[k]);
    return same ? { ...t, brief: d.brief } : t;
  });
  return { ...DEFAULT_CONFIG, ...s, ...(topics && { topics }), show };
}

const BRIEF_SOURCE = ["buyer", "alternatives", "scope", "economics"] as const;

/**
 * The few bullets players write from. A card without a hand-written brief
 * gets the first clause of who buys, what they use today and your setup.
 */
export function topicBrief(topic: TopicCard): string[] {
  const own = (topic.brief ?? []).map((b) => b.trim()).filter(Boolean);
  if (own.length) return own;
  const first = (s: string) =>
    s
      .replace(/\s*\([^)]*\)/g, "")
      .split(/;|\.\s|\.$/)[0]
      .trim();
  return [topic.buyer, topic.alternatives, topic.scope].map(first).filter(Boolean);
}

export const OVEN_LINES = [
  "Checking the math on your guarantee…",
  "Tasting for buzzwords…",
  "Counting the hours…",
  "Comparing against what they use today…",
  "Asking: would they feel dumb saying no?",
  "Weighing the margin…",
  "Sniffing out fake scarcity…",
  "Pre-heating the leaderboard…",
];
