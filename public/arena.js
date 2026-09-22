import * as THREE from "three";

/* ---------------------------------------------------------------------------
   Fight-night arena built around the athlete: a circular bare-knuckle ring
   (raised canvas, padded posts, four ropes, branded apron), a truss ring of
   moving-head fixtures with haze beams, two arena screens and a tiered crowd
   bowl of phone lights fading into the dark. Everything is procedural so the
   portal stays a single static deploy. Units are metres; the canvas top sits
   at y = 0 where the athlete stands.
--------------------------------------------------------------------------- */

export const RING_RADIUS = 3.55;
const CANVAS_RADIUS = 3.7;
const PLATFORM_HEIGHT = 0.95;
const POST_COUNT = 8;
const ROPE_HEIGHTS = [0.48, 0.8, 1.12, 1.44];
const ROPE_COLORS = [0xb8241d, 0xe6e0d4, 0x1c1c1c, 0xb8241d];
const ORANGE = 0xf36a16;

const rand = (a, b) => a + Math.random() * (b - a);

function canvasTexture(draw, size = 1024, height = size) {
  const c = document.createElement("canvas");
  c.width = size; c.height = height;
  draw(c.getContext("2d"), size, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ----------------------------------------------------------- ring canvas */
function ringCanvasTexture() {
  return canvasTexture((g, s) => {
    const px = s / (CANVAS_RADIUS * 2);
    g.fillStyle = "#b8afa0";
    g.fillRect(0, 0, s, s);
    // woven canvas grain
    for (let i = 0; i < 26000; i++) {
      g.fillStyle = `rgba(${rand(40, 90)},${rand(35, 70)},${rand(25, 55)},${rand(0.03, 0.11)})`;
      g.fillRect(Math.random() * s, Math.random() * s, rand(1, 3), rand(1, 3));
    }
    // scuffs and worn patches
    for (let i = 0; i < 90; i++) {
      const r = rand(20, 110);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `rgba(70,50,35,${rand(0.05, 0.16)})`);
      grad.addColorStop(1, "rgba(70,50,35,0)");
      g.save(); g.translate(Math.random() * s, Math.random() * s); g.fillStyle = grad; g.fillRect(-r, -r, r * 2, r * 2); g.restore();
    }
    g.translate(s / 2, s / 2);
    // outer rule inside the ropes
    g.strokeStyle = "rgba(20,20,20,0.55)"; g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, (RING_RADIUS - 0.35) * px, 0, Math.PI * 2); g.stroke();
    // Team Heck centre mark
    g.strokeStyle = "#f36a16"; g.lineWidth = 0.045 * px;
    g.beginPath(); g.arc(0, 0, 0.64 * px, 0, Math.PI * 2); g.stroke();
    // toe lines
    g.fillStyle = "rgba(25,25,25,0.85)";
    [-0.45, 0.45].forEach((z) => g.fillRect(-0.55 * px, z * px - 0.02 * px, 1.1 * px, 0.04 * px));
    // event lettering around the canvas edge
    g.fillStyle = "rgba(20,20,20,0.7)";
    g.font = `800 ${Math.round(0.28 * px)}px "Barlow Condensed", Impact, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    const words = ["TEAM HECK", "KING KILLER", "TEAM HECK", "KING KILLER"];
    words.forEach((w, i) => {
      g.save(); g.rotate((i / words.length) * Math.PI * 2 + Math.PI / 4);
      g.translate(0, -(RING_RADIUS - 0.95) * px); g.fillText(w, 0, 0); g.restore();
    });
  }, 2048);
}

function apronTexture() {
  return canvasTexture((g, w, h) => {
    g.fillStyle = "#0c0c0c"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#f36a16"; g.fillRect(0, 0, w, h * 0.045);
    g.fillStyle = "#2a2a2a"; g.fillRect(0, h * 0.9, w, h * 0.012);
    g.fillStyle = "#f3efe6";
    g.font = `800 ${Math.round(h * 0.3)}px "Barlow Condensed", Impact, sans-serif`;
    g.textBaseline = "middle"; g.textAlign = "center";
    const text = "BKFC CLEARWATER  ·  MICHAEL \u201CKING KILLER\u201D HECKERT  ·  ";
    const tw = g.measureText(text).width;
    for (let x = 0; x < w + tw; x += tw) g.fillText(text, x + tw / 2, h * 0.5);
  }, 4096, 256);
}

function screenTexture(lines) {
  return canvasTexture((g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#2a0d05"); grad.addColorStop(0.5, "#5a1a08"); grad.addColorStop(1, "#1a0704");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${rand(0.01, 0.05)})`; g.fillRect(Math.random() * w, Math.random() * h, rand(2, 40), 2); }
    g.fillStyle = "#f36a16"; g.fillRect(0, h * 0.86, w, h * 0.03);
    g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach(([txt, size, y, color]) => {
      g.fillStyle = color; g.font = `800 ${Math.round(h * size)}px "Barlow Condensed", Impact, sans-serif`;
      g.fillText(txt, w / 2, h * y);
    });
  }, 1024, 512);
}

