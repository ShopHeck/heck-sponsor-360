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

## 3D viewer

The stage is a real-time three.js (WebGL) scene loaded from the unpkg import map in `index.html`. The athlete is a procedural athletic body; the fight shorts and black T-shirt are modeled garments, and every placement is a curved decal patch on the garment surface (clickable, raycast-selected, and textured with the uploaded logo). The body geometry, garment profiles and placement coordinates live at the top of `app.js`.

### Using a scanned likeness

The procedural body is a stand-in until a scan of Michael exists. Export a GLB from a photogrammetry app (Polycam / Luma AI, person mode, T-pose or relaxed stance) to `assets/models/heckert.glb` and load the portal with `?model=assets/models/heckert.glb` (or change the default in `app.js`). The GLB is scaled to 1.86 m and centred on the floor; the modeled garments and placements render on top of it, so the placement inventory does not change.

## Reference photography

`process_assets.py` converts the supplied 12-angle photography (`IMG_1267–IMG_1278`) into the WebP frames in `assets/processed/`. They are reference material for the model's build and shorts design and are not used by the viewer.
