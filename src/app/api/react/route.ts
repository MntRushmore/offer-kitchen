import { react } from "@/lib/game";
import { handleError, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { playerId?: string; emoji?: string };
    await react(String(body.playerId ?? ""), String(body.emoji ?? ""));
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
