import { submitOffer } from "@/lib/game";
import { handleError, json } from "@/lib/http";
import type { GuidedFields } from "@/lib/types";

// Grading runs in after(), which shares this route's duration budget.
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { playerId: string; round: number; text?: string; fields?: GuidedFields | null };
    const submission = await submitOffer(body);
    return json({ submission });
  } catch (err) {
    return handleError(err);
  }
}
