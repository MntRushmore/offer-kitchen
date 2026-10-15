import { isAdmin } from "@/lib/auth";
import { buildState, tick } from "@/lib/game";
import { handleError, json } from "@/lib/http";

// Grading for autopilot bots runs in after(), which shares this route's budget.
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wantsAdmin = url.searchParams.get("admin") === "1";
  if (wantsAdmin && !isAdmin(req)) return json({ error: "Wrong password" }, 401);
  try {
    // Polls double as the show's heartbeat: auto-lock, auto-reveal and demo autopilot.
    await tick().catch((err) => console.error("tick failed", err));
    return json(await buildState({ playerId: url.searchParams.get("pid"), admin: wantsAdmin }));
  } catch (err) {
    return handleError(err);
  }
}
