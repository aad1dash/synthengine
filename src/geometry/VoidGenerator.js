/**
 * VoidGenerator — Cosmic void between paragraphs.
 *
 * Produces a particle-based nebula, a narrow bridge walkway, and
 * portal rings at entry / exit.  All randomness is seeded.
 *
 * Entry at -Z, exit at +Z.  Bridge floor at y = 0.
 */

import * as THREE from 'three';
import { createRNG } from '../utils/seededRandom.js';

/* ------------------------------------------------------------------ */
/*  main generator                                                     */
/* ------------------------------------------------------------------ */

/**
 * @param {object} voidProps
 * @param {number} voidProps.span            distance between portals
 * @param {number} voidProps.nebulaHue       0-360 dominant hue
 * @param {number} voidProps.particleDensity 0-1
 * @param {number} voidProps.seed
 * @param {THREE.Material} material          used for bridge & portals
 * @returns {THREE.Group}
 */
export function generate(voidProps, material) {
  const {
    span = 20,
    nebulaHue = 240,
    particleDensity = 0.5,
    seed = 1,
  } = voidProps;

  const rng = createRNG(seed);
  const group = new THREE.Group();
  group.name = 'void';

  const halfSpan = span / 2;

  // -------------------------------------------------------------------
  // 1. Nebula particle system
  // -------------------------------------------------------------------
  const particleCount = Math.max(64, Math.floor(particleDensity * 4000));
  const positions  = new Float32Array(particleCount * 3);
  const colors     = new Float32Array(particleCount * 3);
  const sizes      = new Float32Array(particleCount);

  // Spread around Z=0 ±halfSpan, with a large XY spread
  const spreadXY = span * 1.5;

  const baseColor = new THREE.Color();
  baseColor.setHSL(nebulaHue / 360, 0.6, 0.5);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;

    positions[i3]     = rng.range(-spreadXY, spreadXY);           // x
    positions[i3 + 1] = rng.range(-spreadXY * 0.6, spreadXY * 0.6); // y
    positions[i3 + 2] = rng.range(-halfSpan * 1.2, halfSpan * 1.2); // z

    // Slight hue variation per particle
    const hueOff = rng.range(-0.08, 0.08);
    const lumOff = rng.range(-0.15, 0.15);
    const c = new THREE.Color();
    c.setHSL(
      ((nebulaHue / 360) + hueOff + 1) % 1,
      0.4 + rng.range(0, 0.4),
      0.3 + lumOff
    );
    colors[i3]     = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;

    sizes[i] = rng.range(0.1, 0.6);
  }

  const particlesGeo = new THREE.BufferGeometry();
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  particlesGeo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  const particlesMat = new THREE.PointsMaterial({
    size: 0.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particlesGeo, particlesMat);
  particles.name = 'nebula_particles';
  group.add(particles);

  // -------------------------------------------------------------------
  // 2. Bridge walkway (narrow tube along a gentle curve)
  // -------------------------------------------------------------------
  const bridgeSag = rng.range(-1.5, -0.3);   // slight downward bow
  const bridgePts = [];
  const bridgeSegs = 32;
  for (let i = 0; i <= bridgeSegs; i++) {
    const t = i / bridgeSegs;
    const z = -halfSpan + t * span;
    const normT = 2 * t - 1;  // -1 … 1
    const y = bridgeSag * (1 - normT * normT);   // parabolic sag
    const x = rng.range(-0.05, 0.05);            // tiny lateral jitter
    bridgePts.push(new THREE.Vector3(x, y, z));
  }
  const bridgeCurve = new THREE.CatmullRomCurve3(bridgePts);

  // Walkway surface — flat ribbon from TubeGeometry with small radius
  const bridgeWidth  = 1.2;
  const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, bridgeSegs, bridgeWidth / 2, 4, false);
  const bridge = new THREE.Mesh(bridgeGeo, material);
  bridge.name = 'bridge';
  group.add(bridge);

  // Railings (two thin tubes offset to each side)
  const railHeight = 1.0;
  for (const side of [-1, 1]) {
    const railPts = [];
    for (let i = 0; i <= bridgeSegs; i++) {
      const t = i / bridgeSegs;
      const p = bridgeCurve.getPointAt(t);
      const tangent = bridgeCurve.getTangentAt(t).normalize();
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const rp = p.clone().add(perp.multiplyScalar(side * bridgeWidth * 0.5));
      rp.y += railHeight;
      railPts.push(rp);
    }
    const railCurve = new THREE.CatmullRomCurve3(railPts);
    const railGeo   = new THREE.TubeGeometry(railCurve, bridgeSegs, 0.04, 6, false);
    const rail      = new THREE.Mesh(railGeo, material);
    rail.name = `railing_${side > 0 ? 'right' : 'left'}`;
    group.add(rail);
  }

  // -------------------------------------------------------------------
  // 3. Portal rings at entry (-Z) and exit (+Z)
  // -------------------------------------------------------------------
  const portalRadius = 2.0 + rng.range(0, 1.0);
  const portalTube   = 0.15;
  const portalGeo    = new THREE.TorusGeometry(portalRadius, portalTube, 16, 48);

  // Entry portal
  const entryPortal = new THREE.Mesh(portalGeo, material);
  entryPortal.position.set(0, portalRadius * 0.5, -halfSpan);
  entryPortal.rotation.x = 0;  // faces along Z
  entryPortal.name = 'portal_entry';
  group.add(entryPortal);

  // Exit portal
  const exitPortal = new THREE.Mesh(portalGeo.clone(), material);
  exitPortal.position.set(0, portalRadius * 0.5, halfSpan);
  exitPortal.rotation.x = 0;
  exitPortal.name = 'portal_exit';
  group.add(exitPortal);

  // Decorative inner rings (smaller, offset)
  for (const zSign of [-1, 1]) {
    const innerR = portalRadius * 0.6;
    const innerGeo = new THREE.TorusGeometry(innerR, portalTube * 0.7, 12, 32);
    const inner = new THREE.Mesh(innerGeo, material);
    inner.position.set(0, portalRadius * 0.5, zSign * (halfSpan - 0.3));
    inner.rotation.x = rng.range(-0.1, 0.1);
    inner.rotation.z = rng.range(0, Math.PI * 2);
    inner.name = `portal_inner_${zSign > 0 ? 'exit' : 'entry'}`;
    group.add(inner);
  }

  return group;
}
