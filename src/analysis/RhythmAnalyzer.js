/**
 * RhythmAnalyzer — Analyzes syllable patterns and rhythm.
 *
 * Produces per-sentence syllable counts, stress patterns, tempo, and cadence,
 * plus overall tempo variation and average tempo.
 */

import { countSyllables } from '../utils/math.js';

/**
 * Extract words from a sentence.
 * @param {string} sentence
 * @returns {string[]}
 */
function extractWords(sentence) {
  return sentence
    .replace(/[^a-zA-Z\s'-]/g, '')
    .split(/\s+/)
    .map(w => w.replace(/^['-]+|['-]+$/g, ''))
    .filter(w => w.length > 0);
}

/**
 * Generate a stress pattern for a word based on its syllable count.
 * Words with 1 syllable get [1] (stressed).
 * Words with >1 syllable get alternating stress starting with unstressed:
 *   2 syllables → [0, 1]
 *   3 syllables → [1, 0, 1]
 *   4 syllables → [0, 1, 0, 1]
 * This gives stress on odd positions (1-indexed): positions 1, 3, 5, etc.
 * @param {number} syllableCount
 * @returns {number[]}
 */
function wordStressPattern(syllableCount) {
  if (syllableCount <= 1) return [1];

  const pattern = [];
  for (let i = 0; i < syllableCount; i++) {
    // Odd positions (0-indexed) get stress for multi-syllable words
    pattern.push(i % 2 === 0 ? 0 : 1);
  }
  return pattern;
}

/**
 * Classify cadence based on how the stress pattern ends.
 *   - "masculine" if the sentence ends on a stressed syllable
 *   - "feminine" if the sentence ends on an unstressed syllable
 *   - "neutral" if the sentence is empty
 * @param {number[]} stressPattern - Flattened stress pattern for the sentence
 * @returns {string}
 */
function classifyCadence(stressPattern) {
  if (stressPattern.length === 0) return 'neutral';
  return stressPattern[stressPattern.length - 1] === 1 ? 'masculine' : 'feminine';
}

/**
 * Analyze rhythm for a single sentence.
 * @param {string} sentence
 * @returns {object} Rhythm profile for the sentence
 */
function analyzeSentence(sentence) {
  const words = extractWords(sentence);

  if (words.length === 0) {
    return {
      syllableCounts: [],
      stressPattern: [],
      tempo: 0,
      cadence: 'neutral',
    };
  }

  const syllableCounts = words.map(countSyllables);
  const totalSyllables = syllableCounts.reduce((sum, n) => sum + n, 0);

  // Build flattened stress pattern from per-word patterns
  const stressPattern = [];
  for (const count of syllableCounts) {
    const pattern = wordStressPattern(count);
    stressPattern.push(...pattern);
  }

  // Tempo: average syllables per word
  const tempo = totalSyllables / words.length;

  // Cadence classification
  const cadence = classifyCadence(stressPattern);

  return {
    syllableCounts,
    stressPattern,
    tempo,
    cadence,
  };
}

/**
 * Compute standard deviation.
 * @param {number[]} values
 * @returns {number}
 */
function standardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Analyze text for rhythm.
 * @param {string} text - Full input text
 * @param {string[]} sentences - Pre-split sentences
 * @returns {object} Rhythm profile
 */
export function analyze(text, sentences) {
  const perSentence = sentences.map(analyzeSentence);

  // Collect all sentence tempos (exclude empty sentences)
  const tempos = perSentence
    .filter(s => s.syllableCounts.length > 0)
    .map(s => s.tempo);

  const averageTempo = tempos.length > 0
    ? tempos.reduce((s, t) => s + t, 0) / tempos.length
    : 0;

  const tempoVariation = standardDeviation(tempos);

  return {
    perSentence,
    tempoVariation,
    averageTempo,
  };
}
