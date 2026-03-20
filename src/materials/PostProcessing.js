/**
 * PostProcessing — configures Three.js EffectComposer with bloom and
 * output passes, tuned by the overall sentiment profile.
 *
 * Bloom behaviour:
 *   intensity  = |valence| * arousal  (emotional intensity)
 *   threshold  = inversely proportional to emotion (more emotion → lower
 *                threshold → more bloom)
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, mapRange } from '../utils/math.js';

export class PostProcessing {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene}         scene
   * @param {THREE.Camera}        camera
   */
  constructor(renderer, scene, camera) {
    /** @type {THREE.WebGLRenderer} */
    this._renderer = renderer;

    /** @type {THREE.Scene} */
    this._scene = scene;

    /** @type {THREE.Camera} */
    this._camera = camera;

    // Build the composer pipeline
    const size = renderer.getSize(new THREE.Vector2());

    /** @type {EffectComposer} */
    this._composer = new EffectComposer(renderer);

    /** @type {RenderPass} */
    this._renderPass = new RenderPass(scene, camera);
    this._composer.addPass(this._renderPass);

    /** @type {UnrealBloomPass} */
    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.6,    // default strength
      0.4,    // default radius
      0.85,   // default threshold
    );
    this._composer.addPass(this._bloomPass);

    // OutputPass performs tone-mapping + colour-space conversion and must
    // come last so the final framebuffer is in the correct colour space.
    /** @type {OutputPass} */
    this._outputPass = new OutputPass();
    this._composer.addPass(this._outputPass);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Reconfigure bloom parameters from a sentiment profile.
   *
   * @param {{ valence: number, arousal: number }} sentimentProfile
   */
  configure(sentimentProfile) {
    const valence = sentimentProfile?.valence ?? 0;
    const arousal = sentimentProfile?.arousal ?? 0.5;

    // Emotional intensity drives bloom strength.
    const emotionalIntensity = Math.abs(valence) * clamp(arousal, 0, 1);

    // strength: calm text ≈ 0.2, highly emotional ≈ 1.4
    this._bloomPass.strength = clamp(
      mapRange(emotionalIntensity, 0, 5, 0.2, 1.4),
      0.1,
      1.8,
    );

    // threshold: intense emotion → lower threshold so more of the scene blooms
    this._bloomPass.threshold = clamp(
      mapRange(emotionalIntensity, 0, 5, 0.95, 0.2),
      0.1,
      1.0,
    );

    // radius stays roughly constant; nudge it slightly with arousal
    this._bloomPass.radius = clamp(
      mapRange(arousal, 0, 1, 0.3, 0.6),
      0.1,
      1.0,
    );
  }

  /**
   * Run the full post-processing pipeline (call once per frame instead of
   * renderer.render).
   */
  render() {
    this._composer.render();
  }

  /**
   * Handle viewport resize.
   *
   * @param {number} width   new pixel width
   * @param {number} height  new pixel height
   */
  resize(width, height) {
    this._composer.setSize(width, height);
    this._bloomPass.resolution.set(width, height);
  }

  /**
   * Release GPU resources owned by the composer and its passes.
   */
  dispose() {
    // Dispose render targets created by the composer
    this._composer.passes.forEach((pass) => {
      if (pass.dispose) pass.dispose();
    });

    // The composer's internal write/read buffers
    this._composer.renderTarget1.dispose();
    this._composer.renderTarget2.dispose();
  }
}
