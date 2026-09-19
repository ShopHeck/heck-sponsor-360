import { getStore } from "@netlify/blobs";
import {
  MIN_BID, INCREMENT, LOCK_PRICE, DEADLINE, PLACEMENT_ID, json, usd, describePlacement, soldPlacements,
  tryEmail, notifyOwner, bidConfirmationEmail, outbidEmail, invoicePlacement
} from "../lib/sponsorship.mjs";

/* ---------------------------------------------------------------------------
   Sponsor bidding for open placements.

   GET  /api/bids            → public summary per placement (no contact details)
   POST /api/bids            → { id, type: "bid" | "lock", amount?, company, name, email, phone, note? }

   Bids start at MIN_BID and must beat the current high bid by at least INCREMENT.
   "lock" buys the placement outright for LOCK_PRICE and closes bidding on it.
   Records live in the Netlify Blobs store "bids" (one key per placement) and
   are viewable in the Netlify dashboard → Blobs.

   Emails (Resend): bidder gets a confirmation, the previous high bidder an
   outbid notice, Michael a copy of everything. Locks are invoiced immediately
   through Stripe (see ../lib/sponsorship.mjs); auction winners are invoiced by
   the scheduled close-auction function once the deadline passes.
--------------------------------------------------------------------------- */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicView = (id, rec) => ({
  id,
  high: rec.high,
  company: rec.bidder?.company || null,
  count: rec.history?.length || 0,
  locked: Boolean(rec.locked),
  lockedBy: rec.locked ? rec.lockedBy?.company || null : null,
  closed: Boolean(rec.closed)
});

const clean = (v, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export default async (req) => {
  const store = getStore({ name: "bids", consistency: "strong" });

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const placements = {};
    await Promise.all(blobs.map(async ({ key }) => {
      const rec = await store.get(key, { type: "json" });
      if (rec) placements[key] = publicView(key, rec);
    }));
    return json({ minBid: MIN_BID, increment: INCREMENT, lockPrice: LOCK_PRICE, deadline: DEADLINE, placements });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const id = clean(body.id, 8);
  const type = body.type === "lock" ? "lock" : "bid";
  const bidder = { company: clean(body.company), name: clean(body.name), email: clean(body.email).toLowerCase(), phone: clean(body.phone, 40) };
  const note = clean(body.note, 500);

  if (!PLACEMENT_ID.test(id)) return json({ error: "Unknown placement." }, 400);
  if (!bidder.company || !bidder.name) return json({ error: "Company and contact name are required." }, 400);
  if (!EMAIL.test(bidder.email)) return json({ error: "A valid email address is required." }, 400);
  if (Date.now() > new Date(DEADLINE).getTime()) return json({ error: "Bidding has closed for this event." }, 409);
  if ((await soldPlacements(req.url)).has(id)) return json({ error: "This placement is already sold." }, 409);

  const rec = (await store.get(id, { type: "json" })) || { high: 0, bidder: null, history: [], locked: false };
  if (rec.locked || rec.closed) return json({ error: "This placement has been locked by another sponsor.", placement: publicView(id, rec) }, 409);

  const now = new Date().toISOString();
  const previous = rec.high ? rec.history[rec.history.length - 1] : null;
  let amount;
  if (type === "lock") {
    amount = LOCK_PRICE;
  } else {
    amount = Math.round(Number(body.amount));
    const floor = Math.max(MIN_BID, rec.high ? rec.high + INCREMENT : 0);
    if (!Number.isFinite(amount) || amount < floor) {
      return json({ error: `Bid must be at least $${floor.toLocaleString("en-US")}.`, placement: publicView(id, rec) }, 409);
    }
    if (amount >= LOCK_PRICE) amount = LOCK_PRICE;
  }
  if (amount >= LOCK_PRICE) {
    rec.locked = true;
    rec.lockedAt = now;
    rec.lockedBy = bidder;
  }
  rec.high = amount;
  rec.bidder = bidder;
  rec.history.push({ amount, type: rec.locked ? "lock" : "bid", at: now, ...bidder, note });
  await store.setJSON(id, rec);

  if (rec.locked) {
    await invoicePlacement(store, id, rec, "lock");
    if (previous && previous.email !== bidder.email) await tryEmail(outbidEmail(id, rec, previous));
    return json({ ok: true, placement: publicView(id, rec), invoiceUrl: rec.invoice?.url || null, emailed: Boolean(rec.invoice?.emailed) });
  }

  const label = `New high bid ${usd(amount)}`;
  await Promise.all([
    tryEmail(bidConfirmationEmail(id, rec)),
    previous && previous.email !== bidder.email ? tryEmail(outbidEmail(id, rec, previous)) : null,
    notifyOwner(`${id} · ${label} · ${bidder.company}`, [
      `Placement: ${id} — ${describePlacement(id)}`,
      `Action: ${label}`,
      `Company: ${bidder.company}`,
      `Contact: ${bidder.name}`,
      `Email: ${bidder.email}`,
      `Phone: ${bidder.phone || "-"}`,
      note ? `Note: ${note}` : "",
      previous ? `Outbid: ${previous.company} (${previous.email}) at ${usd(previous.amount)}` : "",
      `Time: ${now}`,
      "",
      "No invoice yet — the winner is invoiced automatically when bidding closes.",
      "All bids: Netlify dashboard → heck-sponsor-360 → Blobs → bids"
    ])
  ]);

  return json({ ok: true, placement: publicView(id, rec) });
};

export const config = { path: "/api/bids" };
