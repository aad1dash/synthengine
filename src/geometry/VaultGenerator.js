/**
 * VaultGenerator — Gothic cross-vault room geometry.
 *
 * Produces a walkable room with a floor at y = 0, arched walls, and a
 * ribbed Gothic cross-vault ceiling.  Height grows with clauseDepth,
 * width/length with scale, and the number of ribs with wordCount.
 *
 * Entrances/exits are centred on the -Z and +Z faces.
 */

import * as THREE from 'three';
import { createRNG } from '../utils/seededRandom.js';

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a pointed-arch curve (two arcs meeting at an apex) in the YZ
 * plane, centred at the origin and spanning `width` along Z.
 * Returns an array of Vector3 points suitable for CatmullRomCurve3.
 */
function pointedArchPoints(width, height, segments = 24) {
  const pts = [];
  const halfW = width / 2;
  // Gothic pointed arch: two circular arcs whose centres sit at the
  // base, offset inward from each edge.
  const radius = Math.sqrt(halfW * halfW + height * height) / (2 * (height / Math.sqrt(halfW * halfW + height * height)));
  const actualRadius = (halfW * halfW + height * height) / (2 * height);
  const centreY = 0;

  // Left arc centre sits at +halfW * 0.3 along Z (shifted inward)
  // Compute start / end angles for each arc so they meet at the apex.
  // For simplicity we use a CatmullRom through sampled parabolic-arch
  // points, which visually reads as a pointed arch.

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;             // 0 … 1
    const z = -halfW + t * width;       // -halfW … +halfW
    // parabolic pointed arch: y = height * (1 - (2z/width)^2)  pushed
    // upward slightly at the centre to get the Gothic point.
    const normZ = (2 * z) / width;      // -1 … 1
    const y = height * (1 - normZ * normZ);
    pts.push(new THREE.Vector3(0, y, z));
  }
  return pts;
}

/**
 * Create a single rib (TubeGeometry) along `curve`.
 */
function createRib(curve, ribRadius, material) {
  const tubeGeo = new THREE.TubeGeometry(curve, 32, ribRadius, 8, false);
  return new THREE.Mesh(tubeGeo, material);
}

/* ------------------------------------------------------------------ */
/*  main generator                                                     */
/* ------------------------------------------------------------------ */

