/**
 * LandmarkGenerator — Special geometry for notable words.
 *
 * generatePillar: Monumental pillar for repeated words.
 * generateCrystal: Small floating crystal for hapax legomena.
 */

import * as THREE from 'three';
import { createRNG } from '../utils/seededRandom.js';

/* ------------------------------------------------------------------ */
/*  Pillar — for frequently repeated words                             */
/* ------------------------------------------------------------------ */

/**
 * @param {object} props
 * @param {number} props.frequency  word repetition count (drives height)
 * @param {number} props.scale      base scale multiplier (default 1)
 * @param {number} props.seed
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function generatePillar(props, material) {
  const { frequency = 2, scale = 1, seed = 1 } = props;
  const rng = createRNG(seed);

  const group = new THREE.Group();
  group.name = 'landmark_pillar';

  // --- dimensions ---------------------------------------------------
  const baseRadius  = 0.3 * scale + rng.range(0, 0.1);
  const pillarHeight = 2.0 + frequency * 0.8;   // 2.8 … quite tall
  const capHeight    = 0.25;

  // --- main shaft ---------------------------------------------------
  const shaftGeo = new THREE.CylinderGeometry(
    baseRadius * 0.85,   // top radius (slight taper)
    baseRadius,          // bottom radius
    pillarHeight,
    12
  );
  const shaft = new THREE.Mesh(shaftGeo, material);
  shaft.position.y = pillarHeight / 2;
  shaft.name = 'pillar_shaft';
  group.add(shaft);

  // --- base plinth --------------------------------------------------
  const plinthH = 0.3;
  const plinthGeo = new THREE.CylinderGeometry(
    baseRadius * 1.3,
    baseRadius * 1.5,
    plinthH,
    12
  );
  const plinth = new THREE.Mesh(plinthGeo, material);
  plinth.position.y = plinthH / 2;
  plinth.name = 'pillar_plinth';
  group.add(plinth);

  // --- capital (top) ------------------------------------------------
  const capitalGeo = new THREE.CylinderGeometry(
    baseRadius * 1.3,
    baseRadius * 0.85,
    capHeight,
    12
  );
  const capital = new THREE.Mesh(capitalGeo, material);
  capital.position.y = pillarHeight + capHeight / 2;
  capital.name = 'pillar_capital';
  group.add(capital);

  // --- decorative rings along the shaft -----------------------------
  const ringCount = Math.max(1, Math.min(8, Math.floor(frequency / 2)));
  for (let i = 0; i < ringCount; i++) {
    const t = (i + 1) / (ringCount + 1);
    const ry = plinthH + t * pillarHeight;
    // Interpolated radius (accounts for taper)
    const rAtY = baseRadius * (1 - t * 0.15);

    const ringGeo = new THREE.TorusGeometry(rAtY + 0.05, 0.04, 8, 24);
    const ring = new THREE.Mesh(ringGeo, material);
    ring.position.y = ry;
    ring.rotation.x = Math.PI / 2;
    ring.name = `pillar_ring_${i}`;
    group.add(ring);
  }

  // --- fluting (vertical grooves as thin cylinders subtracted via
  //     visual overlay — we add protruding ridges instead) -----------
  const fluteCount = 8;
  for (let i = 0; i < fluteCount; i++) {
    const angle = (i / fluteCount) * Math.PI * 2;
    const fluteR = 0.03;
    const fluteGeo = new THREE.CylinderGeometry(fluteR, fluteR, pillarHeight, 4);
    const flute = new THREE.Mesh(fluteGeo, material);
    flute.position.set(
      Math.cos(angle) * baseRadius * 0.92,
      pillarHeight / 2,
      Math.sin(angle) * baseRadius * 0.92
    );
    flute.name = `pillar_flute_${i}`;
    group.add(flute);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/*  Crystal — for hapax legomena (words appearing exactly once)        */
/* ------------------------------------------------------------------ */

/**
 * @param {object} props
 * @param {number} props.scale   crystal size (default 1)
 * @param {number} props.seed
 * @param {number} props.floatHeight  how high the crystal floats
 * @param {THREE.Material} material
 * @returns {THREE.Group}  — group.userData contains animation hints
 */
export function generateCrystal(props, material) {
  const { scale = 1, seed = 1, floatHeight = 2.0 } = props;
  const rng = createRNG(seed);

  const group = new THREE.Group();
  group.name = 'landmark_crystal';

  // --- crystal body (OctahedronGeometry, stretched & rotated) -------
  const radius = 0.25 * scale + rng.range(0, 0.15);
  const detail = rng.intRange(0, 1);
  const octoGeo = new THREE.OctahedronGeometry(radius, detail);

  // Stretch along Y for a more crystal-like look
  const stretchY = 1.3 + rng.range(0, 0.5);
  octoGeo.scale(1, stretchY, 1);

  const crystal = new THREE.Mesh(octoGeo, material);
  crystal.name = 'crystal_body';
  group.add(crystal);

  // --- tilt the crystal to an arbitrary angle -----------------------
  crystal.rotation.set(
    rng.range(-0.4, 0.4),
    rng.range(0, Math.PI * 2),
    rng.range(-0.3, 0.3)
  );

  // --- set float position -------------------------------------------
  group.position.y = floatHeight;

  // --- small glow halo (flat ring) ----------------------------------
  const haloGeo = new THREE.RingGeometry(radius * 1.1, radius * 1.6, 24);
  const haloMat = material.clone ? material.clone() : material;
  if (haloMat.transparent !== undefined) {
    haloMat.transparent = true;
    haloMat.opacity = 0.25;
  }
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.name = 'crystal_halo';
  group.add(halo);

  // --- animation data (consumed by the render loop) -----------------
  // We store bob parameters so the caller can animate deterministically.
  group.userData.animation = {
    type: 'bob',
    baseY: floatHeight,
    amplitude: 0.15 + rng.range(0, 0.1),
    frequency: 0.8 + rng.range(0, 0.4),     // Hz
    rotationSpeed: 0.3 + rng.range(0, 0.2),  // rad/s around Y
    phase: rng.range(0, Math.PI * 2),
  };

  return group;
}
