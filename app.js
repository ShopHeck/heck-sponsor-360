import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ---------------------------------------------------------------------------
   Body definition (metres, y up, athlete faces +z). Every garment surface is a
   surface of revolution around a local y axis with an elliptical cross-section
   (radius r(y) in x, kz*r(y) in z). Placements are patches on those surfaces,
   so a real scanned GLB can later replace the procedural body while the
   placement data and selection logic stay unchanged.
--------------------------------------------------------------------------- */
const BODY = {
  torso: { kz: 0.64, profile: [[1.02, 0.155], [1.10, 0.160], [1.20, 0.168], [1.32, 0.190], [1.44, 0.212], [1.51, 0.222], [1.55, 0.200], [1.58, 0.130], [1.60, 0.070]] },
  shirt: { kz: 0.70, profile: [[0.99, 0.212], [1.10, 0.200], [1.22, 0.196], [1.34, 0.208], [1.44, 0.226], [1.50, 0.240], [1.55, 0.236], [1.575, 0.170], [1.585, 0.080]] },
  shortsHip: { kz: 0.72, profile: [[0.875, 0.238], [0.96, 0.226], [1.03, 0.204], [1.07, 0.184], [1.085, 0.172]] },
  leg: { radius: 0.118, kz: 0.92, hipY: 0.93, hemY: 0.60, offsetX: 0.112 },
  sleeve: { radius: 0.078, length: 0.22, shoulder: [0.245, 1.525], tilt: 0.3 }
};

const surfaces = {
  torso: { kind: "lathe", ...BODY.torso },
  shirt: { kind: "lathe", ...BODY.shirt },
  legL: { kind: "cyl", radius: BODY.leg.radius, kz: BODY.leg.kz, node: "legL" },
  legR: { kind: "cyl", radius: BODY.leg.radius, kz: BODY.leg.kz, node: "legR" },
  sleeveL: { kind: "cyl", radius: BODY.sleeve.radius, kz: 1, node: "sleeveL" },
  sleeveR: { kind: "cyl", radius: BODY.sleeve.radius, kz: 1, node: "sleeveR" }
};

// Athlete-left is +x (viewer's right when looking at the front).
const legRows = [[0.855, 0.79], [0.775, 0.71], [0.695, 0.63]];
const legDetail = ["Prime camera-facing logo placement", "Central placement with strong walkout and stance visibility", "Lower-leg placement built for full-body photography"];
function legSlots(prefix, sideLabel, node, theta, tier) {
  return legRows.map((row, i) => ({
    id: `${prefix}${i + 1}`,
    name: `${tier} ${sideLabel} · ${["Upper", "Center", "Lower"][i]}`,
    detail: `${legDetail[i]} on the ${sideLabel.toLowerCase()} leg.`,
    surface: node, theta, width: 1.35, y0: row[1], y1: row[0]
  }));
}

const placements = {
  shorts: {
    front: [...legSlots("SF-L", "left", "legL", 0.08, "Front"), ...legSlots("SF-R", "right", "legR", -0.08, "Front")],
    back: [...legSlots("SB-L", "left", "legL", Math.PI - 0.08, "Back"), ...legSlots("SB-R", "right", "legR", Math.PI + 0.08, "Back")]
  },
  shirt: {
    front: Array.from({ length: 12 }, (_, i) => {
      const row = Math.floor(i / 3), col = i % 3;
      const top = 1.44 - row * 0.085;
      return {
        id: `TF-${String(i + 1).padStart(2, "0")}`,
        name: `Front grid · Row ${row + 1}, column ${col + 1}`,
        detail: "Front walkout T-shirt placement in the 4 × 3 sponsor grid.",
        surface: "shirt", theta: (col - 1) * 0.5, width: 0.44, y0: top - 0.07, y1: top
      };
    }),
    back: [{ id: "TB-01", name: "Upper back · Shoulder blades", detail: "Wide statement placement across the upper back of the walkout T-shirt.", surface: "shirt", theta: Math.PI, width: 1.55, y0: 1.34, y1: 1.45 }],
    sleeves: [
      { id: "TS-01", name: "Sleeve pair · Upper", detail: "Matching logo placement on both sleeves near the shoulder.", surface: "sleeveL", theta: Math.PI / 2, width: 1.0, y0: -0.085, y1: -0.035, mirror: "sleeveR" },
      { id: "TS-02", name: "Sleeve pair · Center", detail: "Matching logo placement on both sleeves at mid-arm.", surface: "sleeveL", theta: Math.PI / 2, width: 1.0, y0: -0.145, y1: -0.095, mirror: "sleeveR" },
      { id: "TS-03", name: "Sleeve pair · Lower", detail: "Matching logo placement on both sleeves above the cuff.", surface: "sleeveL", theta: Math.PI / 2, width: 1.0, y0: -0.205, y1: -0.155, mirror: "sleeveR" }
    ]
  }
};
const allPlacements = [...placements.shorts.front, ...placements.shorts.back, ...placements.shirt.front, ...placements.shirt.back, ...placements.shirt.sleeves];

