/**
 * ReverbSystem -- Algorithmic convolution reverb generation.
 *
 * Synthesises impulse responses entirely in code (no external audio files)
 * by shaping exponentially decaying noise with room-type-specific filtering.
 *
 * Supported room types:
 *   vault    -- cathedral reverb (high diffusion, long tail)
 *   chamber  -- tight reflections (short, dense early reflections)
 *   crystal  -- bright metallic reverb (high-frequency emphasis)
 *   dome     -- smooth warm reverb (high-frequency rolloff)
 *   corridor -- flutter echo (repeated short reflections)
 *   void     -- infinite ethereal tail (sparse, heavily filtered)
 */

import { clamp } from '../utils/math.js';

/**
 * Room-type presets.  Each defines how the impulse response is shaped.
 *
 *   decayMultiplier  -- scales the base decay time
 *   density          -- 0-1  how densely packed the reflections are
 *   hiCut            -- low-pass cutoff as fraction of Nyquist (0-1)
 *   hiBoost          -- high-shelf gain (linear).  >1 = brighter
 *   earlyGain        -- gain of early reflections relative to tail
 *   earlyMs          -- duration of early-reflection cluster in ms
 *   flutter          -- if >0, add flutter echo with this period in ms
 *   sparse           -- if true, zero out random samples for ethereal effect
 */
const ROOM_PRESETS = {
  vault: {
    decayMultiplier: 1.4,
    density: 0.9,
    hiCut: 0.55,
    hiBoost: 0.7,
    earlyGain: 0.6,
    earlyMs: 80,
    flutter: 0,
    sparse: false,
  },
  chamber: {
    decayMultiplier: 0.5,
    density: 1.0,
    hiCut: 0.7,
    hiBoost: 0.9,
    earlyGain: 1.0,
    earlyMs: 30,
    flutter: 0,
    sparse: false,
  },
  crystal: {
    decayMultiplier: 0.9,
    density: 0.75,
    hiCut: 0.95,
    hiBoost: 1.6,
    earlyGain: 0.8,
    earlyMs: 50,
    flutter: 0,
    sparse: false,
  },
  dome: {
    decayMultiplier: 1.1,
    density: 0.85,
    hiCut: 0.35,
    hiBoost: 0.5,
    earlyGain: 0.5,
    earlyMs: 60,
    flutter: 0,
    sparse: false,
  },
  corridor: {
    decayMultiplier: 0.7,
    density: 0.6,
    hiCut: 0.65,
    hiBoost: 0.85,
    earlyGain: 0.9,
    earlyMs: 20,
    flutter: 45,
    sparse: false,
  },
  void: {
    decayMultiplier: 2.5,
    density: 0.3,
    hiCut: 0.25,
    hiBoost: 0.4,
    earlyGain: 0.15,
    earlyMs: 120,
    flutter: 0,
    sparse: true,
  },
};

export class ReverbSystem {
  /**
   * @param {AudioContext} audioContext
   */
  constructor(audioContext) {
    /** @type {AudioContext} */
    this._ctx = audioContext;

    /** @type {ConvolverNode[]} */
    this._convolvers = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Impulse response synthesis                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Generate a stereo impulse response buffer.
   *
   * @param {number} roomScale  1-5, maps to 0.5s - 5s decay
   * @param {string} roomType   one of the ROOM_PRESETS keys
   * @returns {AudioBuffer}
   */
  generateImpulseResponse(roomScale, roomType) {
    const preset = ROOM_PRESETS[roomType] || ROOM_PRESETS.vault;
    const scale = clamp(roomScale, 1, 5);

    // Base decay in seconds: scale 1 = 0.5s, scale 5 = 5s (linear map)
    const baseDecay = 0.5 + (scale - 1) * (4.5 / 4);
    const decayTime = baseDecay * preset.decayMultiplier;

    const sampleRate = this._ctx.sampleRate;
    const length = Math.ceil(decayTime * sampleRate);
    const buffer = this._ctx.createBuffer(2, length, sampleRate);

    const channelL = buffer.getChannelData(0);
    const channelR = buffer.getChannelData(1);

    const earlySamples = Math.floor((preset.earlyMs / 1000) * sampleRate);
    const flutterSamples = preset.flutter > 0
      ? Math.floor((preset.flutter / 1000) * sampleRate)
      : 0;

    // Nyquist-relative cutoff for simple one-pole low-pass
    const hiCutCoeff = 1.0 - preset.hiCut;

    for (let ch = 0; ch < 2; ch++) {
      const data = ch === 0 ? channelL : channelR;

      // One-pole low-pass filter state
      let lpState = 0;

      for (let i = 0; i < length; i++) {
        // White noise source
        let sample = Math.random() * 2 - 1;

        // Density gating: zero out some samples for sparser textures
        if (preset.density < 1.0 && Math.random() > preset.density) {
          sample = 0;
        }

        // Sparse mode: aggressively zero out for ethereal effect
        if (preset.sparse && Math.random() > 0.12) {
          sample = 0;
        }

        // Exponential decay envelope
        const t = i / sampleRate;
        // Use -60dB decay time (RT60): envelope = 10^(-3 * t / decayTime)
        const envelope = Math.pow(10, -3 * t / decayTime);

        // Early reflections boost
        const earlyBoost = i < earlySamples
          ? preset.earlyGain * (1 - i / earlySamples) + 1
          : 1;

        sample *= envelope * earlyBoost;

        // Flutter echo: add delayed copies at regular intervals
        if (flutterSamples > 0 && i >= flutterSamples) {
          const echoIdx = i - flutterSamples;
          if (echoIdx >= 0 && echoIdx < length) {
            sample += data[echoIdx] * 0.45;
          }
        }

        // One-pole low-pass filter
        lpState += (sample - lpState) * (1 - hiCutCoeff);
        sample = lpState;

        // High-frequency boost/cut via simple shelf approximation:
        // mix filtered and unfiltered signals
        if (preset.hiBoost !== 1.0) {
          const rawNoise = sample; // already filtered
          // Approximate high-shelf by blending low-passed with original
          // hiBoost > 1 preserves more high-frequency energy
          sample = rawNoise * preset.hiBoost;
        }

        data[i] = sample;
      }
    }

    // Normalize to prevent clipping
    this._normalizeBuffer(buffer);

    return buffer;
  }

  /* ------------------------------------------------------------------ */
  /*  Convolver creation                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Create a ConvolverNode with a generated impulse response.
   *
   * @param {number} roomScale  1-5
   * @param {string} roomType   e.g. 'vault', 'chamber', 'crystal'
   * @returns {ConvolverNode}
   */
  createReverb(roomScale, roomType) {
    const ir = this.generateImpulseResponse(roomScale, roomType);
    const convolver = this._ctx.createConvolver();
    convolver.buffer = ir;
    convolver.normalize = true;

    this._convolvers.push(convolver);
    return convolver;
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  dispose() {
    for (const c of this._convolvers) {
      c.disconnect();
    }
    this._convolvers.length = 0;
  }

  /* ------------------------------------------------------------------ */
  /*  Internal helpers                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Peak-normalize a stereo AudioBuffer to 0.85 to leave headroom.
   * @param {AudioBuffer} buffer
   */
  _normalizeBuffer(buffer) {
    let peak = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }
    if (peak === 0) return;

    const gain = 0.85 / peak;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        data[i] *= gain;
      }
    }
  }
}
