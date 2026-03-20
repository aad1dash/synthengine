/**
 * HarmonicGenerator -- Deterministic musical tone synthesis from text rhythm data.
 *
 * Maps syllable stress patterns, sentiment valence, and room indices to
 * oscillator banks using just intonation intervals for harmonious output.
 *
 * CPU budget: 2-4 oscillators per room, with gentle LFO modulation.
 */

import { clamp } from '../utils/math.js';

/* ------------------------------------------------------------------ */
/*  Musical constants (equal temperament, A4 = 440 Hz)                 */
/* ------------------------------------------------------------------ */

/**
 * Semitone ratio for 12-TET.
 */
const SEMITONE = Math.pow(2, 1 / 12);

/**
 * Convert a MIDI note number to frequency.
 * MIDI 60 = C4 = 261.63 Hz.
 */
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Base MIDI notes spread across C2-C5 for up to 12 rooms.
 * Each room gets a unique root, stepping by musical fourths/fifths
 * to stay consonant when rooms overlap spatially.
 *
 * Pattern: ascending by perfect fifths (7 semitones), wrapping within
 * the C2(36) - C5(72) range.
 */
function baseNoteForRoom(roomIndex) {
  const ROOT = 36; // C2
  const CEILING = 72; // C5
  // Circle-of-fifths walk
  const raw = ROOT + (roomIndex * 7) % 36;
  return clamp(raw, ROOT, CEILING);
}

/* ------------------------------------------------------------------ */
/*  Interval helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Major third above a fundamental (4 semitones in 12-TET, ~5:4 ratio).
 */
function majorThird(freq) {
  return freq * Math.pow(SEMITONE, 4);
}

/**
 * Minor third above a fundamental (3 semitones in 12-TET, ~6:5 ratio).
 */
function minorThird(freq) {
  return freq * Math.pow(SEMITONE, 3);
}

/**
 * Perfect fifth above a fundamental (7 semitones, ~3:2 ratio).
 */
function perfectFifth(freq) {
  return freq * Math.pow(SEMITONE, 7);
}

/* ------------------------------------------------------------------ */
/*  HarmonicGenerator                                                   */
/* ------------------------------------------------------------------ */

