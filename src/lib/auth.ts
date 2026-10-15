import "server-only";

/** Host password. Set ADMIN_PASSWORD in Vercel; "kitchen" is the local default. */
export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD || "kitchen";
  const url = new URL(req.url);
  const given = req.headers.get("x-admin-key") ?? url.searchParams.get("key");
  return given === expected;
}
