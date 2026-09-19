# Michael Heckert — BKFC Clearwater Sponsorship Portal

Standalone, embeddable 360° sponsorship placement selector for Team Heck. Static HTML/CSS/JS with no build step.

## Inventory

| Garment | View | Placements |
| --- | --- | --- |
| Fight shorts | Front | `SF-L1..3` (left leg), `SF-R1..3` (right leg) |
| Fight shorts | Back | `SB-L1..3` (left leg), `SB-R1..3` (right leg) |
| Black T-shirt | Front | `TF-01..12` (4 × 3 grid) |
| Black T-shirt | Back | `TB-01` (across the shoulder blades) |
| Black T-shirt | Sleeves | `TS-01..03` (each shown on both sleeves) |

Placements are data-driven in `app.js` (`placements`), so pricing, status, or a future GLB model can be added without rebuilding the selector.

## Run locally

```bash
python3 -m http.server 4173
# open http://127.0.0.1:4173/
```

## Deploy

Deploy on Netlify: static files live in `public/`, and the bidding API is a Netlify Function (`netlify/functions/bids.mjs`, served at `/api/bids`) backed by Netlify Blobs. `netlify.toml` configures both. Run locally with `npm install && npx netlify dev`.

### Bidding

Open placements accept bids (min `$500`, `$50` increments) and a **Lock it now** buy-out at `$2,500` that closes the placement. Bids and locks are stored per placement in the `bids` Blobs store (company, contact, email, phone, note, full history); the public API only exposes the high bid, bidder company and count.

**Logos** — a logo uploaded before bidding is downscaled in the browser (max 800px PNG) and sent with the bid. It is stored in the `logos` Blobs store (one key per placement, 1.5 MB cap, PNG/JPG/WebP only), served at `/api/logos/:id`, and rendered on the model and detail card once the placement is locked or won. A new high bidder without artwork clears the previous bidder's logo.

**Emails (Resend)** — the bidder gets a confirmation, the previous high bidder an "outbid" notice, and Michael a copy of everything.

**Invoices (Stripe)** — no card is taken in the portal. Instead:

- **Lock it now** (or a bid ≥ `$2,500`) creates a Stripe customer + finalised invoice for the lock price, *due on receipt*, and emails the sponsor a **Pay invoice** link (Stripe's hosted invoice page) via Resend. The same link is shown in the portal right after locking. Stripe itself does not send email.
- **Auction winners** — `netlify/functions/close-auction.mjs` runs daily; once `BID_DEADLINE` has passed it marks each open placement with bids as closed and invoices the high bidder the same way. It also retries any lock whose invoice failed. Trigger it manually (or force-close early) with `curl -X POST -H "authorization: Bearer $ADMIN_TOKEN" https://<site>/api/close-auction[?force=1]`; locally, `npx netlify functions:invoke close-auction`.
- Every invoice is recorded on the placement (`invoice.id/url/status`) so re-runs never double-invoice. Failures email Michael with the Stripe error.

Environment variables (Netlify → Site configuration → Environment variables):

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | **Required for invoicing.** `sk_live_…` in production; use `sk_test_…` locally. |
| `RESEND_API_KEY` | **Required for email.** |
| `NOTIFY_FROM` | Resend sender; defaults to `Team Heck Sponsorships <sponsors@michaelheckert.com>` (michaelheckert.com is verified in Resend). |
| `NOTIFY_EMAIL` | Michael's inbox; also the reply-to on sponsor emails (default `michaelheckert@heckholdings.com`). |
| `PORTAL_URL` | Public portal URL used in emails (defaults to Netlify's `URL`). |
| `ADMIN_TOKEN` | Enables `POST /api/close-auction` for manual runs. |
| `MIN_BID`, `BID_INCREMENT`, `LOCK_PRICE`, `BID_DEADLINE`, `EVENT_NAME` | Auction settings (defaults `500`, `50`, `2500`, `2026-10-16T23:59:59-04:00`, `BKFC Clearwater`). |

For local testing set `STRIPE_API_BASE` / `RESEND_API_BASE` to point the functions at a mock server.

## Embed on teamheck.netlify.app

Once hosted, paste this where the portal should appear (the "Embed portal" button in the app generates the same snippet):

```html
<iframe src="https://heck-sponsor-360.netlify.app/" title="Michael Heckert sponsorship portal" loading="lazy" allow="fullscreen" style="width:100%;height:900px;border:0"></iframe>
```

When framed, the portal switches to an embed layout (fixed stage height, no "Embed portal" button) and posts its document height to the host as `{ type: "heck-portal-height", height }`. To make the iframe grow with the content instead of scrolling internally, add on the host page:

```html
<script>
addEventListener("message", (e) => {
  if (e.origin !== "https://heck-sponsor-360.netlify.app" || e.data?.type !== "heck-portal-height") return;
  document.querySelector('iframe[src^="https://heck-sponsor-360.netlify.app"]').style.height = e.data.height + "px";
});
</script>
```

## 3D viewer

The stage is a real-time three.js (WebGL) scene loaded from the unpkg import map in `index.html`. The athlete is `assets/models/heckert.glb`, a textured full-body mesh of Michael generated with Meshy (multi-image-to-3D) from his reference photos, already dressed in the plain black T-shirt and orange fight shorts, then Draco/WebP-compressed with `@gltf-transform/cli`. Every placement is a `DecalGeometry` patch projected onto the mesh surface (clickable, raycast-selected, and textured with the uploaded logo). Placement coordinates live at the top of `app.js`.

### Swapping the model

The Meshy mesh is an AI approximation, not a scan. To replace it with a photogrammetry capture (Polycam / Luma AI) or an artist-made GLB, drop the file in `assets/models/` and load the portal with `?model=assets/models/<file>.glb` (or change `DEFAULT_MODEL` in `app.js`). The GLB is scaled to 1.86 m, centred on the floor and auto-flipped to face +Z; placements are re-projected onto whatever surface the rays hit, so a model in the same relaxed stance keeps the inventory intact (adjust the `x`/`y` coordinates in `app.js` if the pose differs).

## Reference photography

`process_assets.py` converts the supplied 12-angle photography (`IMG_1267–IMG_1278`) into the WebP frames in `assets/processed/`. They are reference material for the model's build and shorts design and are not used by the viewer.

## Sold placements (confirmed sponsors)

Confirmed sponsors are listed in `public/assets/sponsors.json`, keyed by placement ID. Each entry names the sponsor and points to a logo file (transparent PNG or SVG, roughly the aspect ratio of the placement) stored in `public/assets/sponsors/`:

```json
{
  "SF-R1": { "sponsor": "HKA USA", "logo": "assets/sponsors/hka-usa.png" },
  "TS-01": { "sponsor": "UFC Gym", "logo": "assets/sponsors/ufc-gym.png" }
}
```

Sold placements render the sponsor's logo directly on the garment, show `SOLD` in the inventory and selection card, and cannot be previewed or requested. Sleeve IDs (`TS-0x`) mark both sleeves. Delete an entry to reopen the placement.
