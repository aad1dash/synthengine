/**
 * MaterialSystem — creates Three.js materials driven by text-analysis data
 * (sentiment, lexical richness, arousal, etc.).
 *
 * Colour mapping (hue from sentiment valence):
 *   anger   (valence < -3)    → hue   0° crimson
 *   sadness (-3  to -1)       → hue 240° indigo
 *   neutral (-1  to  1)       → hue 180° teal
 *   joy     ( 1  to  3)       → hue  45° gold
 *   ecstasy ( >  3)           → hue  30° orange
 *
 * Arousal      → saturation  (0.3 – 0.9)
 * typeTokenRatio → roughness  (low TTR 0.1 → high TTR 0.7)
 * typeTokenRatio → metalness  (low TTR 0.8 → high TTR 0.2)
 */

import * as THREE from 'three';
import { clamp, mapRange } from '../utils/math.js';

// ---------------------------------------------------------------------------
// Inline shader sources — imported as raw strings via Vite's ?raw suffix
// ---------------------------------------------------------------------------
import nebulaVert from './shaders/nebula.vert?raw';
import nebulaFrag from './shaders/nebula.frag?raw';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a sentiment valence value to a hue (degrees).
 * Uses the five-band mapping described above, with linear interpolation
 * inside the sadness and joy bands to avoid hard seams.
 */
function valenceToHue(valence) {
  if (valence < -3) return 0;          // anger → crimson
  if (valence < -1) {
    // sadness band: lerp from 0° (at -3) to 240° (at -1)
    const t = (valence - (-3)) / ((-1) - (-3)); // 0→1
    return t * 240;
  }
  if (valence <= 1) return 180;         // neutral → teal
  if (valence <= 3) {
    // joy band: lerp from 180° (at 1) to 45° (at 3)
    const t = (valence - 1) / (3 - 1);
    return 180 + t * (45 - 180);        // 180 → 45
  }
  return 30;                            // ecstasy → orange
}

/**
 * Build a THREE.Color from a sentiment profile.
 *  - hue   from valence
 *  - saturation from arousal (mapped 0→1  ⇒  0.3→0.9)
 *  - lightness fixed at 0.5 for vivid colours
 */
function sentimentToColor(valence, arousal) {
  const hue = valenceToHue(valence) / 360;   // THREE.Color expects 0-1
  const sat = clamp(mapRange(arousal, 0, 1, 0.3, 0.9), 0.3, 0.9);
  const col = new THREE.Color();
  col.setHSL(hue, sat, 0.5);
  return col;
}

/**
 * Approximate correlated colour temperature (Kelvin) to an RGB THREE.Color.
 * Based on Tanner Helland's algorithm, good for 1000 K – 40 000 K.
 */
function colorTemperature(kelvin) {
  const temp = clamp(kelvin, 1000, 40000) / 100;
  let r, g, b;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
  }

  // Green
  if (temp <= 66) {
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }

  return new THREE.Color(
    clamp(r / 255, 0, 1),
    clamp(g / 255, 0, 1),
    clamp(b / 255, 0, 1),
  );
}

// ---------------------------------------------------------------------------
// MaterialSystem
// ---------------------------------------------------------------------------