/* ------------------------------------------------------------------ ring */
function buildRing(group) {
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(CANVAS_RADIUS, CANVAS_RADIUS + 0.05, PLATFORM_HEIGHT, 96, 1, true),
    new THREE.MeshStandardMaterial({ map: apronTexture(), roughness: 0.85, metalness: 0 })
  );
  platform.material.map.wrapS = THREE.RepeatWrapping; platform.material.map.repeat.set(2, 1);
  platform.position.y = -PLATFORM_HEIGHT / 2;
  group.add(platform);

  const canvasMesh = new THREE.Mesh(
    new THREE.CircleGeometry(CANVAS_RADIUS, 128),
    new THREE.MeshStandardMaterial({ map: ringCanvasTexture(), roughness: 0.92, metalness: 0 })
  );
  canvasMesh.rotation.x = -Math.PI / 2;
  canvasMesh.receiveShadow = true;
  group.add(canvasMesh);

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(CANVAS_RADIUS, 0.03, 10, 128),
    new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.5, emissive: ORANGE, emissiveIntensity: 0.25 })
  );
  lip.rotation.x = Math.PI / 2; lip.position.y = -0.01;
  group.add(lip);

  const postMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.4 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xb8241d, roughness: 0.95 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.9 });
  const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.62, 16);
  const padGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 20);
  const capGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.2, 20);
  for (let i = 0; i < POST_COUNT; i++) {
    const a = (i / POST_COUNT) * Math.PI * 2 + Math.PI / POST_COUNT;
    const x = Math.cos(a) * RING_RADIUS, z = Math.sin(a) * RING_RADIUS;
    const post = new THREE.Mesh(postGeo, postMat); post.position.set(x, 0.81, z); post.castShadow = true; group.add(post);
    const pad = new THREE.Mesh(padGeo, padMat); pad.position.set(x, 0.95, z); group.add(pad);
    const cap = new THREE.Mesh(capGeo, capMat); cap.position.set(x, 1.6, z); group.add(cap);
  }

  ROPE_HEIGHTS.forEach((y, i) => {
    const rope = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS, 0.032, 10, 220),
      new THREE.MeshStandardMaterial({ color: ROPE_COLORS[i], roughness: 0.95 })
    );
    rope.rotation.x = Math.PI / 2; rope.position.y = y;
    group.add(rope);
  });

  // spacer straps between posts keep the ropes tied together
  const strapGeo = new THREE.BoxGeometry(0.05, ROPE_HEIGHTS[3] - ROPE_HEIGHTS[0] + 0.1, 0.02);
  const strapMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.9 });
  for (let i = 0; i < POST_COUNT; i++) {
    const a = (i / POST_COUNT) * Math.PI * 2;
    const strap = new THREE.Mesh(strapGeo, strapMat);
    strap.position.set(Math.cos(a) * RING_RADIUS, (ROPE_HEIGHTS[0] + ROPE_HEIGHTS[3]) / 2, Math.sin(a) * RING_RADIUS);
    strap.lookAt(0, strap.position.y, 0);
    group.add(strap);
  }

  // stairs at the front-right corner
  const stairMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8, metalness: 0.3 });
  const stairAngle = Math.PI / 4 + Math.PI / 8;
  for (let s = 0; s < 4; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.3), stairMat);
    const r = CANVAS_RADIUS + 0.2 + s * 0.3;
    step.position.set(Math.cos(stairAngle) * r, -0.12 - s * 0.24, Math.sin(stairAngle) * r);
    step.lookAt(0, step.position.y, 0);
    group.add(step);
  }
}

