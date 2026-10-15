import { isAdmin } from "@/lib/auth";
import { exportCsv } from "@/lib/game";
import { json } from "@/lib/http";

export async function GET(req: Request) {
  if (!isAdmin(req)) return json({ error: "Wrong password" }, 401);
  const csv = await exportCsv();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="offer-kitchen-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
