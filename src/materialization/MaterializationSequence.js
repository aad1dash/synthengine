/**
 * The 3-5 second world-building animation when "Materialize" is pressed.
 *
 * Sequence:
 * 1. Void fills with dust particles (0-1s)
 * 2. Particle streams converge toward room positions (1-2s)
 * 3. Geometry crystallizes from particle clouds (2-3.5s)
 * 4. Materials propagate — color floods surfaces, lights ignite (3-4s)
 * 5. Audio fades in (3.5-5s)
 * 6. Camera settles into first-person position inside Room 0
 */
import * as THREE from 'three';
import { createRNG } from '../utils/seededRandom.js';
import { lerp, smoothstep } from '../utils/math.js';

const TOTAL_DURATION = 4.5;
const PARTICLE_COUNT = 3000;

export class MaterializationSequence {
  constructor(scene, camera, worldGraph, onComplete) {
    this.scene = scene;
    this.camera = camera;
    this.worldGraph = worldGraph;
    this.onComplete = onComplete;

    this.elapsed = 0;
    this.active = false;
    this.particles = null;
    this.roomMeshes = []; // set externally
    this.rng = createRNG(worldGraph.fingerprint.masterHash);
  }

  /** Store references to room meshes that need to animate in */
  setRoomMeshes(meshes) {
    this.roomMeshes = meshes;
    // Initially hide all room meshes
    for (const mesh of meshes) {
      mesh.visible = false;
      mesh.scale.set(0.01, 0.01, 0.01);
    }
  }

  start() {
    this.active = true;
    this.elapsed = 0;
    this._createParticles();

    // Start camera far out, looking at first room
    const room0 = this.worldGraph.rooms[0];
    if (room0) {
      this.camera.position.set(
        room0.position.x,
        30,
        room0.position.z - 20
      );
      this.camera.lookAt(room0.position.x, 0, room0.position.z);
    }
  }

  _createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const targets = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    const rooms = this.worldGraph.rooms;
    const rng = this.rng;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Start scattered in a large sphere
      const theta = rng.range(0, Math.PI * 2);
      const phi = rng.range(0, Math.PI);
      const r = rng.range(30, 80);
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.cos(phi);
      positions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Target: converge to a room position
      const targetRoom = rooms[rng.intRange(0, Math.max(0, rooms.length - 1))];
      targets[i3] = targetRoom.position.x + rng.range(-3, 3);
      targets[i3 + 1] = rng.range(0, 4);
      targets[i3 + 2] = targetRoom.position.z + rng.range(-3, 3);

      // Color: white-blue-purple spectrum
      colors[i3] = 0.6 + rng.range(0, 0.4);
      colors[i3 + 1] = 0.6 + rng.range(0, 0.3);
      colors[i3 + 2] = 0.8 + rng.range(0, 0.2);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Store targets as custom attribute
    geometry.userData.targets = targets;
    geometry.userData.starts = new Float32Array(positions);

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  update(dt) {
    if (!this.active) return false;

    this.elapsed += dt;
    const t = this.elapsed / TOTAL_DURATION;

    if (t >= 1) {
      this._finish();
      return false;
    }

    // Phase 1: Particles fade in (0-0.2)
    if (this.particles) {
      const fadeIn = smoothstep(0, 0.15, t);
      const fadeOut = 1 - smoothstep(0.65, 0.85, t);
      this.particles.material.opacity = fadeIn * fadeOut * 0.8;

      // Phase 2: Particles converge (0.1-0.5)
      const converge = smoothstep(0.1, 0.55, t);
      const positions = this.particles.geometry.attributes.position.array;
      const starts = this.particles.geometry.userData.starts;
      const targets = this.particles.geometry.userData.targets;
      for (let i = 0; i < positions.length; i++) {
        positions[i] = lerp(starts[i], targets[i], converge);
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    // Phase 3: Geometry crystallizes (0.4-0.8)
    const crystallize = smoothstep(0.4, 0.8, t);
    for (const mesh of this.roomMeshes) {
      mesh.visible = crystallize > 0.01;
      const s = crystallize;
      mesh.scale.set(s, s, s);
    }

    // Phase 4: Camera settles (0.6-1.0)
    const settle = smoothstep(0.6, 1.0, t);
    const room0 = this.worldGraph.rooms[0];
    if (room0) {
      const targetY = 1.7;
      const startY = 30;
      const startZ = room0.position.z - 20;
      const targetZ = room0.position.z;
      this.camera.position.set(
        room0.position.x,
        lerp(startY, targetY, settle),
        lerp(startZ, targetZ, settle)
      );
      if (settle < 0.9) {
        this.camera.lookAt(room0.position.x, 0, room0.position.z);
      }
    }

    return true; // still active
  }

  _finish() {
    this.active = false;

    // Remove particles
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }

    // Ensure all meshes visible at full scale
    for (const mesh of this.roomMeshes) {
      mesh.visible = true;
      mesh.scale.set(1, 1, 1);
    }

    this.onComplete?.();
  }

  isActive() {
    return this.active;
  }

  dispose() {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }
  }
}
