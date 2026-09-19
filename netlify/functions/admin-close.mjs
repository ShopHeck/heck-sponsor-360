import { closeAuction } from "../lib/close-auction.mjs";
import { json } from "../lib/sponsorship.mjs";

/* Manual trigger for the close-auction job (retry failed invoices, or close
   the auction early with ?force=1). Requires ADMIN_TOKEN:
     curl -X POST -H "authorization: Bearer $ADMIN_TOKEN" https://<site>/api/close-auction
--------------------------------------------------------------------------- */
export default async (req) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return json({ error: "ADMIN_TOKEN is not configured." }, 503);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (req.headers.get("authorization") !== `Bearer ${token}`) return json({ error: "Unauthorized" }, 401);
  const url = new URL(req.url);
  const summary = await closeAuction(process.env.URL || url.origin, { force: url.searchParams.get("force") === "1" });
  return json(summary);
};

export const config = { path: "/api/close-auction" };
