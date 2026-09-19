import { getStore } from "@netlify/blobs";

/* ---------------------------------------------------------------------------
   Sponsor bidding for open placements.

   GET  /api/bids            → public summary per placement (no contact details)
   POST /api/bids            → { id, type: "bid" | "lock", amount?, company, name, email, phone, note? }

   Bids start at MIN_BID and must beat the current high bid by at least INCREMENT.
   "lock" buys the placement outright for LOCK_PRICE and closes bidding on it.
   Records live in the Netlify Blobs store "bids" (one key per placement) and
   are viewable in the Netlify dashboard → Blobs. If RESEND_API_KEY is set,
   Michael is emailed on every bid and lock.
--------------------------------------------------------------------------- */
const MIN_BID = Number(process.env.MIN_BID) || 500;
const INCREMENT = Number(process.env.BID_INCREMENT) || 50;
const LOCK_PRICE = Number(process.env.LOCK_PRICE) || 2500;
const DEADLINE = process.env.BID_DEADLINE || "2026-10-16T23:59:59-04:00";
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "michaelheckert@heckholdings.com";
const PLACEMENT_ID = /^(S[FB]-[LR][1-3]|TF-(0[1-9]|1[0-2])|TB-01|TS-0[1-3])$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const publicView = (id, rec) => ({
  id,
  high: rec.high,
  company: rec.bidder?.company || null,
  count: rec.history?.length || 0,
  locked: Boolean(rec.locked),
  lockedBy: rec.locked ? rec.lockedBy?.company || null : null
});

async function soldPlacements(req) {
  try {
    const res = await fetch(new URL("/assets/sponsors.json", req.url));
    return res.ok ? new Set(Object.keys(await res.json())) : new Set();
  } catch {
    return new Set();
  }
}

async function notify(subject, lines) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || "Sponsorship Portal <onboarding@resend.dev>",
        to: [NOTIFY_EMAIL],
        subject,
        text: lines.join("\n")
      })
    });
  } catch (err) {
    console.error("notify failed", err);
  }
}

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
  if ((await soldPlacements(req)).has(id)) return json({ error: "This placement is already sold." }, 409);

  const rec = (await store.get(id, { type: "json" })) || { high: 0, bidder: null, history: [], locked: false };
  if (rec.locked) return json({ error: "This placement has been locked by another sponsor.", placement: publicView(id, rec) }, 409);

  const now = new Date().toISOString();
  let amount;
  if (type === "lock") {
    amount = LOCK_PRICE;
    rec.locked = true;
    rec.lockedAt = now;
    rec.lockedBy = bidder;
  } else {
    amount = Math.round(Number(body.amount));
    const floor = Math.max(MIN_BID, rec.high ? rec.high + INCREMENT : 0);
    if (!Number.isFinite(amount) || amount < floor) {
      return json({ error: `Bid must be at least $${floor.toLocaleString("en-US")}.`, placement: publicView(id, rec) }, 409);
    }
    if (amount >= LOCK_PRICE) {
      amount = LOCK_PRICE;
      rec.locked = true;
      rec.lockedAt = now;
      rec.lockedBy = bidder;
    }
  }
  rec.high = amount;
  rec.bidder = bidder;
  rec.history.push({ amount, type: rec.locked ? "lock" : "bid", at: now, ...bidder, note });
  await store.setJSON(id, rec);

  const label = rec.locked ? `LOCKED for $${amount.toLocaleString("en-US")}` : `New high bid $${amount.toLocaleString("en-US")}`;
  await notify(`[Sponsorship] ${id} · ${label} · ${bidder.company}`, [
    `Placement: ${id}`,
    `Action: ${label}`,
    `Company: ${bidder.company}`,
    `Contact: ${bidder.name}`,
    `Email: ${bidder.email}`,
    `Phone: ${bidder.phone || "-"}`,
    note ? `Note: ${note}` : "",
    `Time: ${now}`,
    "",
    "All bids: Netlify dashboard → heck-sponsor-360 → Blobs → bids"
  ].filter(Boolean));

  return json({ ok: true, placement: publicView(id, rec) });
};

export const config = { path: "/api/bids" };
