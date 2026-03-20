/**
 * AudioEngine -- Main spatial audio orchestrator for the synesthesia engine.
 *
 * Coordinates HarmonicGenerator, SpatialMixer, and ReverbSystem to produce
 * a cohesive, text-driven spatial soundscape.
 *
 * Usage:
 *   const engine = new AudioEngine();
 *   await engine.init();              // call after user gesture
 *   engine.configure(fingerprint);    // fingerprint from text analysis
 *   engine.start();
 *   // per frame:
 *   engine.updateListener(pos, fwd, up);
 *   engine.setActiveRoom(index);
 *   // cleanup:
 *   engine.dispose();
 */

import { clamp } from '../utils/math.js';
import { HarmonicGenerator } from './HarmonicGenerator.js';
import { SpatialMixer } from './SpatialMixer.js';
import { ReverbSystem } from './ReverbSystem.js';

/* ------------------------------------------------------------------ */
/*  Room type vocabulary (matched to geometry types)                    */
/* ------------------------------------------------------------------ */

const ROOM_TYPES = ['vault', 'chamber', 'crystal', 'dome', 'corridor', 'void'];

/**
 * Pick a room type deterministically from a seed value.
 * @param {number} seed
 * @returns {string}
 */
function roomTypeFromSeed(seed) {
  return ROOM_TYPES[Math.abs(seed) % ROOM_TYPES.length];
}

/* ------------------------------------------------------------------ */
/*  AudioEngine                                                         */
/* ------------------------------------------------------------------ */

export class AudioEngine {
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null;

    /** @type {HarmonicGenerator|null} */
    this._harmonics = null;

    /** @type {SpatialMixer|null} */
    this._mixer = null;

    /** @type {ReverbSystem|null} */
    this._reverb = null;

    /** @type {GainNode|null} */
    this._masterGain = null;

    /**
     * Per-room audio state.
     * @type {Array<{
     *   bank: { node: GainNode, oscillators: OscillatorNode[], lfo: OscillatorNode },
     *   reverb: ConvolverNode,
     *   spatialGain: GainNode,
     *   dryGain: GainNode,
     *   wetGain: GainNode,
     * }>}
     */
    this._rooms = [];

    /** @type {boolean} */
    this._running = false;

    /** @type {boolean} */
    this._disabled = false;

