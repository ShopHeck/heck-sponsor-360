/* ---------------------------------------------------------------------------
   Shared helpers for the sponsorship functions: auction settings, placement
   labels, Resend email, and Stripe invoicing.

   Environment:
     STRIPE_SECRET_KEY  – enables invoicing (sk_test_… locally, sk_live_… in prod)
     RESEND_API_KEY     – enables email
     NOTIFY_FROM        – verified Resend sender (default "Team Heck Sponsorships <sponsors@michaelheckert.com>")
     NOTIFY_EMAIL       – Michael's inbox (also the reply-to on sponsor emails)
     PORTAL_URL         – public URL sponsors should visit (the marketing site that embeds the portal, or the portal itself);
                          deep links are PORTAL_URL/#PLACEMENT-ID. API links always use Netlify's URL.
--------------------------------------------------------------------------- */
export const MIN_BID = Number(process.env.MIN_BID) || 500;
export const INCREMENT = Number(process.env.BID_INCREMENT) || 50;
export const LOCK_PRICE = Number(process.env.LOCK_PRICE) || 2500;
export const DEADLINE = process.env.BID_DEADLINE || "2026-10-16T23:59:59-04:00";
export const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "michaelheckert@heckholdings.com";
export const EVENT_NAME = process.env.EVENT_NAME || "BKFC Clearwater";
const PORTAL_URL = process.env.PORTAL_URL || process.env.URL || "https://heck-sponsor-360.netlify.app";
// The functions/API always live on the Netlify host, even when PORTAL_URL points at the marketing site that embeds the portal.
const API_URL = process.env.URL || "https://heck-sponsor-360.netlify.app";
const STRIPE_API = process.env.STRIPE_API_BASE || "https://api.stripe.com";
const RESEND_API = process.env.RESEND_API_BASE || "https://api.resend.com";

export const PLACEMENT_ID = /^(S[FB]-[LR][1-3]|TF-(0[1-9]|1[0-2])|TB-01|TS-0[1-3])$/;
export const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export function describePlacement(id) {
  let m;
  if ((m = id.match(/^S([FB])-([LR])([1-3])$/))) {
    return `Fight shorts · ${m[1] === "F" ? "Front" : "Back"} ${m[2] === "L" ? "left" : "right"} leg · ${["Upper", "Center", "Lower"][m[3] - 1]}`;
  }
  if ((m = id.match(/^TF-(\d\d)$/))) {
    const i = Number(m[1]) - 1;
    return `Walkout T-shirt · Front grid · Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
  }
  if (id === "TB-01") return "Walkout T-shirt · Upper back";
  if ((m = id.match(/^TS-0([1-3])$/))) return `Walkout T-shirt · Sleeve pair · ${["Upper", "Center", "Lower"][m[1] - 1]}`;
  return id;
}

export async function soldPlacements(origin) {
  try {
    const res = await fetch(new URL("/assets/sponsors.json", origin));
    return res.ok ? new Set(Object.keys(await res.json())) : new Set();
  } catch {
    return new Set();
  }
}

/* ------------------------------------------------------------------ email */
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function sendEmail({ to, subject, text, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true };
  const res = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || "Team Heck Sponsorships <sponsors@michaelheckert.com>",
      to: Array.isArray(to) ? to : [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text,
      ...(html ? { html } : {})
    })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

// Fire-and-forget wrapper: email problems must never fail the bid itself.
export async function tryEmail(opts) {
  try {
    return await sendEmail(opts);
  } catch (err) {
    console.error("email failed", opts.subject, err);
    return { error: String(err) };
  }
}

export function notifyOwner(subject, lines) {
  return tryEmail({ to: NOTIFY_EMAIL, subject: `[Sponsorship] ${subject}`, text: lines.filter(Boolean).join("\n") });
}

function layout({ heading, intro, rows, cta, outro }) {
  const rowsHtml = rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#9a9a9a;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;color:#fff;font-weight:600">${escapeHtml(v)}</td></tr>`).join("");
  const ctaHtml = cta ? `<p style="margin:28px 0"><a href="${cta.href}" style="display:inline-block;background:#f36a16;color:#000;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:8px;font-size:16px">${escapeHtml(cta.label)}</a></p><p style="margin:0 0 20px;color:#9a9a9a;font-size:13px">Or open this link: <a href="${cta.href}" style="color:#f36a16">${cta.href}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#e8e8e8">
<div style="max-width:560px;margin:0 auto;padding:36px 24px">
  <p style="margin:0 0 6px;letter-spacing:.18em;font-size:12px;color:#f36a16;font-weight:700">MICHAEL “KING KILLER” HECKERT · ${escapeHtml(EVENT_NAME.toUpperCase())}</p>
  <h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;color:#fff">${escapeHtml(heading)}</h1>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.55">${intro}</p>
  <table style="border-collapse:collapse;font-size:15px;margin:0 0 8px">${rowsHtml}</table>
  ${ctaHtml}
  <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#c8c8c8">${outro}</p>
  <p style="margin:0;font-size:13px;color:#777">Questions? Reply to this email or write to <a href="mailto:${NOTIFY_EMAIL}" style="color:#f36a16">${NOTIFY_EMAIL}</a>.<br>Portal: <a href="${PORTAL_URL}" style="color:#f36a16">${PORTAL_URL}</a></p>
</div></body></html>`;
}