const state = { garment: "shorts", selected: "SF-L1", logos: {}, logoImages: {}, azimuth: 0 };

/* ------------------------------------------------------------------ DOM */
const stage = document.getElementById("modelStage");
const canvas = document.getElementById("viewer");
const inventoryList = document.getElementById("inventoryList");
const inventoryTitle = document.getElementById("inventoryTitle");
const selectionCode = document.getElementById("selectionCode");
const selectionName = document.getElementById("selectionName");
const selectionDescription = document.getElementById("selectionDescription");
const uploadLabel = document.getElementById("uploadLabel");
const orientationLabel = document.getElementById("orientationLabel");
const orientationNeedle = document.getElementById("orientationNeedle");

/* ------------------------------------------------------------ renderer */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 40);
const TARGET = new THREE.Vector3(0, 1.0, 0);
camera.position.set(0, 1.05, 3.3);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 1.6;
controls.maxDistance = 6.5;
controls.minPolarAngle = 0.9;
controls.maxPolarAngle = 1.75;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.9;
controls.addEventListener("start", () => { controls.autoRotate = false; });

const key = new THREE.DirectionalLight(0xfff1e0, 2.6);
key.position.set(2.5, 4.5, 3.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1; key.shadow.camera.far = 12;
key.shadow.camera.left = key.shadow.camera.bottom = -1.6;
key.shadow.camera.right = key.shadow.camera.top = 1.6;
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.05;
key.shadow.radius = 4;
scene.add(key);
const rim = new THREE.DirectionalLight(0xf36a16, 1.6);
rim.position.set(-3, 2.2, -3.5);
scene.add(rim);
const fill = new THREE.DirectionalLight(0x8fa3ff, 0.5);
fill.position.set(-2.5, 1.5, 3);
scene.add(fill);
scene.add(new THREE.AmbientLight(0xffffff, 0.18));

const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.55, metalness: 0.1 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.66, 96), new THREE.MeshBasicMaterial({ color: 0xf36a16, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002;
scene.add(ring);

/* ---------------------------------------------------------- materials */
const skin = new THREE.MeshStandardMaterial({ color: 0xb98466, roughness: 0.62, metalness: 0 });
const hair = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.9 });
const blackFabric = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0 });
const orangeFabric = new THREE.MeshStandardMaterial({ color: 0xe8600f, roughness: 0.6, metalness: 0.05, emissive: 0x2a0d00, emissiveIntensity: 0.4 });
const waistband = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf07a2a, roughness: 0.5 });
const wrapMat = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.95 });

/* ----------------------------------------------------------- geometry */
function radiusAt(profile, y) {
  if (y <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const [y1, r1] = profile[i], [y0, r0] = profile[i - 1];
    if (y <= y1) return r0 + (r1 - r0) * ((y - y0) / (y1 - y0));
  }
  return profile[profile.length - 1][1];
}
function latheMesh(spec, material, { segments = 96, yStep = 0.01, extra = 0 } = {}) {
  const pts = [];
  const yStart = spec.profile[0][0], yEnd = spec.profile[spec.profile.length - 1][0];
  for (let y = yStart; y <= yEnd + 1e-6; y += yStep) pts.push(new THREE.Vector2(radiusAt(spec.profile, Math.min(y, yEnd)) + extra, y));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.scale(1, 1, spec.kz);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
function capsule(r, len, material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 24), material);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function limb(from, to, r0, r1, material) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r1, r0, len, 28, 1, false);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
function sphere(r, material, scale = [1, 1, 1]) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), material);
  m.scale.set(...scale);
  m.castShadow = m.receiveShadow = true;
  return m;
}

const athlete = new THREE.Group();
scene.add(athlete);
const nodes = {};

