import * as THREE from "three";

/* ---------------------------------------------------------------------------
   BKFC-style "squared circle" ropes around the athlete: a circular rope line
   on padded posts with turnbuckles, sitting on the dark stage. The stage
   backdrop stays the portal's own poster treatment. Units are metres; the
   floor is y = 0 where the athlete stands.
--------------------------------------------------------------------------- */

export const RING_RADIUS = 3.55;
export const ROPE_RADIUS = RING_RADIUS - 0.24;
const POST_COUNT = 8;
const ROPE_HEIGHTS = [0.48, 0.8, 1.12, 1.44];
const ROPE_COLORS = [0xb8241d, 0xe6e0d4, 0x1c1c1c, 0xb8241d];

export function buildArena(scene) {
  const group = new THREE.Group();
  group.name = "ring";

  const postMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.55, metalness: 0.5 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xb8241d, roughness: 0.95 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.9 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.35, metalness: 0.9 });
  const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.62, 16);
  const padGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 20);
  const capGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.2, 20);
  const baseGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.04, 20);
  const hookGeo = new THREE.TorusGeometry(0.035, 0.008, 8, 16);
  const barrelGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.11, 10);
  const eyeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8);

  const centre = new THREE.Vector3();
  for (let i = 0; i < POST_COUNT; i++) {
    const a = (i / POST_COUNT) * Math.PI * 2 + Math.PI / POST_COUNT;
    const x = Math.cos(a) * RING_RADIUS, z = Math.sin(a) * RING_RADIUS;
    const post = new THREE.Mesh(postGeo, postMat); post.position.set(x, 0.81, z); post.castShadow = true; group.add(post);
    const base = new THREE.Mesh(baseGeo, postMat); base.position.set(x, 0.02, z); group.add(base);
    const pad = new THREE.Mesh(padGeo, padMat); pad.position.set(x, 0.95, z); group.add(pad);
    const cap = new THREE.Mesh(capGeo, capMat); cap.position.set(x, 1.6, z); group.add(cap);

    // turnbuckles: one per rope, on the inside face of the post, tensioning the rope
    ROPE_HEIGHTS.forEach((y) => {
      const tb = new THREE.Group();
      tb.position.set(x, y, z);
      tb.lookAt(centre.set(0, y, 0));
      const barrel = new THREE.Mesh(barrelGeo, steelMat); barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.16;
      const eye = new THREE.Mesh(eyeGeo, steelMat); eye.rotation.x = Math.PI / 2; eye.position.z = 0.06;
      const hook = new THREE.Mesh(hookGeo, steelMat); hook.position.z = 0.25;
      tb.add(barrel, eye, hook);
      group.add(tb);
    });
  }

  ROPE_HEIGHTS.forEach((y, i) => {
    const rope = new THREE.Mesh(
      new THREE.TorusGeometry(ROPE_RADIUS, 0.032, 10, 220),
      new THREE.MeshStandardMaterial({ color: ROPE_COLORS[i], roughness: 0.95 })
    );
    rope.rotation.x = Math.PI / 2; rope.position.y = y;
    rope.castShadow = true;
    group.add(rope);
  });

  // spacer straps between posts keep the ropes tied together
  const strapGeo = new THREE.BoxGeometry(0.05, ROPE_HEIGHTS[3] - ROPE_HEIGHTS[0] + 0.1, 0.02);
  for (let i = 0; i < POST_COUNT; i++) {
    const a = (i / POST_COUNT) * Math.PI * 2;
    const strap = new THREE.Mesh(strapGeo, capMat);
    strap.position.set(Math.cos(a) * ROPE_RADIUS, (ROPE_HEIGHTS[0] + ROPE_HEIGHTS[3]) / 2, Math.sin(a) * ROPE_RADIUS);
    strap.lookAt(0, strap.position.y, 0);
    group.add(strap);
  }

  scene.add(group);
  return { group, update() {} };
}
