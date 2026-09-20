---
name: sponsorship-portal
description: Build, configure, launch and operate a 360° athlete sponsorship portal (3D placement picker + live bidding + Lock It Now + Stripe invoicing + Resend email) from this template, for a new fight/event or a new client.
argument-hint: "[new <athlete-slug> | configure | launch | operate | reset <PLACEMENT-ID>]"
---

You are building or operating an **athlete sponsorship portal** from this repository, which is the reference
implementation (Michael "King Killer" Heckert, BKFC Clearwater). The same codebase is resold as a service to other
athletes, teams and events. Work through the phases below in order; skip phases the user has already completed.
Read the reference files when you reach the phase that needs them — do not guess at env var names, placement IDs
or email copy.

Reference files (same directory, `reference/`):
- `intake.md` — the questionnaire to complete with the client before touching code, plus the delivery checklist.
- `configuration.md` — every knob: placements schema, sponsors.json, copy locations, env vars, email templates,
  poster/backdrop asset pipeline, 3D model requirements.
- `launch-checklist.md` — Netlify/Stripe/Resend/domain setup, the go-live test, and the operations runbook
  (close the auction, invoice winners, reset a placement, inspect bids).
- `gotchas.md` — every bug and trap hit while building the original; check it before debugging anything.

## What the product is

- `public/` — static site, no build framework: three.js (import map from unpkg) renders a GLB of the athlete;
  placements are rectangles in metres projected onto the garment as decals. Bidding UI, logo preview, poster
  backdrop, embed mode (`?embed=1` / inside an iframe) with `postMessage` height reporting.
- `netlify/functions/` — `bids.mjs` (GET summary / POST bid or lock), `logo.mjs` (serves uploaded bidder logos),
  `close-auction.mjs` (daily schedule: invoices auction winners after the deadline, retries failed invoices),
  `admin-close.mjs` (`POST /api/close-auction`, `ADMIN_TOKEN`, `?force=1`).
- `netlify/lib/sponsorship.mjs` — settings from env, placement labels, Resend + Stripe helpers, all email copy.
- Netlify Blobs stores `bids` (one JSON record per placement, full history + invoice state) and `logos`.
- Money flow: bids are non-binding until the deadline; **Lock It Now** (or a bid ≥ lock price) creates a Stripe
  customer + finalised `send_invoice` invoice due on receipt and emails the sponsor a pay link via Resend.
  Stripe's own emails stay off. Nothing is charged in the browser.
- `scripts/stamp-assets.mjs` runs as the Netlify build command and cache-busts `styles.css`/`app.js`.

## Phase 0 — Intake (before any code)

Fill in `reference/intake.md` with the client. You need, at minimum: athlete/event names and date, garments and
placement grid, pre-sold sponsors + logo files, pricing (min bid, increment, lock price, deadline + timezone),
benefits list, brand colours, domain, and confirmed access to **their** Stripe and Resend accounts. Confirm who
receives owner notifications. Do not start Phase 1 without pricing and the placement list — they drive the code.

## Phase 1 — New project from the template

```bash
gh repo create <org>/<athlete>-sponsor-portal --private --clone --template ShopHeck/heck-sponsor-360
cd <athlete>-sponsor-portal && npm install
```
Then, in this order (details in `reference/configuration.md`):
1. **3D model** → `public/assets/models/<athlete>.glb`, update `DEFAULT_MODEL` in `public/app.js`. The model
   must be a single GLB wearing the garments, roughly human scale; normalisation and facing are automatic.
2. **Placements** → edit the `placements` object in `public/app.js` (ids, names, side, x/y/w/h in metres) AND
   the matching `PLACEMENT_ID` regex + `describePlacement()` in `netlify/lib/sponsorship.mjs`. The smoke test
   fails with "Unknown placement" if these disagree.
3. **Pre-sold sponsors** → `public/assets/sponsors.json` + logos in `public/assets/sponsors/`.
4. **Copy** → `public/index.html` (title/meta, hero, benefits list, footer, embed section), event/brand strings
   in `netlify/lib/sponsorship.mjs` (`EVENT_NAME` default, invoice description/footer, email intros).
5. **Brand** → CSS variables in `:root` of `public/styles.css` (`--orange` is the accent), favicon.
6. **Poster / backdrop / share image** → run the ffmpeg recipe in `reference/configuration.md` on the client's
   fight poster into `public/assets/backdrop/`.
7. **Pricing defaults** → env vars (`MIN_BID`, `BID_INCREMENT`, `LOCK_PRICE`, `BID_DEADLINE`) — never hardcode.

Preview locally with `npx netlify dev` (Blobs runs in sandbox mode). Commit in small PRs.

## Phase 2 — Local end-to-end test (no real money or email)

```bash
node scripts/mock-services.mjs &                      # fake Stripe + Resend on :4242
STRIPE_SECRET_KEY=sk_test_mock STRIPE_API_BASE=http://127.0.0.1:4242 \
RESEND_API_KEY=re_mock RESEND_API_BASE=http://127.0.0.1:4242 \
NOTIFY_EMAIL=owner@example.test PORTAL_URL=http://localhost:8888 ADMIN_TOKEN=devtoken \
npx netlify dev --offline --port 8888 &
scripts/smoke-test.sh http://localhost:8888 <OPEN-ID-A> <OPEN-ID-B>
```
The smoke test must print `SMOKE TEST PASSED`. Also load the page in a browser (or headless) and confirm: it
lands on an OPEN placement, a lock shows the pay link, a reload keeps LOCKED status and the uploaded logo.
`FAIL_INVOICE=1 node scripts/mock-services.mjs` exercises the failure → owner alert → daily retry path.

## Phase 3 — Launch

Follow `reference/launch-checklist.md` exactly: Netlify site linked to the repo (Git deploys — never rely on
`netlify deploy` once linked), env vars (secrets set with `--secret`), Resend domain verified + `NOTIFY_FROM`,
Stripe key (test first, then live), custom domain (Cloudflare record **DNS only**), marketing-site embed.
Finish with the **real dry run**: lock one placement with the client's own email, confirm invoice + emails,
void the invoice in Stripe, then reset the placement (`netlify blobs:delete bids <ID>` and `logos <ID>`).

## Phase 4 — Operate

Runbook is in `reference/launch-checklist.md` → "Operations". The daily job handles the deadline automatically;
`POST /api/close-auction` with the admin token runs it on demand (`?force=1` closes early). Bids live in
Netlify → Blobs → `bids`; every invoice is recorded on the placement so re-runs never double-invoice.

## Working rules learned on the original build

- Base every PR on `main`; never stack PRs — a stacked PR merged into its feature branch silently misses `main`.
- After merging, verify the Netlify Git build went live (`curl` for a string from the change) before reporting done.
- Any change to placement IDs must touch `app.js`, `sponsorship.mjs` (regex + labels) and the smoke test IDs.
- Never paste API keys into chat; set them with `netlify env:set KEY value --secret --context production deploy-preview branch-deploy`.
- Deleting Blobs records is destructive: confirm the placement ID with the user first and back the record up
  (`netlify blobs:get bids <ID> > backup.json`).
- Respond to every Devin Review comment on a PR (fix or justify, reply on the thread) before calling it mergeable.