function buildBody() {
  const body = new THREE.Group();
  body.add(latheMesh(BODY.torso, skin));
  // neck + head
  body.add(Object.assign(limb([0, 1.56, 0.01], [0, 1.66, 0.01], 0.065, 0.06, skin)));
  const head = sphere(0.105, skin, [1, 1.22, 1.06]); head.position.set(0, 1.775, 0.02); body.add(head);
  const cap = sphere(0.108, hair, [1.01, 1.2, 1.06]); cap.position.set(0, 1.785, 0.015);
  cap.geometry = new THREE.SphereGeometry(0.108, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.55); body.add(cap);
  const ear = (x) => { const e = sphere(0.022, skin, [0.6, 1, 1]); e.position.set(x, 1.78, 0.0); body.add(e); }; ear(0.106); ear(-0.106);
  // shoulders (deltoids)
  [[1, "L"], [-1, "R"]].forEach(([s]) => {
    const d = sphere(0.085, skin, [1, 0.95, 0.92]); d.position.set(s * 0.245, 1.505, 0.0); d.name = "deltoid"; body.add(d);
    // upper arm, forearm, hand
    const sh = [s * 0.255, 1.49, 0.0], el = [s * 0.315, 1.215, 0.02], wr = [s * 0.35, 0.975, 0.11];
    body.add(limb(sh, el, 0.066, 0.056, skin));
    const elbow = sphere(0.058, skin); elbow.position.set(...el); body.add(elbow);
    body.add(limb(el, wr, 0.06, 0.045, skin));
    const wrap = limb([s * 0.343, 1.03, 0.09], wr, 0.056, 0.054, wrapMat); body.add(wrap);
    const hand = sphere(0.05, wrapMat, [0.9, 1.15, 0.75]); hand.position.set(wr[0] + s * 0.005, wr[1] - 0.05, wr[2] + 0.01); body.add(hand);
    // pelvis + legs (skin visible below shorts hem)
    const hip = [s * 0.11, 0.98, 0], kn = [s * 0.115, 0.50, 0.01], an = [s * 0.115, 0.09, -0.01];
    body.add(limb(hip, kn, 0.112, 0.078, skin));
    const knee = sphere(0.078, skin); knee.position.set(...kn); body.add(knee);
    body.add(limb(kn, an, 0.078, 0.052, skin));
    const sock = limb([s * 0.115, 0.30, -0.005], an, 0.07, 0.062, wrapMat); body.add(sock);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.008, 10, 40), wrapMat); cuff.rotation.x = Math.PI / 2; cuff.position.set(s * 0.115, 0.30, -0.005); body.add(cuff);
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.16, 6, 20), shoeMat);
    shoe.rotation.x = Math.PI / 2; shoe.position.set(s * 0.12, 0.055, 0.05); shoe.scale.set(1.15, 1, 1); shoe.castShadow = true; body.add(shoe);
  });
  const pelvis = sphere(0.19, skin, [1, 0.6, 0.7]); pelvis.position.set(0, 0.99, 0); body.add(pelvis);
  return body;
}

function buildShorts() {
  const g = new THREE.Group();
  g.add(latheMesh(BODY.shortsHip, orangeFabric));
  const band = latheMesh({ kz: BODY.shortsHip.kz, profile: [[1.05, 0.194], [1.09, 0.176]] }, waistband, { extra: 0.004 }); g.add(band);
  [["legL", 1], ["legR", -1]].forEach(([name, s]) => {
    const leg = new THREE.Group();
    leg.position.set(s * BODY.leg.offsetX, 0, 0);
    const len = BODY.leg.hipY - BODY.leg.hemY;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(BODY.leg.radius * 1.03, BODY.leg.radius, len, 40, 1, true), orangeFabric);
    tube.scale.z = BODY.leg.kz; tube.position.y = (BODY.leg.hipY + BODY.leg.hemY) / 2; tube.castShadow = tube.receiveShadow = true;
    tube.material = orangeFabric.clone(); tube.material.side = THREE.DoubleSide;
    leg.add(tube);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(BODY.leg.radius, 0.006, 8, 48), waistband);
    hem.rotation.x = Math.PI / 2; hem.scale.z = BODY.leg.kz; hem.position.y = BODY.leg.hemY; leg.add(hem);
    nodes[name] = leg; g.add(leg);
  });
  return g;
}