const textBlock = (heading, intro, rows, cta, outro) =>
  [heading, "", intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", cta ? `${cta.label}: ${cta.href}` : "", cta ? "" : null, outro, "", `Questions? Reply to this email or write to ${NOTIFY_EMAIL}.`, `Portal: ${PORTAL_URL}`].filter((l) => l !== null).join("\n");

export function bidConfirmationEmail(id, rec) {
  const b = rec.bidder;
  const rows = [["Placement", `${id} — ${describePlacement(id)}`], ["Your bid", usd(rec.high)], ["Company", b.company], ["Bidding closes", formatDeadline()]];
  const intro = `Thanks ${escapeHtml(b.name)} — you're currently the <strong>high bidder</strong> on this placement. If you're still on top when bidding closes, we'll email you a Stripe invoice for your winning amount.`;
  const outro = `We'll let you know if someone outbids you so you can respond. Want to skip the auction? You can lock the placement outright for ${usd(LOCK_PRICE)} in the portal.`;
  return {
    to: b.email, replyTo: NOTIFY_EMAIL,
    subject: `You're the high bidder on ${id} · ${usd(rec.high)}`,
    html: layout({ heading: "Bid received", intro, rows, cta: { href: placementLink(id), label: "View placement" }, outro }),
    text: textBlock("Bid received", intro.replace(/<[^>]+>/g, ""), rows, { href: placementLink(id), label: "View placement" }, outro)
  };
}

export function outbidEmail(id, rec, previous) {
  const rows = [["Placement", `${id} — ${describePlacement(id)}`], ["Your bid", usd(previous.amount)], ["New high bid", usd(rec.high)], ["Next minimum", usd(rec.high + INCREMENT)], ["Bidding closes", formatDeadline()]];
  const intro = `Hi ${escapeHtml(previous.name)} — another sponsor has outbid you on this placement.`;
  const outro = `You can place a new bid any time before bidding closes, or lock the placement outright for ${usd(LOCK_PRICE)}.`;
  const cta = { href: placementLink(id), label: "Bid again" };
  return { to: previous.email, replyTo: NOTIFY_EMAIL, subject: `You've been outbid on ${id}`, html: layout({ heading: "You've been outbid", intro, rows, cta, outro }), text: textBlock("You've been outbid", intro.replace(/<[^>]+>/g, ""), rows, cta, outro) };
}

export function invoiceEmail(id, rec, kind) {
  const b = rec.bidder;
  const inv = rec.invoice;
  const locked = kind === "lock";
  const rows = [["Placement", `${id} — ${describePlacement(id)}`], ["Amount due", usd(inv.amount)], ["Invoice", inv.number || inv.id], ["Company", b.company], ["Terms", "Due on receipt"]];
  const heading = locked ? "Placement locked — invoice enclosed" : "You won the placement — invoice enclosed";
  const intro = locked
    ? `Congratulations ${escapeHtml(b.name)} — <strong>${escapeHtml(id)}</strong> is locked in for ${escapeHtml(b.company)}. Bidding on it is now closed. Your Stripe invoice for ${usd(inv.amount)} is ready; pay securely by card or bank transfer using the button below.`
    : `Congratulations ${escapeHtml(b.name)} — bidding has closed and <strong>${escapeHtml(b.company)}</strong> is the winning sponsor for <strong>${escapeHtml(id)}</strong>. Your Stripe invoice for ${usd(inv.amount)} is ready; pay securely by card or bank transfer using the button below.`;
  const outro = `Once payment clears, Michael will reach out for your final artwork and the Champion package details (walkout gear, robe and fan T-shirt logos, social promotion, two VIP ringside tickets, Fight Week vendor table, and the post-fight media kit).`;
  const cta = { href: inv.url, label: `Pay ${usd(inv.amount)} invoice` };
  return { to: b.email, replyTo: NOTIFY_EMAIL, subject: `${locked ? "Locked" : "You won"}: ${id} · invoice ${usd(inv.amount)}`, html: layout({ heading, intro, rows, cta, outro }), text: textBlock(heading, intro.replace(/<[^>]+>/g, ""), rows, cta, outro) };
}

const placementLink = (id) => new URL(`#${id}`, PORTAL_URL.endsWith("/") ? PORTAL_URL : PORTAL_URL + "/").href;

export function formatDeadline() {
  return new Date(DEADLINE).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });
}

