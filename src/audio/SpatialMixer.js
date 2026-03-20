/**
 * SpatialMixer -- HRTF spatial positioning and room crossfading.
 *
 * Wraps the Web Audio PannerNode API to place audio sources in 3D space
 * and smoothly crossfade between rooms as the player moves.
 */

import { clamp } from '../utils/math.js';

/* ------------------------------------------------------------------ */
/*  Source descriptor                                                   */
/* ------------------------------------------------------------------ */

/**
 * @typedef {object} SpatialSource
 * @property {PannerNode}  panner    - 3D panner node (HRTF)
 * @property {GainNode}    gain      - Volume control for crossfading
 * @property {number}      roomIndex - Which room this source belongs to
 * @property {{x:number, y:number, z:number}} position - World position
 */

/* ------------------------------------------------------------------ */
/*  SpatialMixer                                                        */
/* ------------------------------------------------------------------ */

export class SpatialMixer {
  /**
   * @param {AudioContext} audioContext
   */
  constructor(audioContext) {
    /** @type {AudioContext} */
    this._ctx = audioContext;

    /** @type {SpatialSource[]} */
    this._sources = [];

    /** @type {number} */
    this._activeRoom = 0;
  }

  /* ------------------------------------------------------------------ */
  /*  Source creation                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Create a spatial audio source positioned in 3D space.
   *
   * The returned gain node should be connected to downstream processing
   * (reverb, master output, etc.).
   *
   * @param {{x: number, y: number, z: number}} position  - World-space position
   * @param {AudioNode} audioNode   - Upstream audio to spatialize
   * @param {number}    roomIndex   - Room this source belongs to
   * @returns {{ panner: PannerNode, gain: GainNode }}
   */
  createSource(position, audioNode, roomIndex = 0) {
    const ctx = this._ctx;

    // -- PannerNode with HRTF --
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 5;
    panner.maxDistance = 100;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 0;

    // Set initial position
    if (panner.positionX) {
      // Modern API (AudioParam-based)
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
    } else {
      // Legacy fallback
      panner.setPosition(position.x, position.y, position.z);
    }

    // -- Gain node for crossfading --
    const gain = ctx.createGain();
    // Start at 0; AudioEngine will set the active room
    gain.gain.value = roomIndex === this._activeRoom ? 1.0 : 0.0;

    // Wire: audioNode -> panner -> gain -> (downstream)
    audioNode.connect(panner);
    panner.connect(gain);

    const source = { panner, gain, roomIndex, position };
    this._sources.push(source);

    return { panner, gain };
  }

  /* ------------------------------------------------------------------ */
  /*  Listener update (called per frame)                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Update the AudioListener position and orientation.
   *
   * @param {{x: number, y: number, z: number}} position  - Camera position
   * @param {{x: number, y: number, z: number}} forward   - Camera forward vector
   * @param {{x: number, y: number, z: number}} up        - Camera up vector
   */
  updateListenerPosition(position, forward, up) {
    const listener = this._ctx.listener;

    if (listener.positionX) {
      // Modern AudioParam API
      const now = this._ctx.currentTime;
      listener.positionX.setValueAtTime(position.x, now);
      listener.positionY.setValueAtTime(position.y, now);
      listener.positionZ.setValueAtTime(position.z, now);
      listener.forwardX.setValueAtTime(forward.x, now);
      listener.forwardY.setValueAtTime(forward.y, now);
      listener.forwardZ.setValueAtTime(forward.z, now);
      listener.upX.setValueAtTime(up.x, now);
      listener.upY.setValueAtTime(up.y, now);
      listener.upZ.setValueAtTime(up.z, now);
    } else {
      // Legacy API
      listener.setPosition(position.x, position.y, position.z);
      listener.setOrientation(
        forward.x, forward.y, forward.z,
        up.x, up.y, up.z
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Crossfading                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Crossfade all sources: the active room fades to full volume,
   * all others fade to a quiet ambient level.
   *
   * @param {number} roomIndex  - Room to make active
   * @param {number} duration   - Crossfade duration in seconds
   */
  crossfadeTo(roomIndex, duration = 1.0) {
    this._activeRoom = roomIndex;
    const now = this._ctx.currentTime;
    const fadeDuration = Math.max(0.01, duration);

    // Active room plays at full volume; inactive rooms at low ambient level
    // to maintain spatial awareness
    const ACTIVE_GAIN = 1.0;
    const AMBIENT_GAIN = 0.04;

    for (const source of this._sources) {
      const targetGain = source.roomIndex === roomIndex
        ? ACTIVE_GAIN
        : AMBIENT_GAIN;

      const gainParam = source.gain.gain;

      // Cancel any in-progress ramps and set current value
      gainParam.cancelScheduledValues(now);
      gainParam.setValueAtTime(gainParam.value, now);
      // Exponential ramp for smooth perceptual crossfade
      // (exponentialRampToValueAtTime cannot ramp to 0, use small floor)
      gainParam.exponentialRampToValueAtTime(
        Math.max(targetGain, 0.001),
        now + fadeDuration
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Utilities                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Update a source's 3D position (e.g. for moving sound sources).
   *
   * @param {number} sourceIndex
   * @param {{x: number, y: number, z: number}} position
   */
  updateSourcePosition(sourceIndex, position) {
    const source = this._sources[sourceIndex];
    if (!source) return;

    source.position = position;
    const panner = source.panner;

    if (panner.positionX) {
      const now = this._ctx.currentTime;
      panner.positionX.setValueAtTime(position.x, now);
      panner.positionY.setValueAtTime(position.y, now);
      panner.positionZ.setValueAtTime(position.z, now);
    } else {
      panner.setPosition(position.x, position.y, position.z);
    }
  }

  /**
   * @returns {number} Number of registered sources
   */
  get sourceCount() {
    return this._sources.length;
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  dispose() {
    for (const source of this._sources) {
      source.panner.disconnect();
      source.gain.disconnect();
    }
    this._sources.length = 0;
  }
}