function buildShirt() {
  const g = new THREE.Group();
  const torso = latheMesh(BODY.shirt, blackFabric); torso.material = blackFabric.clone(); torso.material.side = THREE.DoubleSide; g.add(torso);
  const collar = latheMesh({ kz: BODY.shirt.kz, profile: [[1.575, 0.088], [1.60, 0.082]] }, blackFabric, { extra: 0.006 }); g.add(collar);
  [["sleeveL", 1], ["sleeveR", -1]].forEach(([name, s]) => {
    const sl = new THREE.Group();
    sl.position.set(s * BODY.sleeve.shoulder[0], BODY.sleeve.shoulder[1], 0);
    sl.rotation.z = s * BODY.sleeve.tilt;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(BODY.sleeve.radius * 0.98, BODY.sleeve.radius * 1.25, BODY.sleeve.length, 40, 1, true), blackFabric.clone());
    tube.material.side = THREE.DoubleSide; tube.position.y = -BODY.sleeve.length / 2; tube.castShadow = tube.receiveShadow = true; sl.add(tube);
    const capG = new THREE.SphereGeometry(BODY.sleeve.radius * 1.25, 32, 24);
    const cap = new THREE.Mesh(capG, blackFabric); cap.scale.set(1, 0.8, 1); cap.position.y = -0.01; cap.castShadow = true; sl.add(cap);
    nodes[name] = sl; g.add(sl);
  });
  return g;
}

const body = buildBody();
const shorts = buildShorts();
const shirt = buildShirt();
athlete.add(body, shorts, shirt);

/* ------------------------------------------------------------- slots */
const slotMeshes = [];
function surfacePoint(surface, theta, y, lift) {
  let r, kz;
  if (surface.kind === "lathe") { r = radiusAt(surface.profile, y); kz = surface.kz; }
  else { r = surface.radius; kz = surface.kz; }
  return new THREE.Vector3((r + lift) * Math.sin(theta), y, (r + lift) * kz * Math.cos(theta));
}
function patchGeometry(spec, lift = 0.006, seg = 14) {
  const surface = surfaces[spec.surface];
  const geo = new THREE.PlaneGeometry(1, 1, seg, 6);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const theta = spec.theta + (u - 0.5) * spec.width;
    const y = spec.y0 + v * (spec.y1 - spec.y0);
    const p = surfacePoint(surface, theta, y, lift);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}
