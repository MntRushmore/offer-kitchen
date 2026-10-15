import "server-only";
import { GameError } from "./game";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function handleError(err: unknown) {
  if (err instanceof GameError) return json({ error: err.message }, 400);
  console.error(err);
  return json({ error: "Something burned in the kitchen. Try again." }, 500);
}