/* ------------------------------------------------------------- arena bowl */
function buildBowl(group) {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -PLATFORM_HEIGHT;
  group.add(floor);

  // press/cageside barrier ring
  const barrier = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.2, 1.0, 64, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9, side: THREE.DoubleSide })
  );
  barrier.position.y = -PLATFORM_HEIGHT + 0.5;
  group.add(barrier);
  const barrierTop = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.02, 6, 96), new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.6 }));
  barrierTop.rotation.x = Math.PI / 2; barrierTop.position.y = -PLATFORM_HEIGHT + 1.0;
  group.add(barrierTop);

  // seating tiers
  const profile = [];
  for (let i = 0; i <= 6; i++) profile.push(new THREE.Vector2(7 + i * 4, -PLATFORM_HEIGHT + i * i * 0.28 + i * 0.6));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 1, side: THREE.DoubleSide }));
  group.add(bowl);

  // crowd: thousands of dim silhouettes plus phone lights
  const COUNT = 6000;
  const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3), phase = new Float32Array(COUNT);
  const c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const t = Math.pow(Math.random(), 0.8);
    const r = 7.5 + t * 22;
    const y = -PLATFORM_HEIGHT + 1.1 + Math.pow(t * 6, 2) * 0.28 + t * 6 * 0.6 + rand(0, 0.4);
    const a = Math.random() * Math.PI * 2;
    pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    const phone = Math.random() < 0.12;
    if (phone) c.setHSL(rand(0.55, 0.62), rand(0.3, 0.7), rand(0.55, 0.9));
    else c.setHSL(rand(0.02, 0.08), rand(0.2, 0.5), rand(0.06, 0.2));
    col.set([c.r, c.g, c.b], i * 3);
    phase[i] = phone ? Math.random() * 100 : -1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const crowd = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true, depthWrite: false }));
  group.add(crowd);

  const base = col.slice();
  const colorAttr = geo.getAttribute("color");
  return (time) => {
    // twinkle the phone lights and fire the occasional camera flash
    for (let i = 0; i < COUNT; i += 3) {
      if (phase[i] < 0) continue;
      const k = 0.7 + 0.3 * Math.sin(time * 2.1 + phase[i]);
      colorAttr.setXYZ(i, base[i * 3] * k, base[i * 3 + 1] * k, base[i * 3 + 2] * k);
    }
    if (Math.random() < 0.25) {
      const i = Math.floor(Math.random() * COUNT);
      colorAttr.setXYZ(i, 4, 4, 4.4);
    }
    colorAttr.needsUpdate = true;
  };
}

