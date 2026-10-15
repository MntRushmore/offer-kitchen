import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { DEFAULT_TOPICS } from "../constants";
import { GameError } from "../game";
import type { TopicCard } from "../types";
import { aiConfigured } from "./grade";

const Draft = z.object({
  title: z.string(),
  emoji: z.string(),
  buyer: z.string(),
  pain: z.string(),
  alternatives: z.string(),
  scope: z.string(),
  economics: z.string(),
  brief: z.array(z.string()),
});

const SYSTEM = `You write topic cards for Offer Kitchen, a live workshop where parents practice writing a Grand Slam offer for a fictional solo side hustle they would run themselves on evenings and weekends.
A topic card gives participants the facts they need to write a concrete offer, and gives a strict grader the facts to check it against. Write like the example: plain words, short sentences, real-feeling US price ranges and hours.
- title: 2–4 words, Title Case.
- emoji: one emoji.
- buyer: 2–3 possible buyer groups separated by semicolons (participants pick one).
- pain: what hurts today, with a concrete cost in time or money.
- alternatives: 3–4 things buyers use today, each with a realistic $ range and a weakness.
- scope: exactly what one person can deliver, when, capacity limits, equipment they have. Solo only, no employees.
- economics: per-job costs, one-time costs, and hours per job broken down.
- brief: exactly 3 bullets of at most 14 words each, the at-a-glance version players write from: (1) who buys, (2) what they pay today, with a $ range, (3) what you can deliver, with your hours and costs per job. Use only numbers from the fields above.
Never include a suggested price for the participant's own offer.`;

export async function writeTopic(idea: string, model: string): Promise<TopicCard> {
  const clean = idea.trim().slice(0, 300);
  if (!clean) throw new GameError("Describe the business idea first.");
  if (!aiConfigured()) throw new GameError("AI isn't connected on the server, so it can't write cards yet.");
  const { output } = await generateText({
    model,
    instructions: SYSTEM,
    prompt: `Example card:\n${JSON.stringify(DEFAULT_TOPICS[0], null, 2)}\n\nWrite a new card for this side hustle: ${clean}`,
    output: Output.object({ schema: Draft }),
    timeout: 90_000,
  });
  const slug = output.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "topic";
  return { ...output, brief: output.brief.slice(0, 4), id: `${slug}-${Date.now().toString(36).slice(-4)}`, image: "generic", absurdPrice: 20000 };
}