/* ----------------------------------------------------------------- stripe */
const encodeForm = (obj, prefix = "") => Object.entries(obj).flatMap(([k, v]) => {
  if (v == null) return [];
  const key = prefix ? `${prefix}[${k}]` : k;
  return typeof v === "object" ? encodeForm(v, key) : [[key, String(v)]];
});

async function stripe(method, path, params, idempotencyKey) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const headers = { authorization: `Bearer ${key}` };
  let url = `${STRIPE_API}/v1/${path}`;
  const init = { method, headers };
  if (method === "GET") {
    if (params) url += `?${new URLSearchParams(encodeForm(params))}`;
  } else {
    headers["content-type"] = "application/x-www-form-urlencoded";
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    init.body = new URLSearchParams(encodeForm(params || {}));
  }
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Stripe ${method} ${path} failed (${res.status})`);
  return data;
}

export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

async function findOrCreateCustomer(bidder, id) {
  const q = `email:'${bidder.email.replace(/'/g, "\\'")}'`;
  const found = await stripe("GET", "customers/search", { query: q, limit: 1 }).catch(() => null);
  if (found?.data?.length) return found.data[0];
  return stripe("POST", "customers", {
    name: bidder.company,
    email: bidder.email,
    phone: bidder.phone || undefined,
    description: `Sponsor contact: ${bidder.name}`,
    metadata: { contact_name: bidder.name, source: "heck-sponsor-360", first_placement: id }
  }, `heck-cust-${id}-${bidder.email}`);
}

// Creates, itemises and finalises a "send_invoice" invoice due on receipt.
// Stripe does NOT email it (auto_advance=false); we send the hosted link via Resend.
export async function createInvoice({ id, amount, bidder, kind, at }) {
  const customer = await findOrCreateCustomer(bidder, id);
  const label = describePlacement(id);
  const seed = `heck-${id}-${kind}-${amount}-${bidder.email}-${at}`.replace(/[^a-zA-Z0-9@.\-_]/g, "_").slice(0, 255);
  const draft = await stripe("POST", "invoices", {
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: 0,
    auto_advance: false,
    pending_invoice_items_behavior: "exclude",
    description: `${EVENT_NAME} sponsorship — ${id} (${label}). ${kind === "lock" ? "Lock It Now" : "Winning auction bid"} via the Team Heck sponsorship portal.`,
    footer: "Includes the full Champion package: shorts + T-shirt logo, walkout robe and fan T-shirt logos, social and interview promotion, post-fight media kit, two VIP ringside tickets, Fight Week vendor table, and Official Sponsor listing.",
    metadata: { placement: id, placement_label: label, kind, contact_name: bidder.name, contact_email: bidder.email, company: bidder.company, portal: PORTAL_URL }
  }, `${seed}-inv`);
  await stripe("POST", "invoiceitems", {
    customer: customer.id,
    invoice: draft.id,
    amount: Math.round(amount * 100),
    currency: "usd",
    description: `${EVENT_NAME} sponsorship placement ${id} — ${label} (${kind === "lock" ? "Lock It Now" : "winning bid"})`,
    metadata: { placement: id }
  }, `${seed}-item`);
  const inv = await stripe("POST", `invoices/${draft.id}/finalize`, { auto_advance: false }, `${seed}-fin`);
  return { id: inv.id, number: inv.number, url: inv.hosted_invoice_url, pdf: inv.invoice_pdf, amount, customer: customer.id, kind, status: "sent", at: new Date().toISOString() };
}

