/**
 * CrystalGenerator — Jagged crystalline polyhedra room.
 *
 * Produces a central crystal cluster (vertex-displaced icosahedron) and
 * surrounding smaller crystals at deterministic positions.  Face detail
 * is driven by consonantDensity.
 *
 * The floor sits at y = 0.  Entrances/exits on the +/-Z axis.
 */

import * as THREE from 'three';
import { createRNG } from '../utils/seededRandom.js';

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Return an IcosahedronGeometry whose vertices have been randomly
 * displaced outward / inward for a jagged crystal look.
 */
function displacedIcosahedron(radius, detail, rng, displaceFactor = 0.35) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const len = v.length();
    const offset = 1 + (rng.range(-displaceFactor, displaceFactor));
    v.setLength(len * offset);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/*  main generator                                                     */
/* ------------------------------------------------------------------ */

/**
 * @param {object} roomProps
 * @param {number} roomProps.scale           1-5
 * @param {number} roomProps.consonantDensity 0-1
 * @param {number} roomProps.seed
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function generate(roomProps, material) {
  const { scale = 2, consonantDensity = 0.5, seed = 1 } = roomProps;
  const rng = createRNG(seed);

  const group = new THREE.Group();
  group.name = 'crystal_room';

  // --- dimensions ---------------------------------------------------
  const roomRadius = 4 + scale * 2.5;    // 6.5 … 16.5
  const height = 4 + scale * 1.5;        // min ceiling ~5.5

  // --- floor --------------------------------------------------------
  const floorGeo = new THREE.CircleGeometry(roomRadius, 32);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, material);
  floor.position.y = 0;
  floor.name = 'crystal_floor';
  group.add(floor);

  // --- central crystal cluster --------------------------------------
  // detail level (face count proxy) driven by consonantDensity: 0-1 → 0-2
  const detail = Math.round(consonantDensity * 2);
  const centralRadius = 1.2 + scale * 0.6;
  const centralGeo = displacedIcosahedron(centralRadius, detail, rng, 0.4);
  const centralMesh = new THREE.Mesh(centralGeo, material);
  // Raise so it sits above the floor, partially embedded
  centralMesh.position.set(0, centralRadius * 0.7, 0);
  centralMesh.name = 'central_crystal';
  group.add(centralMesh);

  // --- surrounding smaller crystals ---------------------------------
  const count = 6 + Math.floor(consonantDensity * 10);  // 6 … 16
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist  = rng.range(roomRadius * 0.25, roomRadius * 0.8);
    const r     = rng.range(0.3, 1.0 + scale * 0.3);
    const d     = Math.round(rng.range(0, 1) * detail);

    const geo  = displacedIcosahedron(r, d, rng, 0.5);
    const mesh = new THREE.Mesh(geo, material);

    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    // Some crystals jut from the floor, some float slightly
    const baseY = rng.range(0, r * 0.5);
    mesh.position.set(x, r * 0.6 + baseY, z);

    // Random rotation for variety
    mesh.rotation.set(
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
      rng.range(0, Math.PI)
    );

    mesh.name = `crystal_${i}`;
    group.add(mesh);
  }

  // --- rough ceiling crystals (stalactite-like) ---------------------
  const ceilCount = 4 + Math.floor(consonantDensity * 6);
  for (let i = 0; i < ceilCount; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist  = rng.range(0, roomRadius * 0.6);
    const r     = rng.range(0.4, 1.2);

    const geo  = displacedIcosahedron(r, 0, rng, 0.6);
    const mesh = new THREE.Mesh(geo, material);

    mesh.position.set(
      Math.cos(angle) * dist,
      height - r * 0.4,
      Math.sin(angle) * dist
    );
    mesh.rotation.set(rng.range(0, Math.PI), rng.range(0, Math.PI), 0);
    mesh.name = `stalactite_${i}`;
    group.add(mesh);
  }

  // --- enclosure walls (jagged crystal ring) ------------------------
  const wallSegments = 16;
  for (let i = 0; i < wallSegments; i++) {
    const angle = (i / wallSegments) * Math.PI * 2;
    const nextAngle = ((i + 1) / wallSegments) * Math.PI * 2;

    // Skip segments near ±Z to leave entrance/exit openings
    const midAngle = (angle + nextAngle) / 2;
    const absZ = Math.abs(Math.cos(midAngle));
    const absX = Math.abs(Math.sin(midAngle));
    if (absZ > 0.85 && absX < 0.55) continue; // opening on ±Z axis

    const segW = rng.range(0.6, 1.4);
    const segH = rng.range(height * 0.6, height * 1.1);
    const segD = rng.range(0.3, 0.8);

    const geo  = new THREE.BoxGeometry(segW, segH, segD);
    const mesh = new THREE.Mesh(geo, material);

    const x = Math.sin(angle) * roomRadius;
    const z = Math.cos(angle) * roomRadius;
    mesh.position.set(x, segH / 2, z);
    mesh.rotation.y = -angle;
    mesh.name = `wall_seg_${i}`;
    group.add(mesh);
  }

  return group;
}
