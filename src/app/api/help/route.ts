import { askForHelp } from "@/lib/game";
import { handleError, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { playerId?: string; on?: boolean };
    await askForHelp(String(body.playerId ?? ""), body.on !== false);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