/* --------------------------------------------------------- truss & lights */
function buildRig(group) {
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.8 });
  const R = 6.0, Y = 6.4;
  [0, 0.55].forEach((dy) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 8, 96), trussMat);
    t.rotation.x = Math.PI / 2; t.position.y = Y + dy; group.add(t);
  });
  const braceGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.62, 6);
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const b = new THREE.Mesh(braceGeo, trussMat);
    b.position.set(Math.cos(a) * R, Y + 0.275, Math.sin(a) * R);
    b.rotation.z = (i % 2 ? 0.45 : -0.45);
    b.lookAt(0, Y + 0.275, 0); b.rotateX(i % 2 ? 0.5 : -0.5);
    group.add(b);
  }
  // hang the truss from the roof
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.5 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 9, 4), cableMat);
    cable.position.set(Math.cos(a) * R, Y + 5, Math.sin(a) * R);
    group.add(cable);
  }

  // fixtures with haze beams
  const bodyGeo = new THREE.BoxGeometry(0.28, 0.32, 0.28);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.7 });
  const beams = [];
  const FIXTURES = 12;
  for (let i = 0; i < FIXTURES; i++) {
    const a = (i / FIXTURES) * Math.PI * 2 + Math.PI / FIXTURES;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(x, Y - 0.25, z);
    body.lookAt(0, 0.9, 0);
    group.add(body);

    const warm = i % 3 === 0;
    const color = warm ? new THREE.Color(ORANGE) : new THREE.Color(0xcfd8ff);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    lens.position.copy(body.position); lens.lookAt(0, 0.9, 0); lens.translateZ(0.17);
    group.add(lens);

    if (i % 2 === 0) {
      const len = new THREE.Vector3(x, Y - 0.25, z).distanceTo(new THREE.Vector3(0, 0.9, 0)) + 0.8;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.06, len, 24, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: warm ? 0.028 : 0.02, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      beam.position.copy(body.position);
      beam.lookAt(0, 0.9, 0);
      beam.rotateX(-Math.PI / 2);
      beam.translateY(-len / 2);
      beam.userData.baseOpacity = beam.material.opacity;
      beam.userData.phase = i;
      group.add(beam);
      beams.push(beam);
    }
  }

  // overhead pools on the canvas
  const spot = new THREE.SpotLight(0xfff4e6, 28, 14, 0.42, 0.5, 1.4);
  spot.position.set(0, Y, 0); spot.target.position.set(0, 0, 0);
  group.add(spot, spot.target);
  const red = new THREE.PointLight(0xff3a1a, 18, 16, 1.6);
  red.position.set(-4.5, 4.2, -3.5);
  group.add(red);
  const blue = new THREE.PointLight(0x4f6bff, 10, 16, 1.6);
  blue.position.set(4.5, 4.2, 3.5);
  group.add(blue);

  return (time) => {
    beams.forEach((b) => { b.material.opacity = b.userData.baseOpacity * (0.75 + 0.25 * Math.sin(time * 0.9 + b.userData.phase)); });
  };
}

/* --------------------------------------------------------------- screens */
function buildScreens(group) {
  const mat = new THREE.MeshBasicMaterial({
    map: screenTexture([["BKFC CLEARWATER", 0.14, 0.24, "#f3efe6"], ["MICHAEL \u201CKING KILLER\u201D HECKERT", 0.2, 0.5, "#ffffff"], ["SPONSOR THE FIGHT KIT", 0.1, 0.72, "#f36a16"]]),
    toneMapped: false
  });
  [Math.PI * 0.5, Math.PI * 1.5, Math.PI, 0].forEach((a, i) => {
    const r = i < 2 ? 26 : 30;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), mat);
    screen.position.set(Math.cos(a) * r, 9.6, Math.sin(a) * r);
    screen.lookAt(0, 3, 0);
    group.add(screen);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(6.7, 3.5), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5, metalness: 0.6 }));
    frame.position.copy(screen.position); frame.quaternion.copy(screen.quaternion); frame.translateZ(-0.02);
    group.add(frame);
    const glow = new THREE.PointLight(0xff5a1a, 4, 10, 1.5);
    glow.position.copy(screen.position); glow.translateZ(0.5);
    group.add(glow);
  });
}

/* ----------------------------------------------------------------- setup */
export function buildArena(scene) {
  const group = new THREE.Group();
  group.name = "arena";
  buildRing(group);
  const crowdUpdate = buildBowl(group);
  const rigUpdate = buildRig(group);
  buildScreens(group);
  // the studio environment map is for the athlete; keep the arena moody
  group.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial) o.material.envMapIntensity = 0.12; });
  scene.add(group);

  scene.background = new THREE.Color(0x040305);
  scene.fog = new THREE.FogExp2(0x050306, 0.04);

  return {
    group,
    update(time) { crowdUpdate(time); rigUpdate(time); }
  };
}