/* Invoices the current high bidder on a placement, saves the result on the
   record, and emails both the sponsor (invoice link) and Michael. Safe to
   re-run: a placement with a sent invoice is skipped. */
export async function invoicePlacement(store, id, rec, kind) {
  if (rec.invoice?.status === "sent") return rec;
  if (!stripeEnabled()) {
    rec.invoice = { status: "skipped", reason: "STRIPE_SECRET_KEY not set", kind, at: new Date().toISOString() };
    await store.setJSON(id, rec);
    await notifyOwner(`${id} · ${kind === "lock" ? "LOCKED" : "WON"} for ${usd(rec.high)} · invoice NOT created`, [
      `Placement: ${id} — ${describePlacement(id)}`, `Company: ${rec.bidder.company}`, `Contact: ${rec.bidder.name} <${rec.bidder.email}>`, `Phone: ${rec.bidder.phone || "-"}`,
      "", "STRIPE_SECRET_KEY is not configured, so no invoice was created. Invoice this sponsor manually."
    ]);
    return rec;
  }
  const b = rec.bidder;
  const at = rec.lockedAt || rec.closedAt || new Date().toISOString();
  try {
    rec.invoice = await createInvoice({ id, amount: rec.high, bidder: b, kind, at });
    await store.setJSON(id, rec);
  } catch (err) {
    console.error("invoice failed", id, err);
    rec.invoice = { status: "failed", error: String(err.message || err), kind, at: new Date().toISOString(), attempts: (rec.invoice?.attempts || 0) + 1 };
    await store.setJSON(id, rec);
    await notifyOwner(`${id} · invoice FAILED · ${b.company}`, [
      `Placement: ${id} — ${describePlacement(id)}`, `Action: ${kind === "lock" ? "LOCKED" : "WON"} for ${usd(rec.high)}`, `Company: ${b.company}`, `Contact: ${b.name} <${b.email}>`, `Phone: ${b.phone || "-"}`,
      "", `Stripe error: ${rec.invoice.error}`, "The daily close-auction job will retry. Check Stripe → Invoices."
    ]);
    return rec;
  }
  const sponsorMail = await tryEmail(invoiceEmail(id, rec, kind));
  rec.invoice.emailed = !sponsorMail.error && !sponsorMail.skipped;
  await store.setJSON(id, rec);
  await notifyOwner(`${id} · ${kind === "lock" ? "LOCKED" : "WON"} for ${usd(rec.high)} · invoiced · ${b.company}`, [
    `Placement: ${id} — ${describePlacement(id)}`, `Action: ${kind === "lock" ? "Lock It Now" : "Auction closed — winning bid"}`, `Company: ${b.company}`, `Contact: ${b.name} <${b.email}>`, `Phone: ${b.phone || "-"}`,
    rec.logo ? `Logo: ${new URL(`/api/logos/${id}`, API_URL)}` : "Logo: not uploaded — request artwork",
    "", `Invoice ${rec.invoice.number || rec.invoice.id}: ${usd(rec.invoice.amount)} due on receipt`,
    `Sponsor pay link: ${rec.invoice.url}`,
    `Stripe dashboard: https://dashboard.stripe.com/invoices/${rec.invoice.id}`,
    rec.invoice.emailed ? "Sponsor emailed the invoice link via Resend." : "Sponsor was NOT emailed (Resend not configured or failed) — send them the pay link above.",
    "", "All bids: Netlify dashboard → heck-sponsor-360 → Blobs → bids"
  ]);
  return rec;
}
