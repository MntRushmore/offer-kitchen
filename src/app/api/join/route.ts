import { joinGame } from "@/lib/game";
import { handleError, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; avatar?: string; seat?: string };
    const player = await joinGame(String(body.name ?? ""), String(body.avatar ?? ""), body.seat ?? null);
    return json({ player });
  } catch (err) {
    return handleError(err);
  }
}