export class MaterialSystem {
  constructor() {
    /** @type {Map<string, THREE.Material>} keyed by a deterministic cache key */
    this._cache = new Map();

    /** @type {THREE.Light[]} lights created by setupLighting */
    this._lights = [];
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Create a room surface material from analysis data attached to a room node.
   *
   * Expected properties on `roomNode`:
   *   roomNode.sentiment.valence   – number (roughly -5 … +5)
   *   roomNode.sentiment.arousal   – number (0 … 1)
   *   roomNode.lexical.typeTokenRatio – number (0 … 1)
   *
   * @param {object} roomNode
   * @returns {THREE.MeshStandardMaterial}
   */
  createRoomMaterial(roomNode) {
    const valence = roomNode?.valence ?? roomNode?.sentiment?.valence ?? 0;
    const arousal = roomNode?.arousal ?? roomNode?.sentiment?.arousal ?? 0.5;
    const ttr     = roomNode?.typeTokenRatio ?? roomNode?.lexical?.typeTokenRatio ?? 0.5;

    const key = `room_${valence.toFixed(3)}_${arousal.toFixed(3)}_${ttr.toFixed(3)}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const color     = sentimentToColor(valence, arousal);
    const roughness = clamp(mapRange(ttr, 0, 1, 0.1, 0.7), 0.1, 0.7);
    const metalness = clamp(mapRange(ttr, 0, 1, 0.8, 0.2), 0.2, 0.8);

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      side: THREE.DoubleSide,
      envMapIntensity: 1.0,
    });

    this._cache.set(key, mat);
    return mat;
  }

  /**
   * Create a ShaderMaterial for void / nebula regions, using the nebula
   * vertex + fragment shaders.
   *
   * Expected properties on `voidNode`:
   *   voidNode.sentiment.valence
   *   voidNode.sentiment.arousal
   *
   * @param {object} voidNode
   * @returns {THREE.ShaderMaterial}
   */
  createVoidMaterial(voidNode) {
    const nebulaHue = voidNode?.nebulaHue ?? 180;
    const particleDensity = voidNode?.particleDensity ?? 0.5;

    const key = `void_${nebulaHue.toFixed(1)}_${particleDensity.toFixed(2)}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const baseColor = new THREE.Color();
    baseColor.setHSL(nebulaHue / 360, 0.6, 0.5);

    const mat = new THREE.ShaderMaterial({
      vertexShader: nebulaVert,
      fragmentShader: nebulaFrag,
      uniforms: {
        uTime:       { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Stash base color so callers can build per-particle color attributes
    mat.userData.baseColor = baseColor;

    this._cache.set(key, mat);
    return mat;
  }

  /**
   * Create a crystal material with physical transmission / refraction.
   *
   * @param {object} roomNode
   * @returns {THREE.MeshPhysicalMaterial}
   */
  createCrystalMaterial(roomNode) {
    const valence = roomNode?.valence ?? roomNode?.sentiment?.valence ?? 0;
    const arousal = roomNode?.arousal ?? roomNode?.sentiment?.arousal ?? 0.5;

    const key = `crystal_${valence.toFixed(3)}_${arousal.toFixed(3)}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const color = sentimentToColor(valence, arousal);

    const mat = new THREE.MeshPhysicalMaterial({
      color,
      transmission: 0.8,
      thickness: 1.5,
      roughness: 0.05,
      metalness: 0.0,
      ior: 2.0,
      reflectivity: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
      transparent: true,
    });

    this._cache.set(key, mat);
    return mat;
  }

  /**
   * Create a pillar / landmark material. Frequency drives brightness.
   *
   * @param {number} frequency  0–1 normalised word frequency
   * @returns {THREE.MeshStandardMaterial}
   */
  createPillarMaterial(frequency = 0.5) {
    const f = clamp(frequency, 0, 1);
    const key = `pillar_${f.toFixed(3)}`;
    if (this._cache.has(key)) return this._cache.get(key);

    // Frequency controls luminance — common words glow brighter.
    const lightness = mapRange(f, 0, 1, 0.25, 0.7);
    const color = new THREE.Color();
    color.setHSL(0.08, 0.6, lightness);   // warm amber family

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.6,
      emissive: color.clone().multiplyScalar(0.15),
      emissiveIntensity: mapRange(f, 0, 1, 0.2, 1.0),
    });

    this._cache.set(key, mat);
    return mat;
  }

  /**
   * Create a floating crystal landmark material — highly refractive &
   * emissive gem look.
   *
   * @returns {THREE.MeshPhysicalMaterial}
   */
  createFloatingCrystalMaterial() {
    const key = 'floatingCrystal';
    if (this._cache.has(key)) return this._cache.get(key);

    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.65, 0.85, 1.0),   // pale ice-blue
      transmission: 0.9,
      thickness: 2.0,
      roughness: 0.02,
      metalness: 0.0,
      ior: 2.4,
      reflectivity: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      emissive: new THREE.Color(0.15, 0.25, 0.45),
      emissiveIntensity: 0.6,
      envMapIntensity: 2.0,
      transparent: true,
      side: THREE.DoubleSide,
    });

    this._cache.set(key, mat);
    return mat;
  }

  // -----------------------------------------------------------------------
  // Lighting
  // -----------------------------------------------------------------------

  /**
   * Populate a scene with lights tuned to the overall sentiment profile.
   *
   * @param {THREE.Scene} scene
   * @param {{ valence: number, arousal: number }} sentimentProfile
   */
  setupLighting(scene, sentimentProfile) {
    // Remove any lights we previously added
    this._clearLights(scene);

    const valence = sentimentProfile?.valence ?? 0;
    const arousal = sentimentProfile?.arousal ?? 0.5;

    // --- Always: subtle ambient so nothing is fully black ---
    const ambient = new THREE.AmbientLight(0x222233, 0.3);
    this._addLight(scene, ambient);

    if (valence > 1) {
      // ------ Positive: warm point lights + volumetric feel ------
      const warmColor = colorTemperature(3000);

      const key = new THREE.PointLight(warmColor, 1.2, 60, 1.5);
      key.position.set(3, 5, 2);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      this._addLight(scene, key);

      const fill = new THREE.PointLight(warmColor.clone().multiplyScalar(0.8), 0.6, 40, 2);
      fill.position.set(-4, 3, -3);
      this._addLight(scene, fill);

      // Warm hemisphere
      const hemi = new THREE.HemisphereLight(warmColor, 0x0a0a18, 0.35);
      this._addLight(scene, hemi);

    } else if (valence < -1) {
      // ------ Negative: cool ambient + heavy shadows ------
      const coolColor = colorTemperature(8000);

      const dir = new THREE.DirectionalLight(coolColor, 0.9);
      dir.position.set(-2, 8, -4);
      dir.castShadow = true;
      dir.shadow.mapSize.set(2048, 2048);
      dir.shadow.camera.near = 0.5;
      dir.shadow.camera.far = 50;
      dir.shadow.bias = -0.001;
      this._addLight(scene, dir);

      // Cold hemisphere
      const hemi = new THREE.HemisphereLight(0x3344aa, 0x000011, 0.25);
      this._addLight(scene, hemi);

    } else {
      // ------ Neutral: ethereal soft light + fog-like bloom ------
      const soft = new THREE.HemisphereLight(0x88aacc, 0x223344, 0.55);
      this._addLight(scene, soft);

      const point = new THREE.PointLight(0xaaddff, 0.5, 50, 2);
      point.position.set(0, 6, 0);
      this._addLight(scene, point);
    }

    // --- Arousal modulates overall intensity ---
    const intensityScale = mapRange(arousal, 0, 1, 0.7, 1.3);
    for (const light of this._lights) {
      if (light.intensity !== undefined) {
        light.intensity *= intensityScale;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Fog
  // -----------------------------------------------------------------------

  /**
   * Return fog configuration matching the sentiment profile.
   *
   * @param {{ valence: number, arousal: number }} sentimentProfile
   * @returns {{ color: THREE.Color, near: number, far: number }}
   */
  getFogSettings(sentimentProfile) {
    const valence = sentimentProfile?.valence ?? 0;
    const arousal = sentimentProfile?.arousal ?? 0.5;

    let color;
    if (valence > 1) {
      color = new THREE.Color(0x1a0f05);      // warm dark amber
    } else if (valence < -1) {
      color = new THREE.Color(0x050810);      // deep cold navy
    } else {
      color = new THREE.Color(0x0a0e14);      // muted slate
    }

    // High arousal → shorter fog range (closer, denser)
    const near = mapRange(arousal, 0, 1, 5, 1);
    const far  = mapRange(arousal, 0, 1, 80, 40);

    return { color, near, far };
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /**
   * Dispose every cached material and clear internal state.
   */
  dispose() {
    for (const mat of this._cache.values()) {
      mat.dispose();
    }
    this._cache.clear();
    // Lights are scene-owned; we just drop our references.
    this._lights.length = 0;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /** @private */
  _addLight(scene, light) {
    scene.add(light);
    this._lights.push(light);
  }

  /** @private */
  _clearLights(scene) {
    for (const light of this._lights) {
      scene.remove(light);
      if (light.dispose) light.dispose();
    }
    this._lights.length = 0;
  }
}
