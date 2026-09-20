# Configuration reference

Everything that changes from one athlete/event to the next, and where it lives.

## Environment variables (Netlify → Site configuration → Environment variables)

Set secrets with `netlify env:set KEY value --secret --context production deploy-preview branch-deploy`
(secrets cannot be read back afterwards — keep the client's copy in their password manager, not in chat).
Non-secrets: `netlify env:set KEY value`. Changes apply on the **next deploy**.

| Variable | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | for invoicing | `sk_test_…` for the dry run, `sk_live_…` for launch. Without it a lock still saves and emails the owner an "invoice NOT created" alert; the daily job invoices once the key exists. |
| `RESEND_API_KEY` | for email | Resend API key from the **client's** account. |
| `NOTIFY_FROM` | yes | Sender, e.g. `Team X Sponsorships <sponsors@athlete.com>`. Domain must be verified in Resend (DKIM + SPF). `onboarding@resend.dev` only delivers to the account owner. |
| `NOTIFY_EMAIL` | yes | Owner inbox for every bid/lock/invoice notification; also reply-to on sponsor emails. |
| `PORTAL_URL` | yes | Public portal URL used in emails/deep links (falls back to Netlify's `URL`). |
| `ADMIN_TOKEN` | yes | Random secret for `POST /api/close-auction`. Generate: `openssl rand -hex 24`. |
| `MIN_BID` / `BID_INCREMENT` / `LOCK_PRICE` | no | Defaults 500 / 50 / 2500 (USD). |
| `BID_DEADLINE` | yes | ISO 8601 with offset, e.g. `2026-10-16T23:59:59-04:00`. Bids are rejected after it; the daily job closes and invoices after it. |
| `EVENT_NAME` | yes | e.g. `BKFC Clearwater` — invoice line items, email header. |
| `STRIPE_API_BASE` / `RESEND_API_BASE` | local only | Point at `scripts/mock-services.mjs` for tests. Never set in production. |

## Placements (`public/app.js`)

```js
const placements = {
  shorts: { front: [...], back: [...] },
  shirt:  { front: [...], back: [...], sleeves: [...] }
};
// each: { id: "SF-L1", name: "Front left · Upper", detail: "...", side: "front"|"back"|"left"|"right",
//         x, y, w, h /* metres, model normalised to 1.86 m tall, feet at y=0, facing +z */,
//         mirror?: "right" /* sleeves: also project on the mirrored side */ }
```
- `x` is athlete-left positive (viewer's right from the front). Rays are cast from ±3 m on the given side and the
  hit becomes a `DecalGeometry`, so placements wrap the real garment surface. If a placement logs
  "No surface found", its x/y misses the mesh — adjust or check the model's scale.
- `id` convention `<GARMENT><SIDE>-<POS>`: keep ids ≤ 8 chars (server truncates) and update **all three**:
  1. `placements` in `public/app.js`
  2. `PLACEMENT_ID` regex in `netlify/lib/sponsorship.mjs`
  3. `describePlacement(id)` in `netlify/lib/sponsorship.mjs` (human label used in emails and invoices)
- `LANDING_ORDER` in `app.js` decides which open placement a visitor lands on (camera-facing first).
- Garment tabs and quick-view buttons are in `index.html` (`.garment-tab[data-garment]`, `[data-view]`) — add a
  tab if you add a garment, and extend `visiblePlacements()` / `garmentOf()` in `app.js`.

## Pre-sold sponsors (`public/assets/sponsors.json`)

```json
{ "SF-L1": { "sponsor": "Boxrope", "logo": "assets/sponsors/boxrope.png" } }
```
Logos: transparent PNG/WebP, ~1024 px wide, trimmed. Dark artwork is auto-detected and shown on a light card.
A placement in this file is SOLD everywhere (UI, API rejects bids) regardless of the Blobs store.

## Copy locations

| What | Where |
| --- | --- |
| `<title>`, meta description, OG/Twitter tags, canonical | `public/index.html` `<head>` |
| Header name/subtitle, event date | `.topbar` in `index.html` |
| Hero ("Choose your position"), intro copy | `.intro-panel` |
| Poster card text (opponent, bout, date) | `.poster-card` |
| Benefits list ("What the winning sponsor gets") | `.bid-benefits` |
| Bid note / terms | `#bidNote` in `index.html` **and** the runtime string in `renderBidPanel()` in `app.js` |
| Footer record/bio | `.portal-footer` |
| Embed instructions dialog | `#embedDialog` |
| Lock confirm dialog text, success panel text, toasts | `submitBid()` / `showBidSuccess()` in `app.js` |
| Email subjects/bodies (bid confirmation, outbid, invoice, owner notices) | `netlify/lib/sponsorship.mjs` |
| Invoice description, line item, footer (benefits summary) | `createInvoice()` in `sponsorship.mjs` |
| Email visual header line ("MICHAEL … · EVENT") | `layout()` in `sponsorship.mjs` |

## Brand

`:root` in `public/styles.css`: `--bg`, `--panel`, `--line`, `--muted`, `--ink`, `--orange` (accent),
`--orange-dark`, `--green`, fonts `--display` (Barlow Condensed via Google Fonts) and `--text` (Inter).
The email template uses hard-coded `#f36a16` accents in `sponsorship.mjs` `layout()` — change to match.
Favicon: `public/favicon.svg`. Brand mark text: `.brand-mark` in `index.html`.

## Poster, backdrop and share image (`public/assets/backdrop/`)

Requires `ffmpeg` and `cwebp`. From the highest-res poster (`poster.jpg`):
```bash
mkdir -p public/assets/backdrop
# poster card + lightbox
ffmpeg -y -i poster.jpg -vf "unsharp=3:3:0.4" /tmp/poster.png && cwebp -q 82 /tmp/poster.png -o public/assets/backdrop/fight-poster.webp
# stage backdrop, pre-softened and darkened (CSS adds vignette + fades) — two widths for srcset
for W in 900 1500; do ffmpeg -y -i poster.jpg -vf "scale=$W:-1:flags=lanczos,gblur=sigma=3,eq=brightness=-0.06:saturation=0.8:contrast=1.05" /tmp/stage-$W.png && cwebp -q 70 /tmp/stage-$W.png -o public/assets/backdrop/stage-$W.webp; done
# 1200x630 share image: crop the faces band (adjust crop y to the poster)
ffmpeg -y -i poster.jpg -vf "crop=iw:ih*0.42:0:ih*0.06,scale=1200:630:flags=lanczos,unsharp=3:3:0.5" -q:v 3 public/assets/backdrop/og-image.jpg
```
Keep the filenames; `index.html` references them (`srcset`, preload, OG tags). Check the backdrop's
`object-position` in `.stage-backdrop img` so faces frame the model rather than sit behind it.
Budget: backdrop ≤ 100 KB, poster ≤ 250 KB, share image ≤ 200 KB.

## 3D model requirements

- Single `.glb` at `public/assets/models/<athlete>.glb` (Draco compression supported; decoder loads from unpkg).
- Wearing the actual garments in the real colours; old sponsor marks removed from textures.
- Any scale/position: the loader normalises to 1.86 m tall, feet at y = 0, centred; facing is auto-detected
  (toes protrude further than heels). If detection fails, the model is rotated 180° — check the FRONT view.
- Target ≤ 15 MB, 50–100k triangles, 2K garment textures for mobile. Test on a phone.
- Materials are forced to roughness 0.9 / metalness 0 on load.
- Produced outside this repo (photogrammetry or artist build in Blender). Approval sequence that worked:
  face → full body + garments → 360° preview → export. Keep a rollback GLB when swapping.

## Marketing-site embed

```html
<iframe src="https://PORTAL/?embed=1" title="…sponsorship portal" allow="fullscreen" scrolling="no" style="width:100%;height:900px;border:0"></iframe>
<script>
addEventListener("message", (e) => {
  if (e.origin !== "https://PORTAL" || !e.data || e.data.type !== "heck-portal-height") return;
  document.querySelector("iframe").style.height = Math.max(600, Math.min(4000, e.data.height)) + "px";
});
</script>
```
Allow the host in `netlify.toml` → `Content-Security-Policy: frame-ancestors …`. Embed mode hides the
footer embed button, stretches the 3D stage to the row, and reports the **body** height (not
`documentElement.scrollHeight`, which can never shrink below the iframe).
