/**
 * DomeGenerator — Smooth domed room with an oculus.
 *
 * Produces a half-sphere dome with a floor at y = 0, interior curved
 * walls, and a circular opening (oculus) at the apex.  Subdivision is
 * driven by wordCount for smooth flowing geometry.
 *
 * Entrances/exits are cut on the ±Z faces.
 */

import * as THREE from 'three';
import { createRNG } from '../utils/seededRandom.js';

/* ------------------------------------------------------------------ */
/*  main generator                                                     */
/* ------------------------------------------------------------------ */

/**
 * @param {object} roomProps
 * @param {number} roomProps.scale     1-5
 * @param {number} roomProps.wordCount drives subdivision
 * @param {number} roomProps.seed
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function generate(roomProps, material) {
  const { scale = 2, wordCount = 10, seed = 1 } = roomProps;
  const rng = createRNG(seed);

  const group = new THREE.Group();
  group.name = 'dome_room';

  // --- dimensions ---------------------------------------------------
  const radius    = 4 + scale * 3;                  // 7 … 19
  const height    = radius;                          // hemisphere
  const widthSeg  = Math.max(16, Math.min(64, wordCount * 2));
  const heightSeg = Math.max(8, Math.min(32, wordCount));

  // --- floor --------------------------------------------------------
  const floorGeo = new THREE.CircleGeometry(radius, widthSeg);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, material);
  floor.position.y = 0;
  floor.name = 'dome_floor';
  group.add(floor);

  // --- dome shell ---------------------------------------------------
  // SphereGeometry upper hemisphere with an oculus carved out by
  // limiting phiStart/phiLength or, more simply, by restricting the
  // theta range so the very top is open.
  const oculusRatio = 0.08 + rng.range(0, 0.06);  // 8-14 % of radius
  const oculusAngle = Math.asin(oculusRatio);       // small angle at top

  // thetaStart from the top opening down to the equator
  const domeGeo = new THREE.SphereGeometry(
    radius,
    widthSeg,
    heightSeg,
    0,                              // phiStart
    Math.PI * 2,                    // phiLength  (full revolution)
    oculusAngle,                    // thetaStart (skip top for oculus)
    Math.PI / 2 - oculusAngle      // thetaLength (down to equator)
  );

  // Flip normals so interior is visible
  domeGeo.scale(1, 1, 1);
  // We want to see from inside, so we add a double-sided material
  // approach: duplicate with inverted normals.
  const domeInner = new THREE.Mesh(domeGeo, material);
  domeInner.name = 'dome_shell_outer';
  group.add(domeInner);

  const innerGeo = domeGeo.clone();
  // Invert normals for inner surface
  const normalAttr = innerGeo.attributes.normal;
  for (let i = 0; i < normalAttr.count; i++) {
    normalAttr.setX(i, -normalAttr.getX(i));
    normalAttr.setY(i, -normalAttr.getY(i));
    normalAttr.setZ(i, -normalAttr.getZ(i));
  }
  // Reverse face winding
  const idx = innerGeo.index;
  if (idx) {
    const arr = idx.array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i];
      arr[i] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    idx.needsUpdate = true;
  }
  const domeInnerMesh = new THREE.Mesh(innerGeo, material);
  domeInnerMesh.name = 'dome_shell_inner';
  group.add(domeInnerMesh);

  // --- oculus ring ---------------------------------------------------
  const oculusRadius = radius * oculusRatio;
  const ringGeo = new THREE.TorusGeometry(oculusRadius, 0.15, 8, widthSeg);
  const ring = new THREE.Mesh(ringGeo, material);
  ring.position.set(0, radius * Math.cos(oculusAngle), 0);
  ring.rotation.x = Math.PI / 2;
  ring.name = 'dome_oculus_ring';
  group.add(ring);

  // --- entrance / exit arches on ±Z --------------------------------
  const doorWidth  = 2.4;
  const doorHeight = Math.min(3.2, height * 0.5);
  const archDepth  = 0.5;

  function addArch(zSign) {
    // Position at the equator of the dome on ±Z
    const zPos = zSign * (radius - archDepth / 2);

    // Simple arch frame: two pillars + a curved top
    const pillarH = doorHeight * 0.75;
    const pillarGeo = new THREE.BoxGeometry(0.3, pillarH, archDepth);

    const leftPillar = new THREE.Mesh(pillarGeo, material);
    leftPillar.position.set(-doorWidth / 2, pillarH / 2, zPos);
    group.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, material);
    rightPillar.position.set(doorWidth / 2, pillarH / 2, zPos);
    group.add(rightPillar);

    // Arch curve above the door
    const archPts = [];
    const segs = 16;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const angle = Math.PI * t;
      const x = (doorWidth / 2) * Math.cos(angle);
      const y = pillarH + (doorHeight - pillarH) * Math.sin(angle);
      archPts.push(new THREE.Vector3(x, y, zPos));
    }
    const archCurve = new THREE.CatmullRomCurve3(archPts);
    const archGeo   = new THREE.TubeGeometry(archCurve, 16, 0.15, 8, false);
    const archMesh  = new THREE.Mesh(archGeo, material);
    archMesh.name = `dome_arch_${zSign > 0 ? 'back' : 'front'}`;
    group.add(archMesh);
  }

  addArch(1);
  addArch(-1);

  // --- decorative interior ribs (meridian lines) --------------------
  const ribCount = Math.max(4, Math.min(16, Math.floor(wordCount / 2)));
  for (let i = 0; i < ribCount; i++) {
    const phi = (i / ribCount) * Math.PI * 2;
    const pts = [];
    const segs = 24;
    for (let j = 0; j <= segs; j++) {
      const theta = oculusAngle + (Math.PI / 2 - oculusAngle) * (j / segs);
      const x = radius * Math.sin(theta) * Math.sin(phi);
      const y = radius * Math.cos(theta);
      const z = radius * Math.sin(theta) * Math.cos(phi);
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const ribGeo = new THREE.TubeGeometry(curve, 20, 0.06, 6, false);
    const rib = new THREE.Mesh(ribGeo, material);
    rib.name = `dome_rib_${i}`;
    group.add(rib);
  }

  return group;
}