    /** @type {number} */
    this._activeRoom = 0;
  }

  /* ------------------------------------------------------------------ */
  /*  Initialization                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Create the AudioContext.  Must be called in response to a user gesture
   * (click / tap / keydown) to satisfy browser autoplay policies.
   */
  async init() {
    if (this._ctx) return;

    try {
      this._ctx = new AudioContext();
    } catch (e) {
      console.warn('AudioContext creation failed:', e);
      this._disabled = true;
      return;
    }

    // Master gain
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 0.7;
    this._masterGain.connect(this._ctx.destination);

    // Sub-systems
    this._harmonics = new HarmonicGenerator(this._ctx);
    this._mixer = new SpatialMixer(this._ctx);
    this._reverb = new ReverbSystem(this._ctx);

    // Resume context in case it was created in suspended state
    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Configuration from text fingerprint                                */
  /* ------------------------------------------------------------------ */

  /**
   * Configure audio from a text fingerprint and optional worldGraph rooms.
   *
   * Accepts either:
   * - A TextFingerprint (with .rhythm, .sentiment, .structural) — will generate
   *   room audio data from the per-sentence analysis.
   * - A fingerprint with a .rooms array (pre-built WorldGraph room nodes).
   *
   * @param {object} fingerprint
   */
  configure(fingerprint) {
    if (this._disabled) return;
    if (!this._ctx) {
      throw new Error('AudioEngine.init() must be called before configure()');
    }

    // Tear down any previous configuration
    this._disposeRooms();

    // Build rooms from fingerprint analysis data
    const rooms = fingerprint.rooms || this._buildRoomsFromFingerprint(fingerprint);

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const roomIndex = room.index ?? i;
      const scale = clamp(room.scale ?? 2, 1, 5);
      const roomType = room.geometryType || room.roomType || roomTypeFromSeed(room.seed ?? roomIndex);
      const position = room.position || { x: i * 20, y: 2, z: 0 };
      const stressPattern = room.stressPattern || [1, 0, 1, 0];
      const sentimentValence = clamp(room.valence ?? room.sentimentValence ?? 0, -1, 1);

      // 1. Harmonic bank for this room
      const bank = this._harmonics.createRoomHarmonics({
        roomIndex,
        stressPattern,
        sentimentValence,
        seed: room.seed ?? roomIndex * 137,
      });

      // 2. Reverb for this room
      const reverbNode = this._reverb.createReverb(scale, roomType);

      // 3. Dry/wet routing
      //    bank.node -> dryGain --------> spatialGain (from mixer)
      //    bank.node -> wetGain -> reverb -> spatialGain
      const dryGain = this._ctx.createGain();
      dryGain.gain.value = 0.6;

      const wetGain = this._ctx.createGain();
      // Larger rooms get more reverb
      wetGain.gain.value = 0.15 + (scale - 1) * 0.1; // 0.15 - 0.55

      bank.node.connect(dryGain);
      bank.node.connect(wetGain);
      wetGain.connect(reverbNode);

      // 4. Spatial positioning via mixer
      //    Create a merge node to combine dry + wet before spatialization
      const mergeGain = this._ctx.createGain();
      mergeGain.gain.value = 1.0;

      dryGain.connect(mergeGain);
      reverbNode.connect(mergeGain);

      // Create spatial source: places the mergeGain output in 3D space
      const { gain: spatialGain } = this._mixer.createSource(
        position,
        mergeGain,
        roomIndex
      );

      // Route spatial output to master
      spatialGain.connect(this._masterGain);

      this._rooms.push({
        bank,
        reverb: reverbNode,
        spatialGain,
        dryGain,
        wetGain,
      });
    }

    // Set initial active room
    if (rooms.length > 0) {
      this._mixer.crossfadeTo(0, 0.01);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Per-frame update                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Update the audio listener position and orientation.
   * Call once per frame with the camera's world transform.
   *
   * @param {{x: number, y: number, z: number}} position
   * @param {{x: number, y: number, z: number}} forward
   * @param {{x: number, y: number, z: number}} up
   */
  updateListener(position, forward, up) {
    if (this._disabled || !this._mixer) return;
    this._mixer.updateListenerPosition(position, forward, up);
  }

  /* ------------------------------------------------------------------ */
  /*  Room transitions                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Crossfade to a new active room.
   *
   * @param {number} roomIndex      - 0-based room index
   * @param {number} transitionTime - Crossfade duration in seconds (default 1.0)
   */
  setActiveRoom(roomIndex, transitionTime = 1.0) {
    if (this._disabled) return;
    this._activeRoom = roomIndex;
    if (!this._mixer) return;
    this._mixer.crossfadeTo(roomIndex, transitionTime);
  }

  /* ------------------------------------------------------------------ */
  /*  Volume control                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Set master volume.
   *
   * @param {number} v  - 0 to 1
   */
  setVolume(v) {
    if (!this._masterGain) return;
    const vol = clamp(v, 0, 1);
    const now = this._ctx.currentTime;
    this._masterGain.gain.cancelScheduledValues(now);
    this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
    this._masterGain.gain.linearRampToValueAtTime(vol, now + 0.05);
  }

  /* ------------------------------------------------------------------ */
  /*  Transport                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Start all audio (oscillators + LFOs).
   */
  start() {
    if (this._disabled || this._running || !this._ctx) return;
    this._running = true;

    // Resume context if suspended
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }

    for (const room of this._rooms) {
      this._harmonics.startBank(room.bank);
    }
  }

  /**
   * Stop all audio gracefully.
   */
  stop() {
    if (!this._running || !this._ctx) return;
    this._running = false;

    // Fade master to silence before stopping oscillators
    const now = this._ctx.currentTime;
    this._masterGain.gain.cancelScheduledValues(now);
    this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
    this._masterGain.gain.linearRampToValueAtTime(0, now + 0.1);

    // Stop oscillators after fade
    setTimeout(() => {
      for (const room of this._rooms) {
        this._harmonics.stopBank(room.bank);
      }
    }, 150);
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Dispose all audio resources and close the AudioContext.
   */
  dispose() {
    this.stop();
    this._disposeRooms();

    if (this._harmonics) {
      this._harmonics.dispose();
      this._harmonics = null;
    }
    if (this._mixer) {
      this._mixer.dispose();
      this._mixer = null;
    }
    if (this._reverb) {
      this._reverb.dispose();
      this._reverb = null;
    }
    if (this._masterGain) {
      this._masterGain.disconnect();
      this._masterGain = null;
    }
    if (this._ctx) {
      this._ctx.close().catch(() => {});
      this._ctx = null;
    }
    this._running = false;
  }

  /* ------------------------------------------------------------------ */
  /*  Internal helpers                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Build room audio data from a TextFingerprint's per-sentence analysis.
   * @private
   */
  _buildRoomsFromFingerprint(fp) {
    const sentences = fp.sentences || [];
    const rooms = [];
    for (let i = 0; i < sentences.length; i++) {
      const rhythm = fp.rhythm?.perSentence?.[i];
      const sentiment = fp.sentiment?.perSentence?.[i];
      const structural = fp.structural;

      rooms.push({
        index: i,
        seed: i * 137 + (fp.masterHash || 0),
        scale: clamp(1 + (structural?.sentenceLengths?.[i] || 5) / 10, 1, 5),
        stressPattern: rhythm?.stressPattern || [1, 0, 1, 0],
        valence: sentiment?.valence ?? 0,
        position: { x: i * 20, y: 2, z: 0 },
        geometryType: 'chamber',
      });
    }
    return rooms;
  }

  /**
   * Tear down per-room audio graph without destroying sub-systems.
   */
  _disposeRooms() {
    for (const room of this._rooms) {
      room.dryGain.disconnect();
      room.wetGain.disconnect();
      room.reverb.disconnect();
      room.bank.node.disconnect();
    }
    this._rooms.length = 0;
  }
}