/**
 * @param {object} roomProps
 * @param {number} roomProps.scale       1-5  controls width & length
 * @param {number} roomProps.clauseDepth 0-5  controls ceiling height
 * @param {number} roomProps.wordCount   drives rib count
 * @param {number} roomProps.seed        deterministic seed
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function generate(roomProps, material) {
  const { scale = 2, clauseDepth = 1, wordCount = 10, seed = 1 } = roomProps;
  const rng = createRNG(seed);

  const group = new THREE.Group();
  group.name = 'vault_room';

  // --- dimensions ---------------------------------------------------
  const width  = 4 + scale * 3;          // 7 … 19
  const length = 4 + scale * 3;
  const baseHeight = 3.5;                // minimum ceiling clearance
  const height = baseHeight + clauseDepth * 1.8; // up to ~12.5

  const halfW = width / 2;
  const halfL = length / 2;

  // --- floor --------------------------------------------------------
  const floorGeo = new THREE.PlaneGeometry(width, length);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, material);
  floor.position.set(0, 0, 0);
  floor.name = 'vault_floor';
  group.add(floor);

  // --- walls --------------------------------------------------------
  const wallThickness = 0.35;
  const wallMat = material;

  // Four walls — leave openings centred on ±Z for corridor connections
  const doorWidth = 2.4;
  const doorHeight = Math.min(height * 0.7, 3.2);

  // Helper: add a box wall segment
  function addWall(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  // Left wall (X = -halfW)
  addWall(wallThickness, height, length, -halfW, height / 2, 0);
  // Right wall (X = +halfW)
  addWall(wallThickness, height, length, halfW, height / 2, 0);

  // Back wall (+Z) — two segments flanking the door
  const sidePanelW = (width - doorWidth) / 2;
  addWall(sidePanelW, height, wallThickness,
    -halfW + sidePanelW / 2, height / 2, halfL);
  addWall(sidePanelW, height, wallThickness,
    halfW - sidePanelW / 2, height / 2, halfL);
  // Lintel above door
  addWall(doorWidth, height - doorHeight, wallThickness,
    0, doorHeight + (height - doorHeight) / 2, halfL);

  // Front wall (-Z) — same opening
  addWall(sidePanelW, height, wallThickness,
    -halfW + sidePanelW / 2, height / 2, -halfL);
  addWall(sidePanelW, height, wallThickness,
    halfW - sidePanelW / 2, height / 2, -halfL);
  addWall(doorWidth, height - doorHeight, wallThickness,
    0, doorHeight + (height - doorHeight) / 2, -halfL);

  // --- ribbed cross-vault ceiling -----------------------------------
  const ribCount = Math.max(2, Math.min(12, Math.floor(wordCount / 3)));
  const ribRadius = 0.08 + rng.range(0, 0.04);

  // Transverse ribs (span width, distributed along length)
  for (let i = 0; i < ribCount; i++) {
    const t = (i + 0.5) / ribCount;
    const zPos = -halfL + t * length;
    const archPts = pointedArchPoints(width, height).map(
      p => new THREE.Vector3(p.z, p.y + height * 0.02, zPos)
    );
    const curve = new THREE.CatmullRomCurve3(archPts);
    const rib = createRib(curve, ribRadius, material);
    rib.name = `transverse_rib_${i}`;
    group.add(rib);
  }

  // Longitudinal ribs (span length, distributed along width)
  const longRibCount = Math.max(2, Math.floor(ribCount / 2));
  for (let i = 0; i < longRibCount; i++) {
    const t = (i + 0.5) / longRibCount;
    const xPos = -halfW + t * width;
    const archPts = pointedArchPoints(length, height).map(
      p => new THREE.Vector3(xPos, p.y + height * 0.02, p.z)
    );
    const curve = new THREE.CatmullRomCurve3(archPts);
    const rib = createRib(curve, ribRadius, material);
    rib.name = `longitudinal_rib_${i}`;
    group.add(rib);
  }

  // Diagonal ribs (cross pattern from corner to corner)
  const diagonals = [
    [new THREE.Vector3(-halfW, 0, -halfL), new THREE.Vector3(halfW, 0, halfL)],
    [new THREE.Vector3(halfW, 0, -halfL), new THREE.Vector3(-halfW, 0, halfL)],
  ];
  for (const [start, end] of diagonals) {
    const diagLen = start.distanceTo(end);
    const pts = [];
    const segments = 28;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = start.x + (end.x - start.x) * t;
      const z = start.z + (end.z - start.z) * t;
      // arch envelope
      const normT = 2 * t - 1; // -1 … 1
      const y = height * (1 - normT * normT) + height * 0.02;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const rib = createRib(curve, ribRadius * 1.2, material);
    rib.name = 'diagonal_rib';
    group.add(rib);
  }

  // --- ceiling surface (thin box capping the vault) -----------------
  // Approximate with a subdivided plane displaced to follow the vault.
  const ceilSeg = 24;
  const ceilGeo = new THREE.PlaneGeometry(width, length, ceilSeg, ceilSeg);
  const posAttr = ceilGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getY(i); // PlaneGeometry XY; we'll rotate later
    const normX = (2 * x) / width;
    const normZ = (2 * z) / length;
    const env = 1 - Math.max(normX * normX, normZ * normZ);
    const y = height * Math.max(0, env);
    posAttr.setZ(i, y);
  }
  ceilGeo.computeVertexNormals();
  const ceilMesh = new THREE.Mesh(ceilGeo, material);
  ceilMesh.rotation.x = -Math.PI / 2;
  ceilMesh.name = 'vault_ceiling';
  group.add(ceilMesh);

  // --- decorative column stubs at corners ---------------------------
  const colRadius = 0.25 + rng.range(0, 0.1);
  const colHeight = height * 0.35;
  const colGeo = new THREE.CylinderGeometry(colRadius, colRadius * 1.15, colHeight, 8);
  const corners = [
    [-halfW + colRadius, 0, -halfL + colRadius],
    [halfW - colRadius, 0, -halfL + colRadius],
    [-halfW + colRadius, 0, halfL - colRadius],
    [halfW - colRadius, 0, halfL - colRadius],
  ];
  corners.forEach(([cx, , cz], idx) => {
    const col = new THREE.Mesh(colGeo, material);
    col.position.set(cx, colHeight / 2, cz);
    col.name = `column_${idx}`;
    group.add(col);
  });

  return group;
}
