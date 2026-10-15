import { isAdmin } from "@/lib/auth";
import { currentModel } from "@/lib/game";
import { writeTopic } from "@/lib/grader/topics";
import { handleError, json } from "@/lib/http";

export const maxDuration = 120;

export async function POST(req: Request) {
  if (!isAdmin(req)) return json({ error: "Wrong password" }, 401);
  try {
    const { idea } = (await req.json()) as { idea?: string };
    return json({ topic: await writeTopic(String(idea ?? ""), await currentModel()) });
  } catch (err) {
    return handleError(err);
  }
}
