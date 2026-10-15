import { isAdmin } from "@/lib/auth";
import { testGrade } from "@/lib/game";
import { handleError, json } from "@/lib/http";

export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isAdmin(req)) return json({ error: "Wrong password" }, 401);
  try {
    const { topicId, text } = (await req.json()) as { topicId: string; text: string };
    return json({ grade: await testGrade(topicId, String(text ?? "")) });
  } catch (err) {
    return handleError(err);
  }
}
