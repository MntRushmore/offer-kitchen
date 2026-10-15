import { isAdmin } from "@/lib/auth";
import { adminAction, type AdminAction } from "@/lib/game";
import { handleError, json } from "@/lib/http";

export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isAdmin(req)) return json({ error: "Wrong password" }, 401);
  try {
    await adminAction((await req.json()) as AdminAction);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
