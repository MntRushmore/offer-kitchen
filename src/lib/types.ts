export const CRITERIA_IDS = [
  "promise",
  "difference",
  "price",
  "guarantee",
  "pitch",
  "delivery",
] as const;
export type CriterionId = (typeof CRITERIA_IDS)[number];

export type Scaffold = "blank" | "checklist" | "guided";
export type Phase =
  | "lobby"
  | "intro"
  | "writing"
  | "grading"
  | "leaderboard"
  | "spotlight"
  | "final";
export type GradingMode = "ai" | "mock";
export type Letter = "A" | "B" | "C" | "D" | "F";
export type RevealPace = "fast" | "normal" | "slow";

export interface TopicCard {
  id: string;
  title: string;
  emoji: string;
  /** A built-in illustration key (see TOPIC_ART), an image URL, or null for the emoji. */
  image?: string | null;
  /** Two or three short bullets: the at-a-glance version players write from. Empty = derived from the fields below. */
  brief?: string[];
  buyer: string;
  pain: string;
  alternatives: string;
  scope: string;
  economics: string;
  /** Any stated dollar amount at or above this trips the "unrealistic price" server check. */
  absurdPrice: number;
}

export interface RoundConfig {
  name: string;
  subtitle: string;
  topicId: string;
  scaffold: Scaffold;
  minutes: number;
  tips: string[];
  /** 0 = everyone writes. N = only the top N by best earlier score write; everyone else watches. */
  finalists?: number;
}

export interface TierLabel {
  name: string;
  emoji: string;
}

/** Everything about how the show looks, sounds and runs, editable from the admin page. */
export interface ShowSettings {
  title: string;
  tagline: string;
  /** A line under the tagline on the TV lobby, e.g. the event name. */
  lobbyNote: string;
  hostName: string;
  leaderboardSize: number;
  revealPace: RevealPace;
  /** When phones see their own grade: as soon as the kitchen locks, or only once the TV reveals. */
  phoneGrades: "lock" | "reveal";
  reactions: boolean;
  confetti: boolean;
  musicVolume: number;
  sfxVolume: number;
  autoLock: boolean;
  autoReveal: boolean;
  lateJoin: boolean;
  /** Bots normally get free simulated grades; turn on to spend real AI calls on them. */
  botsUseAI: boolean;
  tiers: Record<Letter, TierLabel>;
  demo: {
    bots: number;
    writingSeconds: number;
    /** Grade the two on-screen demo phones with real AI (if connected). */
    seatsUseAI: boolean;
  };
}

export interface GameConfig {
  rounds: RoundConfig[];
  topics: TopicCard[];
  model: string;
  gradingMode: GradingMode;
  /** null = use the built-in Offer Kitchen grader prompt. */
  graderPrompt: string | null;
  /** Optional override for the URL shown on the TV / encoded in the QR. */
  joinUrl: string | null;
  show: ShowSettings;
}

export type SoundCue =
  | "bell"
  | "drumroll"
  | "applause"
  | "airhorn"
  | "ding"
  | "sadTrombone"
  | "sizzle"
  | "fanfare";

export interface GameState {
  id: string;
  phase: Phase;
  roundIndex: number;
  roundEndsAt: number | null;
  /** While the timer is paused: ms that were left. */
  pausedLeft: number | null;
  spotlightPlayerId: string | null;
  muted: boolean;
  /** When the current phase (or round) began, for autopilot pacing. */
  phaseStartedAt: number;
  /** Demo mode: the server walks the whole show on its own. */
  autopilot: boolean;
  announcement: { text: string; at: number } | null;
  cue: { id: SoundCue; at: number } | null;
  /** Who writes in a finalists-only round. Picked when that round starts; the host can swap people. */
  finalists: { round: number; ids: string[] } | null;
  updatedAt: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  joinedAt: number;
  hidden: boolean;
  bot?: boolean;
  /** A demo-stage phone ("a" / "b") that types its own offers on screen. */
  seat?: string;
}

export type GuidedFields = Partial<Record<CriterionId, string>>;

export interface Submission {
  round: number;
  playerId: string;
  text: string;
  fields: GuidedFields | null;
  version: number;
  submittedAt: number;
}

export interface CriterionGrade {
  id: CriterionId;
  score: number;
  evidence: string;
  feedback: string;
}

export interface Grade {
  overall: number;
  letter: Letter;
  passed: boolean;
  compelling: boolean;
  verdict: string;
  strength: string;
  nextMove: string;
  criteria: CriterionGrade[];
  levers: { outcome: string; likelihood: string; delay: string; effort: string };
  serverNotes: string[];
  simulated?: boolean;
  model?: string;
  ms?: number;
}

export interface GradeRecord {
  forVersion: number;
  status: "pending" | "done" | "error";
  startedAt: number;
  grade?: Grade;
  error?: string;
}

/* ---------- What the API sends to clients ---------- */

export interface RoundView extends RoundConfig {
  topic: TopicCard | null;
}

export interface BoardEntry {
  playerId: string;
  submittedAt: number;
  status: "submitted" | "graded" | "error";
  overall?: number;
  letter?: Letter;
}

export interface SpotlightView {
  player: Player;
  submission: Submission;
  grade: Grade | null;
}

export interface MeRound {
  submission: Submission | null;
  gradeStatus: "none" | "pending" | "done" | "error";
  grade: Grade | null;
  rank: number | null;
  of: number | null;
}

export interface MeView {
  player: Player;
  rounds: MeRound[];
  /** Demo seats only: the offer this phone will type for the current round. */
  script?: { text: string; fields: GuidedFields | null } | null;
  /** When this player asked an organizer for help; null once someone has helped. */
  helpAt: number | null;
}

export interface HelpRequest {
  playerId: string;
  at: number;
}

export interface AdminView {
  config: GameConfig;
  subs: Submission[];
  grades: Record<string, GradeRecord>;
  aiConfigured: boolean;
  storeKind: "redis" | "memory";
  defaultPrompt: string;
  /** Open help requests, oldest first. */
  help: HelpRequest[];
}

/** The slice of ShowSettings every screen needs. */
export type PublicShow = Omit<ShowSettings, "demo" | "botsUseAI" | "autoLock" | "autoReveal" | "lateJoin">;

export interface PublicState {
  serverNow: number;
  game: GameState;
  rounds: RoundView[];
  players: Player[];
  /** Per round: who has plated, and (once revealed) their score. */
  board: BoardEntry[][];
  scoresRevealed: boolean[];
  spotlight: SpotlightView | null;
  me: MeView | null;
  joinUrl: string | null;
  show: PublicShow;
  /** Running per-emoji reaction counters; screens animate the deltas. */
  reactions: Record<string, number>;
  admin?: AdminView;
}
