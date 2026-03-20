/**
 * CorridorGenerator — Narrow connecting passage.
 *
 * Produces a tunnel-like corridor that runs primarily along the Z axis,
 * with an optional gentle lateral curve.  Width is driven by wordCount,
 * length by scale.  Floor at y = 0, ceiling at least 3 units.
 *
 * Entrance at -Z, exit at +Z (possibly offset by curve).
 */

import * as THREE from 'three';
import { createRNG } from '../utils/seededRandom.js';

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build the central spine curve of the corridor.
 * Curves gently in XZ according to curveAngle.
 */
function buildSpineCurve(length, curveAngle, segments = 32) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;           // 0 … 1
    const z = -length / 2 + t * length;
    // lateral offset: sine curve scaled by the total curveAngle
    const x = Math.sin(t * Math.PI) * Math.tan(curveAngle) * (length / 4);
    pts.push(new THREE.Vector3(x, 0, z));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/* ------------------------------------------------------------------ */
/*  main generator                                                     */
/* ------------------------------------------------------------------ */

/**
 * @param {object} roomProps
 * @param {number} roomProps.scale      1-5 controls length
 * @param {number} roomProps.wordCount  fewer words = narrower
 * @param {number} roomProps.seed
 * @param {number} roomProps.curveAngle radians, lateral curve
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function generate(roomProps, material) {
  const { scale = 2, wordCount = 6, seed = 1, curveAngle = 0 } = roomProps;
  const rng = createRNG(seed);

  const group = new THREE.Group();
  group.name = 'corridor';

  // --- dimensions ---------------------------------------------------
  const corridorLength = 6 + scale * 4;               // 10 … 26
  const corridorWidth  = Math.max(1.8, 1.0 + wordCount * 0.15); // >=1.8
  const corridorHeight = 3.0 + rng.range(0, 1.0);     // 3 … 4

  const halfW = corridorWidth / 2;
  const spineSegments = 48;

  // Build spine
  const spine = buildSpineCurve(corridorLength, curveAngle, spineSegments);

  // --- floor --------------------------------------------------------
  // We extrude a flat ribbon along the spine.
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-halfW, 0);
  floorShape.lineTo(halfW, 0);

  // Sample spine to build a series of floor quads
  const floorGeo = new THREE.PlaneGeometry(
    corridorWidth, corridorLength, 1, spineSegments
  );
  const floorPos = floorGeo.attributes.position;

  for (let i = 0; i <= spineSegments; i++) {
    const t = i / spineSegments;
    const pt = spine.getPointAt(t);
    const tangent = spine.getTangentAt(t).normalize();
    // perpendicular in XZ plane
    const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);

    // Two vertices per row (left, right) — PlaneGeometry has
    // (segW+1) * (segH+1) vertices, row-major.
    const leftIdx  = i * 2;
    const rightIdx = i * 2 + 1;

    const left  = pt.clone().add(perp.clone().multiplyScalar(-halfW));
    const right = pt.clone().add(perp.clone().multiplyScalar(halfW));

    floorPos.setXYZ(leftIdx,  left.x,  0, left.z);
    floorPos.setXYZ(rightIdx, right.x, 0, right.z);
  }
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, material);
  floor.name = 'corridor_floor';
  group.add(floor);

  // --- walls & ceiling via tube-like extrusion ----------------------
  // Build an arch cross-section shape (half-ellipse + vertical sides)
  // and sweep it along the spine using TubeGeometry-like manual
  // construction.  For simplicity we use discrete box segments.

  const segCount = spineSegments;
  const segLength = corridorLength / segCount;

  for (let i = 0; i < segCount; i++) {
    const t0 = i / segCount;
    const t1 = (i + 1) / segCount;
    const p0 = spine.getPointAt(t0);
    const p1 = spine.getPointAt(t1);
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const tangent = spine.getTangentAt((t0 + t1) / 2).normalize();
    const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);

    const actualSegLen = p0.distanceTo(p1);

    // Left wall
    const lwGeo = new THREE.BoxGeometry(0.2, corridorHeight, actualSegLen);
    const lw = new THREE.Mesh(lwGeo, material);
    const lwPos = mid.clone().add(perp.clone().multiplyScalar(-halfW));
    lw.position.set(lwPos.x, corridorHeight / 2, lwPos.z);
    lw.lookAt(lw.position.clone().add(tangent));
    lw.name = `lwall_${i}`;
    group.add(lw);

    // Right wall
    const rwGeo = new THREE.BoxGeometry(0.2, corridorHeight, actualSegLen);
    const rw = new THREE.Mesh(rwGeo, material);
    const rwPos = mid.clone().add(perp.clone().multiplyScalar(halfW));
    rw.position.set(rwPos.x, corridorHeight / 2, rwPos.z);
    rw.lookAt(rw.position.clone().add(tangent));
    rw.name = `rwall_${i}`;
    group.add(rw);

    // Ceiling
    const cGeo = new THREE.BoxGeometry(corridorWidth + 0.2, 0.2, actualSegLen);
    const c = new THREE.Mesh(cGeo, material);
    c.position.set(mid.x, corridorHeight, mid.z);
    c.lookAt(c.position.clone().add(tangent));
    c.name = `ceil_${i}`;
    group.add(c);
  }

  // --- arch ceiling ribs (decorative) --------------------------------
  const ribCount = Math.max(2, Math.floor(corridorLength / 3));
  for (let i = 0; i < ribCount; i++) {
    const t = (i + 0.5) / ribCount;
    const pt = spine.getPointAt(t);
    const tangent = spine.getTangentAt(t).normalize();
    const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);

    // Semi-circular arch across the width at this station
    const archPts = [];
    const archSegs = 12;
    for (let j = 0; j <= archSegs; j++) {
      const a = (j / archSegs) * Math.PI;
      const lx = Math.cos(a) * halfW;
      const ly = corridorHeight * 0.5 + Math.sin(a) * corridorHeight * 0.5;
      const pos = pt.clone()
        .add(perp.clone().multiplyScalar(lx));
      pos.y = ly;
      archPts.push(pos);
    }

    const archCurve = new THREE.CatmullRomCurve3(archPts);
    const ribGeo = new THREE.TubeGeometry(archCurve, 12, 0.06, 6, false);
    const rib = new THREE.Mesh(ribGeo, material);
    rib.name = `corridor_rib_${i}`;
    group.add(rib);
  }

  return group;
}
