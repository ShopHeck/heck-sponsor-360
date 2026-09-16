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

Any static host works (Netlify drag-and-drop, GitHub Pages, Vercel). Publish the repository root. `netlify.toml` is included for Netlify.

## Embed on teamheck.netlify.app

Once hosted, paste this where the portal should appear (the "Embed portal" button in the app generates the same snippet):

```html
<iframe src="https://YOUR-PORTAL-URL" title="Michael Heckert sponsorship portal" loading="lazy" allow="fullscreen" style="width:100%;height:900px;border:0"></iframe>
```

## Assets

`process_assets.py` converts the supplied 12-angle photography (`IMG_1267–IMG_1278`) into the optimized WebP frames in `assets/processed/`. Existing shorts branding is covered by the garment overlay and placement slots; the visual layer is a photo rotator, not a WebGL mesh. Replacing it with a true 3D likeness requires a photogrammetry capture or an authored GLB.