function slotTexture(spot) {
  const c = document.createElement("canvas");
  const aspect = Math.max(1, Math.round((spot.width * (surfaces[spot.surface].radius || radiusAt(surfaces[spot.surface].profile, (spot.y0 + spot.y1) / 2))) / (spot.y1 - spot.y0) * 100) / 100);
  c.width = 512; c.height = Math.max(160, Math.round(512 / aspect));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { canvas: c, tex };
}
function drawSlot(slot) {
  const { spot, canvas: c, tex } = slot;
  const g = c.getContext("2d");
  const selected = spot.id === state.selected;
  g.clearRect(0, 0, c.width, c.height);
  const img = state.logoImages[spot.id];
  if (img) {
    g.fillStyle = "rgba(255,255,255,0.96)";
    roundRect(g, 6, 6, c.width - 12, c.height - 12, 14); g.fill();
    const pad = 22, bw = c.width - pad * 2, bh = c.height - pad * 2;
    const k = Math.min(bw / img.width, bh / img.height);
    g.drawImage(img, (c.width - img.width * k) / 2, (c.height - img.height * k) / 2, img.width * k, img.height * k);
  } else {
    g.fillStyle = selected ? "rgba(243,106,22,0.55)" : "rgba(255,255,255,0.10)";
    roundRect(g, 8, 8, c.width - 16, c.height - 16, 14); g.fill();
    g.setLineDash([16, 10]); g.lineWidth = 6;
    g.strokeStyle = selected ? "#ffb27a" : "rgba(255,255,255,0.85)";
    roundRect(g, 8, 8, c.width - 16, c.height - 16, 14); g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 ${Math.round(c.height * 0.36)}px "Barlow Condensed", Impact, sans-serif`;
    g.fillText(spot.id.replace(/^[A-Z]+-/, ""), c.width / 2, c.height / 2 + 2);
  }
  if (selected) { g.lineWidth = 10; g.strokeStyle = "#f36a16"; roundRect(g, 5, 5, c.width - 10, c.height - 10, 16); g.stroke(); }
  tex.needsUpdate = true;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function makeSlot(spot, surfaceName, garment) {
  const spec = { ...spot, surface: surfaceName };
  if (surfaceName !== spot.surface) spec.theta = -spot.theta;
  const { canvas: c, tex } = slotTexture(spec);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(patchGeometry(spec), mat);
  mesh.userData.spotId = spot.id;
  mesh.renderOrder = 2;
  const parent = surfaces[surfaceName].node ? nodes[surfaces[surfaceName].node] : garment === "shirt" ? shirt : shorts;
  parent.add(mesh);
  const slot = { spot, mesh, canvas: c, tex };
  slotMeshes.push(slot);
  drawSlot(slot);
  return slot;
}
[...placements.shorts.front, ...placements.shorts.back].forEach((s) => makeSlot(s, s.surface, "shorts"));
[...placements.shirt.front, ...placements.shirt.back].forEach((s) => makeSlot(s, s.surface, "shirt"));
placements.shirt.sleeves.forEach((s) => { makeSlot(s, s.surface, "shirt"); makeSlot(s, s.mirror, "shirt"); });

/* ------------------------------------------------------ optional GLB */
// A scanned likeness (e.g. Polycam/Luma export) can replace the procedural body:
// index.html?model=assets/models/heckert.glb — garments and placements still render on top.
const modelParam = new URLSearchParams(location.search).get("model");
if (modelParam) {
  new GLTFLoader().load(modelParam, (gltf) => {
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const k = 1.86 / size.y;
    root.scale.setScalar(k);
    box.setFromObject(root);
    root.position.y -= box.min.y;
    root.position.x -= (box.min.x + box.max.x) / 2;
    root.position.z -= (box.min.z + box.max.z) / 2;
    root.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    body.visible = false;
    athlete.add(root);
  });
}

/* ----------------------------------------------------------- UI logic */
function currentSide() {
  const a = ((state.azimuth % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a < Math.PI / 4 || a > Math.PI * 7 / 4) return "front";
  if (a > Math.PI * 3 / 4 && a < Math.PI * 5 / 4) return "back";
  return a < Math.PI ? "left" : "right";
}
function visiblePlacements() {
  const side = currentSide();
  if (state.garment === "shorts") return placements.shorts[side] || [];
  if (side === "front") return [...placements.shirt.front, ...placements.shirt.sleeves];
  if (side === "back") return [...placements.shirt.back, ...placements.shirt.sleeves];
  return placements.shirt.sleeves;
}
const findPlacement = () => allPlacements.find((p) => p.id === state.selected) || allPlacements[0];

function renderInventory() {
  const side = currentSide();
  const label = side === "front" ? "Front" : side === "back" ? "Back" : state.garment === "shirt" ? "Sleeves" : "Side";
  inventoryTitle.textContent = `${state.garment === "shirt" ? "Black T-shirt" : "Fight shorts"} · ${label}`;
  const items = visiblePlacements();
  inventoryList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p"); empty.className = "intro-copy"; empty.textContent = "Rotate to the front or back to select a placement."; inventoryList.append(empty); return;
  }
  items.forEach((spot, index) => {
    const button = document.createElement("button");
    button.className = `inventory-item${spot.id === state.selected ? " is-selected" : ""}`;
    button.innerHTML = `<span class="num">${String(index + 1).padStart(2, "0")}</span><span><strong>${spot.name}</strong><small>${spot.id}</small></span><span class="status">OPEN</span>`;
    button.addEventListener("click", () => selectPlacement(spot.id, true));
    inventoryList.append(button);
  });
}
function renderSelection() {
  const spot = findPlacement();
  selectionCode.textContent = spot.id;
  selectionName.textContent = spot.name;
  selectionDescription.textContent = spot.detail;
  uploadLabel.textContent = state.logos[spot.id] ? "Replace logo preview" : "Upload logo preview";
}
function renderSlots() { slotMeshes.forEach(drawSlot); }
function renderGarments() {
  shirt.visible = state.garment === "shirt";
  body.traverse((o) => { if (o.name === "deltoid") o.visible = !shirt.visible; });
  slotMeshes.forEach((s) => { s.mesh.visible = (state.garment === "shirt") === s.spot.id.startsWith("T"); });
}
function renderOrientation() {
  const side = currentSide();
  orientationLabel.textContent = side.toUpperCase();
  const a = ((state.azimuth % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  orientationNeedle.style.left = `${(a / (Math.PI * 2)) * 100}%`;
}
function renderAll() { renderGarments(); renderSlots(); renderInventory(); renderSelection(); renderOrientation(); }

function selectPlacement(id, focus = false) {
  state.selected = id;
  renderSlots(); renderInventory(); renderSelection();
  if (focus) {
    const spot = findPlacement();
    const cur = state.azimuth;
    let delta = spot.theta - cur; delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    if (Math.abs(delta) > 0.6) rotateTo(cur + delta);
  }
}
function setGarment(garment) {
  state.garment = garment;
  state.selected = garment === "shirt" ? "TF-01" : "SF-L1";
  document.querySelectorAll(".garment-tab").forEach((b) => { const on = b.dataset.garment === garment; b.classList.toggle("is-active", on); b.setAttribute("aria-selected", String(on)); });
  if (currentSide() !== "front" && currentSide() !== "back") rotateTo(0);
  renderAll();
}

/* ----------------------------------------------------- camera control */
let tween = null;
function rotateTo(azimuth) {
  controls.autoRotate = false;
  const dist = camera.position.distanceTo(controls.target);
  const polar = controls.getPolarAngle();
  const start = controls.getAzimuthalAngle();
  let end = azimuth; let d = end - start; d = Math.atan2(Math.sin(d), Math.cos(d));
  tween = { start, delta: d, polar, dist, t: 0 };
}
function applyAzimuth(az, polar, dist) {
  const s = new THREE.Spherical(dist, polar, az);
  camera.position.setFromSpherical(s).add(controls.target);
  camera.lookAt(controls.target);
}
const quickViews = { front: 0, back: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => rotateTo(quickViews[b.dataset.view])));
document.getElementById("rotatePrev").addEventListener("click", () => rotateTo(controls.getAzimuthalAngle() - Math.PI / 4));
document.getElementById("rotateNext").addEventListener("click", () => rotateTo(controls.getAzimuthalAngle() + Math.PI / 4));
document.querySelectorAll(".garment-tab").forEach((b) => b.addEventListener("click", () => setGarment(b.dataset.garment)));

/* ------------------------------------------------------------ picking */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener("pointerup", (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved > 6) return;
  const rect = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(slotMeshes.filter((s) => s.mesh.visible).map((s) => s.mesh), false);
  if (hits.length) selectPlacement(hits[0].object.userData.spotId);
});
canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(slotMeshes.filter((s) => s.mesh.visible).map((s) => s.mesh), false);
  canvas.style.cursor = hits.length ? "pointer" : "grab";
});

/* ------------------------------------------------------- logo upload */
document.getElementById("logoInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert("Please choose a logo under 5 MB."); return; }
  const old = state.logos[state.selected];
  if (old) URL.revokeObjectURL(old);
  const url = URL.createObjectURL(file);
  state.logos[state.selected] = url;
  const img = new Image();
  img.onload = () => { state.logoImages[state.selected] = img; renderSlots(); renderSelection(); };
  img.src = url;
});
document.getElementById("reserveButton").addEventListener("click", () => {
  const spot = findPlacement();
  const subject = encodeURIComponent(`BKFC Clearwater sponsorship inquiry: ${spot.id}`);
  const bodyText = encodeURIComponent(`I am interested in ${spot.name} (${spot.id}) in the interactive sponsorship portal.`);
  window.open(`mailto:michaelheckert@heckholdings.com?subject=${subject}&body=${bodyText}`, "_blank");
});

/* -------------------------------------------------------------- embed */
const embedDialog = document.getElementById("embedDialog");
document.getElementById("embedButton").addEventListener("click", () => embedDialog.showModal());
document.getElementById("dialogClose").addEventListener("click", () => embedDialog.close());
document.getElementById("copyEmbed").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.getElementById("embedCode").textContent);
  document.getElementById("copyEmbed").textContent = "Copied";
  setTimeout(() => { document.getElementById("copyEmbed").textContent = "Copy embed code"; }, 1600);
});

/* --------------------------------------------------------------- loop */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

let lastSide = null;
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (tween) {
    tween.t = Math.min(1, tween.t + dt * 2.2);
    const e = 1 - Math.pow(1 - tween.t, 3);
    applyAzimuth(tween.start + tween.delta * e, tween.polar, tween.dist);
    if (tween.t >= 1) tween = null;
  }
  controls.update();
  state.azimuth = controls.getAzimuthalAngle();
  const side = currentSide();
  if (side !== lastSide) {
    lastSide = side;
    const visible = visiblePlacements();
    if (visible.length && !visible.some((p) => p.id === state.selected)) { state.selected = visible[0].id; renderSlots(); renderSelection(); }
    renderInventory();
  }
  renderOrientation();
  renderer.render(scene, camera);
}
renderAll();
animate();
stage.classList.add("is-ready");