export class HarmonicGenerator {
  /**
   * @param {AudioContext} audioContext
   */
  constructor(audioContext) {
    /** @type {AudioContext} */
    this._ctx = audioContext;

    /**
     * Track all created oscillators and nodes for disposal.
     * @type {Array<{oscillators: OscillatorNode[], lfo: OscillatorNode|null, nodes: AudioNode[]}>}
     */
    this._banks = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Create an oscillator bank for one room.
   *
   * @param {object} roomData
   * @param {number} roomData.roomIndex       - 0-based index of the room
   * @param {number[]} roomData.stressPattern - array of 0 (unstressed) / 1 (stressed)
   * @param {number} roomData.sentimentValence - -1 (negative) to +1 (positive)
   * @param {number} [roomData.seed]          - optional seed for deterministic detuning
   * @returns {{ node: GainNode, oscillators: OscillatorNode[] }}
   */
  createRoomHarmonics(roomData) {
    const {
      roomIndex = 0,
      stressPattern = [1, 0, 1, 0],
      sentimentValence = 0,
      seed = roomIndex * 137,
    } = roomData;

    const ctx = this._ctx;

    // ---- Determine frequencies -----------------------------------------

    const baseMidi = baseNoteForRoom(roomIndex);
    const baseFreq = midiToFreq(baseMidi);

    // Map stress pattern to frequencies:
    //   unstressed = base freq
    //   stressed   = perfect fifth above (3:2 ratio)
    const stressFreqs = stressPattern.map(s =>
      s === 1 ? perfectFifth(baseFreq) : baseFreq
    );

    // Choose major/minor third based on sentiment valence
    const thirdFn = sentimentValence >= 0 ? majorThird : minorThird;
    const thirdFreq = thirdFn(baseFreq);

    // Build oscillator frequency list (2-4 oscillators):
    //   1) base frequency (always present)
    //   2) third (major or minor, from sentiment)
    //   3) first stressed frequency that differs from base (if any)
    //   4) optional octave above base for shimmer (if stress pattern is long enough)
    const freqs = [baseFreq, thirdFreq];

    const uniqueStress = stressFreqs.find(f => Math.abs(f - baseFreq) > 1);
    if (uniqueStress) {
      freqs.push(uniqueStress);
    }

    if (stressPattern.length >= 4) {
      freqs.push(baseFreq * 2); // octave above
    }

    // Limit to 4 oscillators max
    const oscFreqs = freqs.slice(0, 4);

    // ---- Oscillator types -----------------------------------------------
    // Sine for warm tones (base, third), triangle for brighter (fifth, octave)
    const oscTypes = oscFreqs.map((_, i) =>
      i < 2 ? 'sine' : 'triangle'
    );

    // ---- Create output gain node ----------------------------------------
    const outputGain = ctx.createGain();
    // Start silent; AudioEngine will manage levels
    outputGain.gain.value = 0;

    // ---- Create LFO for gentle frequency modulation ---------------------
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    // Slow LFO rate: 0.1 - 0.5 Hz depending on room index
    lfo.frequency.value = 0.1 + (roomIndex % 5) * 0.08;

    const lfoGain = ctx.createGain();
    // Modulation depth: subtle, 0.5-2 Hz of frequency wobble
    lfoGain.gain.value = 0.8 + (roomIndex % 3) * 0.4;

    lfo.connect(lfoGain);

    // ---- Create oscillators ---------------------------------------------
    const oscillators = [];
    const allNodes = [outputGain, lfo, lfoGain];

    // Deterministic detuning from seed
    let detuneSeed = seed;
    function nextDetune() {
      // Simple LCG for deterministic detune values
      detuneSeed = (detuneSeed * 1664525 + 1013904223) >>> 0;
      return ((detuneSeed / 4294967296) - 0.5) * 12; // -6 to +6 cents
    }

    const oscCount = oscFreqs.length;
    const perOscGain = 1.0 / oscCount; // Even level distribution

    for (let i = 0; i < oscCount; i++) {
      const osc = ctx.createOscillator();
      osc.type = oscTypes[i];
      osc.frequency.value = oscFreqs[i];
      osc.detune.value = nextDetune();

      // Connect LFO to oscillator frequency for modulation
      lfoGain.connect(osc.frequency);

      // Per-oscillator gain for mixing
      const oscGainNode = ctx.createGain();
      oscGainNode.gain.value = perOscGain;

      osc.connect(oscGainNode);
      oscGainNode.connect(outputGain);

      oscillators.push(osc);
      allNodes.push(osc, oscGainNode);
    }

    // Track for disposal
    this._banks.push({ oscillators, lfo, nodes: allNodes });

    return { node: outputGain, oscillators, lfo };
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Start all oscillators in a bank.
   * @param {{ oscillators: OscillatorNode[], lfo: OscillatorNode }} bank
   */
  startBank(bank) {
    const now = this._ctx.currentTime;
    bank.lfo.start(now);
    for (const osc of bank.oscillators) {
      osc.start(now);
    }
  }

  /**
   * Stop all oscillators in a bank.
   * @param {{ oscillators: OscillatorNode[], lfo: OscillatorNode }} bank
   */
  stopBank(bank) {
    const now = this._ctx.currentTime;
    try { bank.lfo.stop(now); } catch (_) { /* already stopped */ }
    for (const osc of bank.oscillators) {
      try { osc.stop(now); } catch (_) { /* already stopped */ }
    }
  }

  /**
   * Disconnect and release all created nodes.
   */
  dispose() {
    for (const bank of this._banks) {
      try { bank.lfo.stop(); } catch (_) { /* noop */ }
      for (const osc of bank.oscillators) {
        try { osc.stop(); } catch (_) { /* noop */ }
      }
      for (const node of bank.nodes) {
        node.disconnect();
      }
    }
    this._banks.length = 0;
  }
}
