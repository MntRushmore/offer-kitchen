import { leaveGame } from "@/lib/game";
import { handleError, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { playerId?: string };
    await leaveGame(String(body.playerId ?? ""));
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
